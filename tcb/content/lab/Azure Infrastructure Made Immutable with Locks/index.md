---
title: Azure Infrastructure Made Immutable with Locks
date: 2022-03-26
tags:
  - azure
comment_id: 1c34f67b-1234-4355-80f6-b0056b66dd10
---

After an application is deployed to production, developers should lock down its underlying infrastructure to prevent accidental changes. Some of the commons accidents that can affect the availability of an application in production are: moving, renaming, or deleting the resource crucial to the function of the application. You can use locks that prevent anyone from performing a forbidden action to avoid such mishaps.

## Creating Locks

Almost every resource in Azure supports locks, so you will find the lock option in the settings section of nearly all resources in the portal. For example, the following screenshot illustrates locks on resource groups:

{{< img src="1.png" alt="Lock option on the resource group" >}}

Let's assume we wish to prevent anyone from deleting a resource group. To do so, click on the **+Add** button and select the appropriate lock type option as follows:

{{< img src="2.png" alt="Add delete lock on the resource group" >}}

If you try to delete the resource group by clicking the **Delete resource group** button on the resource group overview blade, it will produce the following error:

{{< img src="3.png" alt="Error in deleting the resource group" >}}

## Types of Locks

There are two types of locks: _delete_ and _read-only_. As you have already seen, the delete lock prevents the resource from being deleted. The read-only lock goes one step further and prevents the resource from being deleted or modified. So, for example, you can not add a new service to a resource group with the read-only lock applied.

{{< img src="4.png" alt="Error in modifying the resource group" >}}

The read-only lock works differently for different resources. For example, for a storage account, the read-only lock prevents any changes to the service configuration.

## Managing Locks

Locks are also Azure resources. You can manage locks with Azure Powershell commands such as `Get-AzureRmResourceLock` or ARM templates. For example, the following screenshot presents the output of the `az lock list` command that lists the locks present in the subscription:

{{< img src="5.png" alt="List locks in the subscription" >}}

## Considerations

The locks only apply to the management plane operations of the resources, which means they are not a substitute for backup and recovery services. For example, a read-only lock on a SQL server resource will prevent anyone from deleting the server or modifying the configuration but won't affect the operations performed within the server, such as data manipulation operations, including deletes in the database.

Since the locks affect the management plane operations, they can affect some crucial operations in your workflow. Please read the [considerations before applying locks](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/lock-resources?tabs=json) section of the official documentation for more information.

{{< subscribe >}}
