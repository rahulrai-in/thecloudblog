---
title: "Building a GraphQL Application with ASP.Net Core and TypeScript - Part 2"
date: 2019-05-19
tags:
  - web
---

> In this series
>
> 1. [Building a GraphQL server](/post/building-applications-with-graphql-in-aspnet-core-and-typescript-part-1/)
> 2. [Building a GraphQL client](/post/building-applications-with-graphql-in-aspnet-core-and-typescript-part-2/)

In the first part of this series, we discussed steps to develop a GraphQL server using ASP.Net core. Since we have a server up and running now, we will build a client that works with the API we just created.

We will build a minimal client using TypeScript that has no dependency on frameworks or libraries such as Angular and React. Our client will accept a query or mutation from the command line argument and send a request to the GraphQL API. The client will cast the response it receives from the API to a string and print it to the console. For building this client, we will use the popular [Apollo Client](https://www.apollographql.com) library which works with both TypeScript and Javascript.

## Code

The complete code of the application that comprises the client and the server components is available for download from GitHub.

{{< sourceCode src="https://github.com/rahulrai-in/quoTS">}}

The source code includes two folders:

1. **api**: ASP.Net core based GraphQL server.
2. **web**: TypeScript based GraphQL client.

## Executing The Sample

Download the sample application and open the folder containing your applications using VSCode. I have added tasks in **launch.json**, and **tasks.json** files for VSCode (in the **.vscode** folder) which will help you build and debug the relevant application. In your command terminal (**Ctrl + `**) navigate to the **api** folder and execute the following command to start the GraphQL server.

```bash
dotnet build
dotnet run
```

Ensure that the API is accessible at the address: [http://localhost:5000/graphql](http://localhost:5000/graphql). Now, launch another terminal and navigate to the **web** directory. Execute the following command to install the required node packages.

```bash
npm install
```

To build the client project, you can either execute the following command in the terminal or use the shortcut **Ctrl + Shift + B** and select the **build-watch web** task from the drop-down.

```bash
npm run build:watch
```

To execute the included Jasmine tests, execute the following command in the terminal.

```bash
npm run test
```

After all the tests succeed, your project is now ready for a test drive. The application supports commands in the following format.

```bash
node index.js query\mutation [-m] [-a [argument dictionary]]
```

The command has three parts, the query or mutation operation string, a flag parameter (`-m`) that allows you to specify whether the string entered as argument is a query or a mutation (you can easily determine this by reading the first word of the operation string as well), and a dictionary of arguments specified through the parameter `-a`.

To save you effort and also to provide you with some examples, I have added two simple npm scripts to the application that will help you test the client. Execute the following command to execute a mutation operation on the API.

```bash
npm run run:testQuery
```

This command will execute the following query on the GraphQL API and print the response in the form of a string to the console.

```json
query AuthorQuery($id:ID) {
    author(id:$id) {
        name
        quotes {
            text
            category}}}
```

The command also sends the following argument dictionary to the query to substitute the `$id` parameter.

```json
{ "id": 1 }
```

The output of this command will list all the quotes from the author with Id value 1. Executing the following command will add a quote to the author with Id value 2.

```bash
npm run run:testMutation
```

This operation will execute the following mutation operation on the GraphQL API.

```json
mutation QuoteMutation($authorId: Int!, $text: String!, $category: String!) {
    createQuote(quote: {authorId: $authorId, text: $text, category: $category}) {
        name
        quotes {
            text
            category}}}
```

The operation also passes the following argument dictionary to the mutation operation.

```json
{"authorId":2,\"text":"FamousQuote1","category":"fun"}
```

The output of the previous command will list the name and quotes from the author whose record we just changed.

## Output

To compare the results, following is a screenshot of the result of the mutation operation.

{{< img src="1.png" alt="Mutation Output" >}}

Next, following is the output of the query operation.

{{< img src="2.png" alt="Query Operation" >}}

Let’s now dig deeper into the code I wrote for building this application.

## Following The Debugger

The application begins execution from the **index.ts\js** file which contains the following code.

```
import * as OperationParser from './operationParser';
import { gqlOperations } from './options';

var opts = OperationParser.fromArgv(process.argv.slice(2));
console.log('Input:', opts.input);
console.log('Is Mutation:', opts.mutation);
console.log('Args:', opts.arguments);
var executeOperation = async () =>
  opts.mutation
    ? await gqlOperations['mutation'].operation(opts.input, opts.arguments)
    : await gqlOperations['query'].operation(opts.input, opts.arguments);
executeOperation().then(result => console.log('OUTPUT:', result));
```

The code in the listing consumes the arguments you passed to the command and sends them to the `formArgv` function defined in **optionsParser** file.
The function returns an instance of the `Options` class in response, which exposes properties we have used to surface the arguments and also invoke the proper operation using the input.

Navigate to the **optionsParser.ts** file now. The `fromArgv` function uses a helper function `minimistAs` to split the input into operation string, the operation flag, and argument parameter value.

```
import * as minimist from 'minimist';

import { Options, Arguments } from './options';

function minimistAs<T>(
  args?: string[],
  opts?: minimist.Opts
): T & minimist.ParsedArgs {
  return <T & minimist.ParsedArgs>minimist(args, opts);
}

export function fromArgv(argv: string[]): Options {
  var parsedArgs = minimistAs<Arguments>(argv, {
    alias: { mutation: 'm', arguments: 'a' }
  });

  return new Options(parsedArgs._.join(' '), parsedArgs);
}
```

The `minimistAs` function uses a simple command line parser package [minimist](https://github.com/substack/minimist) to parse the arguments and uses the [type intersection feature of Typescript](https://www.typescriptlang.org/docs/handbook/advanced-types.html) to generate a type that consists of properties in the `Arguments` type and `ParsedArgs` type. We have used this further to create an instance of the `Options` class.

Let's now move on to explore the `Options` class in the **options.ts** file.

```
import { Mutation } from './mutation';
import { Query } from './query';

function exitIfUndefined(value: any, message: string) {
  if (typeof value === 'undefined' || value.trim() === '') {
    console.error(message);
    throw new Error(`${value} is not valid input.`);
  }
}

export const gqlOperations = {
  ['mutation']: Mutation,
  ['query']: Query
};

export interface Arguments {
  readonly mutation: boolean;
  readonly arguments: string;
}

export class Options implements Arguments {
  readonly mutation: boolean;
  readonly arguments: string;

  constructor(public readonly input: string, args: Arguments) {
    exitIfUndefined(input, 'Please pass an input string.');

    this.mutation = args.mutation === undefined ? false : args.mutation;
    this.arguments = args.arguments;
  }
}
```

Most of the code in this file is straightforward and requires no explanation. The dictionary `gqlOperations` contains a reference to the `Mutation` and `Query` variables that use the Apollo client library to send requests to the GraphQL API. The code in `index.ts` file invokes the `operation` function in one of these variables by retrieving their reference from the `gqlOperations` dictionary by name.

Let's now review the `Query` function present in the **query.ts** file.

```
import { IOperation } from './IOperation';
import { default as ApolloClient, ApolloQueryResult } from 'apollo-boost';
import { default as gql } from 'graphql-tag';
import { Config } from './config';
import 'cross-fetch/polyfill';

export var Query: IOperation = {
  async operation(input: string, argument: string): Promise<string> {
    let query = async (): Promise<ApolloQueryResult<any>> => {
      let client = new ApolloClient({ uri: Config.graphQl });
      return await client.query({
        query: gql(input),
        variables: JSON.parse(argument)
      });
    };

    let result = await query();
    return JSON.stringify(result.data);
  }
};
```

Both the `Query` and the `Mutation` variables implement the `IOperation` interface and use the Apollo client class available in the [apollo-client package](https://github.com/apollographql/apollo-client) to send requests to the GraphQL API. The `query` method of the `ApolloClient` class also supports sending arguments of the query in the request. We used this feature of the `query` method to send the arguments of the query to the API.

Understanding the code of the `Mutation` in the **mutation.ts** file will be easy for you as it closely resembles the implementation you went through in the **query.ts** file.

```
import { IOperation } from './IOperation';
import { default as ApolloClient, FetchResult } from 'apollo-boost';
import { default as gql } from 'graphql-tag';
import { Config } from './config';
import 'cross-fetch/polyfill';

export var Mutation: IOperation = {
  async operation(input: string, argument: string): Promise<string> {
    let query = async (): Promise<FetchResult<any>> => {
      let client = new ApolloClient({ uri: Config.graphQl });
      return await client.mutate({
        mutation: gql(input),
        variables: JSON.parse(argument)
      });
    };

    let result = await query();
    return JSON.stringify(result.data);
  }
};
```

I want to bring a few other salient features of this solution to your attention. As you must have observed, the `operation` function of the `IOperation` interface is asynchronous. This promise is resolved in the `index.ts` file. The configurations file **config.js** contains the link to the GraphQL API. If your API is running on some other port, then you can alter the link to the API in this file. I have written tests for some components of this application using [Jasmine](https://jasmine.github.io/), which is the most popular BDD test framework for Javascript. To support symbol mapping so that VSCode debugger can work with tests, I have used the [source-map-support](https://github.com/evanw/node-source-map-support) package. I reference this package and invoke the `install` function at the beginning of every test file. For larger applications, you can concatenate this code to all test files on build. To output the test results in a visually appealing format, I have used the [jasmine-console-reporter](https://github.com/onury/jasmine-console-reporter) package.

## Type Definitions

An issue we have not yet discussed is strong typing. In real-world applications, you would need type definitions (\*.d.ts files) for TypeScript to help you develop strongly typed mutations and queries. Since GraphQL server publishes the schema of queries and mutations available to clients, tools such as [apollo-codegen](https://github.com/apollographql/apollo-codegen) can help generate TypeScript definitions automatically.

I hope that I could provide you enough information to get interested in GraphQL and kindle your desire to learn GraphQL. Happy coding.

{{< subscribe >}}
