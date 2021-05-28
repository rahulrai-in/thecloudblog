---
title: Cross Posting Tweets to LinkedIn with Power Automate
date: 2021-05-28
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Do you want your LinkedIn audience to know what you are up to on Twitter? Here's how I set up Power Automate to cross-post selective tweets to LinkedIn.

[Power Automate](https://docs.microsoft.com/en-us/power-automate/) is one of the products of the [Microsoft Power Platform](https://powerplatform.microsoft.com/en-us/) family. It is a web-based service that helps you create automated workflows between your favorite apps and services to synchronize files, get notifications, collect data, and more. Power Automate is available as part of the Office 365 suite and is available in most Office 365 subscriptions.

Sign-in to the [Power Automate platform](https://flow.microsoft.com/en-us/) and click on the **New Flow** button.

{{< img src="1.png" alt="Select Twitter trigger" >}}

In the **search text** input, enter the following value:

```plaintext
from:@<Your Twitter Handle>
```

I want to share any Tweet with the text "Tip" or which I mark with "+cp" (for cross-post) to LinkedIn. Add a **Control operation** to the flow and add the OR conditions to it as present in the following image:

{{< img src="2.png" alt="Power Automate Flow" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
