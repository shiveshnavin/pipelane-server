import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z, ZodTypeAny } from "zod";
import axios from "axios";
import { MultiDbORM } from "multi-db-orm";
import PipeLane, { PipeTaskDescription, TaskVariantConfig } from "pipelane";
import { ShellTask } from "../pipe-tasks/ShellTask";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

function generateZodSchema(obj: any): ZodTypeAny {
    if (obj === null) return z.null();
    if (typeof obj === "number") return z.number().describe("A number");
    if (typeof obj === "boolean") return z.boolean().describe("A boolean");
    if (typeof obj === "string") {
        if (obj.toLocaleLowerCase().trim().startsWith("number")) {
            return z.number().describe(obj);
        }
        if (obj.toLocaleLowerCase().trim().startsWith("boolean")) {
            return z.boolean().describe(obj);;
        }
        if (obj.toLocaleLowerCase().trim().startsWith("object")) {
            return z.any().describe(obj);;
        }
        if (obj.toLocaleLowerCase().trim().startsWith("array")) {
            return z.any().describe(obj);;
        }
        return z.string().describe(obj);
    }
    if (Array.isArray(obj)) {
        const itemSchema = obj.length > 0 ? generateZodSchema(obj[0]) : z.any();
        return z.array(itemSchema);
    }
    if (typeof obj === "object") {
        const shape: Record<string, ZodTypeAny> = {};
        for (const key in obj) {
            shape[key] = generateZodSchema(obj[key]);
        }
        return z.object(shape);
    }
    return z.any();
}

function addTools(variantConfig: TaskVariantConfig, server: McpServer) {

    let taskNames = Object.keys(variantConfig)
    for (let taskName of taskNames) {
        let plTasks = variantConfig[taskName]
        for (let task of plTasks) {

            let taskDesc: PipeTaskDescription = task.describe()
            let zodSchema = generateZodSchema(taskDesc.inputs.additionalInputs)

            //@ts-ignore
            server.tool(
                task.getTaskTypeName() + "-" + task.getTaskVariantName(),
                taskDesc.summary,
                //@ts-ignore
                zodSchema.shape,
                async (additionalInputs) => {
                    let pl = new PipeLane(variantConfig, 'mcp')
                    try {
                        //@ts-ignore
                        task.pipeWorkInstance = pl
                        let response = await task.execute(pl, {
                            inputs: [],
                            additionalInputs: additionalInputs
                        } as any)
                        return {
                            content: [{
                                type: "text",
                                text: JSON.stringify(response)
                            }]
                        };
                    } catch (e) {
                        return {
                            content: [{
                                type: "text",
                                text: 'Task failed with error: ' + e.message
                            }]
                        }
                    }
                }
            )

        }
    }

}

export function createMcpServer(variantConfig: TaskVariantConfig, db: MultiDbORM, resolvers?: any) {

    const server = new McpServer({
        name: "pipelane-bot",
        version: "1.0.0"
    });

    server.tool(
        "get-task-definition",
        "Get the definition and required inputs for a specific task",
        {
            taskName: z.string().describe("The name of the task type"),
            taskVariantName: z.string().optional().describe("The name of the task variant (optional)")
        },
        async (args) => {
            const tasks = variantConfig[args.taskName];
            if (!tasks || tasks.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `Task ${args.taskName} not found`
                    }]
                };
            }

            let definitions = [];
            if (args.taskVariantName) {
                const task = tasks.find(t => t.getTaskVariantName() === args.taskVariantName);
                if (task) {
                    definitions.push(task.describe());
                } else {
                    return {
                        content: [{
                            type: "text",
                            text: `Variant ${args.taskVariantName} not found for task ${args.taskName}`
                        }]
                    };
                }
            } else {
                definitions = tasks.map(t => t.describe());
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(definitions)
                }]
            };
        }
    );

    server.tool(
        "get-task-variations",
        "Get all available variations for a specific task",
        {
            taskName: z.string().describe("The name of the task type")
        },
        async (args) => {
            const tasks = variantConfig[args.taskName];
            if (!tasks || tasks.length === 0) {
                return {
                    content: [{
                        type: "text",
                        text: `Task ${args.taskName} not found`
                    }]
                };
            }

            const variations = tasks.map(t => t.getTaskVariantName());
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(variations)
                }]
            };
        }
    );

    server.tool(
        "check-available-tasks",
        "Check supported tasks",
        {

        },
        async () => {

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(Object.keys(variantConfig))
                }]
            };
        }
    )

    if (resolvers) {
        server.tool(
            "list-pipelanes",
            "List all existing pipelanes (workflows)",
            {},
            async () => {
                try {
                    let res = await resolvers.Query.pipelanes();
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "create-or-update-pipelane",
            "Create or update a pipelane workflow configuration",
            {
                name: z.string().describe("Name of the pipelane"),
                schedule: z.string().optional().describe("Cron schedule expression (optional)"),
                active: z.boolean().optional().describe("Whether the schedule is active"),
                tasks: z.array(z.any()).optional().describe("Array of task definitions")
            },
            async (args) => {
                try {
                    let res = await resolvers.Mutation.createPipelane(undefined, { data: args, oldPipeName: args.name });
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "delete-pipelane",
            "Delete a pipelane workflow",
            {
                name: z.string().describe("Name of the pipelane to delete")
            },
            async (args) => {
                try {
                    let res = await resolvers.Mutation.deletePipelane(undefined, { name: args.name });
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "get-pipelane-executions",
            "Get execution history for a specific pipelane",
            {
                pipelaneName: z.string().describe("Name of the pipelane"),
                limit: z.number().optional().describe("Max number of records to return")
            },
            async (args) => {
                try {
                    let res = await resolvers.Query.pipelaneExecutions(undefined, { pipelaneName: args.pipelaneName, limit: args.limit || 50 });
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "get-pipelane-execution-details",
            "Get detailed output and tasks of a specific pipelane execution",
            {
                id: z.string().describe("The ID of the pipelane execution")
            },
            async (args) => {
                try {
                    let execution = await resolvers.Query.PipelaneExecution(undefined, { id: args.id });
                    if (execution) {
                        execution.tasks = await resolvers.PipelaneExecution.tasks(execution);
                        execution.output = await resolvers.PipelaneExecution.output(execution);
                    }
                    return { content: [{ type: "text", text: JSON.stringify(execution) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );
    }

    const McpApp = express();
    McpApp.post("/mcp", async (req, res) => {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined // stateless
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });


    return McpApp
}
