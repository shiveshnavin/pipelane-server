import axios from "axios";
import { MultiDbORM, SQLiteDB } from "multi-db-orm";
import PipeLane, { InputWithPreviousInputs, PipeTask } from "pipelane";


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

    async execute(pipeWorkInstance: PipeLane, input: InputWithPreviousInputs): Promise<any[]> {
        if (!input.additionalInputs.key) {
            return [{
                status: false,
                message: 'invalid input. required feild `milis` missing'
            }]
        }

        return await new Promise((resolve) => {
        })

    }

}