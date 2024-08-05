import { TaskVariantConfig } from "pipelane";
import { ApiTask } from "./ApiTask";
import { ShellTask } from "./ShellTask";
import { DelayTask } from "./DelayTask";
import { EvaluateJsTask } from "./EvaluateJsTask";
import { LoopApiTask } from "./LoopApiTask";
import { LoopEvaluateJsTask } from "./LoopEvaluateJsTask";
import { WriteFileTask } from "./WriteFileTask";

export const VariantConfig: TaskVariantConfig = {
    [ApiTask.TASK_TYPE_NAME]: [new ApiTask(ApiTask.TASK_VARIANT_NAME), new LoopApiTask(LoopApiTask.TASK_VARIANT_NAME)],
    [ShellTask.TASK_TYPE_NAME]: [new ShellTask(ShellTask.TASK_VARIANT_NAME, ["*"])],
    [DelayTask.TASK_TYPE_NAME]: [new DelayTask(DelayTask.TASK_VARIANT_NAME)],
    [EvaluateJsTask.TASK_TYPE_NAME]: [new EvaluateJsTask(EvaluateJsTask.TASK_VARIANT_NAME),new LoopEvaluateJsTask(LoopEvaluateJsTask.TASK_VARIANT_NAME)],
    [WriteFileTask.TASK_TYPE_NAME]: [new WriteFileTask(WriteFileTask.TASK_VARIANT_NAME)],
}

export * from './'