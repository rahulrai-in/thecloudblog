---
title: Bulding Azure Poxy
date: 2022-03-21
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

1. Create

https://docs.microsoft.com/en-us/azure/cognitive-services/cognitive-services-apis-create-account-cli?tabs=windows

```shell
az group create \
    --name text-translation-rg \
    --location westus2


az cognitiveservices account create \
    --name text-translation-resource \
    --resource-group text-translation-rg \
    --kind TextTranslation \
    --sku F0 \
    --location westus2 \
    --yes
```

```shell
az cognitiveservices account keys list \
--name text-translation-resource \
--resource-group text-translation-rg
```

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
