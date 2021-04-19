---
title: "Building a GraphQL Application with ASP.Net Core and TypeScript - Part 1"
date: 2019-05-04
tags:
  - web
comment_id: d368ae4a-7a0f-4544-bcb8-cf9bee49ac17
slug: building-a-graphql-application-with-asp.net-core-and-typescript-part-1
---

> In this series
>
> 1. [Building a GraphQL server](/post/building-a-graphql-application-with-asp.net-core-and-typescript-part-1/)
> 2. [Building a GraphQL client](/post/building-a-graphql-application-with-asp.net-core-and-typescript-part-2/)

[GraphQL (QL: Query Language)](https://graphql.org/) is a query language for your APIs. For a long time API clients have been dictated the format of data that they can receive from the backend API. For example, if a client sends a GET request to this endpoint: https://api.twitter.com/1.1/statuses/home_timeline.json (see [developer guide](https://developer.twitter.com/en/docs/tweets/timelines/api-reference/get-statuses-home_timeline.html)), it will get all the data in the format dictated by the API which the client will then have to filter to get just the desired field/s, e.g., Tweet text. The REST API approach has many disadvantages which we will discuss soon. However, now let's take a quick view of a typical GraphQL query. Since GraphQL is a query language, let's compare a GraphQL query to a query in a very well known query language - SQL. With GraphQL, you can write queries using object structures rather than string expressions. So the following statement in SQL...

```sql
SELECT name, id FROM employees WHERE id = 1
```

...can be translated to the following in GraphQL.

```graphql
{
  employees(id: 1) {
    id
    name
  }
}
```

In standard applications, the client either makes several requests to an API to get relevant data or relies on a BFF (Backend For Frontend) application for the same. Even with BFF, the client needs to know the various endpoints of the BFF that it can use to get relevant data. With GraphQL, a client needs to send any request to a single `/graphql` endpoint with a query (or data manipulation operation called mutation) as input. The server responds to the query in the format requested by the client.

The following diagram illustrates the architecture of a typical GraphQL based system. The client only needs to send requests to a single endpoint, and the various handlers or resolvers on the server handle the request.

{{< img src="1.png" alt="GraphQL Architecture" >}}

## Advantages

Using GraphQL, the complexity of the client reduces drastically as it no longer needs to understand the various HTTP verbs, endpoints, and request paths. Since the server can respond to client queries only in a specific format, the client no longer needs to understand the various API response codes as well.

Another problem that GraphQL solves is overfetching of data. Using GraphQL, only the data that the client is interested in is returned as the response to a request. On the other hand, GraphQL also solves the problem of underfetching of data which is also known as the N+1 problem. For example, with REST services, the client may need to make multiple requests to get relevant data such as that for a product and then for product details.

Since the client and server are simple, applications can be developed iteratively, and changes on clients do not require changes to the server in most of the cases. The server-side code can be independently monitored, and the units of data that are never used by the clients can be deprecated without affecting the clients.

GraphQL also supports data updates through operations called `mutations`. Later in this article, we will see how we don't have to write any code for different versions of queries and different versions of mutations and that the whole process is quite straightforward.

## Scenario

To demonstrate the capabilities of GraphQL, we will build a simple application that lists and adds quotes from famous personalities. The frontend of the application is built using TypeScript which uses GraphQL queries and mutations to interact with the backend GraphQL API built with .Net core.

In the first installment of this series, we will focus on building the backend GraphQL API, and in the next article, we will work on the TypeScript based client.

## Code

The complete code of the application that comprises the client and the server components is available for download from GitHub.

{{< sourceCode src="https://github.com/rahulrai-in/quoTS">}}

The source code includes two folders:

1. **api**: ASP.Net core based GraphQL server.
2. **web**: TypeScript based GraphQL client.

## GraphQL Server

We will use .Net Core WebAPI template to build our GraphQL API. We are going to follow the following steps to create our API. We will cover the details of queries and mutations after we have provisioned our API.

1. Install GraphQL packages in your application.
2. Create and add seed data to application database.
3. Create Queries, Mutations, and resolvers supported by the API.
4. Create GraphQL route accessible to the client at the `/graphql` endpoint.

## Install GraphQL Packages

In your IDE, create an empty .Net core WebAPI project. In this project, we will add a new middleware to support GraphiQL. GraphiQL (pronounced "graphical") adds support for an in-browser IDE for GraphQL. Imagine GraphiQL as Swagger UI for your API.

To add support for GraphQL in your application, execute the following command to install the `GraphQL` package.

```shell
dotnet add package GraphQL
```

Execute the following command to install the `graphiql` package in your application.

```shell
dotnet add package graphiql
```

Add the following statement to the `Configure` method in the `Startup` class. This will add the GraphiQL middleware to the application and make the GraphiQL UI available on the `/graphql` endpoint.

```c#
app.UseGraphiQl("/graphql");
```

After configuring these packages, we are now ready to prepare the database the client will operate on.

## Prepare The Database

Using Entity Framework Core is the simplest way to create queryable entities for GraphQL. Let's start with building models for our application. Create a folder named **Models** and add a class named `Author` to it.

```c#
public class Author
{
  public int Id { get; set; }
  public string Name { get; set; }
  public List<Quote> Quotes { get; set; }
}
```

Now, add another class named `Quotes` to the folder.

```c#
public class Quote
{
  public string Id { get; set; }
  public string Text { get; set; }
  public string Category { get; set; }
  public int AuthorId { get; set; }
  public Author Author { get; set; }
}
```

After adding the models, we will create a `DbContext` class to provision a bridge between your entities and the database. Add a class named `ApplicationDbContext` to your project and add the following code to the class.

```c#
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Quote> Quotes { get; set; }
    public DbSet<Author> Authors { get; set; }
}
```

Let's now hook the `DbContext` to the application. For this sample, I am going to use the in-memory database. However, you can configure any database supported by EF Core here. Add the following code to the `ConfigureServices` method of the `Startup` class.

```c#
services.AddDbContext<ApplicationDbContext>(context =>
{
    context.UseInMemoryDatabase("QuoTSDb");
});
```

Let's add some seed data to the database so that some data is available for the client to work with when the application starts. Add the following code to the `Main` method of the `Program` class to add some records to the database.

```c#
public static void Main(string[] args)
{
    IWebHost host = CreateWebHostBuilder(args).Build();
    using(IServiceScope scope = host.Services.CreateScope())
    {
        ApplicationDbContext context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var ablDbEntry = context.Authors.Add(new Author { Name = "Abraham Lincoln" });
        var aristotleDbEntry = context.Authors.Add(new Author { Name = "Aristotle" });

        context.Quotes.AddRange(
            new Quote
            {
                AuthorId = ablDbEntry.Entity.Id,
                    Category = "inspiration",
                    Text = "Whatever you are, be a good one."
            },
            new Quote
            {
                AuthorId = ablDbEntry.Entity.Id,
                    Category = "books",
                    Text = "My Best Friend is a person who will give me a book I have not read."
            },
            new Quote
            {
                AuthorId = aristotleDbEntry.Entity.Id,
                    Category = "inspiration",
                    Text = "You will never do anything in this world without courage. It is the greatest quality of the mind next to honor."
            }
        );

        context.SaveChanges();
    }
    host.Run();
}
```

At this point we are ready with two queryable entities and a fully functional database. However, we can't yet use the `Author` and `Quote` class in our GraphQL queries as they need to be specified in a format that is understood by GraphQL. Therefore, we will do the transformation of entities in the next step.

## Create GraphQL Query Types and Queries

A GraphQL service requires defining types and fields on those types. Further, you provision functions for each field on each type. In GraphQL, the schema is set on the server, and the client uses the schema to query or mutate (create, update, and delete) the data over a single endpoint. The schema of data is defined in a particular format using a specification known as **Schema Definition Language**. The following is an example of how the author schema in our sample will be defined.

```graphql
{
  author: Author
  authors: GraphQL List (Author)
}
```

In the schema listed previously, `Author` itself is a **Type** with three fields: `Id`, `Name`, and `Quotes`. It will be represented as the following.

```graphql
{
  Author = {
    id: GraphQL Int
    name: GraphQL String
    quotes: GraphQL List (Quote)
  }
}
```

Further, `Quote` itself is another type. A GraphQL client only understands schema and types, and therefore, we would need to convert the `Author` and `Quote` classes to types. In the project, create a folder named **GraphQL** and add a class named `AuthorType` to it. All types should inherit from `ObjectGraphType<T>` class. Add the following code to the class to map the properties of the Author class to GraphQL types such as string, integer, etc.

```c#
public class AuthorType : ObjectGraphType<Author>
{
    public AuthorType()
    {
        Name = nameof(Author);

        Field(x => x.Id, type : typeof(IdGraphType)).Description("Author Id.");
        Field(x => x.Name).Description("The name of the author.");
        Field(x => x.Quotes, type : typeof(ListGraphType<QuoteType>)).Description("Author's quotes.");
    }
}
```

Similarly, add another class named `QuoteType` to the folder and update the code of this class with the code in the following listing.

```c#
public class QuoteType : ObjectGraphType<Quote>
{
    public QuoteType()
    {
        Name = nameof(Quote);
        Field(x => x.Id, type : typeof(IdGraphType)).Description("The Id of the quote.");
        Field(x => x.Text).Description("The quote.");
        Field(x => x.Category).Description("Quote category");
    }
}
```

After defining the schema, we can now define queries that the client can execute using the schema. The server presents the schema of queries and mutations to the client which it can send to the server. We will define a query to get an author object when the client sends the id of the author as a query argument. In GraphQL the query will look like the following. Note that we are requesting only the quotes from the author to be sent in the response.

```graphql
{
  author(id: 1) {
    quotes {
      text
    }
  }
}
```

The response for this query will look like the following.

```graphql
{
  "data": {
    "author": {
      "quotes": [
        {
          "text": "Whatever you are, be a good one."
        },
        {
          "text": "My Best Friend is a person who will give me a book I have not read."
        }
      ]
    }
  }
}
```

Add another class file named `AuthorQuery` in the GraphQL folder. We will define two queries in this class:

1. **Author**: Fetches the author object whose id is passed in the query argument.
2. **Authors**: Fetches all authors.

Before we write any code in this class, I would like to talk about the concept of _Resolvers_. The responsibility of a resolver function is to retrieve data from the data resource such as an API or a database and compose the type object that is returned as the response. Add the following code to the class to provision the queries and their resolvers.

```c#
public class AuthorQuery : ObjectGraphType
{
    public AuthorQuery(ApplicationDbContext db)
    {
        Field<AuthorType>(
            nameof(Author),
            arguments : new QueryArguments(new QueryArgument<IdGraphType> { Name = "id", Description = "The Id of the Author." }),
            resolve : context =>
            {
                var id = context.GetArgument<int>("id");
                var author = db
                    .Authors
                    .Include(a => a.Quotes)
                    .FirstOrDefault(i => i.Id == id);
                return author;
            });

        Field<ListGraphType<AuthorType>>(
            $"{nameof(Author)}s",
            resolve : context =>
            {
                var authors = db.Authors.Include(a => a.Quotes);
                return authors;
            });
    }
}
```

## Mutations

While we are into the process of writing queries, let's add a mutation operation to add a quote to an author profile. Mutations are GraphQL objects similar to queries, but by using mutations, you can update, delete and create records. The following is an example of a mutation operation named `createQuote` that accepts parameters for creating a new quote. Mutation operations also allow you to query the updated object as part of the same operation. In the following example, you can see that we can request various fields of the resultant `Author` object to be returned in response to a mutation operation.

```graphql
mutation {
  createQuote(
    quote: {
      authorId: 2
      text: "Pleasure in the job puts perfection in the work."
      category: "job"
    }
  ) {
    name
    quotes {
      text
      category
    }
  }
}
```

We will now define a class named `QuoteInput` that encapsulates the parameters that we need for creating a new quote. Add a new class file named `QuoteInput` in the **GraphQL** folder and add three properties in the class as shown in the following code snippet.

```c#
public class QuoteInput
{
    public int AuthorId { get; set; }
    public string Category { get; set; }
    public string Text { get; set; }
}
```

GraphQL does not understand bare .Net classes so just as before, we will convert `QuoteInput` to a GraphQL type. An input should extend class `InputObjectGraphType` that manages the representation of the type in the format understood by GraphQL. Add a new class named `QuoteInputType` to the folder and paste the following code in the file.

```c#
public class QuoteInputType : InputObjectGraphType<QuoteInput>
{
  public QuoteInputType()
  {
    Name = $"{nameof(QuoteInput)}";
    Field(x => x.AuthorId).Description("Author id.");
    Field(x => x.Text).Description("Quote text.");
    Field(x => x.Category).Description("Quote category.");
  }
}
```

Finally, we will define a mutation operation that adds a record to the database from the input that it receives from the mutation function parameter.

```c#
public class QuoteMutation : ObjectGraphType
{
    public QuoteMutation(ApplicationDbContext db)
    {
        Field<AuthorType>(
            $"create{nameof(Quote)}",
            arguments : new QueryArguments(new QueryArgument<NonNullGraphType<QuoteInputType>> { Name = "quote", Description = "Quote to add to author profile." }),
            resolve : context =>
            {
                var quote = context.GetArgument<QuoteInput>("quote");
                var author = db
                    .Authors
                    .Include(a => a.Quotes)
                    .FirstOrDefault(i => i.Id == quote.AuthorId);
                author.Quotes.Add(new Quote { Category = quote.Category, Text = quote.Text });
                db.SaveChanges();
                return author;
            });
    }
}
```

In the `QuoteMutation` class we defined a mutation operation named `createQuote` which accepts a parameter named `quote` of type `QuoteInputType`. The resolver function extracts the properties from the `quote` parameter and uses the data to add a new quote to the author profile.

## Exposing the Endpoint

Whether for query or for mutation, the client will always send a **POST** request to the GraphQL endpoint (/graphql) which will contain the name of the query, name of the operation, and the parameters. We will create a class that will serve as a model for all queries and mutations. Create a class named `GraphQLQuery` and update the code in the class to the following code listing.

```c#
public class GraphQLQuery
{
    public string OperationName { get; set; }
    public string Query { get; set; }
    public JObject Variables { get; set; }
}
```

Finally, we will create a POST endpoint to which the client can send requests. Create a new controller named `GraphQLController` in your API and paste the following code in the class.

```c#
[Route("graphql")]
[ApiController]
public class GraphQLController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public GraphQLController(ApplicationDbContext db) => _db = db;

    public async Task<IActionResult> Post([FromBody] GraphQLQuery query)
    {
        // Convert parameters to Dictionary<string,object>
        var inputs = query.Variables.ToInputs();

        // This is the schema for our GraphQL service. You can visualize it in the GraphiQL interface.
        var schema = new Schema
        {
            Query = new AuthorQuery(_db),
            Mutation = new QuoteMutation(_db)
        };

        // This function will either execute query or mutation based on request.
        var result = await new DocumentExecuter().ExecuteAsync(_ =>
        {
            _.Schema = schema;
            _.Query = query.Query;
            _.OperationName = query.OperationName;
            _.Inputs = inputs;
        });

        if (result.Errors?.Count > 0)
        {
            return BadRequest();
        }

        return Ok(result);
    }
}
```

In the previous listing, we defined a schema that would be translated to schema definition using the standards of the Schema Definition Language. Note that queries and mutations have a single root. This means that all the queries will be managed by the `AuthorQuery` class and all the mutations will be managed by the `QuoteMutation` class.

## Test The Application

Launch the application now and navigate to the URL: [https://localhost:5001/graphql/](https://localhost:5001/graphql/). The GraphiQL interface is divided into three parts. The leftmost section is an intelligent editor window with support for autocomplete and formatting. You can write queries, mutations, and variables used by them in the first section. The middle section presents the results of the operation. The section on the right displays the documentation of the API based on the Schema Definition.

Let's execute a query in GraphiQL interface to list the authors and their quotes. Write the following query in the interface and execute it.

```graphql
{
  authors {
    id
    name
    quotes {
      text
      category
    }
  }
}
```

The following is a screenshot of the output of the query.

{{< img src="2.png" alt="GraphQL Query" >}}

Let's now execute a mutation to add a quote to the author record and also list all the quotes of the author in the same operation.

```graphql
mutation {
  createQuote(
    quote: {
      authorId: 2
      text: "Pleasure in the job puts perfection in the work."
      category: "job"
    }
  ) {
    name
    quotes {
      text
      category
    }
  }
}
```

The following is the output of the mutation operation. Note that the newly added quote is also returned in the response.

{{< img src="3.png" alt="GraphQL Mutation" >}}

There is another query that we created in our application which lists author details based on the id of the author. I will leave it to you to execute it and check out the result.

## Conclusion

I hope you enjoyed working through the sample and also learned the basics of GraphQL. In the next part, we will add a TypeScript based front end to the API to execute queries on the GraphQL API. As always, I'd love to hear from you. Hit me up with questions or feedback in the comments section.

{{< subscribe >}}
