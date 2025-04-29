import axios from "axios";
import { MultiDbORM, SQLiteDB } from "multi-db-orm";
import PipeLane, { InputWithPreviousInputs, PipeTask, PipeTaskDescription } from "pipelane";
import { PersistedKeyValue } from "./PersistKeyValueTask";

export class ReadPersistedKeyValueTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "read-persisted-key-value"
    static TASK_TYPE_NAME: string = "read-persisted"

    private db: MultiDbORM = undefined
    public tableName = `ps_pipelane_persisted_kv`
    private initialized = false;
    constructor(variantName?: string, db?: MultiDbORM) {
        super(ReadPersistedKeyValueTask.TASK_TYPE_NAME, variantName || ReadPersistedKeyValueTask.TASK_VARIANT_NAME)
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
            summary: 'Read key-value pairs for using later on. if additionalInputs does not have a pkey field then it will try to read pkey from last if provided, By default, sets the keys in pipelane inputs',
            inputs: {
                last: [{
                    pipelane: 'optional, will auto pick if not provided',
                    pkey: 'key',
                    grp: 'optional, defaults to pipelane name'
                } as PersistedKeyValue],
                additionalInputs: {
                    skipSetInInputs: 'boolean, skip setting the key values in pl inputs. default is false',
                    grp: 'optional',
                    pipelane: 'optional, will auto pick if not provided',
                    pkey: 'key'
                }
            }
        }
    }

    async execute(pipeWorksInstance: PipeLane,
        input: { last: PersistedKeyValue[] | any[], additionalInputs: PersistedKeyValue }): Promise<any[]> {
        if (!this.initialized) {
            await this.initDb()
        }
        let pipelaneName = pipeWorksInstance.name
        let grp = input.additionalInputs?.grp ?? pipelaneName
        let toRead = []

        let perisistFromInput = input.last?.find(y => y.pkey != undefined)
        if (input.additionalInputs?.pkey) {
            let _input = {} as PersistedKeyValue
            _input.pkey = input.additionalInputs.pkey
            _input.grp = _input.grp || grp
            _input.pipelane = _input.pipelane || pipelaneName
            toRead.push(_input)
        }
        else if (perisistFromInput) {
            for (let _input of input.last as PersistedKeyValue[]) {
                _input.grp = _input.grp || grp
                _input.pipelane = _input.pipelane || pipelaneName
                //@ts-ignore
                toRead.push({
                    pkey: _input.pkey,
                    grp: _input.grp,
                    pipelane: _input.pipelane
                } as PersistedKeyValue)
            }
        }


        let output = []
        if (toRead.length > 0) {
            let promises = toRead.map(_input => {
                //@ts-ignore
                let dbFilter = {
                    pkey: _input.pkey,
                    grp: _input.grp,
                    pipelane: _input.pipelane
                } as PersistedKeyValue
                return this.db.getOne(this.tableName, dbFilter)
                    .then((result) => {
                        if (result) {
                            result.status = true
                            return result
                        }
                        _input.status = false
                        return _input
                    })
                    .catch(e => {
                        _input.status = false
                        _input.message = 'Error reading. ' + e.message
                        return _input
                    })
            })
            output = await Promise.all(promises)
            this.onLog('Loaded ', JSON.stringify(output.map(o => (`${o.pkey}=${o.pval}`))))
            let plInputs = pipeWorksInstance.getInputs()
            if (!input.additionalInputs.skipSetInInputs)
                output.forEach((p) => {
                    plInputs[p.pkey] = p.pval
                })
        }

        return output

    }

}