---
title: "Analyze ELMAH Logs of Your Cloud Services on Your Desktop in Real-Time With Azure Files"
date: 2016-05-04
tags:
  - azure
  - storage
comment_id: 6109dcd8-f807-420c-87d1-1227232db296
---

[Azure File storage](https://azure.microsoft.com/en-in/documentation/articles/storage-dotnet-how-to-use-files/) is a lesser used and lesser known features of Azure storage. Azure File storage offers shared storage for applications using the standard SMB 2.1 or SMB 3.0 protocol. Microsoft Azure virtual machines, cloud services, and on-premises clients can share file data across application components via mounted shares or via File storage API. The most popular use cases of Azure File storage revolve around migrating existing applications to the cloud that use standard file system APIs such as `WriteFile` or `ReadFile`. Microsoft Azure File storage service lets you access SMB shares in the cloud without having to configure Windows Server virtual machines first, set up their networking and then create file shares. Since high availability and fault tolerance are taken care of by Azure, your applications can reliably read files from and write files to a shared storage (in several scenarios this helps existing applications become stateless). Azure File storage can act as cloud [NAS](https://en.wikipedia.org/wiki/Network-attached_storage) since it supports SMB protocols.

## What is ELMAH?

[ELMAH](https://msdn.microsoft.com/en-us/library/aa479332.aspx?f=255&MSPPError=-2147217396) is an awesome error logging module which is used in several high profile applications such as [Stack Overflow](http://blog.codinghorror.com/exception-driven-development/). Once ELMAH is installed into your [ASP.NET web application](https://www.nuget.org/packages/elmah/) or [ASP.NET MVC web application](https://www.nuget.org/packages/Elmah.MVC/) through Nuget, you get the following facilities without changing a single line of your code:

- Logging of nearly all unhandled exceptions.
- A web page to remotely view the entire log of recoded exceptions.
- A web page to remotely view the full details of any one logged exception.
- In many cases, you can review the original [yellow screen of death](http://en.wikipedia.org/wiki/Yellow_Screen_of_Death#ASP.NET) that ASP.NET generated for a given exception, even with <tt>customErrors</tt> mode turned off.
- An e-mail notification of each error at the time it occurs.
- An RSS feed of the last 15 errors from the log.
- A number of [backing storage implementations](https://elmah.github.io/) for the log, including in-memory, Microsoft SQL Server and several contributed by the community.

## Objective

We will build a simple Azure Cloud Service project with ELMAH integrated into it. We will configure ELMAH to write error logs to an Azure File storage mounted file share. We will then mount the same file share on our Windows 10 machine and read the logs from the ELMAH Log Analyzer application.

## Code

Download the source code of this sample by clicking on the button below. {{< sourceCode src="https://github.com/rahulrai-in/persistentfilelogging" >}}

## Let's Start

- **Create a Storage Account**

The first step is to create an Azure storage account. Navigate to the portal and create a new storage account. Click on **Files** to see the list of file shares associated with this account.

{{< img src="1.png" alt="Create Storage Account" >}}

In the list of file shares blade, create a new file share by setting a name and bandwidth quota for the file share. Once your file share is created click on the file share name to navigate to the file share blade. The **Connect** option on the top pane will show you the command you can use to connect your machine to the Azure File storage (which is a shared resource).

{{< img src="2.png" alt="View Connection Information for Azure File Storage" >}}

Copy this command and replace the drive letter and the storage account access key with actual values. When you execute this command from an SMB 3.0 supported windows desktop machine (Windows 8+), it will create a mounted storage drive with the specified drive letter. For this sample, this is what the command is for me.

```c#
net use Z: \\smb3share.file.core.windows.net\myfileshare /u:smb3share [storage account access key]
```

- **Create a Cloud Service Application**

We will now create and deploy an Azure Cloud Service that will save ELAMH logs to a file storage location. We will mount the previously provisioned file store on the cloud service VM so that ELMAH can write files to it using its inbuilt backing store implementation without requiring us to make any changes to ELMAH or the application.

In your Visual Studio, create a new Azure Cloud Service project and name it **PersistentFileLogging**.

{{< img src="3.png" alt="Create Persistent File Logging Project" >}}

Now, add a web role in the solution and name it **LoggingWebApplication**.

{{< img src="4.png" alt="Logging Web Application" >}}

In the project template that unfolds, select MVC as the project type and install ELMAH.MVC nuget package in the project. Enable ELMAH to log errors to file store and allow remote access to ELMAH logs (not recommended for production deployments) through the following configuration in web config.

```xml
<elmah>
  <security allowRemoteAccess="true"/>
  <errorLog type="Elmah.XmlFileErrorLog, Elmah" logPath="Z:/temp/Activity"/>
</elmah>
```

Once completed, throw an error from any controller in the application so that you can test the application after you deploy it.

Now we need to mount the previously provisioned Azure File storage on the VM. The Azure Storage team has blogged about a way you can do so for the Cloud Services [here](https://blogs.msdn.microsoft.com/windowsazurestorage/2014/05/26/persisting-connections-to-microsoft-azure-files/). The code essentially pinvokes `WNetAddConnection2` to establish a mapping between a local drive letter and an Azure File share. To do so, replace the code in the **WebRole.cs** file with the following code and replace the placeholder texts from the `MountShare` function call.

```c#
public class WebRole : RoleEntryPoint
{
    public override bool OnStart()
    {
        MountShare("\\\\YOUR STORAGE ACCOUNT NAME.file.core.windows.net\\YOUR FILE SHARE NAME",
       "Z:",
       "USER NAME",
       "STORAGE ACCOUNT KEY");
        return base.OnStart();
    }

    public static void MountShare(string shareName, string driveLetterAndColon, string username, string password)
    {
        if (!String.IsNullOrEmpty(driveLetterAndColon))
        {
            // Make sure we aren't using this driveLetter for another mapping
            WNetCancelConnection2(driveLetterAndColon, 0, true);
        }

        NETRESOURCE nr = new NETRESOURCE();
        nr.dwType = ResourceType.RESOURCETYPE_DISK;
        nr.lpRemoteName = shareName;
        nr.lpLocalName = driveLetterAndColon;

        int result = WNetAddConnection2(nr, password, username, 0);

        if (result != 0)
        {
            throw new Exception("WNetAddConnection2 failed with error " + result);
        }
    }

    [DllImport("Mpr.dll", EntryPoint = "WNetAddConnection2", CallingConvention = CallingConvention.Winapi)]
    private static extern int WNetAddConnection2(NETRESOURCE lpNetResource, string lpPassword, string lpUsername, System.UInt32 dwFlags);

    [DllImport("Mpr.dll", EntryPoint = "WNetCancelConnection2", CallingConvention = CallingConvention.Winapi)]
    private static extern int WNetCancelConnection2(string lpName, System.UInt32 dwFlags, System.Boolean fForce);

    [StructLayout(LayoutKind.Sequential)]
    private class NETRESOURCE
    {
        public int dwScope;
        public ResourceType dwType;
        public int dwDisplayType;
        public int dwUsage;
        public string lpLocalName;
        public string lpRemoteName;
        public string lpComment;
        public string lpProvider;
    };

    public enum ResourceType
    {
        RESOURCETYPE_DISK = 1,
    };
}
```

We are done with the code. Let's deploy the application to Azure. Create an Azure Cloud Service in the Azure portal that will host the application.

{{< img src="5.png" alt="Persistent File Logging Application" >}}

Deploy the application to the Cloud Service that you created and let it log some errors. You can view the ELMAH logs at [http://{cloud service name}.cloudapp.net/elmah](http://{cloud service name}.cloudapp.net/elmah).

{{< img src="6.png" alt="Application Error ELMAH" >}}

- **View ELMAH Logs on Your Desktop**

The last step is to mount the previously provisioned Azure File storage on your desktop and view the application logs. Do you remember the connection command that we copied from the storage account that we provisioned earlier? Its time to use that. Start the command prompt and execute the `net use` command. Once the command successfully completes, you will find the Azure File store mounted on your system. One of the frequently encountered gotchas is that your firewall and ISP should allow traffic to pass through SMB over TCP port - 445.

{{< img src="7.png" alt="Azure File Share in Explorer" >}}

Browse through the storage and use [ELMAH Log Analyzer](https://code.google.com/archive/p/elmah-loganalyzer/) to view the logs on your system.

{{< img src="8.png" alt="Elmah Log Viewer" >}}

## Why It Works On a Cloud Service\VM And Not On an Azure Web App?

Azure Web Apps do not work with elevated permissions that are required to make platform calls to DLLs. Using Azure Files with Web App is a requested feature and might be supported soon. Following is the output that you will get if you try to host the application as a Web App.

{{< img src="9.png" alt="Azure Website Not Running in Elevated Mode" >}}

This exception occurs when the application does not have sufficient privilege to make PInvoke calls.

There are countless scenarios that can be realized with a shared and hybrid file storage on cloud. What scenarios are you planning to address with this feature? Let me know in the comments section below. Thank you!

{{< subscribe >}}
