Set shell = CreateObject("WScript.Shell")
' 自分がいるフォルダのパスを取得
currentDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' そのフォルダにあるバッチファイルを非表示(0)で実行
shell.Run "cmd /c """ & currentDir & "\start_hamlog_bridge.bat""", 0, False