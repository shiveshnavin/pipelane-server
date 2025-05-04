# Pipelane server

## Summary
# Pipelane UI Server
This is the UI server for Pipelane, a system for defining and executing automated pipelines. It provides a GraphQL API for managing pipelines and tasks, and serves the client-side application for a user interface to interact with the Pipelane backend.

## Features

- **GraphQL API:** Interact with Pipelanes, Pipetasks, and executions through a well-defined GraphQL schema.
- **Pipeline Definition:** Define pipelines with sequences of tasks and configure their execution flow.
- **Task Types:** Support for various built-in task types (e.g., API calls, delays, script evaluation, file operations).
- **Scheduling:** Schedule pipelines to run at specific times using cron expressions.
- **Execution Management:** Track pipeline and task executions, view logs, and monitor status.
- **Client Application:** Designed to work with a separate client application for a user interface.
- **Express.js Integration:** Easily integrate the Pipelane UI server into your existing Express.js applications.

## Installation

To set up and run the Pipelane server:

1. **Clone the repository:**



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
