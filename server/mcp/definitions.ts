import { z } from "zod";
export const PIPELANE_INSTRUCTIONS = `# Pipelane Syntax & Instructions Guide

This document serves as a reference for creating, updating, and managing workflows using the custom Pipelane backend.

## 1. Pipelane Architecture

A **Pipelane** is a sequential execution engine. It is composed of a series of **Tasks**.

- Tasks run sequentially based on their \`step\` index (0, 1, 2, ...).
- The output of step \`N\` is automatically passed as the input to step \`N+1\`.
- Both the Pipelane itself and individual tasks can accept JSON inputs.

## 2. Managing Pipelanes via MCP

Pipelanes are managed using the \`pipelane\` MCP server. Key tools include:

- \`check-available-tasks\`: Lists all registered task types on the backend.
- \`get-task-variations\` & \`get-task-definition\`: Inspects the required inputs for a specific task type.
- \`create-or-update-pipelane\`: Creates or overwrites a pipelane. Requires a JSON payload defining the entire pipeline structure and task array.
- \`trigger-pipelane-execution\`: Starts a pipelane asynchronously.
- \`get-pipelane-executions\`: Retrieves recent execution IDs.
- \`get-pipelane-execution-details\`: Retrieves the full execution log and output (highly useful for debugging failures).

## 3. Pipelane JSON Definition Structure

When creating a pipelane, the structure looks like this:

\`\`\`json
{
  "name": "my-pipeline",
  "active": true,
  "schedule": "0 0 * * *", // Cron format
  "input": "{\"global_var\": 1,  \"workspaceFolderAbsPath\": \"public/\${pl.name}\"}", // Global runtime inputs passed as a stringified JSON
  // Always set workspaceFolderAbsPath to public/\${pl.name} so each pipelane get its own workspace
  "tasks": [
    {
      "step": 0,
      "name": "step-1",
      "pipelaneName": "my-pipeline",
      "taskTypeName": "api",
      "taskVariantName": "call-rest",
      "active": true,
      "input": "{\\"url\\": \\"https://api.example.com\\", \\"method\\": \\"GET\\"}"
    }
  ]
}
\`\`\`

## 4. Common Task Types & Usage

### A. \`api\` / \`call-rest\`

Makes a single HTTP request.

- **Input JSON**: \`{"url": "...", "method": "GET", "jsonPath": "$.data"}\`
- \`jsonPath\` is optional but highly recommended to extract nested data arrays from responses.

### B. \`api\` / \`loop-call-rest\`

Makes parallel HTTP requests based on the previous step's output array.

- **Requirement**: The previous step MUST return an array of objects.
- Each object in the array MUST contain a \`url\` and \`method\` property.
- **Output**: Returns an array of HTTP response objects.
  - _Note_: The output objects contain \`status\`, \`statusCode\`, \`headers\`, and \`data\`. They do **NOT** inherit the custom fields from the previous step.

### C. \`eval-js\` / \`loop-eval-js\`

Executes custom JavaScript to transform or filter data.

- **Input JSON**: \`{"js": "async function run() { ... } run();"}\`
- **Global Variables Available in Scope**:
  - \`pl\` (Pipelane Instance): The global pipelane context. You can access outputs of any previously executed task by index. E.g., \`pl.executedTasks[0].outputs[0].my_output_field\`.
  - \`pl.inputs\`: The parsed JSON object of the global pipelane \`input\`. This is not just for gating loops—it acts as a global store/cache. You can read global inputs (e.g., \`pl.inputs.count_channels\`) or set variables here to be retrieved by later tasks. Some native tasks also store data here for later use.
  - \`input\`: The input passed to the current task. It contains \`last\` (the previous task's output) and \`additionalInputs\` (the JSON you supply in the task's input configuration). Access static inputs via \`input.additionalInputs.my_static_input\`.
  - \`prev\`: The exact output payload from the preceding task (equivalent to \`input.last\`).
  - \`axios\`: For making custom HTTP calls.
  - \`Utils\`: Utility functions, such as \`Utils.escapeJSONString\`.
- **Formatting Rule**: Your script must be wrapped in a self-executing \`async function run()\` or similar, and it must \`return\` the final data array to pass to the next step. Each obj in the return array must have a status flag
  Example:

\`\`\`
async function run(){
  let z = 10 * 11;
  return [{status:true, output: z}]
}

run()
\`\`\`

## 5. Development Best Practices

1. **Stringified JSON**: Task inputs and Pipelane inputs must be strictly stringified JSON when using the MCP tools.
2. **Accessing Global Inputs**: When gating or limiting loops (e.g., max videos to fetch), read the global config via \`pl.inputs.YOUR_VAR\` inside an \`eval-js\` task.
3. **Accessing Past Task Outputs**: When a task like \`loop-call-rest\` returns raw HTTP responses, it naturally won't include custom fields (like emails or IDs) from earlier steps i.e., it won't pass on \`prev\`. 
   - **Method 1**: Instead of relying on brittle array indexing, you can safely pull those previous task outputs back into your flow in a subsequent \`eval-js\` step by accessing \`pl.executedTasks[N].outputs\` (where \`N\` is the index of the step that generated the data).
   - **Method 2**: If you really need to pass \`prev\` to the next step, you can use an \`eval-js\` task before \`loop-call-rest\` to cache the output of the last task into \`pl.inputs\` (e.g., \`pl.inputs.myCache = prev; return prev;\`). Then, after the \`loop-call-rest\`, use another \`eval-js\` task to retrieve the cache and glue the original data back onto the API response objects.

## 6. Dynamic Task Inputs (JS Evaluation)

You can embed JavaScript expressions directly into any task's input JSON configuration using the \`\${...}\` syntax. This allows dynamic runtime configuration without writing a full \`eval-js\` task.

- Example: If the task input is configured as \`{"count": "\${pl.inputs.g_counter + 1}"}\` and \`g_counter\` is 11, at runtime the task receives \`{"count": 12}\`.
- Make sure the expression is valid JS and properly escaped within the JSON string.

## 7. Available \`Utils\` Functions

The \`Utils\` object exposes many powerful helpers for your \`eval-js\` scripts:

- \`Utils.fs\`: Node.js fs module.
- \`Utils.mkdir(path)\`: Recursively creates directories.
- \`Utils.getXmlParser()\` / \`Utils.xml2json(xmlText)\`: XML parsing.
- \`Utils.escapeJSONString(str)\`: Escapes quotes in strings for JSON safety.
- \`Utils.extractJsonFromMarkdown(str)\`: Safely extracts and parses JSON blocks from LLM markdown responses.
- \`Utils.extractCodeFromMarkdown(str)\`: Extracts raw code arrays from markdown blocks.
- \`Utils.generateUID(input, length)\` / \`Utils.generateRandomID(length)\` / \`Utils.generateHashCode(input, max)\`: Hashing and ID generation.
- \`Utils.shuffleArray(array)\` / \`Utils.randomElement(array)\`: Array randomization.
- \`Utils.refineString(str, replacementChar)\`: Replaces non-alphanumeric characters.
- \`Utils.getFileNameFromURL(url)\`: Extracts file names from paths.
- \`Utils.encodeBase64(str)\` / \`Utils.decodeBase64(str)\`: Base64 encoding.
- \`Utils.getMoment()\` / \`Utils.formatDate(date, format)\`: Date formatting via Moment.js.
- \`Utils.sleep(ms)\`: Async sleep delay.`;

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
        "Required. 5-field cron expression for automatic scheduling (min hour day month weekday). Examples: '0 9 * * 1-5' = weekdays 9AM, '*/30 * * * *' = every 30 minutes, '0 0 1 * *' = first of month midnight. Use empty string '' for manual-only execution. Default suggestion is to use 1st Jan every year i.e. '0 0 1 1 *' "
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
