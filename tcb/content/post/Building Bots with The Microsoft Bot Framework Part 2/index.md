---
title: "Building Bots with The Microsoft Bot Framework - Part 2"
date: 2017-05-19
tags:
 - azure
 - bot-framework
---


{{% notice %}}
In this series

1. [Introduction](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-1/)
2. [Adding Dialogs and State to your bot](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-2/)
3. [Using Form Flow](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-3/)
4. [Adding intelligence to your bot using LUIS](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-4/)
5. [Publishing your bot](/post/Building-Bots-with-The-Microsoft-Bot-Framework-Part-5/)
   {{% /notice %}}

Welcome to the second post in my blog series on Building Bots with The Microsoft Bot Framework. In today's post, we will learn how we can build a stateful bot that can carry out a meaningful conversation with the user. We will also find out how Dialogs can add reusability to our bots.

## What is a Dialog?

A Dialog is a piece of conversation that has its own state. By breaking down the conversation to smaller pieces, Dialogs adhere to _Single Responsibility Principle_ and can be reused to form a complex conversation. Once we have all the Dialogs, we can form a Dialog chain, which is a string of Dialog objects strung together to form a conversation. For example, observe the following Dialog chain.

{{< img src="1.png" alt="Dialog Chain" >}}

In this Dialog chain, we have a series of Dialogs that are linked to each other to form a conversation. The **Introduction Dialog** saves the name of the user as a state object, which can later be used by other Dialogs to personalize the communication.

## Creating a Dialog & Saving State

{{% notice %}}
Persisting state in memory has several restrictions such as those of size of the object and therefore it is not recommended for production use. There are two state providers implemented by [Azure Extensions](https://github.com/Microsoft/BotBuilder-Azure) which you can use namely:

1. [Cosmos DB State Provider](https://docs.microsoft.com/en-us/bot-framework/dotnet/bot-builder-dotnet-state-azure-cosmosdb): To persist bot state in Cosmos DB.
2. [Azure Table Storage State Provider](https://docs.microsoft.com/en-us/bot-framework/dotnet/bot-builder-dotnet-state-azure-table-storage): To persist bot state in Azure Table Storage.

You can additionally, write your state provider to persist state data by following [this sample](https://blog.botframework.com/2017/07/26/saving-state-sql-dotnet/) from the Bot Fx Team.
{{% /notice %}}
A Dialog should implement the `IDialog` interface, which is present in the **Microsoft.Bot.Builder.Dialogs** namespace. Since Dialog objects need to be serialized at runtime, therefore they must use the `Serializable` attribute. The `IDialog` interface has just one method which you need to implement named `StartAsync`, which is used to initiate a Dialog. Since Dialogs are asynchronous, the `StartAsync` method uses `async` and `await` to implement asynchronous calls.

A bot should be able to store state in a persistent store to carry out a meaningful conversation. For example, to personalize a conversation, a bot should save the name of the user in the state so that it can address the user by name throughout the conversation. A bot can store state information using one of the following mechanisms:

- **Custom SQL Database**: A developer can create a custom database to store state information in a database. However, when you are using this mechanism, it is important for you to know the conversation to which the state data belongs so that you can pull out the right state from your database. To uniquely identify a conversation, you can use a set of **three different properties** in the `Activity` object.

  - **From**: Who the request is coming from.
  - **To**: Who the request is going to. The `From` and `To` properties can help identify a user.
  - **Conversation**: This property helps identify the conversation taking place between the user and the bot.

  Using these three identifiers for identifying a conversation, you can store the state information in your database and retrieve it later.

- **Bot State Service**: You can use the framework maintained state service, called the **Bot State Service**, to store state data. This service has the following methods exposed to save and retrieve state data.
  _ **Get\SetUserData**
  _ **Get\SetConversationData**
  _ **Get\SetPrivateConversationData**
  _ **DeleteStateForUser**

The Bot State Service service takes care of maintaining the state, which simplifies the task of maitaining appplication state. You can use the state service in the following manner in your bot application (see code comments for description).

```CS
// The client is responsible for getting\setting state of the bot.
StateClient stateClient = activity.GetStateClient();
// Retrieve User Data based on ChannelId and UserId (unique combination)
BotData userData = await stateClient.BotState.GetUserDataAsync(activity.ChannelId, activity.From.Id);
// Set a property in the retrieved state.
userData.SetProperty<string>("sampleProperty", "sampleValue");
// Request stateClient to save data.
await stateClient.BotState.SetUserDataAsync(activity.ChannelId, activity.From.Id, userData);
```

## Saving Complex State Objects

The code that we can use to save complex data types in the state is slightly different from that above. Following is a code snippet that saves and retrieves an object of a complex data type from the state. See code comments in the code snippet for description.

```CS
// **Set State Data
// The client is responsible for getting\setting state of the bot.
StateClient stateClient = activity.GetStateClient();
// We will store an instance of this class in the state store.
CustomUserData customUserData = new CustomUserData("message");
// The eTag in BotData specifies that we want to update the latest instance of CustomUserData in the state store.
BotData botData = new BotData(eTag: "*");
// Set the property as usual.
botData.SetProperty("UserData", customUserData);
// Request the StateClient instance to save this state.
BotData response1 = await stateClient.BotState.SetUserDataAsync(activity.ChannelId, activity.From.Id, botData);

// **Get State Data
BotData fetchedStateData = await stateClient.BotState.GetUserDataAsync(activity.ChannelId, activity.From.Id);
CustomUserData fetchedCustomUserData = fetchedStateData.GetProperty<CustomUserData>("UserData");
```

## Adding Dialog to Blog Bot

It is time to incorporate our learnings into the demo bot that we started building in the first part of the blog series. In this series, I will create a bot that interacts with the user to take him\her through the contents of my blog. You can download the up to date copy of the source code of the bot from here.
{{< sourceCode src="https://github.com/rahulrai-in/blogbot">}}

Let's begin with creating a Dialog that greets the user and saves his\her name in memory so that it can be reused later in the conversation. In the solution, create a folder named **Dialogs**. This folder will contain all the Dialogs that we will use in our bot. Next, add a class named `HelloDialog` to the folder. Since Dialogs need to be serialized at runtime, apply the `Serializable` attribute to the class. To be processed as a Dialog by the Bot Framework, the `HelloDialog` class should implement the `IDialog` interface. To implement the interface, you would need to specify an implementation of the `StartAsync` method.

To invoke this Dialog, go back to the `MessagesController` and empty the contents that appear within the `if (activity.Type == ActivityTypes.Message)` code block. Invoke the `HelloDialog` Dialog from within the code block with the following statement.

```CS
if (activity.Type == ActivityTypes.Message)
{
    // We will invoke the Dialog here.
    await Conversation.SendAsync(activity, () => new HelloDialog());
}
```

When this statement gets processed, an instance of `HelloDialog` will be created, and because we have implemented the interface `IDialog`, the `StartAsync` method will be invoked.

Let's get inside the `HelloDialog` class and make it respond to the user with a message.

```CS
public async Task StartAsync(IDialogContext context)
{
    await context.PostAsync("Hi, I am Blog Bot");
}
```

If you execute the application at this moment, the bot would respond with the message but would throw an exception on subsequent requests. That is because we haven't directed the bot on how to continue the conversation. Let's add a method that will help the bot continue the conversation.

```CS
public async Task StartAsync(IDialogContext context)
{
    await context.PostAsync("Hi, I am Blog Bot");
    context.Wait(this.ProcessConversation);
}

private async Task ProcessConversation(IDialogContext context, IAwaitable<IMessageActivity> argument)
{
    var userInput = await argument;
}
```

Note that in the `ProcessConversation` method we have the `context` variable that contains all the bot data and the `argument` variable that contains user input. Let's use these two inputs to store the name of the user in the state cache and greet the user after we get to know the user's name.

```CS
public async Task StartAsync(IDialogContext context)
{
    await context.PostAsync("Hi, I am Blog Bot");

    // Continue conversation using the following method.
    context.Wait(this.ProcessConversation);
}

private async Task ProcessConversation(IDialogContext context, IAwaitable<IMessageActivity> argument)
{
    var userInput = await argument;

    // Try retrieving the name of the user from state.
    context.UserData.TryGetValue("userName", out string nameOfUser);

    // We don't want to process the first message that the user sent to the bot to initiate a conversation (the 'Hi' message). This flag will only be set when our bot requests the user to enter his name. Therefore, we will check the value of this flag and only then set the state with the name of the user.
    context.UserData.TryGetValue("nameRequired", out bool nameRequired);
    if (nameRequired)
    {
        nameOfUser = userInput.Text;

        // Save the name and set the flag.
        context.UserData.SetValue("userName", nameOfUser);
        context.UserData.SetValue("nameRequired", false);
    }

    if (string.IsNullOrEmpty(nameOfUser))
    {
        // The name of the user wasn't available in the state. Therefore, we will ask the user to enter it.
        await context.PostAsync("What is your name?");
        // Set the flag so that the name can be saved to state on the next interaction.
        context.UserData.SetValue("nameRequired", true);
    }
    else
    {
        // We now know the name of the user. Say 'Hello'.
        await context.PostAsync($"Hi, {nameOfUser}. Nice to see you.");
    }

    // Because our bot needs to know how to continue the conversation, we are asking it to recurse the conversation flow.
    context.Wait(this.ProcessConversation);
}
```

To test the bot, launch the program through Visual Studio and in the emulator create a new user and a new conversation. Enter some text to trigger the conversation and let the bot save your name in the state. Here is an example of me interacting with the bot.

{{< img src="2.png" alt="Hello Dialog in Action" >}}

You must've noticed that when I take the conversation forward, the bot just recurses the Dialog as instructed. However, after the bot saves your name in the state, it would not prompt you to enter it again. Further Dialogs in the Dialog Chain can just pull out your name from the state data bag and reuse the information.

## Dialog Reusability

Today we built an Introduction Dialog that greets the user and saves the user's name in the state. Since Dialogs adhere to [Single Responsibility Principle (SRP)](https://en.wikipedia.org/wiki/Single_responsibility_principle), we can reuse this Dialog in other conversations where we require similar functionality. The Dialog that we implemented saves the name of the user it is interacting with in the state storage. If in the course of a conversation, we want to use the name of the user, we can quickly pull it out of the state storage.

In the next post in this series, we will discuss another feature of the bot framework named FormFlow through which we can control the workflow of a conversation. I hope that you are enjoying reading the posts so far. Let me know what you are planning to build using the Bot Framework in the comments section below.

{{< subscribe >}}
