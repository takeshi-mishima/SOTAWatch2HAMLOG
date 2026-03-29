@echo off
:: カレントディレクトリをこのバッチファイルがある場所に移動
cd /d "%~dp0"

:: 起動中メッセージ
echo SOTA Watch to HAMLOG Bridge 起動中...

:: pythonw.exe を使うと黒い画面を出さずに起動できます（Pythonインストール時にパスが通っている前提）
:: パスが不安な場合は通常の python hamlog_bridge.py でもOK
start /b pythonw hamlog_bridge.py
