import { SQLiteDB } from "multi-db-orm";
import { creatPipelaneServer } from "./server";
import { VariantConfig } from "./server/pipe-tasks";
import { readFileSync } from "fs";
import path from "path";
import express from 'express'
import { createMcpServer } from "./server/mcp";

const app = express()
const port = process.env.PORT || 4001
const db = new SQLiteDB('database.sqlite')
app.use(createMcpServer(VariantConfig, db))
creatPipelaneServer(VariantConfig, db, 2).then(pipelane => {
    app.use('/pipelane', pipelane)
    app.use('/', (req, res) => res.redirect('/pipelane'))
    app.listen(port, () => {
        console.log(`Running a GraphQL API server at http://localhost:${port}/graph. Current time: ${new Date().toLocaleString()}`)
    })
})
