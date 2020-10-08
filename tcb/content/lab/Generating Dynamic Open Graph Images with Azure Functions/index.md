---
title: Generating Dynamic Open Graph Images with Azure Functions
date: 2020-10-08
tags:
  - azure
  - compute
comment_id: cfe3ae9a-a0dc-4844-a126-e421da5c2d2f
---

[Open Graph (OG)](https://ogp.me/) tags allow you to control what content shows up when you share the webpage on major social media sites such as Facebook, Twitter, and Google. The essential Open Graph properties that you must configure in the `<head>` section of your webpage are the following.

1. `og:title`: The title of your webpage.
2. `og:image`: An image URL displayed as the thumbnail of your webpage when it is shared. The recommended dimension of this image is 1200px X 627 px.
3. `og:url`: The canonical URL of your webpage.

Azure Functions now supports [running headless Chrome on Linux](https://anthonychu.ca/post/azure-functions-headless-chromium-puppeteer-playwright/), and with this feature, you can now run browser automation tools such as [Puppeteer](https://github.com/puppeteer/puppeteer) on Azure Functions. Since this feature is also available on the consumption plan, you can keep the cost of running such functions very low by only paying for the processing capacity that you utilize.

Here is how I use Azure Functions and Puppeteer to generate dynamic OG images for my blog.

## The Template

I created a static HTML webpage on my website [available at this link](https://thecloudblog.net/opengraph.html) that displays a nicely formatted responsive panel.

{{< img src="1.png" alt="Template webpage" >}}

An embedded javascript on the webpage changes the placeholder text by reading the value of the query string parameter `t`. For example, if you append the query string `t=Awesome Blog` to the previous URL, you would see the following rendered HTML.

{{< img src="2.png" alt="Template webpage with a different title" >}}

We will setup Puppeteer on Azure Function to take a screenshot of this web page and respond to the HTTP request made to the function with the captured image.

## Azure Services

Execute the following commands to create a Resource Group and an Azure Function backed with an Azure Storage account.

```cmd
az group create -l australiaeast -n demo-rg

az storage account create --name <storage account name> --location australiaeast --resource-group demo-rg --sku Standard_LRS

az functionapp create --resource-group demo-rg --consumption-plan-location australiaeast --runtime node --functions-version 3 --name <function app name> --storage-account <storage account name> --os-type Linux
```

## Sample Code

You can use the following sample code for reference if you want to compare your implementation with it at any point during the exercise.

{{< sourceCode src="https://github.com/rahulrai-in/puppeteer-og-fx" >}}

We are going to cover the steps involved in building and deploying the sample application in the following sections.

## Puppeteer on Azure Function

Install the [Azure Function Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local) that will help you create, debug, and deploy Azure Functions. Let's first create an Azure Function project named _puppeteer-og-fx_ by executing the following command.

```cmd
func init puppeteer-og-fx --javascript
```

Navigate to the folder _puppeteer-og-fx_ in the terminal and execute the following command to add an HTTP triggered function named `og-gen`.

```cmd
func new --name og-gen --template "HTTP trigger"
```

Install the `puppeteer` and `waait` node packages in your function with the following command.

```cmd
npm install puppeteer waait
```

Open the function project folder in VS Code and open the file _index.js_ in the editor. We are going to add some code to the file to execute the following workflow.

1. Read the query string from the request made to the HTTP triggered function.
2. Form the URL of the template webpage and append the query string to it.
3. Use Puppeteer to capture a screenshot of the webpage in the desired dimension.
4. Store the generated image in an in-memory `Map` to be served from memory later without repeating the process.
5. Return the captured image as an image response to the client.

Replace the code in the file with the following to realize the workflow.

```js
const puppeteer = require("puppeteer");
const wait = require("waait");

const cached = new Map();

module.exports = async (context, req) => {
  const qs = new URLSearchParams(req.query);
  console.log(`https://thecloudblog.net/opengraph.html?${qs.toString()}`);
  const photoBuffer = await getScreenshot(
    `https://thecloudblog.net/opengraph.html?${qs.toString()}`
  );
  context.res = {
    body: photoBuffer,
    headers: {
      "content-type": "image/jpeg",
    },
  };
};

async function getScreenshot(url) {
  // first check if this value has been cached
  const cachedImage = cached.get(url);
  if (cachedImage) {
    return cachedImage;
  }
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.goto(url);
  await wait(1000);
  const buffer = await page.screenshot();
  cached.set(url, buffer);
  await browser.close();
  return buffer;
}
```

To avoid the function's misuse, I have hardcoded the base URL of the template web page in the function itself. You should change the hardcoded value to the URL of your template.

You can debug the function on your local system by pressing the **F5** key. If you are running the function app locally, you can visit the following URL to view the image response from your application.

```cmd
http://localhost:7071/api/og-gen?t=Awesome Blog
```

Next, we will deploy the function to Azure. During the installation of the node package, Puppeteer downloads an appropriate version of Chromium to the system based on the Operating System used. If you are running an OS that is different from that of the Azure Function host, you might run into compatibility issues on deploying your function package that includes the function code and the dependencies (node packages).

## Deploying The Application

Azure Functions support a feature called remote build through which you can upload just the code files and configurations of your application and let the Function App build your application and install the necessary node packages. We will use the Azure Function Core tools to deploy our application. However, you can also use VS Code to deploy your application, which would require a few more tweaks, as documented in [this blog post](https://anthonychu.ca/post/azure-functions-headless-chromium-puppeteer-playwright/).

Open the _.funcignore_ file in the editor and add an entry - `node_modules` into it. Doing so will prevent the _node_modules_ folder from being uploaded to the Function App.

Finally, execute the following command to upload your function artifacts and kick off the remote build process.

```cmd
func azure functionapp publish <function app name> --build remote
```

Once deployed, you can add the query string `t=Puppeteer on Azure Function` to the URL of the function and send a request to the resultant URL, which should return an image in the response.

{{< img src="3.png" alt="Puppeteer on Azure Function" >}}

Now that we have our Open Graph generator running, you can use the URL of our function as the value of the meta tag `og:image` on your web page. Since I use [Hugo](https://gohugo.io/) to build my website, the following is how I structure my OG meta tags.

```go
<meta property="og:title" content="{{ .Title }}" />

<meta property="og:url" content="{{ .Permalink }}" />

<meta property="og:image" name="image" content={{ .Site.OG-Function-URL }}?{{ (querify "t" .Title ) | safeURL }}.jpg />
```

In the previous code listing, you can see that I instruct Hugo to set the value of the `og:image` tag as the URL of the function along with a query string parameter - `t` with the value the same as the title of my article.

As a final note, I would like to add that you can [secure your Azure Function](https://docs.microsoft.com/en-us/azure/azure-functions/security-concepts) by enabling the function-level keys scoped to `Function`. If you detect misuse, you can rotate the keys from the Azure management portal and fix your website configurations to use the new key. Azure Functions support reading the function keys from a query string parameter named `code`, which you can append to the `og:image` tag value.

{{< subscribe >}}
