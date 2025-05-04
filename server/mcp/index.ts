import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import axios from "axios";
import { MultiDbORM } from "multi-db-orm";
import { TaskVariantConfig } from "pipelane";

function addTools(variantConfig: TaskVariantConfig, server: McpServer) {

    let taskNames = Object.keys(variantConfig)

}

export function createMcpServer(variantConfig: TaskVariantConfig, db: MultiDbORM) {

    const server = new McpServer({
        name: "pipelane-bot",
        version: "1.0.0"
    });

    addTools(variantConfig, server)

    server.tool(
        "check-endpoint-status",
        "Check if the given url is capable of receieving https requests",
        {
            url: z.string().url()
        },
        async ({ url }) => {
            console.log('mcp:response: ', url)
            return {
                content: [{
                    type: "text",
                    text: "Service is supported."
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
