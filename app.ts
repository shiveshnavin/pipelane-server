import { SQLiteDB } from "multi-db-orm";
import { creatPipelaneServer } from "./server";
import { VariantConfig } from "./server/pipe-tasks";
import { readFileSync } from "fs";
import path from "path";
import https from 'https'
import express from 'express'
import fs from 'fs'
import { createMcpServer } from "./server/mcp";

const app = express()
const port = process.env.PORT || 4001

function initDb() {
    try {
        return new SQLiteDB('database.sqlite')
    } catch (e) {
        console.error("SQLite DB Initialization failed, did you install `npm i sqlite3`?")
        throw e;
    }
}

const db = initDb()
app.use(createMcpServer(VariantConfig, db))
creatPipelaneServer(VariantConfig, db, 2).then(pipelane => {
    app.use('/pipelane', pipelane)
    app.use('/', (req, res) => res.redirect('/pipelane'))
    app.listen(port, () => {
        console.log(`Running a GraphQL API server at http://localhost:${port}/graph. Current time: ${new Date().toLocaleString()}`)
    })

    if(process.env.PIPELANE_HTTPS_KEY_PATH && process.env.PIPELANE_HTTPS_CERT_PATH){
        let HTTPS_PORT = process.env.PIPELANE_HTTPS_PORT || 8443
        var privateKey = fs.readFileSync(process.env.PIPELANE_HTTPS_KEY_PATH);
        var certificate = fs.readFileSync(process.env.PIPELANE_HTTPS_CERT_PATH);
        https
            .createServer({
                key: privateKey,
                cert: certificate
            }, app)
            .listen(HTTPS_PORT, () => {
                console.log('Pipelane https server UP on port ', HTTPS_PORT)
            });
    }
})
