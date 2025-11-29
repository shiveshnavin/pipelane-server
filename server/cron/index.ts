//@ts-ignore
import PipeLane, { VariablePipeTask, TaskVariantConfig } from "pipelane";
import { PipelaneExecution, PipelaneExecutionPayload, Pipelane as PipelaneSchedule, Status } from "../../gen/model";
import { Cron } from "croner";
import * as NodeCron from 'node-cron'
import { generatePipelaneResolvers } from "../graphql/pipelane";
import AsyncLock from 'async-lock';
import { EvaluateJsTask } from "../pipe-tasks/EvaluateJsTask";
import axios from "axios";
import { existsSync, rmdirSync, unlinkSync } from "fs";
import { mapStatus } from "../graphql/utils";

// only uncomment for code completions during dev
// const pipelaneResolver = generatePipelaneResolvers(undefined, undefined)

export class CronScheduler {
    stopped: boolean = false
    cronJobs: { name: string, job: Cron }[] = []
    schedules: PipelaneSchedule[] = []
    currentExecutions: PipeLane[] = []
    executionsCache: PipeLane[] = []
    maxCacheSize = 200
    pipelaneResolver // = pipelaneResolver
    variantConfig: TaskVariantConfig
    pipelaneLogLevel: 0 | 1 | 2 | 3 | 4 | 5

    constructor(variantConfig: TaskVariantConfig, pipelaneLogLevel?: 0 | 1 | 2 | 3 | 4 | 5, maxCacheSize = 200) {
        this.variantConfig = variantConfig
        this.pipelaneLogLevel = pipelaneLogLevel != undefined ? pipelaneLogLevel : 2
        this.maxCacheSize = maxCacheSize
    }

    async getPipelaneDefinition(pipeName: string, existing?: PipelaneSchedule): Promise<PipelaneSchedule | undefined> {
        let pipelane = existing || (await this.pipelaneResolver.Query.Pipelane({}, {
            name: pipeName
        }))
        if (!pipelane)
            return undefined
        pipelane.tasks = existing.tasks || (await this.pipelaneResolver.Query.pipelaneTasks({}, {
            pipelaneName: pipeName
        })) || []
        return pipelane as PipelaneSchedule
    }

    init(initialSchedules: PipelaneSchedule[],
        pipelaneResolver: any) {
        this.schedules = initialSchedules
        this.pipelaneResolver = pipelaneResolver
    }

    stopJob(name: String) {
        try {
            let existingJob = this.cronJobs.find(cj => name == cj.name)
            if (existingJob) {
                existingJob.job?.stop()
            }

            let existingExecs = this.currentExecutions.find(ce => {
                let execName = ce.name
                let parts = execName.split("-")
                let pname = parts.slice(0, parts.length - 1)?.join("-")
                return name == pname
            })
            if (existingExecs) {
                existingExecs.stop()
            }
        } catch (e) {
            console.error(`Tolerable error stopping ${name}. ` + e.message)
        }
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
        let cronJob = new Cron(pl.schedule, (() => {
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
        let pipelaneBluePrint = await this.getPipelaneDefinition(pl.name, pl)
        if (!pipelaneBluePrint) {
            console.warn(`No definition found for ${pl.name}`)
            return
        }
        pl = pipelaneBluePrint
        if (input) {
            pl.input = input
        }
        if (pl.active) {
            let pipeWorksInstance = new PipeLane(this.variantConfig, pl.name)
            pipeWorksInstance.logLevel = this.pipelaneLogLevel
            let pipelaneInstName = `${pl.name}-${Date.now()}`
            let pipelaneFolderPath = `pipelane/${pipelaneInstName}`
            let invalidTasksFromSchedule = pl.tasks?.filter(pt => this.variantConfig[pt.taskTypeName] == undefined).map(t => t.taskTypeName)
            if (invalidTasksFromSchedule && invalidTasksFromSchedule.length > 0) {
                console.warn(`No tasks of types ${invalidTasksFromSchedule.join(",")} found in variantconfig. Skipping triggering ${pl.name}`)
                return
            }

            const evalPlaceHolder = new EvaluateJsTask()
            pipeWorksInstance.setOnCheckCondition(async (pInst, task, input) => {
                if (input.additionalInputs?.condition === false) {
                    return input.additionalInputs?.condition
                }
                if (input.additionalInputs?.condition) {
                    return await evalPlaceHolder.evalInScope(
                        input.additionalInputs.condition,
                        pInst,
                        input,
                        input.last,
                        axios
                    )
                }
                return true
            })
            pipeWorksInstance.setOnBeforeExecuteTask(async (pInst, task, inputProxy) => {

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
                let input = {} as any
                try {
                    input = JSON.parse(tkd.input)
                } catch (e) {
                    console.warn(`Invalid JSON input ${tkd.input} for ${pl.name} -> ${tkd.taskVariantName}. Using {} as input`)
                }

                let pltConfig: VariablePipeTask = {
                    uniqueStepName: tkd.name,
                    type: tkd.taskTypeName,
                    //@ts-ignore
                    isParallel: tkd.isParallel === true || tkd.isParallel === 'true',
                    numberOfShards: input.numberOfShards,
                    itemsPerShard: input.itemsPerShard,
                    cutoffLoadThreshold: input.cutoffLoadThreshold,
                    variantType: (!tkd.taskVariantName || tkd.taskVariantName == 'auto') ? undefined : tkd.taskVariantName,
                    additionalInputs: input
                }
                if (tkd.isParallel === true) {
                    pipeWorksInstance.parallelPipe(pltConfig)
                } else {
                    pipeWorksInstance.pipe(pltConfig)
                }
            }
            let input: any = {}
            try {
                input = JSON.parse(pl.input)
                try {
                    let stringInput = await evalPlaceHolder.evaluatePlaceholdersInString(
                        pipeWorksInstance,
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
                        if (this.pipelaneLogLevel > 0)
                            console.warn(`[pipelane-server] ${pl.name} failed. Retrying. Retry count left: ${retryCountLeft}`)
                        //@ts-ignore
                        pipeWorksInstance.currentTaskIdx = 0
                        //@ts-ignore
                        pipeWorksInstance.executedTasks = []
                        pipeWorksInstance.start(input).then(onResult)
                        return
                    } else {
                        if (this.pipelaneLogLevel > 0)
                            console.log(`[pipelane-server] ${pl.name} failed`)
                        status = Status.Failed
                    }

                } else {
                    if (this.pipelaneLogLevel > 0)
                        console.log(`[pipelane-server] ${pl.name} success`)
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
                this.currentExecutions = (this.currentExecutions as PipeLane[]).filter(cei => cei.instanceId != pipeWorksInstance.instanceId)
            }).bind(this)

            let runningInstances = this.currentExecutions.filter(cei => (cei.name == pipeWorksInstance.name))
            let plx: PipelaneExecution = await this.pipelaneResolver.Mutation.createPipelaneExecution({}, {
                data: {
                    name: pl.name,
                    definition: pl,
                    startTime: `${Date.now()}`,
                    status: Status.Paused,
                    id: pipelaneInstName,
                    output: JSON.stringify({
                        queue: runningInstances.length + 1
                    })
                } as PipelaneExecutionPayload
            })

            this.listenToPipe(pipeWorksInstance, plx)

            pipeWorksInstance.instanceId = pipelaneInstName;

            if (input.resumable)
                pipeWorksInstance.enableCheckpoints(pipelaneInstName, pipelaneFolderPath)

            const run = () => {
                console.log(`[pipelane-server] Queuing pipelane ${pl.name} with instance id ${pipeWorksInstance.instanceId}. Current queue  = ${runningInstances.length + 1}`)
                this.acquirePipelineSlot(pl.name).then((release) => {
                    this.pipelaneResolver.Mutation.createPipelaneExecution({}, {
                        data: {
                            endTime: `${Date.now()}`,
                            status: Status.InProgress,
                            id: plx.id,
                            output: plx.output
                        }
                    })
                    pipeWorksInstance.start(input).then(onResult).catch((e) => {
                        console.error(`${pl.name} failed. Retrying. Retry count left: ${retryCountLeft}. Error = ${e.message}`)
                        onResult([{ status: false }])
                    }).finally(() => {
                        release()
                        if (existsSync(pipelaneFolderPath)) {
                            rmdirSync(pipelaneFolderPath, { recursive: true });
                        }
                    })
                })
            }
            run()
            this.currentExecutions.push(pipeWorksInstance)
            this.executionsCache.push(pipeWorksInstance)
            if (this.executionsCache.length > this.maxCacheSize) {
                this.executionsCache.shift()
            }

            return plx
        }

        return undefined
    }



    pipelineLocks: Map<string, Promise<void>> = new Map()
    private async acquirePipelineSlot(pipelineName: string): Promise<() => void> {
        while (this.pipelineLocks.has(pipelineName)) {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 100));
            await this.pipelineLocks.get(pipelineName)
        }
        let resolver: (() => void) | undefined
        let released = false
        const lockPromise = new Promise<void>((resolve) => {
            resolver = resolve
        })
        this.pipelineLocks.set(pipelineName, lockPromise)
        return () => {
            if (released)
                return
            released = true
            if (this.pipelineLocks.get(pipelineName) === lockPromise) {
                this.pipelineLocks.delete(pipelineName)
            }
            resolver && resolver()
        }
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
                    let taskId = `${plx.id}::${task.variantType}::${taskName}`
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
                } else if (event == 'TASK_FINISHED' || event == 'SKIPPED') {
                    let taskName = task.uniqueStepName || task.variantType
                    let taskId = `${plx.id}::${task.variantType}::${taskName}`
                    let status = mapStatus(event, output)
                    const jsonStr = JSON.stringify(output)
                    await this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                        //@ts-ignore
                        data: {
                            name: task.uniqueStepName || task.variantType || task.type,
                            pipelaneName: plx.name,
                            pipelaneExId: plx.id,
                            id: taskId,
                            endTime: `${Date.now()}`,
                            status: status,
                            output: jsonStr
                        }
                    }).catch(async (ebase) => {
                        console.error('Error saving pipelane task. Trying to save with base64 output.')
                        const base64op = 'base64;' + Buffer.from(jsonStr).toString('base64')
                        await this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                            //@ts-ignore
                            data: {
                                id: taskId,
                                endTime: `${Date.now()}`,
                                status: mapStatus(event, output),
                                output: base64op
                            }
                        }).catch(async (e) => {
                            console.error('Error saving pipelane task. Trying to save without output.')
                            await this.pipelaneResolver.Mutation.createPipelaneTaskExecution({}, {
                                //@ts-ignore
                                data: {
                                    id: taskId,
                                    endTime: `${Date.now()}`,
                                    status: mapStatus(event, output),
                                    output: 'Unsupported Output'
                                }
                            }).catch(e => {
                                console.error('Error saving pipelane.', event, e.message)
                            })
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


    validateCronString(cronString: string) {
        return NodeCron.validate(cronString)
    }

    getNextRun(cronExpression: string) {
        let timestamp = new Date()
        const adjustedTimestamp = new Date(timestamp.getTime() - 1000);
        const timeZone = ['Asia/Calcutta', 'Asia/Kolkata']
            .includes(Intl.DateTimeFormat().resolvedOptions().timeZone) ? undefined : 'Asia/Kolkata'
        const cronJob = new Cron(cronExpression, {
            timezone: timeZone
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
        return runningPipe == undefined || !runningPipe.isRunning
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