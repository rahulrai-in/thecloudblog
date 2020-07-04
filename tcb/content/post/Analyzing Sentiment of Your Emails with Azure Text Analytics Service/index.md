---
title: "Analyzing Sentiment of Your Emails with Azure Text Analytics Service"
date: 2015-11-21
tags:
  - azure
  - machine learning
---

[Azure Machine Learning](https://azure.microsoft.com/en-us/services/machine-learning/) allows data scientists to build and deploy predictive models. I am currently reading [Predictive Analytics with Microsoft Azure Machine Learning](http://www.apress.com/9781484204467), which in my opinion is a great resource to get started with ML. If you are a developer and don't really want to invest in learning ML, you can use [Azure ML web services](https://gallery.cortanaanalytics.com/browse/?categories=[%22Machine%20Learning%20API%22]) published by Microsoft and other publishers in the [Cortana Analytics Gallery](https://gallery.cortanaanalytics.com/). There are several interesting APIs, such as speech, face recognition and computer vision, available that you can use in your applications. Today, I will use [Text Analytics Service](https://azure.microsoft.com/en-us/documentation/articles/machine-learning-apps-text-analytics/), which is one of Azure ML web services available in the Cortana Analytics Gallery, to build an Outlook add-in that parses the subject of an email and classifies the email as one of :smile: :neutral_face: :angry:

## How Text Analytics Works

In a nutshell, if you give a piece of text to the Azure ML Text Analytics service, it returns a score between 0 and 1 denoting overall sentiment in the input text. Scores close to 1 indicate positive sentiment, while scores close to 0 indicate negative sentiment. You don't need to train the model before use, as the model is already trained. You can read more about how the algorithm works [here](http://blogs.technet.com/b/machinelearning/archive/2015/04/08/introducing-text-analytics-in-the-azure-ml-marketplace.aspx). However, in a nutshell, this is how this service works:

1. Obtain a large dataset of text with sentiment scores (must be easy for Microsoft).
2. Split text into words and apply stemming (converting word to its root form) e.g. fishing, fisher or fished is reduced to fish.
3. Create features from words. Some of the key features used are:
   - [N-Grams](https://en.wikipedia.org/wiki/N-gram): Generate all possible combinations of n consecutive words e.g. for "we are learning ML" and n=2, the sequence would be "we are", "are learning", "learning ML".
   - [Part-of-speech tagging](http://en.wikipedia.org/wiki/Part-of-speech_tagging): It is the process of identifying words belonging to a particular part of speech. A simplified form of this is identification of words as nouns, verbs, adjectives etc.
   - [Word embedding](http://en.wikipedia.org/wiki/Word_embedding): It is the process of mapping syntactically similar words close to each other e.g. car and bike are closer to each other than are car and office.
4. Once the features have been identified, the classifier is trained with the features.

## Before You Start

Not many people know that Office 13+ supports add-ins (previously called Apps for Office). You can build and debug add-ins in Visual Studio and submit them to the marketplace or distribute them privately. I encourage you to read more about the Office add-ins platform [here](https://msdn.microsoft.com/en-us/library/office/jj220082.aspx).

Secondly, you would need to sign up for the Text Analytics service [here](https://datamarket.azure.com/dataset/amla/text-analytics). You would also need a key to access the API which you can download from [here](https://datamarket.azure.com/account/keys). Before you get started, you can play with the API on the demo console available [here](https://text-analytics-demo.azurewebsites.net/).

Finally, to prepare your Visual Studio environment, you would need to install Office Developer Tools which you can find [here](https://www.visualstudio.com/en-us/features/office-tools-vs.aspx). You should also have an Office 365 account or a [free developer subscription](https://msdn.microsoft.com/en-us/office/office365/howto/setup-development-environment) to debug your add-in.

## Source Code

The entire source code of the application is available on GitHub. {{< sourceCode src="https://github.com/rahulrai-in/happymailfinder">}} In a very short time, we will have an Outlook add-in ready that analyzes the sentiment of the subject line of an email and displays an emoticon representing the sentiment. The solution has the following structure (the important files are highlighted).

{{< img src="1.png" alt="HappyMailFinder Solution" >}}

- **HappyMailFinder** is the project that contains the application manifest file. You should run this project to debug your add-in.
- **HappyMailFinderWeb** is a web project that contains web pages that are hosted inside Office client applications.

## Go Time

In your solution, create a new **App for Office** project (might get renamed).

{{< img src="2.png" alt="AppForOffice Project Wizard" >}}

In the next step, select your app type as **Mail**.

{{< img src="3.png" alt="AppForOffice Project Wizard App Type" >}}

On the next screen, select the options that make sure your app appears every time someone opens an email or an appointment to read.

{{< img src="4.png" alt="AppForOffice Project Wizard App Appearance" >}}

In the solution that unfolds, navigate to **AppRead** > **Home.html** and replace the markup inside `<body>` tag with the following HTML code. This markup defines the appearance of our add-in.

```XML
<div id="content-main">
    <div class="padding">
        <p><strong>Hi, I analyzed the subject line of your mail!</strong></p>
        <table id="details">
            <tr>
                <th>Subject Sentiment Score:</th>
                <td id="subject">Calculating...</td>
            </tr>
            <tr>
                <th>Your Mail Type:</th>
                <td id="mailType">Calculating...</td>
            </tr>
        </table>
    </div>
</div>
```

To invoke the **Text Analytics** service and display the sentiment scores in the web page that we modified, navigate to **AppRead** > **Home.js** and modify the `displayItemDetails` function and also add two more functions.

```JavaScript
function displayItemDetails() {
    var item = Office.cast.item.toItemRead(Office.context.mailbox.item);
    var encodedSubject = encodeURIComponent(item.subject);
    getScoreAsync(encodedSubject, displayResult);
}

function displayResult(responseData) {
    var score = JSON.parse(responseData).Score;
    $('#subject').text(score);
    $('#mailType').text(":-|");
    if (score<0.4) {
        $('#mailType').text(":-(");
    }
    if (score > 0.65) {
        $('#mailType').text(":-)");
    }
}

function getScoreAsync(encodedSubject, callback) {
    var xmlHttp = new XMLHttpRequest();
    var theUrl = "https://api.datamarket.azure.com/data.ashx/amla/text-analytics/v1/GetSentiment?Text=" + encodedSubject;
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
            callback(xmlHttp.responseText);
        }
    }
    xmlHttp.open("GET", theUrl, true);
    xmlHttp.setRequestHeader("Authorization", "Basic YOUR BASE64 ENCODED KEY");
    xmlHttp.setRequestHeader("Accept", "application/json");
    xmlHttp.send(null);
}
```

The mechanism is pretty straightforward. The function `displayItemDetails` retrieves the subject of the email and invokes the function `getScoreAsync`. The function `getScoreAsync` in turn sends an HTTP GET request, authorized with your base 64 encoded key, to the Text Analytics service and sends the result to the callback function `displayResult`. The callback function `displayResult` then prints the output. It is fairly reasonable to assume that scores less than **0.4** denote negative sentiments and scores greater than **0.65** denote positive sentiments.

That's it. Compile and execute the program. You would be asked to enter your credentials to access Outlook in Office 365\. Send some test mails to your account and be amazed :smile:

## Output

Following is what I got from my development efforts.

{{< img src="5.png" alt="Sad Mail" >}}

{{< img src="6.png" alt="Happy Mail" >}}

Now it's your turn. Why don't you extend this application and store the sentiments in a persistent store? May I also suggest displaying a small graphic on how the sender has been behaving with you (or others)? There's so much you can do with this service. Let your imagination loose. Hope you had fun reading this post! I will see you soon!

{{< subscribe >}}
