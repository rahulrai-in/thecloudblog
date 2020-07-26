---
title: "Building a Reporting Application with Microsoft Azure RemoteApp"
date: 2015-08-10
tags:
  - azure
  - networking
---

Before I say anything else, let’s lay down a ground rule that I wish all blogs would follow: A sample that takes more than 30 minutes to get cranking up is a project. Get ready to learn about [Azure RemoteApp](https://azure.microsoft.com/en-us/documentation/services/remoteapp/) applications by building a SAMPLE that would be powered by [Microsoft Azure](https://azure.microsoft.com/).

> September 23, 2016: Remote App is being discontinued. Read the announcement [here](https://blogs.technet.microsoft.com/enterprisemobility/2016/08/12/application-remoting-and-the-cloud/).

## What is Azure RemoteApp?

The cloud world is pretty biased towards web applications. What does cloud offer for your Windows Applications that you want many people to use without you worrying about scaling the underlying infrastructure while still maintaining fine grained control over who gets access to which applications?

Answers to that question are critical when you want to save business costs and\or improve enterprise agility. For instance, you want to provision an application temporarily for some contractors, or, you have an enterprise application to enable your [mobile workforce](http://www.techopedia.com/definition/30249/mobile-workforce), which you want a managed set of people to access from any device, including phones. Another scenario might be that you are in are in the process of developing an application and you want to set up test benches for your testers and developers without having each one of them spend time setting up the applications themselves. Hosting your Windows applications on cloud can also help you with securing your application binaries as no one can copy your application binaries and simply walk away with them. There is no limit to scenarios that can be realized, if your windows applications run on cloud.

[Microsoft Azure](https://azure.microsoft.com/) allows you to deploy your windows applications in cloud and allows your users to use [Remote Desktop](http://windows.microsoft.com/en-in/windows/connect-using-remote-desktop-connection) (or RDP) to access these applications. This offering from Microsoft Azure is termed as [Azure RemoteApp](https://azure.microsoft.com/en-us/documentation/services/remoteapp/). Let us build a sample and take this service for a test drive. We will keep learning about the various facets of [Azure RemoteApp](https://azure.microsoft.com/en-us/documentation/services/remoteapp/) along the way.

## Sample Application

Since the most common scenario that most windows applications cater to is capturing user input and generating reports from that data after applying some manipulations, a decent sample application should be able to capture user input and generate a simple report from it. If we can do so within thirty minutes, [Azure RemoteApp](https://azure.microsoft.com/en-us/documentation/services/remoteapp/) would have proved its utility.

The sample application that we will build is a single form WPF application with two simple reports embedded in it. One of the reports will render how much each employee is earning and another report will render the fraction of income of each employee with respect to the overall compensation. You can use the steps mentioned [here](https://msdn.microsoft.com/en-us/library/hh273267.aspx) to create a simple WPF form with the report viewer embedded in it or download the sample application that I built from here. {{< sourceCode src="https://github.com/rahulrai-in/remoteappdemo" >}}I am using [VS 15 Community Edition](https://www.visualstudio.com/en-us/downloads/download-visual-studio-vs.aspx), .Net framework 4.0 and Microsoft Report Viewer 14 to build the application. The application will use a [Microsoft Azure SQL Database](http://azure.microsoft.com/en-in/services/sql-database/) to store data from which it would serve the report. I did not build a form to capture user data and I am sure you would appreciate the great lack of skills I have with respect to UX and design, but I will get better with time and I invite you to contribute to any sample that I have on [GitHub](https://github.com/rahulrai-in). Follow the steps as mentioned below:

1.  Create an empty [Microsoft Azure SQL Database](http://azure.microsoft.com/en-in/services/sql-database/) in your Azure account by following the steps mentioned [here](https://azure.microsoft.com/en-in/documentation/articles/sql-database-get-started/). Make sure that you have configured the firewall rules properly.
2.  Copy the database [connection string](https://azure.microsoft.com/en-in/documentation/articles/sql-database-dotnet-how-to-use/) from the portal.
3.  Use the connection string to populate the database with EmployeeSalary table by publishing the database project provided in the sample (take help of steps mentioned [here](<https://msdn.microsoft.com/en-us/library/hh272687(v=vs.103).aspx>)).
4.  Add some sample data to the EmployeeSalary table that you just created. I generally use Server Explorer available in VS itself as explained [here](<https://msdn.microsoft.com/en-us/library/hh272699(v=vs.103).aspx>).
5.  Paste the connection string in connection strings section of App.config file of RemoteAppDemo project.
6.  Start the RemoteAppDemo project on your local system. You should be able to see a screen that looks likes this:

{{< img src="1.png" alt="Report In Debug" >}}

Now that we have a sample application ready, let’s move it to a VM that will run on cloud. There are two ways to do this currently:

1.  Create your own VM based on the guidelines presented [here](https://azure.microsoft.com/en-us/documentation/articles/remoteapp-imagereqs/).
2.  Create RemoteApp images (which hold the apps you share in your collection) from an Azure virtual machine. The simplest way to do this is to use "Windows Server Remote Desktop Session Host" image available in the image gallery.

As a note, I would like to mention that if you want to migrate your applications to [Azure RemoteApp](https://azure.microsoft.com/en-us/documentation/services/remoteapp/), you should read the compatibility guidelines [here](https://azure.microsoft.com/en-us/documentation/articles/remoteapp-appreqs/). Now let’s create an Azure VM from "Windows Server Remote Desktop Session Host" image available in the image gallery. Steps for doing this are really simple:

1.  Log in to your [account](https://portal.azure.com/).
2.  Create VM using "Windows Server Remote Desktop Session Host" image from image gallery. If you need help creating VM using the image gallery, follow the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-windows-tutorial/).
3.  Once your VM finishes provisioning, log into your VM.
4.  Now you can either build an installer for your project using [ClickOnce](https://msdn.microsoft.com/en-us/library/31kztyey.aspx) or just copy paste your application binaries in system root directory (I pasted the Debug folder). It is recommended to use an installer when you are deploying in production environment.

{{< img src="2.png" alt="Paste App Binaries" >}}

The environment is pretty raw at the moment, you would need to install ReportViewer 14 by adding it as a [prerequisite](https://msdn.microsoft.com/en-us/library/8st7th1x.aspx) in ClickOnce deployment or by installing it from Microsoft Download Center. You would also need to make sure that correct .net framework is available on the server. One thing that tripped me is that SQL Server CLR Types were missing from the server which you can install from [here](http://www.microsoft.com/en-in/download/details.aspx?id=29065). Run your application within the VM to see if everything is still intact.

Now we just need to supply image of this VM to Azure RemoteApp. Navigate to the desktop on the VM and search for ValidateRemoteAppImage.ps script. Click to execute the script and proceed through the steps to validate server image and [sysprep](<https://technet.microsoft.com/en-us/library/cc721940(v=ws.10).aspx>) it. Following are the steps to create and configure your RemoteApp (if these steps change, refer this [link](https://azure.microsoft.com/en-us/documentation/articles/remoteapp-create-cloud-deployment/)):

1.  In the management portal, go to the RemoteApp page.
2.  Click **New > Quick Create**.
3.  Enter a name for your collection, and select your region.
4.  Choose the plan that you want to use - standard or basic.
5.  Choose the template (or image) that got created by executing the steps mentioned earlier for this collection.
6.  Click **Create RemoteApp collection**.

Now you need to tell [Azure RemoteApp](https://azure.microsoft.com/en-us/documentation/services/remoteapp/) that you want to publish your reporting application. From the RemoteApp publishing page, click **Publish** to add your program. Here you can publish either from the Start menu of the template image or by specifying the path on the template image for the app. Since we have pasted the binaries in system directory, we need to provide a name for the app and the path to where it is installed on the template image (don’t use drive names, use system variables such as %SYSTEMDRIVE%).

{{< img src="3.png" alt="Publish" >}}

The last step is to provide access to users.

1.  From the Quick Start page, click **Configure user access**.
2.  Enter the work account (from Active Directory) or Microsoft account (I used this in sample) that you want to grant access for. Make sure that you use the “user@domain.com” format.
3.  After the users are validated, click **Save**.

We are done. Ask your users to download RemoteApp client for their phones, tablets or desktop from the link mentioned on the dashboard of your RemoteApp and login using the identities you configured in the RemoteApp.

{{< img src="4.png" alt="Client" >}}

Enjoy their WOWs!! Here are some screenshots from my devices.

- Desktop and Tablet (Windows)

{{< img src="5.png" alt="Desktop" >}}

- Phone (Windows)

{{< img src="6.jpg" alt="Phone" >}}

{{< subscribe >}}
