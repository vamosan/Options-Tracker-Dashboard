import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import * as EventSource from "eventsource";

// Polyfill EventSource for Node.js
global.EventSource = EventSource.default || EventSource;

async function run() {
    const transport = new SSEClientTransport(
        new URL("https://api.webull.com/mcp"),
        {
            headers: {
                "Authorization": "Bearer 1d11896bbcfcb506b5c10141d2d8998a"
            }
        }
    );

    const client = new Client({ name: "options-tracker", version: "1.0.0" }, { capabilities: {} });

    try {
        await client.connect(transport);
        console.log("Connected to Webull MCP");

        const tools = await client.listTools();
        console.log(JSON.stringify(tools, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

run();
