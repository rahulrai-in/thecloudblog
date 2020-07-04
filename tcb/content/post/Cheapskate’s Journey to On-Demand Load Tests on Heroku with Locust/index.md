---
title: "Cheapskate’s Journey to On-Demand Load Tests on Heroku with Locust"
date: 2020-06-20
tags:
  - azure
  - devops
  - programming
---

I want to stretch every dollar that I spend on the cloud. I run a handful of web applications on Heroku, and like everyone else, run a suite of smoke tests and load tests on every release increment in a non-production environment. Load tests are important: they help us not only to understand the limits of our systems but also bring up issues that arise due to concurrency, which often escape the realms of unit tests and integration tests. But since we run the tests often, we don't want to pay a lot of money every time the tests run.

In this article, I'll show you how to set up cost-effective load tests. We'll use Locust to make the testing robust, and [Heroku](https://www.heroku.com/) to make running the tests easy and cost-effective. I'll also show how you can use VS Code and Docker for development without installing dev dependencies on your system.

## What is Locust?

[Locust](https://locust.io/) is an open-source load testing tool written in Python. Locust tests can be distributed over multiple machines to simulate millions of users simultaneously, helping to determine just how many users your site or system can handle.

Locust was created to address issues that exist with two other leading solutions - [JMeter](https://jmeter.apache.org/) and [Tsung](http://tsung.erlang-projects.org/). Specifically, it was built to address the following limitations:

- Concurrency: JMeter is thread bound, creating a new thread for every user. This severely limits the number of users that can be simulated per machine. Locust, on the other hand, is event-based and can simulate thousands of users on one process.
- Ease of Coding: JMeter requires complicated callbacks. Tsung uses an XML-based DSL to define user behavior. Both are difficult to code. Locust scenarios, on the other hand, are written in plain Python and are easy to code.

## Terminology

First, a little terminology. With Locust, you write user behavior tests in a set of locustfiles, and then execute the locustfiles concurrently on the target application. In terms of Locust, a collection of locust users (collectively called a Swarm, and individually called a Locust) will attack the target application and record the results. Each locust executes inside its sandboxed process called Greenlet.

## Considerations

Before proceeding further, I recommend that you read the [guidance from Heroku](https://devcenter.heroku.com/articles/load-testing-guidelines) on load tests, which lists the restrictions that apply and the consequences. The guidance in this article is limited to executing low to medium level tests (less than 10,000 requests per second). For executing high-scale tests, you should either contact Heroku support first to ensure your systems are pre-warmed and will scale appropriately, or use Private Spaces to host your testbed (application under test and the test platform). For high-volume load tests, I recommend modeling your test setup on [this sample application repository](https://github.com/sho7650/heroku-locust). For the latest pricing details and to estimate the cost of running your applications on Heroku, refer to the [Heroku website](https://www.heroku.com/pricing).

## Prerequisites

Here is the list of tools and cloud services that I used to build the sample application. My development machine runs Windows 10 Professional, however, the following tools are available on Mac as well.

- VS Code with [Remote Development](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack) extension
- [A Heroku account](https://www.heroku.com/) in which you can create apps on the standard tier
- A free [Microsoft Azure subscription](https://azure.microsoft.com/en-us/free/free-account-faq/)
- [Docker Desktop for Windows (or Mac)](https://www.docker.com/products/docker-desktop)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- [Azcopy](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-v10)

## The Applications

The sample application that I have prepared for this demo, which we will refer to as _the Target API application_, is a REST API written in Go. We also have a second application, which we will refer to as _Loadtest application_, that contains the load tests written in Python using [Locust](https://locust.io/).

- The _Target API application_ is the REST API that we intend to test. Since the API is required to process HTTP requests, we host it on [web dynos](https://devcenter.heroku.com/articles/dynos).
- The _Loadtest application_ contains our Locust tests. These are split into two categories based on the type of users supported by the _Target API application_. You can execute the two test suites in parallel or in sequence, thus varying the amount and nature of load that you apply on the _Target API application_. Since the dynos executing the tests are required only for the duration of test executions, we host them in Heroku's [one-off dynos](https://devcenter.heroku.com/articles/one-off-dynos). The one-off dynos are billed only for the time and resources that they consume, and an Administrator can spawn them using the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) tool.

The following is the high-level design diagram of the applications and their components.

{{< img src="1.png" alt="High Level Design Diagram" >}}

Heroku provides ephemeral storage to the application processes executing on the dyno, which may or may not exist. Also, because the storage is local to the process, we cannot access any files generated by the Heroku CLI since it creates another sandboxed process with its own storage on the dyno. Due to access restrictions, the process that generates the files will export them to a durable cloud storage service, or in the case of web dynos, make them available through an HTTP endpoint. By executing Locust with a flag (--csv), you can instruct locust to persist test results in CSV files locally. We use [Azcopy](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-v10), which is a CLI tool used for copying binary data into and out of Azure storage to export the results generated by the Locust tests to an Azure blob storage.

## Setting Up the Applications

The source code of the applications is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/locust-load-test-heroku" >}}

## Target API Application

Let's first dissect the Target API application, which we want to test with our load test suite. Open the folder named _api_ in VS Code. In the file _main.go_, I have defined three API endpoints:

```
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
     fmt.Println("Served home request")
     fmt.Fprintf(w, "Server OK")
})

http.HandleFunc("/volatile", func(w http.ResponseWriter, r *http.Request) {
     // For every 10 requests, delay the response by 1 second, up to 5 seconds.
     currentCount := atomic.LoadInt32(&requestCount)
     atomic.AddInt32(&requestCount, 1)
     delay := currentCount / 10
     if delay > 5 {
         atomic.StoreInt32(&requestCount, 0)
         delay = 5
     }

     time.Sleep(time.Duration(delay) * time.Second)
     fmt.Fprintf(w, "Produced response after %d second/s", delay)
     fmt.Printf("Produced response after %d second/s \n", delay)
})

http.HandleFunc("/buggy", func(w http.ResponseWriter, r *http.Request) {
     // After every 5 requests, throw error
     currentCount := atomic.LoadInt32(&requestCount)
     atomic.AddInt32(&requestCount, 1)
     if currentCount%5 == 0 {
         fmt.Printf("Returning error at %d request \n", currentCount)
         http.Error(w, http.StatusText(500), 500)
         return
     }

     fmt.Fprintf(w, "Ok for request %d", currentCount)
})
```

The behavior of the three endpoints is as follows:

- "_/_": Returns an HTTP 200 response with text _OK_.
- "_/volatile_": Returns HTTP 200 response but successively delays the response by one second for every 10 requests.
- "_/buggy_": Returns an HTTP 500 fault message for every fifth request.

## Remote Development Extension for Debugging

You probably noticed that I did not mention installing Golang or Python as a prerequisite for this application. We will use the _Remote Development_ extension that you installed to VS Code to debug the Target API application. You can read about this extension in [detail here](https://code.visualstudio.com/docs/remote/remote-overview). However, in a nutshell, this extension allows you to use a container as your development environment. The extension searches for a folder named _.devcontainer_ at the root and uses the _Dockerfile_ (the container definition) and _devcontainer.json_ (for container settings) files to create a new container and mount the folder containing your code as a volume to the container. For debugging, the extension attaches the VS Code debugger to the process running in the container. I have already configured the container resources for you, so you just need to press the _F1_ key to bring up the command window and select the command: _Remote-Containers: Open folder in container_.

{{< img src="2.png" alt="Open Folder In Container" >}}

When asked which folder to open, select the 'api' folder and continue.

Alternatively, you can spawn the command dialog by clicking on the green icon in the bottom left of the VS Code window.

Once the container is ready, press _F5_ to start debugging the application. You will notice that the text in the bottom left corner of the VS Code window changes to _Dev Container: Go_ to denote that the application is currently executing in a remote container. You can now access the application endpoints from your browser by navigating to [http://localhost:9000](http://localhost:9000/).

{{< img src="3.png" alt="Executing Application in A Remote Container" >}}

## Loadtest Application

Now we are going to use VS Code to build the test suite inside a container and create a shell script that automates the process of setup and tear down of the test infrastructure. You can use this script to automate the spin up and tear down of the test grid and add it to your CI\CD pipeline.

**1. Launch Loadtest Application Dev Container**

In another VS Code instance, open the folder _loadtest_ and launch it in a dev container as well. In this application, you will notice that I created two sets of tests to model the behavior of two user types of the Target API application.

{{< img src="4.png" alt="Locustfiles for Test" >}}

- The user behavior of type _ApiUser_ is recorded in locustfile_scene_1.py. According to the test, a user of type APIUser accesses the default and the volatile endpoints of the Target API application after waiting for five to nine seconds between invocations.
- The user behavior of type _AdminUser_ is recorded in locustfile_scene_2.py. This category of user accesses the default and the buggy endpoints of the Target API application after waiting for five to 15 seconds between invocations.

**2. Verify the Tests**

To verify the test scripts, execute the following command in the integrated terminal (_Ctrl + ~_).

```
$ locust -f locustfile_scene_1.py
```

Navigate to [http://localhost:8089](http://localhost:8089/) to bring up the locust UI. In the form, enter the hostname and port of the Target API application along with the desired locust swarm configurations, and click the button _Start Swarming_ to initiate the tests.

{{< img src="5.png" alt="Locust UI" >}}

**3. The Run Shell Script**

For executing the locust tests, we need to define a small workflow for each set of tests as follows.

- Execute the test without the web UI on a single worker node for a fixed duration and generate CSV reports of the test results.
- Use Azcopy to copy the test result files to Azure storage. (Of course, you can substitute this part for any cloud storage provider you may use. You would simply need to modify the following script to use a different utility instead of azcopy, and you would be copying to a different storage location.)

The _run.sh_ script in the load test project implements this workflow as follows:

```
#!/bin/bash

locust -f $1 --headless -u 200 -r 10 --host=$TARGET_HOST --csv="$2_$(date +%F_%T)" --run-time 1h -t 2s --stop-timeout 60

for filename in *.csv; do
    [ -e "$filename" ] || continue
    azcopy copy "$filename" "https://locustloadtest.blob.core.windows.net/testresult/$filename\$SAS_TOKEN"
done

exit 0
```

In the previous code listing, after executing the _locust_ command, which produces CSV results, we loop through the CSV files and use the Azcopy utility to upload each file to an Azure storage location—a container named _testresult_ in the _locustloadtest.blob.core.windows.net_ account. You must change these values with the storage account that you created in your Azure subscription. You can see that this command relies on a Shared Access Secret (SAS) token for authentication, which we applied through an environment variable named SAS_TOKEN. We will add this environment variable to the application later. If you are not familiar with the Azcopy utility, please read more about using [Azcopy with SAS tokens here](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-blobs).

## Start the Target API Application and Create the Web Dyno

Inside the root directory of each project, API and Loadtest, you will find a file named _Procfile_.

In the API Procfile, the following command will instruct Heroku to create a web dyno and invoke the command _locust-loadtest_ to launch the application.

```
web: locust-loadtest
```

In the Loadtest project, the Procfile for the Locust tests instructs Heroku to create two worker dynos and invoke Run.sh script with appropriate parameters as follows:

```
worker_scene_1: bash ./run.sh locustfile_scene_1.py scene_1
worker_scene_2: bash ./run.sh locustfile_scene_2.py scene_2
```

## Creating Applications in Heroku

We will now create the two required applications in Heroku.

There are two ways in which you can interact with Heroku: the user interface and the Heroku CLI. I will guide you through a mix of both approaches so that you get some experience with both.

For creating the applications, we will use the Heroku user interface. We will create the Target API application first.

### Create Target API Application

In your browser, navigate to [https://dashboard.heroku.com/](https://dashboard.heroku.com/) and click on the _New/Create new app_ button.

{{< img src="6.png" alt="Create a New Heroku App" >}}

On the create app page, enter the name of the application (locust-heroku-target), choose the _Common Runtime_ option, and the desired region. Note that the application name must be unique across all Heroku apps, and so this name _may_ not be available. You can choose your own unique name for this application (and the test engine application lower down), making sure to reference these new names in all subsequent code and commands. If your customers are present in multiple geographies, you can create an additional test bed in a different location and test the performance of your application from that location as well. Click the _Create app_ button to create the application.

{{< img src="7.png" alt="Create locust-heroku-target" >}}

The next screen asks you to specify the deployment method. Since I am already using GitHub for source control, I can instruct Heroku to automatically deploy whenever I make changes to the _master_ branch. I recommend you don't follow the same scheme for real-life applications. You should deploy to production from the _master_ branch and use another branch such as the release branch to deploy to test environments (Git flow) or from the master branch after approvals (GitHub flow).

{{< img src="8.png" alt="Link App to GitHub - locust-heroku-target" >}}

## Create Loadtest Application

Now let's set up the Loadtest application for our Locust tests. You can create another app (locust-heroku-testengine) for the test, like this:

{{< img src="9.png" alt="Create locust-heroku-testengine" >}}

You may have noticed that I used the [monorepo](https://en.wikipedia.org/wiki/Monorepo) model to keep the Target API application and tests together in the same project.

On the next screen, connect the deployment of the application you just created to the same repository. With this setup, whenever you make changes to either the Loadtest or the Target API application, both will be deployed to Heroku, which helps to avoid any conflicts between the versions of the Loadtest and the Target API application.

{{< img src="10.png" alt="Link App to GitHub - locust-heroku-testengine" >}}

By default, the worker dynos of this application will use Standard-1x dynos, which are a great balance of cost and performance for our scenario. However, you can change the dyno type based on your requirements with the Heroku CLI or through the UI. Refer to the [Heroku documentation](https://devcenter.heroku.com/articles/dyno-types) for the CLI command and types of dynos that you can use.

## Adding Buildpacks via Heroku CLI

Now let's switch to the terminal and prepare the environment using the Heroku CLI. We'll go through the buildpacks that our services need and add them one at a time.

### How the Buildpacks Work

Heroku [buildpacks](https://devcenter.heroku.com/articles/buildpacks) are responsible for transforming your code into a "slug." In Heroku terms, a slug is a deployable copy of your application. Not every buildpack must generate binaries from your application code—buildpacks can be linked together such that each buildpack transforms the application code in some manner and feeds it to the next buildpack in the chain. However, after processing, the dyno manager must receive a slug as an output.

For example, since our source code is organized as a monorepo consisting of the Target API application and Loadtest application, the first buildpack in the buildpack chain, [heroku-buildpack-monorepo](https://github.com/lstoll/heroku-buildpack-monorepo), extracts an application from the monorepo. The second buildpack in the chain builds the appropriate application.

### Target API Buildpacks

Let us consider the Target API application first. Use [heroku-buildpack-monorepo](https://github.com/lstoll/heroku-buildpack-monorepo) to extract the _locust-heroku-target_ application from the monorepo. The next buildpack, [heroku-buildpack-go](https://github.com/heroku/heroku-buildpack-go), builds the Target API project.

Execute the following commands in the exact sequence to preserve their order of execution, and remember to change the name of the application in the command to what you specified in the Heroku User Interface earlier.

```
$ heroku buildpacks:add -a locust-heroku-target https://github.com/lstoll/heroku-buildpack-monorepo

$ heroku buildpacks:add -a locust-heroku-target https://github.com/heroku/heroku-buildpack-go
```

### Loadtest Buildpacks

For the _locust-heroku-testengine_ project, we need two buildpacks. The first buildpack is the one we used previously, [heroku-buildpack-monorepo](https://github.com/lstoll/heroku-buildpack-monorepo). We will modify the parameter though, so it will extract the Locust test project (_locust-heroku-testengine_) from the monorepo. The second buildpack, [heroku-buildpack-python](https://github.com/heroku/heroku-buildpack-python), enables executing Python scripts on Heroku.

```
$ heroku buildpacks:add -a locust-heroku-testengine https://github.com/lstoll/heroku-buildpack-monorepo

$ heroku buildpacks:add -a locust-heroku-testengine https://github.com/heroku/heroku-buildpack-python
```

## Configuring Environment Variables

### Via Heroku CLI

Our applications require setting a few environment variables.

| **Application Name**         | **Variable** | **Value**                                                                         | **Reason**                                                                                       |
| ---------------------------- | ------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **locust-heroku-target**     | APP_BASE     | api                                                                               | Required by heroku-buildpack-monorepo to extract the project                                     |
| **locust-heroku-testengine** | APP_BASE     | loadtest                                                                          | Required by heroku-buildpack-monorepo to extract the project                                     |
| **locust-heroku-testengine** | PATH         | /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/app/bin             | Adds the bin folder present in the application _loadtest_ to PATH so that Azcopy can be executed |
| **locust-heroku-testengine** | SAS_TOKEN    | Azure storage SAS token e.g.? sv=2019-10-10&ss=bfqt&srt=sco&sp=rwdlacupx&se=2025… | Required by Azcopy to transfer data to azure storage                                             |
| **locust-heroku-testengine** | TARGET_HOST  | URL of the Target API application                                                 | Required by Locust to execute load tests                                                         |

Execute the following commands to add the environment variables to your applications.

```
$ heroku config:set -a locust-heroku-target APP_BASE=api

$ heroku config:set -a locust-heroku-target GOVERSION=go1.13

$ heroku config:set -a locust-heroku-testengine APP_BASE=loadtest

$ heroku config:set -a locust-heroku-testengine PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/app/bin

$ heroku config:set -a locust-heroku-testengine SAS_TOKEN="?sv=2019-10-10&ss=bfqt&srt=sco&sp=rwdlacupx&se=2025-05-16T11:41:28Z&st=2020-05-15T03:41:28Z&spr=https&sig=\<secret>"

$ heroku config:set -a locust-heroku-testengine TARGET_HOST=https://locust-heroku-target.herokuapp.com/
```

### Via Heroku User Interface

As I mentioned above in this article, you can configure the applications through the user interface as well. You can find the settings that we applied under the _Settings_ tab as shown in the following screenshot of the section from the _locust-heroku-target_ application.

{{< img src="11.png" alt="Settings - locust-heroku-target" >}}

Similarly, the following screenshot illustrates the settings that we applied to the _locust-heroku-testengine_ application.

{{< img src="12.png" alt="Settings - locust-heroku-testengine" >}}

## Deploy the Applications

Because of the existing GitHub integration, Heroku deploys our application whenever any changes are pushed to the _master_ branch. Push your application or changes to GitHub and wait for the build to complete. You can view the logs of the build under the _Activity_ tab of your application.

### Target API application

After deployment, you can navigate to the _Resources_ tab and view the dyno hosting the application. You can scale out the dyno from this UI. Click on the _Open app_ button to launch the application.

{{< img src="13.gif" alt="Open App - Locust Heroku Target" >}}

### Loadtest application

If you navigate to the _locust-heroku-testengine_ app, you will find that Heroku created two worker dynos by reading the instructions from the Loadtest project's Procfile.

{{< img src="14.png" alt="Worker Dynos of locust-heroku-testengine" >}}

## Execute Tests

To execute the tests hosted in the dynos, we kick them off using the Heroku CLI with the following commands. These start the one-off dynos, which then terminate right after they finish execution.

```
$ heroku run worker_scene_1 --app locust-heroku-testengine

$ heroku run worker_scene_2 --app locust-heroku-testengine
```

After execution, the Azcopy utility copies the CSV files containing the test results to Azure storage, which you can extract using [Azure Storage Explorer](https://azure.microsoft.com/en-us/features/storage-explorer/). The following image illustrates this process in action.

{{< img src="15.gif" alt="Execute Load Tests" >}}

You can use a custom visualizer or open the CSV files in Excel to read the test results. The following image presents part of a result that I received from the execution of worker_scene_2 dyno that executes the test present in the locustfile_scene_2.py file.

{{< img src="16.png" alt="Load Test Results" >}}

## The Results

Let's analyze the results to see how well our application is working. Every test run produces three files:

1. The _failures.csv_ file lists the total number of failures encountered. In scenario 2 results, my run produced 28 errors from the _GET /buggy_ endpoint, which were expected as this is how we programmed it.

2. The _stats.csv_ file lists the endpoints to which the tests send requests and the response time in milliseconds. My run for scenario 2 shows that the swarm sent 29 and 28 requests to the _GET /_ and _GET /buggy_ endpoints respectively. On average, the locusts received a response from the two endpoints in 149 ms and 78 ms respectively. The percentile splits of average response time are the most valuable pieces of information generated by the load tests. From my test run I can see that 99% of the users of my API will receive a response from the _GET /_ and _GET /buggy_ endpoints in 430 ms and 270 ms respectively.

3. The third file, _history.csv_, is similar to the _stats.csv_ file but gets a new row for every 10 seconds of the test run. By inspecting the results of this file, you can find whether your API response time is deteriorating as time passes.

Let's also look at how much it costs to execute these tests. I hosted the tests on two Standard-1X dynos, which cost $25 each month. Therefore, if I were to let the tests execute continuously for a month, it would cost $50. Since my individual test runs lasted only two minutes, and Heroku charges for the processing time by the second, my incurred charges were so minuscule that they did not even show up on my dashboard.

That's great, but let's approximate the charges that testing a real-life application might incur. Let's say on average an API requires around 10 suites of tests, and hence 10 dynos. If these tests run every night and each run lasts for five minutes, each dyno will remain active for one dyno x 300 seconds x 30 days = 9,000 seconds; hence, each dyno will cost $0.086 each month. The total cost of running 10 load-test dynos (one-off dynos) for an entire month will be around $0.87.

## Conclusion

You are now ready to execute load tests on Heroku using Locust. You'll be able to test the stability and performance of every deployment. Since one-off dynos are charged only for the time and resources that they consume, you'll get maximum value from every cent that you spend.

{{< subscribe >}}
