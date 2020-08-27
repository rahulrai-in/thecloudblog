---
title: "Building Bots with The Microsoft Bot Framework - Part 4"
date: 2017-10-22
tags:
  - azure
  - bot-framework
comment_id: a7c7b9db-1fda-4a51-861a-39be336fdaae
---

> In this series
>
> 1. [Introduction](/post/building-bots-with-the-microsoft-bot-framework-part-1/)
> 2. [Adding Dialogs and State to your bot](/post/building-bots-with-the-microsoft-bot-framework-part-2/)
> 3. [Using Form Flow](/post/building-bots-with-the-microsoft-bot-framework-part-3/)
> 4. [Adding intelligence to your bot using LUIS](/post/building-bots-with-the-microsoft-bot-framework-part-4/)
> 5. [Publishing your bot](/post/building-bots-with-the-microsoft-bot-framework-part-5/)

Welcome to the fourth post in my blog series on Building Bots with The Microsoft Bot Framework. In this article, we will see how we can configure [LUIS](https://www.luis.ai/) to bring Natural Language Processing capabilities to our application. LUIS uses **Intents**, **Entities**, and **Utterances** to build its NLP models. We will discuss these aspects below.

## What is LUIS?

[LUIS](https://www.luis.ai/) is the acronym for **L**anguage **U**nderstanding **I**ntelligent **S**ervice. It utilizes machine learning to give your bot natural language processing capabilities. By converting user requests in natural language to actionable bot commands, LUIS acts as a translator for your bot. To realize the importance of LUIS to a bot, consider the blog bot that we have been building till now. We utilized a regular expression to kick off the appropriate conversation based on user input. Only when the user says "Hi" do we kick off the Hello dialog. In the real world, the `HelloDialog` should be kicked off for all synonyms of the word "Hi" such as "Hello" or "Hola". LUIS accepts words as input and using NLP features tries to guess the intent of the input so that the bot can take appropriate action.

## LUIS Verbs: Intents

LUIS intents are the actions that your bot should take. For example, in our bot the two intents are saying "Hello" to the user, and accepting comments on a particular aspect of the blog. By telling LUIS our intents, we can train LUIS to take a guess at what bot action the user input should map to. LUIS utilizes active learning techniques and can ask from developer what intent should be matched with user input if it is unsure of mapping the user input to an intent.

## LUIS Nouns: Entities

Entities are the things that a bot acts on. The entities are used to enhance an intent. For example consider our bot's intent of accpeting comments from users on certain aspects of the blog. A user may directly ask the bot to post a comment on the profile aspect by saying something like: "Comment on profile aspect of blog with message: The profile needs an update". In this statement the intent is to post a comment and the entities are **the profile aspect** and **the actual message** that the user wants to post. Entities are of two types:

{{< img src="1.png" alt="Entity Types" >}}

1. **Hierarchical Entities**: A hierarchical entity maintains heriditary relationships with other entities. For exxample, a car entityt which has sedan and hatchback child entities.
2. **Composite Entities**: A composite entity is made up of multiple disjoint entities which can be combined into a single entity. For example, in the command "comment on profile aspect" we have two entities, "comment" identifies the action and "profile aspect" identifies the aspect of the blog. Using composite entities, LUIS can better identify the user commands and pass the information to your bot.

## LUIS Sentences: Utterances

Utterances are combinations of Intents and Entities that help LUIS conclude the user commands. For example, if a user says that they want to post feedback for the blog, LUIS should infer that to post a feedback means to comment on something. By using utterances, we can help LUIS learn that the word feedback should map to the comment intent. Using utterances gives the user the flexibility to choose various words to communicate the intent.

## Configuring LUIS

Now we will add Entities, Intents, and Utterances to LUIS so that we can use it in our bot. Navigate to the [LUIS portal](htttp://luis.ai) and log in with your Microsoft account. Click on the **New App** button to create a new application. Supply an application name and set the culture to **English** and leave the other fields blank.

{{< img src="2.png" alt="Create LUIS App" >}}

Let's start by creating a new intent. Our bot has two separate intents, one to greet the user and another to receive comment on an aspect of the blog. Let's create the intent to greet the user.

Click on **Intents** and then **Add Intent** to launch the intent creation wizard. Add an intent name and then click on **Submit** to create it.

{{< img src="3.png" alt="Create Intent" >}}

After creating this intent, we will be presented with the intent details page where we can add Utterances (bot sentences) and Entities (bot actions). Let's add a new utterance by typing "Hi", pressing Enter and then clicking on **Save**.

{{< img src="4.png" alt="Adding Utterances" >}}

After adding any aspect to LUIS, you need to train it to make it understand the data. Although LUIS keeps training itself often, you can make it train itself on demand by clicking on **Train & Test** and then click the **Train Application** button. You can later test the intent by typing in "Hi" and viewing the results.

{{< img src="5.png" alt="Train and Test The Intent" >}}

You can see that LUIS correctly mapped the text to the "Hello Intenet" by assigning it a score of 1. However, if you try to enter a related word such as "Hello", LUIS is not so sure about the intent it should map the word to. LUIS can utilize active learning to keep learning new words and their associated intents. To apply this technique, we'd need to publish our application. Click on the **Publish App** button. You can start with setting **BootstrapKey** in the **Endpoint Key** field for testing purposes. Choose and slot to deploy your app to and finally click **Publish**.

{{< img src="6.png" alt="Publish LUIS App" >}}

Note the **Endpoint URL** generated for your application. You can pass an expression in the `q` parameter of the query string to evaluate it. Let's send "Hello" to the endpoint.

{{< img src="7.png" alt="Testing the API Endpoint" >}}

You can see that LUIS tried to guess the intent but wasn't very accurate with the mapping. Click the **Dashboard** button and switch to **Suggested utterances** tab. Here you can select the utterances passed to the API and map them to the **Hello Intent**.

{{< img src="8.png" alt="Suggested Utterances" >}}

Now you can again test the endpoint to see improved scores for the intent mapping.

## Adding Entities to LUIS

Now we will create an intent with an entity. Our bot accepts comments on two aspects of the blog: profile and article. The user should be able to ask the bot the aspect they can comment on. To cater to this requirement, let's start with creating an entity named "Blog Aspect Entity". Click on **Entities** and then on **Add Custom Entity** button which will launch an entity creation dialog where you can configure the name and the type of the entity. Select **Entity Type** as _Simple_.

{{< img src="9.png" alt="Create New Entity" >}}

Now, in the LUIS console create a new intent named "Blog Aspects". Add an utterance: "can I comment on profile?" to the intent. Left click on the term "profile" and map it to _Blog Aspect Entity_.

{{< img src="10.png" alt="Map Utterance to Entity" >}}

Click on **Save** to save the utterance. There are several prebuilt entities available in the _Entities_ panel from where you can add entity types that can identify attributes such as age, date, and dimension. Train your model and test it with an utterance such as: "Can I comment on articles?". You will see that LUIS correctly identifies that the utterance maps to _Blog Aspect_ intent.

**List** is another essential entity type. Remember how we configured the words "Hi" and "Hello" for the **Hello Intent**? There is a much easier way to supply synonyms of a word to LUIS through entities of type **List**. Let's create a list to see how it works. Click on **Entities** and then click on **Add Custom Entity**, enter the name of the entity as _Greetings_ and select the type of entity as _List_. In the next form, enter the canonical word as "Hi" and supply a comma-separated list of similar words such as the one below. Click on **Add** to save the list. Train your model again.

{{< img src="11.png" alt="Phrase List" >}}

Now if you enter one of the words that you supplied in the list in the test console, LUIS would correctly map it to the **Hello Intent**.

## Connecting LUIS to Bot

To connect LUIS to your bot, you require a LUIS App Id and LUIS API Key. YOu can get these two values from the LUIS console. To get the LUIS App ID, navigate to the dashboard and copy the App Id.
To get the API Key, click on **Publish App** and copy the subscription key from one of the listed endpoints.

```plaintext
https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/APPID?subscription-key=SUBSCRIPTION-KEY&timezoneOffset=0&verbose=true&q=
```

Let's configure our **Blog Bot** to work with the intents that we configured in LUIS. You can download the code sample from here if you get lost somewhere.

{{< sourceCode src="https://github.com/rahulrai-in/blogbot/tree/LuisDemo">}}

In the solution, navigate to the **Dialogs** folder and add a new class named `LUISTestDialog` to it. We'll make this class inherit from the `LuisDialog<BlogComment>` class. To connect this Dialog to the LUIS model, add the `LuisModel` attribute to this class. Your class should look something like the following.

```cs
[Serializable]
[LuisModel("MODEL ID", "SUBSCRIPTION KEY")]
public class LUISTestDialog : LuisDialog<BlogComment>
{
	...
}
```

Next, we'll first start with adding the none intent, i.e., when no intent is detected for the user input. Create a method named `NoIntentFound` and post a message to the user to notify them that LUIS failed to identify an intent.

```cs
[LuisIntent("")]
public async Task NoIntentFound(IDialogContext context, LuisResult result)
{
    await context.PostAsync("LUIS could not find a matching intent.");
    context.Wait(this.MessageReceived);
}
```

Next, let's handle the case when LUIS maps the user input to the **Hello Intent** that we previously configured. Create a new method named `HelloIntent` and decorate it with the `LuisIntent` attribute. When the intent is matched, we will invoke the `HelloDialog` dialog that we previously built. Once the call completes, we will let a callback method conclude the conversation.

```cs
[LuisIntent("Hello Intent")]
public async Task HelloIntent(IDialogContext context, LuisResult result)
{
    context.Call(new HelloDialog(), Callback);

    async Task Callback(IDialogContext dialogContext, IAwaitable<object> dialogResult)
    {
        await dialogContext.PostAsync("Hello dialog concludes.");
        dialogContext.Wait(this.MessageReceived);
    }
}
```

Let's finally handle the **Blog Aspects** intent, which has entities mapped to utterances. Create a method named `CanCommentOn` and transfer control to the `BlogComment` model form if we do have an entity that we can cater to.

```cs
[LuisIntent("Blog Aspects")]
public async Task CanCommentOn(IDialogContext context, LuisResult result)
{
    foreach (var entity in result.Entities.Where(e => e.Type == "Blog Aspect Entity"))
    {
        var name = entity.Entity.ToLowerInvariant();
        if (name == "blog" || name == "profile")
        {
            await context.PostAsync($"Yes you can comment on {name}. Launching the form now...");
            var blogCommentForm = FormDialog.FromForm(BlogComment.BuildForm, FormOptions.PromptInStart);
            context.Call(blogCommentForm, Continue);

            async Task Continue(IDialogContext dialogContext, IAwaitable<BlogComment> dialogResult)
            {
                await dialogContext.PostAsync($"Thank you for submitting your request.");
                dialogContext.Wait(this.MessageReceived);
            }

            return;
        }
    }

    await context.PostAsync("Not an available option");
    context.Wait(this.MessageReceived);
}
```

Now, that we are done handling all the intents that we have in LUIS, let's set this dialog to trigger when a request comes to the bot. Open the `MessagesController` class and trigger the `LUISTestDialog` when a message is received.

```cs
if (activity.Type == ActivityTypes.Message)
{
    // We will invoke the dialog here.
    await Conversation.SendAsync(activity, () => { return Chain.From(() => new LUISTestDialog()); });
}
```

## Demo

Okay, now we are done setting up the LUIS dialog and connecting it to the bot API. Let's test our bot with different inputs.

Let's first the behavior of our bot with input that triggers the **Hello Intent** intent.

{{< img src="12.png" alt="LUIS Hello Dialog" >}}

Now, let's see if our bot can react to the **Blog Aspects** intent.

{{< img src="13.png" alt="LUIS Blog Aspects Dialog" >}}

Finally, the case when the bot is not able to make out the intent.

{{< img src="14.png" alt="LUIS Unknown Intent" >}}

Before I conclude our discussion of adding intelligence to your bot, I would like to draw your attention to the fact that you can train your LUIS model with live user input by navigating to the [LUIS portal](https://luis.ai) and mapping user input to intents. For instance, you can see that the input that I previously sent to the bot is now available on the dashboard for mapping.

{{< img src="15.png" alt="Training LUIS with User Input" >}}

Hope you enjoyed reading this post. I will soon be back with the concluding post of this series. Happy coding!

{{< subscribe >}}
