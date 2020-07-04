---
title: "Automate Your Life with Microsoft Flow"
date: 2016-05-16
tags:
  - azure
  - automation
---

Microsoft recently launched its own variant of [IFTTT](https://ifttt.com/) named [Microsoft Flow](https://flow.microsoft.com). Using Flow, you can create and deploy workflows that connect various apps and services. They are very similar to [Azure Logic Apps](/post/adding-business-logic-to-azure-logic-app-with-azure-api-app) and use the same grammar to define conditions (as we will soon see). Currently what sets both the services apart is the fact that Flow has a subset of functionalities of Azure Logic Apps available to it and comes with ready to use templates which are easy to deploy. Many of the common usage scenarios of Flow don’t even require any knowledge of programming.

Microsoft Flow is fun to use and can help save your precious time that you spend doing monotonous and repetitive tasks. The [template page](https://flow.microsoft.com/en-us/templates/) of Microsoft Flow lists several of such tasks such as saving email attachments to Dropbox, translate non-English emails, create tweets from Facebook posts etc.

I wanted to see if I could automate a bit of my social media life using Microsoft Flow. We all get many messages on Facebook on our birthdays and other special occasions. I built a Flow that would send a personalized message as a reply to those who post to me on Facebook to congratulate me on such occasions.

## Objective

Build a Flow from scratch that responds to congratulatory Facebook posts from friends with personalized messages to keep them happy and feel loved :)

## What You Should Already Know

I don’t want to deviate from the subject of this post, that is Microsoft Flow. Therefore, it would be great if you could get yourself familiar with performing the following activities.

- [Create a new Facebook App and get your App Id and secret.](https://developers.facebook.com/docs/apps/register)
- [Get your own Facebook user identifier](http://findmyfbid.com/).
- Get user access token for your app. You can use [Graph API Explorer](https://developers.facebook.com/tools/explorer/) tool to do this. Remember that the token that you generate should give you access to the following User Data Permissions.

  - publish_actions: to respond to posts.
  - user_posts: to read posts from a user’s timeline.

- [Extend expiry time of user access token](https://developers.facebook.com/docs/facebook-login/access-tokens/expiration-and-extension).
- [Create and publish an Azure API App](https://azure.microsoft.com/en-us/documentation/articles/app-service-api-dotnet-get-started/).

## Let’s Go

First and foremost, sign up with your work or school account on the [Microsoft Flow](https://flow.microsoft.com/) website. If you are having troubles signing up for the service, here is the documentation [link](https://flow.microsoft.com/en-us/documentation/sign-up-sign-in/) for getting around sign up or sign in issues. Once you are done with the authentication step, you would need to navigate to [My Flows](https://flow.microsoft.com/manage/flows) page. The page will have no flows listed at the moment, but will, later on, list all the flows that you have created. Click on **Create from blank** on the page to navigate to the flow designer.

{{< img src="1.png" alt="Flow Create New" >}}

In the flow designer, you can create a Flow by linking various actions and conditions. A Flow gets initiated by a trigger. Let’s add a Facebook trigger to our Flow which initiates the workflow every time there is a new post on your timeline.

{{< img src="2.png" alt="Create Facebook Activity" >}}

You would need to connect Facebook to Microsoft Flow by clicking on **Sign in to Facebook** and granting permissions on your Facebook account to Microsoft Flow. Flow can supply the information it receives from any previous actions to the following actions. Through the trigger, till now you will have details of the post that was posted on your timeline. Now you need to see whether this post contains a congratulatory message. To evaluate your message, add a condition to your Flow that checks whether the post contains any of the congratulatory texts such as birthday, congratulations or congrats (you may add more words to this list). You would need to open the **advanced editor** view of the condition to write this condition (available at the bottom of the condition). Write the following condition in the editor.

```SQL
@or(or(contains(toLower(triggerBody()['message']), 'birthday'), contains(toLower(triggerBody()['message']), 'congratulations')), contains(toLower(triggerBody()['message']), 'congrats'))
```

{{< img src="3.png" alt="Add Condition To Activity" >}}

The condition will have two branches attached to it corresponding to the output of the condition which would be either true or false. Depending on the output of the condition, the remainder of the workflow will execute. We don’t want anything to happen if the condition evaluates to false. However, if the post is indeed a congratulatory post, we need to extract the later half of the **Post Item Post Id** parameter (an underscore-separated value) that we received from the Facebook trigger. The **Post Item Post Id** parameter contains two values separated by an underscore (\_). The **Post Id** value of this parameter helps Facebook API identify the post that we want to execute our action against. Since **Post Id** is not available to us as a parameter value, we can build and deploy a simple [Azure API App](https://azure.microsoft.com/en-us/documentation/articles/app-service-api-dotnet-get-started/) with a single function that takes an underscore delimited string (**Post Item Post Id**) as input and returns the last part (**Post Id**) as output. In the following screenshot, you can find the Swagger metadata of the API App that I published to Azure.

{{< img src="4.png" alt="API App To Return Post Id" >}}

Once your API App is deployed, add a new **HTTP + Swagger** action to the workflow (inside the **If Yes** section). Provide your swagger endpoint as input to this action and select your function from the list of functions available in your API App. Pass the **Post Item Post Id** parameter available from the Facebook trigger as input to the function.

{{< img src="5.png" alt="If Yes Then Send Post To API App" >}}

Now, all that we need to do is send a personalized reply to your friend who posted the comment on your timeline. To do so, add a new action of type **HTTP** that links to the **HTTP + Swagger** action that we created earlier (inside the **If Yes** section). You can read the documentation of [Comments API](https://developers.facebook.com/docs/graph-api/reference/v2.6/object/comments/) of the Facebook Graph API to get an overview of how to post comments to a Facebook post. I am using Graph API **version 2.6** to perform this operation. In the **HTTP** action that you just added, set the HTTP method as **POST**. Next, in the URI section, mention the link to comments edge of Graph API. This URI that you provide should be of the following form:

`https://graph.facebok.com/v2.6/YOUR-NUMERIC-FACEBOOK-IDENTIFIER_POSTID/comments`

Since we already have the **Post Id** that we received from the call to our API App, we can supply the response **Body** parameter as the value of **Post Id** required in the Uri.

Next, we need to supply the long-life user access token to authorize our request. Add this token to the **Headers** section of the **HTTP** action. Finally, in the **Body** section of the HTTP action, write the message that you want to send as a response to your friend’s post. To personalize the message, add your friend’s name, which is available in the **Post Item name** parameter, to the message.

{{< img src="6.png" alt="Call To FB To Post Comment" >}}

This is how your workflow, should look at this moment. Give it a nice name and submit the Flow for deployment.

{{< img src="7.png" alt="My Flow" >}}

Once your Flow is deployed, you can visualize its runs by clicking on the **View Runs** icon corresponding to your flow in the **My Flows** section.

{{< img src="8.png" alt="View Flow Runs" >}}

Once my Flow was up, I congratulated myself on completing this activity…

{{< img src="9.png" alt="MS flow Working" >}}

…and thanked myself for doing so!

This is cool. In the future, I am going to automate anything that I do more than thrice. What aspect of your life are you going to automate?

{{< subscribe >}}
