import axios from "axios";
import { MultiDbORM, SQLiteDB } from "multi-db-orm";
import PipeLane, { InputWithPreviousInputs, PipeTask, PipeTaskDescription } from "pipelane";


export type PersistedKeyValue = {
    skipSetInInputs: boolean
    pipelane: string,
    pkey: string,
    pval: string
    grp: string
}

export class PersistKeyValueTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "persist-key-value"
    static TASK_TYPE_NAME: string = "persist"

    private db: MultiDbORM = undefined
    public tableName = `ps_pipelane_persisted_kv`
    private initialized = false;
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
        if (this.initialized) {
            return
        }
        return this.db.create(this.tableName, {
            grp: 'stringsmall',
            pkey: 'stringsmall',
            pipelane: 'stringsmall',
            pval: 'stringlarge'
        } as PersistedKeyValue).catch(e => {
            this.onLog('Error initializing db for ' + this.getTaskVariantName() + '. ' + e.message)
        }).finally(() => {
            this.initialized = true
        })
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: 'Persists key-value pairs for using later on.it will try to persist from additionalInputs if provided and input.last passes through to output. if additionalInputs does not have a key field then the it will check in input.last and the output is the persisted objects',
            inputs: {
                last: [{
                    pipelane: 'optional, will auto pick if not provided',
                    pkey: 'key',
                    pval: 'value',
                    grp: 'optional, defaults to pipelane name'
                } as PersistedKeyValue],
                additionalInputs: {
                    grp: 'optional, the group in inputs (if provided) will override this',
                    pipelane: 'optional, will auto pick if not provided',
                    pkey: 'key',
                    pval: 'value'
                } as PersistedKeyValue
            }
        }
    }

    async execute(pipeWorksInstance: PipeLane,
        input: { last: PersistedKeyValue[] | any[], additionalInputs: PersistedKeyValue }): Promise<any[]> {
        if (!this.initialized) {
            await this.initDb()
        }
        let output = []
        let pipelaneName = pipeWorksInstance.name
        let grp = input.additionalInputs?.grp ?? pipelaneName
        let toInsert = []

        let perisistFromInput = input.last?.find(y => y.pkey != undefined)

        output = input.last
        if (input.additionalInputs?.pkey) {
            let _input = {} as PersistedKeyValue
            _input.pkey = input.additionalInputs.pkey
            _input.pval = input.additionalInputs.pval
            _input.grp = _input.grp || grp
            _input.pipelane = _input.pipelane || pipelaneName
            toInsert.push(_input)
        }
        else if (perisistFromInput) {
            for (let _input of input.last as PersistedKeyValue[]) {
                _input.grp = _input.grp || grp
                _input.pipelane = _input.pipelane || pipelaneName
                //@ts-ignore
                toInsert.push({
                    pkey: _input.pkey,
                    pval: _input.pval,
                    grp: _input.grp,
                    pipelane: _input.pipelane
                } as PersistedKeyValue)
            }
            output = toInsert
        }

        if (toInsert.length > 0) {
            let promises = toInsert.map(_input => {
                //@ts-ignore
                let dbFilter = {
                    pkey: _input.pkey,
                    grp: _input.grp,
                    pipelane: _input.pipelane
                } as PersistedKeyValue
                return this.db.getOne(this.tableName, dbFilter).then(existing => {
                    if (existing) {
                        return this.db.update(this.tableName, dbFilter, _input)
                    } else {
                        return this.db.insert(this.tableName, _input)
                    }
                })
                    .then(() => {
                        _input.status = true
                    })
                    .catch(e => {
                        _input.status = false
                        _input.message = 'Error persisting. ' + e.message
                    })
            })
            await Promise.all(promises)
            this.onLog('Persisted ', JSON.stringify(toInsert.map(o => (`${o.pkey}=${o.pval}`))))

        }

        return output || [{ status: false }]

    }

}