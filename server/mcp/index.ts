import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z, ZodTypeAny } from "zod";
import axios from "axios";
import { MultiDbORM } from "multi-db-orm";
import PipeLane, { PipeTaskDescription, TaskVariantConfig } from "pipelane";
import { ShellTask } from "../pipe-tasks/ShellTask";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { parse, DocumentNode, InputObjectTypeDefinitionNode, EnumTypeDefinitionNode, NamedTypeNode, ListTypeNode, NonNullTypeNode } from "graphql";
import fs from "fs";
import path from "path";
import { CreatePipelaneSchema, PipetaskSchema } from "./definitions";

// ---------------------------------------------------------------------------
// Runtime GraphQL input → Zod schema conversion
// ---------------------------------------------------------------------------

function buildGraphqlTypeRegistry(doc: DocumentNode): Map<string, InputObjectTypeDefinitionNode | EnumTypeDefinitionNode> {
    const registry = new Map<string, InputObjectTypeDefinitionNode | EnumTypeDefinitionNode>();
    for (const def of doc.definitions) {
        if (def.kind === "InputObjectTypeDefinition" || def.kind === "EnumTypeDefinition") {
            registry.set(def.name.value, def as any);
        }
    }
    return registry;
}

function gqlTypeToZod(
    typeNode: NamedTypeNode | ListTypeNode | NonNullTypeNode,
    registry: Map<string, InputObjectTypeDefinitionNode | EnumTypeDefinitionNode>,
    required: boolean = false
): ZodTypeAny {
    if (typeNode.kind === "NonNullType") {
        return gqlTypeToZod(typeNode.type as any, registry, true);
    }

    let schema: ZodTypeAny;

    if (typeNode.kind === "ListType") {
        // always required=true for list items — optional() on an item type
        // causes zod-to-json-schema to drop the `items` properties
        const inner = gqlTypeToZod(typeNode.type as any, registry, true);
        schema = z.array(inner);
    } else {
        // NamedType
        const name = (typeNode as NamedTypeNode).name.value;
        switch (name) {
            case "String":
            case "ID": schema = z.string(); break;
            case "Int": schema = z.number().int(); break;
            case "Float": schema = z.number(); break;
            case "Boolean": schema = z.boolean(); break;
            default: {
                const def = registry.get(name);
                if (!def) { schema = z.any(); break; }
                if (def.kind === "EnumTypeDefinition") {
                    const values = def.values!.map(v => v.name.value) as [string, ...string[]];
                    schema = z.enum(values);
                } else {
                    // InputObjectTypeDefinition — recurse
                    schema = graphqlInputToZod(name, registry);
                }
            }
        }
    }

    return required ? schema : schema.optional();
}

function graphqlInputToZod(
    inputTypeName: string,
    registry: Map<string, InputObjectTypeDefinitionNode | EnumTypeDefinitionNode>
): z.ZodObject<any> {
    const def = registry.get(inputTypeName) as InputObjectTypeDefinitionNode;
    if (!def || def.kind !== "InputObjectTypeDefinition") {
        throw new Error(`GraphQL input type '${inputTypeName}' not found in schema`);
    }
    const shape: Record<string, ZodTypeAny> = {};
    for (const field of def.fields || []) {
        const isRequired = field.type.kind === "NonNullType";
        shape[field.name.value] = gqlTypeToZod(field.type as any, registry, isRequired)
            .describe(field.description?.value || field.name.value);
    }
    return z.object(shape);
}

// Parse model.graphql once at module load
const _schemaPath = path.join(__dirname, "../../model.graphql");
const _gqlRegistry = buildGraphqlTypeRegistry(parse(fs.readFileSync(_schemaPath, "utf-8")));

// ---------------------------------------------------------------------------

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

            let taskDesc: PipeTaskDescription = task.describe() as any
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
                                text: 'Task failed with error: ' + (e as any).message as any
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
            "List all existing pipelanes (workflows). By default the large 'input' field is omitted from each pipelane; set show_details=true to include it.",
            {
                show_details: z.boolean().optional().default(false).describe("If true, include the full 'input' field on each pipelane. Definition can be too long so its recommended to use get-pipelane-definition explicitly to retrieve details per pipelane. Defaults to false.")
            },
            async (args) => {
                try {
                    let res = await resolvers.Query.pipelanes();
                    if (!args.show_details) {
                        res = res.map((pl: any) => {
                            const { input, ...rest } = pl;
                            return rest;
                        });
                    }
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "get-pipelane-definition",
            "Get the full definition of a specific pipelane (workflow) by name, including its 'input' field and all its tasks.",
            {
                name: z.string().describe("Name of the pipelane to retrieve")
            },
            async (args) => {
                try {
                    const pipelane = await resolvers.Query.Pipelane(undefined, { name: args.name });
                    if (!pipelane) {
                        return { content: [{ type: "text", text: `Pipelane '${args.name}' not found` }] };
                    }
                    pipelane.tasks = await resolvers.Pipelane.tasks(pipelane);
                    return { content: [{ type: "text", text: JSON.stringify(pipelane) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "create-or-update-pipelane",
            "Create or update a pipelane workflow configuration. Provide an existing name to update (upsert). Use check-available-tasks → get-task-variations → get-task-definition to build correct task inputs.",
            CreatePipelaneSchema.shape as any,
            (async (args: any) => {
                try {
                    let res = await resolvers.Mutation.createPipelane(undefined, { data: args, oldPipeName: args.name });
                    return { content: [{ type: "text" as const, text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text" as const, text: "Error: " + e.message }] };
                }
            }) as any
        );

        server.tool(
            "rename-pipelane",
            "Rename an existing pipelane. Updates all associated tasks and the cron scheduler entry.",
            {
                oldName: z.string().describe("Current name of the pipelane"),
                newName: z.string().describe("New name for the pipelane")
            },
            async (args) => {
                try {
                    const existing = await resolvers.Query.Pipelane(undefined, { name: args.oldName });
                    if (!existing) {
                        return { content: [{ type: "text", text: `Pipelane '${args.oldName}' not found` }] };
                    }
                    const res = await resolvers.Mutation.createPipelane(undefined, {
                        data: { ...existing, name: args.newName },
                        oldPipeName: args.oldName
                    });
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "clone-pipelane",
            "Clone an existing pipelane (and all its tasks) under a new name.",
            {
                name: z.string().describe("Name of the pipelane to clone")
            },
            async (args) => {
                try {
                    const res = await resolvers.Mutation.clonePipelane(undefined, { name: args.name });
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
            "delete-pipelane-task",
            "Delete a specific task from a pipelane.",
            {
                pipelaneName: z.string().describe("Name of the pipelane the task belongs to"),
                name: z.string().describe("Name of the task to delete")
            },
            async (args) => {
                try {
                    let res = await resolvers.Mutation.deletePipelaneTask(undefined, { pipelaneName: args.pipelaneName, name: args.name });
                    return { content: [{ type: "text", text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error: " + e.message }] };
                }
            }
        );

        server.tool(
            "create-or-update-pipelane-task",
            "Create or update a single task within a pipelane. Provide oldTaskName to rename an existing task. Use check-available-tasks -> get-task-variations -> get-task-definition to build the correct input.",
            {
                ...PipetaskSchema.shape,
                oldTaskName: z.string().optional().describe(
                    "Current name of the task if you are renaming it. Omit when creating a new task."
                )
            } as any,
            (async (args: any) => {
                try {
                    const { oldTaskName, ...data } = args;
                    let res = await resolvers.Mutation.createPipelaneTask(undefined, { data, oldTaskName });
                    return { content: [{ type: "text" as const, text: JSON.stringify(res) }] };
                } catch (e: any) {
                    return { content: [{ type: "text" as const, text: "Error: " + e.message }] };
                }
            }) as any
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


        server.tool(
            "trigger-pipelane-execution",
            "Trigger the execution of an existing pipelane (workflow) by name. Returns the execution record created.",
            {
                name: z.string().describe("Name of the pipelane to trigger"),
                input: z.string().optional().describe("Optional JSON string of input overrides to pass to the pipelane")
            },
            async (args) => {
                try {
                    let execution = await resolvers.Mutation.executePipelane(undefined, { name: args.name, input: args.input });
                    return { content: [{ type: "text", text: JSON.stringify(execution) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error triggering pipelane: " + e.message }] };
                }
            }
        );

        server.tool(
            "stop-pipelane-execution",
            "Stop a running pipelane execution by its instance/execution ID.",
            {
                id: z.string().describe("The instance ID of the running pipelane execution to stop")
            },
            async (args) => {
                try {
                    let result = await resolvers.Mutation.stopPipelane(undefined, { id: args.id });
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                } catch (e: any) {
                    return { content: [{ type: "text", text: "Error stopping pipelane: " + e.message }] };
                }
            }
        );
    }

    return async (req: any, res: any) => {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined // stateless
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    }
}
