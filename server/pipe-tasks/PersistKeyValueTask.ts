import axios from "axios";
import { MultiDbORM, SQLiteDB } from "multi-db-orm";
import PipeLane, { InputWithPreviousInputs, PipeTask, PipeTaskDescription } from "pipelane";


export type PersistedKeyValue = {
    pipelane: string,
    key: string,
    value: string
    group: string
}

export class PersistKeyValueTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "persist-key-value"
    static TASK_TYPE_NAME: string = "persist"

    private db: MultiDbORM = undefined

    constructor(variantName?: string, db?: MultiDbORM) {
        super(PersistKeyValueTask.TASK_TYPE_NAME, variantName || PersistKeyValueTask.TASK_VARIANT_NAME)
        if (!db) {
            try {
                db = new SQLiteDB('pipelane.sqlite')
            } catch (e) {
                throw new Error('Must provide `db` or install `sqlite3` package to use task `PersistKeyValueTask`')
            }
        }
        this.db = db
    }

    kill(): boolean {
        return true
    }

    async initDb() {
        this.db.create(`ps_pipelane_persisted_kv`, {
            group: 'stringsmall',
            key: 'stringsmall',
            pipelane: 'stringsmall',
            value: 'stringlarge'
        } as PersistedKeyValue)
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: 'Persists key-value pairs for using later on. if last does not have a key field then the input will pass through to output (it will try to persist from additionalInputs if provided)',
            inputs: {
                last: [{
                    pipelane: 'optional, will auto pick if not provided',
                    key: 'key',
                    value: 'value',
                    group: 'optional, defaults to pipelane name'
                }],
                additionalInputs: {
                    group: 'optional, the group in inputs (if provided) will override this',
                    pipelane: 'optional, will auto pick if not provided',
                    key: 'key',
                    value: 'value'
                }
            }
        }
    }

    async execute(pipeWorksInstance: PipeLane,
        input: { last: PersistedKeyValue[] | any[], additionalInputs: PersistedKeyValue }): Promise<any[]> {
        let output = []
        let group = input.additionalInputs?.group
        let pipelaneName = pipeWorksInstance.name
        let perisistFromInput = input.last?.find(y => y.key != undefined)
        for (let _input of input.last) {

        }

        return output

    }

}