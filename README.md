# SOTAWatch to HAMLOG

SOTAwatch3 の Log Chase ウインドウのデータを、Turbo HAMLOG の入力ウインドウに転送するブラウザ拡張（Chrome / Edge）です。

日付・時刻・周波数・モード・コールサイン・サミット情報・RSTレポートを一括で転送できます。

![Log Chase画面](SOTAWatch2Hamlog/LogChase%E7%94%BB%E9%9D%A2.png)

## 構成

| 要素 | 内容 |
|---|---|
| ブラウザ拡張 (`content.js` ほか) | Log Chase ウインドウに「HAMLOG転送」ボタンを追加 |
| `hamlog_bridge.py` | 拡張から受け取ったデータを Turbo HAMLOG に入力するローカルブリッジ（Flask） |

## 動作環境

- Windows、Turbo HAMLOG
- Chrome または Edge
- Python 3 と `pip install flask flask-cors pywin32`

## インストール

[Releases](../../releases) から最新の zip（`sotawatch2hamlog_V*.zip`）をダウンロードし、任意のフォルダに展開します。
導入手順（スタートアップ登録、拡張機能の読み込み、初期設定）は同梱の
[readme.txt](SOTAWatch2Hamlog/readme.txt) を参照してください。

### オプション

- **山名の転送**: JA1CTC局のホームページから国土地理院地図用 GeoJSON 形式の SOTA 日本山名リスト（例: `geojson_v32.zip`）をダウンロードし、ZIP のまま `geojson` フォルダに置きます。このデータは本リポジトリに含まれません。
- **リグ・アンテナ情報**: `rigant.txt` をバンドごとに編集します（Shift-JIS で保存）。

## 使い方

1. Turbo HAMLOG を起動する
2. SOTAwatch3 にログインし、Log Chase ウインドウを開く
3. 「Submit」の**前に**「HAMLOG転送」ボタンをクリックする

## 変更履歴

各版の変更点は [readme.txt](SOTAWatch2Hamlog/readme.txt) の「変更履歴」と、[タグ](../../tags)を参照してください。

## ライセンス

[MIT License](LICENSE) © 2026 Takeshi Mishima (JK1VUZ)
