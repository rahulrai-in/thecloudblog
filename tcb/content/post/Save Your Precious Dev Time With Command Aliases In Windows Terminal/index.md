---
title: "Save Your Precious Dev Time With Command Aliases In Windows"
date: 2019-09-23
tags:
  - automation
  - tools-gadgets
comment_id: d9fa6499-e59a-4e98-8467-8623cff98bd4
---

Developers are always looking for ways to optimize their productivity. The latest addition that I did to improve mine was to create aliases for the most common commands that I use every day. I have entirely pivoted to using the new [Windows Terminal](https://github.com/Microsoft/Terminal) for my day-to-day command line activities.

Windows Terminal is a modern, open-source application that aggregates multiple terminals and shells such as command prompt, PowerShell, and WSL and adds features such tab support, rich text, configuration, and visual themes to them. In this article, I will show you how you can improve your development workflow by reducing the number of keystrokes you punch in your terminal daily.

As developers, we often need to type the same commands repeatedly, which reduces productivity and creates distractions. To save some time, you can create aliases for some of the most common commands. The alias command is a text interface for your terminal or shell commands that map to lengthy and\or complex commands under the hood.

The process to create aliases is slightly different for Linux\MacOS\Windows WSL users from Windows users. For the Linux family of OS, use the alias command similar to the following to create aliases.

```bash
alias d="docker"
```

After executing the previous command, you can use the character “d” instead of the command “docker” in the same terminal session. You can create permanent aliases in Linux that work across sessions by persisting the aliases in shell configuration files such as ~/.bashrc for bash, and ~/.zshrc for ZSH.

In Windows, you can create aliases using the DOS command: doskey, which is useful for creating macros. You can read more about the doskey command [here](https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/doskey). Similar to the alias command, the doskey command stays in effect only during the session.

There is a way to put doskey instructions in a batch or command file and later use the file to initialize any terminal session by making a small change to the Windows registry. However, the process is prone to errors and has severe side effects. You can read about the drawbacks and a horror story of modifying the registry to execute an initialization script [here](https://devblogs.microsoft.com/oldnewthing/20071121-00/?p=24433).

Let’s discuss a safe way to ensure that command prompt executes the aliases script only for terminal sessions initiated by the user. This approach is not limited to aliases, and you can add other commands to the initialisation script too. Such commands may include the ones you want to execute before launching a terminal, such as changing to a particular directory and so on.

Create a command file named init.cmd (the name is irrelevant) and add the following commands to it.

```cmd
@echo off
doskey k=kubectl $*
doskey d=docker $*
doskey gp=git pull
doskey gc=git commit -a -m "$*"
```

In the previous listing, we assigned aliases to some common commands that we use regularly. The command argument \$\* is one of the special characters that substitutes itself with the argument that you pass to the command. There are several others, and you can read about them [here](https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/doskey).

Next, place the file at a permanent location and now fire your Windows Terminal instance. Bring up the Windows Terminal settings by clicking on the gear icon in the menu or by using the macro key combination “Ctrl + ,” in the terminal window. Windows Terminal saves and reads settings from a JSON document named profiles.json. You can modify the many configuration options in this file to make the overall application, and each shell, act/look like you want. For now, search for the following setting in the JSON document.

```cmd
"commandline": "cmd.exe"
```

The setting shown previously instructs the Windows Terminal process to launch the command interpreter, cmd.exe. Update this command to instruct the command interpreter to execute your command file on initialization and then continue. Remember to substitute the file path below with the path to the **init.cmd** file that you created previously.

```cmd
"commandline": "cmd.exe /K C:\\InitCmd\\init.cmd"
```

The /K command parameter instructs the interpreter to carry out the command specified in the argument and continue execution. There are other parameters for the interpreter that you can read more about here. Now that your settings are in place, restart the terminal and enjoy the goodness of simpler commands. The following screenshot presents the output of some commands I executed on my terminal.

{{< img src="1.png" alt="Command Aliases Output" >}}

{{< subscribe >}}
