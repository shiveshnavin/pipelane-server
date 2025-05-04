import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z, ZodTypeAny } from "zod";
import axios from "axios";
import { MultiDbORM } from "multi-db-orm";
import PipeLane, { PipeTaskDescription, TaskVariantConfig } from "pipelane";
import { ShellTask } from "../pipe-tasks/ShellTask";

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

export function createMcpServer(variantConfig: TaskVariantConfig, db: MultiDbORM) {

    const server = new McpServer({
        name: "pipelane-bot",
        version: "1.0.0"
    });

    addTools(variantConfig, server)

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


    const McpApp = express();
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    McpApp.get("/sse", async (req, res) => {
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;

        console.log("mcp:SSE session started:", transport.sessionId);

        res.on("close", () => {
            console.log("mcp:SSE session closed:", transport.sessionId);
            delete transports[transport.sessionId];
        });

        await server.connect(transport);
    });

    McpApp.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId as string;
        const transport = transports[sessionId];
        console.log("mcp:request:", req.body)
        if (transport) {
            await transport.handlePostMessage(req, res);
        } else {
            res.status(400).send("No transport found for sessionId");
        }
    });

    return McpApp



}
