---
title: "Building The Azure IoT Analytics Architecture Prototype"
date: 2016-04-27
tags:
  - azure
  - internet of things
  - analytics
---
Recently I was going through some IoT ([Internet of Things](https://en.wikipedia.org/wiki/Internet_of_Things)) videos on [Channel9](https://channel9.msdn.com/Azure). [David Crook](https://channel9.msdn.com/Niners/DrCrook) did a small [whiteboard session](https://channel9.msdn.com/Blogs/raw-tech/IOT-Analytics-Architecture-Whiteboard-with-David-Crook) on IoT analytics architecture which I really liked. Your clients are going to, if not already, demand analytics in each and every IoT engagement that you might already be working on or will pursue in the future. It makes sense to have a prototype handy to lock down your architecture and to build client demonstrations. Let's see how complex or easy it is to take David's whiteboard to reality. I encourage you to watch [the video](https://channel9.msdn.com/Blogs/raw-tech/IOT-Analytics-Architecture-Whiteboard-with-David-Crook) entirely so that you are clear about the architecture and the resources involved in building the prototype.

Following is a high-level design of the system that was presented by David on the whiteboard. In a nutshell, the devices connect to the [IoT Hub](https://azure.microsoft.com/en-in/services/iot-hub/) through a gateway which intelligently handles how devices connect to the internet. The gateway is responsible for sending data to IoT Hub. Data from IoT Hub is consumed by [Stream Analytics](https://azure.microsoft.com/en-in/services/stream-analytics/), which can perform analysis on a stream of data. Stream Analytics is responsible for piping raw data to the [Data Lake](https://azure.microsoft.com/en-in/solutions/data-lake/) so that long-term analysis can be performed on the data. The Stream Analytics will also aggregate the data stream over a small duration (say 5 seconds) and pipe the aggregated data to [Power BI](https://powerbi.microsoft.com/en-us/) to power the dashboards. Any actionable or inconsistent aggregated data are sent as messages to a [Service Bus Queue](https://azure.microsoft.com/en-us/documentation/articles/service-bus-queues-topics-subscriptions/) so that they can be consumed by a [Web Job](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) or an [Azure Function](https://azure.microsoft.com/en-in/services/functions/) to notify the field workers. To extend the functionality of the system, the web jobs and functions can send a message back to IoT Hub which in turn can send a message back to the gateway so that it can self stabilize the system.

{{< img src="1.png" alt="Iot Architecture" >}}

## Code

The code for this sample application is available on my GitHub repository. {{< sourceCode src="https://github.com/rahulrai-in/iotanalyticsarchitecture">}}

## Deploying the Resources

Let's start the process of deploying the resources. For anything other than prototyping, using the classic resource deployment model (or worse deploying each resource manually through the portal) is not optimal (read Microsoft's [recommendation](https://azure.microsoft.com/en-in/documentation/articles/resource-manager-deployment-model/)). You should use the Azure Resource Manager deployment model with PowerShell. We will use the new [Azure Resource Manager experience in Visual Studio](https://azure.microsoft.com/en-in/documentation/articles/vs-azure-tools-resource-groups-deployment-projects-create-deploy/) to define and deploy our resources. You will love the way you can choose your resources and configure the resources from a GUI. Start by adding a new **Azure Resource Group** project in the solution. Name the project **ResourceDeployment** and click **Ok**. When the project template unfolds, you would find two templates present in the project. The **azuredeploy.json** template contains the definition of resources that need to be deployed. The **azuredeploy.parameters.json** file contains the parameter values for the parameters of **azuredeploy.json** template. Since most of the resources that we need are not yet present in the template wizard, you would need to write the resource definitions yourself in the **azuredeploy.json** template. Replace the code in **azuredeploy.json** with the following code.

```JavaScript
{
  "$schema": "https://schema.management.azure.com/schemas/2015-01-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "hubName": {
      "type": "string"
    },
    "datalakeStoreName": {
      "type": "string"
    },
    "namespace": {
      "type": "string"
    },
    "queueName": {
      "type": "string"
    }
  },
  "variables": {
  },
  "resources": [
    {
      "apiVersion": "2016-02-03",
      "type": "Microsoft.Devices/IotHubs",
      "name": "[parameters('hubName')]",
      "location": "East US",
      "sku": {
        "name": "F1",
        "tier": "Free",
        "capacity": 1
      },
      "properties": {
        "location": "East US"
      }
    },
    {
      "apiVersion": "2016-02-03",
      "type": "Microsoft.Devices/IotHubs/eventhubEndpoints/ConsumerGroups",
      "name": "[concat(parameters('hubName'), '/events/cg1')]",
      "dependsOn": [
        "[concat('Microsoft.Devices/Iothubs/', parameters('hubName'))]"
      ]
    },
    {
      "apiVersion": "2016-02-03",
      "type": "Microsoft.Devices/IotHubs/eventhubEndpoints/ConsumerGroups",
      "name": "[concat(parameters('hubName'), '/events/cg2')]",
      "dependsOn": [
        "[concat('Microsoft.Devices/Iothubs/', parameters('hubName'))]"
      ]
    },
    {
      "apiVersion": "2016-02-03",
      "type": "Microsoft.Devices/IotHubs/eventhubEndpoints/ConsumerGroups",
      "name": "[concat(parameters('hubName'), '/events/cg3')]",
      "dependsOn": [
        "[concat('Microsoft.Devices/Iothubs/', parameters('hubName'))]"
      ]
    },
    {
      "apiVersion": "2015-10-01-preview",
      "type": "Microsoft.DataLakeStore/accounts",
      "name": "[parameters('datalakeStoreName')]",
      "location": "eastus2"
    },
    {
      "apiVersion": "2015-08-01",
      "name": "[parameters('namespace')]",
      "type": "Microsoft.ServiceBus/namespaces",
      "location": "East US",
      "properties": {
        "messagingSku": "1",
        "enabled": true,
        "status": "Active"
      },
      "resources": [
        {
          "apiVersion": "2015-08-01",
          "name": "[parameters('queueName')]",
          "type": "Queues",
          "dependsOn": [
            "[concat('Microsoft.ServiceBus/namespaces/', parameters('namespace'))]"
          ],
          "properties": {
            "path": "[parameters('queueName')]"
          },
          "resources": [
            {
              "apiVersion": "2015-08-01",
              "name": "sendmessage",
              "type": "AuthorizationRules",
              "dependsOn": [
                "[parameters('queueName')]"
              ],
              "properties": {
                "keyName": "sendmessage",
                "claimType": "SharedAccessKey",
                "claimValue": "None",
                "rights": [ "Send" ],
                "revision": -1
              }
            },
            {
              "apiVersion": "2015-08-01",
              "name": "readmessage",
              "type": "AuthorizationRules",
              "dependsOn": [
                "[parameters('queueName')]"
              ],
              "properties": {
                "keyName": "readmessage",
                "claimType": "SharedAccessKey",
                "claimValue": "None",
                "rights": [ "Listen" ],
                "revision": -1
              }
            }
          ]
        }
      ]
    }
  ],
  "outputs": {
  }
}
```

This template definition will create an IoT Hub with three consumer groups, a Data Lake Store and a Service Bus Queue with three access policies. The names of these resources are taken from the parameters of the template. You would need to define these parameters in the **azuredeploy.parameters.json** file. To deploy these resources, right click on the **ResourceDeployment** project and click on **Deploy**. Follow the steps mentioned in the deployment wizard to deploy your resources. Once the provisioning is complete, we will deploy the rest of the resources.

You would notice that we have not deployed the Stream Analytics Jobs. I left out provisioning the Stream Analytics Jobs because they require a lot of configurations and the plumbings to making them work with IoT Hub through Resource Manager are not yet supported. However, you can create these plumbings and the resources through the portal UI. Here's what you need to do.

First, create a Shared Access Policy for your IoT Hub instance. Give the policy the permission to connect to the service.

{{< img src="2.png" alt="Create Shared Access Policy IoT Hub" >}}

Now we are ready to create a Stream Analytics Job that would copy all incoming data to Data Lake and send the computed average of data above a set threshold to the Service Bus Queue that we previously provisioned. To do this, search the marketplace for Stream Analytics Job and create a new job named **movedatatotargets**.

{{< img src="3.png" alt="Create Stream Analytics Job" >}}

Next, using the shared access policy that we previously configured, add the data stream from the IoT Hub that we provisioned earlier as an input to the Stream Analytics Job. Currently, this operation is supported through the classic portal. So, navigate to your job in the classic portal and select **Inputs** from the options tab. Click on **Add an Input** and select **Data Stream** as the type of input.

{{< img src="4.png" alt="Input Type Stream Analytics Job" >}}

Next, select **IoT Hub** as an input source.

{{< img src="5.png" alt="Stream Analytics Input Stream is IoT Hub" >}}

Next, give an alias to your input (this name will be referenced in the query that we will write next) and select the IoT Hub instance, that we previously configured, from the list of IoT Hub instances in your subscription. Select one of the configured consumer groups that will be used by this job. The following is how this setting looks for me.

{{< img src="6.png" alt="Stream Analytics IoT Hub Settings" >}}

Click **Next** and let the default encoding options stay as JSON and UTF-8 respectively as we are going to send data to our hub in the same format.

Now, we will add two outputs to our job. The first will be the Data Lake storage where we will store all the incoming data without making any modifications to it. The second will be the Service Bus Queue that we configured earlier. The presence of messages in this queue represents abnormalities observed in the temperatures for some time. The analytics architecture requires configuring another output for PowerBI, which I wasn't able to configure due to some limitations applicable to my Azure subscription, but here is a [link](https://gallery.cortanaintelligence.com/Tutorial/Sensor-Data-Analytics-with-ASA-and-Power-BI-2) that can be referred to do this activity. Don't forget to average your readings for some time (5 to 10 seconds) before sending them to PowerBI to avoid rendering charts with spikes.

First, add the cool data storage repository (the Data Lake) that we provisioned earlier as the output of the stream. To do so, select **Outputs** from the settings tab and select **Data Lake Store** from the list of available outputs. In the next screen, you would need to authorize stream analytics to push data to Data Lake through OAuth mechanism. Clicking on **Authorize Now** will take you through the flow.

{{< img src="7.png" alt="Authorize Data Lake Connection in Stream Analytics" >}}

Next, give this output an alias (**mydatalakeoutput**) and select your Data Lake Store account from the list of available Data Lake Store accounts. We will segregate data that we collect by date, month and year, so configure the path prefix accordingly.

{{< img src="8.png" alt="Stream Analytics Output Data Lake" >}}

Let the serialization settings stay at their default values, i.e. UTF-8 Encoded, JSON serialized strings. Once the previous configurations are complete, we need to configure the Service Bus Queue output of the Stream Analytics Job. You would need a shared access policy with **Send** permission for the purpose. If you look through the ARM deployment template that we used to deploy our resources, you would find that the Service Bus Queue was created with **sendmessage** and **readmessage** policies. You can get the keys for these policies by navigating to the queue instance in the portal and then looking for these values in the configure section (the key would be picked automatically by the Stream Analytics Job configuration so don't copy them).

{{< img src="9.png" alt="Service Bus Queue SAS" >}}

Create a new Output for the Stream Analytics Job and select Service Bus Queue as the output type. Next, in the queue settings pane, give this output a name (**mysbqueueoutput**), select the subscription, name of queue to use and select **sendmessage** as the required **Queue Policy**.

{{< img src="10.png" alt="Stream Analytics Service Bus Queue Output" >}}

In the next step, select the same serialization settings as those of other resources and click **Ok**.

Now, we need to connect the input to the outputs that we configured through a query. In the portal, navigate to your Stream Analytics Job and click on **Query**. Paste the following two queries in the query console and click **Save**.

```SQL
SELECT
    DeviceId, COUNT(*) AS ReadingCount, Avg(WindSpeed) AS AverageWindSpeed, System.TimeStamp AS OutTime
INTO
    [mysbqueueoutput]
FROM
    [myiothubinput]
GROUP BY
    DeviceId, TumblingWindow(minute,2)
HAVING
    AverageWindSpeed > 12

SELECT
    *
INTO
    [mydatalakeoutput]
FROM
    [myiothubinput]
```

The first query will try to find a two-minute window during which the average wind speed was more than 12\. It will then send the result of the query to the output which, in turn, will create a message object and place the object in the Service Bus Queue. The second query is a pass-through query which selects all data and moves it to the Data Lake Store. The infrastructure is now ready for prime time. Enable the job so that it starts analyzing the data stream.

## Building The Simulators

At this point, we need to build a simulator that sends messages to the IoT Hub. However, we don't need to build one entirely from scratch. Here is a [link](https://azure.microsoft.com/en-in/documentation/articles/iot-hub-csharp-csharp-getstarted/) that you can use to create a simulator. You can also find the exact same simulator documented in the article available in the [code](https://github.com/rahulrai-in/iotanalyticsarchitecture) that I wrote for this sample. The following three applications are available in the sample solution:

- **CreateDeviceIdentity**, which creates a device identity and associated security key to connect your simulated device.
- **ReadDeviceToCloudMessages**, which displays the telemetry sent by your simulated device.
- **SimulatedDevice**, which connects to your IoT hub with the device identity created earlier, and sends a telemetry message every second using the AMQPS protocol.

Let's test this solution we have built till now by performing the following activities.

- Create an identity of the simulated device in the IoT Hub instance.

In the **CreateDeviceIdentity** project's configuration file, set the connection string of the IoT Hub instance that we provisioned earlier. You can find the connection string by navigating to your IoT Hub instance and clicking on **Settings**. You can choose any policy with **Registry Write** permission and copy its connection string.

{{< img src="11.png" alt="ConnectionString IoT Hub" >}}

Now, run the **CreateDeviceIdentity** project and copy the unique device key that is the output of this application.

{{< img src="12.png" alt="Generated Device Key" >}}

- Start the Simulator application and the Listener application

Start the simulator and listener applications after applying the necessary settings in the configuration files of the projects.

**<u>Simulator</u>**

{{< img src="13.png" alt="Device Simulator" >}}

**<u>Receiver</u>**

{{< img src="14.png" alt="IoT Data Receiver" >}}

Now, let's take a look at the Data Lake Store. It should have all the records that have been sent to the IoT Hub.

{{< img src="15.png" alt="Data Lake Stream Analytics Output" >}}

In the Data Explorer, clicking on the file will show you a preview of the contents of the file which contains all the data recorded by the sensors (simulated device).

Now let's change the seed wind speed in **SimulatedDevice.Program.cs** file so that the average values go above 12\. When we run the simulator again, it should trigger the Stream Analytics Job to add a message to our Service Bus Queue. Use [Service Bus Explorer](https://blogs.msdn.microsoft.com/paolos/2015/03/02/service-bus-explorer-2-6-now-available/) to check the contents of your Service Bus Queue.

{{< img src="16.png" alt="Service Bus Queue Messages" >}}

We are done with building the prototype of most of the architecture!

## Bonus Activity

Now that we have realized most of the architecture, I will reward you with a bonus activity! Let's create an Azure Function App that consumes messages from the Service Bus Queue and alerts me to go and turn down the speed of the fan that is blowing air above the threshold limit!
Now that we have realized most of the architecture, I will reward you with a bonus activity! Let's create an Azure Function App that consumes messages from the Service Bus Queue and alerts me to go and turn down the speed of the fan that is blowing air above the threshold limit!

Search for "Function App" in the marketplace and create a new Function App by giving it a name (**alertme**) and supplying the various setting values.

{{< img src="17.png" alt="Create Function App" >}}

Select **SB Queue Trigger for C#** from the templates and give the function a name (**TurnOffTheFan**). Supply the name of the queue and add the connection string for the Service Bus namespace. Click on **Create** to create a new function.

{{< img src="18.png" alt="Create Function App SB Q Trigger" >}}

Now, let's add a little code that gets triggered every time we get a message in our Service Bus Queue. Since we are going to accept `BrokeredMessage` as input to our function, you would need to add a reference to `WindowsAzure.ServiceBus` assembly in the function. Use the steps described in [this blog post](http://blog.eldert.net/iot-integration-of-things-processing-service-bus-queue-using-azure-functions/) to add the reference to your function.

For the sake of brevity, we will send a POST request to a [RequestBin](http://requestbin.com/) endpoint every time this function gets invoked. In a practical scenario, you may want to send an email or a notification to the users from within this function. To get your unique endpoint on RequestBin, simply click on **Create a RequestBin** button on the home page and note the endpoint mentioned on the following page.

Next, add the following lines of code to your function.

```CS
#r "Newtonsoft.Json"
using System;
using System.Threading.Tasks;
using Microsoft.ServiceBus.Messaging;
using Newtonsoft.Json;
using System.Collections.Specialized;
using System.Net;

public static void Run(BrokeredMessage myQueueItem, TraceWriter log)
{
    var stream = myQueueItem.GetBody<Stream>();
    var reader = new StreamReader(stream);
    var bodyContent = reader.ReadToEnd();
    log.Verbose($"C# ServiceBus queue trigger function processed message: {bodyContent}");
    var deviceData = JsonConvert.DeserializeObject<dynamic>(bodyContent);
    using (var client = new WebClient())
    {
        var values = new NameValueCollection();
        values["message"] = $"Rahul, The wind speed from Device {deviceData.deviceid} is {deviceData.averagewindspeed} at {deviceData.outtime}. Please turn off the fan!";
        var response = client.UploadValues("http://requestbin.com/YOUR ENDPOINT IDENTIFIER", values);
    }

    log.Verbose($"Message Sent.");
}
```

This function would simply get the content from the body of the message and send a POST request to the RequestBin endpoint. Note that the `#r` directive is used to add a reference to an assembly in the function. You can find a list of the assemblies available to Azure Functions [here](https://azure.microsoft.com/en-in/documentation/articles/functions-reference-csharp/).

I executed the sample by starting the device simulator and making it send values both within and over the tolerance limit for some time. After some time, my RequestBin endpoint received this message from my Azure Function.

{{< img src="19.png" alt="RequestBin Output" >}}

My Data Lake Store was populated as well!

{{< img src="20.png" alt="Data Lake Explorer" >}}

Since the Data Lake Store is compatible with HDInsight, Hadoop, and Spark etc., you can run Big Data analytics on the data that you captured.

I hope this article got you interested in IoT and realize how easy it is to get up and running with a prototype on IoT analytics. I hope to use the reference architecture in my future IoT engagements and hope that this comes handy to you as well! As always, I will appreciate your suggestions and feedback!

{{< subscribe >}}
