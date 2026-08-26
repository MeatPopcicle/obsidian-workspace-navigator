/**
 * Local HTTP API + MCP server verification, against a live Obsidian.
 *
 *   node scripts/verify-api.mjs
 *
 * Enables the plugin's API in the owned debug instance with TEST credentials
 * (port 27126, throwaway token), exercises every endpoint from outside the
 * app, verifies all three reveal policies (in-current / MRU-switch /
 * no-workspace), smoke-tests the bundled MCP server over stdio, then restores
 * the original API settings and workspace state and verifies the restore.
 *
 * Symlink caveat: this repo's data.json is shared across symlinked vaults, so
 * the restore step is not optional; it puts apiEnabled/apiPort/apiToken back
 * exactly as found.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { attach, call, requireResponsive, requireTestVault, PLUGIN_ID } from "./lib/cdp.mjs";

const TEST_PORT = 27126;
const TEST_TOKEN = "wsn-verify-token";
const BASE = `http://127.0.0.1:${TEST_PORT}`;
const WS_A = "WSN-Api A";
const WS_B = "WSN-Api B";

/* ------------------------------------------------------------------ */

function snapshot(id) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();
    return {
        names: mgr.getWorkspaceNames(),
        active: mgr.getActiveWorkspace(),
        api: { enabled: p.settings.apiEnabled, port: p.settings.apiPort, token: p.settings.apiToken },
    };
}

async function seed(id, wsA, wsB, port, token) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();

    // Two markdown files: one that will belong to WS_A only, one to none.
    const mds = window.app.vault.getMarkdownFiles().map((f) => f.path);
    if (mds.length < 2) return { error: "need at least 2 markdown files in the vault" };

    await mgr.saveWorkspace(wsA, false);
    await mgr.saveWorkspace(wsB, false);

    const inA = mds.find((m) => !mgr.getWorkspacesWithFile(m).includes(wsB)) ?? mds[0];
    mgr.addFileToWorkspace(wsA, inA);
    // ensure it is NOT in wsB so the reveal must switch
    mgr.removeFileFromWorkspace(wsB, inA);
    const inNone = mds.find((m) => mgr.getWorkspacesWithFile(m).length === 0) ?? null;

    p.settings.apiEnabled = true;
    p.settings.apiPort = port;
    p.settings.apiToken = token;
    await p.saveSettings();
    p.apiServer?.restart();
    await new Promise((r) => setTimeout(r, 300));

    // Make wsB current so reveal(inA) must switch, and stamp its MRU newer.
    await p.loadWorkspace(wsB);
    return { inA, inNone, active: mgr.getActiveWorkspace(), serverRunning: p.apiServer?.running ?? false };
}

async function teardown(id, names, api, originalActive) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();
    for (const n of names) mgr.deleteWorkspace(n);
    p.settings.apiEnabled = api.enabled;
    p.settings.apiPort = api.port;
    p.settings.apiToken = api.token;
    mgr.getStorage().activeWorkspace =
        originalActive && mgr.getWorkspaceNames().includes(originalActive) ? originalActive : null;
    await p.saveSettings();
    p.apiServer?.restart();
    p.refreshSidebarView();
    p.updateStatusBar();
    return {
        names: mgr.getWorkspaceNames(),
        active: mgr.getActiveWorkspace(),
        api: { enabled: p.settings.apiEnabled, port: p.settings.apiPort, token: p.settings.apiToken },
    };
}

/* ------------------------------------------------------------------ */

const failures = [];
const check = (label, ok, detail = "") => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
    if (!ok) failures.push(label);
};

const http = async (method, route, { token = TEST_TOKEN, body } = {}) => {
    const res = await fetch(`${BASE}${route}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
};

let session;
try {
    session = await attach();
    await requireResponsive(session);
    await requireTestVault(session);
} catch (error) {
    console.error(`\n  ${error.message}\n`);
    process.exit(1);
}
const run = (fn, ...args) => call(session, fn, ...args);

const pre = await run(snapshot, PLUGIN_ID);
console.log(`\nverify-api against ${session.title.replace(/ - Obsidian.*$/, "")}`);
console.log(`pre-state: ${pre.names.length} workspaces, active: ${pre.active ?? "(none)"}, api ${pre.api.enabled ? "on" : "off"}`);
console.log("-".repeat(64));

try {
    const seeded = await run(seed, PLUGIN_ID, WS_A, WS_B, TEST_PORT, TEST_TOKEN);
    check("seed complete (subject)", !seeded.error && seeded.serverRunning === true, seeded.error ?? `server running: ${seeded.serverRunning}`);
    check("probe files chosen (subject)", !!seeded.inA, `inA=${seeded.inA}, inNone=${seeded.inNone ?? "(none available)"}`);

    // Auth
    const noAuth = await http("GET", "/status", { token: "wrong" });
    check("wrong token rejected (401)", noAuth.status === 401);

    // Reads
    const status = await http("GET", "/status");
    check("GET /status", status.status === 200 && status.json.activeWorkspace === WS_B, JSON.stringify(status.json));
    const list = await http("GET", "/workspaces");
    check("GET /workspaces lists seeds", list.status === 200 &&
        list.json.workspaces?.some((w) => w.name === WS_A) && list.json.active === WS_B);
    const wf = await http("GET", `/workspace-for?path=${encodeURIComponent(seeded.inA)}`);
    check("GET /workspace-for finds owner", wf.status === 200 && wf.json.workspaces?.includes(WS_A), JSON.stringify(wf.json.workspaces));

    // Reveal: must SWITCH to WS_A (current is WS_B, note only in WS_A)
    const r1 = await http("POST", "/reveal", { body: { path: seeded.inA } });
    check("reveal switches to owning workspace", r1.status === 200 && r1.json.workspace === WS_A && r1.json.switched === true, JSON.stringify(r1.json));

    // Reveal again: current now contains it; must NOT switch
    const r2 = await http("POST", "/reveal", { body: { path: seeded.inA } });
    check("reveal in-current does not switch", r2.status === 200 && r2.json.switched === false && r2.json.workspace === WS_A);

    // Reveal a workspace-less note: opens here, reports
    if (seeded.inNone) {
        const r3 = await http("POST", "/reveal", { body: { path: seeded.inNone } });
        check("reveal no-workspace opens here + reports", r3.status === 200 && r3.json.inNoWorkspace === true && r3.json.switched === false, JSON.stringify(r3.json));
    } else {
        check("reveal no-workspace opens here + reports", false, "no workspace-less markdown file available to test");
    }

    // Reveal a nonexistent path: 404 with error
    const r4 = await http("POST", "/reveal", { body: { path: "WSN-does-not-exist.md" } });
    check("reveal missing file errors (404)", r4.status === 404 && !!r4.json.error);

    // Switch endpoint
    const sw = await http("POST", "/switch", { body: { workspace: WS_B } });
    check("POST /switch", sw.status === 200 && sw.json.active === WS_B);
    const swBad = await http("POST", "/switch", { body: { workspace: "WSN-No-Such" } });
    check("switch unknown errors (404)", swBad.status === 404);

    // MCP server smoke test over stdio
    const mcpPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "mcp", "server.mjs");
    const mcp = spawn(process.execPath, [mcpPath], {
        env: { ...process.env, WN_API_URL: BASE, WN_API_TOKEN: TEST_TOKEN },
        stdio: ["pipe", "pipe", "inherit"],
    });
    const lines = createInterface({ input: mcp.stdout });
    const pending = new Map();
    lines.on("line", (l) => {
        try { const m = JSON.parse(l); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch {}
    });
    const rpc = (id, method, params) => {
        const p = new Promise((resolve) => pending.set(id, resolve));
        mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
        return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("mcp timeout")), 5000))]);
    };

    const init = await rpc(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "verify", version: "0" } });
    check("MCP initialize", init.result?.serverInfo?.name === "workspace-navigator");
    const tools = await rpc(2, "tools/list", {});
    check("MCP lists 5 tools", tools.result?.tools?.length === 5, String(tools.result?.tools?.length));
    const cw = await rpc(3, "tools/call", { name: "current_workspace", arguments: {} });
    const cwText = cw.result?.content?.[0]?.text ?? "";
    check("MCP current_workspace works", cwText.includes(WS_B), cwText.slice(0, 60));
    /* Policy correctness is covered by the direct HTTP checks above; here we
       assert the MCP tool round-trips end-to-end. (The exact workspace can
       legitimately be A or B by this point: earlier reveals opened the note
       while B was current, and auto-save-on-switch captured it into B.) */
    const rv = await rpc(4, "tools/call", { name: "reveal_note", arguments: { path: seeded.inA } });
    let rvParsed = null;
    try { rvParsed = JSON.parse(rv.result?.content?.[0]?.text ?? ""); } catch {}
    check("MCP reveal_note works", !!rvParsed && !rvParsed.error && rvParsed.path === seeded.inA &&
        [WS_A, WS_B].includes(rvParsed.workspace) && typeof rvParsed.switched === "boolean",
        rvParsed ? `workspace=${rvParsed.workspace}, switched=${rvParsed.switched}` : "unparseable");
    mcp.kill();
    await once(mcp, "exit").catch(() => {});
} finally {
    const post = await run(teardown, PLUGIN_ID, [WS_A, WS_B], pre.api, pre.active);
    const restored =
        JSON.stringify(post.names) === JSON.stringify(pre.names) &&
        post.active === pre.active &&
        JSON.stringify(post.api) === JSON.stringify(pre.api);
    check("teardown restored pre-state (incl. API settings)", restored,
        restored ? "" : JSON.stringify({ names: post.names?.length, active: post.active, api: post.api }));
    session.close();
}

console.log("-".repeat(64));
if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exit(1);
}
console.log("API and MCP verified inside and outside Obsidian.\n");
