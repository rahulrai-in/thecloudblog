---
title: "Draft 06 Dec 20"
date: 2020-12-06
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

I discussed how you could use [Ansible with Terraform]({{< ref "/post/Simplifying Terraform Deployments with Ansible - Part 1" >}} "Terraform and Ansible") to simplify configuration management in my previous post. If, instead of Terraform, you prefer using [Azure Resource Manager (ARM) templates](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/overview) to define the infrastructure and configuration for your project, you can use Ansible for managing parameters that customize each environment by dynamically generating a [Resource Manager parameters](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/parameter-files) file.

A great thing about using Ansible for your ARM configuration needs is that it includes a [suite of modules](https://docs.ansible.com/ansible/latest/scenario_guides/guide_azure.html) for interacting with Azure Resource Manager. You can install the modules using [Ansible Galaxy](https://docs.ansible.com/ansible/latest/cli/ansible-galaxy.html) which is a repository of [Ansible Roles that](({{< ref "/post/Simplifying Terraform Deployments with Ansible - Part 1" >}} "Terraform and Ansible")) you can drop directly in your Playbooks.

Since we don't need the entire suite of Azure modules to apply an ARM template, I will rather use [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/what-is-azure-cli) in my Playbook to do the same. You can install Azure CLI on your DevOps server to run the Playbook in your CI/CD pipeline.

## Source Code

The source code of the Playbook is available in the following GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/azure-arm-ansible" >}}

I will walk you through the steps to develop the Playbook. I will often refer and point you to the concepts discussed in my previous blog post which describe the concepts in great detail.

## Rolling Out The Folders

Ansible Roles require a certain directory structure ([why?]((({{< ref "/post/Simplifying Terraform Deployments with Ansible - Part 2#directory-structure" >}} "Ansible Roles directory structure")))). Let's roll out the required folders with the following command.

```shell
$ mkdir -p {roles/plan/{tasks,templates},host_vars}
$ tree
.
├── host_vars
└── roles
    └── plan
        ├── tasks
        └── templates
```

Let's start populating the folders now. We'll use a public ARM quickstart template for this exercise which [creates an Azure WebApp](https://raw.githubusercontent.com/azure/azure-quickstart-templates/master/201-web-app-github-deploy/azuredeploy.json) within a resuorce group. If you often write ARM templates, you must be aware of the rich library of [quickstart templates](https://azure.microsoft.com/en-au/resources/templates/) that you can use as building blocks for your application.

## Setting Up The Role

Create a file named **main.yaml** in the **tasks** folder. In this file, we will write the tasks that would execute sequentially when you execute the Playbook.

```yaml
- name: Create parameters
  template:
    src: templates/azuredeploy.parameters.j2
    dest: "azuredeploy.parameters.json"

- name: Deploy ARM template
  shell: az deployment group create \
    --name AnsibleDeployment \
    --resource-group {{ resourceGroup }} \
    --template-uri "https://raw.githubusercontent.com/azure/azure-quickstart-templates/master/201-web-app-github-deploy/azuredeploy.json" \
    --parameters @azuredeploy.parameters.json
  register: deploy

- name: Output
  debug:
    msg: "{{ deploy.stdout }}"
```

The **Create parameters** task dynamically generates a unique [ARM parameters file](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/parameter-files) using a Jinja2 template, **azuredeploy.parameters.j2**, based on the environment. We will create this file next.

The **Deploy ARM template** task is quite simple. It execute the `az deployment` command of Azure CLI with arguments to apply the ARM template and the dynamically generated parameters file as arguments. Finally, the **Output** task prints the output printed by the previous command to the console.

Let's write the Jinja2 template now.

## Templating ARM Parameters File

Create a file named **azuredeploy.parameters.j2** in the **templates** folder and add the following code to it.

```jinja
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "siteName": {
      "value": "{{ arm['%s' | format(env)].siteName }}"
    },
    "location": {
      "value": "{{ arm.siteLocation }}"
    },
    "sku": {
      "value": "{{ arm['%s' | format(env)].sku }}"
    }
  }
}
```

The `arm['%s' | format(env)]` will read the appropriate variable based on the value of the `env` variable. We will supply the value of the `env` variable when we run the Playbook. To read more about such use of Jinja2 template, refer to my [previous blog post]({{< ref "/post/Simplifying Terraform Deployments with Ansible - Part 2#playbook-role" >}} "Ansible Roles directory structure").

Create a file named **localhost.yaml** in the **host_vars** folder. The file localhost.yaml will be read by Ansible when we execute the playbook against the host localhost. The files in the host_vars folder contain the variables that Ansible should use when targeting a particular host. You can also define variables that are common for all hosts in the same group here.

```yaml
arm:
  siteLocation: "australiaeast"
  production:
    siteName: "prod-ae-web"
    sku: "B1"
  staging:
    siteName: "prod-ae-web"
    sku: "F1"
```

With the nested configuration, the Jinja template will set the following values of the variables.

1. **siteName** (= arm[‘production’].siteName) will be set to **prod-ae-web**
2. **sku** (= terraform[‘staging’].sku) will be set to **F1**

Choose an appropriate name of the site and SKU as per your needs. See how I stupidly named the sites in both the environments as **prod-ae-web** 🤦‍♂️.

Finally, let's create a file named **deploy.yaml** in the root directory. This file will run the role named **plan** on the localhost. Remember that localhost is an implicit machine available in the Ansible inventory.

```yaml
- name: Apply configuration via localhost
  hosts: localhost
  connection: local
  roles:
    - plan
```

Let's execute the playbook to realize a success and a failure scenario.

## Executing The Playbook

I have created a helper script that you can use to easily execute the playbook. Create a shell script named **run.sh** in the base folder and populate it with the following code.

```shell
location='australiaeast'

# Install AZ CLI
echo 'Installing AZ CLI'
if ! command -v az >/dev/null; then
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
fi

# Authenticate using service principal on CI: https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal
echo 'Login to Azure'
az login
az account set --subscription $1

# Create resource group
echo 'Creating resource group'
az group create --name $2 --location $location >/dev/null

# Run playbook
echo 'Executing playbook'
ansible-playbook deploy.yaml -e resourceGroup=$2 -e env=$3
```

The previous script uses the positional parameters values of the command to creates a resource group and set the value of the environment parameter, `env`, of the Playbook.

Let's first execute the script to spin up the infrastructure on the staging environment. I am going to take the easy route and allow Ansible to use the auth tokens received by running the command `az login`. However, on CI you must use [service principal](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal) for authentication. The following command will create a resource group named **ansible-web-rg** in the subscription whose id that you pass as the argument and create a Web App in it.

```shell
sh run.sh <subscription id> ansible-web-rg staging
```

Keep a close eye on the file structure of your Playbook. When the playbook executes, you will find a new file named **azuredeploy.parameters.json** created in the base directory of the project. Execute the following command to view its contents.

```shell
$ cat azuredeploy.parameters.json

{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "siteName": {
      "value": "prod-ae-web"
    },
    "location": {
      "value": "australiaeast"
    },
    "sku": {
      "value": "F1"
    }
  }
}
```

Here is the output from the console I received on executing the previous command.

{{< img src="1.png" alt="Execute playbook" >}}

Let's visit the Azure management portal to verify the result.

{{< img src="2.png" alt="Inspect resources on the management portal" >}}

Let's now inspect the behavior of the playbook when we induce a bug. Set an unsupported SKU in the **localhost.yaml** file and replay the script. In this instance, you will receive the following output.

{{< img src="3.png" alt="Error on playbook execution" >}}

> 💡 **Tip**: If your terminal is not producing clean output like mine. Here are the three settings that you need to add/update in the **/etc/ansible/ansible.cfg** file under the **[defaults]** collection.
>
> _bin_ansible_callbacks = True_
>
> _stdout_callback = yaml_
>
> _stderr_callback = yaml_

Remember that we specified configuration values for the production environment as well. I have left it as an exercise for you to spin up the production environment for the application.

## Conclusion

We discussed how we can combine Ansible and ARM templates and use a little bit of magic of Jinja templates to generate parameters for ARM templates on the fly. I hope this article helps you add yet another tool to you IaC arsenal.

{{< subscribe >}}
