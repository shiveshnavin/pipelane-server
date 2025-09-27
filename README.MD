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
Install the below dependencies in your root project

```
npm i  @modelcontextprotocol/sdk zod
```

```
import { createMcpServer } from "./server/mcp";

app.use(createMcpServer(VariantConfig, db))

```

## SSL
Pass via env.

```
PIPELANE_HTTPS_PORT=8443
PIPELANE_HTTPS_KEY_PATH=/path/to/private.key.pem
PIPELANE_HTTPS_CERT_PATH=/path/to/certificate.pem
```


## Notes

### Firebase

Please create the indexes as well:

https://console.firebase.google.com/u/0/project/---PROJECT-ID---/firestore/databases/-default-/indexes?create_composite=ClBwcm9qZWN0cy9zZW1pYml0bWVkaWEvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3BzX3BpcGVsYW5lL2luZGV4ZXMvXxABGgoKBmFjdGl2ZRACGhQKEHVwZGF0ZWRUaW1lc3RhbXAQAhoMCghfX25hbWVfXxAC

https://console.firebase.google.com/u/0/project/---PROJECT-ID---/firestore/databases/-default-/indexes?create_composite=ClVwcm9qZWN0cy9zZW1pYml0bWVkaWEvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3BzX3BpcGVsYW5lX3Rhc2svaW5kZXhlcy9fEAEaEAoMcGlwZWxhbmVOYW1lEAEaCAoEc3RlcBABGgwKCF9fbmFtZV9fEAE

https://console.firebase.google.com/u/0/project/---PROJECT-ID---/firestore/databases/-default-/indexes?create_composite=ClVwcm9qZWN0cy9zZW1pYml0bWVkaWEvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3BzX3BpcGVsYW5lX2V4ZWMvaW5kZXhlcy9fEAEaCAoEbmFtZRABGg0KCXN0YXJ0VGltZRACGgwKCF9fbmFtZV9fEAI

https://console.firebase.google.com/u/0/project/---PROJECT-ID---/firestore/databases/-default-/indexes?create_composite=Clpwcm9qZWN0cy9zZW1pYml0bWVkaWEvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3BzX3BpcGVsYW5lX3Rhc2tfZXhlYy9pbmRleGVzL18QARoQCgxwaXBlbGFuZUV4SWQQARoNCglzdGFydFRpbWUQARoMCghfX25hbWVfXxAB

https://console.firebase.google.com/v1/r/project/---PROJECT-ID---/firestore/indexes?create_composite=ClVwcm9qZWN0cy9zZW1pYml0LWJvdHMvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3BzX3BpcGVsYW5lX2V4ZWMvaW5kZXhlcy9fEAEaCAoEbmFtZRABGg0KCXN0YXJ0VGltZRABGgwKCF9fbmFtZV9fEAE


### SQL

To support emojis in the output

```
ALTER TABLE ps_pipelane_task_exec 
MODIFY output mediumtext 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```