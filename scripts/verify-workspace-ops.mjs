/**
 * Workspace-operation round-trips for workspace-navigator, against a live
 * Obsidian. Complements verify-ui.mjs: this one exercises the data paths.
 *
 *   node scripts/verify-workspace-ops.mjs
 *
 * Covers the fixed file-op flaws and the deletion contract:
 *   - moveWorkspaceToGroup maintains the manual-order arrays (v2.21 fix)
 *   - add/remove file round-trips, including the legacy leaf shape
 *     `state.file` that removal used to miss (F3, v2.22 fix)
 *   - the Delete-All typed confirmation: CTA disabled until the exact text
 *     is typed, and Cancel really cancels. The enabled CTA is NEVER clicked.
 *
 * Guarded: refuses to run outside Vault-Test. Everything it creates is
 * prefixed "WSN-Ops"; teardown restores and verifies the pre-state.
 *
 * NOTE: written ahead of live use; not yet run against a real Obsidian.
 */
import { attach, attachTitled, call, requireResponsive, requireTestVault, PLUGIN_ID, TEST_VAULT } from "./lib/cdp.mjs";

const WS = "WSN-Ops A";
const WS2 = "WSN-Ops B";
const GRP = "WSN-Ops Grp";
const FILE = "WSN-ops-probe.md";
const FILE_LEGACY = "WSN-ops-legacy.md";

/* ------------------------------------------------------------------ */

function snapshot(id) {
    const mgr = window.app.plugins.plugins[id].getWorkspaceManager();
    return { names: mgr.getWorkspaceNames(), groups: mgr.getGroups(), active: mgr.getActiveWorkspace() };
}

async function opsProbe(id, ws, ws2, grp, file, fileLegacy) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();
    const out = {};

    await mgr.saveWorkspace(ws, false);
    await mgr.saveWorkspace(ws2, false);
    out.created = mgr.getWorkspaceNames().includes(ws) && mgr.getWorkspaceNames().includes(ws2);

    /* Order maintenance: with manual order on, a moved workspace must land in
       the target group's order array, not sort to Infinity. */
    mgr.moveWorkspaceToGroup(ws, grp);
    mgr.moveWorkspaceToGroup(ws2, grp);
    const ordered = mgr.getWorkspacesByGroupOrdered(grp, true);
    out.orderedInGroup = ordered;
    out.orderMaintained = ordered.includes(ws) && ordered.includes(ws2) &&
        mgr.getWorkspaceOrder(grp).includes(ws2);

    /* File round-trip, modern shape. */
    out.addOk = mgr.addFileToWorkspace(ws, file);
    out.listedAfterAdd = mgr.getWorkspacesWithFile(file).includes(ws);
    out.removeOk = mgr.removeFileFromWorkspace(ws, file);
    out.listedAfterRemove = mgr.getWorkspacesWithFile(file).includes(ws);

    /* Legacy shape: a leaf persisted as {state:{file}} (no nested state.state).
       getOpenFilesInLayout matches it, so removal must too (F3). */
    const wsData = mgr.getWorkspace(ws);
    const findTabs = (node) => {
        if (!node) return null;
        if (node.type === "tabs" && Array.isArray(node.children)) return node;
        for (const c of node.children ?? []) { const t = findTabs(c); if (t) return t; }
        return null;
    };
    const tabs = findTabs(wsData?.layout?.main);
    if (tabs) {
        tabs.children.push({ id: "wsnopslegacy", type: "leaf", state: { file: fileLegacy } });
        out.legacyListed = mgr.getWorkspacesWithFile(fileLegacy).includes(ws);
        out.legacyRemoveOk = mgr.removeFileFromWorkspace(ws, fileLegacy);
        out.legacyGone = !mgr.getWorkspacesWithFile(fileLegacy).includes(ws);
    } else {
        out.legacyListed = out.legacyRemoveOk = out.legacyGone = "no tabs node";
    }

    await p.saveSettings();
    return out;
}

async function openSettings(id) {
    window.app.setting.open();
    window.app.setting.openTabById(id);
    await new Promise((r) => setTimeout(r, 600));
    return { tabId: window.app.setting.activeTab?.id ?? null };
}

/* Pure DOM: runs in the Settings WINDOW's context, which has no window.app
   (its document holds the settings UI and receives the modal). App-level
   reads/cleanup happen from the main session around it. */
async function typedConfirmProbeDOM() {
    for (const d of document.querySelectorAll("details.wn-settings-section")) d.open = true;
    await new Promise((r) => setTimeout(r, 100));

    const rows = [...document.querySelectorAll(".wn-danger-zone .setting-item")];
    const deleteRow = rows.find((r) => r.querySelector(".setting-item-name")?.textContent === "Delete all workspaces");
    if (!deleteRow) return { error: "Delete-all row not found in danger zone" };

    deleteRow.querySelector("button")?.click();
    for (let i = 0; i < 20 && !document.querySelector(".wn-typed-confirm-input"); i++) {
        await new Promise((r) => setTimeout(r, 100));
    }

    const modal = document.querySelector(".wn-delete-confirm-modal");
    const input = modal?.querySelector(".wn-typed-confirm-input");
    const cta = modal?.querySelector("button.mod-warning");
    if (!modal || !input || !cta) return { error: "typed modal did not appear" };

    const out = { initialDisabled: cta.disabled };

    input.value = "delete";  // wrong case: must stay disabled
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    out.wrongTextDisabled = cta.disabled;

    input.value = "DELETE";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    out.exactTextEnabled = !cta.disabled;

    /* NEVER click the enabled CTA. Cancel is the path under test from here. */
    const cancel = [...modal.querySelectorAll("button")].find((b) => b.textContent === "Cancel");
    cancel?.click();
    await new Promise((r) => setTimeout(r, 200));
    out.cancelled = !document.querySelector(".wn-delete-confirm-modal");
    return out;
}

function closeSettingsAndCount(id) {
    window.app.setting.close();
    return { workspacesSurvived: window.app.plugins.plugins[id].getWorkspaceManager().getWorkspaceNames().length };
}

async function teardown(id, names, grp, originalActive) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();
    for (const n of names) mgr.deleteWorkspace(n);
    if (mgr.getGroups().includes(grp) || mgr.getGroupOrder().includes(grp)) mgr.deleteGroup(grp);
    mgr.getStorage().activeWorkspace =
        originalActive && mgr.getWorkspaceNames().includes(originalActive) ? originalActive : null;
    await p.saveSettings();
    p.refreshSidebarView();
    p.updateStatusBar();
    return { names: mgr.getWorkspaceNames(), groups: mgr.getGroups(), active: mgr.getActiveWorkspace() };
}

/* ------------------------------------------------------------------ */

const failures = [];
const check = (label, ok, detail = "") => {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
    if (!ok) failures.push(label);
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
console.log(`\nverify-workspace-ops against ${session.title.replace(/ - Obsidian.*$/, "")}`);
console.log(`pre-state: ${pre.names.length} workspaces, ${pre.groups.length} groups, active: ${pre.active ?? "(none)"}`);
console.log("-".repeat(64));

try {
    const ops = await run(opsProbe, PLUGIN_ID, WS, WS2, GRP, FILE, FILE_LEGACY);
    check("workspaces created (subject)", ops.created === true);
    check("move-to-group maintains order arrays", ops.orderMaintained === true, JSON.stringify(ops.orderedInGroup));
    check("addFileToWorkspace succeeds", ops.addOk === true);
    check("file listed after add (subject)", ops.listedAfterAdd === true);
    check("removeFileFromWorkspace succeeds", ops.removeOk === true);
    check("file gone after remove", ops.listedAfterRemove === false);
    check("legacy-shape leaf listed (subject)", ops.legacyListed === true, String(ops.legacyListed));
    check("legacy-shape leaf removable (F3)", ops.legacyRemoveOk === true, String(ops.legacyRemoveOk));
    check("legacy-shape leaf gone", ops.legacyGone === true, String(ops.legacyGone));

    /* This Obsidian renders Settings as its OWN OS window, and modals attach
       to the active window's document. So: open settings from the main
       session, then attach to the Settings window's target that appears, and
       run the modal probe THERE. Probing from the main window measures an
       empty page (found live 2026-08-25). */
    const opened = await call(session, openSettings, PLUGIN_ID);
    check("settings tab opened (subject)", opened.tabId === PLUGIN_ID, String(opened.tabId));
    let settingsSession = null;
    for (let i = 0; i < 10 && !settingsSession; i++) {
        try { settingsSession = await attachTitled(`Settings - ${TEST_VAULT}`); }
        catch { await new Promise((r) => setTimeout(r, 300)); }
    }
    /* The Settings window's context has no window.app; the probe is pure DOM
       and the vault-identity guard is the title match plus the presence of
       our own danger zone in that document. Fall back to the main session
       when settings render in the main window instead. */
    const tcSession = settingsSession ?? session;
    const tc = await call(tcSession, typedConfirmProbeDOM);
    if (settingsSession) settingsSession.close();
    const post = await call(session, closeSettingsAndCount, PLUGIN_ID);
    check("typed modal appeared (subject)", !tc.error, tc.error);
    check("CTA disabled initially", tc.initialDisabled === true);
    check("CTA disabled on wrong text", tc.wrongTextDisabled === true);
    check("CTA enabled on exact DELETE", tc.exactTextEnabled === true);
    check("Cancel closes without deleting", tc.cancelled === true && post.workspacesSurvived >= 2,
        `${post.workspacesSurvived} workspaces survive`);
} finally {
    const post = await run(teardown, PLUGIN_ID, [WS, WS2], GRP, pre.active);
    const restored =
        JSON.stringify(post.names) === JSON.stringify(pre.names) &&
        JSON.stringify(post.groups) === JSON.stringify(pre.groups) &&
        post.active === pre.active;
    check("teardown restored pre-state", restored,
        restored ? "" : `now ${post.names?.length} workspaces, active ${post.active}`);
    session.close();
}

console.log("-".repeat(64));
if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exit(1);
}
console.log("All operation round-trips passed inside Obsidian.\n");
