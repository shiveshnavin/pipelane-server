import { MultiDbORM } from "multi-db-orm"
//@ts-ignore
import { TaskVariantConfig } from "pipelane"
import { MutationClonePipelaneArgs, MutationCreatePipelaneArgs, MutationCreatePipelaneTaskArgs, Pipelane, PipelaneExecution, PipelaneMeta, Pipetask, PipetaskExecution, QueryPipelaneArgs, QueryPipelaneExecutionArgs, QueryPipelaneExecutionsArgs, Status } from "../../gen/model"
import { TableName } from "../db"
import _ from 'lodash'
import { CronScheduler } from "../cron"
import { GraphQLError } from "graphql"
import { getTasksExecFromPipelane } from "./utils"

function generateString() {
    const hours = new Date().getHours().toString().padStart(2, '0');
    const minutes = new Date().getMinutes().toString().padStart(2, '0');
    const seconds = new Date().getSeconds().toString().padStart(2, '0');
    const milliseconds = new Date().getMilliseconds().toString();
    const generatedString = `${hours}${minutes}${seconds}${milliseconds}`;
    return generatedString;
}
export function generatePipelaneResolvers(
    db: MultiDbORM,
    variantConfig: TaskVariantConfig,
    cronScheduler?: CronScheduler,
    defaultExecutionRetentionCountPerPipe: number = 5) {

    if (db == undefined) {
        throw new Error('db supplied to pipelane must not be null')
    }

    async function trimExecution(pipeEx: PipelaneExecution) {
        let pipe = await PipelaneResolvers.Query.Pipelane(undefined, {
            name: pipeEx.name
        })
        if (!pipe)
            return
        let pipelaneName = pipe.name
        let pkey = `excount_${pipelaneName}`
        let existingCounter: PipelaneMeta = await db.getOne(TableName.PS_PIPELANE_META, {
            pkey: pkey
        })
        if (!existingCounter) {
            await db.insert(TableName.PS_PIPELANE_META, {
                pkey: pkey,
                pval: '0'
            })
        } else {
            if (pipe.executionsRetentionCount == undefined) {
                pipe.executionsRetentionCount = defaultExecutionRetentionCountPerPipe
            }
            let count = parseInt(existingCounter.pval) + 1
            if (pipe.executionsRetentionCount == 0 || count > (pipe.executionsRetentionCount)) {
                db.get(TableName.PS_PIPELANE_EXEC, {
                    name: pipe.name
                }, {
                    sort: [{
                        field: 'startTime',
                        order: 'asc'
                    }],
                    limit: Math.round(count / 2)
                }).then(async (executions) => {
                    if (executions && executions.length > 0) {
                        executions = executions.slice(0, Math.round(count / 2))
                        executions.forEach((e) => {
                            db.delete(TableName.PS_PIPELANE_EXEC, {
                                id: e.id
                            })
                            db.delete(TableName.PS_PIPELANE_TASK_EXEC, {
                                pipelaneExId: e.id
                            })
                        })
                        let newCount = Math.max(0, count - executions.length)
                        newCount = (await db.get(TableName.PS_PIPELANE_EXEC, {
                            name: pipelaneName
                        })).length

                        db.update(TableName.PS_PIPELANE_META, {
                            pkey: pkey
                        }, {
                            pval: `${newCount}`
                        })
                    }
                })

            }
            else {

                await db.update(TableName.PS_PIPELANE_META, {
                    pkey: pkey
                }, {
                    pval: `${Math.max(0, count)}`
                })
            }
        }
    }
    const PipelaneResolvers = {
        PipelaneExecution: {
            definition: (parent) => {
                return PipelaneResolvers.Query.Pipetask({}, {
                    name: parent.name,
                    pipelaneName: parent.pipelaneName
                })
            },
            tasks: async (parent: PipelaneExecution) => {
                if (parent.tasks) return parent.tasks
                let cached = cronScheduler.executionsCache.find(ex => ex.instanceId === parent.id)
                if (cached) {
                    //@ts-ignore
                    let tasks = getTasksExecFromPipelane(cached)
                    if (tasks && tasks.length > 0)
                        return tasks
                }
                let tasks = await db.get(TableName.PS_PIPELANE_TASK_EXEC,
                    {
                        pipelaneExId: parent.id
                    },
                    {
                        sort: [{
                            field: 'startTime',
                            order: 'asc'
                        }]
                    })
                return tasks || []
            }
        },
        Pipetask: {
            active: (parent: any) => {
                if (typeof parent.active === "boolean") {
                    return parent.active;
                }
                if (typeof parent.active === "string") {
                    return parent.active.toLowerCase() === "true";
                }
                if (typeof parent.active === "number") {
                    return parent.active === 1;
                }
                return Boolean(parent.active);
            },
            isParallel: (parent: any) => {
                if (typeof parent.isParallel === "boolean") {
                    return parent.isParallel;
                }
                if (typeof parent.isParallel === "string") {
                    return parent.isParallel.toLowerCase() === "true";
                }
                if (typeof parent.isParallel === "number") {
                    return parent.isParallel === 1;
                }
                return Boolean(parent.isParallel);
            }
        },
        Pipelane: {
            active: (parent: any) => {
                if (typeof parent.active === "boolean") {
                    return parent.active;
                }
                if (typeof parent.active === "string") {
                    return parent.active.toLowerCase() === "true";
                }
                if (typeof parent.active === "number") {
                    return parent.active === 1;
                }
                return Boolean(parent.active);
            },
            nextRun: (parent: Pipelane) => cronScheduler.getNextRun(parent.schedule).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata'
            }),
            tasks: async (parent: Pipelane) => {
                if (parent.tasks) return parent.tasks
                let tasks = await db.get(TableName.PS_PIPELANE_TASK,
                    {
                        pipelaneName: parent.name
                    },
                    {
                        sort: [{
                            field: 'step',
                            order: 'asc'
                        }]
                    })
                return tasks || []
            },
            async executions(parent: Pipelane) {
                let executions = await db.get(TableName.PS_PIPELANE_EXEC, { name: parent.name })
                return executions
            },
        },
        Query: {
            Pipelane: async (parent, arg: QueryPipelaneArgs): Promise<Pipelane> => {
                let existing = await db.getOne(TableName.PS_PIPELANE,
                    { name: arg.name })
                return existing
            },
            Pipetask: async (parent, arg): Promise<Pipetask> => {
                let existing = await db.getOne(TableName.PS_PIPELANE_TASK,
                    {
                        name: arg.name,
                        pipelaneName: arg.pipelaneName
                    })
                return existing
            },
            async PipelaneExecution(pr, arg: QueryPipelaneExecutionArgs) {
                let data = await db.getOne(TableName.PS_PIPELANE_EXEC, {
                    id: arg.id
                })
                return data
            },
            pipelanes: async (): Promise<Pipelane[]> => {
                let pls = await db.get(TableName.PS_PIPELANE, {}, {
                    sort: [
                        {
                            field: 'active',
                            order: 'desc'
                        },
                        {
                            field: 'updatedTimestamp',
                            order: 'desc'
                        }]
                })
                return pls
            },
            pipelaneTasks: async (parent, arg): Promise<Pipetask[]> => {
                let pls = await db.get(TableName.PS_PIPELANE_TASK,
                    { pipelaneName: arg.pipelaneName }, {
                    sort: [{
                        field: 'step',
                        order: 'asc'
                    }]
                })
                return pls
            },
            async executions(parent, request: { limit: number }) {
                let data = await db.get(TableName.PS_PIPELANE_EXEC, {}, {
                    limit: request.limit || 50,
                    sort: [{
                        field: 'startTime',
                        order: 'desc'
                    }]
                })
                return data?.filter(dt => dt.name && dt.id && dt.startTime)
            },
            pipelaneExecutions(pr, arg: QueryPipelaneExecutionsArgs) {
                return db.get(TableName.PS_PIPELANE_EXEC, {
                    name: arg.pipelaneName
                }, {
                    limit: arg.limit || 50,
                    sort: [{
                        field: 'startTime',
                        order: 'desc'
                    }]
                }) as Promise<PipelaneExecution[]>
            }

        },
        Mutation: {

            async createPipelaneTask(parent: any, request: MutationCreatePipelaneTaskArgs) {
                let input = request.data
                let existing = await db.getOne(TableName.PS_PIPELANE_TASK,
                    {
                        name: request.oldTaskName || input.name,
                        pipelaneName: input.pipelaneName
                    }) as Pipetask
                let isUpdate = existing != undefined
                if (!isUpdate)
                    existing = {} as Pipetask
                Object.assign(existing, input)
                if (isUpdate)
                    await db.update(TableName.PS_PIPELANE_TASK, {
                        name: request.oldTaskName || input.name,
                        pipelaneName: input.pipelaneName
                    }, existing)
                else {
                    let existingTasks = await PipelaneResolvers.Pipelane.tasks({ name: input.pipelaneName }) || []
                    existing.step = existing.step ?? existingTasks.length
                    await db.insert(TableName.PS_PIPELANE_TASK, existing)
                }
                return existing
            },
            async clonePipelane(parent: any, request: MutationClonePipelaneArgs) {
                let existing = (await PipelaneResolvers.Query.Pipelane(undefined, request)) as Pipelane
                if (!existing) {
                    throw new GraphQLError(`${request.name} does not exists`)
                }
                let tasks: Pipetask[] = await PipelaneResolvers.Pipelane.tasks(existing)
                let gens = generateString()
                existing.name = `${existing.name}-${gens}`

                tasks.forEach(t => {
                    t.pipelaneName = existing.name
                })
                existing.tasks = tasks
                let newPl = await PipelaneResolvers.Mutation.createPipelane(undefined, {
                    data: existing
                })
                return newPl

            },
            async createPipelane(parent: any, request: MutationCreatePipelaneArgs) {
                let input = request.data
                let tasks = request.data.tasks || []
                let existing = await db.getOne(TableName.PS_PIPELANE, { name: request.oldPipeName || input.name }) as Pipelane
                let isUpdate = existing != undefined
                if (!isUpdate)
                    existing = {} as Pipelane
                let pl = Object.assign(existing, request.data)
                delete existing.tasks

                existing.schedule = existing.schedule.trim()
                existing.retryCount = existing.retryCount || 0
                existing.executionsRetentionCount = existing.executionsRetentionCount || defaultExecutionRetentionCountPerPipe
                existing.updatedTimestamp = `${Date.now()}`
                cronScheduler?.addToSchedule(existing)
                if (request.oldPipeName && request.oldPipeName != input.name) {
                    await db.update(TableName.PS_PIPELANE_TASK, {
                        pipelaneName: request.oldPipeName
                    }, {
                        pipelaneName: input.name
                    })
                }
                await Promise.all([
                    isUpdate ? db.update(TableName.PS_PIPELANE, {
                        name: request.oldPipeName || input.name
                    }, existing)
                        : db.insert(TableName.PS_PIPELANE, existing),
                    , ...tasks.map(async (tk) => {
                        tk.pipelaneName = input.name
                        //@ts-ignore
                        PipelaneResolvers.Mutation.createPipelaneTask(tk, { data: tk })
                    })])
                return pl
            },
            async deletePipelane(parent, request: { name: string }) {
                await db.delete(TableName.PS_PIPELANE, { name: request.name })
                await db.delete(TableName.PS_PIPELANE_TASK, { pipelaneName: request.name })
                await db.delete(TableName.PS_PIPELANE_EXEC, { name: request.name })
                cronScheduler.stopJob(request.name)
                return 'SUCCESS'
            },
            async deletePipelaneTask(parent, request: { name: string, pipelaneName: string }) {
                await db.delete(TableName.PS_PIPELANE_TASK, {
                    name: request.name,
                    pipelaneName: request.pipelaneName
                })
                return 'SUCCESS'
            },

            async createPipelaneExecution(parent, request: { data: PipelaneExecution }) {
                let existing = request.data.id && await db.getOne(TableName.PS_PIPELANE_EXEC, {
                    id: request.data.id
                })
                let tx = request.data
                if (tx.status != Status.InProgress) {
                    trimExecution(existing || tx)
                }
                if (!existing) {
                    delete tx.definition
                    delete tx.tasks
                    request.data.id = request.data.id || `${tx.name}-${Date.now()}`
                    await db.insert(TableName.PS_PIPELANE_EXEC, tx)
                    existing = tx
                } else {
                    Object.assign(existing, tx)
                    delete existing.definition
                    delete existing.tasks
                    await db.update(TableName.PS_PIPELANE_EXEC,
                        {
                            id: existing.id
                        },
                        existing)
                }
                return existing
            },

            async createPipelaneTaskExecution(parent, request: { data: PipetaskExecution }) {
                let existing = request.data.id && await db.getOne(TableName.PS_PIPELANE_TASK_EXEC, {
                    id: request.data.id
                })
                let tx = request.data
                if (!existing) {
                    request.data.id = request.data.id || `${tx.pipelaneExId}::${tx.name}`
                    await db.insert(TableName.PS_PIPELANE_TASK_EXEC, tx)
                } else {
                    Object.assign(existing, tx)
                    await db.update(TableName.PS_PIPELANE_TASK_EXEC,
                        {
                            id: existing.id
                        },
                        existing)
                }
                return existing
            },
            async executePipelane(parent, request: { name: string, input: string }) {
                let existing = await PipelaneResolvers.Query.Pipelane(parent, request)
                let execution = await cronScheduler.triggerPipelane(existing,
                    JSON.stringify(Object.assign(
                        JSON.parse(existing.input),
                        JSON.parse(request.input)
                ))
                )
                if (!execution) {
                    throw new GraphQLError("Error triggering pipelane, perhaps it is disabled?")
                }
                return execution
            },
        }
    }
    return PipelaneResolvers
}
