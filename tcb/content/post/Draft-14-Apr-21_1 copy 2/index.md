---
title: Shoreline disk
date: 2021-06-25
tags:
  - product-management
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

- Write a blog post on that establishes a need to resize a disk and why is it painful
  > Situations where resize is required.
  > Express need that we should be able to automate it.
- Envts. to focus: Kubernetes and VM mixed envt.
- Account for how you can do it in Kubernetes, but also how you can do it on VMs.
- Small focus on: How do you delete log files and increase size of disk.
- Common use cases where data deletion disk expansion is required.
- Show that it is painful operational work and the post should say that it is unnecessary and it is something that can be automated.
- He is going to add a tutorial on how it can be done with shoreline at the end of the post

Applications or databases running out of disk space are a common issue that the Operations team addresses regularly. This problem has existed since we used to host applications on bare metal servers and still present in virtualized and container environments. However, since we have reached a stage where the compute and storage systems are decoupled from each other, granting additional storage to applications rarely requires updating the application or modifying the underlying application host infrastructure.

Before we discuss the practical solutions to addressing the disk saturation problem, let’s examine the types of storage classes and the workloads that require them:

1. **Hot storage**: Optimized for frequently accessed data by workloads such as websites, video streaming, and mobile applications.
2. **Nearline storage**: Optimized for infrequently accessed data that is stored for at least 30 days. It is used for data backups and long-tail multimedia content.
3. **Cold storage**: Optimized for infrequently accessed data that is stored for at least 90 days. It is used primarily for storing data necessary for disaster recovery.
4. **Archive storage**: Optimized for storing data that is rarely accessed and stored for at least 180 days. You can access the storage for reading data in the order of hours. It is used to store regulatory archive data.

The cost of storage varies based on the I/O throughput required. Hot storage is the most expensive out of all the options, and Archive storage is the cheapest. Low I/O throughput activities such as backups are planned and scheduled, and hence they rarely require immediate intervention from the Operations teams. Therefore, we will focus our attention on some of the typical workloads of the Hot storage and discuss the quick fixes that we can apply when the workloads hit the disk limits so that the Operations teams can plan for a long-term fix.

### Databases

When a database runs of disk space, you can clear the following data from the disk to resume operations:

1. Remove large error log files, e.g., for MySQL databases, files in the /var/log/ directory can be removed.
2. Remove old data files (MDF and LDF for SQL Server).
3. Delete old stack dumps and crash dumps.
4. Remove redundant backup files.
5. Remove any data from temporary directories, e.g., the /temp directory.

The location of the data can vary based on the database used. SQL Server supports clearing error logs through a built-in stored procedure `sp_cycle_errorlog`. MySQL supports removing binary logs using the operation `PURGE BINARY LOGS`. However, other operations such as clearing crash dumps require deleting files from specific directories.

### Virtual Machines

VM backups and snapshots can take a lot of space on the host machine. If your VM runs out of disk, it will suspend/pause itself. Following are some of the steps you can take to address the situation immediately:

1. Extend/expand the Virtual Hard Disk.
2. Delete old snapshots and backups.
3. Compacting dynamically expanding disks.

The steps to perform the operations vary with the virtualization platform, such as Hyper-V and VMWare. For an environment with a few VMs, you can use the platform's user interface to reclaim disk space. VMWare and Hyper-V allow you to script the operations as well.

### Application Servers

Application servers' log files can take up a lot of space. Additionally, if your application is writing logs to disk, it will consume disk space as well. Let's enumerate the steps that can help you free up disk space before a permanent solution to add more server disk space is applied:

1. Delete or compress IIS log files present in the _%SystemDrive%\inetpub\logs\LogFiles_ directory.
2. Delete or compress application log files.
3. Delete or compress Tomcat log files from the _/opt/tomcat/logs/_ directory.
4. Delete tmp, cache, and logs directories Weblogic server. If you do not want to lose the latest logs, force the server to rotate logs to overwrite old log files.

You can see that the location of the log files varies with the Application server you use. Please search online for the location of log files stored by your application server and options available to script the operation.

### Disk Pressure in Kubernetes

Kubernetes will kill pods when they breach a resource threshold to reclaim the starved resource. A Kubelet constantly monitors the available node memory, disk, and process ids (PIDs). When the pods on the node lead to a breach of the resource thresholds, the kubelet executed a Garbage Collector routine to reclaim resources from dead pods and containers. If the pressure continues to exist, the kubelet starts evicting pods that consume more resources than they had requested.

We will restrict our discussion to Node disk pressure in this article. High disk pressure indicates that a node is using too much disk space or is filling the disk space too fast, according to the thresholds set by you or the defaults in the Kubernetes configuration. Disk pressure is an important metric to monitor because it might mean that you need to add more disk space if your application legitimately needs more space. Or it might mean that an application is suffering from memory leaks and filling up the disk prematurely in an unanticipated manner.

To keep the application running before the developers and Operations fix the underlying issue, you can expand the disk space available to the pod by expanding the mounted persistent volume. This blog (https://kubernetes.io/blog/2018/08/02/dynamically-expand-volume-with-csi-and-kubernetes/) outlines the steps for the process.

### Data Lake

Cloud Data Lake storage systems are designed to be scalable; hence you might not encounter storage limitations. You are more likely to encounter query performance issues with Data Lakes because the performance depends on the file size, number of files, and folder structure. If you are trying to address performance issues, you can process the incoming data like the following:

1. Aggregate small files to create a larger file between 256MB and 100GB in size for better performance in analytics engines such as HDInsight, and Azure Data Lake.
2. For storing time-series data, use a file and folder naming format such as \DataSet\YYYY\MM\DD\HH\mm\datafile_YYYY_MM_DD_HH_mm.tsv that minimizes the number of files that need to be processed by a query. Such naming schemes can optimize for large file sizes and the number of files in each folder.

## Automated Troubleshooting

When the applications come to a grinding halt at crunch time, it isn't easy to parse directories and delete dispensable data. A much better approach is to study the workloads that rely on disks and prepare automation scripts that you can run manually or through your monitoring system when the issue occurs.

Ideally, you should be able to invoke the disk issue resolution scripts through your monitoring system.

{{< subscribe >}}
