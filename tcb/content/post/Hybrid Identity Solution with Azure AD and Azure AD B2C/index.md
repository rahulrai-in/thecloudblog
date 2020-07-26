---
title: "Hybrid Identity Solution with Azure AD and Azure AD B2C"
date: 2016-08-26
tags:
  - azure
  - security & identity
---

I am going to retire the current stack of technologies used in this blog in favor of more recent technologies, mainly because I currently author this blog using [Windows Live Writer](https://www.microsoft.com/en-au/download/details.aspx?id=8621) which is outdated and has lost the love of community. I am also taking this opportunity to create a new technology stack that is much more modular and allows me to focus only on writing. I am also learning cool new stuff which might be useful to all of us. I am  super happy with a few components that I currently use and I would be reusing the things that are working well. The entire source code of this blog is available in my [GitHub repository](https://github.com/rahulrai-in/rahulrai) from where you can happily copy and paste stuff. You can also read about how I built the existing blog framework (v1) [here](/post/the-first-post). Of course, I would write about how I chose components for my new blogging platform and how you can set one up yourself, so stay tuned (even better, [subscribe](#subscribe)).

> September 8, 2016: This activity is now complete and you are reading this post on my new blogging platform.

Azure Access Control Service is [dead](https://blogs.technet.microsoft.com/enterprisemobility/2015/02/12/the-future-of-azure-acs-is-azure-active-directory/) (well almost). [Azure AD B2C](https://azure.microsoft.com/en-us/services/active-directory-b2c/) is out, up and running and supports many of the common social accounts and even using new credentials. Both the [Azure AD](https://azure.microsoft.com/en-us/documentation/articles/active-directory-whatis/) and Azure AD B2C use OAuth 2.0 mechanism to authorize access to resources of users. At this point some of you may want to understand...

## What is OAuth 2.0?

If you like reading loads of text, here is what Microsoft's documentation [recommends that you read](https://tools.ietf.org/html/rfc6749#section-4.1). For the rest of us, including me, we will use [OAuth 2.0 playground](https://developers.google.com/oauthplayground/) to understand what OAuth is. For this activity you will require an account with Google and an interest in YouTube. We will use OAuth based flow to fetch the content that is displayed on your YouTube homepage.

There are four parties in the OAuth flow, namely:

1.  **Resource Owner**: In our experiment this is you. The **Resource Owner** or user grants  permission to an application to access his\her content (YouTube feed data). The access of application is limited to the _**scope**_ of authorization (e.g. read only, write only, read-write etc.)
2.  **Authorization Server**: This server stores the identity information of the **Resource Owner**, which in our case is Google's identity server. It accepts user credentials and passes two tokens to the application.
    1.  **Access Token**: The token which the application can use to access the **Resource Owner's** content.
    2.  **Refresh Token**: The token that the application can use to get a fresh **Access Token** before or when the **Access Token** expires. The **Refresh Token** may have a lifetime after which it becomes invalid. Once that happens, the user would be required to authenticate himself\herself again.
3.  **Client/Application**: The **Client** is the application that wants to access the **Resource Owner's** data. Before it may do so, it must be authorized by the **Resource Owner** and the authorization must be validated by the **Authorization Server**.
4.  **Resource** **Server**: This the application that trusts the **Authorization Server** and will honor requests that are sent with **Access Tokens** by the application. This in our case is YouTube. **Resource Owner** can limit the authorization granted to the client by specifying the **_Scope_**. You must have seen the application of **Scope** in Facebook’s ability for users to authorize a variety of different functions to the client (“access basic information”, “post on wall”, etc.).

Now, visit the playground site and select **YouTube Data API v3** (the resource on the YouTube resource server) **>** [**https://www.googleapis.com/auth/youtube.readonly**](https://www.googleapis.com/auth/youtube.readonly) (the scope).

{{< img src="1.png" alt="Select API" >}}

Click on **Authorize API** to authorize the playground application (**Client**). Enter your (**Resource** **Owner**) credentials on Google's authentication server (**Authorization** **Server**) and grant permission to the application by clicking on the **Allow** button.

{{< img src="2.png" alt="Grant Permission" >}}

Once you are redirected to the OAuth playground, you would find the single use authorization token that has been granted to you. You now need an access token that you can send to the YouTube API. You can obtain an access token and a refresh token in exchange of the authorization token by sending the authorization token to the resource server. Click on **Exchange Authorization Code for Tokens** button to generate the tokens.

{{< img src="3.png" alt="Access Token and Refresh Token" >}}

You can manually obtain a new access token by clicking on **Refresh Access Token** button before the lifetime of access token expires (the timer in red). However, selecting "**Auto-refresh the token before it expires**" takes care of this process automatically. Now, let's try to access the resource server with your access tokens. Navigate to **step 3** and enter [https://www.googleapis.com/youtube/v3/activities?part=snippet&mine=true](https://www.googleapis.com/youtube/v3/activities?part=snippet&mine=true "https://www.googleapis.com/youtube/v3/activities?part=snippet&mine=true") as the **Request URI**. Using this URI, you can get the details of all the videos on that are rendered on your home page. Click on **Send the Request** button.

{{< img src="4.png" alt="YouTube Activity" >}}

Notice the request and the response and how the access token that you passed in the request header was accepted by the **Resource Server**. The content of the response is cropped to hide the NSFW video links that at times appear on my YouTube home page :) (kidding!). Okay, now that you have learnt about the seemingly tough OAuth mechanism, you can easily understand how Azure AD and Azure AD B2C works. I assume that you are already familiar with the [OWIN framework](http://owin.org/). Let me take you straightaway to..

## OWIN Authentication Middleware

If you start with a blank ASP.net template, inside **Startup.Auth.cs** you will find a method named `ConfigureAuth` that sets up the authentication middleware. The main base classes that implement the authentication middleware in Katana are `AuthenticationMiddleware` and `AuthenticationHandler`. Katana also has several derived classes that implement several authentication mechanisms such as cookie based authentication and external authentication (such as Google, Facebook, Microsoft etc.). Any implementation of the `AuthenticationMiddleware` class has to implement the `Invoke` method and override `CreateHandler` method to return a new instance of `AuthenticationHandler`. The derived implementation of `AuthenticationHandler` is created per request and it overrides the methods of base class depending on nature of authentication to be performed. The middleware is registered in startup configuration of the application.

Depending on the mechanism of authentication, the following methods of `AuthenticationHandler` class need to be implemented.

- `AuthenticateCoreAsync` - This method encapsulates the core authentication logic. It should look for tokens in request and return `AuthenticationTicket`, which is the container of the caller's identity.
- `InvokeAsync` - This method handles callbacks such as those in OAuth mechanism. In case of requests that need to be redirected, it logs in the user using some middleware such as cookie based middleware, issues a redirect and then returns true to stop processing any other middlewares. In case of requests that don't need to be redirected, it simply returns false so that the rest of the pipeline is executed.
- `ApplyResponseGrantAsync` - This method is invoked in the later part of processing of the authentication middleware. It is responsible for for either issuing or clearing  a token.
- `ApplyResponseChallengeAsync` - This method is invoked in later part of processing of the authentication middleware. It issues a challenge to the user if the application has issued unauthorized response to the request. This method may issue a redirect request to the login page.

Armed with all the knowledge, it's time to get started. Let's start with...

## What Are We Building

Many applications serve content to both external and internal users. The organization may want the two category of users of the application to authenticate differently and interact differently with the application. We will build an application that supports authentication with both Azure AD and Azure AD B2C. You will find out that if you already have an existing application that you want to integrate with Azure AD and Azure AD B2C, there won't be any change required in application logic.

## Code

The entire source code of this sample is available for use in your applications. {{< sourceCode src="https://github.com/rahulrai-in/multiauth">}}

## Build Time

Download or clone the sample and follow along to get the application running. We will first configure the application to work with Azure AD B2C. For this sample I have borrowed heavily from the [official sample](https://github.com/AzureADQuickStarts/B2C-WebApp-OpenIdConnect-DotNet) for Azure AD B2C on MSDN.

- Create an Azure AD B2C instance in your subscription by following the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-b2c-get-started/).
- Once the instance has provisioned, register your application in the instance by following the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-b2c-app-registration/). The following screenshot shows the sequence of steps that need to be followed to add your application to Azure AD B2C instance.

{{< img src="5.png" alt="Create Application in Azure AD B2C" >}}

- The entire experience of authentication in Azure AD B2C is policy driven. Using policies, you can define how the user can sign-up, sign-in or edit his\her profile. Use the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-b2c-reference-policies/) to create a **Sign up** and a **Sign in** policy. Do remember to choose **User ID sign-up** or **Email sign-up** in the identity providers blade. You can add as many claims as you wish. The following screenshot shows the sign in policy that I configured. You can use the **Run Now** button to experience the policy (pretty cool).

{{< img src="6.png" alt="Add Policy" >}}

- The application uses the following nuget packages. Try rebuilding the solution to restore the nuget packages.

```
PM> Install-Package Microsoft.Owin.Security.OpenIdConnect
PM> Install-Package Microsoft.Owin.Security.Cookies
PM> Install-Package Microsoft.Owin.Host.SystemWeb
```

- Switch to **web.config** file and populate the values of Azure AD B2C configuration.

```xml
<appSettings>
...
<add key="ida:Tenant" value="{your tenant name}.onmicrosoft.com" />
<add key="ida:ClientId" value="{client id}" />
<add key="ida:AadInstance" value="https://login.microsoftonline.com/{0}/v2.0/.well-known/openid-configuration?p={1}" />
<add key="ida:RedirectUri" value="https://localhost:44339/" />
<add key="ida:SignUpPolicyId" value="{your tenant Sign Up policy name}" />
<add key="ida:SignInPolicyId" value="{your tenant Sign In policy name}" />
<add key="ida:UserProfilePolicyId" value="{your tenant profile policy name}" />
</appSettings>
</pre>
```

- Let's take a look at **Startup.Auth.cs** file that handles authentication for us. We have three instances of `OpenIdConnectAuthenticationMiddleware` (derived from `AuthenticationMiddleware`), one for each B2C policy in the authentication pipeline. We have also initialized three instances of `OpenIdConnectAuthenticationHandler` (derived from `AuthenticationHandler`) with values obtained from `OpenIdConnectAuthenticationOptions`. Since the authentication mechanism is passive, the `InvokeAsync` method in `OpenIdConnectAuthenticationHandler` returns an `AuthenticationTicket` and requests redirection to the resource in case the token is valid. The method `ApplyResponseChallengeAsync` is responsible for getting the  properties of a challenge by accepting its name as parameter and redirecting the user to the appropriate endpoint so that the challenge can be completed (keep this point in mind, we will use this knowledge very soon).

```CS
app.UseOpenIdConnectAuthentication(CreateOptionsFromPolicy(SignUpPolicyId));
app.UseOpenIdConnectAuthentication(CreateOptionsFromPolicy(ProfilePolicyId));
app.UseOpenIdConnectAuthentication(CreateOptionsFromPolicy(SignInPolicyId));
```

- The following code crates instances of `OpenIdConnectAuthenticationOptions`.

```CS
private OpenIdConnectAuthenticationOptions CreateOptionsFromPolicy(string policy)
{
    return new OpenIdConnectAuthenticationOptions
    {
        // For each policy, give OWIN the policy-specific metadata address, and
        // set the authentication type to the id of the policy
        MetadataAddress = String.Format(aadInstance, tenant, policy),
        AuthenticationType = policy,
        // These are standard OpenID Connect parameters, with values pulled from web.config
        ClientId = clientId,
        RedirectUri = redirectUri,
        PostLogoutRedirectUri = redirectUri,
        Notifications = new OpenIdConnectAuthenticationNotifications
        {
            AuthenticationFailed = AuthenticationFailed,
        },
        Scope = "openid",
        ResponseType = "id_token",
        // This piece is optional - it is used for displaying the user's name in the navigation bar.
        TokenValidationParameters = new TokenValidationParameters
        {
            NameClaimType = "name",
        },
    };
}
```

- Now let's move to `AccountController` which will help us authenticate the user. Let's focus on `SignIn` action that is triggered when the user clicks on the **Sign In** link on the page.

```CS
public void SignIn()
{
    if (!this.Request.IsAuthenticated)
    {
        // To execute a policy, you simply need to trigger an OWIN challenge.
        // You can indicate which policy to use by specifying the policy id as the AuthenticationType
        this.HttpContext.GetOwinContext().Authentication.Challenge(new AuthenticationProperties { RedirectUri = "/" }, Startup.SignInPolicyId);
    }
}
```

- To invoke the authentication pipeline, you need to raise an authentication challenge. You also need to specify the name of the authentication middleware that should handle the request, which is same as the name of policy that you specified while configuring the authentication middleware. Notice that the `AuthenticationManager` connects the delegate that should handle the request to `OpenIdConnectAuthenticationHandler` that we previously configured. Essentially, the statement above is just invoking `ApplyResponseChallengeAsync` method (I hope you remember!).

{{< img src="7.png" alt="Handler Mapped to OpenIdConnectAuthenticationHandler" >}}

- You need to register a user before you can try logging in. Navigate back to the application and click on **Sign Up** to raise the sign up challenge.

{{< img src="8.png" alt="Sign Up" >}}

- This action will take you through the experience of sign up that you previously configured.

{{< img src="9.png" alt="Sign Up Experience" >}}

- Try the **Sign In** operation after you have signed up. Next, we will enumerate all the claims that the authenticated user has. Navigate to [https://localhost:portnumber/Home/Claims](https://localhost:portnumber/Home/Claims) which is an `Authorized` action that lists your claims.

{{< img src="10.png" alt="View B2C Claims" >}}

Let's now move on to integrate Azure AD in this solution. Do remember the point that we can selectively invoke a middleware by using its name. We will use this fact to build the sample further.

- Create an Azure AD instance by following the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-administer/#how-can-i-get-an-azure-ad-directory).
- Create a new group named **Employee** in the AD instance with the help of steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-accessmanagement-manage-groups/#how-do-i-create-a-group).

{{< img src="11.png" alt="External Directory" >}}

- Add a new user to the directory by following the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-create-users/).

{{< img src="12.png" alt="Add User to AD" >}}

- Add this user to the **Employee** group that you just created by following the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-accessmanagement-manage-groups/#how-do-i-add-or-remove-individual-users-in-a-security-group). We are performing this action because the groups that the user is part of automatically get translated to the roles (role claim) of the signed in user.

{{< img src="13.png" alt="Add User to Group" >}}

- Now, let's integrate Azure AD with our application. Follow the steps mentioned [here](https://azure.microsoft.com/en-us/documentation/articles/active-directory-integrating-applications/) to add your application to the Azure AD instance that you provisioned.

{{< img src="14.png" alt="Add Application to Azure AD" >}}

- Now add the relevant configuration details to the **web.config** file of the application.

```XML
<add key="ida:B2ETenant" value="{your tenant name}.onmicrosoft.com" />
<add key="ida:B2EClientId" value="{your application client id}" />
<add key="ida:B2EAadInstance" value="https://login.microsoftonline.com/{0}" />
<add key="ida:RedirectUri" value="https://localhost:44339/" />
<add key="ida:B2EEmployeeSignInPolicyId" value="OpenIdConnect-B2E" />
```

- Let's revisit the **Startup.Auth.cs** file. Here you will find the following statement that injects Azure AD middleware to the authentication pipeline.

```CS
app.UseOpenIdConnectAuthentication(this.CreateB2EOptions());
```

- The `CreateB2EOptions` method supplies necessary values to `OpenIdConnectAuthenticationHandler` through a new instance of `OpenIdConnectAuthenticationOptions`. Note that we have supplied a name to this middleware just as we did to the Azure AD B2C middleware.

```CS
private OpenIdConnectAuthenticationOptions CreateB2EOptions()
{
    return new OpenIdConnectAuthenticationOptions
    {
        Authority = string.Format(b2eAadInstance, "common"),
        ClientId = b2eClientId,
        RedirectUri = redirectUri,
        PostLogoutRedirectUri = redirectUri,
        Notifications =
                new OpenIdConnectAuthenticationNotifications { AuthenticationFailed = this.AuthenticationFailed },
        TokenValidationParameters = new TokenValidationParameters { ValidateIssuer = false },
        AuthenticationType = B2EEmployeeSignInPolicyId
    };
}
```

- Now let's revisit the `AccountController` and check the action that allows an _employee_ to sign in. The code should look very familiar to you as it just raises a challenge for Azure AD middleware to complete.

```CS
public void EmployeeSignIn()
{
    if (!this.Request.IsAuthenticated)
    {
        this.HttpContext.GetOwinContext().Authentication.Challenge(new AuthenticationProperties { RedirectUri = "/" }, Startup.B2EEmployeeSignInPolicyId);
    }
}
```

- Let's sign in to the application with the user that we created in the Azure AD by clicking on **Sign in-Employee** link. You might be required to change your password the first time you sign in.

{{< img src="15.png" alt="Login Employee" >}}

- Take a look at another method named `EmployeeClaims` in Home controller that allows access only to users with the role **Employee**. We will invoke this method by accessing [https://localhost:port/Home/EmployeeClaims](https://localhost:port/Home/EmployeeClaims).

```CS
[Authorize(Roles = "Employee")]
public ActionResult EmployeeClaims()
{
    return View();
}
```

- The result

{{< img src="16.png" alt="Employee Claims" >}}

## Conclusion

I hope I have been able to show you in sufficient detail how you can integrate both the Azure AD and Azure AD B2C in a single application. The ability to selectively invoke the Owin middleware is really powerful and can allow for different identity providers to be integrated in an application. Let me know the wonderful things you have realized by using Azure AD in the comments section.

{{< subscribe >}}
