import { MySQLDB, SQLiteDB } from "multi-db-orm";
import { Pipelane, Pipetask } from '../../gen/model'
import SQLCreds from './creds.json'
const db = new MySQLDB({
    ...SQLCreds,
    database: 'pipelane',
    connectTimeout: 30000,
    acquireTimeout: 30000,
    timeout: 30000,
    connectionLimit: 30,
})

export const TableName = {
    PS_PIPELANE: "ps_pipelane",
    PS_PIPELANE_TASK: "ps_pipelane_task",
}

let pl: Pipelane = {
    active: true,
    input: 'TEXT',
    name: 'smallstring',
    schedule: 'smallstring',
    retryCount: 0,
    executionsRetentionCount: 5,
    updatedTimestamp: 'smallstring'
}

let plt: Pipetask = {
    name: 'smallstring',
    pipelaneName: 'smallstring',
    isParallel: true,
    active: true,
    input: 'TEXT',
    taskVariantName: 'smallstring',
    taskTypeName: 'smallstring'
}

let tablePromises = [
    db.create(TableName.PS_PIPELANE, pl),
    db.create(TableName.PS_PIPELANE_TASK, plt),
]
Promise.all(tablePromises).then(() => console.log('DB Initialized: ', tablePromises.length, 'tables'))

export default db