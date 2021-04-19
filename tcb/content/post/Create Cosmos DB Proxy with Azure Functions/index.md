---
title: "Building Zero Code Cosmos DB Proxy with Azure Functions"
date: 2018-05-09
tags:
  - azure
  - compute
comment_id: 36eda8ef-f3d8-492f-9a3b-dc525b34f1d4
slug: building-zero-code-cosmos-db-proxy-with-azure-functions
---

Using Azure Functions, you can free your projects from Cosmos DB API dependency. In this article, we will build a simple API using Azure Functions that interacts with Cosmos DB without requiring you to write any code.

You have multiple options for building Azure Functions. You can write functions using Visual Studio tooling, or you can build one using VS Code with Azure CLI. However, for this demo, I will use the Azure Portal inbuilt function editor. I do not recommend using the online editor for enterprise-grade applications, because to use any of the source control goodness, you would need to download the code to your machine and push it to your version control system.

## Scenario

We will build a simple proxy for a Cosmos DB employee database. We will model this proxy in the form of a repository that interacts with the database to perform queries and updates.

## Create The Database

I will use the Azure Integrated CLI terminal for provisioning all the resources. It is an easy to use command line interface that helps you provision resources in Azure without requiring you to navigate a lot around the portal. If you are not familiar with the CLI tooling, you can read more about it [here](https://azure.microsoft.com/en-au/features/cloud-shell/).

Execute the following command to create a Resource Group. Substitute the name and location of the resource group with ones that you like.

```shell
az group create --name 'funcationcosmosintegration-rg' --location 'australiaeast'
```

Execute the following command in the shell to create an instance of Cosmos DB. I am modeling this database to contain employee records for Acme Enterprises and hence the name of the database. You should substitute the various resource names with relevant values that suit you.

```shell
az cosmosdb create --name 'acmeindustriesemployeedb' --kind GlobalDocumentDB --resource-group 'funcationcosmosintegration-rg' --max-interval 10 --max-staleness-prefix 200
```

## Create The Function

Create a storage account where the function will store its state and other data.

```shell
az storage account create --name 'functiondata01' --location 'australiaeast' --resource-group 'funcationcosmosintegration-rg' --sku Standard_LRS
```

It's now time to create a function. Execute the following command in the terminal to create a function app.

```shell
az functionapp create --resource-group 'funcationcosmosintegration-rg' --consumption-plan-location 'australiaeast' --name 'acmeindustriesemployeeservice' --storage-account 'functiondata01'
```

This command will create a function app with consumption hosting plan in which you only pay when the functions are running. Next, you would need to create a function within the app. Open the Function App and click on the **+** sign next to the Functions header. Select the **Custom Function** template from the next blade.

{{< img src="1.png" alt="Create Custom Function" >}}

In the next blade, select the **C# HTTP Trigger** template and click on the **Create** button. The Azure portal will create a function for you, and the subsequent blade will show you the code present in the file _run.csx_. You will find the `Run` method inside this file which will be called whenever the function receives an HTTP request. In this function, the `HttpRequestMessage` parameter will contain the request details and the `TraceWriter` parameter object can be used to log trace messages.

## Connect Azure Function to Cosmos DB

We will now connect the Cosmos DB to our function. You do not need to write any code to create connections or write any commands to enable this integration. Just click on the **Integrate** button to launch the integration blade. Since we want to send the data that our function receives to the Cosmos DB, we need to create a new output binding. Click on the **+ New Output** button and select Cosmos DB as the destination.

Follow the input sequence shown in the image below to complete the integration.

{{< img src="2.png" alt="Add Cosmos DB Integration" >}}

After configuration, the parameter `outputDocument` would be available to us inside the function to push data to Cosmos DB. The rest of the parameters define the database and the collection in which the data would be stored. Now, let's modify the code in _run.csx_ to send data to Cosmos DB. The following code will insert a valid JSON object present in request body to Cosmos DB. I must add here that if you are planning to build an API\Repository using functions, then you must cast the data in a known object type and then use the object for further operations. For example, in this scenario, I would build functions such as `AddEmployee` function that casts the data in the request to an `Employee` object and then persists the object.

```c#
#r "Newtonsoft.Json"

using System.Net;
using Newtonsoft.Json;

public static async Task<HttpResponseMessage> Run(HttpRequestMessage req, TraceWriter log, IAsyncCollector<object> outputDocument)
{
	// Read data from request body
    var requestData =  await req.Content.ReadAsStringAsync();

	// Convert data to JObject
    var data = Newtonsoft.Json.Linq.JObject.Parse(requestData);

	// Use the IAsyncCollector to add object to Cosmos DB
    await outputDocument.AddAsync(data);
    return req.CreateResponse(HttpStatusCode.OK,"Record added." );
}
```

Click **Save** to compile the function. In the adjacent Test Console, compose a request and click on the **Run** button to send the request to the function.

{{< img src="3.png" alt="Testing The Function" >}}

After the function returns a success response, you can view the newly created document using the Cosmos DB Data Explorer or [Azure Storage Explorer](https://azure.microsoft.com/en-gb/features/storage-explorer/) tool.

{{< img src="4.png" alt="Employee Record in Cosmos DB" >}}

Wow, that was quick and easy! Now let's create another binding to query the record and return the response to the user. You can create another binding in the application just like the one that you created previously, however, this time by specifying an **Input binding** rather than an **Output Binding** that we configured previously. I would later demonstrate another shortcut that you can take to create this binding.

{{< img src="5.png" alt="Setting The Input Binding" >}}

You can also pass parameters to the query in the binding. I will demonstrate this feature in a demo that I will build now. Create another **Http Trigger** function named `GetRecord` just like you previously did. Click on the **Integrate** tab and in the **Triggers** section specify the **Route Template** amongst other settings. I have specified the route as `GetRecord/{id}`. Of course, click the **Save** button.

{{< img src="6.png" alt="Configure Trigger Settings" >}}

You can see that I have specified a placeholder for the `id` parameter in the route. We will use this parameter in the integration that we will set up between the trigger and the input.

Now, you can change the code in the _run.csx_ file to the following.

```c#
using System.Net;
public static HttpResponseMessage Run(HttpRequestMessage req, IEnumerable<dynamic> documents, TraceWriter log)
{
    if (documents != null)
    {
        return req.CreateResponse(HttpStatusCode.OK,documents);
    }
    else
    {
        return req.CreateResponse(HttpStatusCode.NotFound);
    }
}
```

I know, as soon as you pasted the code, you must have realized what all the parameters are and how they are linked to the settings that you just configured in the trigger. I want to draw your attention to the `documents` parameter. This parameter contains all the records that satisfy the query criteria which you defined in the Input binding. The code simply sends a response containing the records to the user.

Do you know where all the bindings and the queries are saved? Let me show you where they are hiding. In your function click on the _View Files_ tab, and open the function.json file. You will find all the integration settings wrapped in the `bindings` section. Let's directly modify this file to query only those records that fulfill our criteria.

```json
{
  "bindings": [
    {
      "authLevel": "function",
      "name": "req",
      "type": "httpTrigger",
      "direction": "in",
      "methods": ["get", "post"],
      "route": "GetRecord/{id}"
    },
    {
      "name": "$return",
      "type": "http",
      "direction": "out"
    },
    {
      "type": "documentDB",
      "name": "documents",
      "databaseName": "employeedb",
      "collectionName": "employees",
      "connection": "acmeindustriesemployeedb_DOCUMENTDB",
      "sqlQuery": "SELECT * FROM c WHERE c.empcode={id}",
      "direction": "in"
    }
  ],
  "disabled": false
}
```

Now that you where the settings live, you can directly modify this file to create other repository methods. Let's test our function with some data now. Simply send a request to the function just like you previously did from the portal and inspect the result.

{{< img src="7.png" alt="Result From Function" >}}

Of course, you can build your entire repository by creating functions and bindings that proxy your database. Not using the UI to create bindings and triggers will save you a lot of time. If you are building your functions in an IDE, then you know that you need to save your configurations and bindings in the _function.json_ file.

You must have noticed that there are many other cloud resources to which you can bind your functions. Native binding saves you a lot of effort of handling the connections and allows you to focus on building the business logic, which is a USP of Azure Functions.

{{< subscribe >}}
