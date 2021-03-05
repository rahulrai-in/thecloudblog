---
title: "Draft 24 Feb 21"
date: 2021-02-24
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

## Kafka notes

1. https://itnext.io/how-to-install-kafka-using-docker-a2b7c746cbdc
2. Kafka UI: https://github.com/provectus/kafka-ui
3. Other kafka ui tools: https://dev.to/dariusx/recommend-a-simple-kafka-ui-tool-5gob

## Launch Kafka UI

docker run -p 8080:8080 -e KAFKA_CLUSTERS_0_NAME=local -e KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092 -d provectuslabs/kafka-ui:latest

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
