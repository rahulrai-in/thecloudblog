---
title: "Patterns for Asynchronous Services: Compiled Expressions"
date: 2016-11-20
tags:
  - cloud-patterns
comment_id: 0b0abc82-c053-42d3-8be3-6bd071cbc492
---

Previously we discussed the [Buffer Fill Pattern](/post/Patterns-for-Asynchronous-Services-Buffer-Fill-Pattern/) which can help eliminate bottlenecks in your applications. Let's tackle yet another challenge stopping you short from building your next flexible service that runs on distributed systems. The pattern that we are going to discuss today has little to do with distributed systems and is rather about component decoupling. This pattern will add flexibility to your system which you can manage through configurations stored in your application's database. Using the [Component Model](<https://msdn.microsoft.com/en-us/library/system.componentmodel(v=vs.110).aspx>), you will soon find out how we can dynamically invoke functions using their names and versions.

## Compiled Expressions

#### Example Scenario

Let us assume that we are building a system in which the business logic needs to be component based. For example, a UI label, which based on the role of user, renders either the sum total of the products sold, if the requester is an administrator, or renders the sum total of the products in the shopping cart, if the requester is a site user. In order to make the interface flexible, you can create a module that fetches from the application's database, the name of the function\action\API endpoint that code-behind of the UI label should execute to get the desired output. Next, the module that controls the content to display in the label should send a request to the relevant function and the label should render whatever response it receives. This approach makes the UI highly configurable and the configuration database a companion of the UI. The following is the design of the scenario that we just discussed.

{{< img src="1.png" alt="Compiled Expression Application Design" >}}

When the application first executes, the code modules responsible for rendering data of each of the UI controls will fetch the list of functions they need to execute to get the relevant data. It might be the case that parameters for these functions are also not static. Therefore, the parameters of each function may also be stored in the configuration database and be computed dynamically. Some of the most common parameters that are computed are user id, role name, current date time etc.

This framework may be used to build data agnostic UI and CMS systems. If your solution design is highly ambitious and you desire the highest level of flexibility, the assemblies that are stored in the container may be stored in Microsoft Azure Blob Storage and may be downloaded to local storage on application startup. In this case, the container can be composed from assemblies in local storage rather than by scanning the application.

#### Scenario

You may use this pattern when you desire:

1. Granular control over application processing.
2. Configurable UI design.
3. Alter business logic based on configurations stored in database or configuration file.
4. Compute contextual input rather than increase complexity of business logic.

#### Solution

The simplest tool to pick to implement this design is the Component Model. You can choose other composition tools such as [Autofac](https://autofac.org/) for this as well, but component model supports attributes integrated in the framework and is lighter than most of the other frameworks and is therefore my personal favorite. To implement it here in the sample in a simple manner, I have put all the various expression classes in a directory named **ExpressionStore** and decorated it with custom metadata that is defined in `IExpressionContainerMetadata` interface which helps identify what all named functionalities are stored in each expression class. Component Model would then identify this class for us and instantiate it. The only step left thereafter would be to invoke the expressions in the instatiated class by sending the name and associated parameters to it.

#### Source Code

You can download the source code of the implementation from my GitHub repository here.

{{< sourceCode src="https://github.com/rahulrai-in/CompiledExpressions" >}}

#### Executing the Sample

1. A class named `SampleExpressionStore` in the **ExpressionStore** folder contains 2 test expressions, `TestExpression1` and `TestExpression2`, which we would invoke dynamically. Since these two are the only expressions contained in the class, we list these two expressions in the attribute on this class.
2. The constructor attaches the name of expression to a delegate which would point to the actual function.
3. The function `CompiledExpression` in this class simply represents the delegate which was called.
4. The class, `ComposeExpression`, composes the container and returns the invoked expression by identifying and instantiating the class that contains the expression by identifying it from the CSV attribute which we placed on top of `SampleExpressionStore` class.
5. Making a call to the functions is straightforward, as can be seen from the test code, which is just a single line of code.

```cs
var expressionEvaluator = new ExpressionEvaluator();
var testExpression1ReturnValue = expressionEvaluator.ComputeExpression(
    "TestExpression1",
    "1.0.0.0",
    new List<KeyValuePair<string, dynamic>>
        {
            new KeyValuePair<string, dynamic>("PARAM1", "PARAM1Value"),
            new KeyValuePair<string, dynamic>("PARAM2", "PARAM2Value")
        });
```

I have personally used this pattern in a couple of applications that required the flexibility to alter the business logic through configurations. If your solution demands similar flexibility, this is a pattern that you should keep in your kitty.

{{< subscribe >}}
