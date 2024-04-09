import { TaskVariantConfig } from "pipelane";
import { ApiTask } from "./ApiTask";

export const VariantConfig: TaskVariantConfig = {
    [ApiTask.TASK_TYPE_NAME]: [new ApiTask('api-call-a'), new ApiTask('api-call-b')]
}