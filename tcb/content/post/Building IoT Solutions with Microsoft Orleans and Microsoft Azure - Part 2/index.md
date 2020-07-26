---
title: "Building IoT Solutions with Microsoft Orleans and Microsoft Azure - Part 2"
date: 2015-09-20
tags:
  - azure
  - internet of things
---

Before I start off with the main topic of this post, I would like to let you know that I have added [Microsoft Office 365](https://products.office.com/en-us/business/explore-office-365-for-business) to my arsenal. Earlier, I was not able to respond to your emails with my email id [**rahulrai@rahulrai.in**](mailto:rahulrai@rahulrai.in). However, now this email id has its own inbox and other goodies offered by [MS Office 365](https://products.office.com/en-us/business/explore-office-365-for-business). Say wassup to me any time you want to connect and I would respond!

This is the last article in the series of developing IoT solutions using [Microsoft Orleans](https://dotnet.github.io/orleans/). If you haven’t already read the previous blog post that covers an overview of [Microsoft Orleans](https://dotnet.github.io/orleans/), please read the post [here](/post/building-iot-solutions-with-microsoft-orleans-and-microsoft-azure-part-1). In this post we’ll build a sample using [Microsoft Orleans](https://dotnet.github.io/orleans/) and deploy it to [Microsoft Azure](https://azure.microsoft.com/).

## Source Code

You can download the source code of this experiment from my [GitHub](https://github.com/rahulrai-in) repository located here. {{< sourceCode src="https://github.com/rahulrai-in/orleans" >}}

## Scenario

In about thirty minutes timeframe, we will build a sample that accepts input from your device (a thing connected to internet), aggregates data captured from all devices (including yours) and reports aggregated data to a client system. To make this sample appeal to visual senses, we’ll record color reported by each device, aggregate the data and periodically keep changing the theme of [this site](http://msorleans.cloudapp.net/).

> September 20, 2016: The demo site has been taken down. Please deploy the code on your own cloud service instance.

## Playground

For as long as I can support, you will find the experiment website hosted on Microsoft Azure [here](http://msorleans.cloudapp.net/). I have used the device IP address to uniquely identify a device. Although, in the real world, IoT devices use protocols such as HTTP and AMQP to communicate with services, I have applied a UI wrapper over the Orleans client, to make this experiment more usable. At this point, you should visit [this link](http://msorleans.cloudapp.net/) and select a color from the available color options on the left. Your input will be saved in persistent state storage. After every five seconds a request will be made to Orleans to get the color code stored at an index position. The color, received as response, will be applied to the screen by the server, which is also acting as an Orleans client.

## Points to Learn

Through this sample we will learn about building a grain, storing grain state in a persistent store, grain to grain communication, building a client, testing the microservices (each actor\grain is actually a microservice that is identified using [Single Responsibility Principle](http://www.oodesign.com/single-responsibility-principle.html)) and deploying Orleans infrastructure using [Microsoft Azure Cloud Services](http://azure.microsoft.com/en-in/documentation/services/cloud-services/).

## Solution Overview

Our sample application will follow the architecture presented below:

{{< img src="1.png" alt="Demo Architecture" >}}

1.  An IoT device (your system), identified by its IP address, will make a request (selected color) to the Web Application, which is an Orleans client.
2.  The client will communicate with the Orleans Server over TCP.
3.  Orleans will activate the Decode Grain, a stateless grain, to decode the message sent by the device.
4.  The Decode Grain will request Orleans to activate the Device Grain, a new grain per device, and send data (the color code) to it to persist.
5.  The Device Grain will in turn request Orleans to activate the Aggregator Grain, a grain common to all devices, and send data (the color code and the device IP) to it to be queued.
6.  The client Web Application will keep making requests at specified intervals to Orleans to get the data at the specified queue index location from the Aggregator Grain.

## Rolling Out Orleans Projects

Fire up Visual Studio and create a solution. Next, create the following projects in sequence and add project references as described in the **References** field.

1.  **Name**: **OrleansInterfaces**

    - **Type:** Orleans Grain Interface Collection
    - **Purpose**: This project contains interfaces for the Grains.
    - **References**: None

2.  **Name**: **OrleansClasses**

    - **Type:** Orleans Grain Class Collection
    - **Purpose**: This project contains the actual Grains.
    - **References**: OrleansInterfaces

3.  **Name**: **OrleansTestHost**

    - **Type:** Orleans Dev\Test Host
    - **Purpose**: This projects hosts both the Silo and the client in the same process. It is a console application, which makes it easy to debug.
    - **References**: OrleansClasses, OrleansInterfaces

4.  **Name**: **OrleansCloudService**

    - **Type:** Azure Cloud Service
    - **Purpose**: Cloud Service for deploying Orleans host and client.
    - **References**: N.A

5.  **Name**: **OrleansWorker**

    - **Type:** Worker Role
    - **Purpose**: Worker role for hosting Orleans.
    - **References**: OrleansClasses, OrleansInterfaces

6.  **Name**: **OrleansWebApplication**
    - **Type:** Web Role
    - **Purpose**: Web role for hosting Orleans client.
    - **References**: OrleansInterfaces

Build the solution to restore nuget packages in the solution. On building the solution, Orleans will generate a lot of proxy code for your grains in **orleans.codegen.cs** file, which you can find in the **Properties** folder of **OrleansInterfaces** and **OrleansClasses** projects. Once you have these classes setup, we are now ready to start writing code inside each of these projects. Note that some classes, such as [DTO](https://en.wikipedia.org/wiki/Data_transfer_object) etc., have been left out for the sake of keeping this blog post short. You can find the source code of this experiment on my GitHub repository [here](https://github.com/rahulrai-in/orleans).

## Creating Orleans Grain Interfaces

As discussed earlier, Grain interfaces act as contracts, using which grains can interact with each other and also using which clients can interact with grains. Therefore, each grain needs to implement an interface. We need the following interfaces in our **OrleansInterfaces** project:

- **Decode Grain**: This grain will get messages from clients and decipher the identity of Device Grain that it needs to activate and the input that needs to be provided to that Device Grain. Since we will be identifying a device by its IP and the input would be a color code, therefore this interface defines a single method `DecodeDeviceMessage` with input as a string. We’ll discuss more about this grain when we discuss about its implementation.

```CS
public interface IDecodeGrain : IGrainWithStringKey
{
    Task DecodeDeviceMessage(string ipAndColorMessage);
}
```

- **Device Grain**: This grain will get invoked by the Decode grain. The Decode Grain will invoke the function `SetColor` of this Grain so that it can save the color information in its state. This Grain will further invoke the Aggregator Grain which will save state data of all the Grains.  A Grain can be uniquely identified by several key types such as string, Guid, long etc. Since, we are going to identify this grain with an IP, which is a string, therefore we will extend this interface with `IGrainWithStringKey`.  While we are discussing grain identity, one might want to know why we can’t use objects to identify a grain rather than using an identity. Note that because Orleans is a distributed system, there's a good chance that the Grain isn't on the same machine so we can't use a local variable to act as the reference to the Grain all the time. So instead we use an ID which is similar to a primary key in a relational database. It's a unique ID that we can always use to refer to one particular Grain activation.

```CS
public interface IDeviceGrain : IGrainWithStringKey
{
    Task<string> GetColor();
    Task SetColor(string colorName);
}
```

- **Aggregator Grain**: This grain will get invoked by the Device Grain. The Device Grain will invoke the function `SetColor` of this Grain and supply the color it received as input so that Aggregator Grain can combine the results from all grains. The Aggregator Grain will persist this information in its own state. The method `GetGrainInformation` will be invoked periodically by the client with an index value. On receiving a request for data at a particular index location, the Aggregator Grain will read data from an internal List which it has persisted in its state.

```CS
public interface IAggregatorGrain : IGrainWithStringKey
{
    Task<GrainInformation> GetGrainInformation(int position);
    Task SetColor(GrainInformation grainInformation);
}
```

## Creating Orleans Grain Classes

Now that we have the interfaces ready, we are ready to write concrete implementations of all the Grains. As we proceed, we will discuss some more features of Orleans along the way.

- **Decode Grain**: Every Grain implementation needs to derive from the base class `Grain` and implement its interface. This base class contains the code necessary for activation and deactivation of Grains in addition to other things. As discussed, the Decode Grain needs to decode the message and activate a new grain for every device that makes a request. If all the requests go through a single activation of Decode Grain, there will be a performance bottleneck. The solution to this problem is to make the Decode Grain stateless. A stateless worker can be activated multiple times and can be created in every Silo if found necessary by Orleans. In short, we will let Orleans handle the number of activations that it wants to make of the Decode Grain. We can find another optimization applied here, i.e. Reentrant Grain. We will discuss about Reentrant Grains in detail when we discuss about Device Grain. The implementation of `DecodeDeviceMessage` is pretty simple. The code splits the incoming message into two parts and uses them to find the Device Grain to activate and the color code to pass to it as an argument. We use `GrainFactory`, defined in base class `Grain`, methods to invoke a Grain and pass the ID as an argument.

```CS
[StatelessWorker]
[Reentrant]
public class DecodeGrain : Grain, IDecodeGrain
{
    public Task DecodeDeviceMessage(string ipAndColorMessage)
    {
        var parts = ipAndColorMessage.Split(',');
        //// The following will create a new grain for device or invoke an existing grain for same device.
        var grain = this.GrainFactory.GetGrain<IDeviceGrain>(parts[0]);
        //// No we'll pass color to the grain.
        return grain.SetColor(parts[1]);
    }
}
```

- **Device Grain**: Since the Device Grain needs to persist state, it derives from `Grain<T>` class. The generic type used here is the type of object you want to persist in state. The class of that object should inherit from the class `GrainState`. The `StorageProvider` attribute specifies the name of the provider you want to use for persisting grain information. The mapping between the name and type of persistence provider is specified in the Orleans configuration file. You can build your own persistence provider as well by implementing the `IStorageProvider` interface. As soon as you have added data in state, you should call `WriteStateAsync()` method to have Orleans persist state information to backing store. This grain later invokes Aggregator Grain and invokes `SetColor()` on that grain to make it persist the color information of the grain. Note that we use unique identity of device, i.e. IP address, to invoke a new grain for each device. However, the same identity of  Aggregator Grain, i.e. “aggregator”, is used to invoke the Aggregator Grain so that the same grain activation is used by all the Device Grains. It is a good time to talk about the `Reentrant` attribute at this point. Note that Orleans grains follow a single threaded model, therefore if another request comes to the same grain activation while it is waiting for a task to get completed, the request gets queued. By making a Grain reentrant, you can allow the grain to process messages while it is awaiting for a process to get completed. For instance, here the Device Grain will be able to process messages while it is waiting for the result from the Aggregator Grain.

```CS
[StorageProvider(ProviderName = "AzureStore")]
[Reentrant]
public class DeviceGrain : Grain<DeviceGrainState>, IDeviceGrain
{
    public Task<string> GetColor()
    {
        //// This will get last stored color.
        return Task.FromResult(this.State.Color);
    }

    public async Task SetColor(string colorName)
    {
        //// This will save color to state and persist it to storage on executing WriteStateAsync.
        this.State.Color = colorName;
        await this.WriteStateAsync();
        //// We'll invoke Aggregator grain now so that we can collect all different grain requests.
        var aggregatorGrain = this.GrainFactory.GetGrain<IAggregatorGrain>("aggregator");
        //// Set information that aggregator grain would use.
        var grainInformation = new GrainInformation
            {
                DeviceId = this.GetPrimaryKeyString(),
                Time = DateTime.Now,
                Value = colorName
            };
        await aggregatorGrain.SetColor(grainInformation);
    }
}
```

- **Aggregator Grain**: The code written in Aggregator Grain enables it to read data from state and return the value found at a particular position. Another method saves input received from Device Grain into state. If the same grain activation makes another request, it would only update the data in state.

```CS
[StorageProvider(ProviderName = "AzureStore")]
[Reentrant]
public class AggregatorGrain : Grain<AggregatorGrainState>, IAggregatorGrain
{
    public Task<GrainInformation> GetGrainInformation(int position)
    {
        //// Filter out edge cases.
        if (this.State == null || this.State.GrainInformation.Count == 0 || position < 0 || position > 19)
        {
            return Task.FromResult(new GrainInformation { DeviceId = "No Device", Value = "SKYBLUE", Time = DateTime.Now });
        }

        //// If index is out of range.
        if (position > this.State.GrainInformation.Count - 1)
        {
            return Task.FromResult(this.State.GrainInformation.LastOrDefault());
        }

        return Task.FromResult(this.State.GrainInformation[position]);
    }

    public async Task SetColor(GrainInformation grainInformation)
    {
        //// Initialize state if no record is present.
        if (this.State.GrainInformation == null)
        {
            this.State.GrainInformation = new List<GrainInformation>();
        }

        //// Don't add more than 20 requests in queue. If grain request is already present, delete and add it.
        var existingGrain =
            this.State.GrainInformation.FirstOrDefault(element => element.DeviceId == grainInformation.DeviceId);
        if (null != existingGrain)
        {
            this.State.GrainInformation.Remove(existingGrain);
        }

        this.State.GrainInformation.Add(grainInformation);
        if (this.State.GrainInformation.Count > 20)
        {
            this.State.GrainInformation.RemoveRange(0, this.State.GrainInformation.Count - 20);
        }

        //// Persist state.
        await this.WriteStateAsync();
    }
}
```

## Testing Solution with Dev\Test Host

Now that we have all the building blocks in place, it is time for testing the solution. Move over to the **Program.cs** file in Dev\Test Host Project and find the following text after which you can add your test code.

```CS
// TODO: once the previous call returns, the silo is up and running…
```

Build the solution to update the auto generated code and write the following code below that text to test the code you wrote before.

```CS
//// Test Code Starts
var decodeGrain = GrainClient.GrainFactory.GetGrain<IDecodeGrain>("10.0.0.0");
decodeGrain.DecodeDeviceMessage("10.0.0.0,VIOLET").Wait();

var aggregatorGrain = GrainClient.GrainFactory.GetGrain<IAggregatorGrain>("aggregator");
for (var i = 0; i < 5; i++)
{
    Console.Write("Queue Item {0}: ", i);
    var data = aggregatorGrain.GetGrainInformation(i).Result;
    Console.WriteLine("Device: {0} Value: {1} Time: {2}", data.DeviceId, data.Value, data.Time);
}

decodeGrain = GrainClient.GrainFactory.GetGrain<IDecodeGrain>("10.0.0.1");
decodeGrain.DecodeDeviceMessage("10.0.0.1,RED").Wait();

decodeGrain = GrainClient.GrainFactory.GetGrain<IDecodeGrain>("10.0.0.2");
decodeGrain.DecodeDeviceMessage("10.0.0.2,YELLOW").Wait();

aggregatorGrain = GrainClient.GrainFactory.GetGrain<IAggregatorGrain>("aggregator");
for (var i = 0; i < 5; i++)
{
    Console.Write("Queue Item {0}: ", i);
    var data = aggregatorGrain.GetGrainInformation(i).Result;
    Console.WriteLine("Device: {0} Value: {1} Time: {2}", data.DeviceId, data.Value, data.Time);
}

Console.ReadKey();
//// Test Code Ends
```

Essentially, this block of code invokes the Device Grain and enters some data. The code then queries the Aggregator Grain to get the color codes stored at various index locations. Essentially, this is the same code that we will write in the Orleans Client.

## Creating The Web Client and Worker

- **OrleansWorker**: The following blocks of code start the Silo and block the code from returning. Although you should keep the number of instances as stable as possible, to scale out the solution you can add as many instances as you wish to. This operation is supported because in Azure deployment all the workers are secondary and they get information about the presence of other Grains from the Azure Storage. A point worth remembering is to add references to Grain Interfaces and Grain Classes. If you don’t do so, the worker won’t raise any errors, but would fail when you make any requests to it.

```CS
public override bool OnStart()
{
    this.cloudSilo = new AzureSilo();
    var success = this.cloudSilo.Start();
    return success;
}

public override void OnStop()
{
    Trace.TraceInformation("OrleansWorker is stopping");
    this.cancellationTokenSource.Cancel();
    this.runCompleteEvent.WaitOne();
    base.OnStop();
    Trace.TraceInformation("OrleansWorker has stopped");
}

public override void Run()
{
    this.cloudSilo.Run();
}
```

- **OrleansWebApplication**: The web application acts as Orleans client and essentially contains the same code as we wrote in the test application. The following is a sample of code that I wrote in `ActivateDeviceGrain` method. This method invokes the Decode Grain and passes the input as argument.

```CS
[HttpGet]
public async Task ActivateDeviceGrain(string color)
{
    if (!AzureClient.IsInitialized)
    {
        AzureClient.Initialize(this.Server.MapPath("~/AzureClientConfiguration.xml"));
    }

    var ipAddress = Routines.GetIPAddress();
    var decodeGrain = GrainClient.GrainFactory.GetGrain<IDecodeGrain>(ipAddress);
    await decodeGrain.DecodeDeviceMessage(string.Format("{0},{1}", ipAddress, color));
}
```

## Deploying Orleans Infrastructure on Microsoft Azure

To deploy the infrastructure, we need to configure the Web and Worker roles. In both the Web and Worker roles, add the setting “DataConnectionString” with connection string of Azure table storage which you want to use.

{{< img src="2.png" alt="CloudConfigurationSettings" >}}

The cloud worker role needs endpoints to communicate with the client and with other instances. The communication happens over TCP and requires only internal endpoints, thereby ensuring security of the solution. Specify an endpoint named **OrleansSiloEndpoint** with port 11111 for enabling inter grain communication. Specify another endpoint named **OrleansProxyEndpoint** with port 30000 for enabling communication between Clients and Orleans.

{{< img src="3.png" alt="CloudConfigurationEndpoint" >}}

A configuration file named **OrleansConfiguration** needs to be added to the Worker Role project to help Orleans know the storage account it can use to store and read the state data and also specify the Liveness type. You can find the configuration file that is used in the experiment [here](https://github.com/rahulrai-in/orleans/blob/master/OrleansWorker/OrleansConfiguration.xml).

Add the other classes and MVC view to see the experiment in action. You are now all set to deploy the solution to Microsoft Azure. Hit publish and see the magic for yourself (or run it on local emulator)!

## Experiment Screenshots

Following are the screenshots of the experiment. This screen shows the result of a call made to the Aggregator Grain for retrieving data at a specific index location.

{{< img src="4.png" alt="Working Experiment Screen" >}}

This screenshot shows the result of making a call to the Device Grain to register a new color input.

{{< img src="5.png" alt="Saved Grain State" >}}

It was fun working on this experiment and sharing the results with you. Do post your comments below. See you in another post!!

{{< subscribe >}}
