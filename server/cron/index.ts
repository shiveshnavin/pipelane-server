//@ts-ignore
import PipeLane, { VariablePipeTask, TaskVariantConfig } from "pipelane";
import { PipelaneExecution, Pipelane as PipelaneSchedule, Status } from "../../gen/model";
import Cron from "croner";
import * as NodeCron from 'node-cron'
import { generatePipelaneResolvers } from "../graphql/pipelane";
import AsyncLock from 'async-lock';
import { EvaluateJsTask } from "../pipe-tasks/EvaluateJsTask";

const pipelaneResolver = generatePipelaneResolvers(undefined, undefined)

export class CronScheduler {
    stopped: boolean = false
    cronJobs: { name: string, job: Cron }[] = []
    schedules: PipelaneSchedule[] = []
    currentExecutions: PipeLane[] = []
    pipelaneResolver = pipelaneResolver
    variantConfig: TaskVariantConfig

    constructor(variantConfig: TaskVariantConfig) {
        this.variantConfig = variantConfig
    }

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

    init(initialSchedules: PipelaneSchedule[],
        pipelaneResolver: any) {
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
            let pipelaneInstance = new PipeLane(this.variantConfig)
            let pipelaneInstName = `${pl.name}-${Date.now()}`
            pipelaneInstance.enableCheckpoints(pipelaneInstName, `pipelane/${pipelaneInstName}`)
            let invalidTasksFromSchedule = pl.tasks?.filter(pt => this.variantConfig[pt.taskTypeName] == undefined).map(t => t.taskTypeName)
            if (invalidTasksFromSchedule && invalidTasksFromSchedule.length > 0) {
                console.warn(`No tasks of types ${invalidTasksFromSchedule.join(",")} found in variantconfig. Skipping triggering ${pl.name}`)
                return
            }

            const evalPlaceHolder = new EvaluateJsTask()
            pipelaneInstance.setOnBeforeExecuteTask(async (pInst, task, inputProxy) => {

                try {
                    let stringInput = await evalPlaceHolder.evaluatePlaceholdersInString(
                        pInst,
                        inputProxy,
                        JSON.stringify(inputProxy.additionalInputs)
                    )
                    inputProxy.additionalInputs = JSON.parse(stringInput)
                } catch (e) {
                    console.warn(`error evaluating placeholders in -> ${task.getTaskVariantName()}. ` + e.message)
                }

                return inputProxy
            })
            for (const tkd of pl.tasks.filter(t => t.active)) {
                let input = {}
                try {
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
            }
            let input = {}
            try {
                input = JSON.parse(pl.input)
                try {
                    let stringInput = await evalPlaceHolder.evaluatePlaceholdersInString(
                        pipelaneInstance,
                        JSON.parse(pl.input),
                        pl.input
                    )
                    input = JSON.parse(stringInput)
                } catch (e) {
                    console.warn(`error evaluating placeholders in -> ${pl.name}.`)
                    input = JSON.parse(pl.input)
                }
            } catch (e) {
                console.warn(`Invalid JSON input ${pl.input} for ${pl.name}. Using {} as input`)
            }
            let retryCountLeft = pl.retryCount
            let onResult = (function (output) {
                let status = Status.InProgress
                if (output == undefined || output[0].status == false) {
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
                        status = Status.Failed
                    }

                } else {
                    console.log(`Pipe:${pl.name} success`)
                    status = Status.Success
                }
                this.pipelaneResolver.Mutation.createPipelaneExecution({}, {
                    //@ts-ignore
                    data: {
                        endTime: `${Date.now()}`,
                        status: status,
                        id: plx.id,
                        output: JSON.stringify(output)
                    }
                }).catch(e => {
                    console.error('Error saving pipelane. Trying to save without output')
                    this.pipelaneResolver.Mutation.createPipelaneExecution({}, {
                        //@ts-ignore
                        data: {
                            endTime: `${Date.now()}`,
                            status: status,
                            id: plx.id,
                            output: 'Unsupported output.'
                        }
                    }).catch(e => {
                        console.error('Error saving pipelane', event, e.message)
                    })
                })
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

            this.listenToPipe(pipelaneInstance, plx)
            pipelaneInstance.start(input).then(onResult).catch((e) => {
                console.error(`${pl.name} failed. Retrying. Retry count left: ${retryCountLeft}. Error = ${e.message}`)
                onResult([{ status: false }])
            })
            this.currentExecutions.push(pipelaneInstance)

            return plx
        }

        return undefined
    }

    private lock: AsyncLock = new AsyncLock()
    public listenToPipe(
        pipelaneInstance: PipeLane,
        plx: PipelaneExecution,
        onResult?: (output: ({ status: Status } & any)[]) => void) {


        const pipelaneListener = (async (pl, event, task, output) => {
            this.lock.acquire(plx.id, (async () => {

                if (event == 'NEW_TASK') {
                    let taskName = task.uniqueStepName || task.variantType || task.type
                    let taskId = `${plx.id}::${taskName}`
                    await this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                        //@ts-ignore
                        data: {
                            id: taskId,
                            pipelaneExId: plx.id,
                            name: taskName,
                            pipelaneName: plx.name,
                            startTime: `${Date.now()}`,
                            status: Status.InProgress,
                            output: output
                        }
                    }).catch(e => {
                        console.error('Error saving pipelane task', event, e.message)
                    })
                } else if (event == 'TASK_FINISHED') {
                    let taskName = task.uniqueStepName || task.variantType
                    let taskId = `${plx.id}::${taskName}`
                    let status = this.mapStatus(output)
                    await this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                        //@ts-ignore
                        data: {
                            name: task.uniqueStepName || task.variantType || task.type,
                            pipelaneName: plx.name,
                            pipelaneExId: plx.id,
                            id: taskId,
                            endTime: `${Date.now()}`,
                            status: status,
                            output: JSON.stringify(output)
                        }
                    }).catch(async (e) => {
                        console.error('Error saving pipelane task. Trying to save without output.')
                        await this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                            //@ts-ignore
                            data: {
                                id: taskId,
                                endTime: `${Date.now()}`,
                                status: this.mapStatus(output),
                                output: 'Unsupported Output'
                            }
                        }).catch(e => {
                            console.error('Error saving pipelane.', event, e.message)
                        })
                    })
                } else if (event == 'COMPLETE') {
                    if (onResult) {
                        await new Promise((resolve) => {
                            onResult(output)
                        }).catch(e => {
                            console.log("error calling onResult. " + e.message)
                        })
                    }
                }
            }).bind(this))

        }).bind(this)

        pipelaneInstance.setListener(pipelaneListener)
    }

    public mapStatus(output: ({ status: Status } & any)[]) {

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