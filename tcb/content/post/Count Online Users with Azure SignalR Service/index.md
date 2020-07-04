---
title: "Count Online Users with Azure SignalR Service"
date: 2018-08-01
tags:
  - azure
  - web
---

I have been following Dino Esposito's SignalR series from the last few MSDN Magazine editions. In the [May edition of the Magazine](https://msdn.microsoft.com/en-us/magazine/mt846655), Dino talked about the subtle details of ASP.Net Core SignalR. It is an excellent read, and it covers the topic in a much better and concise manner than I will ever be able to describe.

In his [latest article](https://msdn.microsoft.com/magazine/mt847189?MC=Vstudio&MC=WebDev&MC=MobileDev&MC=ASPNET&f=255&MSPPError=-2147217396), Dino discussed the various use cases of SignalR. If you have been watching the Azure space closely, then you must have noticed that a new service named Azure SignalR Service joined the Azure family. I thought of implementing one of the use cases that Dino discussed in the articles using the Azure SignalR Service.

## Azure SignalR Service

Azure SignalR Service sits between your clients and your backend services so that you don't have to implement workarounds for scalability, performance, and availability. If you were to maintain SignalR backend yourself, you would soon run into scalability issues when a large number of persistent WebSocket connections are opened with your application. The Azure SignalR Service sits like a giant computer in front of your backend systems which is capable of maintaining a large number of persistent connections open at all times. The following is the architecture of a simple Azure SignalR Service based system.

{{< img src="1.png" alt="Azure SignalR Service" >}}

Another critical aspect of the architecture is that the backend system need not always be a WebAPI or any other Web Application. You can easily build an Azure Function that communicates with the clients asynchronously. Having the flexibility of choosing the backend systems is helpful in scenarios such as progress monitoring, where a backend system can keep updating the clients on the progress made with the requested operation.

## Application

The application that I built is based on [Dino's article in the MSDN magazine](https://msdn.microsoft.com/magazine/mt847189?MC=Vstudio&MC=WebDev&MC=MobileDev&MC=ASPNET&f=255&MSPPError=-2147217396) on applying SignalR to count the number of active users on a web page. I recommend that you visit the link and read about the use case in detail.

I also referred to the [steps for application setup from MSDN](https://docs.microsoft.com/en-us/azure/azure-signalr/signalr-quickstart-dotnet-core). I recommend that you go through the documentation to understand the steps in detail.

## Code

The code for this application is present in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/UserCount" >}}

## Building The Application

We will start by writing the hub class. Hub is the main point of connection between the server and the client. Clients can invoke functions on the hub, and the hub can invoke functions on the clients. The `Hub` base class which should be inherited by all custom hubs defines some necessary infrastructure to ease development effort. Our hub will increment and decrement a counter value when a client connects and disconnects from the hub respectively.

```CS
public class UserCount : Hub
{
    private static int Count;

    public override Task OnConnectedAsync()
    {
        Count++;
        base.OnConnectedAsync();
        this.Clients.All.SendAsync("updateCount", Count);
        return Task.CompletedTask;
    }

    public override Task OnDisconnectedAsync(Exception exception)
    {
        Count--;
        base.OnDisconnectedAsync(exception);
        this.Clients.All.SendAsync("updateCount", Count);
        return Task.CompletedTask;
    }
}
```

Install the Microsoft.Azure.SignalR nuget package in your application. Now, navigate to the `Startup` class and add the SignalR service in the `ConfigureServices` method using the following code.

```CS
services.AddSignalR().AddAzureSignalR();
```

Next, we need to connect the hub to a path. To do that, add the following code snippet to the `Configure` method in the `Startup` class.

```CS
app.UseAzureSignalR(routes =>
    {
        routes.MapHub<UserCount>("/chat");
    });
```

The code snippets that we added in the `Startup` class will direct all calls from the client to the Azure SignalR Service. The SignalR service will then direct the calls to the hub. Finally, you need to add the SignalR service endpoint as application secret by executing the following command in the same directory as your application's project file.

```BASH
dotnet user-secrets set Azure:SignalR:ConnectionString "Endpoint=<Your endpoint>;AccessKey=<Your access key>;"
```

The client code requires the ASP.net Core SignalR JS library. You can read more about the library and how to use it in your application in [the documentation](https://docs.microsoft.com/en-us/aspnet/core/signalr/javascript-client). Here is the code that interacts with the hub and updates the count of visitors on the web page.

```JS
document.addEventListener('DOMContentLoaded', function () {
    function bindConnectionMessage(connection) {
        var messageCallback = function (message) {
            console.log('message' + message);
            if (!message) return;
            var userCountSpan = document.getElementById('users');
            userCountSpan.innerText = message;
        };
        connection.on("updateCount", messageCallback);
        connection.onclose(onConnectionError);
    }
    function onConnected(connection) {
        console.log('connection started');
    }
    function onConnectionError(error) {
        if (error && error.message) {
            console.error(error.message);
        }
    }
    var connection = new signalR.HubConnectionBuilder().withUrl('/chat').build();
    bindConnectionMessage(connection);
    connection.start()
        .then(function () {
            onConnected(connection);
        })
        .catch(function (error) {
            console.error(error.message);
        });
});
```

## Output

Launch your application and verify the request path in the network tab in the debugger console of your browser. You will find that the client interacts with the Azure SignalR Service instead of your application directly.

{{< img src="2.png" alt="Client Interacts with Azure SignalR Service" >}}

Launch some instances of the application and then close some of them. You will find that the counter value across the instances keeps changing to reflect the number of clients that have an active channel open with the service.

{{< img src="3.gif" alt="ChatR SignalR Output" >}}

## Conclusion

SignalR gives you the ability to add real-time Web functionalities to your applications. The Azure SignalR Service gives you the ability to scale the application backend by providing a fully managed backplane. We saw just one of the implementations of the use cases of the Azure SignalR Service, and you can follow Dino's series on MSDN magazine to know about other use cases of SignalR.

{{< subscribe >}}
