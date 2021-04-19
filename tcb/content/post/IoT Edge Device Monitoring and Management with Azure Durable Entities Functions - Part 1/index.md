---
title: "IoT Edge Device Monitoring and Management with Azure Durable Entities Functions - Part 1"
date: 2019-07-01
tags:
  - azure
  - internet-of-things
  - compute
comment_id: 3271fbd0-f30b-429f-9d80-0cf4f0fbfec2
---

> In this series
>
> 1. [IoT Edge Application](/post/iot-edge-device-monitoring-and-management-with-azure-durable-entities-functions-part-1/)
> 2. [Azure Durable Entities Function](/post/iot-edge-device-monitoring-and-management-with-azure-durable-entities-functions-part-2/)

IoT systems involve many devices, each of which maintains a small internal state. The [Actor Model](https://en.wikipedia.org/wiki/Actor_model) is a good fit for representing IoT devices in the cloud because of its inherent fault tolerance, concurrency controls, performance, and scalability. I wrote about the Actor Model and Orleans (virtual actor based implementation) in one of my previous articles [here](/post/building-iot-solutions-with-microsoft-orleans-and-microsoft-azure-part-1/).

In a nutshell, the Actor Model uses a unit of computation known as the **Actor**. An Actor can receive messages from other Actors, perform operations on itself, manage its state and send messages to other Actors.

## Actor Model and IoT

IoT systems are highly concurrent as they generate a high volume of telemetry and require constant monitoring and management. The Actor model frameworks such as [Akka.net](https://getakka.net/) or [Orleans](https://dotnet.github.io/orleans/) automatically manage the multiple threads used to manage the different devices. The Actor model frameworks shift the concurrency problem to infrastructure because of which with an increase in the number of IoT devices, one can scale out the cluster so that the framework can handle the increased demand.

The Actor model also decouples the device representation from the underlying communication protocol. With the abstraction between the device, the device state persistence, and communication, developers are not required to implement the best practices for fault-tolerant persistence and communication as these concerns are handled by the framework itself.

One of the typical implementations of the Actor model in IoT is to represent a physical device as an Actor instance in the cloud. When a device transmits telemetry to the cloud, the Actor instance for the corresponding device receives it and updates its state. With a bi-directional communication channel, the Actor can also send commands and configurations to the physical device.

For scenarios that require aggregation of data from individual devices to decide and action, Actors can form a supervisor-worker hierarchy. The supervisor Actors can further form a hierarchy as well to aggregate data at an even higher level.

## Actors In Azure Functions

Azure Durable Functions now support a new [stateful entity pattern](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-preview) named **Durable Entities**. Just like Actors, the Durable Entities can preserve state and activate only when invoked, a feature it has borrowed from the virtual Actors in Orleans. Just as Actors, we can an identifier known as the _entity id_ to access Durable Entities. Most significantly, operations in Durable Entities execute sequentially. This Actor Model like feature helps prevent race conditions, which is a significant advantage of the Actor Model.

## Scenario

With the availability of Durable Entities, now is an excellent time to explore how we can use it for IoT device monitoring and management. We will build a simple IoT Edge application that sends telemetry to IoT Hub and an Azure Durable Entity function that monitors the incoming stream of data. Using the aggregated data, when the function detects a problem with the device, it issues alerts and takes corrective measures if human intervention is not applied in the stipulated time. The following is the high-level design of the application.

{{< img src="1.png" alt="Device Management and Monitoring" >}}

The IoT Edge application that we will build today will simulate temperature data from a Boiler installation. The Azure Function will use Slack as a medium to trigger alerts to users. Following are the salient features of the application:

1. Streaming IoT Edge Telemetry to IoT Hub.
2. Durable Function IoT Hub Trigger to ingest and process data.
3. Invoking Direct Methods on IoT Edge from IoT Hub through Azure Functions.
4. Durable Functions and Slack integration.
5. Durable Entities in Durable Functions to process telemetry, send alerts, and issue device commands.
6. Durable Function orchestrators and triggers.

In this article, we will build and test the IoT Edge component of the application.

## Source Code

The source code of the application is available on my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/MeltingBoiler" >}}

The repository comprises three applications organized using the following folder structure.

1. **edge**: This folder contains the IoT Edge application that generates telemetry and handles C2D commands.
2. **generator**: This folder contains a simple console application that can test the IoT Edge application.
3. **function**: This folder contains the Azure Function, which reacts to the telemetry that it receives from IoT Hub by issuing commands to IoT Edge application.

## Setup

We will only need an instance of IoT Hub to build and debug an IoT Edge solution. To create an IoT Hub instance, execute the following Azure CLI commands in your local or cloud terminal.

```shell
az group create --name {your resource group name} --location westus
az iot hub create --name {your iot hub name} --resource-group {your resource group name} --sku S1
```

After ensuring that your IoT Hub instance is up and running, execute the following command to create a new device identity for your IoT Edge device.

```shell
az iot hub device-identity create --device-id myboilercontroller --hub-name {iot hub name} --edge-enabled
```

You can now login to the Azure portal and locate your device in the IoT Hub > IoT Edge blade.

{{< img src="2.png" alt="Device Identity in IoT Hub" >}}

Create an Azure Container Registry instance as well if you wish to deploy your IoT Edge solution to an actual device. However, this step is unnecessary for debugging your IoT Edge solution in development environment.

We are now ready to build our IoT Edge application that will simulate temperature telemetry.

## IoT Edge Application

I wrote an [article on IoT Edge](/post/building-applications-with-azure-iot-edge/) to show how you can link the various edge modules together to create a data transformation workflow. This time, I will create a simple module that artificially generates telemetry and sends it to IoT Hub straight away.

The setup of IoT Edge is a little complex. I recommend that you follow the steps outlined in the [official documentation](https://docs.microsoft.com/en-us/azure/iot-edge/how-to-vs-code-develop-module) to set up the Visual Studio Code and your development environment.

After you have set up your system, use the steps in the guide to create a new IoT Edge solution and use the command **Azure IoT Edge: Add IoT Edge Module** to add a new module named **controller** to the solution. Before we add any code to the solution, we need to remove the default module named **tempSensor** that was added to the solution by the template and change the route defined in the **deployment.template.json** (used for release) and **deployment.debug.template.json** (used for debugging) files. The default behavior of the **tempSensor** module is to generate random telemetry data and transfer it to the custom module that we just created. Update the contents of the **deployment.debug.template.json** file to the following code listing.

```json
{
  "$schema-template": "2.0.0",
  "modulesContent": {
    "$edgeAgent": {
      "properties.desired": {
        "schemaVersion": "1.0",
        "runtime": {
          "type": "docker",
          "settings": {
            "minDockerVersion": "v1.25",
            "loggingOptions": "",
            "registryCredentials": {
              "meltingboilercr": {
                "username": "$CONTAINER_REGISTRY_USERNAME_meltingboilercr",
                "password": "$CONTAINER_REGISTRY_PASSWORD_meltingboilercr",
                "address": "meltingboilercr.azurecr.io"
              }
            }
          }
        },
        "systemModules": {
          "edgeAgent": {
            "type": "docker",
            "settings": {
              "image": "mcr.microsoft.com/azureiotedge-agent:1.0",
              "createOptions": {}
            }
          },
          "edgeHub": {
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "mcr.microsoft.com/azureiotedge-hub:1.0",
              "createOptions": {
                "HostConfig": {
                  "PortBindings": {
                    "5671/tcp": [
                      {
                        "HostPort": "5671"
                      }
                    ],
                    "8883/tcp": [
                      {
                        "HostPort": "8883"
                      }
                    ],
                    "443/tcp": [
                      {
                        "HostPort": "443"
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        "modules": {
          "controller": {
            "version": "1.0",
            "type": "docker",
            "status": "running",
            "restartPolicy": "always",
            "settings": {
              "image": "${MODULES.controller.debug}",
              "createOptions": {}
            }
          }
        }
      }
    },
    "$edgeHub": {
      "properties.desired": {
        "schemaVersion": "1.0",
        "routes": {
          "controllerToIoTHub": "FROM /messages/modules/controller/outputs/* INTO $upstream"
        },
        "storeAndForwardConfiguration": {
          "timeToLiveSecs": 7200
        }
      }
    }
  }
}
```

In the previous code listing, we defined the container image that the runtime should use to create our module. In the `routes` section of the template, we defined the rule that any data that our module emits on any output target (outputs/\*) should be sent to IoT Hub (upstream).

Let's now navigate to the **Program.cs** file in the **modules/controller** folder. Leave the default code that sets the behavior of cancellation token as it is. We will now change the code defined in the `Init` function to define a Direct Command handler and an asynchronous process that generates data as per the command sent by the client. Replace the code in the `Init` function with the code in the following code listing.

```c#
static async Task Init()
{
    var amqpTransportSettings = new AmqpTransportSettings(TransportType.Amqp_Tcp_Only);
    ITransportSettings[] settings = { amqpTransportSettings };

    // Open a connection to the Edge runtime
    ModuleClient ioTHubModuleClient = await ModuleClient.CreateFromEnvironmentAsync(settings);
    await ioTHubModuleClient.OpenAsync();
    Console.WriteLine("IoT Hub module client initialized.");

    // monitor connection
    ioTHubModuleClient.SetConnectionStatusChangesHandler((status, reason) =>
    {
        Console.WriteLine(status);
        Console.WriteLine(reason);
    });

    // Register callback to be called when a message is received by the module
    await ioTHubModuleClient.SetMethodHandlerAsync("command", CommandHandler, ioTHubModuleClient);
    await PublishMessages(ioTHubModuleClient);
}
```

The first two statements in the previous code listing define the communication protocol that IoT Hub can use to communicate with the module. The next two statements initialize the module and connect it to the local IoT Edge runtime to send and receive messages.

The `SetMethodHandlerAsync` function defines the command handler that will be invoked when a command named **command** is sent to the module. We will use this command to define the range in which the controller module should generate the temperature telemetry.

The `PublishMessage` function is an infinitely running routine that generates temperature telemetry in a stepwise manner and sends the event to the device hub. Since we have instructed the device hub to publish all messages from the module output to IoT Hub, it sends the data to the IoT Hub.

Let's write the `CommandHandler` function that will set the temperature thresholds and send the operation completion signal back to the client.

```c#
private static async Task<MethodResponse> CommandHandler(MethodRequest methodRequest, object userContext)
{
    var moduleClient = userContext as ModuleClient;
    if (moduleClient == null)
    {
        throw new InvalidOperationException(nameof(userContext));
    }

    var cmdArg = JsonConvert.DeserializeObject<CommandArgument>(methodRequest.DataAsJson);
    switch (cmdArg.Command.ToLowerInvariant())
    {
        case "normal":
            minTemperature = 100;
            maxTemperature = 700;
            break;
        case "critical":
            minTemperature = 800;
            maxTemperature = 900;
            break;
        case "melt":
            minTemperature = 1000;
            maxTemperature = 1500;
            break;
        case "shutdown":
            minTemperature = 0;
            maxTemperature = 20;
            break;
    }

    isReset = true;
    var methodResponse = new MethodResponse(Encoding.UTF8.GetBytes("{\"status\": \"ok\"}"), 200);
    return await Task.FromResult(methodResponse);
}
```

The `PublishMessages` function contains the logic to generate telemetry. I recommend that you go through the code in the repository to understand it. An inner function named `SendMessage` composes the message and sends it to the output target.

```c#
async Task SendMessage()
{
    var temperatureValue = new { CurrentTemperature = counter };
    var message = new Message(Encoding.ASCII.GetBytes(JsonConvert.SerializeObject(temperatureValue)));
    message.Properties.Add("Time", DateTime.UtcNow.Ticks.ToString());
    await moduleClient.SendEventAsync("output1", message);
    Console.WriteLine($"Sent Message: {JsonConvert.SerializeObject(temperatureValue)}");
}
```

Your IoT Edge application is now complete. To execute this application, you would need to set up the IoT Edge simulator and then right-click the **deployment.debug.template.json** file and select the option **Build and Run IoT Edge solution in Simulator** from the context menu. Refer to the MSDN link that I mentioned earlier to ensure that you do these steps correctly. Start the IoT Edge application and wait for it to generate data. In the VS Code terminal window, you can observe the data that the application sends to the hub.

{{< img src="3.gif" alt="IoT Edge Application Generating Telemetry" >}}

Before we build the test client for this application, let's discuss IoT Edge Module Direct Methods.

## IoT Edge Module Direct Methods

IoT Hub provides the ability to carry out a request-response interaction with a single device or a group of devices. Device management capabilities require immediate confirmation of commands issued to the device. To invoke a direct method, the client will make an HTTP call to the IoT Hub, and the device will receive a message through an MQTT topic or through an AMQP link. In our example, if the sensors report critical temperatures, the system will issue a command to shut down the boiler. You can read more about Direct Methods in IoT Hub on the [official documentation](https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-devguide-direct-methods).

Let’s now build a simple console application that will help us send Direct Commands to our custom module.

## Building The Test Data Generator

The **Generator** application will invoke the direct method on the edge device. As we saw earlier, our device understands four commands, each of which sets an upper and lower threshold between which the device generates telemetry. Create a simple dotnet core console application and add the following code to the class `Program`.

```c#
static async Task Main()
{
    var config = new ConfigurationBuilder().AddJsonFile("appsettings.json", true, true).Build();
    while (true)
    {
        try
        {
            Console.WriteLine("Enter a command: normal, critical, melt, shutdown");
            var command = Console.ReadLine();
            var serviceClient = ServiceClient.CreateFromConnectionString(config["DeviceConnectionString"]);
            var cloudToDeviceMethod = new CloudToDeviceMethod("command")
            {
                ConnectionTimeout = TimeSpan.FromSeconds(5),
                ResponseTimeout = TimeSpan.FromSeconds(5)
            };
            cloudToDeviceMethod.SetPayloadJson(JsonConvert.SerializeObject(new { command = command }));
            var response = await serviceClient.InvokeDeviceMethodAsync("myboilercontroller", "controller", cloudToDeviceMethod);
            var jsonResult = response.GetPayloadAsJson();
            Console.WriteLine(jsonResult);
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
        }
    }
}
```

The application runs in an infinite loop and accepts one command at a time from the user. The application uses the device connection string to make a direct method call over HTTP with a JSON payload. To get the device connection string, navigate to your IoT Hub instance, and select **IoT Edge** from the menu. Click on your device to navigate to the device details blade. This blade will show you the device connection string that the clients can use to communicate with the device.

{{< img src="4.png" alt="Device Connection String" >}}

Copy the connection string and paste it as the value of the **DeviceConnectionString** property in the **appSettings** file of the **Generator** application. To test the various commands that the application supports, ensure that the **IoT Edge** application is running and start an instance of the **Generator** application. Enter one of the supported commands and press enter. You should be able to see the application receive almost immediate feedback from the direct method and the Edge module subsequently reacting to the command by altering the telemetry produced.

{{< img src="5.gif" alt="Testing IoT Edge Direct Methods.gif" >}}

In the previous image, you can observe that the Edge module changes the telemetry from normal to melt when I invoked the direct method with the argument value `melt`. Next, the module altered the range of telemetry from melting to shut down when I invoked the direct method with the argument value `shutdown`.

In the next instalment of this series, I will cover how you can use Durable Functions to monitor and react to telemetry generated by IoT Edge. I am excited to show you how easily all these pieces of tech tie together. If you have questions, please let me know in the comments section below.

{{< subscribe >}}
