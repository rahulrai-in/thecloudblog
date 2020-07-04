---
title: "Deploying Guest Executables to Azure Service Fabric"
date: 2017-03-09
tags:
  - azure
  - service fabric
---
One of my most popular blog posts on this site is [Hands-on with Azure Service Fabric Reliable Services](/post/hands-on-with-azure-service-fabric-reliable-services/). Referring to the blog post, many readers asked me about guidance to deploy various types of applications as [Guest Executables](https://docs.microsoft.com/en-us/azure/service-fabric/service-fabric-deploy-existing-app) on Service Fabric. In this post, I will try to answer most of those questions by demonstrating the process in a simple manner.

## The Application

We previously built a simple [node.js application that uses Azure SQL Database](/post/Use-Support-Backed-Tedious-Driver-for-Your-Node-Applications-with-SQL-Database/) as data store. I will demonstrate how we can deploy that application to Service Fabric as a Guest Executable. However, none of the steps that I am going to follow are specific to node.js. You can select an application built using any other programming language e.g. Java and follow the same steps to deploy your application (with some changes depending on your application) as a Guest Executable on Service Fabric.

One thing to be cognizant of while selecting an application for the purpose is that your application should be stateless in nature because Guest Executables are deployed as stateless services, i.e. an instance of your application will run on every node in the Service Fabric cluster.

## The Code

I understand that you need sample code to refer to (a.k.a copy & paste). Here is the sample application that you can clone or download.
{{< sourceCode src="https://github.com/rahulrai-in/phonebookonservicefabric" >}}

## The Tools

I recommend using Visual Studio to package your application for the ease that it offers. However, you can [manually package your application](https://docs.microsoft.com/en-us/azure/service-fabric/service-fabric-deploy-existing-app#manually) as well. Either of the approaches will create a folder structure that is similar to the following:

```
|-- ApplicationPackageRoot
    |-- GuestServicePkg
        |-- Code
            |-- Application Files
        |-- Config
            |-- Settings.xml
        |-- Data
        |-- ServiceManifest.xml
    |-- ApplicationManifest.xml
```

To create a Guest Executable package using Visual Studio, create a new **Service Fabric** project and select **Guest Executable** from the dialog that follows:
{{< img src="1.png" alt="Create Guest Executable Project" >}}

Let's fill the required values in this dialog.

1. **Code Package Folder**: You need to supply the path to the folder where your application binaries live. None of the files outside this folder should contain your application binaries as they will not be deployed to Service Fabric.
2. **Code Package Behavior**: For most of the cases, you should set this option to _Add link to external folder_. That way only a link to the folder that you previously specified would exist and files won't be copied to the project that you are currently creating. This helps when you need to redeploy the application at a later point of time with updated code.
3. **Program**: You can specify the name of the program (an exe, bat, ps1 etc.), present inside the folder that you previously specified, that should be run to launch your application. You may leave this field empty for now.
4. **Arguments**: The arguments that should be passed to the program above. It can be a list of parameters with arguments. You may leave this field empty for now.
5. **WorkingFolder**: The folder that you specify here becomes the working directory for the Guest Executable process that is going to be started. You can specify one of three values here:

   - **CodeBase**: Sets the working directory to the Code folder (or whatever is the name of the code folder). I have selected this option for the application that I am going to deploy.

   - **CodePackage**: Sets the working directory to GuestServicePkg (or whatever is the name of the package folder).

   - **Work**: Sets the working directory to a subdirectory called **work**. If you choose this option, you will need to create this folder and place all your binaries inside it.

## Preparing The Application <a name="prepare-application"></a>

You might need to install certain dependencies on the node to make your application work. Such dependencies may include installing servers or other software that your application uses. If this is the case, create a script (ps1, cmd, bat etc.) that downloads and installs these dependencies on a VM. You should test the script on a VM several times to check whether the script executes successfully and requires no manual input.

I generally use a package manager to carry out dependency installations. [Chocolatey](https://chocolatey.org/) is one of the popular package managers that can take care of installing dependencies on a Windows VM for you. You can install Chocolatey on your VM by invoking [this script](https://chocolatey.org/install) and later install components on VM using it.

If you can't find the necessary packages on your favorite package manager, you may also include the components in the code folder and refer the components from your installer script, as the resources will be available in the deployed package.

## Launching The application

After installing the dependencies, you would want your application to be launched. Prepare another script that Service Fabric can use to launch your application. This script would be executed after the script that was used to install dependencies. Again, test this script multiple times on a VM to ensure that by running the script, your application does launch successfully.

## Elevated Privileges

Installing the dependencies or launching the application may require elevated privileges. I feel it is better to keep this option turned on rather than face incomprehensible errors at startup. To set this up, you need to add a user to the _Administrators_ system group and set a policy to run the scripts using the created user's principal. Navigate to **ApplicationManifest.xml** and add the following section to the file to add a user named _SetupAdminUser_ to the _Administrators_ group.

```xml
<Principals>
<Users>
    <User Name="SetupAdminUser">
    <MemberOf>
        <SystemGroup Name="Administrators" />
    </MemberOf>
    </User>
</Users>
</Principals>
```

Now add a `RunAs` policy to the manifest that ensures that all scripts execute under the _SetupAdminUser_'s principal. You can change the `EntryPointType` to `Setup` or `Main`, if you don't want to execute all scripts with elevated privileges.

```xml
<Policies>
    <RunAsPolicy CodePackageRef="Code" UserRef="SetupAdminUser" EntryPointType="All" />
</Policies>
```

## The ServiceManifest

In this file, you prepare the environment for your application. Let's configure the elements in this file.

- **The UseImplicitHost Setting**: This setting tells Service Fabric that the service is based on a self-contained app, so all Service Fabric needs to do is to launch it as a process and monitor its health.
- **SetupEntryPoint**: If you have any installations that you need to carry out ([see above](#prepare-application)), you need to write the name of the script and its arguments here. Note that this script would be invoked every time the node restarts, therefore this script needs to be idempotent.

```xml
<SetupEntryPoint>
	<ExeHost>
	<Program>YOUR SCRIPT NAME</Program>
	<Arguments>ARGUMENTS</Arguments>
	<WorkingFolder>CodePackage</WorkingFolder>
	</ExeHost>
</SetupEntryPoint>
```

- **EntryPoint**: Specify the command that needs to be executed to launch your application. Since, node.js doesn't require any installations and requires just _node.exe_ to be invoked with the root javascript file, I will specify the _node.exe_ executable as the program to be invoked with path to _server.js_ as the argument.

```xml
<EntryPoint>
	<ExeHost>
	<Program>node.exe</Program>
	<Arguments>server.js</Arguments>
	<WorkingFolder>CodePackage</WorkingFolder>
	</ExeHost>
</EntryPoint>
```

- **Endpoints**: If your application requires any endpoints, you can specify them here. My application responds to requests on port 3000. So, I will specify the port by adding an endpoint in the `Endpoints` section.

```xml
<Endpoints>
    <Endpoint Name="External" Port="3000" Protocol="http" Type="Input" UriScheme="http" />
</Endpoints>
```

## Troubleshooting

Deploy the application on the emulator to validate the settings. If you messed up something somewhere, you may get to see a horrible message in SFX (Service Fabric Explorer) without context.

> Error event: SourceId='System.Hosting', Property='CodePackageActivation:Code:EntryPoint'.
> There was an error during CodePackage activation.The service host terminated with exit code:1

{{< img src="2.png" alt="Error in Activation" >}}

If you get stuck with this error, there are a couple of things you can do.

1. **Logging**: Add `ConsoleRedirection` in _ServiceManifest.xml_ to log console output (both stdout and stderr) to a working directory. After you have done so, in SFX you can navigate to **Nodes > \_Node_N > fabric:/GuestApplication** and find **Disk Location** on the right-hand side. In the folder, you will find a **logs** folder that contains the logs generated by your application.
2. **Event Log**: Service Fabric logs events in the event log which you can filter and read.
3. **PerfView**: You can collect ETW logs using [PerfView](https://www.microsoft.com/en-us/download/details.aspx?id=28567) if you are using .net. Run it, go to "Collect -> Collect". De-Select "Merge". Click "Start Collection". Now kill your service fabric service in task explorer. Moments later, Service Fabric will start it again. After it failed, "Stop collection" in PerfView. Now double-click on "Events" in the left tree - this will open all recorded ETW events. Search for "Microsoft-Windows-DotNETRuntime/Exception/Start" and double click on it. You should see all .NET exceptions that occurred, ordered by time.

## Works ~~on My System~~ on Cloud

I deployed my application to my Service Fabric cluster on Azure and here is the landing page.

{{< img src="3.png" alt="Guest Executable on Cloud" >}}

{{< subscribe >}}
