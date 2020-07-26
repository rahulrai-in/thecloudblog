---
title: "Building Bots with The Microsoft Bot Framework - Part 5"
date: 2017-11-10
tags:
  - azure
  - bot-framework
---

> In this series
>
> 1. [Introduction](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-1/)
> 2. [Adding Dialogs and State to your bot](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-2/)
> 3. [Using Form Flow](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-3/)
> 4. [Adding intelligence to your bot using LUIS](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-4/)
> 5. [Publishing your bot](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-5/)

Welcome to the final post in my series of blogs on Building Bots with The Microsoft Bot Framework. Till now we were building our bot and adding features to it. In this article, we will be publishing our bot and later chat with our bot on Skype.

## Deploy Your Bot

The bot that we have built till now is a small web application that communicates with the client using the REST protocol. From Visual Studio, right click on the **BlogBot** project and select **Publish**. Follow the wizard to publish your bot application to an Azure WebApp. You can follow the steps mentioned [here](https://docs.microsoft.com/en-us/azure/app-service/app-service-web-get-started-dotnet#publish-to-azure) to help you with the process.

## Register Your Bot

We now need to register our bot so that users can interact with it. Now, browse to the [bot developer portal](https://dev.botframework.com/) and sign in with your Microsoft account. To create a new bot, click on the **My Bots** option and then on the **Create** button.

{{< img src="1.png" alt="Create Bot On Portal" >}}

In the prompt that follows, select the "Register an existing bot built using Bot Builder SDK" option. Now, you will be presented a form to fill up your bot profile. Enter a display name (the name you will see in your chats with the bot), a unique bot handle, and a description that users can see to know more about your bot.

{{< img src="2.png" alt="Register Your Bot" >}}

In the **Configuration** section, enter the channel endpoint of your bot, that is the host URL including the "/api/messages" part. Next, click the **Create Microsoft App ID and Password** button, which will take you to the page where you can create credentials that the clients can use to communicate with your bot. Obtain Application Id and Password from the wizard and paste them in the `appSettings` section of the web.config file of your bot.

```xml
<add key="MicrosoftAppId" value="Your Application Id" />
<add key="MicrosoftAppPassword" value="Your Application Password" />
```

At this point, you would need to redeploy your bot so that credentials take effect immediately. Finally, in the bot developer website, click on the **Register** button to complete the registration process.

Your newly provisioned bot will be available under **My bots** section of the portal. Clicking on your bot name from the list will take you to your bot's dashboard. Here, you can see that two channels, Skype, and web chat, have been automatically provisioned for you.

## Testing Your Bot on The Skype Channel

Click on the Skype channel on the channels tab to launch your bot on Skype channel.

{{< img src="3.png" alt="Skype Bot Channel" >}}

You can now talk to your bot on Skype. Let's try to carry out the `BlogComment` conversation with the bot.

{{< img src="4.png" alt="Chatting With Bot on Skype Channel" >}}

When you are ready to deploy the bot for broader consumption, you can submit it for review to Microsoft by clicking on the **Publish** option inside the channel.

## What About Other Channels?

Channels differ from each other concerning features that they provide. For example, the Facebook messenger channel supports cards and carousels to display content. You can use `ChannelData` property, which is a dynamic list of properties and data specific to a channel or key-value pairs, to utilize the capabilities of an individual channel. You can read more about `ChannelData` and how to use it to implement channel-specific functionality [here](https://docs.microsoft.com/en-us/bot-framework/dotnet/bot-builder-dotnet-channeldata).

## Credits

Hope you had fun going through the various articles and building bots along with me. I would like to thank **[Luiz Bon](https://luizbon.com/blog/)**, my friend and colleague from [Readify](http://readify.net), who guided me with his expertise and took the time to go through all the articles in this series.

My friend and colleague from Microsoft, **[Ankit Vijay](https://ankitvijay.net)**, built a similar tutorial series on the bot framework which uses an alternate approach to building bots using the QnA Maker Service. You can find his blogs [here](https://ankitvijay.net/category/bot/).

{{< subscribe >}}
