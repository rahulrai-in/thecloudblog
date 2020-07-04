---
title: "Integration Tests in Azure Pipelines with ASP.Net Core and SQL on Docker"
date: 2019-04-17
tags:
  - azure
  - devops
---

I usually like to keep my application dependencies such as the database, and emulators packaged in containers. Running the dependencies in containers gives me the ability to keep my development process fluid as I can bring up the dependencies to the desired state no matter how massively I deform them.

In my CI pipelines, I enforce the execution of unit tests and integration tests on every build. Usually, running integration tests involve running test cases along with the dependency, which is a database most of the time. In this article, we will see how we can package tests and SQL database in Docker containers and wait for SQL server to get ready before initiating the tests. To do so, we will package tests and SQL database in containers and orchestrate them using Docker Compose.

## Code

You can download the source code of the sample application from my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/dockerdependency" >}}

## Solving The Container Readiness Problem

Docker Compose is an excellent tool to combine containers to form a logical unit. However, dependency chaining through `depends_on` key does not wait for a container to be ready. Docker Compose v3 only ensures that containers start in dependency order without waiting for the containers to be ready and just in running state.

To solve this issue, you can either build a connection retry mechanism in the application or use a simple script that does not allow the application container to start unless the SQL container starts responding to probes. I do not believe that building that kind of resiliency is necessary to run tests and therefore, I prefer taking the second approach for such scenarios. There are several utilities available that you can use for the purpose, but I like the [docker-compose-wait](https://github.com/ufoscout/docker-compose-wait/) utility for its ability to support waiting for multiple dependencies at the same time. To provide a list of container endpoints that this utility needs to ping and wait for, we need to set an environment variable `WAIT_HOSTS` with value as comma separated names of containers that the `wait` command should ping.

We will use the following Dockerfile for packaging the integration tests project in a container. Note how we brought in the utility to our image. The command specified in the last line of the Dockerfile instructs `dotnet test` to wait until it receives a signal from the `wait` command.

```
FROM mcr.microsoft.com/dotnet/core/sdk:2.2 AS build
WORKDIR /app

COPY /DockerDependencyTest/DockerDependencyTest.csproj ./
RUN dotnet restore

COPY . ./
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.5.0/wait /wait
RUN chmod +x /wait

CMD /wait && dotnet test
```

Now, let's connect the tests to a container running SQL Server using Docker Compose. The following specification connects the test application container with a container running SQL server. Since this container only lives for the lifetime of tests, it is okay to use a simple password in clear case and committed to source control.

```
version: '3.4'

services:
  tests:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      WAIT_HOSTS: database:1433

  database:
    image: mcr.microsoft.com/mssql/server:2017-CU8-ubuntu
    environment:
      SA_PASSWORD: 'P@ssW0rd!'
      ACCEPT_EULA: 'Y'
```

Note how we specified the container name and port number as the value of the `WAIT_HOSTS` environment variable in the previous code listing. In our tests, we can connect to the container using the following connection string.

```cs
Data Source=database;Initial Catalog=master;PersistSecurityInfo=True;User ID=sa;Password=P@ssW0rd!
```

I usually don't run tests on my machine using Docker Compose. I provision a container running SQL server which is always running on my system and run my tests against it, which frees me from having to package the application again and again in a container to run tests. If you wish to follow a similar mechanism, make the connection string configurable so that you can change it using environment variables. One of the steps missing here is to run the database migrations on the database before executing the tests. You can easily add an application or a script to do so and make it wait on the database to be ready before execution. Next, make the tests depend on the migrations so that everything executes like a well-managed orchestra.

In your terminal change to the directory that contains the Docker Compose file and run the following command.

```bash
docker-compose up --abort-on-container-exit
```

The previous command will create the two containers and execute the tests. The `abort-on-container-exit` flag instructs Docker Compose to shut down as soon as one of the containers exits. You should be able to see the status of the tests in the terminal as follows.

{{< img src="1.png" alt="Executing Integration Tests in Docker" >}}

## Publishing Test Results

There is a small caveat to the approach of running your tests in a container. You won't be able to see the test result in the build pipeline as they live within a `.trx` file inside the container. To see the results of the tests, the simplest thing to do is to write the test results to a file in a specific directory that is mapped to a volume of the host machine. To do so modify the `docker test` command to instruct it to publish the test results to a specific directory. Ultimately, your Dockerfile should resemble the following code listing.

```
FROM mcr.microsoft.com/dotnet/core/sdk:2.2 AS build
WORKDIR /app

COPY /DockerDependencyTest/DockerDependencyTest.csproj ./
RUN dotnet restore

COPY . ./
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.5.0/wait /wait
RUN chmod +x /wait

CMD /wait && dotnet test --logger trx --results-directory /var/temp
```

Also, update the Docker Compose file to bind a volume to the container. The updated contents of the _docker-compose.yml_ file should resemble the following code listing.

```
version: '3.4'

services:
  tests:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      WAIT_HOSTS: database:1433
    volumes:
        - /opt/vsts/work/_temp:/var/temp

  database:
    image: mcr.microsoft.com/mssql/server:2017-CU8-ubuntu
    environment:
        SA_PASSWORD: "P@ssW0rd!"
        ACCEPT_EULA: "Y"
```

Finally, to set up your build in Azure DevOps, add a file named _azure-pipelines.yml_ to the root of your solution. Add the code present in the following listing to the file.

```
pool:
  name: Hosted Ubuntu 1604
steps:
- task: DockerCompose@0
  displayName: 'Run a Docker Compose command'
  inputs:
    dockerComposeFile: 'docker-compose.yml'
    dockerComposeCommand: 'up --abort-on-container-exit'

- task: PublishTestResults@2
  displayName: 'Publish Test Results  /opt/vsts/work/_temp/*.trx'
  inputs:
    testResultsFormat: VSTest
    testResultsFiles: ' /opt/vsts/work/_temp/*.trx'
    mergeTestResults: true
    failTaskOnFailedTests: true

```

The previous code listing will add two steps to your build pipeline. The first step will invoke the Docker Compose file with the same arguments that we used in our development setup. The next step will publish the test results by helping Azure DevOps pipeline locate the _.trx_ file which contains our test results. After the build is complete, you should be able to view the test results in the **Tests** tab of your build.

{{< img src="2.png" alt="Integration Test Results" >}}

What we built is a straightforward setup which any developer with a little experience of Docker and Docker Compose can build and maintain. Give this approach a try in your next project to develop clean and simple build pipelines without worrying about the database dependencies.

{{< subscribe >}}
