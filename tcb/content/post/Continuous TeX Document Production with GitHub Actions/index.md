---
title: "Continuous TeX Document Production with GitHub Actions"
date: 2019-07-21
tags:
  - devops
comment_id: 23424fec-33ac-4528-b8e2-a89829eaa17c
---

> **November 13, 2020**: An updated version of this blog is available on the [DZone website](https://dzone.com/articles/enable-continuous-delivery-of-your-resume-with-git-1).

Here is my little secret: My résumé lives in a private GitHub repository. I use [TeX](https://www.tug.org/), which is a popular typesetting language, to compose my résumé. TeX helps you separate document text from formatting. Major publishers whose content and design teams work independently of each other use TeX. The content team produces content, and the design team makes the content presentable. In a typical publishing workflow, the author marks the various parts of content such as headers, and footers with inbuilt, or custom TeX commands. Subsequently, the designer works on the typesetting of the document by adjusting the presentation aspect of the commands.

## TeX Primer

The pre-defined macros in TeX are quite limited. As an author, your manuscript might require fields such as footnotes and annotations, which are not available in TeX. [LaTeX](https://www.latex-project.org/) allows designers to extend the macros available to authors, which helps the authors focus on the content side of document processing.

As an author, after writing a document using LaTeX, you will require a LaTeX processor such as [LuaTex](http://www.luatex.org/), [XeTeX](http://tug.org/xetex/), and [pdfTeX](https://ctan.org/pkg/pdftex) to transform a TeX document to a PDF document. The various processors vary in their features, and therefore, you would need to find out the one which produces optimal quality documents for your TeX files. I use XeTeX because it fits all my requirements.

All the popular TeX programs are generally packaged together so you don't have to install each program individually. The [TeXLive](https://www.tug.org/texlive/) package includes binaries of the most popular TeX programs, macros, and fonts for all operating systems. Using the [LaTeX Workshop extension](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop), you can get the goodness of TeXLive in VSCode.

## GitHub Actions

In a typical development workflow, GitHub stores the application code, and the CI\CD pipelines execute in an external service that integrates with GitHub using webhooks and personal access tokens. GitHub notifies the service of events such as push, and merge through webhooks, which kicks off the corresponding workflows in the service. GitHub has now patched this disconnect between your code and the DevOps services with a new feature named [GitHub Actions](https://github.com/features/actions/).

Actions are units of code that can execute when certain GitHub events occur, such as a push to a branch. Since this service lives within GitHub, you need not use another DevOps service and connect it to your GitHub repository. There are hundreds of actions available in the [GitHub marketplace](https://github.com/marketplace?type=actions), and this list is growing every day. You can also create custom Actions (we will build one) which are just Docker containers with your repository mounted as a volume to it. Any discoverable Dockerfile, either in your repository or a public repository, can be used to build a function. To understand GH Actions in further detail, refer to the official documentation link above.

## DevOps For Résumé

Although it was just a fun project for me, DevOpsifying your résumé makes sense because:

1. You get out of the box document versioning support.
2. The latest version of the document is always available to you on your favorite site (GitHub).
3. If someone (recruiter\client\company) asks you whether the document they have is the latest one, you will only need to ask them one question (keep reading).
4. If you get to talk about it in an interview, you will stand out! :smile:

I understand that there are alternatives such as CMS, saving content to cloud drives, and so on. However, I prefer this approach and any real developer who firmly believes in the [NIH philosophy](https://en.wikipedia.org/wiki/Not_invented_here) will too :wink: (an \* and some fine print here).

## Code

The source code for this sample is available on my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/ContinuousLaTeX" >}}

In GitHub, the **Actions** tab that presents that workflow GUI is only visible to the owners and contributors of the repository. Therefore, you must clone the repository to view it. I recommend that you use the source code as a guide while building your application with me.

## Creating Your Custom Action

Based on when you are reading this article, you might have to enrol in the [beta program for accessing GitHub Actions](https://github.com/features/actions). Unfortunately, you will have to wait for GitHub to approve your request before you can start working with Actions.

If you have access to the feature, create a new repository in your account, and you will find a new tab named **Actions** in your repository.

{{< img src="1.png" alt="Actions Tab in GitHub" >}}

Under the tab, you will find a button labelled **Create a new workflow**. A workflow is a pipeline that comprises a sequence of Actions. Click on this button now to create a new workflow.

{{< img src="2.png" alt="Create New GitHub Actions Workflow.png" >}}

On clicking the button, you will land on the workflow designer form. The first thing that you will notice is that upon acceptance, GitHub will create a folder named **.github** in which it will place your workflow in a file named **main.workflow**. At this stage, you can rename the file to whatever you like. In the form, you can either use the designer to drag and drop connections to Actions or use the text editor to build the same with code. You won't lose the **Visual Designer** in either case, and you can switch between code and designer view at any time. Switch to the **Edit New File** tab so we can define our workflow.

{{< img src="3.png" alt="Edit Github Actions Workflow" >}}

In the editor that follows, enter the following workflow definition.

```plaintext
workflow "Generate Document" {
  on = "push"
  resolves = ["Save To GH Pages"]
}

action "Tex To PDF" {
  uses = "./"
  env = {
    OUT_DIR = "public"
  }
}

action "Save To GH Pages" {
  uses = "maxheld83/ghpages@v0.2.1"
  needs = ["Tex To PDF"]
  env = {
    BUILD_DIR = "public/"
  }
  secrets = ["GH_PAT"]
}
```

In the previous listing, we defined a basic workflow comprising just three elements. We named the workflow **Generate Document**, which activates every time a developer pushes code to a branch. There are several other events from which your workflow can kick-off. You can read about all the various events that the workflow supports [here](https://developer.github.com/actions/managing-workflows/workflow-configuration-options/). Upon initiation, this workflow invokes all the Actions you specify in the `resolves` array. Here, the workflow will invoke the **Save To GH Pages** Action.

The **Save To GH Pages** is an Action published on the marketplace which is available at: [https://github.com/maxheld83/ghpages](https://github.com/maxheld83/ghpages). This Action is designed to take all the resources (in our case documents) present in the specified folder and publish it on the **gh-pages** branch of the repository. Typically, this task is used for publishing a website on [GitHub Pages](https://pages.github.com/), but we are purposing it publish our documents.

An interesting detail to note here is that this task only points to a public repository. Besides GitHub repositories, the `uses` property also supports links to files hosted on the Docker Hub. You can specify the secrets, environment variables, and arguments that your task needs in the Action block. For example, the **Save To GH Pages** Action requires an environment variable named **BUILD_DIR**, and a secret named **GH_PAT**. The following is the structure of a typical Action.

```plaintext
action "Name" {
  uses = "points to public or local repo or a docker instruction"
  needs = "array of actions this action depends on"
  args = "array or string of arguments"
  secrets = ["SECRET_NAME"]
  env = {
    ENV_VARIABLE_NAME = "ENV_VAR_NAME"
  }
}
```

You can read more about how to generate a GitHub Personal Access Token and why the task requires it on the GitHub repository of the Action. You must have noticed that this Action depends on another action named **Tex To PDF** which must execute before this one.

We will add the artifacts for the **Tex To PDF** Action at the root of the repository, and therefore the value of the `uses` argument is the relative path to the root directory. The Action will read the input from an environment variable named **OUT_DIR**. The value of this variable will specify the directory where the documents generated from the Action should be stored. Logically, this directory should be the same as the one from which the Action **Save To GH Pages** reads.

Now switch to the designer view of the workflow and enter the value of the secret. In the designer view, you can also change the values of the arguments of each task by clicking on the **Edit** link. The final version of the workflow should look like the following.

{{< img src="4.png" alt="Completed GitHub Actions Workflow" >}}

Push the code in its current state to the master branch. The workflow will execute but fail as we have not defined the custom Action yet.

## Custom GitHub Action

In VSCode, clone the repository that you just created and add a Dockerfile to the root of the repository with code from the following listing.

```docker
FROM debian:latest

LABEL "maintainer"="Rahul Rai <rahul@rahul-rai.com>"
LABEL "repository"="https://github.com/rahulrai-in/ContinuousLaTeX"
LABEL "homepage"="https://github.com/rahulrai-in/ContinuousLaTeX"

LABEL "com.github.actions.name"="Convert to PDF"
LABEL "com.github.actions.description"="Convert documents to PDF with xelatex."
LABEL "com.github.actions.icon"="code"
LABEL "com.github.actions.color"="blue"

ENV DEBIAN_FRONTEND noninteractive

# Install all TeX and LaTeX dependencies
RUN apt-get update && \
    apt-get install --yes --no-install-recommends \
    texlive-fonts-recommended \
    texlive-generic-recommended \
    texlive-lang-english \
    texlive-xetex && \
    apt-get autoclean && apt-get --purge --yes autoremove && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ADD entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

As previously discussed, an Action is nothing but a Docker container that performs an operation and exits. The runtime mounts the application artifacts in the default working directory of the container. Any new artifacts that an Action creates and saves in the `WORKDIR` will be available to the subsequent Actions. In this Action, we will convert TeX files to PDF and move them to the directory that you specified in the environment variable named **OUT_DIR** in the workflow.

In the previous listing, we used some `LABEL` instructions that are used by the GitHub Action runtime to generate the logo and author information for the Action. Next, in the `RUN` instruction, we instructed the Docker daemon to install the TeXLive package in the container. The final command of this `RUN` instruction clears temporary files and lists from the container.

Next, we copied a shell script named `entrypoint` to the container and granted execution rights to it. Finally, we configured the container to run as an executable using the shell script as the argument. Let's create the shell script now.

## The Shell Script

Create a script named **entrypoint** in the root directory of the repository. We will now start adding code to this file. I like using the bash shell, so I specify shebang bash as the first statement in the script. Next, add the instruction `set -e` to the script which will make sure that if any command in the script throws an error, the rest of the file will not keep executing.

```shell
#!/bin/bash

set -e
```

Next, we will create an output directory using the value of the **OUT_DIR** environment variable that we specified in the workflow previously. Setting the `--parent` flag of the `mkdir` command ensures that the command will not raise an error if the directory already exists.

```shell
echo "Creating output directory $OUT_DIR..."
mkdir --parent $OUT_DIR
```

Next, our script will walk through all the **.tex** files in the root directory and perform two operations.

1. Replace the placeholder text **verSubstitution** with the first seven characters of the SHA of the code commit using the `sed` command. The `GITHUB_SHA` is available to all Actions by default.
2. Convert the document to pdf using **xelatex**. The xelatex processor is the XeTeX typesetting engine for LaTeX. We installed XeTeX as part of TeX Live package in our Dockerfile.

```shell
for fileName in *.tex; do
    [ -f "$fileName" ] || break

    echo "Substituting version number ${GITHUB_SHA::7} in file $fileName..."
    sed -i -e "s/verSubstitution/${GITHUB_SHA::7}/" $fileName

    echo "Converting file $fileName to pdf..."
    xelatex $fileName
done
```

Finally, the script will copy all the PDF files to the specified directory from where the next Action will pick them up.

```shell
cp *.pdf $OUT_DIR 2>/dev/null || :
```

The `cp` instruction can fail if it does not detect PDF files. Therefore, we made it direct stderr to a null device. This command will always report success. Probably not the best implementation but it works.

The following is the entire code of this script.

```shell
#!/bin/bash

set -e

echo "Creating output directory $OUT_DIR..."
mkdir --parent $OUT_DIR

for fileName in *.tex; do
    [ -f "$fileName" ] || break

    echo "Substituting version number ${GITHUB_SHA::7} in file $fileName..."
    sed -i -e "s/verSubstitution/${GITHUB_SHA::7}/" $fileName

    echo "Converting file $fileName to pdf..."
    xelatex $fileName
done

cp *.pdf $OUT_DIR 2>/dev/null || :
```

Our Action is now ready to undergo testing. So let's do that next.

## Test The Workflow

Add a simple TeX file named **sample.tex** to the root directory of the repository and add the following content to it.

```tex
\documentclass[12pt]{article}
\title{Hello World}
\author{Rahul}
\begin{document}
\maketitle
\section{Section}
This is a section.
\subsection{Subsection}
This is some sample text. The commit that generated this document is: verSubstitution
\end{document}
```

Commit and push the code that you have in your system to the **master** branch and navigate to the **Actions** tab of your repository. At this time, you should be able to catch your workflow spinning off the Actions.

{{< img src="5.gif" alt="GitHub Action Workflow" >}}

Notice the SHA of the commit in the previous screen capture- _ecfe1d6_. Navigate to the **gh-pages** branch of the [repository here](https://github.com/rahulrai-in/ContinuousLaTeX/blob/gh-pages/sample.pdf). The following screenshot of the generated document shows the SHA value written to the document at the time of this writing.

{{< img src="6.png" alt="GitHub Actions Generated Document" >}}

The following is how the version information looks like in the footer of my résumé. It uses the format- **v {month}.{year}.{sha}**.

{{< img src="7.png" alt="Rahul Résumé Footer" >}}

If anyone wants to verify whether the copy they have is the latest one, I ask them the version information that they see in the footer. Just the month and year are sufficient for most of the time, but with the commit SHA, I can track the exact commit that generated the copy.

## Conclusion

I love the DevOps model that GitHub adopted with Actions. Unlike Azure DevOps, with GitHub Actions, you have the flexibility of the designer and the complete control of the workflow through code. Also, there is no need to host the Action images as the runtime builds them on the fly. This feature also ensures that you need not connect your GitHub repository to systems outside the GitHub ecosystem. Co-locating the code with DevOps (and much more) is now a fascinating feature of GitHub.

{{< subscribe >}}
