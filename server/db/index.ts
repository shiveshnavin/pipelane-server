import { MySQLDB, SQLiteDB } from "multi-db-orm";
import { Pipelane, Pipetask } from '../../gen/model'
import SQLCreds from './creds.json'
const db = new MySQLDB({
    ...SQLCreds,
    database: 'pipelane'
})

export const TableName = {
    PS_PIPELANE: "ps_pipelane",
    PS_PIPELANE_TASK: "ps_pipelane_task",
}

let pl: Pipelane = {
    active: true,
    inputs: 'TEXT',
    name: 'smallstring',
    schedule: 'smallstring'
}

let plt: Pipetask = {
    pipelaneName: 'smallstring',
    isParallel: true,
    input: 'TEXT',
    taskVariantName: 'smallstring',
    taskTypeName: 'smallstring'
}

let tablePromises = [
    db.create(TableName.PS_PIPELANE, pl),
    db.create(TableName.PS_PIPELANE_TASK, plt),
]
Promise.all(tablePromises).then(() => console.log('DB Initialized: ', tablePromises.length))

export default db