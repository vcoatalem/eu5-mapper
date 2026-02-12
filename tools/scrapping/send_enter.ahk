#Requires AutoHotkey v2.0
; Optional: pass window title as first arg to activate it
if (A_Args.Length >= 1) {
    title := A_Args[1]
    try {
        WinActivate title
        WinWaitActive title, , 2
    }
}

SendInput "{Enter}"
