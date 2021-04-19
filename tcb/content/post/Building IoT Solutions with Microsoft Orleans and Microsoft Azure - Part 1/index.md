---
title: "Building IoT Solutions with Microsoft Orleans and Microsoft Azure - Part 1"
date: 2015-09-15
tags:
  - azure
  - internet of things
comment_id: 6b0d2986-fb71-438a-966f-c3a47d60aacb
---

In this **two-part series** I will walk you through building an IOT solution on [Microsoft Azure](https://azure.microsoft.com/) using [Microsoft Orleans](https://dotnet.github.io/orleans/). The first part is an overview of Microsoft Orleans while the second part will cover building a simple application on [Microsoft Orleans](https://dotnet.github.io/orleans/) and deploying it to [Microsoft Azure](https://azure.microsoft.com/).

Lately, I was involved in training a bunch of my colleagues on the [Microsoft Orleans](https://dotnet.github.io/orleans/) framework. [Microsoft Orleans](https://dotnet.github.io/orleans/) is a framework that provides a straightforward approach to building distributed high-scale computing applications, without the need to learn and apply complex concurrency or other scaling patterns. Typically we use [SOA](https://msdn.microsoft.com/en-in/library/bb833022.aspx) to build systems that can scale. To find the issues that SOA can’t address, let’s take an example of building an eCommerce website. Let’s say you have built services corresponding to the functionalities provided by your portal e.g. shopping cart, catalog, payments, etc. Your site is ready in time for the cricket world cup and a lot of people start checking out T-Shirts of teams they are rooting for. In order to cater to this increased load in the most efficient way possible, you partition the catalogue by type, e.g. clothing and further by clothing type, e.g. T-Shirts and scale out only the clothing catalogue service. This change will consume some effort, but everything will keep working fine. Next, as team India moves to finals, fans start browsing through the Indian team T-Shirts catalogue. You again alter the system design to apply further refactoring. This approach is not only time consuming, but also requires experienced developers and architects who can ensure that system integrity is not endangered by design changes. [Microsoft Orleans](https://dotnet.github.io/orleans/) provides answers to a lot of these problems by taking the complexity of building a high scale system and baking it into a framework which is easy for developers to use.

A scenario that is a prime candidate for application of Microsoft Orleans is [Internet of Things](https://en.wikipedia.org/wiki/Internet_of_Things) or IoT. IoT systems should be able to handle higher throughput, respond in almost real time, with high availability and achieve all this with the scalability and economics of Cloud Computing. Let us first see what Microsoft Orleans is.

## What is Microsoft Orleans?

Microsoft Orleans is a framework for building software, which runs across a number of machines in such a way that the machines cooperate and act as one large computer. We call this a [distributed system](https://en.wikipedia.org/wiki/Distributed_computing). Microsoft Orleans is designed to run in the Cloud, in particular Microsoft Azure, but you can also run it on-premise. Microsoft Orleans is a .NET implementation of the Actor Model, a mathematical model for concurrent computing conceived in the 1970s. Orleans simplifies the building of high scale, high availability, low latency concurrent systems, making it easy for you as a developer to build a distributed system. The program model itself is simple, it takes away the concurrency concerns such as thread locking and synchronization by providing a single threaded program model and it's designed to run in the Cloud, which makes it easy to scale up and scale down and it also handles other complexities for you.

## What is Actor Model?

Wikipedia has a great introductory article on the [Actor Model](https://en.wikipedia.org/wiki/Actor_model). For the sake of simplicity, think of Actors in Orleans as regular objects which can interact with each other through asynchronous message passing. Actors in Orleans are called Grains. Messages are represented by special methods on the .NET interface for a Grain type. The methods are regular .NET functions, except that they must return a promise, which is a construct that represents a value that will become available at some future time. Grains are single-threaded and process messages one at a time, so that developers do not need to deal with locking or other concurrency issues. However, unlike Actors implemented on other platforms, the Actors in Orleans are virtual. The Orleans runtime manages the location and activation of Grains similarly to the way that the virtual memory manager of an operating system manages memory pages: it activates a Grain by creating an in-memory copy (an activation) on a server, and later it may deactivate that activation if it hasn't been used for some time. If a message is sent to the Grain and there is no activation on any server, then the runtime will pick a location and create a new activation there.

Orleans runs something called a Silo in each machine. Within the Silo, a Grain is activated, Orleans typically reactivates a Grain for every device that connects. The Grain may collect information it needs throughout the systems, perhaps it needs to load some prior knowledge about the device from an external database, then it could respond back to the device, or call another system if there's an alert that needs to be raised. The Grain may also talk to other Grains. The Grains may be in the same Silo, or in a different one. To the Grain, machine boundaries are totally transparent. When a request is complete the Grain remains in memory, the Silo is responsible for deactivating it when it deems necessary. This could be because it stopped receiving requests and there's now need to make space for more Grains. In fact, the Silo can handle hundreds of thousands of Grains, which activates and deactivates when needed. By keeping Grains activated we're able to respond very quickly to requests as all the required information is already kept in memory. We're also able to scale out Orleans to add more and more servers and Silos into the system. These two things combined allow us to respond to very high levels of throughput.

## Basic Concepts

The Grain (or Actor) is implemented as a C# class. The code inside the Grain runs in a single thread and should be asynchronous. Communication between Grains is always via asynchronous message passing. Because the code inside a Grain is single threaded, if two messages are received at the same time they must take turns, therefore there's a queue for each Grain which builds up with messages for it. The one thing that a Grain can't do is access shared state, so it cannot access another Grain’s properties directly. If it wishes to know the value of property inside another Grain it must ask it via the asynchronous message passing technique. Through these limitations we can build a system which doesn't have a concurrency or thread locking concerns, as there will never be a case where there are two competing threads trying to access the same variable at the same time. Silo's role is to host Grains and activate and deactivate them at the right times. The Silo itself is a .NET DLL and can be started as a process on the command line or hosted in a worker role in Azure. Silos are designed to work together, we call that a Cluster.

In the diagram below you can see how different devices can activate their own Grains. A Grain can communicate with other Grains, both within and across the Silos, through asynchronous message passing.

{{< img src="1.png" alt="Orleans Framework" >}}

## Getting Started

Microsoft Orleans is available for [download from here](http://aka.ms/orleans). The installation will add templates for Orleans development in your Visual Studio IDE. Following are what the various templates are required for:

1.  **Grain Interface Collection**: A Grain implements one or more Grain interfaces. Grains can interact with each other by invoking methods declared as part of the respective Grain interfaces. All methods of a Grain interface are required to be asynchronous i.e. their return types have to be `Task`.
2.  **Grain Class Collection**: A Grain type is materialized by a class that implements the Grain type’s interface (above) and inherits directly or indirectly from `Orleans.Grain`.
3.  **Dev/Test Host**: This template creates a console app with an Orleans Silo for development purposes. Silos are containers of Grains, potentially millions of Grains in a single Silo. Typically, you will run one Silo per machine.

Each of these projects gets built into a different DLL: the interface needs to be available on both the "client" and "server" sides, while the implementation class should be hidden from the client, and the client class from the server.

## Grain State Persistence

Grains can store state information beyond their lifetime. This feature is helpful for restoring state information when a Grain is reactivated. How a Grain stores state data is governed by how it is declared. Grain types can be declared in one of the two ways:

- Extend `Grain` if they do not have any persistent state, or if they will handle all persistent state themselves, or
- Extend `Grain<T>` if they have some persistent state that they want the Orleans runtime to handle. Stated another way, by extending `Grain<T>` a Grain type is automatically opted-in to the Orleans system managed persistence framework.

Grain classes that inherit from `Grain<T>` (where `T` is an application-specific state data type derived from `IGrainState`) will have their state loaded automatically from a specified storage. Grains will be marked with a `[StorageProvider]` attribute that specifies a named instance of a storage provider to use for reading/writing the state data for this Grain.

```c#
[StorageProvider(ProviderName="store1")]
public class MyGrain<IMyGrainState> ...
{
  ...
}
```

The Grain’s state is available through the `Grain<T>.State` property. After making any appropriate changes to the Grain’s in-memory state, the Grain should call the `Grain<T>.State.WriteStateAsync()` method to write the changes to the persistent store. The Orleans Provider Manager framework provides a mechanism to specify & register different storage providers and storage options in the Silo config file.

```xml
<StorageProviders>
   <Provider Type="Orleans.Storage.DevStorage" Name="DevStore" />
   <Provider Type="Orleans.Storage.AzureTableStorage" Name="store1"
      DataConnectionString="DefaultEndpointsProtocol=https;AccountName=data1;AccountKey=SOMETHING1" />
   <Provider Type="Orleans.Storage.AzureTableStorage" Name="store2"
     DataConnectionString="DefaultEndpointsProtocol=https;AccountName=data2;AccountKey=SOMETHING2"  />
</StorageProviders>
```

## Other Concepts

1. **Stateless Worker**: Stateless workers can be activated multiple times in each Silo by automatically scaling up and down according to the incoming demand. Orleans does this by inspecting the queue size of each stateless worker in the Silo and it will create a new activation if there are no stateless workers with empty queues. If a stateless worker is requested from another Grain inside the Orleans Silo, then it will be activated in the same Silo, thus removing the network hops. Therefore, requests to a stateless worker will never need to go across the network.
2. **Reentrant Grain**: Marking a Grain as reentrant basically enables the Grain to accept requests while it is awaiting an operation to get completed. This is a feature that must be used carefully, as you could have a situation where when you return from the awaiting operation, the internal state of the Grain is not as you left it and if you're relying on the state not changing, you could have a problem.
3. **Timers and Reminders**: **Timers** are used to create periodic Grain behavior that isn't required to span multiple activations (instantiations of the Grain). It is essentially identical to the standard .**NET System.Threading.Timer** class. In addition, it is subject to single threaded execution guarantees within the Grain activation that it operates. **Reminders** are similar to timers with a few important differences. Reminders are persistent and will continue to trigger in all situations (including partial or full cluster restarts) unless explicitly cancelled. Reminders are associated with a Grain, not any specific activation.

## Next Steps

In the second part of this series, we will build a small sample in which we will use most of the concepts covered above and deploy it to [Microsoft Azure](https://azure.microsoft.com/).

## Credits

- [Orleans GitHub Site](https://dotnet.github.io/orleans/)

- [Pluralsight](http://www.pluralsight.com/courses/microsoft-orleans-introduction)

> The second part of this series is available [here](/post/building-iot-solutions-with-microsoft-orleans-and-microsoft-azure-part-2) > {{< subscribe >}}
