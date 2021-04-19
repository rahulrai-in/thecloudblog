---
title: "Use Support Backed Tedious Driver for Your Node Applications with SQL Database"
date: 2017-01-03
tags:
  - programming
  - compute
comment_id: 5c6e4fd7-adeb-4192-a631-cf676be9736f
---

I don't know [how popular Node.js still is](https://www.quora.com/Is-Node-js-declining-already), but it is always fun to learn new programming languages. If you have previously worked with relational databases such as SQL database with Node.js, you must've noticed that there are several node packages available to enable application integration with SQL database. However, while building commercial applications, developers always want to use packages that are backed by professional support and a lively community. One such module is [Tedious](http://tediousjs.github.io/tedious/) which we will discuss today.

## What is Tedious?

Tedious is a Node package that provides an implementation of the TDS protocol, which is used to interact with instances of Microsoft's SQL Server. Since Tedious is built entirely using Javascript, it is platform independent and can connect to SQL instances deployed on cloud or on premise. It has a lively community that is actively contributing to it and addresses feedback promptly. The best thing about Tedious is that [Microsoft actively contributes to it](https://channel9.msdn.com/Events/Connect/2016/160) and keeps it at par with the latest features rolled out to SQL server. It is even better than other packages because it is backed by Microsoft support.

## Sample

We will build a sample that uses Tedious to fetch data from Microsoft Azure SQL database. You can download the sample from GitHub by clicking on the button below. {{< sourceCode src="https://github.com/rahulrai-in/Tedious-PhoneBook">}}

## Objective

We will build a very simple application that fetches names and phone numbers from a table in SQL database and renders the data on page.

{{< img src="1.png" alt="Tedious Phone Book" >}}

I will use the popular [Express](http://expressjs.com/) web application framework and the [Vash](https://github.com/kirbysayshi/vash) template engine to build the sample application. Vash is my preferred template engine because it uses [Razor syntax](https://www.asp.net/web-pages/overview/getting-started/introducing-razor-syntax-c) and resembles ASP.net MVC.

> #### Note
>
> The sample does not illustrate all the best practices you should follow for building Node.js applications. I encourage you to modify the sample and make it production ready. You can submit a pull request and I will attribute you in this post if you do so.
> I will use this sample to demonstrate something awesome in a later post to answer a very popular question that people keep asking me. I encourage you to [subscribe](#subscribe) if you don't want to miss out.

## File.. New Project

For this application, you should have [Node.js tools for Visual Studio](https://www.visualstudio.com/vs/node-js/) installed on your system. This installation will get you project templates and tools for developing Node.js applications. I assume that you are already familiar with components of a Node.js application as I can not explain everything in a single blog post. Here is a [great tutorial from StrongLoop](https://strongloop.com/strongblog/node-js-net-getting-started-part-one/) to get you started.

Create a new project named **PhoneBook** and add the following npm modules to the application:

1. Express: `$ npm install express --save`
2. Vash: `$ npm install express --save`

Navigate to the **server.js** file and initialize `express` and `vash`.

```js
var http = require("http");
var express = require("express");
var app = express();
app.set("view engine", "vash");
```

To create controllers in our aplication, create a folder named **controllers** and add a file named **index.js** to it. This file would serve as point of entry for all the controllers in our application. For this sample we will have a single controller named `homeController` which will be defined in another file. Let's initialize `homeController` using the following code, you can add more controllers later and initialize them in this file.

```js
(function (controllers) {
  var homeController = require("./homeController");
  controllers.init = function (app) {
    homeController.init(app);
  };
})(module.exports);
```

Now, let's set up the `homeController` that we initialized above. Add a new file named **homeController.js** to the **controllers** folder. In the controller, we will define the routes to which the controller will respond and the data that would be passed to views as response. We will later build a data access library that will fetch data from the database to segregate controllers from data access logic. Write the following code in the `homeController`.

```js
(function (homeController) {
  var data = require("../data");
  homeController.init = function (app) {
    app.get("/", function (req, res) {
      data.getDirectory(function (err, results) {
        res.render("index", {
          title: "Tedious Phone Book",
          error: err,
          data: results,
        });
      });
    });
  };
})(module.exports);
```

The above code is fairly straightforward. The `init` function specifies that `homeController` would respond to requests made on the default route. On receiving a request, the controller makes a call to the `getDirectory` function and returns the data returned as response to the **index** view. Let's first create the **index** view and afterwards the data access layer of the application.

To initialize the controllers, add the following code to **server.js** file.

```js
var controllers = require("./controllers");
controllers.init(app);
```

Create a new folder named **views** in the project and add a master view named **layout.vash** to it. Add the following HTML markup to the file.

```html
<html>
  <head>
    <style>
      table {
        font-family: arial, sans-serif;
        border-collapse: collapse;
        width: 100%;
      }

      td,
      th {
        border: 1px solid #dddddd;
        text-align: left;
        padding: 8px;
      }

      tr:nth-child(even) {
        background-color: #dddddd;
      }
    </style>
    <title>@model.title</title>
  </head>
  <body>
    <div>@html.block("body")</div>
  </body>
</html>
```

Next, add the **index** view by adding another file named **index.vash** in the folder. The following markup will create a table populated with all the phone numbers.

```html
@html.extend("layout", function(model){ @html.block("body", function(model){
<h4>
  @model.title
  <hr />
</h4>
@if(model.error){
<h2>Error: @model.error</h2>
} @else{
<table>
  <tr>
    <th>Name</th>
    <th>Contact</th>
  </tr>
  @model.data.forEach(function(person){
  <tr>
    <td>@person.PersonName</td>
    <td>@person.PhoneNumber</td>
  </tr>
  })
</table>

} }) })
```

Let's quickly develop the data access layer to fetch data from Azure SQL database. But before we do so, you need to create a table with the definition outlined below.

{{< img src="2.png" alt="Table 'Directory' in Azure SQL Database" >}}

Add a few records to the table that will get rendered on the screen when we deploy the application.

Create a folder named **data** in the project and add a javascript file named **index.js** to it. Write the following code in the file.

```js
(function (data) {
  var database = require("./database");
  data.getDirectory = function (next) {
    database.getDirectory(next);
  };
})(module.exports);
```

The index file acts as a Repository abstraction of the underlying database. The implementation specific to Azure SQL database is contained within the **database.js** file which we will define next. The `getDirectory` function of **index** simply invokes the associated function contained in **database.js**.

Before we add any code in **database.js**, we need to install the [Tedious npm package](https://www.npmjs.com/package/tedious). Use the following command to add the package to the project.

```shell
npm install tedious --save
```

Next, in the file, add the necessary database connection properties. Note that these values should ideally be populated from a separate configuration file and are presented here as such only for the sake of simplicity.

```js
(function (database) {
  var Connection = require("tedious").Connection;
  var config = {
    userName: "USERNAME",
    password: "PASSWORD",
    server: "DATABASE SERVER NAME.database.windows.net",
    options: {
      database: "phonebook",
      encrypt: true,
      rowCollectionOnDone: true,
    },
  };

  // We'll add more code here.
})(module.exports);
```

Now, let's define the function that queries the database and returns the result as a JSON object to the view. The below function will establish a connection, issue a select query against the database and invoke the callback function with the results of the query.

```js
database.getDirectory = function (next) {
  var connection = new Connection(config);
  connection.on("connect", function (err) {
    if (err) {
      next(err, null);
    } else {
      var Request = require("tedious").Request;
      var request = new Request(
        "select PersonName, PhoneNumber from Directory",
        function (err, rowCount, rows) {
          if (err) {
            next(err, null);
          }
        }
      ).on("doneInProc", function (rowCount, more, rows) {
        var jsonArray = [];
        rows.forEach(function (columns) {
          var rowObject = {};
          columns.forEach(function (column) {
            rowObject[column.metadata.colName] = column.value;
          });

          jsonArray.push(rowObject);
        });

        next(null, jsonArray);
      });

      connection.execSql(request);
    }
  });
};
```

Finally, add the following statements in **server.js** that start the server with listener attached to port 3000.

```js
var server = http.createServer(app);
server.listen(3000);
```

To debug, simply press **F5** and navigate to _http://localhost:3000_ in your browser.

{{< subscribe >}}
