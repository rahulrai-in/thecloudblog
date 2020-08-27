---
title: "Building Bots with The Microsoft Bot Framework - Part 1"
date: 2017-05-05
tags:
  - azure
  - bot-framework
comment_id: a484ed97-841d-4302-91f9-ae12ce797c8a
---

> In this series
>
> 1. [Introduction](/post/building-bots-with-the-microsoft-bot-framework-part-1/)
> 2. [Adding Dialogs and State to your bot](/post/building-bots-with-the-microsoft-bot-framework-part-2/)
> 3. [Using Form Flow](/post/building-bots-with-the-microsoft-bot-framework-part-3/)
> 4. [Adding intelligence to your bot using LUIS](/post/building-bots-with-the-microsoft-bot-framework-part-4/)
> 5. [Publishing your bot](/post/building-bots-with-the-microsoft-bot-framework-part-5/)

I decided to spend some time learning the [Microsoft Bot Framework](https://dev.botframework.com/). I am going to write a series of blog posts to share with you what I learn so that we can go through this learning exercise together. This is the first post in the series with a few more to go. You might want to stay in the loop, so remember to [subscribe](#subscribe) to my mailing list and keep visiting this site to check out new content.

## What is a Bot?

A bot is an application that performs an automated task. There are several bots with which we interact daily such as [Siri](https://www.apple.com/au/ios/siri/) and [Cortana](<https://en.wikipedia.org/wiki/Cortana_(software)>). Bots are a part of the natural evolution of communication that is shifting from email to chat, texts, and tweets.

## Bots for Developers

There are three components involved in Bot Communication.

1. **User**: Human or machine with whom the bot communicates.
2. **Bot**: The automated process that responds to user requests.
3. **Channel**: The medium over which a bot communicates. There are several public channels available to enable this communication such as Facebook messenger, Slack, Skype, and SMS.

{{< img src="1.png" alt="Bot Communication" >}}

While a user interacts with the channel through input media such as a keyboard, the bots use the API exposed by the channel to receive user input. When the bot is ready to respond, it uses its own set of APIs to send the response back through the channel to the user.

## Microsoft Bot Framework

[Microsoft Bot Framework](https://dev.botframework.com/) is an SDK for building bots. It was introduced in the Build conference in 2016. It is open source and is available in both Node.js and .Net. The Bot Framework supports multiple channels and abstracts them from the bot, which means that there is no difference between messages arriving from different channels e.g. Facebook or Slack to your bot. Therefore, as a bot application developer, you don't need to worry about the channels used for communication and their SDKs.

Microsoft Bot Framework not just supports simple text output, but also supports rich attachments. What this means is that if you build an image carousel for slack, the framework can render the carousel on another channel e.g. Facebook without requiring any change in code.

Microsoft Bot Framework integrates natively with Microsoft's Natural Language Processing framework with which you can create a bot that can understand natural human language.

## Connector Service and Activities

Previously we saw that there can be a number of channels used by a bot to communicate with the user. Each channel has a unique JSON configuration that needs to be used by the bot to communicate using that channel. However, Microsoft Bot Framework makes the communication opaque to the developer by using a **Connector Service**. The **Connector Service** is a Microsoft controlled service that sits in between the channel and the bot. It takes the `channel.json` and converts it to an **Activity**. The Activity JSON contains a set of properties that you can use to control your messages and how they are presented to the user.

{{< img src="2.png" alt="Connector Service and Activities" >}}

## Hello World Bot!

Prepare your development environment by downloading and installing the templates and tools available [here](https://docs.botframework.com/en-us/downloads/).

> While in preview, you would need to follow the steps documented [here](https://docs.botframework.com/en-us/csharp/builder/sdkreference/gettingstarted.html) to install the project template.

Let's bring up Visual Studio (mine is VS 2017) and select the **Bot Application** template.

{{< img src="3.png" alt="Bot Template" >}}

You will notice that the bot application template looks very similar to a WebAPI project. It has a controller and an **App_Start** folder and **WebApiConfig.cs** class. This is so because bots are actually APIs that interact with clients using HTTP.

All of the bot interaction code is contained in the **MessagesController.cs** file. The `Post` method in the API handles all the messages that the bot receives. Let's modify the code in the method to reflect the following.

```cs
public async Task<HttpResponseMessage> Post([FromBody]Activity activity)
{
    if (activity.Type == ActivityTypes.Message)
    {
            ConnectorClient connector = new ConnectorClient(new Uri(activity.ServiceUrl));
            int length = (activity.Text ?? string.Empty).Length;

            Activity replyActivity = activity.CreateReply($"Length of message is {length}");
            await connector.Conversations.ReplyToActivityAsync(replyActivity);
    }
    else
    {
        HandleSystemMessage(activity);
    }
    var response = Request.CreateResponse(HttpStatusCode.OK);
    return response;
}
```

The first thing that you will notice is that the `Post` method accepts an instance of the `Activity` class, which is the serialized form of **activity.json** sent by the **Connector Service**. Next, we check the type of the activity, which tells us what the activity has requested for. There are six types of activities:

1. **Message**: This is the most common activity type. This implies that a message or a command is sent to the bot.
2. **DeleteUserData**: Request for all data for the user to be deleted.
3. **ConversationUpdate**: Handle conversation state changes, like members being added and removed.
4. **ContactRelationUpdate**: Handle add/remove from contact lists.
5. **Typing**: Notifies the bot that the user is typing.
6. **Ping**: Respond to ping requests.

The code inside the _if_ block establishes a connection with the Connector Service using the URL of the channel endpoint. Next, we create a response that we want to send back to the connector service and then in turn to the user. If you look at the top of the controller, you would notice that there is an attribute named `BotAuthentication` applied to the controller. This attribute is responsible for ensuring that only an authorized connector service can talk to your bot. The authentication keys used for the purpose are present in the _web.config_ file in the _appsettings_ section. You would need to supply values for _BotId_, _Microsoft App Id_ and your _Microsoft App Password_ when you deploy the bot.

To debug our bot, simply press F5 to launch the application. You will be presented the following screen in the browser that shows that your bot is ready for testing.

{{< img src="4.png" alt="Blog Bot" >}}

Although you can use tools such as PostMan to test your bot, Microsoft has built a **Bot Emulator** that you can use to test interactions with your bot. It is available for download [here](https://docs.botframework.com/en-us/tools/bot-framework-emulator/). Simply, run the emulator and add your bot endpoint URL in the _Bot Url_ text box. You can now test your bot by sending it some messages.

{{< img src="5.png" alt="Microsoft Bot Emulator" >}}

In the emulator, you can see on the right-hand side a part of activity.json, which your bot, in turn, receives as an instance of `Activity` class. You can also see that Conversations are presented as a drop down menu items to us. This is so because a user can have multiple conversations with the bot. You can press the **New** button to start a new conversation with the bot. You can change the number of participants in the conversation by changing the number in the **Members** text box, which will send a new `Activity` message of type `ConversationUpdate` to the bot. There are other options in the emulator such as locale and events that you can send to your bot to test its behavior.

That's all for today. In the next blog in this series, we will discuss Conversations and Dialogs in the Bot Framework.

{{< subscribe >}}
