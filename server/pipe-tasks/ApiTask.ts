import PipeLane, { PipeTask } from "pipelane";

export class ApiTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "api"
    static TASK_TYPE_NAME: string = "api"

    constructor(variantName?: string) {
        super(ApiTask.TASK_TYPE_NAME, variantName || ApiTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        throw new Error("Method not implemented.");
    }
    execute(pipeWorkInstance: PipeLane, inputs: any): Promise<any[]> {
        throw new Error("Method not implemented.");
    }

}