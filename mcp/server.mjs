#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE NAVIGATOR MCP SERVER
// A zero-dependency stdio MCP server bridging to the plugin's local HTTP API,
// so Claude sessions get first-class workspace tools: list, switch, and
// reveal-the-note-being-worked-on.
//
// Configuration (env):
//   WN_API_URL    default http://127.0.0.1:27125  (the vault's API port)
//   WN_API_TOKEN  required; from the plugin's settings (Local API section)
//
// Register with Claude Code, per vault:
//   claude mcp add workspace-navigator -e WN_API_TOKEN=<token> \
//     -- node ~/Scratch/obsidian/obsidian-workspace-navigator/mcp/server.mjs
// ═══════════════════════════════════════════════════════════════════════════════

import { createInterface } from "node:readline";

const API = process.env.WN_API_URL ?? "http://127.0.0.1:27125";
const TOKEN = process.env.WN_API_TOKEN ?? "";

async function api(method, path, body) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            "Authorization": `Bearer ${TOKEN}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    }).catch((err) => {
        throw new Error(`Cannot reach the Workspace Navigator API at ${API} (${err.message}). Is Obsidian open with the plugin's Local API enabled?`);
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `API returned ${res.status}`);
    return json;
}

const TOOLS = [
    {
        name: "list_workspaces",
        description: "List all Obsidian workspaces with their groups, most-recently-used order, and which one is active.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        run: () => api("GET", "/workspaces"),
    },
    {
        name: "current_workspace",
        description: "Get the currently active Obsidian workspace and vault name.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        run: () => api("GET", "/status"),
    },
    {
        name: "workspace_for_note",
        description: "Which workspaces contain a note (vault-relative path), most-recently-used first. Does not switch.",
        inputSchema: {
            type: "object",
            properties: { path: { type: "string", description: "Vault-relative note path, e.g. 'Projects/Foo.md'" } },
            required: ["path"],
            additionalProperties: false,
        },
        run: (args) => api("GET", `/workspace-for?path=${encodeURIComponent(args.path)}`),
    },
    {
        name: "switch_workspace",
        description: "Switch Obsidian to a named workspace (saves the outgoing one per the user's auto-save setting).",
        inputSchema: {
            type: "object",
            properties: { workspace: { type: "string", description: "Exact workspace name" } },
            required: ["workspace"],
            additionalProperties: false,
        },
        run: (args) => api("POST", "/switch", { workspace: args.workspace }),
    },
    {
        name: "reveal_note",
        description: "Open a note in the workspace it belongs to: switches to the most-recently-used workspace containing it (no switch if the current one has it; opens in place and reports if none do), then focuses the note. The response lists alternative workspaces when the note lives in several.",
        inputSchema: {
            type: "object",
            properties: { path: { type: "string", description: "Vault-relative note path, e.g. 'Projects/Foo.md'" } },
            required: ["path"],
            additionalProperties: false,
        },
        run: (args) => api("POST", "/reveal", { path: args.path }),
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Newline-delimited JSON-RPC 2.0 over stdio
// ─────────────────────────────────────────────────────────────────────────────

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const replyError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
    line = line.trim();
    if (!line) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const { id, method, params } = msg;

    try {
        switch (method) {
            case "initialize":
                reply(id, {
                    protocolVersion: params?.protocolVersion ?? "2024-11-05",
                    capabilities: { tools: {} },
                    serverInfo: { name: "workspace-navigator", version: "1.0.0" },
                });
                return;
            case "notifications/initialized":
            case "notifications/cancelled":
                return;  // notifications get no response
            case "ping":
                reply(id, {});
                return;
            case "tools/list":
                reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
                return;
            case "tools/call": {
                const tool = TOOLS.find((t) => t.name === params?.name);
                if (!tool) { replyError(id, -32602, `unknown tool ${params?.name}`); return; }
                try {
                    const result = await tool.run(params?.arguments ?? {});
                    reply(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
                } catch (err) {
                    reply(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
                }
                return;
            }
            default:
                if (id !== undefined) replyError(id, -32601, `method ${method} not supported`);
        }
    } catch (err) {
        if (id !== undefined) replyError(id, -32603, err.message);
    }
});
