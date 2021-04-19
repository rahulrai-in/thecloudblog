---
title: Build a Basic GraphQL Server with ASP.NET Core and Entity Framework in 10 Minutes
date: 2021-03-15
tags:
  - programming
  - web
comment_id: eb503f00-8fcf-43a5-9066-5e90db82f715
---

Since I wrote my [first GraphQL post in 2019]({{< ref "/post/Building Applications with GraphQL in ASPNet Core and TypeScript Part 1" >}} "GQL"), much has changed with [GraphQL](https://graphql.org/) in the .NET space. The ongoing changes have also affected most of the documentation available online. This article will walk you through the steps to create a basic GraphQL API on ASP.NET Core using [GraphQL for .NET](https://github.com/graphql-dotnet/graphql-dotnet), [Entity Framework Core](https://docs.microsoft.com/en-us/ef/core/), [Autofac](https://autofac.org/), and the [Repository design pattern](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design). I chose the tech stack for the sample application based on the popularity of the frameworks and patterns. You can substitute the frameworks or libraries with equivalent components in your implementation.

If you are not familiar with the concepts of GraphQL, please take some time to read the [learn series of articles](https://graphql.org/learn/) on the GraphQL website. Let's now fire up our preferred editor or IDE to get started.

## Application: Movie Reviews

We will create an API that presents a movie and its reviews. In GraphQL, queries are used to read data, and mutations are used to create, update and delete data. To explore the CRUD operations on data, we will create two GraphQL operations as follows:

1. Query to fetch a movie by its identifier.
2. Mutation to add a review to a movie.

I will not cover GraphQL Subscriptions which are a way to create and maintain a real-time connection with the GraphQL server. This feature enables the server to push instant information about related events to the client. You can read more about [Subscriptions on the Apollo docs website](https://www.apollographql.com/docs/apollo-server/data/subscriptions/).

## Source Code

For reference, the source code of the application is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/movie-reviews" >}}

## Set Up ASP.NET Core API Project

Create an ASP.NET Core Web Application (.NET Core) project named **MovieReviews** using Visual Studio or the following command:

```shell
dotnet new webapi -n MovieReviews
```

Let’s add the required NuGet packages to add support for GraphQL, Entity Framework Core, and Autofac in our project. For simplicity, I will use an in-memory database for persisting the movie data. You can use any database supported by Entity Framework for this purpose.

```shell
dotnet add package GraphQL
dotnet add package GraphQL.SystemTextJson
dotnet add package GraphQL.Server.Transports.AspNetCore
dotnet add package GraphQL.Server.Ui.Altair

dotnet add package Autofac

dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Microsoft.EntityFrameworkCore.InMemory
```

We will now update the `CreateHostBuilder` in the class `Program` to use Autofac as the service provider responsible for [dependency injection (DI)](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection).

```c#
public static IHostBuilder CreateHostBuilder(string[] args)
{
    return Host.CreateDefaultBuilder(args)
        .UseServiceProviderFactory(new AutofacServiceProviderFactory())
        .ConfigureWebHostDefaults(webBuilder => { webBuilder.UseStartup<Startup>(); });
}
```

## Create API Models

We will now define the Movie and Review models/entities for our project. Create a folder named **Models** and create a class file named `Review` in it as follows:

```c#
public class Review
{
    public int Id { get; set; }
    public Guid MovieId { get; set; }
    public string Reviewer { get; set; }
    public int Stars { get; set; }
}
```

Similarly, create a class file named `Movie` as follows:

```c#
public class Movie
{
    public IList<Review> Reviews { get; set; }
    public Guid Id { get; set; }
    public string Name { get; set; }

    public void AddReview(Review review)
    {
        Reviews.Add(review);
    }
}
```

We will configure Entity Framework to operate with these entities next.

## Database Setup

We will now set up the connection with the database. As I previously said, we will use the InMemory database with Entity Framework Core.

Create a folder named **Database** in the project, and create a class file named `MovieContext` in the folder. Define the code in `MovieContext` as follows:

```c#
public class MovieContext : DbContext
{
    public MovieContext(DbContextOptions<MovieContext> options) : base(options)
    {
    }

    public DbSet<Movie> Movie { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Movie>().OwnsMany(m => m.Reviews).HasData(
            new Review
            {
                Id = 1,
                Reviewer = "A",
                Stars = 4,
                MovieId = new Guid("72d95bfd-1dac-4bc2-adc1-f28fd43777fd")
            },
            new Review
            {
                Id = 2,
                Reviewer = "B",
                Stars = 5,
                MovieId = new Guid("72d95bfd-1dac-4bc2-adc1-f28fd43777fd")
            },
            new Review
            {
                Id = 3,
                Reviewer = "A",
                Stars = 4,
                MovieId = new Guid("c32cc263-a7af-4fbd-99a0-aceb57c91f6b")
            },
            new Review
            {
                Id = 4,
                Reviewer = "D",
                Stars = 5,
                MovieId = new Guid("c32cc263-a7af-4fbd-99a0-aceb57c91f6b")
            },
            new Review
            {
                Id = 5,
                Reviewer = "E",
                Stars = 3,
                MovieId = new Guid("c32cc263-a7af-4fbd-99a0-aceb57c91f6b")
            },
            new Review
            {
                Id = 6,
                Reviewer = "F",
                Stars = 5,
                MovieId = new Guid("c32cc263-a7af-4fbd-99a0-aceb57c91f6b")
            },
            new Review
            {
                Id = 7,
                Reviewer = "A",
                Stars = 2,
                MovieId = new Guid("7b6bf2e3-5d91-4e75-b62f-7357079acc51")
            },
            new Review
            {
                Id = 8,
                Reviewer = "B",
                Stars = 1,
                MovieId = new Guid("7b6bf2e3-5d91-4e75-b62f-7357079acc51")
            },
            new Review
            {
                Id = 9,
                Reviewer = "G",
                Stars = 3,
                MovieId = new Guid("7b6bf2e3-5d91-4e75-b62f-7357079acc51")
            },
            new Review
            {
                Id = 10,
                Reviewer = "H",
                Stars = 4,
                MovieId = new Guid("7b6bf2e3-5d91-4e75-b62f-7357079acc51")
            }
        );
        modelBuilder.Entity<Movie>().HasData(
            new Movie
            {
                Id = new Guid("72d95bfd-1dac-4bc2-adc1-f28fd43777fd"),
                Name = "Superman and Lois"
            },
            new Movie
            {
                Id = new Guid("c32cc263-a7af-4fbd-99a0-aceb57c91f6b"),
                Name = "Game of Thrones"
            },
            new Movie
            {
                Id = new Guid("7b6bf2e3-5d91-4e75-b62f-7357079acc51"),
                Name = "Avengers: Endgame"
            }
        );
    }
}
```

Note that we added a few movies and ratings as seed data in the database. We will now register our `DbContext` with the application. Navigate to the `Startup` class and add the following code to the `ConfigureServices` method:

```c#
public void ConfigureServices(IServiceCollection services)
{
    services
        .AddEntityFrameworkInMemoryDatabase()
        .AddDbContext<MovieContext>(context => { context.UseInMemoryDatabase("MovieDb"); });
}
```

The previous code fragment instructs Entity Framework to create an in-memory database named **MovieDb**. In-memory databases are great for tests, and an in-memory database will be sufficient to service our demo application.

Let’s implement the repository pattern that uses the database context to fetch a movie and add a movie review. Create an interface named `IMovieRepository` in the **Database** folder as follows.

```c#
public interface IMovieRepository
{
    Task<Movie> GetMovieByIdAsync(Guid id);
    Task<Movie> AddReviewToMovieAsync(Guid id, Review review);
}
```

Let's implement this interface in a class named `MovieRepository` as follows:

```c#
public class MovieRepository : IMovieRepository
{
    private readonly MovieContext _context;

    public MovieRepository(MovieContext context)
    {
        _context = context;
        _context.Database.EnsureCreated();
    }

    public Task<Movie> GetMovieByIdAsync(Guid id)
    {
        return _context.Movie.Where(m => m.Id == id).AsNoTracking().FirstOrDefaultAsync();
    }

    public async Task<Movie> AddReviewToMovieAsync(Guid id, Review review)
    {
        var movie = await _context.Movie.Where(m => m.Id == id).FirstOrDefaultAsync();
        movie.AddReview(review);
        await _context.SaveChangesAsync();
        return movie;
    }
}
```

We will set up dependency injection using Autofac at the end, which will make the constructor injection code functional. Let’s now start adding GraphQL support to our API, beginning with the GraphQL middleware.

## GraphQL Middleware

We have already added the relevant GraphQL NuGet packages to our application. One of the packages that we installed is `GraphQL.Server.Ui.Altair` which provides a [GraphQL UI client](https://altair.sirmuel.design/) that helps you debug GraphQL queries and mutations. We will add the Altair UI to our application by adding the `app.UseGraphQLAltair()` middleware in the `Configure` method of the `Startup` class as follows:

```c#
// Enables Altair UI at path /
app.UseGraphQLAltair(new GraphQLAltairOptions {Path = "/"});
```

The middleware will make the Altair UI available at the default (/) endpoint.

Let's configure the required GraphQL services in our application. Add the following code to the `ConfigureServices` method in the `Startup` class:

```c#
services
    .AddGraphQL(
        (options, provider) =>
        {
            // Load GraphQL Server configurations
            var graphQLOptions = Configuration
                .GetSection("GraphQL")
                .Get<GraphQLOptions>();
            options.ComplexityConfiguration = graphQLOptions.ComplexityConfiguration;
            options.EnableMetrics = graphQLOptions.EnableMetrics;
            // Log errors
            var logger = provider.GetRequiredService<ILogger<Startup>>();
            options.UnhandledExceptionDelegate = ctx =>
                logger.LogError("{Error} occurred", ctx.OriginalException.Message);
        })
    // Adds all graph types in the current assembly with a singleton lifetime.
    .AddGraphTypes()
    // Add GraphQL data loader to reduce the number of calls to our repository. https://graphql-dotnet.github.io/docs/guides/dataloader/
    .AddDataLoader()
    .AddSystemTextJson();
```

GraphQL.NET SDK uses the [builder pattern](https://www.dofactory.com/net/builder-design-pattern) to configure the required GraphQL services. The `AddGraphQL` method configures certain global settings, such as the maximum depth of a query. We also configured the logger to capture and log any unhandled GraphQL exceptions.

The `AddGraphTypes` method scans the application's assembly to detect the types (schema, queries, and mutations) and registers them in the DI container with a singleton lifetime.

The `AddDataLoader` method optimizes the calls to our repository so that data is served with as few database requests as possible. You can read more about this feature on the [GraphQL.NET documentation](https://graphql-dotnet.github.io/docs/guides/dataloader/).

GraphQL.NET supports JSON serialization of requests and responses through both System.Text.JSON and Newtonsoft.JSON. The `AddSystemTextJson` method instructs it to use System.Text.JSON to serialize requests and responses.

## GraphQL Query

We defined the `Movie` and `Review` classes against which we want to execute a query and a mutation. However, we can't directly use a query or a mutation on these classes. To make these classes queryable, we need to create a new type and inherit it from `ObjectGraphType<T>` where `<T>` is the type of the object that the graph represents: `Movie` or `Review`.

Create a folder named **GraphQL** and create another folder named **Types** in it. Add the `MovieObject` class files to the folder.

```c#
public sealed class MovieObject : ObjectGraphType<Movie>
{
    public MovieObject()
    {
        Name = nameof(Movie);
        Description = "A movie in the collection";

        Field(m => m.Id).Description("Identifier of the movie");
        Field(m => m.Name).Description("Name of the movie");
        Field(
            name: "Reviews",
            description: "Reviews of the movie",
            type: typeof(ListGraphType<ReviewObject>),
            resolve: m => m.Source.Reviews);
    }
}
```

Next, add the `ReviewObject` class file to the folder as follows:

```c#
public sealed class ReviewObject : ObjectGraphType<Review>
{
    public ReviewObject()
    {
        Name = nameof(Review);
        Description = "A review of the movie";

        Field(r => r.Reviewer).Description("Name of the reviewer");
        Field(r => r.Stars).Description("Star rating out of five");
    }
}
```

Next, we will create the GraphQL schema. A schema defines the server’s API, informing the clients about the operations (query, mutation, and subscription) that the server can perform. To define our schema, create a class file named `MovieReviewSchema` in the **GraphQL** folder and populate it with the following code:

```c#
public class MovieReviewSchema : Schema
{
    public MovieReviewSchema(QueryObject query, MutationObject mutation, IServiceProvider sp) : base(sp)
    {
        Query = query;
        Mutation = mutation;
    }
}
```

We will define the mutation operation later. Let's begin with defining the query which is encapsulated in the `QueryObject` class. Create a class file named `QueryObject` in the **GraphQL** folder as follows:

```c#
public class QueryObject : ObjectGraphType<object>
{
    public QueryObject(IMovieRepository repository)
    {
        Name = "Queries";
        Description = "The base query for all the entities in our object graph.";

        FieldAsync<MovieObject, Movie>(
            "movie",
            "Gets a movie by its unique identifier.",
            new QueryArguments(
                new QueryArgument<NonNullGraphType<IdGraphType>>
                {
                    Name = "id",
                    Description = "The unique GUID of the movie."
                }),
            context => repository.GetMovieByIdAsync(context.GetArgument("id", Guid.Empty)));
    }
}
```

We defined a query named `movie` that takes a GUID identifier as input, and the query resolver uses the repository's `GetMovieByIdAsync` method to fetch the movie object.

## GraphQL Mutation

To define a mutation operation that adds a movie review, add another graph type named `ReviewInputObject` in the **Types** folder with the following code:

```c#
public sealed class ReviewInputObject : InputObjectGraphType<Review>
{
    public ReviewInputObject()
    {
        Name = "ReviewInput";
        Description = "A review of the movie";

        Field(r => r.Reviewer).Description("Name of the reviewer");
        Field(r => r.Stars).Description("Star rating out of five");
    }
}
```

Next, let's define the mutation operation, which is encapsulated in the `MutationObject` graph type. Create a class file named `MutationObject` in the **GraphQL** folder as follows:

```c#
public class MutationObject : ObjectGraphType<object>
{
    public MutationObject(IMovieRepository repository)
    {
        Name = "Mutations";
        Description = "The base mutation for all the entities in our object graph.";

        FieldAsync<MovieObject, Movie>(
            "addReview",
            "Add review to a movie.",
            new QueryArguments(
                new QueryArgument<NonNullGraphType<IdGraphType>>
                {
                    Name = "id",
                    Description = "The unique GUID of the movie."
                },
                new QueryArgument<NonNullGraphType<ReviewInputObject>>
                {
                    Name = "review",
                    Description = "Review for the movie."
                }),
            context =>
            {
                var id = context.GetArgument<Guid>("id");
                var review = context.GetArgument<Review>("review");
                return repository.AddReviewToMovieAsync(id, review);
            });
    }
}
```

Finally, we will register the schema- `MovieReviewSchema` using the GraphQL middleware. Please navigate to the `Configure` method in the `Startup` class and add the following code snippet to it:

```c#
app.UseGraphQL<MovieReviewSchema>();
```

You might have noticed that we haven't yet defined any API controller or HTTP handler to process an incoming GraphQL request. Custom handlers are not required because the GraphQL middleware handles the incoming HTTP requests to the GrapQL endpoint. The default path to the GraphQL endpoint is `/graphql`. You can specify an alternate path as an argument to the `UseGraphQL<T>` method.

## Autofac Dependency Injection Container

Finally, let's tie everything together by configuring dependency injection in the `Startup` class. Create a method named `ConfigureContainer`, a special method used to register dependencies directly with Autofac. You don't need to build the dependency container as it is built automatically by the `AutofacServiceProviderFactory` instance specified in the `Program` class.

```c#
public virtual void ConfigureContainer(ContainerBuilder builder)
{
    builder.RegisterType<HttpContextAccessor>().As<IHttpContextAccessor>().SingleInstance();
    builder.RegisterType<MovieRepository>().As<IMovieRepository>().InstancePerLifetimeScope();
    builder.RegisterType<DocumentWriter>().AsImplementedInterfaces().SingleInstance();
    builder.RegisterType<QueryObject>().AsSelf().SingleInstance();
    builder.RegisterType<MovieReviewSchema>().AsSelf().SingleInstance();
}
```

## Debugging

Let's start the GraphQL server and use Altair to debug the API. Press **F5** use the command `dotnet run`. Navigate to the base URL of your application to open the Altair UI, as shown in the figure below.

{{< img src="1.png" alt="Altair UI" >}}

Let's try to fetch the details of a movie using the following query:

```graphql
query {
  movie(id: "72d95bfd-1dac-4bc2-adc1-f28fd43777fd") {
    id
    name
    reviews {
      reviewer
      stars
    }
  }
}
```

{{< img src="2.png" alt="Query result" >}}

Let's now execute the following mutation operation to add a review to the movie:

```graphql
mutation addReview($review: ReviewInput!) {
  addReview(id: "72d95bfd-1dac-4bc2-adc1-f28fd43777fd", review: $review) {
    id
    name
    reviews {
      reviewer
      stars
    }
  }
}
```

We require a variable named `review` of type `ReviewInput` for this operation. Let's declare the variable as follows:

```json
{
  "review": {
    "reviewer": "Rahul",
    "stars": 5
  }
}
```

Execute the operation to fetch the updated movie record.

{{< img src="3.png" alt="Mutation result" >}}

## Conclusion

In this article, we covered the basics of setting up a GraphQL API with ASP.NET Core. We defined the schema using the code-first approach, defined the graph types, and wrote query/mutation resolvers to set up the API. We used the GraphQL NuGet package for .NET, which did the heavy lifting with minimal setup. We used Autofac and the repository pattern to decouple individual components and adhere to [the Single Responsibility Principle (SRP)](https://en.wikipedia.org/wiki/Single-responsibility_principle). Finally, we used the Altair UI to debug the API.

I encourage you to extend the types of supported operations to output a list of movies and explore subscriptions to push new reviews to the client.

As always, I'd love to hear from you. Send in your questions or feedback in the comments section or on Twitter [@rahulrai_in](https://twitter.com/rahulrai_in).

{{< subscribe >}}
