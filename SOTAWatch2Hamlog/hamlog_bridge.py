#
# hamlog_bridge.py : SOTA Watch to HAMLOG デスクトッププログラム
#
# ブラウザ拡張機能からデータを受け取り、Windows APIを使用してTurbo HAMLOGの入力ウインドウに転送する
#
# さらに、GeoJSON山岳データベースのZIPファイルをgeojsonサブフォルダに置いておくと、
# 起動時にデータベースをロードして、山岳IDから山名を引いてHAMLOGに転送することもできる
#
# (c) 2026 Takeshi Mishima JK1VUZ
#

import win32gui
import win32con
import os
import io
import re
import glob
import time
import ctypes
import json
import zipfile
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# GeoJSONファイルから山岳データベースを構築
SUMMIT_DB = {}

def load_summit_db_from_zip():
    global SUMMIT_DB
    SUMMIT_DB = {} # 初期化
    
    # 実行ファイルと同じ階層に 'geojson' フォルダを探す
    base_dir = 'geojson'
    if not os.path.exists(base_dir):
        # フォルダが存在しない場合は、従来通りカレントディレクトリを探す
        print(f"Directory '{base_dir}' not found.")
        return
        
    # フォルダ内のすべてのZIPファイルを探す
    search_path = os.path.join(base_dir, '*.zip')
    zip_files = glob.glob(search_path)

    if not zip_files:
        print(f"NO ZIP files found in {base_dir}.")
        return
        
    latest_zip = None
    
    # ZIPファイルが1つだけの場合はそのファイルを採用
    if len(zip_files) == 1:
        latest_zip = zip_files[0]
        print(f"ZIP found: {latest_zip}")
    
    # ZIPファイルが複数ある場合は、ファイル名に数字を含み、かつ最大の数字を持つものを採用
    else:
        versioned_zip_files = []
        for f in zip_files:
            nums = re.findall(r'\d+', f)
            if nums:
                # ファイル名とファイル名の最後の数値のペアを保存
                versioned_zip_files.append((f, int(nums[-1])))
        
        # ZIPファイルが複数あるけれども、ファイル名に数字を含むファイルがない場合は採用しない
        if not versioned_zip_files:
            print("No ZIP files with version number found.")
            return
        
        # 最大の数字を持つものを採用
        latest_zip_pair = max(versioned_zip_files, key=lambda x: x[1])
        latest_zip = latest_zip_pair[0]
        print(f"Loading latest database: {latest_zip}")

    try:
        with zipfile.ZipFile(latest_zip, 'r') as z:
            # サブディレクトリを含むすべての.geojsonを読み込む
            for file_info in z.infolist():
                if file_info.filename.endswith('.geojson'):
                    with z.open(file_info) as f:
                        data = json.load(f)
                        for feature in data.get('features', []):
                            props = feature.get('properties', {})
                            # "JA/NI-004(焼山)" の形式から山岳IDと山名を分離
                            raw_name = props.get('name', '')
                            if '(' in raw_name:
                                # 最初の ( で分割
                                s_id, s_name_raw = raw_name.split('(', 1)
                                # 末尾の ) を除去
                                s_name = s_name_raw.rsplit(')', 1)[0]
                                SUMMIT_DB[s_id.strip()] = s_name.strip()
        print(f"Database loaded: {len(SUMMIT_DB)} summits from ZIP.")
    except Exception as e:
        print(f"Warning: Could not load ZIP database: {e}")

# 起動時にデータベースをロード
load_summit_db_from_zip()

def set_text(hwnd, text):
    win32gui.SendMessage(hwnd, win32con.WM_SETTEXT, 0, text)

def send_to_hamlog(data):
    # --- 入力ウィンドウの特定 ---
    # content.jsから届く A または B を使用
    log_type = data.get('targetLog', 'A') 
    # 全角のＡまたはＢに変換してタイトルを作成
    target_suffix = "Ａ" if log_type == 'A' else "Ｂ"
    target_title = f"ＬＯＧ-[{target_suffix}]"
    
    main_hwnd = 0
    def find_window_callback(h, lparam):
        nonlocal main_hwnd
        if target_title in win32gui.GetWindowText(h):
            main_hwnd = h
            return False
        return True
    win32gui.EnumWindows(find_window_callback, None)

    # --- 入力ウインドウ自体が存在するか ---
    if not main_hwnd:
        return {"success": False, "message": f"HAMLOGのLOG-[{log_type}]が見つかりません"}

    # --- 入力ウインドウが表示されているか ---
    # 入力ウインドウが非表示のときにプログラムで操作すると「×」ボタンが効かなくなるため
    if not win32gui.IsWindowVisible(main_hwnd):
        return {"success": False, "message": f"HAMLOGのLOG-[{log_type}]を表示状態にしてください"}

    child_hwnds = []
    win32gui.EnumChildWindows(main_hwnd, lambda h, l: l.append(h), child_hwnds)

    try:
        # MODEを入力（MODEを後から入力するとRSTが書き変わってしまう）
        set_text(child_hwnds[15], data.get('mode', 'CW'))
        
        # 山岳情報の処理
        s_id = data.get('summit', 'N/A')
        s_name = SUMMIT_DB.get(s_id, "")
        
        # ユーザ指定の書式を置換
        fmt = data.get('summitFormat', '{summit_id} {summit_name}')
        new_info = fmt.replace("{summit_id}", s_id).replace("{summit_name}", s_name).strip()

        # SOTAサミットIDを指定の書式でRemarks1またはRemarks2に追記する
        target_remarks = data.get('targetRemarks', 'Remarks1')
        
        rem_idx = 9 if target_remarks == "Remarks1" else 8
        target_hwnd = child_hwnds[rem_idx]

        # 既存テキストを取得
        length = win32gui.SendMessage(target_hwnd, win32con.WM_GETTEXTLENGTH, 0, 0)
        current_text = ""
        if length > 0:
            buf = ctypes.create_unicode_buffer(length + 1)
            win32gui.SendMessage(target_hwnd, win32con.WM_GETTEXT, length + 1, buf)
            current_text = buf.value.strip()

        # 重複チェック
        if new_info and (new_info not in current_text):
            final_remarks = f"{current_text} {new_info}".strip()
            win32gui.SendMessage(target_hwnd, win32con.WM_SETTEXT, 0, final_remarks)
            
        # FREQを入力
        try:
            f_val = float(data.get('freq', 0))
            set_text(child_hwnds[16], f"{f_val:.3f}")
        except: pass

        # RSTを入力
        set_text(child_hwnds[18], data.get('rstHis', '59')) # His
        set_text(child_hwnds[17], data.get('rstMy', '59'))  # My

        # コールサインを入力
        call_hwnd = child_hwnds[21]
        callsign = data['call']
        set_text(call_hwnd, callsign)
        
        # コールサイン欄にフォーカスをセット（ENTERを送ったときに過ってSAVEしないようにする対策）
        win32gui.SendMessage(call_hwnd, win32con.WM_SETFOCUS, 0, 0)
        time.sleep(0.1) # フォーカス移動の時間を確保
        
        # コールサイン欄にEnterを送る（日付時刻の自動入力が動く）
        win32gui.PostMessage(call_hwnd, win32con.WM_KEYDOWN, win32con.VK_RETURN, 0)
        win32gui.PostMessage(call_hwnd, win32con.WM_KEYUP, win32con.VK_RETURN, 0)
        time.sleep(0.1)

        # 日付を入力
        set_text(child_hwnds[20], data.get('dateStr', ''))

        # 時刻を入力
        set_text(child_hwnds[19], data.get('timeStr', ''))

        # 最後に改めて、ユーザーがすぐに操作できるようにフォーカスをセット
        try:
            win32gui.SetForegroundWindow(main_hwnd)
        except:
            pass
                
        return {"success": True, "message": f"LOG-[{log_type}]へ転送しました : {callsign} ({s_id})"}
        
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.route('/post_log', methods=['POST'])
def post_log():
    # print(request.json)  # デバッグプリント文（ターミナルに出力）
    return jsonify(send_to_hamlog(request.json))

@app.route('/health', methods=['GET'])
def health_check():
    return {"status": "running", "message": "SOTA Watch to HAMLOG Bridge is active!"}

if __name__ == '__main__':
    app.run(port=5000)
