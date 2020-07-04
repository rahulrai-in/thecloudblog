---
title: "Building Azure API Management Proxy for Azure Storage"
date: 2016-03-21
tags:
  - azure
  - compute
---

Microsoft acquired [Apiphany](http://techcrunch.com/2013/10/23/microsoft-acquires-apiphany-an-api-management-service-to-integrate-with-windows-azure/), backed it up with Azure compute and storage and has now made it available to users as API Management service. [Azure API Management](https://azure.microsoft.com/en-in/services/api-management/) is a reliable, secure and scalable way to publish, consume and manage APIs running on the Microsoft Azure platform. Azure API Management provides all essential tools required for end-to-end management of APIs. It ensures optimal performance of the APIs, tracks and enforces usage, authentication, and more.

Recently, I was reading about AWS API Gateway (a service similar to Azure API Management) which has [out of the box support](https://aws.amazon.com/blogs/compute/using-amazon-api-gateway-as-a-proxy-for-dynamodb/) for interacting with your AWS resources. I really liked the idea behind having an API front end for your resources. I will quote the reasons for which you may want to do so verbatim from the AWS blog post (replacing AWS with Azure of course!).

1.  You might want to enable your application to integrate with very specific functionality that an Azure service provides, without the need to manage access keys and secret keys that Azure APIs require.
2.  There may be application-specific restrictions you'd like to place on the API calls being made to the Azure services that you would not be able to enforce if clients integrated with the Azure APIs directly.
3.  You may get additional value out of using a different HTTP method from the method that is used by the Azure service. For example, creating a GET request as a proxy in front of an Azure API that requires an HTTP POST so that the response will be cached.
4.  You can accomplish the above things without having to introduce a server-side application component that you need to manage or that could introduce increased latency.

## Scenario

We want to implement an API to download private blobs from Azure storage in a secure manner. The API user needs to be authenticated and should be authorized to access the resources. We don't want to host a custom application that might introduce latency and whose resources such as memory and scalability need to be managed.

We will build this API using Azure API Management and use JWT token to authenticate and authorize the user. This approach not only abstracts the underlying service (Azure storage REST API) that serves the data (you can later switch the data provider to AWS S3 without modifying the clients) but also provides low latency access to your storage resources.

## Building the Resources

First and foremost, you need to create an [Azure storage account](https://azure.microsoft.com/en-in/documentation/articles/storage-create-storage-account/). Once you have it ready, create a private Azure blob container and add some files to it. I use [Azure Storage Explorer](https://azurestorageexplorer.codeplex.com/), which is a free and easy to configure utility, to assist me with such tasks. Here, I created a storage account named **secretresources**, created a container named **organizationresources** and added a few files into it.

{{< img src="1.png" alt="CreateAccountContainerAndAddFiles" >}}

Next, we need to [create an API Management instance](https://azure.microsoft.com/en-in/documentation/articles/api-management-howto-create-apis/) and [create an API](https://azure.microsoft.com/en-in/documentation/articles/api-management-howto-create-apis/) named **documentapi** in the instance.

{{< img src="2.png" alt="Create API" >}}

## Specify Operations

If you take a look at the [REST operations for Azure Blob](https://msdn.microsoft.com/en-us/library/azure/dd179377.aspx) service, the base URL used for all the operations is [https://<yourstorageaccountname>.blob.core.windows.net](https://<yourstorageaccountname>.blob.core.windows.net). Therefore, the **Web Service URL** that the API should forward requests to should be [https://<yourstorageaccountname>.blob.core.windows.net/](https://<yourstorageaccountname>.blob.core.windows.net/). Next, you may supply an optional Web API URL suffix, which we have left blank. Choose HTTPS as the URL scheme to ensure message transport security.

In Azure API Management, a [product](https://azure.microsoft.com/en-in/documentation/articles/api-management-howto-add-products/) contains one or more APIs as well as a usage quota and the terms of use. Once a product is published, developers can subscribe to the product and begin to use the product's APIs. By default, two products, named **Starter** and **Unlimited**, are created when you create a new API management instance. You can add your API to both the products in the wizard and click **Save**.

Once your API is created, it is time to add operations to the API. To [add a GET operation](https://azure.microsoft.com/en-in/documentation/articles/api-management-howto-add-operations/) to your API, select your API, click on **Operations** and select **Add Operation**. Fill out the various fields as shown below.

{{< img src="3.png" alt="Add Operation To API" >}}

Since the Get Blob operation in Azure Blob Storage REST API works with GET HTTP verb and we don't intend to translate it, we have specified GET as the HTTP verb for the operation. Next, in the **URL template** field, specify a placeholder based URL fragment which denotes the container and the blob that we need to access. Since, the [Get Blob operation](https://msdn.microsoft.com/en-in/library/azure/dd179440.aspx) of Azure Blob storage REST API expects the request to arrive in a similar URL format, therefore we need not supply a **Rewrite URL template**. Specify a **display name** for the operation and click **Save**.

## Defining The Policy

The behavior of an API in API Management is driven through policies. Policies are a collection of statements that are executed sequentially on the request or response of an API. A policy can alter both the inbound request and outbound response. Navigate to the policy applicable to your API by clicking on **Policies**, selecting your API and then selecting the relevant operation from the list.

{{< img src="4.png" alt="Select Policy" >}}

In the applicable policy we want to define two operations:

1.  Specify HTTP request headers for the Get Blob operation of Azure storage service.
2.  Validate the JWT sent to the API to authenticate and authorize the consumer of the service.

## Specifying HTTP Request Headers in Policy

The following statements in the policy specify the headers that should be added to HTTP Request when it is forwarded to the back-end Azure Blob Storage service.

```XML
<set-header name="date" exists-action="override">
    <value>@(context.Variables.GetValueOrDefault<string>("UTCNow"))</value>
</set-header>
<set-header name="Authorization" exists-action="override">
    <value>
			@{
				var account = "secretresources";
				var key = "YOUR STORAGE ACCOUNT KEY";
				var splitPath = context.Variables.GetValueOrDefault<string>("RequestPath").Split('/');
				var container = splitPath.Reverse().Skip(1).First();
				var file = splitPath.Last();
				var dateToSign = context.Variables.GetValueOrDefault<string>("UTCNow");
				var stringToSign = string.Format("GET\n\n\n{0}\n/{1}/{2}/{3}", dateToSign, account, container, file);
				string signature;
				var unicodeKey = Convert.FromBase64String(key);
				using (var hmacSha256 = new HMACSHA256(unicodeKey))
				{
					var dataToHmac = Encoding.UTF8.GetBytes(stringToSign);
					signature = Convert.ToBase64String(hmacSha256.ComputeHash(dataToHmac));
				}
				var authorizationHeader = string.Format(
					"{0} {1}:{2}",
					"SharedKey",
					account,
					signature);
				return authorizationHeader;
			}
      </value>
</set-header>
```

Note that we can write simple C# expressions in the policy definition. The [Policy Reference Guide](https://azure.microsoft.com/en-in/documentation/articles/api-management-policy-reference/) specifies what is supported and what is not. We have used the context variable in the expression which is implicitly available to the code inside the policy. The code used to compose the authorization header is taken from [Azure Storage Authentication](https://msdn.microsoft.com/en-in/library/azure/dd179428.aspx) documentation.

## Validate JWT

We will use JWT passed in a request header to the API to validate the incoming request and authorize the access based on the value of the `canDownload` claim present in the token. The following declaration in the policy helps achieve this objective.

```XML
<validate-jwt header-name="Token" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized">
    <issuer-signing-keys>
        <key>@(context.Variables.GetValueOrDefault<string>("SigningKey"))</key>
    </issuer-signing-keys>
    <required-claims>
        <claim name="canDownload">
            <value>true</value>
        </claim>
    </required-claims>
</validate-jwt>
```

The above mentioned declaration helps the API decode the token with the key mentioned in the `key` element. Note that the API expects the token to arrive as value in the HTTP request header named `Token`. The API, then checks for a claim named `canDownload` with value `true` to be present in the token. Following is the complete code listing for the policy.

```XML
<policies>
    <inbound>
        <set-variable name="APIVersion" value="2012-02-12" />
        <set-variable name="UTCNow" value="@(DateTime.UtcNow.ToString("R"))" />
        <set-variable name="RequestPath" value="@(context.Request.Url.Path)" />
        <set-variable name="SigningKey" value="SIGNING KEY 64 bit ENCODED" />
        <validate-jwt header-name="Token" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized">
            <issuer-signing-keys>
                <key>@(context.Variables.GetValueOrDefault<string>("SigningKey"))</key>
            </issuer-signing-keys>
            <required-claims>
                <claim name="canDownload">
                    <value>true</value>
                </claim>
            </required-claims>
        </validate-jwt>
        <base />
        <set-header name="date" exists-action="override">
            <value>@(context.Variables.GetValueOrDefault<string>("UTCNow"))</value>
        </set-header>
        <set-header name="Authorization" exists-action="override">
            <value>
				@{
					var account = "secretresources";
					var key = "YOUR AZURE STORAGE KEY";
					var splitPath = context.Variables.GetValueOrDefault<string>("RequestPath").Split('/');
					var container = splitPath.Reverse().Skip(1).First();
					var file = splitPath.Last();
					var dateToSign = context.Variables.GetValueOrDefault<string>("UTCNow");
					var stringToSign = string.Format("GET\n\n\n{0}\n/{1}/{2}/{3}", dateToSign, account, container, file);
					string signature;
					var unicodeKey = Convert.FromBase64String(key);
					using (var hmacSha256 = new HMACSHA256(unicodeKey))
					{
						var dataToHmac = Encoding.UTF8.GetBytes(stringToSign);
						signature = Convert.ToBase64String(hmacSha256.ComputeHash(dataToHmac));
					}
					var authorizationHeader = string.Format(
						"{0} {1}:{2}",
						"SharedKey",
						account,
						signature);
					return authorizationHeader;
				}
      </value>
        </set-header>
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

## Testing The API

Azure API Management instance comes with a configurable developer portal available at [https://<your API Management service>.portal.azure-api.net](https://<your API Management service>.portal.azure-api.net) (also accessible through a link available on top right hand side of management portal). In the portal, click on APIs and select your API from the list of available APIs. On your API definition page, click on Try it button. You should now have a view that is similar to the following.

{{< img src=5.png" alt="API Try It Screen" >}}

Before proceeding any further, let us generate a JWT that we need to send to the API along with the request.

## JWT Refresher

There is a nice little introduction of JWT present [here](http://jwt.io/introduction/). JWT is a JSON formatted token which is signed with an algorithm. The key used to encrypt the token is known only to the server and therefore the token can only be decoded by it.

JSON Web Tokens consist of three parts separated by dots (`.`), which are:

- Header: which typically consists of two parts: the type of the token, which is JWT, and the hashing algorithm such as HMAC SHA256 or RSA
- Payload: which contains the JSON formatted claims.
- Signature: To create the signature part you have to take the encoded header, the encoded payload, a secret, the algorithm specified in the header, and sign that.

Therefore, a JWT typically looks like this: **xxxxx.yyyyy.zzzzz**

Although, there are several libraries available that can be (and should be) used to programmatically generate the token. We will use the token generator available at [http://jwt.io](http://jwt.io) to generate a token that we can send to our API.

## Generating A Token

Navigate to [http://jwt.io](http://jwt.io) and then navigate to the token debugger. In the debugger, you can generate a token with a given header, payload and signature. The debugger color codes the header, payload and signature to show the various components which form the token.

{{< img src="6.png" alt="JWTTokenGenerator" >}}

You need to set the algorithm as HS256 and supply a base64 encoded **secret** used to sign the token. This is the same key that you supplied as **issuer signing key** in the API policy that you previously configured. Note that we have added the `canDownload` claim to the payload. Token expiry (denoted by name **exp**) is a required claim which denotes the lifetime of the token. It takes Unix Timestamp as value which can be computed through utilities such as [this one](http://www.unixtimestamp.com/index.php).

{{< img src="7.png" alt="Unix Timestamp" >}}

## The Result

Navigate to your API console and supply a valid container name and a blob name. Add a header named **Token** (because the API expects the token to be present in that header) and paste the token value that you previously generated as the value of this header.

{{< img src="8.png" alt="Request To API" >}}

Once you submit these details you should get a response from the Azure Storage API as follows.

{{< img src="9.png" alt="API Response" >}}

If not, the error would be captured in a trace file (only available if you have logged in the developer portal as administrator) that you can parse and try finding out the issues.

I hope that you enjoyed building this sample and that you will appreciate the how easy to use API Management service is. Thank you!

{{< subscribe >}}
