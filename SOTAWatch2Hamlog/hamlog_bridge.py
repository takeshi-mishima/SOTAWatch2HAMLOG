#
# hamlog_bridge.py : SOTAWatch to HAMLOG デスクトッププログラム
#
# ブラウザ拡張機能からデータを受け取り、Windows APIを使用してTurbo HAMLOGの入力ウインドウに転送する
#
# さらに、GeoJSON山岳データベースのZIPファイルをgeojsonサブフォルダに置いておくと、
# 起動時にデータベースをロードして、山岳IDから山名を引いてHAMLOGに転送することもできる
#
# rigant.txtをこのファイルと同じフォルダに置いておくと、
# 周波数（バンド）に対応するリグ・アンテナ情報を書式の{rig}プレースホルダに埋め込む
#
# (c) 2026 Takeshi Mishima JK1VUZ
#

import win32gui
import win32con
import os
import io
import re
import csv
import glob
import time
import ctypes
from ctypes import wintypes
import json
import zipfile
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# -----------------------------------------------------------------------
# 周波数帯（バンド）の定義設定
# 編集・追加する場合は、以下のリストに (下限MHz, 上限MHz, バンドMHz) を追加してください。
# バンドはrigant.txtのテーブルの検索キーになります。
# -----------------------------------------------------------------------
BAND_RANGES = [
	# (下限MHz, 上限MHz, バンド)
	(1.8, 2.0, 1.8),
	(3.5, 4.0, 3.5),
	(7.0, 7.2, 7),
	(10.0, 10.2, 10),
	(14.0, 14.4, 14),
	(18.0, 18.2, 18),
	(21.0, 21.5, 21),
	(24.8, 25.0, 24),
	(28.0, 30.0, 28),
	(50,  54,  50),
	(144, 146, 144),
	(430, 440, 430),
	(1260, 1300, 1200),
	(2400, 2450, 2400),
	(5600, 5900, 5600),
	(10000, 10500, 10000),
]

# -----------------------------------------------------------------------
# GeoJSONファイルから山岳データベースを構築
# -----------------------------------------------------------------------
SUMMIT_DB = {}

def load_summit_db_from_zip():
	global SUMMIT_DB
	SUMMIT_DB = {}
	
	base_dir = 'geojson'
	if not os.path.exists(base_dir):
		print(f"Directory '{base_dir}' not found.")
		return
		
	search_path = os.path.join(base_dir, '*.zip')
	zip_files = glob.glob(search_path)

	if not zip_files:
		print(f"NO ZIP files found in {base_dir}.")
		return
		
	latest_zip = None
	
	if len(zip_files) == 1:
		latest_zip = zip_files[0]
		print(f"ZIP found: {latest_zip}")
	else:
		versioned_zip_files = []
		for f in zip_files:
			nums = re.findall(r'\d+', f)
			if nums:
				versioned_zip_files.append((f, int(nums[-1])))
		
		if not versioned_zip_files:
			print("No ZIP files with version number found.")
			return
		
		latest_zip_pair = max(versioned_zip_files, key=lambda x: x[1])
		latest_zip = latest_zip_pair[0]
		print(f"Loading latest database: {latest_zip}")

	try:
		with zipfile.ZipFile(latest_zip, 'r') as z:
			for file_info in z.infolist():
				if file_info.filename.endswith('.geojson'):
					with z.open(file_info) as f:
						data = json.load(f)
						for feature in data.get('features', []):
							props = feature.get('properties', {})
							raw_name = props.get('name', '')
							if '(' in raw_name:
								s_id, s_name_raw = raw_name.split('(', 1)
								s_name = s_name_raw.rsplit(')', 1)[0]
								SUMMIT_DB[s_id.strip()] = s_name.strip()
		print(f"Database loaded: {len(SUMMIT_DB)} summits from ZIP.")
	except Exception as e:
		print(f"Warning: Could not load ZIP database: {e}")

# -----------------------------------------------------------------------
# rigant.txtから周波数→リグ情報テーブルを構築
# -----------------------------------------------------------------------
RIGANT_TABLE = []  # [(freq, rig), ...]

def load_rigant():
	global RIGANT_TABLE
	RIGANT_TABLE = []

	csv_path = 'rigant.txt'
	if not os.path.exists(csv_path):
		print(f"rigant.txt not found. {{rig}} will be replaced with empty string.")
		return

	try:
		with open(csv_path, newline='', encoding='cp932') as f:
			reader = csv.reader(f)
			for row in reader:
				if not row or row[0].strip().startswith('#'):
					continue
				if len(row) < 2:
					continue
				try:
					freq = float(row[0].strip())
					rig  = row[1].strip()
					RIGANT_TABLE.append((freq, rig))
					# print(f"{freq} -> {rig}")
				except ValueError:
					pass
		print(f"rigant.txt loaded: {len(RIGANT_TABLE)} entries.")
	except Exception as e:
		print(f"Warning: Could not load rigant.txt: {e}")

def resolve_rig(freq_mhz_str):
	"""周波数をあらかじめ決めた範囲でバンドに変換し、rigant.txtのテーブルを引いて返す。"""
	try:
		raw_freq = float(freq_mhz_str)
	except (ValueError, TypeError):
		return ""

	# 1. 周波数を BAND_RANGES 定義に基づいてバンドに変換
	band = None
	for lower, upper, band_str in BAND_RANGES:
		if lower <= raw_freq < upper:
			band = band_str
			break
	
	# バンドに変換できない場合は空白を返す
	if band is None:
		return ""

	# 2. 変換後のバンドとrigant.txtの周波数が一致するものを検索
	for rigant_band, rig in RIGANT_TABLE:
		if band == rigant_band:
			return rig
			
	return ""

# -----------------------------------------------------------------------
# 起動時にデータベースをロード
# -----------------------------------------------------------------------
load_summit_db_from_zip()
load_rigant()

# -----------------------------------------------------------------------
# Windows API
# -----------------------------------------------------------------------
user32   = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

VK_MENU      = 0x12
VK_D         = 0x44
VK_A         = 0x41
VK_B         = 0x42
WM_SYSKEYDOWN = 0x0104
WM_SYSKEYUP   = 0x0105
WM_KEYDOWN    = 0x0100
WM_KEYUP      = 0x0101
BM_SETCHECK   = 0x00F1
BST_CHECKED   = 0x0001
BST_UNCHECKED = 0x0000

def lp_sys(scan, prev_down=0, transition=0):
	return (
		0x00000001          |
		(scan  & 0xFF) << 16 |
		(prev_down & 0x1) << 30 |
		(transition & 0x1) << 31 |
		(1 << 29)
	)

def lp_normal(scan, prev_down=0, transition=0):
	return (
		0x00000001          |
		(scan  & 0xFF) << 16 |
		(prev_down & 0x1) << 30 |
		(transition & 0x1) << 31
	)

def ensure_input_window_open(log_type):
	hwnd_main = user32.FindWindowW("TThwin", None)
	if not hwnd_main:
		return False

	if user32.IsIconic(hwnd_main):
		user32.ShowWindow(hwnd_main, 9)
	else:
		user32.ShowWindow(hwnd_main, 5)

	fg_hwnd   = user32.GetForegroundWindow()
	fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None)
	my_thread = kernel32.GetCurrentThreadId()
	attached  = False
	
	try:
		if fg_thread != my_thread:
			user32.AttachThreadInput(fg_thread, my_thread, True)
			attached = True

		user32.SetForegroundWindow(hwnd_main)
		user32.BringWindowToTop(hwnd_main)

		if attached:
			user32.AttachThreadInput(fg_thread, my_thread, False)

		scan_alt = user32.MapVirtualKeyW(VK_MENU, 0)
		scan_d   = user32.MapVirtualKeyW(VK_D,   0)
		
		user32.PostMessageW(hwnd_main, WM_SYSKEYDOWN, VK_MENU, lp_sys(scan_alt, 0, 0))
		time.sleep(0.05)
		user32.PostMessageW(hwnd_main, WM_SYSKEYDOWN, VK_D,    lp_sys(scan_d,   0, 0))
		time.sleep(0.05)
		user32.PostMessageW(hwnd_main, WM_SYSKEYUP,   VK_D,    lp_sys(scan_d,   1, 1))
		time.sleep(0.05)
		user32.PostMessageW(hwnd_main, WM_SYSKEYUP,   VK_MENU, lp_sys(scan_alt, 1, 1))
		
		time.sleep(0.3)
		
		target_vk   = VK_A if log_type == 'A' else VK_B
		scan_target = user32.MapVirtualKeyW(target_vk, 0)
		
		user32.PostMessageW(hwnd_main, WM_KEYDOWN, target_vk, lp_normal(scan_target, 0, 0))
		time.sleep(0.05)
		user32.PostMessageW(hwnd_main, WM_KEYUP,   target_vk, lp_normal(scan_target, 1, 1))

		time.sleep(0.5)
	
	finally:
		if attached:
			user32.AttachThreadInput(fg_thread, my_thread, False)
			
	return True
	
def set_text(hwnd, text):
	win32gui.SendMessage(hwnd, win32con.WM_SETTEXT, 0, text)

# -----------------------------------------------------------------------
# 書式文字列のプレースホルダを解決する
# -----------------------------------------------------------------------
def resolve_format(fmt, s_id, s_name, rig):
	"""書式文字列の {summit_id}, {summit_name}, {rig} を実際の値に置換して返す。"""
	result = fmt
	result = result.replace("{summit_id}",   s_id)
	result = result.replace("{summit_name}", s_name)
	result = result.replace("{rig}",         rig)
	return result.strip()

# -----------------------------------------------------------------------
# 備考欄を更新する（追記 or 上書き）
# -----------------------------------------------------------------------
def update_remarks(target_hwnd, new_info, overwrite):
	"""
	target_hwnd : 備考欄のウィンドウハンドル
	new_info    : 書き込む文字列（空文字の場合は何もしない）
	overwrite   : True=上書き / False=追記（重複チェックあり）
	"""
	if not new_info:
		return  # 書式が空 → 何もしない

	if overwrite:
		# 上書き
		win32gui.SendMessage(target_hwnd, win32con.WM_SETTEXT, 0, new_info)
	else:
		# 追記（重複チェックあり）
		length = win32gui.SendMessage(target_hwnd, win32con.WM_GETTEXTLENGTH, 0, 0)
		current_text = ""
		if length > 0:
			buf = ctypes.create_unicode_buffer(length + 1)
			win32gui.SendMessage(target_hwnd, win32con.WM_GETTEXT, length + 1, buf)
			current_text = buf.value.strip()

		if new_info not in current_text:
			final_text = f"{current_text} {new_info}".strip()
			win32gui.SendMessage(target_hwnd, win32con.WM_SETTEXT, 0, final_text)

# -----------------------------------------------------------------------
# メイン転送処理
# -----------------------------------------------------------------------
def send_to_hamlog(data):
	log_type = data.get('targetLog', 'A')
	
	if not ensure_input_window_open(log_type):
		return {"success": False, "message": "HAMLOGを起動してください"}
		
	target_suffix = "Ａ" if log_type == 'A' else "Ｂ"
	target_title  = f"ＬＯＧ-[{target_suffix}]"
	
	hwnd_input = 0
	def find_window_callback(h, lparam):
		nonlocal hwnd_input
		try:
			title = win32gui.GetWindowText(h)
			if target_title in title:
				hwnd_input = h
				return False
		except:
			pass
		return True

	try:
		win32gui.EnumWindows(find_window_callback, None)
	except Exception as e:
		if hwnd_input == 0:
			return {"success": False, "message": f"ウィンドウ検索中にエラーが発生しました: {str(e)}"}

	if not hwnd_input:
		return {"success": False, "message": f"HAMLOGのLOG-[{log_type}]が見つかりません"}

	if not win32gui.IsWindowVisible(hwnd_input):
		return {"success": False, "message": f"HAMLOGのLOG-[{log_type}]を表示状態にしてください"}

	child_hwnds = []
	win32gui.EnumChildWindows(hwnd_input, lambda h, l: l.append(h), child_hwnds)

	try:
		# MODEを入力（MODEを後から入力するとRSTが書き変わるため先に入力）
		set_text(child_hwnds[15], data.get('mode', 'CW'))

		# チェックボックス（CQ / 1 / 2）を転送
		# child_hwnds のインデックス: 要実機確認。暫定値: CQ=0, 1=1, 2=2
		def set_check(hwnd, checked):
			state = BST_CHECKED if checked else BST_UNCHECKED
			win32gui.SendMessage(hwnd, BM_SETCHECK, state, 0)

		set_check(child_hwnds[6], data.get('cbCQ', False))  # CQ
		set_check(child_hwnds[5], data.get('cb1',  False))  # 1
		set_check(child_hwnds[4], data.get('cb2',  False))  # 2
		
		# --- 山岳情報・リグ情報の解決 ---
		s_id   = data.get('summit', 'N/A')
		s_name = SUMMIT_DB.get(s_id, "")
		rig    = resolve_rig(data.get('freq', '0'))

		# --- Remarks1 の処理 ---
		fmt1       = data.get('remarks1Format',   '')
		overwrite1 = data.get('remarks1Overwrite', False)
		new_info1  = resolve_format(fmt1, s_id, s_name, rig)
		update_remarks(child_hwnds[9], new_info1, overwrite1)   # index 9 = Remarks1

		# --- Remarks2 の処理 ---
		fmt2       = data.get('remarks2Format',   '')
		overwrite2 = data.get('remarks2Overwrite', False)
		new_info2  = resolve_format(fmt2, s_id, s_name, rig)
		update_remarks(child_hwnds[8], new_info2, overwrite2)   # index 8 = Remarks2

		# FREQを入力
		try:
			f_val = float(data.get('freq', 0))
			set_text(child_hwnds[16], f"{f_val:.3f}")
		except:
			pass

		# RSTを入力
		set_text(child_hwnds[18], data.get('rstHis', '59'))  # His
		set_text(child_hwnds[17], data.get('rstMy',  '59'))  # My

		# コールサインを入力
		call_hwnd = child_hwnds[21]
		callsign  = data['call']
		set_text(call_hwnd, callsign)
		
		# コールサイン欄にフォーカスをセット
		win32gui.SendMessage(call_hwnd, win32con.WM_SETFOCUS, 0, 0)
		time.sleep(0.1)
		
		# Enterを送る（日付時刻の自動入力が動く）
		win32gui.PostMessage(call_hwnd, win32con.WM_KEYDOWN, win32con.VK_RETURN, 0)
		win32gui.PostMessage(call_hwnd, win32con.WM_KEYUP,   win32con.VK_RETURN, 0)
		time.sleep(0.1)

		# 日付を入力
		set_text(child_hwnds[20], data.get('dateStr', ''))

		# 時刻を入力
		set_text(child_hwnds[19], data.get('timeStr', ''))

		# 入力ウインドウを前面に出す
		try:
			win32gui.SetForegroundWindow(hwnd_input)
		except:
			pass
				
		return {"success": True, "message": f"LOG-[{log_type}]へ転送しました : {callsign} ({s_id})"}
		
	except Exception as e:
		return {"success": False, "message": str(e)}

@app.route('/post_log', methods=['POST'])
def post_log():
	# print(request.json)  # デバッグプリント文
	return jsonify(send_to_hamlog(request.json))

@app.route('/health', methods=['GET'])
def health_check():
	return {"status": "running", "message": "SOTAwatch to HAMLOG Bridge is active!"}

if __name__ == '__main__':
	app.run(port=5000)
