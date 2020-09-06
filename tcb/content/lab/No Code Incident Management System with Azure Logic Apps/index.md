---
title: No Code Incident Management System with Azure Logic Apps
date: 2020-09-06
tags:
  - azure
  - integration
comment_id: 21d36559-4bae-48db-b707-48b7c6d68ed2
---

In this lab, we will create an [Azure Logic App](https://docs.microsoft.com/en-us/azure/logic-apps/logic-apps-overview) that monitors Twitter, analyzes the sentiment of customer tweets with [Text Analytics v2 service](https://azure.microsoft.com/en-au/services/cognitive-services/text-analytics/), and creates incidents in [Pager Duty](https://www.pagerduty.com/). PagerDuty is an incident management platform that provides reliable notifications, automatic escalations, on-call scheduling, and other functionality to help teams detect and fix problems quickly. This application can help customer service agents react swiftly to customer complaints and avoid brand reputation damages.

## Text Analytics Cognitive Service

You will require an active Azure subscription for building this project. If you do not have one, signup for a [free account here](https://azure.microsoft.com/en-in/free/). Next, you will need a Text Analytics API Key to access the sentiment analysis service. Enter the text "Text Analytics" in the search box on the Azure portal. From the search results, select the **Text Analytics** service.

{{< img src="1.png" alt="Search Text Analytics service" >}}

Next, add the required details to create an instance of the Text Analytics service as follows.

{{< img src="2.png" alt="Create Text Analytics service" >}}

Record the key and the URL of the service from the newly created service tenant. We will use these later when we compose our Logic App.

{{< img src="3.png" alt="Record Key and URL of the service" >}}

Let's now move on to create a Pager Duty account and service.

## Pager Duty Service

We require a [Pager Duty](https://www.pagerduty.com/) account for this application. Pager Duty comes with a 14-day trial that is sufficient for this demo. Sign up for a free Pager Duty account, follow the signup instructions, and log in to your account.

After logging in, as the next step, we will create a Pager Duty service. From the menu, click on **Configuration** and select the **Services** option.

{{< img src="4.png" alt="Navigate to Pager Duty services view" >}}

From the landing page, initiate the action to create a new service. On the **Add Service** form, enter the service's name and set the **Integration Type** to **Use our API directly**, which will enable our Logic App connector to interact with the service.

{{< img src="5.png" alt="Create new Pager Duty service" >}}

I like to think of Pager Duty services as teams that need to be notified in case of incidents. A service in Pager Duty is referenced through its **Integration Key**. To record the integration key, navigate to the Integrations tab from your service's dashboard, and save the 32-character service integration key.

{{< img src="6.png" alt="Save service integration key" >}}

Requests to Pager Duty are authorized with an **API Key**, which also uniquely identifies an account in Pager Duty. To generate an API key, click on the **Configuration** menu item and select the **API Access** option.

{{< img src="7.png" alt="Navigate to API Access view" >}}

On the next screen, click on the **Create New API Key** button and enter the name of the key. On submitting the form, you will ve able to view the new 16 character API key once. Save this key for use in our Logic App later.

{{< img src="8.png" alt="View Pager Duty API key" >}}

By now, we have provisioned and configured everything in Pager Duty. Let's now head back to the Azure Portal to create our Logic App.

## Logic App

In the Azure portal, search for the text "Logic App" to land on the Logic App dashboard. From the dashboard, proceed to create a new Logic App and fill in the details as shown in the screenshot below.

{{< img src="9.png" alt="Create new Logic App" >}}

Click on the **Review + create** button and approve the deployment of the application. Once the application is ready, navigate to the **Logic App Designer** view and select the **Blank Logic App** template.

{{< img src="10.png" alt="Choose the Logic App template" >}}

A Logic App workflow is initiated by a trigger. In our case, the trigger is a new tweet that contains the name of our dummy product - _BeetsEarbuds_.

In the search box of the trigger, enter the text "When a new tweet is posted" which will resolve to the trigger that we need. Click on the resulting action to begin configuring it.

{{< img src="11.png" alt="Twitter: new tweet posted trigger" >}}

Adding the trigger requires signing in to Twitter and authorizing the Twitter connector to read tweets. After authorizing the connector, you will be redirected to the designer. In the trigger action, enter the text that the Logic App should search, which is _BeetsEarbuds_, and set the search frequency to an appropriate interval. Next, click the **New Step** button to add the next action.

{{< img src="12.png" alt="Configure Twitter trigger" >}}

We will now try to detect the tweet's sentiment using the Text Analytics service that you previously created. Look up the text "Detect sentiment" and select the **Detect Sentiment (V2) preview** action from the result.

{{< img src="13.png" alt="Select the Detect Sentiment (V2) preview action" >}}

Grab the Text Analytics service details that you captured earlier and populate the fields **Account Key** and **Site URL** with those details. Assign a name to the connection by entering a valid string in the **Connection Name** field. Finally, click on the **Create** button to finish creating the connection.

{{< img src="14.png" alt="Configure Text Analytics connection" >}}

In the next view, you will be asked to supply a list of documents that you want to analyze with the Text Analytics service. The Text Analytics v2 action can simultaneously process multiple documents, which is a significant improvement over the V1 service. However, we will process only one tweet at a time, so we only need to supply a single document to this action. You can either use the **document** mode to enter the required values, as shown in the image below, or use the **raw input** mode to enter the following JSON text.

```json
[{"id": "1","text": "<Tweet text block using the expression helper dialog>","language": "en"}]
```

Both approaches would result in the same input to the Text Analytics service.

{{< img src="15.png" alt="Configure Text Analytics action" >}}

We will now add a condition to determine whether the tweet should result in the creation of an incident. Click on the **New Step** button and search for the text "Condition" in the actions dialog list. We will configure it so that it evaluates to true if the score computed from the previous step is less than 0.5. Earlier, we discussed that the **Detect sentiment v2** action can process several documents at once. Hence, it produces results in the form of an array of type `SentimentResults`, an array of type `documents`. You can read more about the request and response formats for this action on the [Microsoft documentation](https://docs.microsoft.com/en-us/connectors/cognitiveservicestextanalytics/). When you add the **Condition** action to the workflow, Logic Apps would automatically detect that you are trying to parse an array and populate the **output from previous steps** field. Add a condition that evaluates to true if the score is less than or equal to 0.5, as shown in the image below.

{{< img src="16.png" alt="Configure condition action" >}}

Finally, let's add the Pager Duty action to the **if true** branch of the condition that will be executed when the previous condition evaluates to true. Use the text "PagerDuty Create Incident" to find the Pager Duty's **Create Incident** action. Like before, you will be first prompted to create a connection. Assign a name to the connection and paste the 16 digit API key here that you copied previously from the Pager Duty console. Click on the **Create** button to proceed.

{{< img src="17.png" alt="Configure Pager Duty connection" >}}

In the next step of the **Create Incident** wizard, you will be asked to enter the 32 character Service Integration Key that you copied from the Pager Duty console (remember service = team). In the **Description** field, enter the details of the incident. You can see that I used the dynamic content assistant to write a rich incident message in the image below.

{{< img src="18.png" alt="Configure Pager Duty action" >}}

All the required configurations are complete now. Click on the **Save** button to save the Logic App and click on the **Run** button to start the application.

## Testing The Application

Head over to Twitter and post a negative sentiment tweet that includes the text "BeetsEarbuds". Remember that our Logic App connector is continuously searching for this text on Twitter.

{{< img src="19.png" alt="Post a tweet that should trigger our workflow" >}}

Twitter takes some time to index the tweets, and hence the workflow might not trigger immediately. After some time, you can view the Logic App run from the **Overview** section of the Logic App. Click on the run link to land on the view that presents the run's details, including the parameters that were passed between actions. This view is handy if your Logic App fails and requires debugging.

{{< img src="20.png" alt="View Logic App run" >}}

Let's check the Pager Duty dashboard now, which should have an incident created for our team.

{{< img src="21.png" alt="View incident on Pager Duty" >}}

Automatic incident management systems are a common ask of many organizations, but many of them still involve manual triaging processes. By leveraging the power of Azure AI, you can build such systems at a fraction of the cost and development time. I hope I was able to inspire you to come up with more such scenarios. I would love to hear what you are building with Logic Apps in the comments section below.

{{< subscribe >}}
