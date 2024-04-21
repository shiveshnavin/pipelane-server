import { MySQLDBConfig } from "multi-db-orm";
import creatPipelaneServer from "./server";
import { VariantConfig } from "./server/pipe-tasks";
import { readFileSync } from "fs";
import path from "path";

const port = process.env.PORT || 4001
const dbConfig: MySQLDBConfig = JSON.parse(readFileSync(path.join(__dirname, 'creds.json')).toString())
creatPipelaneServer(VariantConfig, dbConfig).then(pipelane => {
    pipelane.listen(port, () => {
        console.log(`Running a GraphQL API server at http://localhost:${port}/graph. Current time: ${new Date().toLocaleString()}`)
    })
})
