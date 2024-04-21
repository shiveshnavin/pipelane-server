import PipeLane, { VariablePipeTask } from "pipelane";
import { PipelaneExecution, Pipelane as PipelaneSchedule, Status } from "../../gen/model";
import Cron from "croner";
import * as NodeCron from 'node-cron'
import { VariantConfig } from "../pipe-tasks";
import { generatePipelaneResolvers } from "../graphql/pipelane";
const pipelaneResolver = generatePipelaneResolvers(undefined, undefined)

export class CronScheduler {
    stopped: boolean = false
    cronJobs: { name: string, job: Cron }[] = []
    schedules: PipelaneSchedule[] = []
    currentExecutions: PipeLane[] = []
    pipelaneResolver = pipelaneResolver

    async getPipelaneDefinition(pipeName): Promise<PipelaneSchedule | undefined> {
        let pipelane = await this.pipelaneResolver.Query.Pipelane({}, {
            name: pipeName
        })
        if (!pipelane)
            return undefined
        pipelane.tasks = await this.pipelaneResolver.Query.pipelaneTasks({}, {
            pipelaneName: pipeName
        }) || []
        return pipelane as PipelaneSchedule
    }

    init(initialSchedules: PipelaneSchedule[], pipelaneResolver: any) {
        this.schedules = initialSchedules
        this.pipelaneResolver = pipelaneResolver
    }

    stopAll() {
        this.cronJobs.forEach(job => job.job.stop())
        this.currentExecutions.forEach(cn => cn.stop())
    }

    startAll() {
        this.stopAll()
        this.schedules.forEach(this.schedulePipelaneCronjob.bind(this))
    }

    addToSchedule(pl: PipelaneSchedule) {
        this.schedules = this.schedules.filter(scp => scp.name != pl.name)
        this.schedules.push(pl)
        this.schedulePipelaneCronjob(pl)
    }

    findScheduledJob(pl: PipelaneSchedule) {
        return this.cronJobs.find(p => p.name == pl.name)
    }

    schedulePipelaneCronjob(pl: PipelaneSchedule) {
        let existing = this.findScheduledJob(pl)
        let cronJob = Cron(pl.schedule, (() => {
            this.triggerPipelane(pl).catch(e => {
                console.error(`Fatal error triggering pipelane ${pl.name}. ` + e.message)
            })
        }).bind(this))
        if (existing) {
            existing.job.stop()
            existing.job = cronJob
        } else {
            this.cronJobs.push({
                name: pl.name,
                job: cronJob
            })
        }
    }

    async triggerPipelane(pl: PipelaneSchedule, input?: string): Promise<PipelaneExecution | undefined> {
        if (this.stopped) {
            console.warn(`Executor is stopped, skip triggering ${pl.name}`)
            return
        }
        let pipelaneBluePrint = await this.getPipelaneDefinition(pl.name)
        if (!pipelaneBluePrint) {
            console.warn(`No definition found for ${pl.name}`)
            return
        }
        pl = pipelaneBluePrint
        if (input) {
            pl.input = input
        }
        if (pl.active) {
            let pipelaneInstance = new PipeLane(VariantConfig)
            let pipelaneInstName = `${pl.name}-${Date.now()}`
            pipelaneInstance.enableCheckpoints(pipelaneInstName, `pipelane/${pipelaneInstName}`)
            let invalidTasksFromSchedule = pl.tasks?.filter(pt => VariantConfig[pt.taskTypeName] == undefined).map(t => t.taskTypeName)
            if (invalidTasksFromSchedule && invalidTasksFromSchedule.length > 0) {
                console.warn(`No tasks of types ${invalidTasksFromSchedule.join(",")} found in variantconfig. Skipping triggering ${pl.name}`)
                return
            }
            pl.tasks.filter(t => t.active).forEach(tkd => {
                let input = {}
                try {
                    // todo: resolve placeholders
                    input = JSON.parse(tkd.input)
                } catch (e) {
                    console.warn(`Invalid JSON input ${tkd.input} for ${pl.name} -> ${tkd.taskVariantName}. Using {} as input`)
                }

                let pltConfig: VariablePipeTask = {
                    uniqueStepName: tkd.name,
                    type: tkd.taskTypeName,
                    variantType: tkd.taskVariantName,
                    additionalInputs: input
                }
                if (tkd.isParallel) {
                    pipelaneInstance.parallelPipe(pltConfig)
                } else {
                    pipelaneInstance.pipe(pltConfig)
                }
            })
            let input = {}
            try {
                // todo: resolve placeholders
                input = JSON.parse(pl.input)
            } catch (e) {
                console.warn(`Invalid JSON input ${pl.input} for ${pl.name}. Using {} as input`)
            }
            let retryCountLeft = pl.retryCount
            let onResult = (function (results) {
                if (results == undefined || results[0].status == false) {
                    if (retryCountLeft-- > 0) {
                        console.warn(`Pipe:${pl.name} failed. Retrying. Retry count left: ${retryCountLeft}`)
                        //@ts-ignore
                        pipelaneInstance.currentTaskIdx = 0
                        //@ts-ignore
                        pipelaneInstance.executedTasks = []
                        pipelaneInstance.start(input).then(onResult)
                        return
                    } else {
                        console.log(`Pipe:${pl.name} failed`)
                    }

                } else {
                    console.log(`Pipe:${pl.name} success`)
                }

                //@ts-ignore
                this.currentExecutions = this.currentExecutions.filter(cei => cei.name != pipelaneInstance.name)
            }).bind(this)

            let plx: PipelaneExecution = await this.pipelaneResolver.Mutation.createPipelaneExecution({}, {
                data: {
                    name: pl.name,
                    definition: pl,
                    startTime: `${Date.now()}`,
                    status: Status.InProgress,
                    id: undefined,
                }
            })

            const pipelaneListener = ((pl, event, task, output) => {
                if (event == 'COMPLETE') {
                    this.pipelaneResolver.Mutation.createPipelaneExecution({}, {
                        //@ts-ignore
                        data: {
                            endTime: `${Date.now()}`,
                            status: this.mapStatus(output),
                            id: plx.id,
                            name: plx.name,
                            output: JSON.stringify(output)
                        }
                    })
                } else if (event == 'KILLED') {
                    this.pipelaneResolver.Mutation.createPipelaneExecution({}, {
                        //@ts-ignore
                        data: {
                            endTime: `${Date.now()}`,
                            status: Status.Failed,
                            id: plx.id,
                            output: JSON.stringify(output)
                        }
                    })
                } else if (event == 'NEW_TASK') {
                    let taskName = task.uniqueStepName || task.variantType
                    this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                        //@ts-ignore
                        data: {
                            pipelaneExId: plx.id,
                            name: taskName,
                            startTime: `${Date.now()}`,
                            status: Status.InProgress,
                            output: output
                        }
                    })
                } else if (event == 'TASK_FINISHED') {
                    let taskName = task.uniqueStepName || task.variantType
                    let taskId = `${plx.id}::${taskName}`
                    this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                        //@ts-ignore
                        data: {
                            id: taskId,
                            endTime: `${Date.now()}`,
                            status: this.mapStatus(output),
                            output: JSON.stringify(output)
                        }
                    })
                }
            }).bind(this)
            pipelaneInstance.setListener(pipelaneListener)
            pipelaneInstance.start(input).then(onResult).catch((e) => {
                console.error(`${pl.name} failed. Retrying. Retry count left: ${retryCountLeft}. Error = ${e.message}`)
                onResult([{ status: false }])
            })
            this.currentExecutions.push(pipelaneInstance)

            return plx
        }

        return undefined
    }

    private mapStatus(output: ({ status: Status } & any)[]) {

        let isAtleaseOneFail = (output as any[] || []).find(o => !o.status)
        let isAtleaseOneSuccess = (output as any[] || []).find(o => o.status)
        let status = Status.Success
        if (isAtleaseOneFail) {
            status = Status.PartialSuccess
        }
        if (!isAtleaseOneSuccess) {
            status = Status.Failed
        }
        return status
    }

    validateCronString(cronString: string) {
        return NodeCron.validate(cronString)
    }

    getNextRun(cronExpression: string) {
        let timestamp = new Date()
        const adjustedTimestamp = new Date(timestamp.getTime() - 1000);
        const cronJob = new Cron(cronExpression, {
            timezone: 'Asia/Kolkata'
        });
        const nextRunTime = cronJob.nextRun(adjustedTimestamp);
        return nextRunTime
    }

    isPipeRunnable(schedule: PipelaneSchedule) {
        if (!schedule.schedule) {
            console.warn(`No schedule found for`, schedule.name, 'skipping')
            return
        }
        let runningPipe: PipeLane = this.currentExecutions.find(ex => `${ex.name}`.startsWith(schedule.name))
        return runningPipe == undefined && !runningPipe.isRunning
    }
}

/**
 * @param {string} cronExpression The cron expression. See https://croner.56k.guru/usage/pattern/
 * @param {Date} [timestamp] The timestamp to check. Defaults to the current time.
 * @returns {Number} The number of seconds until the next cron run.
 */
export function getSecondsUntilNextCronRun(cronExpression, timestamp = new Date()) {
    const adjustedTimestamp = new Date(timestamp.getTime() - 1000);
    const cronJob = new Cron(cronExpression, {
        timezone: 'Asia/Kolkata'
    });
    const nextRunTime = cronJob.nextRun(adjustedTimestamp);
    const secondsDelta = (nextRunTime.getTime() - adjustedTimestamp.getTime()) / 1000;
    return secondsDelta;
}