import { z } from "zod";

/**
 * Enriched Zod schema for a single Pipetask inside a Pipelane.
 *
 * A Pipetask is one step in a pipelane workflow.
 * Each task runs a specific variant of a task type (e.g. ShellTask:default).
 *
 * Call check-available-tasks then get-task-variations to discover valid
 * taskTypeName / taskVariantName values before building tasks.
 */
export const PipetaskSchema = z.object({

    name: z.string().describe(
        "Unique name/identifier for this task step within the pipelane. E.g. 'fetch-data', 'send-email'."
    ),

    pipelaneName: z.string().describe(
        "Name of the pipelane this task belongs to. Must match the parent pipelane's name field exactly."
    ),

    taskTypeName: z.string().describe(
        "The task type identifier. Use check-available-tasks to list all available types. E.g. 'ShellTask', 'HttpTask', 'SubPipelaneTask'."
    ),

    taskVariantName: z.string().default("auto").describe(
        "Variant name for the task type. Defaults to 'auto'. Use get-task-variations to list available variants for a taskTypeName."
    ),

    step: z.number().int().optional().describe(
        "Execution order (0-indexed). Optional — auto-generated as the last step if omitted. Tasks run in ascending step order. Tasks sharing the same step value with isParallel=true run concurrently."
    ),

    isParallel: z.boolean().optional().describe(
        "If true, this task runs concurrently with other tasks at the same step number. Default is false (sequential)."
    ),

    active: z.boolean().describe(
        "Whether this task is enabled. Inactive tasks are skipped during execution. Reccomended behaviour is to Set this to true while creating"
    ),

    input: z.string().describe(
        "Required JSON string of task-specific configuration inputs. Use get-task-definition to discover required fields for a given taskTypeName. E.g. for ShellTask: '{\"command\": \"echo hello\"}'. Pass '{}' if no inputs needed."
    ),
});

/**
 * Enriched Zod schema for creating or updating a Pipelane.
 *
 * A Pipelane is a named workflow consisting of ordered Pipetasks.
 * It can be scheduled via cron or triggered manually via trigger-pipelane-execution.
 *
 * Providing the name of an existing pipelane will UPDATE it (upsert behaviour).
 * To rename a pipelane use the rename-pipelane tool instead.
 */
export const CreatePipelaneSchema = z.object({

    name: z.string().describe(
        "Required. Unique name/ID for the pipelane (primary key). Alphanumeric, hyphens or underscores. If a pipelane with this name already exists it will be updated (upsert). E.g. 'daily-report', 'sync-users'."
    ),

    input: z.string().describe(
        "Required. JSON string of default runtime inputs passed to all tasks. Must be valid JSON. Use '{}' if no inputs needed. E.g. '{\"env\": \"production\", \"limit\": 100}'. Pass '{}' if no inputs needed."
    ),

    schedule: z.string().describe(
        "Required. 5-field cron expression for automatic scheduling (min hour day month weekday). Examples: '0 9 * * 1-5' = weekdays 9AM, '*/30 * * * *' = every 30 minutes, '0 0 1 * *' = first of month midnight. Use empty string '' for manual-only execution."
    ),

    active: z.boolean().describe(
        "Required. Whether the cron schedule is active. Set false to pause automatic runs without removing the schedule. Manual triggers via trigger-pipelane-execution still work either way. Reccomended behaviour is to Set this to true while creating"
    ),

    retryCount: z.number().int().optional().describe(
        "Number of automatic retries if the pipelane fails. 0 = no retries (default). Each retry restarts the full pipelane from the beginning."
    ),

    executionsRetentionCount: z.number().int().optional().describe(
        "Max number of past execution records to retain in history. Older records are auto-pruned. Default is 50."
    ),

    tasks: z.array(PipetaskSchema).optional().describe(
        "Array of task definitions to upsert alongside this pipelane. Each task requires: name, pipelaneName (must match this pipelane name), taskTypeName, step, input. Recommended workflow: check-available-tasks to get valid taskTypeNames, get-task-variations for variants, get-task-definition for the correct input schema."
    ),
});

export type CreatePipelaneInput = z.infer<typeof CreatePipelaneSchema>;
export type PipetaskInput = z.infer<typeof PipetaskSchema>;
