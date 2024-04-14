import PipeLane from "pipelane";
import { Pipelane as PipelaneSchedule } from "../../gen/model";
import Cron from "croner";
import * as NodeCron from 'node-cron'
import { VariantConfig } from "../pipe-tasks";
export class CronScheduler {
    stopped: boolean = false
    cronJobs: { name: string, job: Cron }[] = []
    schedules: PipelaneSchedule[] = []
    currentExecutions: PipeLane[] = []
    getPipelaneDefinition: (name) => Promise<PipelaneSchedule>

    init(initialSchedules: PipelaneSchedule[],
        getPipelaneDefinition: (name) => Promise<PipelaneSchedule>) {
        this.schedules = initialSchedules
        this.getPipelaneDefinition = getPipelaneDefinition
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
            this.triggerPipelane(pl)
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

    async triggerPipelane(pl: PipelaneSchedule) {
        let pipelaneBluePrint = await this.getPipelaneDefinition(pl.name)
        if (!pipelaneBluePrint) {
            console.warn(`No definition found for ${pl.name}`)
            return
        }
        pl = pipelaneBluePrint
        if (pl.active) {
            let pipelaneInstance = new PipeLane(VariantConfig)
            let pipelaneInstName = `${pl.name}-${Date.now()}`
            pipelaneInstance.enableCheckpoints(pipelaneInstName, `pipelane/${pipelaneInstName}`)
            let nonExistingTask = pl.tasks?.filter(pt => VariantConfig[pt.taskTypeName] == undefined).map(t => t.taskTypeName)
            if (nonExistingTask && nonExistingTask.length > 0) {
                console.warn(`No tasks of types ${nonExistingTask.join(",")} found in variantconfig. Skipping triggering ${pl.name}`)
                return
            }
            pl.tasks.forEach(tkd => {
                let input = {}
                try {
                    // todo: resolve placeholders
                    input = JSON.parse(tkd.input)
                } catch (e) {
                    console.warn(`Invalid JSON input ${tkd.input} for ${pl.name} -> ${tkd.taskVariantName}. Using {} as input`)
                }

                let pltConfig = {
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
            // todo: save Execution
            pipelaneInstance.start(input).then(onResult).catch((e) => {
                console.error(`${pl.name} failed. Retrying. Retry count left: ${retryCountLeft}. Error = ${e.message}`)
                onResult([{ status: false }])
            })
            this.currentExecutions.push(pipelaneInstance)
        }
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
        //@ts-ignore
        let runningPipe = this.currentExecutions.find(ex => `${ex.name}`.startsWith(schedule.name))
        //@ts-ignore
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