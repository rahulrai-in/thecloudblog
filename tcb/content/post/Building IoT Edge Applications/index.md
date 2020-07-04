---
title: "Building Applications with Azure IoT Edge"
date: 2018-04-25
tags:
  - azure
  - internet-of-things
---

I recently presented a session on building applications with [Azure IoT Edge](https://azure.microsoft.com/en-gb/services/iot-edge/) at the [Global Azure Bootcamp, Sydney](https://global.azurebootcamp.net/locations/australia-sydney-2/). In the field of IoT, edge analytics is not just important; it is a necessity. Azure IoT Edge solves a lot of edge analytics challenges in a unique manner that many organizations face. Azure IoT Edge brings the power of essential cloud services from the cloud to your on-premise devices. You can deploy either Azure service logic or your code to devices from the cloud interface without physically accessing the device. There are several capabilities that Azure IoT Edge offers such as offline access, error retries, etc. which make it very compelling for organizations to adopt.

## The Event

Here are a few of the pictures from my session that some awesome folks clicked. You can find other photos of the event [here](https://www.meetup.com/Azure-Sydney-User-Group/events/248907098/). If you are in Sydney, Simon Waight (twitter: [@simonwaight](https://twitter.com/simonwaight)) is the guy who runs the Azure Sydney User Group (twitter: [@azuresydneyug](https://twitter.com/AzureSydneyUG)). You can follow him and the user group channel on Twitter, to be in the loop. If they are feeling generous, sometimes they give out stuff such as XBox at their events (at least they did in the Bootcamp)!

{{< img src="1.jpg" alt="Speaker Session" >}}

Of course, no presentation is complete without a slide deck. You can download the PowerPoint slides that I used in the session from SlideShare by clicking [this link](https://www.slideshare.net/moonytheloony/building-apps-with-azure-iot-edge).

{{< slideshare src="pw3ZLUqQQCp2qC" >}}

## (Re)Building The Demo Application

I wasn't able to cover everything in sufficient detail in the session due to time constraints, so I will go through all the steps that I took to build the application that I demonstrated in the event. I would not be covering what Azure IoT Edge is or what its features are in this post. Feel free to post your comments below if you feel that there is something you can't understand or your feedback in general. Let's start with the scenario that I used for building the application.

## Scenario

[Santa Maria](<https://en.wikipedia.org/wiki/Santa_Mar%C3%ADa_(ship)>) was a ship used by Christopher Columbus in his first voyage. The ship no longer exists, and since it was torn down to construct a palace, you won't even be able to recognize it in whatever form it is in today. Let's assume ourselves as the engineers of the ship who are tasked with monitoring of the components. We have been instructed to add sensors to the boilers and surface the device data in such a way that the crew on the ship and land can view alerts from the boilers in real time. To avoid, transmitting a lot of data to the cloud and to prevent persisting an overwhelming amount of data, we will persist only the data that crosses a certain temperature threshold. We will also mark the data as High Temperature or Melting Point depending on which threshold the temperature data has crossed.

## Logical Design Diagram

We will build the demo application using the following Logical Design Diagram which shows all the components and their linkages.

{{< img src="2.png" alt="Santa Maria LDD" >}}

We will use a simulated device to get the values to process in our system. Microsoft has built a [temperature simulator](https://github.com/Azure/iot-edge/tree/master/v2/samples/azureiotedge-simulated-temperature-sensor) that we will use for this purpose. In Azure IoT Edge we will have two modules to process the incoming data. The first module in the pipeline is the **Filter Module** which is a custom C# module. This module will remove all the values below a certain threshold and pass the rest of the values to the next module in the pipeline. The next module in the pipeline is the **Flag Function** which is an Azure Function module. Azure IoT Edge supports running Azure Functions on edge devices so that you can bring your existing logic to edge without altering its functionality. In our scenario, the function will mark the incoming records as either a _High Temperature_ record or a _Melting Point_ record based on the threshold limits that we will set in the module.

The output of the **Flag Function** will be sent to the IoT Hub by the Edge Runtime. To demonstrate that we are receiving data in the IoT Hub, we have a Stream Analytics job processing the incoming data in real-time. A simple pass-through query takes all the data available in IoT Hub and sends it to a PowerBI dataset. We will create a simple dashboard in PowerBI to display the records in the dataset.

## Source Code

You can download the source code of the demo application from my GitHub repository. {{< sourceCode src="https://github.com/rahulrai-in/ShipBoilerModules">}}

## Installation and Setup

You would need to install a couple of tools to start building IoT Edge applications. I recommend that you follow the [prerequisites of this guide](https://docs.microsoft.com/en-us/azure/iot-edge/quickstart) to prepare your system, and the [prerequisites of this guide](https://docs.microsoft.com/en-us/azure/iot-edge/tutorial-csharp-module) to prepare your IDE.

Next, provision the following resources in your Azure subscription. I will use the Azure CLI for provisioning the resources in this sample.

- **Resource Group**: This resource group will contain all your Azure resources. Replace the name and location of the resource group with your desired values.

```bash
az group create --name santamaria-rg --location australiaeast
```

- **Azure Container Registry**: All the modules are essentially docker images, and therefore their images are stored in a container registry. Execute the following command to create Azure Container Registry (ACR) after replacing the parameter values with the ones that you desire.

```bash
az acr create --resource-group santamaria-rg --name santamaria --sku Basic --admin-enabled true --location australiaeast
```

- **Azure IoT Hub**: Azure IoT Edge is a feature of IoT Hub. We can provision Azure IoT Hub by using the following command.

```bash
az iot hub create --resource-group santamaria-rg --location australiaeast --name santamaria-ih
```

- **Edge Device**: After you have provisioned the IoT Hub, go to your instance and select **IoT Edge** from the **Device Management** section. Click **Add IoT Edge Device** and enter a name for your device. I have named my device _boilers_. You don't have to enter keys for the device as they will be automatically generated. After the device gets created, you can view the connection details of the device by clicking on the device in the portal. Note down the connection string of the device from the details blade.

- **Stream Analytics**: I believe there is no CLI command that can provision Stream Analytics for you (if I am wrong, let me know in the comments section below). Search Stream Analytics in the search box in Azure portal and create an instance of Stream Analytics in the resource group that you just created. You can read more about Stream Analytics and its features [here](https://docs.microsoft.com/en-us/azure/stream-analytics/stream-analytics-introduction).

- **PowerBI**: Getting access to PowerBI is not as simple as logging in into the PowerBI service. Try [one of these options](https://docs.microsoft.com/en-us/power-bi/service-self-service-signup-for-power-bi) to gain access to PowerBI.

## Building the Application

First, you would need to deploy the temperature sensor module to the edge device. Follow the [quick start guide](https://docs.microsoft.com/en-us/azure/iot-edge/quickstart) to have the temperature sensor deployed on your device (local system).

> If you ever change the connection settings of the IoT Hub or your edge device, or if want to make sure that the tooling is working with the correct set of credentials, you would need to execute the following commands in the order given below.

```bash
# Connect your edge device to IoT Hub
iotedgectl setup --connection-string "{device connection string}" --nopass
# Login to ACR so that your device can pull images.
iotedgectl login --address <your container registry address> --username <username> --password <password>
# Start the runtime
iotedgectl start
```

By the end of the last step, you should have the simulated temperature sensor deployed on your device. Let's create a C# module to process the data and filter out the values below _30&deg;C_ generated by the simulator.

We will use the steps mentioned in [this guide](https://docs.microsoft.com/en-us/azure/iot-edge/tutorial-csharp-module) to create our module. Launch VS Code and in the integrated terminal, type the following command to install the **AzureIoTEdgeModule** template.

```bash
dotnet new -i Microsoft.Azure.IoT.Edge.Module
```

Next, create a module named **RangeFilterModule** using the following command.

```bash
dotnet new aziotedgemodule -n RangeFilterModule -r <your container registry address>/rangefiltermodule
```

What this command does in addition to unfolding the code template is to add a file named _module.json_ to your project. This file contains your container registry address and the name of the image along with the path of docker file to use to deploy your image. The docker file contains commands that publish your project and copy the generated output to the folder which forms the image to be published to the registry.

{{< img src="3.png" alt="Module JSON File" >}}

In the generated code, navigate to the `Program` file and navigate through the boilerplate code. The `Main` method gets the IoT Hub connection string from an environment variable, which is passed to the container by the edge runtime when it starts the container. The method then performs some certificate checks and invokes the `Init` method and then blocks the main thread.

The `Init` method sets MQTT as the transport protocol and then creates and opens a connection to the edge runtime using the `DeviceClient` class. There is an exciting thing that happens right afterward. The module reads parameter values from its module twin. Two event listeners are attached to react to incoming messages and changes in twin properties. Module twin is merely an externally configurable JSON file that contains custom configuration data for your module. You can modify this file independently of the lifetime of the module from the Azure portal. For example, from the Azure portal, we can change the parameter value that this module uses.

{{< img src="4.png" alt="ModuleTwin" >}}

You would be able to see this screen after you add this module to the edge device in the portal.
Navigate to the `FilterMessage` method. This is where the business logic of the application is. Replace this method with the following code.

```CS
static async Task<MessageResponse> FilterMessages(Message message, object userContext)
{
    var counterValue = Interlocked.Increment(ref counter);

    try
    {
        DeviceClient deviceClient = (DeviceClient)userContext;
        var messageBytes = message.GetBytes();
        var messageString = Encoding.UTF8.GetString(messageBytes);
        Console.WriteLine($"Received message {counterValue}: [{messageString}]");

        // Get message body
        var messageBody = JsonConvert.DeserializeObject<MessageBody>(messageString);
        if (messageBody != null && messageBody.machine.temperature > temperatureThreshold)
        {
            Console.WriteLine($"Machine temperature {messageBody.machine.temperature} " +
                $"exceeds threshold {temperatureThreshold}");
            var filteredMessage = new Message(messageBytes);
            await deviceClient.SendEventAsync("output1", filteredMessage);
        }

        // Indicate that the message treatment is completed
        return MessageResponse.Completed;
    }
    catch (AggregateException ex)
    {
        foreach (Exception exception in ex.InnerExceptions)
        {
            Console.WriteLine();
            Console.WriteLine("Error in sample: {0}", exception);
        }
        // Indicate that the message treatment is not completed
        var deviceClient = (DeviceClient)userContext;
        return MessageResponse.Abandoned;
    }
    catch (Exception ex)
    {
        Console.WriteLine();
        Console.WriteLine("Error in sample: {0}", ex.Message);
        // Indicate that the message treatment is not completed
        DeviceClient deviceClient = (DeviceClient)userContext;
        return MessageResponse.Abandoned;
    }
}
```

This method simply compares the reported temperature value with the threshold value, and if the value is higher than the threshold, then a new message is created and passed to the output channel. To deploy this module to your device, log in to the ACR using the following command.

```bash
docker login -u <ACR username> -p <ACR password> <ACR login server>
```

Next, right-click the _module.json_ file and select the platform you want to use for the container. Select the _Build and Push IoT Module Image_ option. This action will build and push the image to your registry.

Next, we will build the Azure function that will get messages from the output of this module and flag the messages according to temperature threshold limits that we will configure. The guidance for building and deploying an Azure Function module to edge device is documented [here](https://docs.microsoft.com/en-us/azure/iot-edge/tutorial-deploy-function). You simply have to install the Azure Function Edge Module template using the following command.

```bash
dotnet new -i Microsoft.Azure.IoT.Edge.Function
```

And create a project using the following command.

```bash
dotnet new aziotedgefunction -n FlagFunction -r <your container registry address>/flagfunction
```

You can view the boilerplate code inside this function in the _run.csx_ file. Replace the code inside the `Run` function with the code below.

```CS
public static async Task Run(Message messageReceived, IAsyncCollector<Message> output, TraceWriter log)
{
    const int highTemperatureThreshold = 31;
    const int meltingTemperatureThreshold = 35;
    byte[] messageBytes = messageReceived.GetBytes();
    var messageString = System.Text.Encoding.UTF8.GetString(messageBytes);

    if (!string.IsNullOrEmpty(messageString))
    {
        // Get the body of the message and deserialize it
        var messageBody = JsonConvert.DeserializeObject<MessageBody>(messageString);

        if (messageBody != null && messageBody.machine.temperature > highTemperatureThreshold)
        {
            var alertMessage = new AlertMessage
            {
                temperature = messageBody.machine.temperature,
                timeCreated = messageBody.timeCreated
            };

            if (messageBody.machine.temperature > meltingTemperatureThreshold)
            {
                alertMessage.alertType = "MeltingTemperature";
            }
            else
            {
                alertMessage.alertType = "HighTemperature";
            }

            var requestString = JsonConvert.SerializeObject(alertMessage);
            var requestInBytes = System.Text.Encoding.UTF8.GetBytes(requestString);
            // Send the message to the output as the temperature value is greater than the threashold
            var filteredMessage = new Message(requestInBytes);
            // Send the message
            await output.AddAsync(filteredMessage);
            log.Info("Received and transferred a message with temperature above the threshold");
        }
    }
}
```

In this function, we are checking whether the temperature that we receive in this module is lesser than _35&deg;C_. If the temperature is below 35&deg;C and higher than 31&degC, we flag the data as a High-Temperature value. If the value exceeds 35&deg;C, we mark the data as a Melting-Point value. The function finally emits the output through the channel.

> If you revise the code of the modules, then you would need to update the version of the image. The Edge Device knows about change in the module by the version number only. You can find the version number of the code that you are deploying in the _module.json_ file. After every update, you will have to update the tag of the module in IoT Hub as well.

Simply right-click the _module.json_ file of this module and deploy it to ACR. We will now link all these modules together in the Azure portal.

In the Azure portal, navigate to the edge device that you created and click on the **Set Modules** option.

{{< img src="5.png" alt="Set Modules" >}}

In the next blade, click on the **Add IoT Edge Module** option and in the next blade add the details of the **RangeFilterModule** that you created. Here is a screenshot of the settings that I have put in.

{{< img src="6.png" alt="Range Filter Module Configuration" >}}

Next, add the **FlagFunction** module to the device by following the same process.

{{< img src="7.png" alt="Flag Function Module Configuration" >}}

After you are done adding both the modules, configure the linkage between the module by adding routes. Click **Next** in the wizard to configure the routes. Add the following route configuration in the dialog.

```json
{
  "routes": {
    "sensorToFilter": "FROM /messages/modules/tempSensor/outputs/temperatureOutput INTO BrokeredEndpoint(\"/modules/rangeFilterModule/inputs/input1\")",
    "filterToFunction": "FROM /messages/modules/rangeFilterModule/outputs/output1 INTO BrokeredEndpoint(\"/modules/flagFunction/inputs/input1\")",
    "functionToHub": "FROM /messages/modules/flagFunction/outputs/* INTO $upstream"
  }
}
```

In the configuration, you can see that output of one module is linked to the input of another which is how modules are connected. The final module emits its output to `$upstream`, which is a keyword to denote IoT Hub input stream.

Follow the wizard and complete the setup. After you are done, in some time the edge runtime will detect the changes and deploy the modules on the device. If you don't want to wait, you can force the runtime to restart by typing the following command.

```bash
iotedgectl restart
```

## Adding Visualization

To visualize the data, we will configure the Stream Analytics job that we created to take all data from the IoT Hub and populate a PowerBI dataset with it. You can find the guidance for doing that [here](https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-live-data-visualization-in-power-bi). It is quite simple and straightforward, and therefore I would not be repeating the process here. You can write a simple query to send all data from your IoT Hub to Power BI. Following is the query that I have configured in my Stream Analytics service.

```SQL
SELECT
    *
INTO
    [santamaria-powerbi]
FROM
    [santamaria-ih]
```

Once you start the Stream Analytics job, you will find a dataset created in your PowerBI workspace with all the data from the IoT Hub. You can draw charts using the dataset that gets generated. Here are the charts that I created using my (exceptional) PowerBI skills.

{{< img src="8.png" alt="SantaMaria PowerBI Dashboard" >}}

## Special Mention: IoTEdgeDevTool

As you can see from the exercise, the modules can become quite disjoint, and executing the numerous commands can become a tedious task. Moreover, setting up CI & CD using the current set of tools is quite difficult. Thankfully, Microsoft has developed an open source tool named [Azure IoT Edge Dev Tool](https://github.com/Azure/iotedgedev) that greatly simplifies the process. The best thing that I liked about the tool is that you can link the various commands together. For example, to build and push all images to the registry, you need to enter the command `iotedgedev push --deploy`. IoT Edge Dev Tool is a super handy tool that gives a .net solution type of structure to your code by requiring you to maintain all modules in a folder and keeping the build artifacts out of it. I have personally used this tool and really like its features.

{{< subscribe >}}
