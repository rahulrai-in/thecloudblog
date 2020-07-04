---
title: "Adding Business Logic to Azure Logic App with Azure API App"
date: 2015-10-13
tags:
  - azure
  - compute
---

I hope you had a chance to watch or attend [AzureCon](https://azure.microsoft.com/en-us/azurecon/) lately. If you watch the keynotes, you would be overwhelmed by tons of great announcements that were made. All the sessions are available [on demand](https://azure.microsoft.com/en-us/azurecon/) and are classified by level and industry role. I hope the sessions prove to be a great learning experience for you. I also hope to work with a few of the new features and write about them for us to use.

What I would like to discuss today is about a nifty feature of [Logic App](https://azure.microsoft.com/en-in/services/app-service/logic/).  You can extend your [Logic App](https://azure.microsoft.com/en-in/services/app-service/logic/) workflow by adding Web APIs or [API Apps](https://azure.microsoft.com/en-in/services/app-service/api/) in it. This feature gives you complete control over your application business logic and gives you freedom to only write code for any custom transformation or data manipulation which might not be available out of the box and rely on the various [Logic App connectors](https://azure.microsoft.com/en-in/documentation/articles/app-service-logic-connectors-list/) for the rest of the data flow. This combination of Logic App connectors (which are actually API Apps) and your own API Apps can solve many integration scenarios.

## What are Logic Apps?

In day to day scenario applications just orchestrate data. [Logic Apps](https://azure.microsoft.com/en-in/services/app-service/logic/) are a mechanism to automate business processes without requiring the developers to write code for such orchestrations. If you are familiar with BizTalk, you would find that Logic Apps are very similar to [BizTalk orchestration](https://msdn.microsoft.com/en-us/library/aa995577.aspx). Just as you can use different shapes to create a business process workflow in BizTalk, so too you can use the connectors from the Marketplace or your own API Apps, represented graphically in Logic Apps, to create a workflow. Logic Apps allow developers to design workflows that start from a trigger and then execute a series of steps, each invoking an App Service API App whilst securely taking care of authentication and best practices like check pointing and durable execution.

In simple terms, Logic Apps are workflows that you can create in a graphical way to articulate business logic. Logic Apps can communicate with external systems to receive or send data or even trigger its execution. In essence, Logic App is an orchestration of various connectors and your own API Apps.

## Let’s Build a Sample

I will demonstrate how you can extend a Logic App by adding your own API App to a Logic App. Although, we would be building a new [API App](https://azure.microsoft.com/en-in/services/app-service/api/) in this sample, if you want to plug an existing Web API into your Logic App, you would need to follow the steps mentioned [here](https://azure.microsoft.com/en-in/documentation/articles/app-service-dotnet-create-api-app-visual-studio/).  Let’s build a sample that lists the files in One Drive root folder and sends an HTML formatted email to the user.

### Create a Logic App and Add OneDrive Connector

From the Azure Management Portal, click **+ New** at the bottom-left of the screen, expand **Web + Mobile**, then click **Logic App**. Supply the basic details required to create your App.

{{< img src="1.png" alt="Create Logic App" >}}

Once your Logic App is created, open the Logic App that you just created and click on **Edit** to launch the designer blade.

{{< img src="2.png" alt="Edit Logic App" >}}

In the designer blade you would see options for creating a Logic App from the various templates provided by Microsoft. Click on **Create from Scratch** to launch an empty designer blade. The designer blade will have a **Start Logic** card by default. You may add a trigger to launch the Logic App workflow or execute it on demand. For the sample, check the **Run the logic manually** checkbox to make the logic execute on demand.

You will find API Apps that are available to you either because they are deployed in your subscription or because they are available from the Marketplace in the API Apps window on the right hand side of the designer. Add OneDrive connector from the Marketplace in your Logic App. The connector will ask you for your credentials and request for authorization the first time. Provide the necessary credentials to enable the connector. You can read more about OneDrive connector [here](https://azure.microsoft.com/en-us/documentation/articles/app-service-logic-connector-onedrive/). In the OneDrive connector card, select **List Files** action. You will be asked to provide path to a folder in the **Folder Path** field.The files inside this folder would be listed by the OneDrive connector. Type **“/”** for the root folder path in the **Folder Path** field. Click on the check mark to save your changes. At the end of the operation, you should be able to see the summary of the card. Click **Save** to save the workflow.

{{< img src="3.png" alt="OneDrive Connector Summary" >}}

Close the designer blade and execute the workflow at this point by clicking on **Run Now** to see if everything works fine till this point. You can get the response generated by executing this workflow from the **All Runs** tile inside your Logic App tile. Click on the relevant run and then on “**microsoftonedriveconnector**” to get the input and output of the connector. We will use this output to build our API App.

### Create OneDrive Service API App

The complete code for the API App is available for download here.
{{< sourceCode src="https://github.com/rahulrai-in/OneDriveService" >}}

In Visual Studio create a new API App from ASP.net Web Project Template (requires Azure SDK).

{{< img src="4.png" alt="API App Template Visual Studio" >}}

Add a new class `OneDriveConnectorRequest` in the Models folder and write the following code in it. As you might have already guessed, this is the same format in which OneDrive connector provides its output.

```CS
public class OneDriveConnectorRequest
{
    public string FileName { get; set; }
    public object FolderPath { get; set; }
    public object LastModifiedUtc { get; set; }
    public object FileSizeInBytes { get; set; }
    public string FilePath { get; set; }
}
```

Next, replace the template code in Values controller with the following code. This code will place the OneDrive connector output in a local variable and expose that data formatted as HTML for Office365 connector, which we will add soon.

```CS
public class ValuesController : ApiController
{
    private static OneDriveConnectorRequest[] files;

    // GET api/values
    public string Get()
    {
        var data = "<h1>Files in Your OneDrive</h1>";
        foreach (var value in files)
        {
            data += "<p>" + value.FileName + "</p>";
        }

        return data;
    }

    // POST api/values
    public void Post([FromBody]OneDriveConnectorRequest[] value)
    {
        files = value;
    }
}
```

Its time to publish your API. Right click on your project and click on **Publish**. Select **Microsoft Azure API App** from the menu and follow the steps to create a new API App and subsequently deploy the App to Azure.

{{< img src="5.png" alt="API App Publish Dialog" >}}

Once your API App gets published, navigate back to the Logic App workflow. You would find your App listed in the API App window.

{{< img src="6.png" alt="Listed API Apps" >}}

Click on your API App to add it to the workflow. Click on **Values_PostByValue** action. Your function expects data in the **value** parameter. Write`@body(‘microsoftonedriveconnector’)` in the text box to bind the input to OneDrive connector output. Click the check mark to save the changes.

Now add another card of your API App in the workflow. We will use this connector to query the data in the API App and bind its output to the Office 365 connector. Click on **Values_Get** and click the check mark to save the changes.

### Add Office 365 Connector

Select Office365 Connector from the API Apps list. When the card gets added, it will ask for authorization. Provide your credentials to enable the connector (**Tip**: If you miss authorizing the connectors the first time, you can click on the three dots on the relevant connector tile and select **Authorize this action** and click on the **Authorize** button). Select **Send Email** action and fill the **To** and **Subject** field with the recipient’s email and subject message. In the **Body** field write `@body(‘onedriveservice0’)` (or whatever is the name of your second connector. You can get this field populated automatically by clicking on the three dots next to the parameter field). Click on the three dots in the parameter list to expand it. Find **Is HTML** parameter and set its value to true. Click on the check mark and then on **Save** to save the workflow. Now your workflow should look similar to the following.

{{< img src="7.png" alt="Workflow" >}}

## Showtime

Now the App is ready to be tested. Close the designer blade and click on **Run Now** to execute the Logic App. Following is the mail  that I received.

{{< img src="8.png" alt="sample response" >}}

I hope you liked building this. How was your experience working with Logic Apps? Let me know in the comments below. See you soon! Happy Exploring!

{{< subscribe >}}
