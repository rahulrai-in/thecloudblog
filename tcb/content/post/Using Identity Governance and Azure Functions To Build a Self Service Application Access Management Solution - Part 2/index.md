---
title: Using Identity Governance and Azure Functions To Build a Self-Service Application Access Management Solution - Part 2
date: 2022-08-13
tags:
  - azure
  - app service
comment_id: d26983a5-b6e9-4828-8e41-ada964f00e51
---

> In this series:
>
> 1. [Creating an authenticated web application and using Azure Functions to invite guest users to the organization](/post/using-identity-governance-and-azure-functions-to-build-a-self-service-application-access-management-solution-part-1/)
> 2. Creating an access package and redeeming it

In the last article, we created an application that can be accessed only by the users assigned to it. We also used Azure Functions and Microsoft Graph API to invite guest users to the organization. However, at this point, the guest user can not access the application, and manually adding every new user to the application and periodically reviewing their access is a cumbersome process.

## Entitlement Management

[Azure AD entitlement management](https://docs.microsoft.com/en-us/azure/active-directory/governance/entitlement-management-overview) is an identity governance feature that enables organizations to manage identity and access lifecycle at scale. It offers features for automating access assignments, request workflows, reviews, and access expiration. You can use entitlement management for any user in the Azure AD, whether they are internal or guest users.

Entitlement management addresses the challenges of maintaining resource catalog, approval workflows, and access expiration through the following capabilities:

1. Delegate the creation of access packages to non-administrators. Access packages contain resources such as security groups, applications, SaaS applications, and SharePoint sites to which users can request access. The creator of the access packages can define who can approve the access to the applications and when the user’s access will expire.
2. Entitlement management allows users of connected organizations to request application access as well. The user is automatically added to the Azure AD tenant when such a request is approved. When the access expires, the user is automatically removed from the tenant.

## Creating an Access Package for Guest Users

In this section, we will create an access package for the guest user we just invited. Then, we will define the lifetime of the access and grant permission to our application in the package.

1. Open the Azure Active Directory in the [Azure portal](https://portal.azure.com/).
2. From the Azure AD overview blade, select **Identity Governance**.

{{< img src="1.png" alt="Identity governance" >}}

3. Select the **Access Package** option and click on the **New Access Package** button.

{{< img src="2.png" alt="Create a new access package" >}}

4. Enter the following values in the wizard to create an access package:

   1. **Name**: Invited users package.
   2. **Description**: This package gives invited users access to the App4Guest application.
   3. **Catalog**: General. A catalog is a container for access packages, and it can be assigned to an owner who will be responsible for maintaining it. The General catalog is available by default, but you can also create your own.
      {{< img src="3.png" alt="Basic access package settings" >}}

5. Click on the **Next: Resource Roles** button.
6. In this step, you can define the resources you want to grant access to the users redeeming the package. Since we want our users to be able to access our application, click on the **Applications** button. Select the **App4Guest** application from the list of applications. Note that we don't yet have any applications in the **General** catalog, so you will need to select the checkbox to view the list of applications that are not in the catalog. The application will be automatically added to the catalog.
   {{< img src="4.png" alt="Add application" >}}

7. Now you will need to select a role for the application. Set the role to **Default access**.
   {{< img src="5.png" alt="Select resource roles" >}}

8. Click **Next: Requests**.

9. In the **Requests** step of the wizard, you can define the policy to establish who can request access to the package.

   1. Since we are creating the package for guest users, select **For users in your directory**.
   2. Next, you can choose the type of users that can access this package: specific users and groups, all members excluding guests, and all members including guests. Select **All users (including guests)**.
   3. Set the **Require approval** option to **No**. You can set this option to true and specify the approval hierarchy and conditions.
   4. Set the **Enable new requests** option to **Yes** to enable the users to request access to the package.
      {{< img src="6.png" alt="Set requests settings" >}}

10. Skip past the optional setting: **Requestor information**, which allows you to present questions to the requestor. Click **Next: Lifecycle**. Here, you can set the expiration date for the package.

    1. You can choose a specific date, a number of days, hours, or never. Select **Number of days** and set the access to expire after **14** days.
    2. To allow the requestor to choose a date range for the access, set the option **Users can request specific timeline** to **Yes**.
    3. Set **Require access reviews** to **No**.
       {{< img src="7.png" alt="Set expiration" >}}

11. Skip past the optional step: **Custom extensions**, which allows you to set up a workflow for the access requests, and click on the **Next: Review + create** button.
12. Review the settings and click the **Create** button to create the access package.

{{< img src="8.png" alt="Review access package settings" >}}

The package is now created. We will now have the guest user redeem the package to gain access to the web application.

## Redeeming the Access Package

Since the package is scoped to the guest users, the guest user can navigate to the [myaccess.microsoft.com](https://myaccess.microsoft.com/) website to view the available packages. Alternatively, you can copy the link to the package from the Azure portal from the **Access packages** overview page as follows:

{{< img src="9.png" alt="Get access package link" >}}

Log in with the guest user credentials to the [myaccess.microsoft.com](https://myaccess.microsoft.com/) website and request access to the package using the **Request** link as follows:

{{< img src="10.png" alt="Request access package" >}}

Since we didn't specify an approval workflow for the package, it will be automatically approved in a few minutes. Once approved, you will find the package in the list of **Active** access packages as follows:

{{< img src="11.png" alt="Active access packages" >}}

Navigate to [myapplications.microsoft.com](https://myapplications.microsoft.com/) to view the applications that you can access. You can access this link easily by clicking on the **My Apps** option from the top menu as follows:

{{< img src="12.png" alt="Navigate to My Apps" >}}

In the list of applications available to the guest user, you will find the **App4Guest** application tile. Clicking on the application tile will take you to the application page. The access to this application will expire when the package expires, or access to the package is revoked by the package administrator.

{{< img src="13.png" alt="App4Guest application" >}}

Behind the scenes, Azure AD added the guest user as a user of the **App4Guest** application. You can verify it by viewing the list of users that have access to the application as follows:

{{< img src="14.png" alt="Users of the App4Guest application" >}}

## Conclusion

In this article, we covered the Identity Governance and entitlement management capabilities of Azure Active Directory. We created an access package and shared it with a guest user. We also covered the steps that the guest user needs to take to redeem the package.

{{< subscribe >}}
