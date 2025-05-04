# Pipelane server

## Summary

The Pipelane server is the backend component of the Pipelane system, a platform for defining, scheduling, and executing automated pipelines. It provides a GraphQL API for managing pipelines, tasks, and executions, and supports various task types for automating different operations.

## Features

- **GraphQL API:** Interact with Pipelanes, Pipetasks, and executions through a well-defined GraphQL schema.
- **Pipeline Definition:** Define pipelines with sequences of tasks and configure their execution flow.
- **Task Types:** Support for various built-in task types (e.g., API calls, delays, script evaluation, file operations).
- **Scheduling:** Schedule pipelines to run at specific times using cron expressions.
- **Execution Management:** Track pipeline and task executions, view logs, and monitor status.
- **Client Application:** Designed to work with a separate client application for a user interface.

## Installation

To set up and run the Pipelane server:

1. Clone the repository:

### cron

https://github.com/kelektiv/node-cron/issues/190

### Hosting

Build the models

```
cd pipelane-server
yarn install
```

Host the app at

```
creatPipelaneServer(
    variantConfig,
    db
).then(pipelaneApp => {

    app.use('/pipelane', pipelaneApp)
    app.listen(...)
})
```
