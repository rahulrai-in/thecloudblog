---
title: "Hands-on with Azure Service Fabric Reliable Services"
date: 2016-11-01
tags:
  - azure
  - service fabric
comment_id: c32306c7-1247-4880-a24a-eabc2c145f3d
---

> November 1, 2016: Thank you, community. This post was first written in April, 2016 and several parts of the code sample were getting obsolete. The code sample of this post has now been updated to use ASP.Net Core and Service Fabric SDK 2.3. I have revised the content of this blog post to accommodate the changes.

[Azure Service Fabric](https://azure.microsoft.com/en-in/documentation/services/service-fabric/), the next generation PaaS from Microsoft, is a platform to publish and manage microservices. The microservices methodology has been present for a long time in the industry. However, its adoption has been low due to non-availability of the right platform that hosts and manages the services and that does the heavy lifting of infrastructure challenges such as preserving state, rolling upgrades, inter-service communication and optimal use of machine resources etc..

Unlike current PaaS offerings for application deployment viz. [Cloud Service](https://azure.microsoft.com/en-in/documentation/articles/cloud-services-choose-me/) and [App Service](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/), Azure Service Fabric treats a collection of VMs as a worker pool on which applications can be deployed. Azure Service Fabric takes care of deploying your application to various nodes, failover, high availability etc. Azure Service Fabric offers two high-level frameworks for building services: the Reliable Services API and the Reliable Actors API. Today we will take a look at the Reliable Services API. Reliable Service API lets you write code in the traditional way while taking care of high availability and failover scenarios. It makes sure that any data you persist in a specialized set of collections ([`ReliableCollections`](https://azure.microsoft.com/en-in/documentation/articles/service-fabric-reliable-services-reliable-collections/)) remains available and consistent in case of failures. Reliable Services come in two flavors, stateless and stateful. As the names indicate, stateless services do not contain any state information and multiple instances of such a service can remain active at the same time to serve requests. Stateful services, on the other hand, can maintain state information and therefore only one instance (in a partition) remains active at any given point of time. A key feature, partitioning, is the concept of dividing the state (data) and compute into smaller accessible units to improve scalability and performance. Partitioning in the context of Service Fabric Stateful Services refers to the process of determining that a particular service partition is responsible for a portion of the complete state of the service.

## Objective

We will build a Service Fabric Reliable Service Application that will accept a search term as input, get tweets from Twitter for the search term and run sentiment analysis (through [Azure Text Analysis Service](https://azure.microsoft.com/en-in/documentation/articles/machine-learning-apps-text-analytics/)) on each tweet. The application will render the computed average sentiment for the search term through a web application (a Stateless Reliable Service Fabric Service) that interacts directly with the service (a Stateful Reliable Service Fabric Service).

## Approach

To explore as many services as we can, we will build a stateless web application named `TweetAnalytics.Web` that accepts a term as input and sends it to a Stateful Reliable Service named `TweetAnalytics.TweetService`. The service, in turn, will queue the message in a [`ReliableQueue`](https://msdn.microsoft.com/library/azure/dn971527.aspx) named `topicQueue`. An asynchronous process (`CreateTweetMessages`) in `TweetAnalytics.TweetService` will pick up the message and use [Twitter APIs](https://dev.twitter.com/overview/documentation) to retrieve tweets for the search term. The tweets retrieved for the search term will be queued in another `ReliableQueue` named `tweetQueue`. Another asynchronous process (`ConsumeTweetMessages`) in the `TweetAnalytics.TweetService` application will pick each tweet from the `tweetQueue`, compute the tweet sentiment through Azure Text Analytics service and store the result in a [`ReliableDictionary`](https://msdn.microsoft.com/library/azure/dn971511.aspx) named `scoreDictionary`. The web application, `TweetAnalytics.Web`, can query the Reliable Service, `TweetAnalytics.TweetService`, to get the average score of sentiment for the given search term which will be computed from the data stored in the dictionary.

The front-end of the solution, `TweetAnalytics.Web`, will communicate with the service, `TweetAnalytics.TweetService`, over an internal HTTP endpoint.

## Application Diagram

The following diagram of the application will help you visualize the solution that we will build.

{{< img src="1.png" alt="Service Fabric" >}}

## Code

The code for the application is available on my GitHub repository. {{< sourceCode src="https://github.com/rahulrai-in/TweetAnalyticsServiceFabric">}}

## Building The Sample

As the first step, use [this link](https://azure.microsoft.com/en-in/documentation/articles/service-fabric-get-started/) to install Azure Service Fabric SDK, runtime, and tools. You would need to configure PowerShell to enable Service Fabric to execute scripts on your system for various tasks such as setup of the local cluster, deployment of your application on the cluster etc.. Before we get started with building the application itself, we would need access to Twitter APIs and Azure Text Analytics Service.

- Use [this link](https://www.dougv.com/2015/08/posting-status-updates-to-twitter-via-linqtotwitter-walkthrough-tutorial-part-1/) to create a new Twitter Application and get necessary account secrets for accessing the Twitter REST APIs.
- Use [this link](https://azure.microsoft.com/en-us/documentation/articles/cognitive-services-text-analytics-quick-start/) to get keys for the Azure Text Analytics Service. [Here](https://text-analytics-demo.azurewebsites.net/) is a console which you can use to play with the Text Analytics Service.

After the setup is complete, using Visual Studio, create a new solution and add a new Service Fabric Application named `TweetAnalytics.TweetApp` to it.

{{< img src="2.png" alt="Create Service Fabric Application" >}}

Next, add a Stateless Reliable ASP.net core web application to your Service Fabric application by clicking on **Ok** and selecting the appropriate template on the following screen. Name the project `TweetAnalytics.Web`.

{{< img src="3.png" alt="Create ASP.net Core Reliable Service" >}}

This application would act as the front end for your Service Fabric application. To add the back-end service to your application, right-click on the _Services_ folder in your `TweetAnalytics.TweetApp` project and select **Add > New Service Fabric Service**. This action will render a template dialog similar to the previous one. Select Stateful Reliable Service template from the dialog and name it `TweetAnalytics.TweetService`.

Once the two Reliable Service projects are in place, we need to add one more project to the solution to write common code for the `TweetAnalytics.Web` and `TweetAnalytics.TweetService` projects. Add a class library named `TweetAnalytics.Contracts` to the solution and add an interface named `ITweet` that represents the operations implemented by the stateful service.

> #### Note
>
> It is a good practice to expose service operations through interfaces. This way, if you want to enable communication through contract based protocols such as WCF and RPC, then you only need to modify the interface. For example, we can have this interface extend the IService interface for the runtime to provide remoting infrastructure to the service contract.

```cs
namespace TweetAnalytics.Contracts
{
    using System.Threading.Tasks;

    public interface ITweet
    {
        Task<TweetScore> GetAverageSentimentScore();
		Task SetTweetSubject(string subject);
    }
}
```

Set the target platform of the class library to **x64** as it is the only platform supported by Service Fabric currently. Add `TweetAnalytics.Contracts` as a dependency into `TweetAnalytics.Web` and `TweetAnalytics.TweetService` projects. Implement the interface `ITweet` in `TweetService` class. The following implementation of `SetTweetSubject` in `TweetService` class will clear contents of `scoreDictionary`, which is a `ReliableDictionary` (won't lose data in case of failures) that contains tweet message and sentiment score as a string and decimal pair, and add the search term as a message to the `topicQueue` which is a `ReliableQueue`.

```cs
public async Task SetTweetSubject(string subject)
{
	if (this.cancellationToken.IsCancellationRequested)
	{
	return;
	}

	if (string.IsNullOrWhiteSpace(subject))
	{
	return;
	}

	using (var tx = this.StateManager.CreateTransaction())
	{
		var scoreDictionary =
			await this.StateManager.GetOrAddAsync<IReliableDictionary<string, decimal>>("scoreDictionary");
		await scoreDictionary.ClearAsync();
		var topicQueue = await this.StateManager.GetOrAddAsync<IReliableQueue<string>>("topicQueue");
		while (topicQueue.TryDequeueAsync(tx).Result.HasValue)
		{
		}
		await topicQueue.EnqueueAsync(tx, subject);
		await tx.CommitAsync();
	}
}
```

The implementation of `GetAverageSentimentScore` fetches the average sentiment score from the `scoreDictionary`. Note that, read operations happen on a [snapshot of the collection](https://azure.microsoft.com/en-in/documentation/articles/service-fabric-reliable-services-reliable-collections/#isolation-levels),therefore, it will ignore any updates that happen while you are iterating through the collection.

```cs
public async Task<TweetScore> GetAverageSentimentScore()
{
    if (this.cancellationToken.IsCancellationRequested)
    {
        return null;
    }

    var tweetScore = new TweetScore();
    var scoreDictionary =
        await this.StateManager.GetOrAddAsync<IReliableDictionary<string, decimal>>("scoreDictionary");
    using (var tx = this.StateManager.CreateTransaction())
    {
        tweetScore.TweetCount = await scoreDictionary.GetCountAsync(tx);
        tweetScore.TweetSentimentAverageScore = tweetScore.TweetCount == 0 ? 0 :
            scoreDictionary.CreateEnumerableAsync(tx).Result.Average(x => x.Value);
    }

    return tweetScore;
}
```

The `TweetService` class overrides the `RunAsync` method of the `StatefulService` class which it inherits from. In the `RunAsync` method, you can write code to implement a processing loop which executes only in the primary replica instance of the service. In the `RunAsync` method we will spin up two methods:

- `CreateTweetMessages`: This method continuously fetches tweets from the Twitter REST API (consumed through [LinqToTwitter](https://linqtotwitter.codeplex.com/) package) by dequeuing a message from the `topicQueue` and sending the message content as search term to the Twitter Search API. The tweets returned as a result from the Twitter API are queued in the `tweetQueue`.
- `ConsumeTweetMessages`: This method continuously fetches messages from the `tweetQueue` and uses the Azure Text Analysis Service to get the tweet sentiment score. The tweet along with the score is then stored in the the `scoreDictionary`.

Following is the implementation for the `CreateTweetMessages` method.

```cs
private void CreateTweetMessages()
{
    while (!this.cancellationToken.IsCancellationRequested)
    {
        var topicQueue = this.StateManager.GetOrAddAsync<IReliableQueue<string>>("topicQueue").Result;
        using (var tx = this.StateManager.CreateTransaction())
        {
            var topic = topicQueue.TryDequeueAsync(tx).Result;
            if (topic.HasValue)
            {
                var tweets = this.GetTweetsForSubject(topic.Value);
                var tweetQueue = this.StateManager.GetOrAddAsync<IReliableQueue<string>>("tweetQueue").Result;
                foreach (var tweet in tweets)
                {
                    tweetQueue.EnqueueAsync(tx, tweet).Wait();
                }
            }

            tx.CommitAsync().Wait();
        }

        Thread.Sleep(TimeSpan.FromSeconds(10));
    }
}
```

Following is the code listing for the `ConsumeTweetMessages` method.

```cs
private void ConsumeTweetMessages()
{
    var tweetQueue = this.StateManager.GetOrAddAsync<IReliableQueue<string>>("tweetQueue").Result;
    var scoreDictionary =
        this.StateManager.GetOrAddAsync<IReliableDictionary<string, decimal>>("scoreDictionary").Result;
    while (!this.cancellationToken.IsCancellationRequested)
    {
        using (var tx = this.StateManager.CreateTransaction())
        {
            var message = tweetQueue.TryDequeueAsync(tx).Result;
            if (message.HasValue)
            {
                var score = this.GetTweetSentiment(message.Value);
                scoreDictionary.AddOrUpdateAsync(tx, message.Value, score, (key, value) => score);
            }

            tx.CommitAsync().Wait();
        }

        Thread.Sleep(TimeSpan.FromSeconds(1));
    }
}
```

The `RunAsync` method spawns the above two methods.

```cs
protected override async Task RunAsync(CancellationToken token)
{
    this.cancellationToken = token;
    Task.Factory.StartNew(this.CreateTweetMessages, this.cancellationToken);
    Task.Factory.StartNew(this.ConsumeTweetMessages, this.cancellationToken);
    this.cancellationToken.WaitHandle.WaitOne();
}
```

To enable the HTTP communication channel between the front-end and the service, we need to override the `CreateServiceReplicaListeners` method to return and HTTP listener to the Service Fabric runtime. The code that creates the HTTP listener can be found in the code associated with the article.

```cs
protected override IEnumerable<ServiceReplicaListener> CreateServiceReplicaListeners()
{
    return new[] { new ServiceReplicaListener(this.CreateInternalListener) };
}
```

That's all the work we need to do in the `TweetAnalytics.TweetService` service. Next, in the `TweetAnalytics.Web` application we will add two simple actions that can interact with our Stateful Reliable Service to set the search term and get the average sentiment score. It is a good time now to talk about the partitioning strategies for the `TweetAnalytics.TweetService` application and the `TweetAnalytics.Web` application.

## Note on Partitions

A great blog post discussing the available partitioning schemes is available [here](https://blogs.msdn.microsoft.com/mvpawardprogram/2015/10/13/understanding-service-fabric-partitions/). In our solution, the web application need not use any partitions as it is stateless in nature, and therefore, it uses no partitioning scheme which means that there would be no routing of incoming requests. The various instances of the web application will get deployed on various nodes and they can handle the incoming requests concurrently. This is why, in production environment, we need to have a load balancer sitting in front of the instances of the web application so that the requests can be appropriately routed. The `TweetService` application, on the other hand, uses ranged partition (or `UniformInt64Partition` partitioning scheme) with partition value 1, which is the default partition scheme that gets applied when you add a new stateful service project to your solution. This means that there will be a single partition, and therefore a single primary, catering to the requests. However, since this is a simple application, we won't use multiple partitions here and route all requests to just one partition. However, considering the first alphabet of the search term as a partition identifier would have been a better design decision.

## Building The Web Application

To talk to the service, the web application would need to resolve the endpoint of the service by passing in the partition id and service name to the `ServicePartitionResolver` which simply queries the Service Fabric _Naming Service_ to retrieve the IP address of the `TweetService` instance. The web application will then send an HTTP request to the resolved address of the primary replica of the service. Following is how we can use the Fabric Runtime Context to build the name of the `TweetService`service.

```cs
private Uri tweetServiceInstance = new Uri(FabricRuntime.GetActivationContext().ApplicationName + "/TweetService");
```

The controller methods simply query the _Naming Service_ and sending requests to the primary replica of the service. Let's take a look at the `SetSubject` action which sends the search term argument to `TweetService`.

```cs
public IActionResult SetSubject(string subject)
{
	var tokenSource = new CancellationTokenSource();
	var servicePartitionResolver = ServicePartitionResolver.GetDefault();
	var httpClient = new HttpClient();
	var partition =
		await
			servicePartitionResolver.ResolveAsync(
				this.tweetServiceInstance,
				new ServicePartitionKey(this.defaultPartitionID),
				tokenSource.Token);
	var ep = partition.GetEndpoint();
	var addresses = JObject.Parse(ep.Address);
	var primaryReplicaAddress = (string)addresses["Endpoints"].First;
	var primaryReplicaUriBuilder = new UriBuilder(primaryReplicaAddress)
		{
			Query = $"subject={subject}&operation=queue"
		};
	var result = await httpClient.GetStringAsync(primaryReplicaUriBuilder.Uri);
	this.ViewBag.SearchTerm = result;
	return this.View();
}
```

## Storing Configuration Data

You must have noticed that I have retrieved the secrets and configurations that I have used in the application, from a configuration store. Note that any application configuration data should be stored as parameters in **PackageRoot/Config/Settings.xml**. You can define your own sections in the file, store configurable values within it and retrieve those values through the Service Fabric runtime APIs. You can even override these values for different environments. Read more about transforms [here](https://azure.microsoft.com/en-us/documentation/articles/service-fabric-manage-multiple-environment-app-configuration).

{{< img src="4.png" alt="Settings File" >}}

## Deploy and Debug

Press F5 to deploy the solution to your local cluster. This action will spin up your application and the Service Fabric Cluster Manager that you can use to monitor your application. Click on the Local Cluster Manager icon in your taskbar to spawn the Local Cluster Manager UI.

{{< img src="5.png" alt="Service Fabric Local Cluster Manager" >}}

This is a snapshot of my local cluster.

{{< img src="6.png" alt="Local Cluster Snapshot" >}}

As you can see that the dashboard lists the application that is deployed and also the nodes that are hosting the services. You can see that the web application has been deployed on Node 1 and the service has been deployed on Node 2, 3 and 4. If you expand the nodes, you will find that one of the nodes is hosting the primary replica for `TweetService`, which in my case is Node 4.

{{< img src="7.png" alt="Node 4 is Hosting The Primary Replica" >}}

To test the application, I will invoke the `TweetAnalytics.Web` application controller with an input (my name).

{{< img src="8.png" alt="Debugging Service Fabric Application" >}}

Once the message is queued, I can click on the link and keep refreshing the page to see the updated score.

{{< img src="9.png" alt="Debugging Service Fabric Application 2" >}}

Seems like there are negative sentiments associated with my name!! I can live with that. :smile:

## Deploying to Azure

You can use [Service Fabric Party Clusters](http://tryazureservicefabric.eastus.cloudapp.azure.com/) to test your sample and see it in action on Azure. To deploy this sample to Azure, you would only need to change the port of your web application in the configuration located at **TweetAnalytics.Web > PackageRoot > ServiceManifest.xml** to a value that is assigned to you in the cluster invite.

With this application, I have barely scratched the surface of Service Fabric. There are tons of great features such as monitoring, upgrades and event tracing which I haven't covered. Other important tenets of Service Fabric you should explore are [Reliable Actors Applications](https://azure.microsoft.com/en-in/documentation/articles/service-fabric-reliable-actors-introduction/) and [Guest Executable Applications](https://azure.microsoft.com/en-in/documentation/articles/service-fabric-deploy-existing-app/). We have already covered Microsoft Orleans framework in an [earlier post](/post/building-iot-solutions-with-microsoft-orleans-and-microsoft-azure-part-1) which is very similar to the Service Fabric Reliable Actors Service. I encourage you to read that.

I hope you found the post informative and interesting. Please do share the post and send in your suggestions. Thank you!

{{< subscribe >}}
