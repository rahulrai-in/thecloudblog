---
title: Simplifying Terraform Deployments with Ansible - Part 2
date: 2020-11-06
tags:
  - devops
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

> In this series
>
> 1. [Motivation & Ansible 101]({{< ref "/post/Simplifying Terraform Deployments with Ansible - Part 1" >}} "Motivation & Ansible 101")
> 2. Terraform & Ansible

I am happy that many people are enthusiastic about this series and wish to make their IaC application better with Ansible. What I intend to do is really simple. I am going to write an Ansible playbook that uses the template module (see [Templating with Jinja2]({{< ref "/post/Simplifying Terraform Deployments with Ansible - Part 1#templating-with-jinja2" >}} "Templating with Jinja2")) and a little magic of Jinja2 templates to load appropriate variables and configurations for each Terraform environment. Finally, I will use the Terraform CLI to deploy and delete the infrastructure.

I am going to assume that you understand the various components of Terraform well. Please refer to the [official Terraform documentation](https://www.terraform.io/docs/index.html) if the terms or concepts sound unfamiliar to you. Please install [Terraform CLI](https://learn.hashicorp.com/tutorials/terraform/install-cli) and [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-apt) on your Linux system. If you are using Windows, install the dependencies on WSL2.

## Directory Structure

To keep the example short and simple, let's assume that we want to create an Azure Container Registry within an Azure Resource Group in two environments, viz. **staging**, and **production**. Execute the following script to setup relevant directories. Refer to the [Ansible Roles]({{< ref "/post/Simplifying Terraform Deployments with Ansible - Part 1#roles" >}} "Ansible Roles") section of the previous post to understand the layout of the **roles** folder created by the command. Apart from the **roles** folder, the folder named **tf** will contain the Terraform configuration files, and the folder **host_vars** will contain the host specific variables. There are multiple ways of setting the values of the variables used in an Ansible playbook. You can set them through the command line using the flag `-e` which has the highest precedence, or you can set them through files in the **host_vars** or **group_vars** folder. Each file in the **host_vars** folder is named after the host that it represents. Read more about [adding variables to an Ansible inventory](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html#adding-variables-to-inventory) on the Ansible documentation website.

```sh
$ mkdir -p infra/{tf,roles/plan/{tasks,templates},host_vars}
$ tree

└── infra
    ├── roles
    │   └── plan
    │       ├── tasks
    │       └── templates
    ├── tf
    └── host_vars
```

The folders are now ready to be populated with relevant files. Let's start adding them now.

## Terraform Configurations

Create a file named _main.tf_ inside the folder _tf_. Add the following configuration code to the file which will create an Azure Resource Group and an Azure Container Registry within the resource group.

```tf
terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate-rg"
    storage_account_name = "mytfstatestore"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "2.35.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "rg" {
  name     = var.rg_name
  location = var.region
}

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.region
  sku                 = "Basic"
  admin_enabled       = false
}
```

As you can see that we require some parameters in our configuration. Create a file named **variables.tf** in the same folder and specify the parameters used by the configuration as follows.

```tf
variable "rg_name" {
  type = string
}

variable "region" {
  type = string
}

variable "acr_name" {
  type = string
}

variable "environment" {
  type = string
}
```

Let's now create tasks in the `plan` [Playbook Role](https://docs.ansible.com/ansible/latest/user_guide/playbooks_reuse_roles.html).

## Playbook Role

As we discussed earlier, Ansible's roles organization feature allows you to organize your Ansible files better. This organization helps in automatically loading the vars files and tasks based on the structure of the folders. Create a file named main.yaml in the tasks folder and define the tasks that consitute the plan as follows.

```yaml
- name: TF tasks
  import_tasks: tf-tasks.yaml
```

The task `TF tasks` will import the tasks present in the file _tf-tasks.yaml_. Create a file named _tf-tasks.yaml_ and define the tasks as follows.

```yaml
- name: Substitute tfvars
  template:
    src: templates/tfvars.j2
    dest: "{{ playbook_dir }}/tf/env.tfvars"

- name: Init Terraform
  shell: |
    cd {{ playbook_dir }}/tf;
    terraform init
  when: (operation == "init")
  register: init

- name: "Display output: Init Terraform"
  debug:
    msg: "{{ init.stdout }}"
  when: (operation == "init")

- name: Create resources - Plan
  shell: |
    cd {{ playbook_dir }}/tf;
    terraform workspace new {{ env }}
    terraform workspace select {{ env }}
    terraform plan -var-file=env.tfvars -out=plan.tfplan;
  when: (operation == "create-plan")
  register: create_plan

- name: "Display output: Create resources - Plan"
  debug:
    msg: "{{ create_plan.stdout }}"
  when: (operation == "create-plan")

- name: Create resources
  shell: |
    cd {{ playbook_dir }}/tf;
    terraform workspace select {{ env }}
    terraform apply plan.tfplan
  when: (operation == "create")
  register: create

- name: "Display output: Create resources"
  debug:
    msg: "{{ create.stdout }}"
  when: (operation == "create")

- name: Destroy resources
  shell: |
    cd {{ playbook_dir }}/tf;
    terraform workspace new {{ env }}
    terraform workspace select {{ env }}
    terraform destroy -var-file=env.tfvars -auto-approve
  when: (operation == "destroy")
  register: destroy

- name: "Display output: Destroy resources"
  debug:
    msg: "{{ destroy.stdout }}"
  when: (operation == "destroy")
```

Here is what each task does:

1. **Substitute tfvars**:

Define the template

```jinja
rg_name = "{{ terraform['%s' | format(env)].rg_name }}"
region = "{{ terraform['%s' | format(env)].region }}"
acr_name = "{{ terraform['%s' | format(env)].acr_name }}"
environment = "{{ terraform['%s' | format(env)].environment }}"
```

This file is selecting values from the parameters passed to the role. Create a file named localhost.yaml in the host_vars folder. The file localhost.yaml will be read by Ansible when we execute the playbook against the localhost. The files in the host_vars folder contain the variables that Ansible shoud use when targeting a certain host. You can also define common variables here that are common for all hosts in the same group.

```yaml
terraform:
  production:
    rg_name: "prod-ae-rg"
    region: "australiaeast"
    acr_name: "prodaeacr"
    environment: "production"
  staging:
    rg_name: "stag-ae-rg"
    region: "australiaeast"
    acr_name: "stagaeacr"
    environment: "staging"
```

Finally, you just need the playbook file that will drive this workflow.

```yaml
- name: Apply configuration via localhost
  hosts: localhost
  connection: local
  roles:
    - plan
```

## Demo

I have created a script that you can use to execute the playbook.

```sh
tfstate='mytfstatestore'
tfstaterg='tfstate-rg'
location='australiaeast'

# Install AZ CLI
if ! command -v az >/dev/null; then
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
fi

# Authenticate using service principal on CI
az login
az account set --subscription $1

# Create TF state store resource group
if [ $(az group exists --name $tfstaterg) = false ]; then
    az group create --name $tfstaterg --location $location >/dev/null
fi

# Create TF state store
if [ $(az storage account list --query '[].name' -o json | jq 'index( "$tfstate" )') ]; then
    az storage account create -n $tfstate -g $tfstaterg -l $location --sku Standard_LRS >/dev/null
    az storage container create -n tfstate --account-name $tfstate >/dev/null
fi

# For TF backend store
export ARM_ACCESS_KEY=$(az storage account keys list -n $tfstate --query [0].value -o tsv)

case $2 in
"init")
    ansible-playbook cluster.yaml -e env=$3 -e operation=init
    ;;
"destroy")
    ansible-playbook cluster.yaml -e env=$3 -e operation=destroy
    ;;
"create")
    ansible-playbook cluster.yaml -e env=$3 -e operation=create
    ;;
"create-plan" | *)
    ansible-playbook cluster.yaml -e env=$3 -e operation=create-plan
    if [ ! -f "/tf/plan.tfplan" ]; then
        (
            cd tf
            terraform show plan.tfplan
        )
    fi
    ;;
esac
```

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
