---
title: Delete Multiple Resources and Resource Groups in Azure with Tags
date: 2022-03-14
tags:
  - azure
comment_id: ce2b284b-e7d8-4b30-8db4-b9c0fb33a7ce
---

You might have noticed that resources comprising some Azure services such as [Azure Kubernetes Service (AKS)](https://azure.microsoft.com/en-au/services/kubernetes-service/) span multiple resource groups by default. In some cases, you might intentionally want to segregate resources such as disks and network interfaces from VMs by placing them in different resource groups for better management. A common problem arising from the resource spread is that you might find it challenging to delete multiple resources and resource groups to entirely remove a service from a subscription.

We can solve the problem by using [resource tags](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/tag-resources) to associate resources and resource groups to a service. Tags are key-value pairs that can be applied to your Azure resources, resource groups, and subscriptions. Of course, you can use tags for many other purposes apart from resource management. The Azure docs website has a [detailed guide on the various resource naming and tagging strategies and patterns](https://docs.microsoft.com/en-us/azure/cloud-adoption-framework/decision-guides/resource-tagging/).

## Tagging Resources

Let's start with the easiest method to create tags: through the UI. The following screenshot from the AKS cluster creation wizard presents the step to define tags for the resources comprising the AKS cluster:

{{< img src="1.png" alt="Specifying tags for resources during service creation" >}}

Almost every service creation wizard, including resource groups, allows you to set tags for the resources. The tags you define are applied to the resources and resource groups of the service when they are created. The Azure CLI and PowerShell command to create a service also support specifying tags using the `--tags` or `-TagName` parameter, respectively.

You can edit the tags of an existing resource by bringing up the tag editor window of the resource as follows:

{{< img src="2.png" alt="Editing tags of a resource" >}}

Apart from the UI, you can also use the [Azure CLI and PowerShell to apply tags to an existing resource](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/tag-resources).

## Deleting Resources Using Tags

We will create a command that deletes the resources and resource groups that have the tag `disposable-service` set to `true` for this demo. Remember that the names of the tags are case insensitive, and the tag values are optional.

Let's start with listing the resource groups that match the constraint using the `az group list` command as follows:

```shell
az group list --tag disposable-service=true --query "[].[id]" --output tsv
```

The complete list of commands in the `az group` family is available on the [Azure CLI docs website](https://docs.microsoft.com/en-us/cli/azure/group).

You can execute the previous command in the dedicated [Azure Cloud Shell](https://shell.azure.com) or the integrated Azure Cloud Shell by clicking on the Azure Shell icon in the Azure Portal toolbar. Here is the output of the command from my console:

{{< img src="3.png" alt="List of resource groups" >}}

The following command will delete all the resource groups that we received from the previous command. The parameter `--yes` allows you to skip the prompt to confirm the deletion.

```shell
az group list --tag disposable-service=true --query "[].[name]" --output tsv | xargs -l az group delete --yes --name
```

After removing the resource groups, we will delete individual resources with the `disposable-service` tag present in shared resource groups. For this, we will use the [`az resource list` command](https://docs.microsoft.com/en-us/cli/azure/resource) to list the ids of the resources that have the tag `disposable-service` set to `true` as follows:

```shell
az resource list --tag disposable-service=true --query "[].[id]" --output tsv
```

Following is the output of the command:

{{< img src="4.png" alt="List of resources" >}}

Next, we will use the [`az resource delete` command](https://docs.microsoft.com/en-us/cli/azure/resource?view=azure-cli-latest#az-resource-delete) to delete the identified resources. The command allows you to delete multiple resources simultaneously by setting a space-delimited list of resource ids as the `--ids` parameter value.

To consolidate the list of resource ids, we will pass the list of resource ids to the `tr` command, which will replace the newline characters with spaces, and then pass the space-delimited list of resource ids to the `resource delete` command as follows:

```shell
az resource list --tag disposable-service=true --query "[].[id]" --output tsv | tr '\n' ' ' | xargs az resource delete --ids
```

The final command to delete resource groups and resources enhanced with the ability to handle empty results is as follows:

```shell
az group list --tag disposable-service=true --query "[].[name]" --output tsv | xargs --no-run-if-empty -l az group delete --yes --name && \
az resource list --tag disposable-service=true --query "[].[id]" --output tsv | tr '\n' ' ' | xargs --no-run-if-empty az resource delete --ids
```

{{< subscribe >}}
