import { FireStoreDB, MultiDbORM, SQLiteDB } from "multi-db-orm";
import PipeLane, { InputWithPreviousInputs, PipeTask, PipeTaskDescription, OutputWithStatus } from "pipelane";

export type Topic = {
    id: string,
    priority: number,
    state: "completed" | "failed" | "in_progress" | "scheduled" | "pending_approval",
    updatedTimestamp: number,
    createdTimestamp: number,
    queue: string
}

export class TopicTask extends PipeTask<InputWithPreviousInputs, OutputWithStatus> {
    kill(): boolean {
        return false
    }
    static TASK_TYPE_NAME: string = "topic";
    static VARIANT_READ: string = "read";
    static VARIANT_WRITE: string = "write";
    public tableName;
    private db: MultiDbORM = undefined;
    private initialized = false;

    constructor(variantName: string, db?: MultiDbORM, tableName = 'ps_pipelane_topics') {
        super(TopicTask.TASK_TYPE_NAME, variantName);
        this.tableName = tableName
        if (!db) {
            try {
                db = new SQLiteDB('pipelane.sqlite');
            } catch (e) {
                throw new Error('Must provide `db` or install `sqlite3` package to use TopicTask');
            }
        }
        this.db = db;
        this.initDb()
    }

    async initDb() {
        if (this.initialized) return;
        await this.db.create(this.tableName, {
            id: 'stringsmall',
            priority: 111,
            state: 'stringsmall',
            updatedTimestamp: 111,
            createdTimestamp: 111,
            queue: 'stringsmall',
            payload: 'stringlarge'
        }).catch(e => {
            this.onLog('Error initializing db for TopicTask. ' + e.message);
        }).finally(() => {
            this.initialized = true;
        });
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: 'Handles reading and writing topics to the DB.',
            inputs: {
                last: [{ status: true }],
                additionalInputs: {
                    limit: 'number of topics to load (read), defaults to 1. If 1, read topic from pl.inputs.topic else from pl.inputs.topics',
                    queue: 'queue name, defaults to pipelane name (read, write)',
                    id: 'topic id (read), optional',
                    state: 'topic state  (read)(write)',
                    order: 'asc (default)(read), desc, ordered by createdTimestamp'
                }
            }
        };
    }

    async execute(pipeWorksInstance: PipeLane, input: { last?: any[], additionalInputs?: any }): Promise<any[]> {
        if (!this.initialized) await this.initDb();
        const variant = this.getTaskVariantName();
        let queue = input.additionalInputs?.queue || pipeWorksInstance.name;

        if (variant === TopicTask.VARIANT_READ) {
            let limit = input.additionalInputs?.limit || 1;
            let id = input.additionalInputs?.id;
            let topics: Topic[] = [];
            if (id) {
                const topic = await this.db.getOne(this.tableName, { id });
                if (topic) topics = [topic];
            } else {
                let filter: any = {
                    queue
                };
                filter.state = input.additionalInputs?.state ?? 'scheduled'
                topics = await this.db.get(this.tableName,
                    filter,
                    {
                        limit, sort: [
                            {
                                field: 'priority',
                                order: 'asc'
                            },
                            {
                                field: 'createdTimestamp',
                                order: input.additionalInputs?.order ?? 'asc'
                            }]
                    });
            }
            pipeWorksInstance.inputs.topic = topics[0];
            pipeWorksInstance.inputs.topics = topics;
            if (!input.last || input.last?.length <= 0) {
                return topics.map(t => ({ status: true, ...t }));
            }
        }

        if (variant === TopicTask.VARIANT_WRITE) {
            let now = Date.now();
            function normalizeTopic(t: any): Topic {
                return {
                    ...t,
                    id: t.id || `${t.queue}-${now + Math.floor(Math.random() * 10000)}`,
                    priority: t.priority || input.additionalInputs?.priority || 100,
                    queue: t.queue || queue,
                    state: t.state || input.additionalInputs?.state || 'scheduled',
                    updatedTimestamp: now,
                    createdTimestamp: t.createdTimestamp || now,
                };
            }
            let topicsToWrite: Topic[] = [];
            if (pipeWorksInstance.inputs.topic) {
                topicsToWrite.push(normalizeTopic(pipeWorksInstance.inputs.topic));
            } else if (pipeWorksInstance.inputs.topics) {
                for (let t of pipeWorksInstance.inputs.topics) {
                    topicsToWrite.push(normalizeTopic(t));
                }
            } else if (input.additionalInputs
                && input.additionalInputs.state
                && input.additionalInputs.queue
            ) {
                topicsToWrite.push(normalizeTopic(input.additionalInputs || {}));
            }

            let results: Topic[] = [];
            for (let t of topicsToWrite) {
                let dbFilter = { id: t.id };
                let existing = t.id ? (await this.db.getOne(this.tableName, dbFilter)) : undefined;
                t = Object.assign({
                    ...t,
                    ...input.additionalInputs
                })
                if (existing) {
                    await this.db.update(this.tableName, dbFilter, t);
                } else {
                    t.id = `${t.queue}-${Date.now()}`;
                    await this.db.insert(this.tableName, t);
                }
                results.push({ ...t });
            }
        }

        return input.last || [{ status: true }];
    }
}



// Example test function to demonstrate TopicTask usage
async function test() {
    // Setup a dummy PipeLane instance
    const pl = new PipeLane({}, "newQueue")
    pl.inputs = {}
    // Write test
    const writeTask = new TopicTask(TopicTask.VARIANT_WRITE);
    const writeInput = {
        last: [{
            status: true,
            message: "This is a test"
        }],
        additionalInputs: {
            id: "topic1",
            priority: 1,
            state: "pending_approval",
            payload: { foo: "bar" },
            queue: "testQueue"
        }
    };
    const writeResult = await writeTask.execute(pl, writeInput);
    console.log("Write Result:", writeResult);

    // Read test (single)
    const readTask = new TopicTask(TopicTask.VARIANT_READ);
    const readInputSingle = {
        last: [{
            status: true,
            message: "This is a test"
        }],
        additionalInputs: {
            id: "topic1",
            queue: "testQueue",
            limit: 1
        }
    };
    const readResultSingle = await readTask.execute(pl, readInputSingle);
    console.log("Read Result (single):", readResultSingle);
    console.log("Read Result (pl.inputs):", pl.inputs.topic);

    const readResultSingleNoLast = await readTask.execute(pl, {
        additionalInputs: readInputSingle.additionalInputs
    });
    console.log("Read Result no last (single):", readResultSingleNoLast);
    console.log("Read Result no last (pl.inputs):", pl.inputs.topic);

    pl.inputs.topic.state = 'failed'
    // Write multiple topics
    pl.inputs.topics = [
        pl.inputs.topic,
        {
            id: "topic3",
            priority: 3,
            state: "completed",
            payload: { baz: "qux" },
            queue: "testQueue"
        }
    ];
    const writeMultiResult = await writeTask.execute(pl, { additionalInputs: {} });
    console.log("Write Multiple Result:", writeMultiResult);

    // Read test (multiple)
    const readInputMulti = {
        last: [{
            status: true,
            message: "This is a test"
        }],
        additionalInputs: {
            queue: "testQueue",
            limit: 5
        }
    };
    const readResultMulti = await readTask.execute(pl, readInputMulti);
    console.log("Read Result (multiple):", readResultMulti);
    console.log("Read Result (pl.inputs.topics):", pl.inputs.topics);
}

// Uncomment to run test
// test();