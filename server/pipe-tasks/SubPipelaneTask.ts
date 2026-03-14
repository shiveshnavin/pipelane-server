import PipeLane, { PipeTask, InputWithPreviousInputs, OutputWithStatus } from "pipelane";
import { CronScheduler, PipelaneExecutionListener } from "../cron";
import { Status } from "../../gen/model";

export type SubPipelaneInput = InputWithPreviousInputs & {
    last?: any[]
    additionalInputs?: any
}

export class SubPipelaneTask extends PipeTask<SubPipelaneInput, any> {
    static TASK_VARIANT_NAME: string = "sub-pipelane"
    static TASK_TYPE_NAME: string = "sub-pipelane"

    cron: CronScheduler
    // waiting map for child instanceId -> { resolve }
    private waiting: Map<string, { resolve: (val: any) => void }> = new Map()

    constructor(cronScheduler: CronScheduler, variantName?: string) {
        super(SubPipelaneTask.TASK_TYPE_NAME, variantName || SubPipelaneTask.TASK_VARIANT_NAME)
        this.cron = cronScheduler

        const listener: PipelaneExecutionListener = (pipelaneInstance, event, task, output, plx) => {
            try {
                // if any waiter is waiting for this instanceId, resolve them
                const iid = pipelaneInstance.instanceId
                if (iid && this.waiting.has(iid)) {
                    const waiter = this.waiting.get(iid)
                    if (waiter) {
                        // resolve with full payload including event and output
                        waiter.resolve({ event, output, plx })
                        this.waiting.delete(iid)
                    }
                }

                const parentId = pipelaneInstance.inputs?.parentPipeInstanceId
                if (parentId) {
                    // map to status
                    let mappedStatus: Status | undefined = undefined
                    if (event === 'KILLED') {
                        mappedStatus = Status.Skipped
                    } else if (event === 'COMPLETE') {
                        // determine success/fail from output
                        try {
                            const o0 = (output && Array.isArray(output)) ? output[0] : undefined
                            if (o0 && o0.status === false) mappedStatus = Status.Failed
                            else mappedStatus = Status.Success
                        } catch (e) {
                            mappedStatus = Status.Success
                        }
                    } else if (event === 'TASK_FINISHED') {
                        // ignore
                    }

                    if (mappedStatus) {
                        // update parent's execution record in DB using pipelaneResolver if available
                        try {
                            const resolver: any = (this.cron as any).pipelaneResolver
                            if (resolver && resolver.Mutation && resolver.Mutation.createPipelaneExecution) {
                                resolver.Mutation.createPipelaneExecution({}, {
                                    data: {
                                        id: parentId,
                                        status: mappedStatus,
                                        endTime: `${Date.now()}`,
                                        output: JSON.stringify(output)
                                    }
                                }).catch((e) => {
                                    console.error('[sub-pipelane] Error updating parent execution', e.message)
                                })
                            }
                        } catch (e) {
                            console.error('[sub-pipelane] Error while updating parent execution', e.message)
                        }

                        // if child failed or killed, try stopping parent instance
                        try {
                            const parentExec = (this.cron as any).currentExecutions?.find((ce: any) => ce.instanceId == parentId)
                            if (parentExec) {
                                parentExec.stop()
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }

            } catch (e) {
                console.error('[sub-pipelane] listener error', e.message)
            }
        }

        // register single listener named 'sub-pipelane-task'
        try {
            this.cron.attachListenerToPipelane('sub-pipelane-task', listener)
        } catch (e) {
            console.error('[sub-pipelane] failed to attach listener', e.message)
        }
    }

    kill(): boolean {
        return true
    }

    async execute(pipeWorksInstance: PipeLane, input: SubPipelaneInput): Promise<any[]> {
        const parentId = pipeWorksInstance.instanceId
        const items: any[] = []
        if (input.last && Array.isArray(input.last) && input.last.length > 0) {
            items.push(...input.last)
        }
        if (input.additionalInputs && input.additionalInputs.pipeName) {
            items.push(input.additionalInputs)
        }

        if (items.length === 0) {
            return [{ status: false, message: 'No sub-pipelane inputs found' }]
        }

        for (const it of items) {
            const pipeName = it.pipeName || it.name
            if (!pipeName) continue
            const childInputs = Object.assign({}, it.pipeInputs || it.input || it.trigger_inputs || it)
            // attach parent id
            childInputs.parentPipeInstanceId = parentId
            const childInstanceId = this.cron.createInstanceId(pipeName)
            try {
                await this.cron.triggerPipelaneByName(pipeName, JSON.stringify(childInputs), undefined, childInstanceId)
            } catch (e: any) {
                return [{ status: false, message: e?.message || 'trigger failed' }]
            }

            // wait for completion via waiting map
            const result = await new Promise<any>((resolve) => {
                // set waiter
                this.waiting.set(childInstanceId, { resolve })
                // no additional timeout here; rely on pipelane to finish
            })

            // interpret result
            const event = result.event
            const output = result.output
            const o0 = (output && Array.isArray(output)) ? output[0] : undefined
            const failed = (event === 'KILLED') || (o0 && o0.status === false)
            if (failed) {
                // propagate failure
                return [{ status: false, output: output }]
            }

            // if success, continue to next; capture output to return as parent output
            var lastOutput = output
        }

        return [{ status: true, output: lastOutput }]
    }
}
