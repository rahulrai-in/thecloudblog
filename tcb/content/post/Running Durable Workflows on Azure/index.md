---
title: "Running Durable Workflows on Azure"
date: 2016-01-08
tags:
  - azure
  - app service
comment_id: 9d0a90e8-0a23-4f97-a9ae-4a43a6d20681
---

This post took a while to see the daylight. I was working on my code submission for [Azure Search for Search contest](https://azure.microsoft.com/en-us/blog/azure-search-search-for-search-contest/) and there were tons of things to catch up on. However, if you are a Windows Workflows developer and are working out ways to host your workflows on Azure or want to transfer control of business logic to your clients using Workflows, I will make up for the delay. Let's get started!!

Workflows can be broadly categorized as durable or non durable. [Durable Workflow Services](http://msdn.microsoft.com/en-us/library/bb412197.aspx) are inherently long running, persist their state, and use correlation for follow-on activities. [Non-durable Workflows](http://msdn.microsoft.com/en-us/library/ff729669.aspx) are stateless, effectively they start and run to completion in a single burst.

Non-durable Workflows are readily supported by Windows Azure with a few configuration changes. However, if you want to host Durable Workflows in Azure you have a few options:

1. Use [Logic Apps](https://azure.microsoft.com/en-in/documentation/articles/app-service-logic-what-are-logic-apps/) to build your workflows. (Requires rewriting of workflows)
2. Use [Workflow Manager](<https://msdn.microsoft.com/en-us/library/jj193528(v=azure.10).aspx>). (Not updated for a while. Uses SQL databases to store persistence data)
3. Enjoy total control over persistence and tracking by building your own workflow host. (Use low cost Azure table storage to store tracking and persistence data)

### What We Need to Build?

The big buckets of functionality required to host durable Workflow Services are:

- **Monitoring store:** You would need to implement your own tracking participant to store tracking information in Azure Table storage.
- **Instance Store:** You would need to implement your own instance store that would take care of persisting your workflow state when your workflow wants to e.g. bookmarking.
- **Reliability:** We will use an [Azure SB Queue](https://azure.microsoft.com/en-in/documentation/articles/service-bus-dotnet-how-to-use-queues/) to accept input to trigger workflows. This mechanism would ensure that our Workflows are scalable and reliable.

### Need Code?

As always the sample that I have used is available for download here.

{{< sourceCode src="https://github.com/rahulrai-in/workflowonazure">}}

I post all code samples on my [GitHub](https://github.com/rahulrai-in) account for you to use.

### What We Will Build

We will build a very simple workflow host that can trigger a workflow on receiving a message from a Service Bus queue. We will build an instance store that will take care of saving the state of workflows and help hydrate a workflow when a bookmark is resumed. Next, we will test this infrastructure by building a simple workflow with two activities. The first code activity will parse an Azure storage container and list all blobs inside the container. It will then bookmark its progress. The next activity will work on this list of blobs and copy all document files (\*.docx) from the source container to the target container.

### Let's Get Down To Business

I would not be able to demonstrate writing the whole code here. Therefore, I propose that you download the [sample](https://github.com/rahulrai-in/workflowonazure) and let me walk you through the code.

- Create a Cloud Project, select Azure Cloud Service template and then select Worker Role with Service Bus Queue Template. This is the template that I used in **WorkflowOnAzure** cloud service project. Now, I will walk you through the other projects in the solution.

{{< img src="1.png" alt="WorkerRole With ServiceBus Queue" >}}

- We will start with exploring the important entities (in the **Entities** folder).

- **`ChannelData`**: This class represents the input argument that the workflow expects. `ChannelData.Payload.ItemList` will contain the names of all blobs present inside the source container. `ChannelData.Payload.PersistentPayload` will contain all the configurations (such as source container name) required by the workflow. `ChannelData.Payload.WrokflowIdentifier` will contain the GUID name of workflow instance so that we can identify the various instances of a workflow.
- **`HostQueueMessage`**: This is the schema of message that would be sent to Service Bus queue by the test client to trigger a new workflow or by the workflow host in case of unloading a workflow after its state has been persisted through bookmark.
- **`InstanceData`**: This is the schema of data that would be stored in Azure Table Storage which is the Instance Store of the workflow.

- Next, let's go through the contents of the **DataStorage** folder.

- **`AzureTableStorageRepository`**: This class contains functions to perform CRUD operations on Azure Table Storage.
- **`AzureTableStorageAssist`**: This class contains helper functions for **`AzureTableStorageRepository`**.

- Next, let's see what resides in the **Utilities** folder.

- The Async classes are used by **`UnstructuredStorageInstanceStore`** class which derives from **`InstanceStore`** class. **`UnstructuredStorageInstanceStore`** implements Azure Table Storage based Instance Store for the workflow host.
- **`Routines`**: Contains helper functions for the project.
- **`SynchronousSynchronizationContext`**: Makes the workflows running on workflow host work synchronously.
- **`TypeSwitch`**: A utility used by **`AzureTableStorageRepository`** to convert .net data types to Entity Data Model types and vice versa.

- The **Workflow** folder contains a simple workflow with two code activities. To create a code activity, select Add > New Item... > Workflow > Code Activity. Note that to support bookmarks, your code activity should derive from `NativeActivity`.

{{< img src="2.png" alt="Add Code Activity" >}}

- **`GetAllBlobsFromContainer`**: This activity accepts `ChannelData` as input and output argument. This data would be passed as an argument to the workflow that contains this activity by the workflow host. The workflow would in turn pass the data to this activity. The code inside the this activity is self explanatory. It just gets the list of block blobs inside the source container and adds it to `ItemList` property of the argument that it received as input. Finally, it bookmarks its state so that when the bookmark resumes, the workflow would not execute this activity again but would rather execute the subsequent activities in the workflow without losing the state.
- **`CopyBlobToContainer`**: This activity accepts `ChannelData` and a single string representing name of blob as input. The rest of the code just copies the blob from the source container to the target container.
- **`CopyDocsToContainer`**: This activity is made up of the above code activities. To create this activity, select Add > New Item... > Workflow > Activity. In the designer pane, drag a Sequence from the Toolbox and drop it on the designer. Next, add the `GetAllBlobsFromContainer` activity. Attach it to a `ForEach` activity to go through the list of blobs you received from `GetAllBlobsFromContainer` activity. Next, drop an `If` activity to check whether the blob name ends with "docx" extension. Drag and drop `CopyBlobToContainer` activity in the "then" box. The end result should look like the following.

{{< img src="3.png" alt="Copy Docs To Container Activity" >}}

- Next, go to Arguments tab and specify `ChannelData` as an argument to workflow.

{{< img src="4.png" alt="Channel Data Argument" >}}

- Assign values to the various activities by navigating to their properties.

- `GetAllBlobsFromContainer`

{{< img src="5.png" alt="GetAllBlobsFromContainer Properties" >}}

- `ForEach` Activity

{{< img src="6.png" alt="ForEachString Properties" >}}

- `If` Activity

{{< img src="7.png" alt="If Activity Properties" >}}

- `CopyBlobToContainer`

{{< img src="8.png" alt="CopyBlobToContainer Properties" >}}

- To prove that you can load workflows at runtime, I took the code of the xaml file of `CopyDocsToContainer` activity and pasted it as text in **CopyDocsToContainer.txt** file. What this means is that as long as the workflow host has the binaries of the custom code activities, it is independent of which workflows are running on it.
- The `TestApplication` project is a console application that sends a single message to the queue our worker is listening on.
- Now, let's build the **Workflow Host**. Open the **WorkerRole.cs** file and read on.

- Once a message is received from the queue, the workflow xaml is read from the text file (ideally from database). The following code creates a new instance of `WorkflowApplication`. Note that we have also passed `ChannelData` object as argument to workflow.

```c#
var workflowApplication =
    new WorkflowApplication(
Routines.CreateWorkflowActivityFromXaml(workflowXaml, this.GetType().Assembly),
new Dictionary<string, object> { { "ChannelData", channelData } });
```

- Next, we apply the various settings to our workflow host which mainly include setting up the instance store and attaching event handlers to the various events. The most important event handler here is the `PersistableIdle` event. This event gets invoked when an activity bookmarks its state. At this point we need to unload the workflow and add a message to the queue that the workflow host is listening on with the updated ChannelData object so that when the bookmark resumes we can pass the updated information back to the workflow.

```c#
//// Setup workflow execution environment.
//// 1\. Make the workflow synchronous
workflowApplication.SynchronizationContext = new SynchronousSynchronizationContext();

//// 2\. Initialize instance store with instance identifier.
this.repository = new AzureTableStorageRepository<InstanceData>(
"instanceStore",
CloudConfigurationManager.GetSetting("WorkflowStorage"));
this.repository.CreateStorageObjectAndSetExecutionContext();
var instanceStore = new UnstructuredStorageInstanceStore(
this.repository,
workflowId,
this.AddBookmarkMessage);

//// 3\. Assign this instance store to WFA
workflowApplication.InstanceStore = instanceStore;

//// 4\. Handle persistable idle to remove application from memory.
//// Also, at this point we need to add message to host queue to add message signaling that bookmark has been added.
workflowApplication.PersistableIdle = persistableIdleEventArgument =>
{
    //// Check whether the application is unloading because of bookmarks.
    if (persistableIdleEventArgument.Bookmarks.Any())
    {
        Trace.Write(
            Routines.FormatStringInvariantCulture(
                "Application Instance {0} is going to save state for bookmark {1}",
                persistableIdleEventArgument.InstanceId,
                persistableIdleEventArgument.Bookmarks.Last().BookmarkName));
    }

    return PersistableIdleAction.Unload;
};
```

- The `AddBookmarkMessage` method is responsible for adding bookmark message to the queue. Note that `WorkflowIdentifier` (necessary to identify the workflow instance) remains the same and an additional flag `IsBookmark` is used to differentiate between a new workflow and a bookmarked workflow.

```c#
private void AddBookmarkMessage(Guid workflowId)
{
    var hostQueueMessage = new HostQueueMessage
                               {
                                   IsBookmark = true,
                                   WorkflowIdentifier = workflowId,
                                   PersistentPayload = this.arrivedMessage.PersistentPayload,
                                   ItemList = this.arrivedMessage.ItemList
                               };
    var message = new BrokeredMessage(hostQueueMessage);
    message.Properties.Add("workflowName", "CopyDocsToContainer");
    this.Client.Send(message);
}
```

- If the workflow is bookmarked, we follow a similar methodology of composing a workflow as we followed for composing a new one, but use `ResumeBookmark` function to resume the execution of the workflow.

```c#
//// Prepare a new workflow instance as we need to resume bookmark.
var bookmarkedWorkflowApplication =
    new WorkflowApplication(
        Routines.CreateWorkflowActivityFromXaml(
            workflowXaml,
            this.GetType().Assembly));
this.SetupWorkflowEnvironment(
    bookmarkedWorkflowApplication,
    channelData.Payload.WorkflowIdentifier);

//// 9\. Resume bookmark and supply input as is from channel data.
bookmarkedWorkflowApplication.Load(channelData.Payload.WorkflowIdentifier);

//// 9.1\. If workflow got successfully completed, remove the host message.
if (BookmarkResumptionResult.Success
    == bookmarkedWorkflowApplication.ResumeBookmark(
        bookmarkedWorkflowApplication.GetBookmarks().Single().BookmarkName,
        channelData,
        TimeSpan.FromDays(7)))
{
    Trace.Write(
        Routines.FormatStringInvariantCulture("Bookmark successfully resumed."));
    this.resetEvent.WaitOne();
    this.Client.Complete(receivedMessage.LockToken);
    return;
}
```

This is it. We have everything we need. Just supply the necessary connection strings in the configuration files of the **TestApplication** and the **WorkflowOnAzure** cloud service and put some files in the source container.

### Output

I put a few files in my source container, including some document files.

{{< img src="9.png" alt="WorkflowOnAzure Output 1" >}}

Ran the workflow application and...

{{< img src="10.png" alt="WorkflowOnAzure Output 2" >}}

Cool!! Isn't it. I hope you get to use it in your projects. Code Well!! See you soon...er :-)

{{< subscribe >}}
