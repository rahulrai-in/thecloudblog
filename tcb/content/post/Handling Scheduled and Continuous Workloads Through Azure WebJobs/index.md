---
title: "Handling Scheduled and Continuous Workloads Through Azure WebJobs"
date: 2015-08-26
tags:
  - azure
  - app service
comment_id: ac55e3d0-8c17-47f7-9903-e46d14b8c753
---

## What are WebJobs?

If you have ever built an application of anything more than small scale, you know that you need to have services running in the background that can handle workloads that either are required to execute in the background or are required to run on scheduled intervals. There are several solutions available for this problem in on-premise and cloud worlds. You can use a windows service or have an HTTP endpoint triggered by a cron service such as [Windows Task Scheduler](http://windows.microsoft.com/en-in/windows/schedule-task) to schedule a task. For [Microsoft Azure](https://azure.microsoft.com/) deployments, if your demands are more biased towards PaaS flavors, you can use [worker roles](https://azure.microsoft.com/en-us/documentation/articles/fundamentals-application-models/#tell-me-about-cloud-services), which come deployed in their own virtual machines, to continuously keep executing workloads in the background. For IaaS based workloads, you may choose to deploy “cron” services and jobs on VMs or install your Windows Services on VMs.

All the approaches mentioned above carry a ton of overhead and have some associated costs as they require their own VMs to execute in. For a small to moderate workload, such as a script or executable, that you want to either execute at certain intervals or run continuously, Azure [WebJobs](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) are a simple and quick solution. The best thing is that they have no costs associated with them (**FREE!!**). If you have a nicely designed web application which has some CPU cycles and some bandwidth to spare, you can use the unused infrastructure to execute small workloads in the background by piggybacking a [WebJob](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) on your [WebApp](http://azure.microsoft.com/en-us/services/app-service/web/). I use [WebJobs](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) for sending out mails to you when you register (a triggered workload) or when I post a new blog (a triggered workload) or clean up the subscriber list(a scheduled workload). [WebJobs](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) execute within the context of your [WebApp](http://azure.microsoft.com/en-us/services/app-service/web/) therefore, you don’t need to configure connection strings or application settings in the configuration files of [WebJob](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) if you have provisioned the settings already in the associated [WebApp](http://azure.microsoft.com/en-us/services/app-service/web/). For deployment, you can keep enjoying the benefits of continuous deployment though [Visual Studio](https://azure.microsoft.com/en-in/documentation/articles/cloud-services-continuous-delivery-use-vso/) or [GIT](https://azure.microsoft.com/en-in/documentation/articles/web-sites-publish-source-control/). To make a [WebJob](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) execute, you just need to place the job binaries in the proper location within the web application. Exploiting this very feature, people have come up with solutions to deploy [WebJobs](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) through FTP etc. such as one [here](http://blog.amitapple.com/post/74215124623/deploy-azure-webjobs/#.VdsrWPmqpBc).

You can run programs or scripts in [WebJobs](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) in your [App Service](http://go.microsoft.com/fwlink/?linkid=529714&clcid=0x409) web app in three ways: **on demand**, **continuously**, or on a **schedule**. The following is how I use WebJobs to send emails to my subscribers and perform a nightly cleanup of my subscriber list.

{{< img src="1.png" alt="WebJobArchitecture" >}}

The New Subscriber workflow follows the path marked in **green** and works as follows:

1.  When I post a new blog, the web application pushes the blog content to table storage and puts a message in “NewBlogPost" queue.
2.  The MailWorker Job picks up the message and get the subscribers from the Subscriber table.
3.  The MailWorker sends email to all the subscribers.

A similar process is followed for adding a new subscriber in which another function in MailWorker gets activated to send mails to new subscribers.

The Cleanup process follows the path marked in **red** and works as follows:

1.  When a new subscriber places a request to join, the web application pushes subscriber data to table storage and puts a message in “NewSubscriber” queue.
2.  The cleanup worker gets triggered every night and removes users who have not validated their email in the last seven days.

## How to Create a WebJob?

There are multiple ways in which you can create a WebJob. The popular ones are:

1.  [By uploading job package through the Azure portal](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/).
2.  [By using Visual Studio to create a new WebJob project or add an existing application as a WebJob project to WebApp](http://blogs.msdn.com/b/webdev/archive/2014/11/12/new-developer-and-debugging-features-for-azure-webjobs-in-visual-studio.aspx).

In the above links, the steps to create and configure WebJobs are fairly detailed and easy to follow. However, I would like to point out that when you use Visual Studio to create a [WebJob](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) project, a JSON file named **webjobs-list.json** will get added inside the **Properties** folder of your WebApp. This is an intellisense supported file which you can edit in case you change the location of your projects. If you want to see where the scheduling information is stored, navigate to the **Properties** folder of your [WebJob](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/) and locate the **webjob-publish-settings.json** file. This file won’t have any scheduling information for a continuous job or for an on demand job and will be populated with the values you selected in the wizard for recurring jobs.

{{< img src="2.png" alt="SolutionStructure" >}}

Another point I would like to mention here is that when you deploy a recurring job, an [Azure Scheduler](http://azure.microsoft.com/en-in/services/scheduler/) instance gets enabled with the scheduling values that you supply. This scheduler is responsible for triggering your recurring [WebJob](https://azure.microsoft.com/en-in/documentation/articles/web-sites-create-web-jobs/).

{{< img src="3.png" alt="Scheduler" >}}

## WebJobs SDK

Although, you can simply make an application executable or a script run as a WebJob, [WebJobs SDK](https://azure.microsoft.com/en-in/documentation/articles/websites-dotnet-webjobs-sdk/) greatly simplifies certain mundane activities for you and is a great time saver if you want to write a job that works with Azure Storage queues, blobs, and tables, and Service Bus queues. The [WebJobs SDK](https://azure.microsoft.com/en-in/documentation/articles/websites-dotnet-webjobs-sdk/) includes the following components:

- **NuGet packages**. NuGet packages that you add to a Visual Studio Console Application project provide a framework your code uses to work with the Azure Storage service or Service Bus queues.

- **Dashboard**. Part of the WebJobs SDK is included in the Azure App Service and provides rich monitoring and diagnostics for programs that use the NuGet packages. You don't have to write code to use these monitoring and diagnostics features.

The code for handling typical tasks that work with Azure Storage is simple. In a Console Application, you write methods for the background tasks that you want to execute, and you decorate them with attributes from the WebJobs SDK. Your `Main` method creates a `JobHost` object that coordinates the calls to methods you write. The [WebJobs SDK](https://azure.microsoft.com/en-in/documentation/articles/websites-dotnet-webjobs-sdk/) framework knows when to call your methods based on the WebJobs SDK attributes you use in them. The `JobHost` object is a container for a set of background functions. The `JobHost` object monitors the functions, watches for events that trigger them, and executes the functions when trigger events occur. You call a `JobHost` method to indicate whether you want the container process to run on the current thread or a background thread. In the example, the `RunAndBlock` method runs the process continuously on the current thread. You can supply the connection strings to to use in the configuration file of the associated WebApp and bind the strings to job host configuration in the code (while debugging, you need to provide the connection strings in the configuration file of the console application). Following is a sample of how to do that:

```cs
private static void Main()
{
    var configuration = new JobHostConfiguration
        {
            StorageConnectionString = ConfigurationManager.AppSettings[ApplicationConstants.StorageAccountConnectionString],
            DashboardConnectionString = ConfigurationManager.AppSettings[ApplicationConstants.StorageAccountConnectionString]
        };
    var host = new JobHost(configuration);
    host.RunAndBlock();
}
```

You can use the inbuilt triggers and binders to invoke functions in your WebJob. The trigger and binder features of the WebJobs SDK greatly simplify the code you have to write to work with Azure Storage and Service Bus queues. The low-level code required to handle queue and blob processing is done for you by the [WebJobs SDK](https://azure.microsoft.com/en-in/documentation/articles/websites-dotnet-webjobs-sdk/) framework -- the framework creates queues that don't exist yet, opens the queue, reads queue messages, deletes queue messages when processing is completed, creates blob containers that don't exist yet, writes to blobs, and so on.

The [WebJobs SDK](https://azure.microsoft.com/en-in/documentation/articles/websites-dotnet-webjobs-sdk/) provides many ways to work with Azure Storage. For example, if the parameter you decorate with the `QueueTrigger` attribute is a byte array or a custom type, it is automatically deserialized from JSON. And you can use a `BlobTrigger` attribute to trigger a process whenever a new blob is created in an Azure Storage account. (Note that while `QueueTrigger` finds new queue messages within a few seconds, `BlobTrigger` can take up to 20 minutes to detect a new blob. `BlobTrigger` scans for blobs whenever the `JobHost` starts and then periodically checks the Azure Storage logs to detect new blobs.). Following is how I use a trigger to capture New Post messages and get references to the and blog table and subscriber table. You can use Console Output functions to write messages to log and the WebJob dashboard.

```cs
public static void ProcessNewPostQueueMessage(
           [QueueTrigger(NewPostQueue)] string message,
           [Table(BlogTable)] CloudTable blogTable,
           [Table(SubscriberTable)] CloudTable subscriberTable)
       {
            Console.Out.WriteLine("New post message captured {0}", message);
            //// Code Left out for brevity.
       }
```

I would like to point out that you don’t need to keep renewing lease on the message. The SDK handles that automatically if your function takes longer than the time for which SDK has acquired lease on the message. Also, you can get the recent logs on your WebJob dashboard. You would find a link to get to the Azure Web Jobs Dashboard to the right of your job, but the format for the URL to access is this: [https://YOURSITE.scm.azurewebsites.net/azurejobs](https://yoursite.scm.azurewebsites.net/azurejobs). You'll need to enter your same credentials you've used for Azure deployment.

To create a scheduled job you may use the SDK  as a helper utility, however you don’t need a JobHost to host your application, you can simply build a console application and deploy it. You can find source code of my Cleanup WebJob [here](https://github.com/rahulrai-in/rahulrai). I encourage you to add this nifty utility to your arsenal when you are building applications for the cloud. Let me know your feedback in the comments section. See you soon!

{{< subscribe >}}
