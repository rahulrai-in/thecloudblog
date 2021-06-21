---
title: Patterns to Distributing Data Concepts from Data Engineering on Azure
date: 2021-06-07
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

> I am giving away e-book copies of Data Engineering on Azure. To enter the giveaway, follow the instructions on Twitter.

In the initial stages of a data platform development, data size is small and it can be easily shared via email or services such as Power BI. Once the platform grows and different parts of the business become dependent on it, sharing data between systems becomes a big challenge.

The goal of Overall there are two patterns for consuming data.

1. **Low volume and high frequency**: Consuming small amounts of data (usually one or a few records) at very high frequency. This is common for websites.
2. **High volume and low frequency**: Bulk copy of large datasets (GBs or TBs of data) at a low frequency (daily, weekly, etc.). This is common for data ingestion platforms and batch processing systems.

Additionally, there are two less prominant patterns of data consumption:

1. **Low volume and low frequency**: This generally means refreshing a report which can usually be absorbed by any systems at no great cost.
2. **High volume and high frequency**: This pattern is implemented in streaming platforms. In general, streaming is used for processing data stream from IoT sensors. Azure services such as Azure Stream Analytics and Azure Event Hubs are available to build sreaming solutions.

Azure Data Explorer is a fast, fully managed data analytics service for analysis on large volumes of data.

```shell
az extension add -n kusto

az group create --location "Central US" --name data-processing-rg

az kusto cluster create `
--location "Central US" `
--cluster-name "employeeadx" `
--resource-group data-processing-rg `
--sku name="Dev(No SLA)_Standard_D11_v2" capacity=1 tier="Basic"

```

Let’s keep the cluster running for now as we finish the setup, but don’t forget to stop it when not needed.

```shell
az kusto cluster stop `
--cluster-name "employeeadx" `
--resource-group adx-rg

az kusto cluster start `
--cluster-name "employeeadx" `
--resource-group adx-rg
```

https://dataexplorer.azure.com/#

```
.create table Employees ( Area_code:string, Area_name:string, Data_type_code:string, Data_type_text:string, Footnote_codes:string, Industry_code:string, Industry_name:string, Period:string, Seasonal:string, Series_id:string, State_code:string, State_name:string, Supersector_code:string, Supersector_name:string, Value:real, Year:int32 )
```

## My Review of Data Engineering on Azure

> Disclaimer: Manning sent me a copy of Data Engineering on Azure for review and sponsored the giveaway of the title. I am not bound to give any title favorable reviews under the Manning content partner program.

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
