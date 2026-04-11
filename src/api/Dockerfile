# syntax=docker/dockerfile:1.7

# Build stage — uses the .NET 10 SDK to restore and publish the API as a self-contained
# release output. Restore is split from the rest of the copy so that subsequent builds
# only re-run restore when Kanban.Api.csproj changes.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Kanban.Api.csproj ./
RUN dotnet restore Kanban.Api.csproj

COPY . ./
RUN dotnet publish Kanban.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage — uses the slim ASP.NET runtime image. The base image already provides
# a non-root `app` user, so we switch to it before defining the entrypoint.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true

COPY --from=build /app/publish ./

USER app
EXPOSE 8080

ENTRYPOINT ["dotnet", "Kanban.Api.dll"]
