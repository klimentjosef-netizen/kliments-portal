' Spusti agenta bez okna (Planovac uloh by jinak kazdych 15 minut ukazal konzoli)
Set sh = CreateObject("WScript.Shell")
cesta = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\kliments-agent\agent.ps1"
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & cesta & """", 0, False
