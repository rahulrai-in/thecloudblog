---
title: "Bring Your Own Protocol (BYOP) to Your Azure Service Fabric Applications"
date: 2016-10-25
tags:
 - azure
 - service-fabric
---

Microsoft Azure Service Fabric: There are several reasons to switch to this brand new platform for building distributed systems. For one, Service Fabric can host itself literally anywhere: on your laptop, in your data center, in some else's data center, on Windows, on Linux... If you are still hugging Cloud Services (that thing with web roles and worker roles), you better mend your acts early, it is getting phased out and will become obsolete soon. If you have worked with cloud services, you must be aware of the fact that there are differences in the behaviors of the development emulator and Azure and the issues that arise from those differences are not pretty. Service Fabric ensures delivery consistency by providing you with exactly the same environment on your laptop and in your data center. There is no reason for you to not use Service Fabric in your production applications given that it is now [GA on Azure](https://azure.microsoft.com/en-us/updates/general-availability-azure-service-fabric/) and [Windows Server](https://azure.microsoft.com/en-us/updates/service-fabric-windows-server-ga/).

Since my [last post on Microsoft Azure Service Fabric](/post/hands-on-with-azure-service-fabric-reliable-services/), I have received quite a few questions from the readers of this blog about applying their own communication protocols, such as the various WCF bindings, RPC etc. on their Service Fabric applications. I can see that the MSDN documentation doesn't really do justice to this area, so today we will try to understand how you can apply your protocols on Service Fabric Reliable Services by building a basic sample.

## What are Service Fabric Reliable Services?

We have already discussed about Service Fabric in an earlier [post](/post/hands-on-with-azure-service-fabric-reliable-services/). I encourage you to read that post first in order for this one to make any sense.

Before we discuss about service communication any further, note that there are two kinds of communication that are involved in a Service Fabric application.

1. {{< coloredText color="red" text="Client-Application" bold="true" >}}: The communication channel used by the clients to connect and interact with your Service Fabric Application.
2. {{< coloredText color="red" text="Inter-Replica" bold="true" >}}: The communication channel used by the various replicas of your Microservice to talk to each other to replicate state data. This replication ensures that consistency of state data is maintained, so that when the primary replica goes down, one of the secondary replicas can resume processing without losing state.

Generally, we would want to control the behavior of the {{< coloredText color="red" text="Client-Application" >}} communication channel only. I will show you how you can configure both the communication channels in your Reliable Services.

## Implementing a Communication Stack

Your Service Fabric application can accept requests and respond to clients using various communication protocols. Service Fabric provides a couple of inbuilt communication stacks that you can use, such as the default stack built on RPC proxy, WCF, REST (WebAPI) and HTTP (ASP.net). However, rolling out your own communication stack is quite simple, for which you just need to implement the following in your Microservice:

1. Implement `ICommunicationListener` and handle how your communication channel will open, close and abort.
2. Override the method `CreateServiceInstanceListeners` for stateless service (base class `StatelessService`) and `CreateServiceReplicaListeners` for stateful service (base class `StatefulService`) and return a collection of listeners to the Service Fabric runtime (including your custom listener).
3. Add the desired communication ports to the `ServiceManifest.xml` file of your Microservice.

Once the service is ready, we need to enable the communication on the clients of this Microservice. The clients of this Microservice would first need to resolve the endpoint address of the partition or an instance of the service and then send requests to it. This process involves the following.

1. Use `ServicePartitionResolver` to resolve the address of the replica to which the client wants to connect to. The overrides of the constructor of this class allow the client to connect to multiple clusters.
2. Retrieve the `FabricClient` client object to communicate with the cluster.
3. Handle the headache in lieu of fine-grained control: Your client will need to detect whether the connection attempt failed because of a transient error and can be retried (e.g., the service moved or is temporarily unavailable), or a permanent error (e.g., service was deleted or the requested resource no longer exists). Service instances or replicas can move around from node to node at any time for multiple reasons. The service address that was resolved through `ServicePartitionResolver` may be stale by the time your client code attempts to connect. In that case again the client will need to re-resolve the address.

OR

1. Implement `ICommunicationClientFactory` to generate a `ICommunicationClient` client object that can communicate with your service.
2. Implement `ICommunicationClient` and talk to the service using the resolved endpoint address.
3. Let the framework implement retries and client creation for you.

The majority of applications doesn't need to have fine-grained control over interaction with the application. So, we will use the second option to build a simple application that communicates with the clients using AMQP, which is a custom communication protocol.

## The Sample Application

We are going to build a Service Fabric Application that consists of a single Microservice that communicates with the clients using AMQP. Advanced Message Queuing Protocol ([AMQP](https://en.wikipedia.org/wiki/Advanced_Message_Queuing_Protocol)) is a very popular protocol for device to server and server to server communication in IoT applications. For building the sample, we are going to use a popular AMQP library named [AMQP.Net Lite](https://github.com/Azure/amqpnetlite) which takes care of the protocol and the implementation for us. We are going to use the [{{< coloredText color="red" text="peer-peer" >}} sample](https://github.com/Azure/amqpnetlite/tree/master/Examples/PeerToPeer) to build a server application (a Microservice) and a test client (a console application).

You can download the source code of this sample from here: {{< sourceCode src="https://github.com/rahulrai-in/amqpservice" >}}
We are going to build this sample from scratch (not the [install-tools-and-sdk](https://azure.microsoft.com/en-us/documentation/articles/service-fabric-get-started/) kind of scratch) so that you can follow along. However, I would be leaving out the non essentials bits of code to keep this article directed towards the objective.

### The Server: Service Fabric Application

Bring up your Visual Studio and select **Create**, **New Project** and select **Service Fabric Application**. Name the application **MetricCollector** and click **OK**.

{{< img src="1.png" alt="Create Metrics Collector Project" >}}

In the next dialog, add a new Stateful Microservice to the application and name it **DeviceMetricsCollectorService**.

{{< img src="2.png" alt="Create DeviceMetricsCollectorService" >}}

Let's start implementing the communication stack now. First, install the [AMQP.Net Lite](https://www.nuget.org/packages/AMQPNetLite) nuget package from the nuget library in your project. Next, add a class named `AMQPListener` to the project. We will now implement the `ICommunicationListener` interface in this class. Let's start with implementing the `OpenAsync` method, but before we write some code, I want to take you through a Cluster service called the _Naming Service_.

The _Naming Service_ is a cluster service that runs on every cluster. This service acts like a DNS for your Microservices. Since, in a cluster, your services may be scattered across the nodes, this service will help the clients discover your service. The value returned from the `OpenAsync` method will get registered with the _Naming Service_ and this is the value that the clients will see when they ask for the address of your service from the _Naming Service_.

```CS
public Task<string> OpenAsync(CancellationToken cancellationToken)
{
    var serviceEndpoint = this.context.CodePackageActivationContext.GetEndpoint("AMQPEndpoint");
    var port = serviceEndpoint.Port;
    this.listeningAddress = string.Format(CultureInfo.InvariantCulture, "amqp://guest:guest@+:{0}/{1}/{2}", port, this.context.PartitionId, this.context.ReplicaId);
    this.publishAddress = this.listeningAddress.Replace("+", FabricRuntime.GetNodeContext().IPAddressOrFQDN);
    var addressUri = new Uri(this.publishAddress);
    this.host = new ContainerHost(new[] { addressUri }, null, addressUri.UserInfo);
    this.host.Open();
    var requestProcessor = "request_processor";
    this.host.RegisterRequestProcessor(requestProcessor, new DummyCollector(this.context, this.stateManager));
    return Task.FromResult(this.publishAddress);
}
```

I have simply picked the server code from the AMQP sample and plugged it here. But apart from that, I have retrieved the service endpoint from the _Service Manifest_ (ServiceManifest.xml) and applied it on the `ContainerHost`. I have returned this address back to the Naming Service so that the clients can discover it. You will note that I have appended the partition id and replica id to the listener endpoint. We will see why I did so in a moment. The rest of the method implementations just close and abort the host.

```CS
public void Abort()
{
    this.host.Close();
}
```

```CS
public Task CloseAsync(CancellationToken cancellationToken)
{
    this.host.Close();
    return null;
}
```

The next step is to connect this listener to our Microservice. Navigate to the `DeviceMetricCollectorService` class and add an override of the `CreateServiceReplicaListeners` method (`CreateServiceInstanceListener` for `StatelessService`).

```CS
protected override IEnumerable<ServiceReplicaListener> CreateServiceReplicaListeners()
{
    return new[] { new ServiceReplicaListener(context => new AMQPListener(context, this.StateManager), "AMQPEndpoint") };
}
```

Note that your service can communicate on a number of endpoints. Following is an excerpt from MSDN on this aspect:

In a stateless service, the override returns a collection of `ServiceInstanceListeners`. A `ServiceInstanceListener` contains a function to create an `ICommunicationListener` and gives it a name. For stateful services, the override returns a collection of `ServiceReplicaListeners`. This is slightly different from its stateless counterpart, because a `ServiceReplicaListener` has an option to open an `ICommunicationListener` on secondary replicas. Not only can you use multiple communication listeners in a service, but you can also specify which listeners accept requests on secondary replicas and which ones listen only on primary replicas.

We need only one endpoint on which the service should respond. Moreover, we want this port to be enabled only on the primary node, therefore we won't set the optional parameter `listenOnSecondary` to true.

Lastly, we describe the endpoints that are required for the service in the service manifest under the section on endpoints.

```XML
<Endpoints>
    <Endpoint Name="AMQPEndpoint" Protocol="tcp" Port="5672" />
    <Endpoint Name="ReplicatorEndpoint" />
</Endpoints>
```

> #### Note
>
> Your application replicas might get deployed to the same host and therefore might be listening on the same port e.g. port 5672 in our example. Therefore, your communication listener must support port sharing. Microsoft recommends that your listener listens to traffic on partition ID and replica/instance ID. To support this scenario, I appended partition id and replica id to the service endpoint earlier.

Note that in the above declaration there is an endpoint named `ReplicatorEndpoint` already present. This is a special endpoint that is used by the primary/secondary replicator to communicate with other replicators in the replica set. The `ReplicatorEndpoint` should reference a TCP resource endpoint in the service manifest.

This concludes the implementation of the server. Next, we need to build a client that can talk to our server.

> #### Partitioning and Replication
>
> Although, in any IoT application, partitioning is almost always required, we are not going to focus on service partitioning in this sample. We are not logging and handling errors in the service to keep our discussion brief and focused on the objective.

### The Client: Console Application

Let's quickly bring up a client that can talk to our service. Add a console application to your solution, name it **TestDevice** and set its target platform to **x64**. Let's start by implementing `ICommunicationClient` which will handle the communication for us. Create a class named `MyCommunicationClient` which implements this interface.

```CS
public class MyCommunicationClient : ICommunicationClient
{
	...
}
```

This class will be instantiated by `CommunicationClientFactoryBase`. For clients that don't maintain a persistent connection, such as an HTTP client, the factory only needs to create and return the client. Other protocols that maintain a persistent connection, such as some binary protocols, should also be validated by the factory to determine whether the connection needs to be re-created. We will accept the endpoint on which the client-server communication will take place as a constructor argument.

```CS
public MyCommunicationClient(string resolvedEndpoint)
{
    this.address = resolvedEndpoint;
    this.replyTo = "client-" + Guid.NewGuid();
}
```

The `Setup` method is responsible for establishing a connection with the server. This code is lifted from the AMQP sample and applied here. Nothing fancy here.

```CS
void Setup()
{
    this.connection = new Connection(new Address(this.address));
    this.session = new Session(this.connection);
    var recvAttach = new Attach
        {
            Source = new Source { Address = "request_processor" },
            Target = new Target { Address = this.replyTo }
        };

    this.receiver = new ReceiverLink(this.session, "request-client-receiver", recvAttach, null);
    this.receiver.Start(300);
    this.sender = new SenderLink(this.session, "request-client-sender", "request_processor");
}
```

The `RunOnce` method, which is another method lifted from the AMQP sample, simply sends a request to the server and accepts a response and prints it on the console.

```CS
void RunOnce()
{
    var request = new Message("hello " + this.offset)
        {
            Properties = new Properties { MessageId = "command-request", ReplyTo = this.replyTo },
            ApplicationProperties = new ApplicationProperties { ["offset"] = this.offset }
        };
    this.sender.Send(request, null, null);
    Console.WriteLine($"Sent request {request.Properties} body {request.Body}");

    var response = this.receiver.Receive();
    this.receiver.Accept(response);
    Console.WriteLine($"Received response: {response.Properties} body {response.Body}");
    if ("done" == (string)response.Body)
    {
        return;
    }

    this.offset = (int)response.ApplicationProperties["offset"] + 1;
}
```

To add a bit of error handling in the client, let's add an exception handler which is an implementation of `IExceptionHandler` that is responsible for determining the action to take when an exception occurs:

```CS
class MyExceptionHandler : IExceptionHandler
{
    public bool TryHandleException(ExceptionInformation exceptionInformation, OperationRetrySettings retrySettings, out ExceptionHandlingResult result)
    {
        result = new ExceptionHandlingRetryResult(exceptionInformation.Exception, false, retrySettings, retrySettings.DefaultMaxRetryCount);
        //// Log Error Here.
        return true;
    }
}
```

Finally, let's implement `MyCommunicationClientFactory` which is derived from `CommunicationClientFactoryBase` that instantiates `MyCommunicationClient` and integrates the `IExceptionHandler` implementation in the pipeline.

```CS
public class MyCommunicationClientFactory : CommunicationClientFactoryBase<MyCommunicationClient>
{
    public MyCommunicationClientFactory(
        IServicePartitionResolver resolver = null,
        IEnumerable<IExceptionHandler> additionalHandlers = null)
        : base(resolver, ExceptionHandlerChain(additionalHandlers))
    {
    }

    protected override void AbortClient(MyCommunicationClient client)
    {
    }

    protected override Task<MyCommunicationClient> CreateClientAsync(
        string endpoint,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new MyCommunicationClient(endpoint));
    }

    protected override bool ValidateClient(MyCommunicationClient clientChannel)
    {
        return false;
    }

    protected override bool ValidateClient(string endpoint, MyCommunicationClient client)
    {
        return false;
    }

    private static IEnumerable<IExceptionHandler> ExceptionHandlerChain(
        IEnumerable<IExceptionHandler> additionalHandlers)
    {
        return new[] { new MyExceptionHandler() }.Union(additionalHandlers ?? Enumerable.Empty<IExceptionHandler>());
    }
}
```

We have already implemented all that is required in the client. To tie everything together, in the `Main` method, start the client and let it trigger the flow.

```CS
static void Main(string[] args)
{
    myCommunicationClientFactory = new MyCommunicationClientFactory();
    var partition = new ServicePartitionKey(1);
    var myServicePartitionClient = new ServicePartitionClient<MyCommunicationClient>(myCommunicationClientFactory, myServiceUri, partition);
    Console.WriteLine("Running request client...");
    var result =
        myServicePartitionClient.InvokeWithRetryAsync(client => client.Run(), CancellationToken.None).Result;
    Console.ReadKey();
}
```

Start a new instance of the service and put a breakpoint in the constructor of `MyCommunicationClient`. Once the service is up and running, launch your client in debug mode. Wait for the breakpoint to get hit. Inside the constructor, you would find the endpoint of the primary replica of the service getting automatically resolved.
{{< img src="3.png" alt="Automatic Name Resolution" >}}
Awesome! Now remove the breakpoint and let the client execute. Spend some time watching the client and server talk to each other using AMQP.

> #### Too Intelligent
>
> This client has way more intelligence than a simple sensor can have. In typical IoT scenarios, the sensors interact with a gateway which aggregates their data and sends the aggregated data to the data collector service. This not only saves costs but also helps in data collection while the system is offline. In some scenarios, you may host your gateway in cloud using services such as EventHub or a stateless Service Fabric Reliable Service.

## Output

{{< img src="4.png" alt="Output From The AMQP Device Client" >}}
I know it has been a long read, but I hope it has been valuable and informative to you. I hope you enjoyed working your way through this sample. Let me know about your experience and questions in the comments section below.

{{< subscribe >}}
