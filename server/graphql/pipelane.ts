import { MultiDbORM } from "multi-db-orm"
import { TaskVariantConfig } from "pipelane"
import { CreatePipelanePayload, CreatePipetaskPayload, Pipelane, Pipetask } from "../../gen/model"
import { TableName } from "../db"
import _ from 'lodash'
import { CronScheduler } from "../cron"

export function generatePipelaneResolvers(
    db: MultiDbORM,
    variantConfig: TaskVariantConfig,
    cronScheduler?: CronScheduler) {
    const PipelaneResolvers = {
        Pipelane: {
            nextRun: (parent: Pipelane) => cronScheduler.getNextRun(parent.schedule).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata'
            }),
            tasks: async (parent) => {
                if (parent.tasks) return parent.tasks
                let tasks = await db.get(TableName.PS_PIPELANE_TASK,
                    {
                        pipelaneName: parent.name
                    })
                return tasks || []
            }
        },
        Query: {
            Pipelane: async (parent, arg): Promise<Pipelane> => {
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
            pipelanes: async (): Promise<Pipelane[]> => {
                let pls = await db.get(TableName.PS_PIPELANE, {})
                return pls
            },
            pipelaneTasks: async (parent, arg): Promise<Pipetask[]> => {
                let pls = await db.get(TableName.PS_PIPELANE_TASK,
                    { pipelaneName: arg.pipelaneName })
                return pls
            },
        },
        Mutation: {

            async createPipelaneTask(parent: any, request: { data: CreatePipetaskPayload }) {
                let input = request.data
                let existing = await db.getOne(TableName.PS_PIPELANE_TASK,
                    {
                        name: input.name,
                        pipelaneName: input.pipelaneName
                    }) as Pipetask
                let isUpdate = existing != undefined
                if (!isUpdate)
                    existing = {} as Pipetask
                Object.assign(existing, input)
                if (isUpdate)
                    await db.update(TableName.PS_PIPELANE_TASK, {
                        name: input.name,
                        pipelaneName: input.pipelaneName
                    }, existing)
                else
                    await db.insert(TableName.PS_PIPELANE_TASK, existing)
                return existing
            },
            async createPipelane(parent: any, request: { data: CreatePipelanePayload }) {
                let input = request.data
                let tasks = request.data.tasks || []
                let existing = await db.getOne(TableName.PS_PIPELANE, { name: input.name }) as Pipelane
                let isUpdate = existing != undefined
                if (!isUpdate)
                    existing = {} as Pipelane
                let pl = Object.assign(existing, request.data)
                delete existing.tasks

                existing.schedule = existing.schedule.trim()
                existing.retryCount = existing.retryCount || 0
                existing.executionsRetentionCount = existing.executionsRetentionCount || 0
                existing.updatedTimestamp = `${Date.now()}`
                cronScheduler?.addToSchedule(existing)
                await Promise.all([
                    isUpdate ? db.update(TableName.PS_PIPELANE, {
                        name: input.name
                    }, existing)
                        : db.insert(TableName.PS_PIPELANE, existing)
                    , ...tasks.map(async (tk) => {
                        tk.pipelaneName = input.name
                        PipelaneResolvers.Mutation.createPipelaneTask(tk, { data: tk })
                    })])
                return pl
            },
            async deletePipelane(parent, request: { name: string }) {
                await db.delete(TableName.PS_PIPELANE, { name: request.name })
                await db.delete(TableName.PS_PIPELANE_TASK, { pipelaneName: request.name })
                return 'SUCCESS'
            },
            async deletePipelaneTask(parent, request: { name: string, pipelaneName: string }) {
                await db.delete(TableName.PS_PIPELANE_TASK, {
                    name: request.name,
                    pipelaneName: request.pipelaneName
                })
                return 'SUCCESS'
            }
        }
    }
    return PipelaneResolvers
}
