import { MySQLDBConfig } from "multi-db-orm";
import { creatPipelaneServer } from "./server";
import { VariantConfig } from "./server/pipe-tasks";
import { readFileSync } from "fs";
import path from "path";
import express from 'express'

const app = express()
const port = process.env.PORT || 4001
const dbConfig: MySQLDBConfig = JSON.parse(readFileSync(path.join(__dirname, 'creds.json')).toString())
creatPipelaneServer(VariantConfig, dbConfig, 2).then(pipelane => {
    app.use('/pipelane', pipelane)
    app.use('/', (req, res) => res.redirect('/pipelane'))
    app.listen(port, () => {
        console.log(`Running a GraphQL API server at http://localhost:${port}/graph. Current time: ${new Date().toLocaleString()}`)
    })
})
