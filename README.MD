# Pipelane server

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

To set up a express app and run the Pipelane server:

Clone the repository

```
cd pipelane-server
yarn install
cd client 
npm run build
```

Run standalone
```
npm start
```

Or Host the app in your existing express js app

```
creatPipelaneServer(
    variantConfig,
    db
).then(pipelaneApp => {

    app.use('/pipelane', pipelaneApp)
    app.listen(...)
})
```

## MCP Server

The pipelane tasks are also callable thorugh MCP.

Include below at the root (imp) of your experess app

```
import { createMcpServer } from "./server/mcp";

app.use(createMcpServer(VariantConfig, db))

```
