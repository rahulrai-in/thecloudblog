---
title: "Hire a Cab Using Cortana and Azure Search"
date: 2016-02-18
tags:
  - azure
  - web & mobile
---

This project was my attempt at [Azure Search for Search Contest](https://azure.microsoft.com/en-us/blog/azure-search-search-for-search-contest/)! Although I got knocked out, but I learnt quite a bit about Azure Search and Universal Windows Platform by building this application. This application is a demonstration of how versatile Azure Search service is and how easily you can mash up this service with other cloud offerings and build something complex with little effort.

## Synopsis

FindCab is a prototype that uses several Azure services viz. Azure Search, Bing Maps, Event Hubs, DocumentDB, Azure Search Indexer, Cortana, Azure WebJob and Universal Windows Platform Applications to find (simulated) cabs plying near a user and to find (simulated) cabs in a particular location. The application uses some of the advanced Azure Search features such as [geospatial search](https://azure.microsoft.com/en-us/documentation/articles/search-create-geospatial/) (searching a Geo location) to find available cabs and automatic [DocumentDB](http://azure.microsoft.com/en-in/services/documentdb/) indexing to supply data from a DocumentDB collection to an index in Azure Search.

Following is the application diagram of the system.

{{< img src="1.jpg" alt="FindCab Application Diagram" >}}

There are two types of flows executing in the application. One of the flows keeps executing continuously in the background, whereas the user initiated flow gets triggered on demand of the user.

### Background Tasks

1.  **A1**: An [Azure WebJob](https://azure.microsoft.com/en-us/documentation/articles/websites-webjobs-resources/) acting as GPS sensor simulator has a predefined collection of cars bound to their respective regions. It continuously sends GPS records of all the simulated cars to event hub. The simulated cars move diagonally in the regions they are bound to.
2.  **A2**: The data captured by the [Event Hub](https://azure.microsoft.com/en-us/documentation/articles/event-hubs-csharp-ephcs-getstarted/) is analyzed by Azure [Stream Analytics](https://azure.microsoft.com/en-us/services/stream-analytics/) job. Currently the job is a pass through query on the data received from the Event Hub.
3.  **A3**: The resultant data of the Stream Analytics query is stored in [DocumentDB](http://azure.microsoft.com/en-in/services/documentdb/).
4.  **A4**: An [Azure Search Indexer](https://msdn.microsoft.com/en-us/library/azure/dn946891.aspx) collects data from DocumentDB every 5 minutes and sends it to [Azure Search service](https://azure.microsoft.com/en-us/services/search/).

### User Initiated Action

**FindCab** is a [Universal Windows Platform Application](https://msdn.microsoft.com/en-us/library/windows/apps/dn894631.aspx) which is integrated with [Cortana](https://msdn.microsoft.com/en-us/library/windows/apps/mt185608.aspx) and supports two Voice Commands.

1.  **FindCab in XXX**: This command gets the location (XXX) that has been sent as an input and sends it to the Bing Map API to get the bounding box coordinates of the location (**B2a** in the diagram). The bounding box coordinates are then sent to Azure Search by the application to get a list of cars available in the area.
2.  **FindCab** **nearby**: This command makes the application get user's device coordinates and send it to Azure Search to find all cars within 100 kms. radius of the device (**B2b** in the diagram).

## Result

Before we dig into how this application was built, let's see this application in action.

- The following screen shows how to ask Cortana to ask the **FindCab** application to search for cabs in a particular location using the search term "FindCab in {Location Name} ".

{{< img src="2.gif" alt="SearchInRegion" >}}

- The following screen shows how to ask Cortana to ask the **FindCab** application to search for cabs nearby the user (in 100 kms. radius) using the search term "FindCab nearby".

{{< img src="3.gif" alt="SearchNearby" >}}

## Source Code

The entire source code for this application is available on GitHub. {{< sourceCode src="https://github.com/rahulrai-in/findmeacab">}} You can also find my other code samples on my [GitHub](https://github.com/rahulrai-in) repository. Since this is a UWP App, you would need Windows 10 OS installed on the developer machine to debug and deploy the application.

## Code Walkthrough and Build Instructions

Before I begin the walkthrough, I would like to say that this application is a prototype and therefore I have not automated many of the steps. However, you should write application initialization code in your applications that you wish to deploy to production. Since we have already discussed about the application and the data flows, we will take up each integration point and walk through the steps to make the integration work.

### Create Infrastructure

- Start by provisioning a Search Service account with a name e.g. **findmeacab**. See [steps](https://azure.microsoft.com/en-us/documentation/articles/search-create-service-portal/).
- Create an index in your search service and name it **cabdataindex**. See [steps](https://azure.microsoft.com/en-us/documentation/articles/search-create-index-portal/). Since we are going to supply serialized data of format `GpsSensorRecord` to the index, therefore you would need to specify the format shown below for the search index.

{{< img src="4.png" alt="Search Index" >}}

- Next, create a DocumentDB account e.g. **findmeacab**. See [steps](https://azure.microsoft.com/en-us/documentation/articles/documentdb-create-account/).
- Create an Event Hub account, e.g. **findmeacabeventhub**, to capture GPS sensor data of the cab. See [steps](https://azure.microsoft.com/en-us/documentation/articles/event-hubs-csharp-ephcs-getstarted/#create-an-event-hub).
- Create a Stream Analytics job, e.g. **gpssensoranalytics**. See [steps](https://azure.microsoft.com/en-us/documentation/articles/stream-analytics-get-started/#create-stream-analytics-job).
- Create a database in the DocumentDB you provisioned earlier. Name it **cabsensordata**. See [steps to create a database](https://azure.microsoft.com/en-us/documentation/articles/documentdb-create-database/).
- Create a collection in the DocumentDb database that you provisioned. Name it **cabgpsdatacollection**. See [steps to create a collection](https://azure.microsoft.com/en-us/documentation/articles/documentdb-create-collection/).
- Log in to [Bing Maps Dev Center](https://www.bingmapsportal.com/) and create a Bing Maps Key for your application.

### Connect Stream Analytics to DocumentDB

Once the infrastructure is in place, we need to automate the collection of data from Event Hub and move it to DocumentDB. We are going to use Stream Analytics job to query data from Event Hub and send the result of the query to DocumentDB. Use the steps mentioned [here](https://azure.microsoft.com/en-us/blog/real-time-analytics-on-your-iot/) and [here](https://azure.microsoft.com/en-us/blog/azure-stream-analytics-and-documentdb-for-your-iot-application/) to configure your job to accept Event Hub as the source of input and your DocumentDB collection as the output location. When configuring the output, you would be required to supply a partition key to use for writing data to an appropriate collection, you can use a key or write "**partitionkey**" as value. Since each simulated vehicle is treated as a document in DocumentDB, therefore, mention "vehicleid" as Document id in the configuration. The following is how your output configurations should look like.

{{< img src="5.png" alt="Stream Analytics Output Configuration" >}}

The following is how your job should look like in the portal.

{{< img src="6.png" alt="Stream Analytics Job" >}}

Note that we have written a simple pass through query which simply collects data from the Event Hub and moves it to DocumentDB. Make sure that you start your job after supplying the configuration data.

### Test The Event Hub and DocumentDB Integration

Navigate to **FindMeACab.Tests.SensorClient** console application project and supply configuration values in the app.config file of the project.

```XML
<appSettings>
  <add key="EventHubName" value="EVENT HUB NAME" />
  <add key="EventHubConnectionString" value="CONNECTION STRING VALUE" />
  <add key="BingMapsKey" value="BING MAPS KEY" />
  <add key="ReadingType" value="0" />
  <add key="IsEnabled" value="true" />
  <add key="SearchServiceName" value="AZURE SEARCH SERVICE NAME" />
  <add key="SearchServiceKey" value="AZURE SEARCH SERVICE KEY" />
</appSettings>
```

Start the console application to send simulated test data to the Event Hub. You can change the names and locations of simulated vehicles by changing test data in class `TestDataGenerator`. Use tools such as [DocumntDB Studio](https://github.com/mingaliu/DocumentDBStudio) to validate whether records are getting inserted in your DocumentDB via Stream Analytics job.

### Integrate Azure Search with DocumentDB

We will now create an indexer that runs on regular intervals and queries and indexes data inserted in DocumentDB. The indexer will only get the documents that have been modified (if you use **dataChangeDetectionPolicy**) and copy the projected data to the Azure Search index. You can use the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/documentdb-search-indexer/) to create an indexer named **documentdbindexer** using your DocumentDB (**findmeacab**) as a data source. You can use any REST client to perform this activity. Here you can see how I use [POSTMAN](http://www.getpostman.com/) to execute the REST requests. Note that you need to set content and authentication header in **each** request.

- Request Header

{{< img src="7.png" alt="Azure Search Request Header" >}}

- Create Data Source Request

{{< img src="8.png" alt="Azure Search Create Data Source" >}}

- Create Indexer Request

{{< img src="9.png" alt="Azure Search Create Indexer" >}}

Once this activity is complete, you will find your data getting copied from your DocumentDB collection to Azure Search index at every 5 minute interval. You can use tools such as [Azure Search Search Explorer](https://azure.microsoft.com/en-gb/documentation/articles/search-explorer/) or [Azure Search Tool](https://github.com/MaxMelcher/AzureSearchTool) to query the data that was received by Azure Search from DocumentDB collection.

### Integrate Cortana with Azure Search

This is the final point of integration and fairly simple to achieve if you have worked with UWP applications earlier. [Here](http://www.guruumeditation.net/en/integrate-azure-search-to-cortana/) is a blog post from Olivier, an MVP that shows you how to integrate Azure Search with Cortana. We are going to build something on the similar lines.

1.  We will first define the Voice Commands that we would use. The **VoiceCommandDefinition.xml** in **CabSearchUniversalApp** project defines the voice commands that we would use.

```XML
<?xml version="1.0" encoding="utf-8" ?>
<VoiceCommands xmlns="http://schemas.microsoft.com/voicecommands/1.2">
  <CommandSet xml:lang="en" Name="FindMeACab_en">
    <AppName>FindCab</AppName>
    <Example>FindCab in Delhi</Example>

    <Command Name="findCabInArea">
      <Example>FindCab in Delhi</Example>
      <ListenFor RequireAppName="BeforePhrase"> in {area}</ListenFor>
      <Feedback>Searching for cars in {area} </Feedback>
      <VoiceCommandService Target="CabSearchBackgroundService"/>
    </Command>

    <Command Name="findCabNearby">
      <Example>FindCab nearby</Example>
      <ListenFor RequireAppName="BeforePhrase"> nearby</ListenFor>
      <Feedback> Finding a cab nearby</Feedback>
      <VoiceCommandService Target="CabSearchBackgroundService"/>
    </Command>

    <PhraseTopic Label="area" Scenario="Search"/>
  </CommandSet>

</VoiceCommands>
```

1.  Next, we need to install this file. We will use the `OnLaunched` event of the application and use the following code for the operation.

```CS
var vcdfile = await Package.Current.InstalledLocation.GetFileAsync(@"VoiceCommandDefinition.xml");
await VoiceCommandDefinitionManager.InstallCommandDefinitionsFromStorageFileAsync(vcdfile);
```

1.  Lastly, we are going to create a Background Service named `CabSearchBackgroundService` and listen for the voice commands.

```CS
this.voiceCommandServiceConnection =
    VoiceCommandServiceConnection.FromAppServiceTriggerDetails(triggerDetails);
this.voiceCommandServiceConnection.VoiceCommandCompleted += (sender, args) => this.deferral?.Complete();
var voicecommand = await this.voiceCommandServiceConnection.GetVoiceCommandAsync();

switch (voicecommand.CommandName)
{
    case "findCabInArea":
        var area = voicecommand.Properties["area"][0];
        await this.SendProgressMessageAsync($"Searching for cars in {area}");
        await this.SearchCabsInArea(area);
        break;
    case "findCabNearby":
        await this.SendProgressMessageAsync($"Searching for cabs in 100 km radius.");
        await this.SearchCabsNearby();
        break;
}
```

The rest of the code is responsible for querying the index, retrieving the results and sending the results to Cortana. Azure search supports [geospatial queries](https://msdn.microsoft.com/en-us/library/azure/dn798921.aspx) by which you can search for documents, that have a searchable Geo coordinate field, present inside a given polygon coordinates or within a certain distance from a given geographical coordinate. On querying for a location, Bing maps get you the bounding box coordinates of the location. We will use the bounding box coordinates to find cabs present within a region. The following function in class `CabSearch` in **CabSearchBackgroundService** project is responsible for executing this flow.

```CS
private async Task SearchCabsInArea(string area)
{
    var locationData = new LocationData(BingApiKey).GetBoundingBoxCoordinates($"{area},India").Result;
    var searchResult = this.searchClient.SearchDocuments<GpsSensorRecord>(
        "*",
        SearchDocument.FilterTextForLocationBounds("geoCoordinates", locationData));
    if (!searchResult.Any())
    {
        await this.SendErrorMessageAsync("No cabs available");
        return;
    }

    var tilelist =
        searchResult.Select(
            result =>
            new VoiceCommandContentTile
                {
                    ContentTileType = VoiceCommandContentTileType.TitleOnly,
                    Title = result.VehicleId
                }).ToList();
    var successmessage = new VoiceCommandUserMessage();
    successmessage.DisplayMessage = successmessage.SpokenMessage = $"Found the following cabs in {area}...";
    var response = VoiceCommandResponse.CreateResponse(successmessage, tilelist);
    await this.voiceCommandServiceConnection.ReportSuccessAsync(response);
}
```

We will use the user's device coordinates to search for cabs near the user. The following function in class `CabSearch` in **CabSearchBackgroundService** project is responsible for executing this flow.

```CS
private async Task SearchCabsNearby()
{
    var geolocator = new Geolocator();
    var pos = await geolocator.GetGeopositionAsync().AsTask();
    var locationPoint = new LocationPoint
                            {
                                Latitude = pos.Coordinate.Point.Position.Latitude,
                                Longitude = pos.Coordinate.Point.Position.Longitude
                            };
    var searchResult = this.searchClient.SearchDocuments<GpsSensorRecord>(
        "*",
        SearchDocument.FilterTextForDistanceFromPoint("geoCoordinates", locationPoint, 50000));
    if (!searchResult.Any())
    {
        await this.SendErrorMessageAsync("No cabs available");
        return;
    }

    var tilelist =
        searchResult.Select(
            result =>
            new VoiceCommandContentTile
                {
                    ContentTileType = VoiceCommandContentTileType.TitleOnly,
                    Title = result.VehicleId
                }).ToList();
    var successmessage = new VoiceCommandUserMessage();
    successmessage.DisplayMessage = successmessage.SpokenMessage = "Found the following cabs near you...";
    var response = VoiceCommandResponse.CreateResponse(successmessage, tilelist);
    await this.voiceCommandServiceConnection.ReportSuccessAsync(response);
}
```

### Finishing Touches

Note that we have used device GPS sensor, therefore we need to declare the capability in the Application Manifest file.

{{< img src="10.png" alt="Setting Capabilities in Packagae Manifest" >}}

We also need to add the declaration that the application interacts with a background service (**CabSearchBackgroundService**).

{{< img src="11.png" alt="Setting Declaration in Packagae Manifest" >}}

## Go Play!

This is it. You are ready to test the application by letting run your test data generator application **FindMeACab.Tests.SensorClient** ([you can even deploy this as a WebJob](https://azure.microsoft.com/en-us/documentation/articles/websites-dotnet-deploy-webjobs/#convert)) in the background. Start an instance of the **CabSearchUniversalApp** and convey your orders to Cortana!!

Building this application was a lot of fun! Let me know about your experience integrating cloud services together in the comments below!

{{< subscribe >}}
