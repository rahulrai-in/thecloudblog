---
title: Using Identity Governance and Azure Functions To Build a Self-Service Application Access Management Solution - Part 1
date: 2022-08-06
tags:
  - azure
  - app service
comment_id: 3d4266d1-55f1-46e4-a74c-3b8a9978c3b9
---

Azure Active Directory serves two primary use cases:

1. It enables you to [grant users and applications access to your Azure resources](https://docs.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal) in a secure and scalable manner.
2. You can set up Azure AD as an authentication provider for your web applications so that only the desired Azure AD users can access your application. [Integrating App Services and Azure Functions to Azure AD for authentication](https://docs.microsoft.com/en-us/azure/app-service/configure-authentication-provider-aad) is easy and does not require making any changes to your existing code.

In an organization with many users, inviting users and managing user permissions for Azure resources and web applications soon becomes a tedious operation. A great solution to this problem is the [Identity Governance feature of Azure AD](https://docs.microsoft.com/en-us/azure/active-directory/governance/identity-governance-overview). It allows you to govern the identity and access lifecycle for users both within and outside your organization. On top of that, it provides secured privileged access for administration.

Azure AD Identity Governance enables non-admin users to create access packages. An [access package](https://docs.microsoft.com/en-us/azure/active-directory/governance/entitlement-management-access-package-create) contains the resources such as Azure AD groups, Office 365 groups, SharePoint sites, and Azure AD applications to which an internal or guest user can request access. The access package policies determine who can approve the access requests and when the access will expire.

In this series of articles, we will learn to use Azure Functions to invite a guest user to the organization and use access packages to grant the guest user time-bound permissions to access a web application. Here is the complete workflow of the process:

1. Create a web application and restrict its access to users explicitly assigned access to it.
2. Create an Azure Function and use Microsoft Graph API to invite a guest user to the organization.
3. Create an access package that grants permissions to the user to access the application.
4. Ask the guest user to redeem the access package.

In this post, we will discuss the steps to create an authenticated web application and use an Azure Function to invite a guest user to the organization. In the next post, we will discuss steps 3 and 4 in more detail.

## Creating an Authenticated Web Application

1. Log in to the [Azure portal](https://portal.azure.com/) as a Global Administrator.
2. [Create a new App Service application](https://docs.microsoft.com/en-au/azure/app-service/quickstart-arm-template?pivots=platform-linux).
3. Navigate to your application in the Azure Portal and click on the **Authentication** option in the **Settings** section.
4. Add an identity provider for your application with the following settings and click **Add**:

{{< img src="1.png" alt="Add an identity provider" >}}

## Restrict Application Access to Assigned Users

Let's make it necessary for the users to be assigned to the application before they can access it. The policy prevents the users registered in the Active Directory who are not listed as users of the application (see [How to assign users account to an application](https://docs.microsoft.com/en-us/azure/active-directory/manage-apps/add-application-portal-assign-users)) from accessing the application. Click on the **Properties** option in the **Manage** section and turn on the toggle for the **Assignment required** setting as follows:

{{< img src="2.png" alt="Assignment required setting" >}}

We now have an application that can only be accessed by a subset of users in the Azure AD. Now we will automate the process of inviting guest users to our organization.

## Inviting a Guest User to the Organization with Azure Functions

We will now invite guest users to join our organization using Azure Functions. We will use [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/use-the-api) in our Function to automate sending the invite to the user. We know that REST APIs are not meant for end-user interactions. To solve this problem, although not covered in this article, you can call the Function through a custom user interface such as [Power Apps](https://powerapps.microsoft.com/) to make inviting new users to the organization even easier.

Before using the Graph API, we must register the Function application in Azure AD with the proper permissions. So let's do that now.

### Create an Azure AD App Registration

1. Navigate to Azure AD in the [Azure portal](https://portal.azure.com/).
2. In the Azure AD overview blade, select the **App registrations** option and click on the **+ New registration** in the top menu.
3. Populate the application registration form as follows and click on the **Register** button to complete the registration:

{{< img src="3.png" alt="Create new registration" >}}

4. After the app registration is created, you will be redirected to the app's overview page. We will now grant permission to invite new users to the application. In the left menu, select the **API permissions** option and click on the **+ Add a permission** option in the top menu.

{{< img src="4.png" alt="API permissions" >}}

5. In the next blade, select the **Microsoft Graph** option as we will use Microsoft Graph for creating a guest user.
6. Choose **Application permissions** as the type of permission required by our application and add the following permissions:
   1. User.ReadWrite.All: For writing details of the user to the AD.
   2. User.Invite.All: For inviting a guest user to the organization.

{{< img src="5.png" alt="Add app permissions" >}}

7. Click **Add permissions**.
8. Click **Grant admin consent** for the permissions as follows:

{{< img src="6.png" alt="Grant admin consent to permissions" >}}

9. Finally, create an app secret. Our Function App will require it together with Azure AD tenant ID and the application ID to make a request. In the left menu, click **Certificates & secrets**.
10. Click the **+ New client secret** option under the **Client secrets** section.
11. Set the secret name and when you want it to expire. Then, click on the **Add** button to create the secret.

{{< img src="7.png" alt="Set client secret values" >}}

12. Copy the secret value and save it because it will be displayed only once.
13. From the overview page of the app registration, copy the Application ID and the Tenant ID. We will use these values to authenticate our calls to the Graph API from our Function App.

In the next part, we will create the function.

### Invite Guest Users Using an Azure Function

Create an HttpTrigger C# function with VS Code by following the instructions in the [Azure Functions quickstart guide](https://docs.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-csharp). We will now write the code for the function. Also, here is the source code of the function for your reference:

{{< sourceCode src="https://github.com/rahulrai-in/GuestUserGraphFx" >}}

Open a new VS Code terminal and enter the following commands to install the required NuGet packages:

```shell
dotnet add package Azure.Identity
dotnet add package Microsoft.Graph
```

Let's now write the Azure AD app registration details to the **local.settings.json** file. The Function runtime makes these values available to the function as environment variables during debugging. Open the file and add the following key and value pairs to the **Values** field.

```json
{
  "Values": {
    "AzureWebJobsStorage": "",
    "AzureADAppId": "YOUR CLIENT ID",
    "AzureADTenantId": "YOUR TENANT ID",
    "AzureADAppSecret": "YOUR CLIENT SECRET"
  }
}
```

Create a class named **AddGuestUser** and add the following code to it:

```csharp
public class AddGuestUser
{
    [Function(nameof(AddUser))]
    public async Task<HttpResponseData> AddUser(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")]
        HttpRequestData request)
    {
        var queryDictionary = QueryHelpers.ParseQuery(request.Url.Query);
        var firstName = queryDictionary["firstName"];
        var email = queryDictionary["email"];

        var invitation = new Invitation
        {
            InvitedUserDisplayName = $"{firstName}",
            InvitedUserEmailAddress = email,
            // Replace the redirect URL with the URL of the access package which we will create later.
            InviteRedirectUrl = "https://myapplications.microsoft.com/",
            InvitedUserMessageInfo = new()
            {
                CustomizedMessageBody =
                    "Welcome to my organization. Please request access to applications through the self service portal."
            },
            SendInvitationMessage = true,
            Id = email
        };

        var graphClient = GetAuthenticatedGraphClient();
        var graphResult = await graphClient.Invitations
            .Request()
            .AddAsync(invitation);

        if (graphResult != null)
        {
            return await request.Ok("ok");
        }

        return await request.BadRequestAsync("error");
    }

    private static GraphServiceClient GetAuthenticatedGraphClient()
    {
        // Read more about scopes: https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent
        var scopes = new[] { "https://graph.microsoft.com/.default" };

        // Values from app registration
        var tenantId = Environment.GetEnvironmentVariable("AzureADTenantId", EnvironmentVariableTarget.Process);
        var clientId = Environment.GetEnvironmentVariable("AzureADAppId", EnvironmentVariableTarget.Process);
        var clientSecret = Environment.GetEnvironmentVariable("AzureADAppSecret", EnvironmentVariableTarget.Process);

        var options = new TokenCredentialOptions
        {
            AuthorityHost = AzureAuthorityHosts.AzurePublicCloud
        };

        var clientSecretCredential = new ClientSecretCredential(
            tenantId, clientId, clientSecret, options);

        return new(clientSecretCredential, scopes);
    }
}
```

[Microsoft Graph](https://developer.microsoft.com/en-us/graph) is a set of APIs that connects multiple Azure services and provides a single endpoint for developers to use in custom applications. Apart from the application permissions mode we used in our case, you can invoke the API on behalf of an Azure AD user (delegated permissions) to get data specific to them, such as their devices, manager, documents, and so on. When you invoke the Graph API based on application permissions, the application acts as its own entity, and you can use it to perform actions for multiple accounts simultaneously.

Azure AD is one of the services integrated with Microsoft Graph. Nearly all the SaaS products of Azure that operate with Azure AD, such as Office 365, SharePoint, and Azure SQL Database, are integrated with Microsoft Graph. Please visit the [Graph API explorer tool](https://developer.microsoft.com/en-us/graph/graph-explorer) to see the available APIs, download sample applications, and study the request and response formats of the APIs.

Coming back to our function, we now have a POST endpoint that accepts the email and first name of the guest user and sends them an invitation to join the organization. To test the function, open a new terminal and run the command `dotnet build`. After a successful build, run the function by pressing **F5**, which will result in the following output:

{{< img src="8.png" alt="Debugging the function locally" >}}

Add the required query string parameters to the endpoint URL displayed in the terminal and use a tool such as [Postman](https://www.postman.com/) to send a POST request to the endpoint. The URL should look like the following example:

```plaintext
http://localhost:7008/api/AddUser?firstname=NAME&email=EMAIL
```

Here is the outcome of the POST request from the Postman console:

{{< img src="9.png" alt="Response from the function" >}}

Open the email sent to the user and accept the invite to join the organization. Following is the email that I received after executing the function:

{{< img src="10.png" alt="Email sent to the user" >}}

After accepting the invite, you will find the user added to your Azure AD as follows:

{{< img src="11.png" alt="User added to Azure AD" >}}

You can follow the instructions in the [Azure Function VS Code development guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-develop-vs-code) to deploy the function app to Azure.

## Conclusion and What's Next

In this article, we deployed a web application and configured its authentication using Azure AD so that only the users assigned to the application can access it. In addition, we covered how you can add guest users to Azure AD using an Azure AD app registration, Azure Function, and the Graph API.

Currently, the guest user is only a member of Azure AD and can not access the web application. In the following article, we will set up an access package for the user to enroll themselves as the users of the application and gain temporary access to it.

{{< subscribe >}}
