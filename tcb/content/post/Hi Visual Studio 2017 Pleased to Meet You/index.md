---
title: "Hi, Visual Studio 2017! Pleased to Meet You!"
date: 2017-03-26
tags:
  - tools & gadgets
  - programming
comment_id: 84e915d8-2fdf-46e8-b878-5b958dc1747c
---

Visual Studio 2017 is currently the best IDE that is in-line with the Microsoft's strategy of embracing non Microsoft platforms and operating systems. I am a web developer, therefore, following is my outline of the most compelling features of Visual Studio 2017.

## Setup Experience

Visual Studio no longer asks you to select options from a long list of checkboxes. It presents a more easy to comprehend list of workloads that are segregated by categories. You can choose the packages that are most suited to your role.

{{< img src="1.png" alt="Installation Experience" >}}

However, the long list of checkboxes is still available in Individual Components tab. The time required for installation obviously increases with the number of components that you select, but you would find that the installation takes significantly less time than previous Visual Studio installations. Once installed, when launching Visual Studio, you will immediately recognize better performance and faster startup than Visual Studio 2015.

## Start Page

More real estate has been offered to common shortcuts and tools. News and updates have been moved to a collapsible panel. VS 17 show the list of repositories you have recently cloned from Visual Studio Team Services and GitHub, which are represented with a folder icon. This list is synced across machines if you log into Visual Studio with a Microsoft Account, which means that you will see this list on any of your installations of Visual Studio 2017.
{{< img src="2.png" alt="New Start Screen" >}}

## Code Editor

The code editor now looks like it married ReSharper. ReSharper would need to seriously up its game to be a viable plugin again. There are several changes in IntelliSense, code navigation, and integrated Roslyn code analysis. IntelliSense has better performance and just like ReSharper, allows for type filtering, which makes it easier to use the objects and members you need.

{{< img src="3.png" alt="Intellisense Suggestions" >}}

For code navigation, Find All References now presents grouped lists of objects with syntax colorization.

{{< img src="4.png" alt="Find References" >}}

**Go To** is an improved replacement of Navigate To, with type filtering and quick search among large codebases.

{{< img src="5.png" alt="Go To with Type Support" >}}

Notice the character **t** in the editor? The **t** character preceding any words in the search box will filter the list by type, while the **#** character will filter by method. Other supported characters are **f**(files), **m** (members), and **:** (line numbers).

Inside the editor, the structure guide lines will help you understand to which code block a snippet belongs. With live code analysis powered by Roslyn, new refactorings are available to both C# and Visual Basic. Roslyn can point you to code style issues as you type and you can control styles and naming rules with the new code style feature.

{{< img src="6.png" alt="Code Styles" >}}

## Solution and Project Modelling

Visual Studio 2017 has introduced a new feature called **Lightweight Solution Load**. This feature optimizes the process of loading very large solutions, providing better responsiveness and performance. Lightweight Solution Load delays loading some projects until you actually need them.

{{< img src="7.png" alt="Lightweight Solution Load" >}}

Visual Studio 2017 also supports working with folders. This means that you can open folders on disk containing multiple code and asset files and Visual Studio will organize them in the best way possible in that environment. This makes Visual Studio independent of any proprietary project system (except for solutions). It loads all the code files in a folder as a loose assortment, providing a structured view by organizing files and subfolders in a root folder for easy navigation through Solution Explorer.

Visual Studio 2017 also supports a broader set of programming languages, even with no workloads installed, and the core editor can work with folders containing code files, providing not only a structured, organized representation, but also offering basic features such as syntax colorization and code completion, as well as evolved features like IntelliSense, debugging, and code snippets. In order to support these and other new or updated features, the architecture of Visual Studio 2017 is very different from previous editions, and this affects extensibility.

## Extensions

**Roaming Extension Manager** tool allows for synchronizing installed extensions on every Visual Studio installation that you have on different machines. The Roaming Extension Manager is included in the Extensions and Updates dialog that you enable through Tools > Extensions and Updates.

{{< img src="8.png" alt="Roaming Extension Manager" >}}

Visual Studio 2017 also introduces a new way of installing, updating, and uninstalling extensions. In fact, the IDE now allows you to schedule multiple extensions for installation, update, or removal. For extension authors, Visual Studio 2017 introduces version 3.0 of the .vsix file format, which requires specifying extension prerequisites (workloads or components), and allows controlling the extension behavior by creating native images of the assemblies and by controlling the destination folder.

## Debugging

Using the new **Run to Click** feature, you no longer need temporary breakpoints to run code to a specific point while in break mode.

{{< img src="9.png" alt="Run to Click" >}}

The Diagnostic Tools window now provides a Summary tab with shortcuts that allow you to keep your focus on the IDE—it provides this along with an updated version of the Exception Helper that shows exception details in a simplified and focused manner.

{{< img src="10.png" alt="New Exception Helper" >}}

And with Live Unit Testing, you can write code and run unit tests in the background, getting test results and code coverage directly in the code editor, all live as you type.

{{< img src="11.gif" alt="Live Unit Testing" >}}

## Cloud Development

Visual Studio 2017 introduces important tools for cross-platform development and the cloud. Visual Studio now has tooling support for .NET Core, the modular, cross-platform, open source runtime that developers can use to build console and web apps for Linux, Mac, and Windows using C#. With the integrated tools, you can build .NET Core solutions the same way as with classic .NET development. You will straight away notice that now even .NET Core projects use the .csproj extension, albeit in a much cleaner form and with intellisense support. This change was made to support MSBuild support for .NET Core.

Another fundamental addition is tools for Docker, which has now become a de facto standard in deploying applications to containers. Docker containers can be hosted on Linux in Azure, and Visual Studio 2017 does the entire job of packaging and deploying a container for you.

{{< img src="12.png" alt="Docker Support" >}}

In conjunction with its aim to be the development environment for any developer on any platform, Visual Studio 2017 has full support for Node.js, including advanced editing, debugging, and testing features.

Finally, Visual Studio 2017 supports all the most recent Azure services, including Data Lake and Service Fabric, and it provides an option for interacting with more services from within the IDE through the Cloud Explorer tool window. This avoids the need for opening the Azure portal every time.

{{< img src="13.png" alt="Cloud Explorer" >}}

Of course, this is not an exhaustive list and I still keep bumping into new features every other day. I encourage you to adopt Visual Studio 2017, if you have not already done so. Let me know about other cool stuff that you have discovered in the IDE in the comments section.

{{< subscribe >}}
