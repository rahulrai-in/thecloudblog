---
title: Crosspost Tweets to LinkedIn with Power Automate
date: 2021-06-01
tags:
  - azure
  - automation
comment_id: f55bc135-79df-4d15-ad82-dffa4e10800a
---

Do you want your LinkedIn audience to know what you are up to on Twitter? Here's how I have set up Power Automate to crosspost specific tweets to LinkedIn.

## What is Power Automate

[Power Automate](https://docs.microsoft.com/en-us/power-automate/) is one of the products of the [Microsoft Power Platform](https://powerplatform.microsoft.com/en-us/) family. It is a web-based service that helps you create automated workflows between your favorite apps and services to synchronize files, get notifications, collect data, and more. Power Automate is available as part of the Office 365 suite and is available in most Office 365 subscriptions.

## Building the Twitter-LinkedIn Flow

Sign in to the [Power Automate platform](https://flow.microsoft.com/en-us/) and click on the **Build an automated cloud flow** button. In the dialog, please assign a name to the flow and select the trigger that will launch your flow, which is a new tweet posted on Twitter. Let's search for the available Twitter triggers and select the **When a new tweet is posted** trigger from the results. The selected trigger operation can trigger a flow when it discovers a tweet that matches the given search query, which we will configure next.

{{< img src="1.png" alt="Create new flow" >}}

Click on the **Create** button and configure the trigger by entering the following value in the **search text** input control that will kick off the flow when you post a new tweet:

```plaintext
from:@<Your Twitter Handle>
```

The following screenshot illustrates the state of the trigger after entering the required input:

{{< img src="2.png" alt="Enter search text" >}}

Click on the **New Step** button and add a **Control operation** to the flow. I want to crosspost any tweet to LinkedIn which contains the text "Tip" or which I flag with text "+cp" (crosspost). Also, I don't want to crosspost any retweets to LinkedIn. The tweet text of a retweet starts with the string "RT", so I will add a condition to filter tweets that begin with the string "RT". The following screenshot illustrates the conditions that exclude the tweets that don't match my requirements:

{{< img src="3.png" alt="Filter tweets control operation" >}}

When the condition evaluates to **true**, we will post a message to LinkedIn. Select **Add an action** on the **If yes** branch of the condition. Enter the text "LinkedIn" in the search box and select the **Share an article v2** action.

Configure the action card with relevant input, as illustrated in the following image. You can read more about the various input parameters of the action on the [Microsoft documentation website](https://docs.microsoft.com/en-us/connectors/linkedinv2/#share-an-article-v2).

{{< img src="4.png" alt="LinkedIn - Share an article v2 step" >}}

The following screenshot presents the complete flow. Click on the **Save** button to save and start the flow. You can now send a tweet from your account and test the flow.

{{< img src="5.png" alt="Power Automate Flow" >}}

Finally, after all the hard work, it's time to see the result. Here is how a crossposted tweet will appear on your LinkedIn timeline. Apart from the steps that I mentioned, I added a custom thumbnail image by setting the value of the `Image URL` property in the LinkedIn connector. The thumbnail image supersedes the default Twitter preview image displayed on LinkedIn.

{{< img src="6.png" alt="Post on LinkedIn" >}}

## Conclusion

You worked through a complete example of crossposting tweets to LinkedIn to drive more engagement and followers. Power Automate is not limited to connecting only with Microsoft products. You will find a diverse range of 3rd party connectors such as Asana, Mailchimp, DocuSign, Google Drive, and Eventbrite available in the Power Automate connector library.

The connectors may require additional licenses. However, the plethora of connectors expand the possibility of building and automating the processes in your business and personal life.

{{< subscribe >}}
