---
title: "Stop Wasting Your Time Use Auto Hot Key and Nimble Text"
date: 2016-08-04
tags:
  - tools & gadgets
comment_id: 25957429-a26a-4e2e-aaeb-af1de84c707b
---

My long hiatus is over. I have completed my move to [Sydney, AU](http://www.sydney.com.au/) and I have started working with [Readify](http://readify.net/) as a Consultant. Sydney is a beautiful city and is endowed with attractions that I am yet to explore. Time is precious and no one wants to do mundane stuff. Using productivity tools, we can get mundane stuff done fast so that we can spend more time doing finer things such as watching more cat videos. Earlier, whenever I used to come across any productivity tool, I used to ask myself that whether investing my time to configure the tool or write scripts for it is worth the seconds that it saves daily? Definitely yes, apart from saving time daily, productivity tools free your mind to work on other stuff. If you often get stuck in the same dilemma, here is a picture for us to learn from.

{{< img src="1.jpg" alt="Too Busy To Innovate" >}}

Following are two tools that I use to shave a few seconds off my workday: [Auto Hot Key](https://autohotkey.com/) (daily) and [Nimble Text](http://nimbletext.com/) (not really daily).

## Auto Hot Key (AHK)

[Auto Hot Key](https://autohotkey.com/) (AHK) is an awesome tool that I discovered recently. Using AHK, you can automate keystrokes and mouse movements, which makes it open to infinite possibilities. Use a program too often? Assign a shortcut key to it. Use a key combination too often? Assign a single keystroke to it. People have built tons of utilities using AHK many of which you would love (more on this below). AHK scripts are crazy easy to code (even for non programmers), are open source and run on windows. AHK is not a system hog. Even though I built and regularly use an AHK script with a recursive loop, it hardly puts any burden on my CPU. So, you can turn on several scripts at startup without worrying about them slowing down your computer. Following are a few of the scripts that launch themselves at startup of my computer. I don't know who created them, but I would love to (please use the comments section so that I can thank you).

### 1. Turn off the CAPS LOCK key

I think that placing the caps lock key right next to heavily used keys is an example of bad design. I don't remember the last time I used this key (maybe I should start FLAMING PEOPLE MORE). It gets pressed accidentally on a regular basis and requires you to undo text or normalize the casing wasting precious time. I discovered a script that tackles this menace beautifully. Use the script below to make CAPS LOCK key stay off unless you double tap it.

```shell
CapsLock::
    if A_PriorHotkey = CapsLock
    {
        if A_TimeSincePriorHotkey < 500
        {
            SetCapsLockState, on
            return
        }
    }

    SetCapsLockState, on
    keywait, CapsLock
    SetCapsLockState, OFF
    return
```

### 2. Disable the trackpad while you are typing

I am not a fan of laptop keyboards, they are small and the trackpad eats into the space meant for my wrists and thumb. Reclaim the lost keyboard space with this script which keeps the trackpad disabled while you type.

```shell
#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.

;user configuration
DisableTime := 500 ;in milliseconds
BlockMouseMove := True
BlockLeftClick := True
BlockMiddleClick := True
BlockRightClick := True
AllowShift := True
AllowCtrl := True
AllowAlt := True
AllowWin :=True

;keyboard hook code credit: http://www.autohotkey.com/forum/post-127490.html#127490
#Persistent
OnExit, Unhook

;initialize
hHookKeybd := SetWindowsHookEx(WH_KEYBOARD_LL   := 13, RegisterCallback("Keyboard", "Fast"))
Hotkey, LButton, DoNothing, Off
Hotkey, MButton, DoNothing, Off
Hotkey, RButton, DoNothing, Off
Return

DisableTrackpad:
ShiftActive := AllowShift && GetKeyState("Shift")
CtrlActive := AllowCtrl && GetKeyState("Ctrl")
AltActive := AllowAlt && GetKeyState("Alt")
LWinActive := AllowWin && GetKeyState("LWin")
RWinActive := AllowWin && GetKeyState("RWin")
if (!ShiftActive && !CtrlActive && !AltActive && !LWinActive && !RWinActive)
{
   if (BlockMouseMove)
      BlockInput, MouseMove
   if (BlockLeftClick)
      Hotkey, LButton, DoNothing, On
   if (BlockMiddleClick)
      Hotkey, MButton, DoNothing, On
   if (BlockLeftClick)
      Hotkey, RButton, DoNothing, On
}
Return

ReenableTrackpad:
if (BlockMouseMove)
   BlockInput, MouseMoveOff
if (BlockLeftClick)
   Hotkey, LButton, Off
if (BlockMiddleClick)
   Hotkey, MButton, Off
if (BlockLeftClick)
   Hotkey, RButton, Off
Return

DoNothing:
Return

Unhook:
UnhookWindowsHookEx(hHookKeybd)
ExitApp

Keyboard(nCode, wParam, lParam)
{
   Critical
   If !nCode
   {
      Gosub, DisableTrackpad
      SetTimer, ReenableTrackpad, %DisableTime%
   }
   Return CallNextHookEx(nCode, wParam, lParam)
}

SetWindowsHookEx(idHook, pfn)
{
   Return DllCall("SetWindowsHookEx", "int", idHook, "Uint", pfn, "Uint", DllCall("GetModuleHandle", "Uint", 0), "Uint", 0)
}

UnhookWindowsHookEx(hHook)
{
   Return DllCall("UnhookWindowsHookEx", "Uint", hHook)
}

CallNextHookEx(nCode, wParam, lParam, hHook = 0)
{
   Return DllCall("CallNextHookEx", "Uint", hHook, "int", nCode, "Uint", wParam, "Uint", lParam)
}
```

### 3. Say Hello on Skype for Business (FKA Lync)

I developed this mini hack myself. To sound courteous, I start each conversation on Skype with a "Hi, [First Name]". However, since I work with multicultural teams (good thing), sometimes the first names can be a bit too long or complex for me to write without looking up the name twice in the contacts box (bad thing) and people would immediately notice if I wreck their first names. I let AHK handle the formalities for me. This script reads text from the title bar of chat window, formats it and writes the output to chat text box.

```shell
#Persistent
SetTimer, SayHi, 500
return

SayHi:
IfWinActive ahk_class LyncTabFrameHostWindowClass
{
    WinGetTitle, Title
    StringSplit NameArray, Title, %A_Space%
    Send Hi, %NameArray1%.%A_Space%
    winwaitclose
    return
}
```

Those were some of the most common scripts that I use daily. However, there are tons of scripts available in [library](https://github.com/ahkscript/awesome-AutoHotkey) of ahkscript community, many of which may be useful to you. Even more scripts are available at the official [AHK website](https://autohotkey.com/docs/scripts/). Of course, you can build your own and make your life easier. Let me know your favorite ones in the comments section.

## Nimble Text

I am a developer and sometimes I get stuck in situations where I have to write repetitive code such as 20 similar SQL statements. On an average day, I have to combine and manipulate data and transform it into a particular format. [Nimble Text](http://nimbletext.com/) makes it super easy to carry out mundane formatting tasks without requiring me to be very smart! Following is a screenshot of how you can generate SQL statements from a CSV and this is just one of the features that this tool has to offer.

{{< img src="2.png" alt="NimbleText" >}}

I hope you found the tools useful. Do post your comments if you want me to write about other tools that I use. I will try posting more often today onwards so I will see you again very soon. Cheers!

{{< subscribe >}}
