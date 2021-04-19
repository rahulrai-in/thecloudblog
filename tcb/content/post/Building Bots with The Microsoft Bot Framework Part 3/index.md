---
title: "Building Bots with The Microsoft Bot Framework - Part 3"
date: 2017-09-14
tags:
  - azure
  - bot-framework
comment_id: d6e10ddb-4c22-4eb4-b4dc-9371b2512b05
---

> In this series
>
> 1. [Introduction](/post/building-bots-with-the-microsoft-bot-framework-part-1/)
> 2. [Adding Dialogs and State to your bot](/post/building-bots-with-the-microsoft-bot-framework-part-2/)
> 3. [Using Form Flow](/post/building-bots-with-the-microsoft-bot-framework-part-3/)
> 4. [Adding intelligence to your bot using LUIS](/post/building-bots-with-the-microsoft-bot-framework-part-4/)
> 5. [Publishing your bot](/post/building-bots-with-the-microsoft-bot-framework-part-5/)

Welcome to the third post in my blog series on Building Bots with The Microsoft Bot Framework. In the last post, we saw how we could use Dialogs and State to carry out a meaningful conversation with the user. However, we also saw that interacting with the user using Dialogs involves a lot of complexity. Today we will discuss how we can reduce the complexity of Bot development using a feature called Form Flow.

## What is Form Flow?

To understand the complexities of communication, recall your last interaction with a human customer service personnel. To assist you with your issues, the agent asks you a series of questions as though they are filling out a form. For example, a typical conversation with a telco customer service executive may pan out as follows:

**Executive**: What is your phone number?

**Customer**: 123456789

**Executive**: What is the issue?

**Customer**: Frequent call drops.

**Executive**: At what time and date can our network team representative call you back?

**Customer**: Tomorrow at 9.

A simple conversation such as the one above might involve multiple complex scenarios. For example, the customer might give out a wrong phone number and may want to change it later. In another scenario, the customer might present dates and times in different formats.

The Form Flow framework makes it easy for you to capture required information without caring about other complex scenarios involved in bot communication. For example, navigating between steps, understanding numerical and textual entries, and validating values, etc. are automatically taken care of by the Form Flow. Using Form Flow, you can bind user supplied information to object model which can be saved to the database and used later on.

## Building Forms Using Form Flow

You don’t need to start creating Forms for your bot from scratch every single time. Microsoft Bot Framework gives you three options to jumpstart building Forms as mentioned below. Each of the options present in the listing is more flexible than the previous ones.

1. **Attributes**: Attributes are decorators on your model properties and classes that help people interact with your bot in a much better manner. For example, your model might have a boolean property called _isPrintRequired_ which you want to present to the user with a message _Would you like a printed copy?_. Attributes let you control such display messages.
2. **Custom Business Logic**: This option gives you control over how model properties need to be stored and retrieved. You can hook your custom logic to carry out data persistence operations and setting values of the model as desired.
3. **The Form Builder Class**: You can use this option if you want the highest level of control on your Form Flows.

Let's discuss each of these options in a little bit more detail.

## Attributes

There are seven attributes supported by the Bot Fx. They are:

1. **Prompt**: The prompt issued by the bot to ask the user to input value for a field. You can decorate your model property with the `Prompt` attribute to define the message that should be sent to the user asking for his input. For example `[Prompt("Would you like a printed copy?")]`.
2. **Describe**: This attribute lets you give an alias to your model properties. For example, you may want to refer to your property _isPrintRequired_ as _printed copy_ in your prompt message. In this case, you need to add a `Describe` attribute `[Describe("printed copy")]` and add a prompt `[Prompt("Would you like a {&}?")]` to yield _Would you like a printed copy?_.
3. **Numeric**: This attribute allows you to put a numeric limit on a property. For example `[Numeric(1,3)]` allows entering values only within the supplied range by the user.
4. **Optional**: This attribute allows the user not to provide input for a property. You can decorate your property with `[Optional]` to make it optional.
5. **Pattern**: This attribute allows you to specify a RegEx to validate the input. You can decorate your property with `[Pattern("REGEX")]` to validate user input against the expression.
6. **Template**: This attribute helps generate prompts or add values in prompts. For example, if you want to customize the message presented to the user to enable him to make a choice out of a given set of options, you can override the `EnumSelectOne` template (the default template used by Bot Fx) using this attribute as:
   `[Template(TemplateUsage.EnumSelectOne, "Please select a value for {&}", ChoiceStyle=ChoiceStyleOptions.PerLine)]`.
   Just like `EnumSelectOne` template, there are several other templates that you can override. [Here is a list](http://bit.ly/2rX0YiR) of all the templates that you can use.
7. **Terms**: This attribute lets you define alternate text for input. For example, for a volume field, you may want to enable the user to enter l, liter, ltr. etc. each of which should select the Litre option. You can apply a `Terms` attribute to allow the user to do that, e.g.,

```c#
public enum Volume
{
	[Terms("l", "liter", "ltr.")]
	Litre,
	Gallon
}
```

## Custom Business Logic

You can inject custom logic that gets triggered before setting the value of or getting value from a model property. This helps you add custom validations before setting the value or perform customizations before presenting the property value to the user. It is more flexible than Attributes and gives you a higher degree of control. Therefore, injecting custom business logic should be used only if you have exhausted all possibilities with the Attributes.

## Form Builder Class

The Form Builder class gives you the ultimate control over your bot and its interactions. It is a Fluent API interface and therefore, it is easy to understand and consume. Using the Form Builder, you can specify custom attributes and add custom logic which gives you the ultimate control over your bot.

## Putting The Learning To Use

In this exercise let’s extend our Blog Bot to accept user comments on aspects of my blog. Here is the source code to help you through the exercise.

{{< sourceCode src="https://github.com/rahulrai-in/blogbot/tree/FormFlowDemo">}}

## Adding Dialog

Create a folder named **Models** in the solution. Add a class file named `BlogComment` to the folder. Let's add two properties to prompt the user to select an aspect of the blog they want to comment on and the actual comment that the user wants to post.

```c#
public enum BlogAspectOptions
{
    Profile,
    Article
}

[Serializable]
public class BlogComment
{
    public BlogAspectOptions? BlogAspect;

    [Prompt("What message would you like to post?")]
    public string MessageForRahul;

    public static IForm<BlogComment> BuildForm()
    {
        return new FormBuilder<BlogComment>().Message("Hi, I am Blog Bot. We will populate entities now.").Build();
    }
}
```

The static method `BuildForm` will return an `IForm` object after building a form using the chained methods. While building this chain, we will post a message to the user to indicate that the form is in the process of being built.

Now let's go back to the **Dialog** folder and create a new class named `BlogBotDialog` that would decide the conversation to kick off based on user input. If the user says "Hi!" to the bot, then the `HelloDialog` that we built in the previous article will get invoked. In all other cases, the `BlogComment` form that we just built will get invoked.

We will use the fluent `Switch` function of `IDialog` to trigger the appropriate conversation.

```c#
// This is a dialog chain. This gets triggered with user message as argument.
public static readonly IDialog<string> dialog = Chain.PostToChain().Select(msg => msg.Text)
    // We will start with the Hello Dialog to greet user. Let's check whether user said "Hi"
    .Switch(
        new RegexCase<IDialog<string>>(
            new Regex("^hi", RegexOptions.IgnoreCase),
            (context, text) => new HelloDialog().ContinueWith(ContinueHelloConversation)),
        new DefaultCase<string, IDialog<string>>(
            (context, text) => (IDialog<string>)FormDialog.FromForm(BlogComment.BuildForm, FormOptions.PromptInStart)
                .ContinueWith(ContinueBlogConversation))).Unwrap().PostToUser();
```

Remember that we need to tell the bot about how to continue a conversation. The chained methods `ContinueHelloConversation` and `ContinueBotConversation` guide the bot through appropriate conversation continuations. Finally, the `Unwrap()` and `PostToUser()` functions direct the response to a new IDialog object and post the response to the user respectively. Let's go through both the continuation functions in detail. The `ContinueHelloConversation` function just terminates the conversation after posting a message to the user.

```c#
private static async Task<IDialog<string>> ContinueHelloConversation(IBotContext context, IAwaitable<object> item)
{
    var message = await item;
    context.UserData.TryGetValue("userName", out string name);
    return Chain.Return($"Thank you for using the Blog Bot: {name}");
}
```

One of the common questions that get asked on most of the forums is how you can fork an ongoing communication based on user input.The `ContinueBotConversation` demonstrates how it can be achieved simply by extending the existing call chain to include a new Dialog.

```c#
private static async Task<IDialog<string>> ContinueBlogConversation(IBotContext context, IAwaitable<BlogComment> item)
{
    // This will contain a BlogComment object with entities populated.
    var blogComment = await item;

    return new ForkedConversationDialog().ContinueWith(
        async (c, r) =>
                {
                    await c.PostAsync("Carrying out conversation based on user input!");
                    return Chain.Return($"You entered {await r}.End of forked conversation");
                });
}
```

When a dialog transfers control to a continuation function, its state is passed as an argument to the function. As you can see in the first line of the function in the code listing, we can retrieve the information received from the client and persist it. In the next statement, you can see how the conversation is directed to another dialog named `ForkedConversationDialog`. You can also use `IDialogContext.Call()` function to invoke another dialog from within a dialog.

I am not going to discuss the `ForkedConversationDialog` because it is straightforward and needs no explanation. It just accepts a user input and transfers that to the continuation function which just prints what the user has entered.

## Output

Let's launch the application and the emulator to see our code in action. Let's start with the `HelloDialog` that triggers when the bot receives a "Hi" as user input.

{{< img src="1.png" alt="Trigger HelloDialog" >}}

Now let's send any message other than "Hi" to trigger `BlogComment` form.

{{< img src="2.png" alt="Trigger BlogComment Form" >}}

Just what we expected. Not only can we see how we can work with forms but also how we can fork an ongoing conversation. Hope this proves helpful in your attempts to build your bots.

I will see you very soon in another post in which we will add intelligence to our bot using [Language Understanding Intelligent Service](https://www.luis.ai/) a.k.a LUIS.

{{< subscribe >}}
