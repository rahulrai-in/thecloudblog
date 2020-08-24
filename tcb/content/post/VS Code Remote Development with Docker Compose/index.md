---
title: "VS Code Remote Development with Docker Compose: Developing services in Standalone and Integrated Modes"
date: 2020-05-26
tags:
  - programming
  - docker
comment_id: a9d0603b-7517-4c78-a293-f920ebd428f1
slug: vs-code-remote-development-with-docker-compose-developing-services-in-standalone-and-integrated-modes
---

[VS Code remote development](https://code.visualstudio.com/docs/remote/remote-overview) is a brilliant feature from the VS Code team. Using the extensions available in the [VS Code remote extension pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack), you can develop your applications in an external development environment viz. a remote server (through SSH), containers, and WSL. The premise of the three modes of development is the same. The application code is stored either on your local system (on container and WSL through volume mount) or remote server (through SSH), and the local instance of the VS Code attaches itself to the external system through an exposed port (container and WSL), or SSH tunnel (remote server). For a developer, this experience is seamless and requires a one-off setup. VS Code is responsible for the heavy lifting of the entire experience of remote development.

Let's discuss some of the everyday use cases of remote development. The primary use of remote development is to develop and test Linux compatible apps with WSL on Windows. Remote development allows you to use a remote machine with better specs for development (e.g., code and debug on your desktop from your tablet), which is another use of the feature. However, the most beneficial use case for most developers working in a team environment is that they now can specify the development environment (including VS Code extensions) in the form of Dockerfiles and container specifications, and add them to the source control. With the configurations in place, anyone can recreate the development environment and be productive immediately.

The VS Code remote extension has [several container definitions](https://github.com/microsoft/vscode-dev-containers) available to help you get started. The samples in the repository cover most of the standard development scenarios, such as developing a standalone application using popular languages such as Typescript. Some container definitions in the repository, such as [this one](https://github.com/microsoft/vscode-dev-containers/tree/master/containers/javascript-node-mongo) also illustrate using Docker Compose to develop applications linked to a database running in a container.

I will demonstrate how you can use some of the [advanced capabilities](https://code.visualstudio.com/docs/remote/containers-advanced) of the VS Code remote development feature and Docker compose to develop an application that is dependent on a service. Although I would only cover the case of two applications, one of which is dependent on the other for HTTP request/response operation, you can extend this pattern to link multiple microservices irrespective of the type of communication dependency involved.

An aspect of remote development that I wish to highlight is how to develop individual microservices of an application in standalone and integrated modes. In the standalone mode of development, you develop and debug a single microservice without spinning up the rest of the services of the application. Most of the time, developers build their services and applications in standalone mode using predefined contracts of dependant services.

The integrated mode of development of microservices is mostly used to iron out integration issues and track the lifecycle of requests across services. In this mode, developers spawn all the services of an application so that they can debug the requests entering and leaving the application end to end.

To understand the two development modes in detail, we will use two connected applications and develop them in standalone mode and integrated mode. Since this is an advanced topic, I will assume that you understand the concepts of developing [an application with a single container](https://code.visualstudio.com/docs/remote/containers) and [multiple applications with Docker Compose](https://code.visualstudio.com/docs/remote/containers-advanced#_connecting-to-multiple-containers-at-once). I will also assume that you understand the roles of _.devcontainer.json_ and Docker Compose specification files in remote development. Let's now discuss the sample application in detail.

## Sample Application

The Ping-Pong application consists of two services as follows.

1. Ping: It is a .NET core application that writes the text _Ping_ to the console and makes an HTTP GET request to the Pong service. When it receives the response from the Pong service, it prints the response to the console.
2. Pong: It is an HTTP API written in Go with a single HTTP GET endpoint `/pong`. When the pong endpoint receives a request, it waits for a random interval before sending the text _Pong_ as the response.

The following is a high-level design diagram of the application.

{{< img src="1.png" alt="Ping-Pong Application High-Level Design" >}}

Let's now prepare your system to work through the demo.

## Prerequisites

You must have the following software installed on your system to follow along with this guide.

1. [VS Code](https://code.visualstudio.com/docs/setup/setup-overview)
2. [Docker Desktop for Windows or Mac](https://www.docker.com/products/docker-desktop)
3. [VS Code remote development extension pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack)

## Source Code

The source code of the Ping-Pong application is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/vsc-remote-docker-compose">}}

Please download the source code to your system and open the workspace, _Ping-Pong.codeworkspace_, in VS Code.

## The Applications

Let's discuss the layout of the Ping-Pong application. You can see that I have organized the application as a monorepo. The source code of the Ping application is present in the folder named Ping. The source code of the Pong service is available in the folder named Pong. Feel free to familiarize yourself with the source code of the applications, which is very easy to understand.

{{< img src="2.png" alt="Ping-Pong Application" >}}

In the previous image you can see that both the Ping application (1) and Pong application (2) contain a _.devcontainer_ folder. The remote development extension searches for the _.devcontainer_ folder at the root of the workspace, where it tries to locate the _devcontainer.json_ file. The _devcontainer.json_ file contains instructions for the extension to create a development container, the extensions, and tools to enable in VS Code to facilitate working with the codebase. The Dockerfiles present in the _.devcontainer_ folders prepare the containers for the applications. They also contain instructions to install the tools necessary for debugging the application.

Finally, in the workspace, you will find three Docker Compose files (3). Docker Compose is used for setting up dependency and network between containers. The following are the roles of the Docker Compose files in the application.

1. docker-compose-ping.yml: Contains configurations necessary for the Ping application only. This specification is responsible for setting up the environment for the execution of the Ping application only.
2. docker-compose-pong.yml: Contains the configuration necessary for the Pong application. This specification helps prepare the environment for the Pong application only.
3. docker-compose.yml: This file is responsible for establishing dependency between the Ping and the Pong applications. This file also overrides the applications' settings so that they are configured to work in integrated mode.

Docker Compose can merge multiple files to form a complete configuration. You can read more about this concept at the [Docker docs website](https://docs.docker.com/compose/extends/#multiple-compose-files). The multiple compose files feature is the secret sauce of the ability to execute the applications in standalone mode and integrated mode. We will use a Docker Compose file specific to the application to debug that application in standalone mode. Later, we will combine the Docker Compose files to execute the applications in integrated mode.

## Debugging Pong Service

Since a VS Code instance can attach to a single container, we must use a new VS Code instance to debug the Pong application. To that end, open the folder Pong in a new VS Code window. In this layout, the _.devcontainer_ folder will be available at the root of the workspace. Let's explore the contents of the _devcontainer.json_ file.

```json
{
  "name": "Go",
  "dockerComposeFile": ["../../docker-compose-pong.yml"],
  "service": "pong",
  "runArgs": ["--cap-add=SYS_PTRACE", "--security-opt", "seccomp=unconfined"],
  "settings": {
    "terminal.integrated.shell.linux": "/bin/bash",
    "go.gopath": "/go"
  },
  "extensions": ["ms-vscode.go"],
  "forwardPorts": [8080],
  "workspaceFolder": "/workspace/Pong",
  "shutdownAction": "none"
}
```

In the preceding specification, you can see that we are instructing the remote development extension to pick the Docker Compose file that enables the standalone execution of the Pong application. Further, the specification supplies settings and runtime arguments to enable debugging of a GoLang application. Next, the specifications specify the ports that container should expose and the VS Code extension required in the remote development environment. Finally, the value `none` of the `shutdownAction` property ensures that the container will stay in running state even after you close the VS Code window.

The following is the Docker Compose file for the Pong service.

```yaml
version: "3"
services:
  pong:
    build:
      context: ./Pong
      dockerfile: .devcontainer/Dockerfile
    environment:
      - PORT=8080
    volumes:
      - .:/workspace:cached
    command: /bin/sh -c "while sleep 1000; do :; done"
```

To debug the Pong service, open the folder _Pong_ in a container. To do so, click on the icon in the bottom left corner of the VS Code window and select the option _Reopen in container_ from the options, as shown below.

{{< img src="3.gif" alt="Open Pong in Container Standalone" >}}

VS Code remote extension mounts the application source code directory as volume to the container. In the new VS Code instance that is attached to a container, you can set breakpoints and debug applications as you would on your system. Set a breakpoint in the code and press _F5_ to launch the debug process, as shown below.

{{< img src="4.png" alt="Debugging Pong Service Standalone" >}}

With the Pong service running in debug mode, you can send a _GET_ request to the _localhost:8080/pong_ endpoint from your system and receive a response from the Pong service as follows.

```bash
$ curl http://localhost:8080/pong

Pong!
```

Let's leave the service running and debug the Ping service in standalone mode now.

## Debugging Ping Service

Let's first investigate the _devcontainer.json_ file of the Ping application which has the following code.

```json
{
  "name": "C# (.NET Core 3.1)",
  "dockerComposeFile": [
    "../../docker-compose-ping.yml"
    // Uncomment the following two lines to execute the application in integrated mode.
    // "../../docker-compose-pong.yml",
    // "../../docker-compose.yml"
  ],
  "service": "ping",
  "settings": {
    "terminal.integrated.shell.linux": "/bin/bash"
  },
  "extensions": ["ms-dotnettools.csharp"],
  "workspaceFolder": "/workspace/Ping",
  "shutdownAction": "none"
}
```

To develop and debug the Ping service in standalone mode, we will bring up a container that runs only the Ping service. You will notice that in the previous code listing, I have commented out the links to Docker Compose files for the Pong service and the Docker Compose file, _docker-compose.yml_, which is responsible for orchestrating the containers of both the services. Open the Docker Compose file, _docker-compose-ping.yml_, so that we can investigate its contents.

```yaml
version: "3"
services:
  ping:
    build:
      context: ./Ping
      dockerfile: .devcontainer/Dockerfile
    environment:
      - PONG_ADDRESS=http://host.docker.internal:8080/pong
    volumes:
      - .:/workspace:cached
    command: /bin/sh -c "while sleep 1000; do :; done"
```

Please read the documentation on connecting multiple containers on the [VS Code documentation website](https://vscode-eastus.azurewebsites.net/docs/remote/containers-advanced#_connecting-to-multiple-containers-at-once) to understand the reason behind setting the value of the `volume` and `command` properties. Note the value of the environment variable `PONG_ADDRESS` in the specification. Since the Docker host (your system) has a dynamic IP address, Docker for Windows\Mac creates a unique DNS record named `host.docker.internal` in your container using which a service inside the container can connect to services on the host. You can read more about networking features of Docker for Windows [here](https://docs.docker.com/docker-for-windows/networking/), and Docker for Mac [here](https://docs.docker.com/docker-for-mac/networking/).

Just as you opened the Pong service folder on a container previously, open the Ping service folder in a container. Put a breakpoint in the application and launch the application by pressing the _F5_ key. If you inspect the value of the `PONG_ADDRESS` environment variable inside the application, you will find that it is the same as the value that you specified in the Docker Compose specification.

> If the Ping application fails to build on the container, delete the _bin_ and _obj_ folders from the mounted directory and restart the debugging process. This error occurs because .NET core generates build artifacts based on the host on which the application compiles.

{{< img src="5.png" alt="Environment Variable Value in Ping Service" >}}

If you allow the application to execute further, you will notice that the application prints the texts _Ping_ and _Pong_ to console after random delays. The following screenshot presents the output that I captured after letting the application execute for some time.

{{< img src="6.png" alt="Ping Pong Output" >}}

Up to this point, we experienced debugging two separate services of an application running autonomously. Let's now launch the applications in integrated mode. Since the Ping service is dependent on the Pong service, we will use Docker Compose `link` attribute to connect the Ping service to the Pong service. Open the file _docker-compose.yml_ to inspect the code.

```yaml
version: "3"
services:
  ping:
    links:
      - pong
    environment:
      - PONG_ADDRESS=http://pong:8080/pong
  pong:
    environment:
      - PORT=8080
```

Since we are going to rely on the Docker Compose network bridge for communication between the two containers, you will notice that I updated the value of `PONG_ADDRESS` environment variable to the hostname of the Docker container of Pong service.

```json
{
  "name": "C# (.NET Core 3.1)",
  "dockerComposeFile": [
    "../../docker-compose-ping.yml",
    "../../docker-compose-pong.yml",
    "../../docker-compose.yml"
  ],
  "service": "ping",
  "settings": {
    "terminal.integrated.shell.linux": "/bin/bash"
  },
  "extensions": ["ms-dotnettools.csharp"],
  "workspaceFolder": "/workspace/Ping",
  "shutdownAction": "none"
}
```

Since we are going to rely on the Docker Compose network bridge for communication between the two containers, you will notice that I updated the value of the `PONG_ADDRESS` environment variable to the hostname of the Docker container of Pong service. To bring this Docker Compose specification in effect, uncomment the paths to the two Docker Compose files in the _devcontainer.json_ file of the Ping application.

With the changes in place, the remote development extension will use the three Docker Compose files to form a complete specification to light up the containers for the Ping and Pong applications. You will notice that the VS Code instance running the Ping application detects the changes you made to the specification and launches a dialog asking whether you want to rebuild the container. Click on the _Rebuild_ button to allow VS Code to relaunch the container with the new specification.

{{< img src="7.png" alt="Rebuild Containers After Change" >}}

After VS Code rebuilds the container, we can execute the two services in conjunction.

## Debugging in Integrated Mode

If you closed the VS Code instance that was running the Pong service, launch the Pong service in a container again. Now set a breakpoint in the Ping application and start the debugger by pressing the _F5_ key. Inspect the value of the environment variable `PONG_ADDRESS` again. In this run, you will find that the Pong service address has changed to the value set in the _docker-compose.yml_ file, as shown below.

{{< img src="8.png" alt="Update Environment Variable Value in Ping Service" >}}

You can set breakpoints in both the applications and watch each request move back and forth between the applications. I have captured the entire operation in action in the following image.

{{< img src="9.gif" alt="Debugging Ping Pong Services in Integrated Mode" >}}

Remember that the setting `shutdownAction` in the file _dockerfile.yml_ of both the applications prevent the containers from shutting down when you close the VS Code instances. Let's remove the containers created by the extension.

## Cleanup

You can remove the containers created by the extension in the same manner as you would for any other Docker Compose service. For this sample, execute the following command after changing to the location of the Docker Compose files.

```bash
$ docker-compose -f docker-compose-ping.yml -f docker-compose-pong.yml -f docker-compose.yml down

Stopping devcontainers_ping_1 ... done
Stopping devcontainers_pong_1 ... done
Removing devcontainers_ping_1 ... done
Removing devcontainers_pong_1 ... done
Removing network devcontainers_default
```

I hope you enjoyed working on this sample. Let me know your feedback in the comments or on my Twitter handle [@rahulrai_in](https://twitter.com/rahulrai_in).

{{< subscribe >}}
