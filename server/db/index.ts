import { MultiDbORM, MySQLDB, MySQLDBConfig, SQLiteDB } from "multi-db-orm";
import { Pipelane, PipelaneExecution, PipelaneMeta, Pipetask, PipetaskExecution, Status } from '../../gen/model'

export const TableName = {
    PS_PIPELANE: "ps_pipelane",
    PS_PIPELANE_TASK: "ps_pipelane_task",
    PS_PIPELANE_EXEC: "ps_pipelane_exec",
    PS_PIPELANE_TASK_EXEC: "ps_pipelane_task_exec",
    PS_PIPELANE_META: "ps_pipelane_meta",

}

/**
 * Provide either db or MySQL Config
 * @param db 
 * @param mysqlConfig 
 */
export function initialzeDb(db?: MultiDbORM, mysqlConfig?: MySQLDBConfig) {

    db = db || new MySQLDB({
        ...mysqlConfig,
        database: 'pipelane',
        connectTimeout: 30000,
        acquireTimeout: 30000,
        timeout: 30000,
        connectionLimit: 30,
    })


    let pl: Pipelane = {
        active: true,
        input: 'stringlarge',
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
        step: 1,
        active: true,
        input: 'stringlarge',
        taskVariantName: 'smallstring',
        taskTypeName: 'smallstring'
    }

    let plx: PipelaneExecution = {
        name: 'smallstring',
        id: 'smallstring',
        endTime: 'smallstring',
        output: 'stringlarge',
        status: Status.Success,
        startTime: 'smallstring',
    }

    let pltx: PipetaskExecution = {
        pipelaneExId: 'smallstring',
        pipelaneName: 'smallstring',
        name: 'smallstring',
        id: 'smallstring',
        endTime: 'smallstring',
        output: 'stringlarge',
        status: Status.Success,
        startTime: 'smallstring',
    }

    let plm: PipelaneMeta = {
        pkey: 'smallstring',
        pval: 'smallstring'
    }

    let tablePromises = [
        db.create(TableName.PS_PIPELANE, pl),
        db.create(TableName.PS_PIPELANE_TASK, plt),
        db.create(TableName.PS_PIPELANE_EXEC, plx),
        db.create(TableName.PS_PIPELANE_TASK_EXEC, pltx),
        db.create(TableName.PS_PIPELANE_META, plm),
    ]
    Promise.all(tablePromises).then(() => console.log('pipelane:DB Initialized: ', tablePromises.length, 'tables'))

    function clean() {
        db.delete(TableName.PS_PIPELANE_EXEC, {})
        db.delete(TableName.PS_PIPELANE_TASK_EXEC, {})
    }

    return db
    // clean()
}