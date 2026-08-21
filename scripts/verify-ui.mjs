/**
 * UI verification for workspace-navigator, run against a live Obsidian.
 *
 *   node scripts/verify-ui.mjs
 *
 * Method (see ~/Scratch/obsidian/driving-electron-uis.md): reach states through
 * the plugin's own API (WorkspaceManager), click only the control under test,
 * and make every check assert its subject exists before measuring it.
 *
 * Holds the regressions this plugin actually shipped:
 *   - exactly one active checkmark, agreeing with the status bar (v2.21 bug)
 *   - empty groups render as standalone cards in the switcher (v2.20 bug)
 *   - clicking an empty group's heading toggles, never switches (v2.20 bug)
 *   - no bare `workspace-` classes in plugin DOM (v2.24 prefix migration)
 *   - focus-visible rules exist for interactive elements (v2.24)
 *   - status-bar icon hidden without an icon, shown with one (v2.21.2)
 *
 * Everything it creates is prefixed "WSN-Verify"; teardown removes it and
 * verifies the restore against the recorded pre-state.
 *
 * NOTE: written ahead of live use; not yet run against a real Obsidian. The
 * first live run is expected to shake out selector/timing details.
 */
import { setTimeout as sleep } from "node:timers/promises";
import { attach, call, requireResponsive, requireTestVault, PLUGIN_ID } from "./lib/cdp.mjs";

const WS_A = "WSN-Verify A";
const WS_B = "WSN-Verify B";
const GRP = "WSN-Verify Grp";
const GRP_EMPTY = "WSN-Verify Empty";

/* ------------------------------------------------------------------ */
/* Functions evaluated inside Obsidian                                */
/* ------------------------------------------------------------------ */

function snapshot(id) {
    const mgr = window.app.plugins.plugins[id].getWorkspaceManager();
    return {
        names: mgr.getWorkspaceNames(),
        groups: mgr.getGroups(),
        active: mgr.getActiveWorkspace(),
    };
}

async function seed(id, wsA, wsB, grp, grpEmpty) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();
    await mgr.saveWorkspace(wsA, false);
    await mgr.saveWorkspace(wsB, false);
    mgr.moveWorkspaceToGroup(wsB, grp);
    const order = mgr.getGroupOrder();
    if (!order.includes(grpEmpty)) {
        order.push(grpEmpty);
        mgr.setGroupOrder(order);
    }
    await p.saveSettings();
    p.refreshSidebarView();
    p.updateStatusBar();
    return snapshotInline();

    function snapshotInline() {
        return { names: mgr.getWorkspaceNames(), groups: mgr.getGroups(), active: mgr.getActiveWorkspace() };
    }
}

async function openSidebar(id) {
    const leaves = window.app.workspace.getLeavesOfType(`${id}-view`);
    if (leaves.length === 0) {
        const cmd = window.app.commands
            .listCommands()
            .find((c) => c.id.startsWith(`${id}:`) && /sidebar/i.test(c.name));
        if (!cmd) return { error: "no sidebar command found" };
        window.app.commands.executeCommandById(cmd.id);
        await new Promise((r) => setTimeout(r, 400));
    }
    return { open: window.app.workspace.getLeavesOfType(`${id}-view`).length };
}

function readSidebar(id) {
    const leaf = window.app.workspace.getLeavesOfType(`${id}-view`)[0];
    if (!leaf) return { error: "no sidebar leaf" };
    const root = leaf.view.containerEl;
    return new Promise((resolve) =>
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const rows = [...root.querySelectorAll(".wn-sidebar-item")];
                const checks = [...root.querySelectorAll(".wn-sidebar-active-check")];
                const checkRowNames = checks.map(
                    (c) => c.closest(".wn-sidebar-item")?.querySelector(".wn-sidebar-item-name")?.textContent ?? "?",
                );
                const groupNames = [...root.querySelectorAll(".wn-sidebar-group-name")].map((el) => el.textContent);
                const legacy = [];
                let inspected = 0;
                for (const el of root.querySelectorAll("*")) {
                    inspected++;
                    for (const cls of el.classList ?? []) {
                        if (cls.startsWith("workspace-")) legacy.push(cls);
                    }
                }
                const statusText = document.querySelector(".wn-navigator-text")?.textContent ?? null;
                resolve({
                    rows: rows.length,
                    rowNames: rows.map((r) => r.querySelector(".wn-sidebar-item-name")?.textContent ?? "?"),
                    checks: checks.length,
                    checkRowNames,
                    groupNames,
                    inspected,
                    legacy: [...new Set(legacy)],
                    statusText,
                    active: window.app.plugins.plugins[id].getWorkspaceManager().getActiveWorkspace(),
                });
            }),
        ),
    );
}

function focusVisibleRules() {
    let rules = 0;
    let sheets = 0;
    for (const sheet of document.styleSheets) {
        let list;
        try { list = sheet.cssRules; } catch { continue; }
        sheets++;
        for (const rule of list) {
            if (rule.selectorText?.includes(":focus-visible") && rule.selectorText.includes(".wn-")) rules++;
        }
    }
    const interactive = document.querySelectorAll(
        ".wn-root button, .wn-root .wn-sidebar-item, .wn-root .wn-sidebar-group-header",
    ).length;
    return { rules, sheets, interactive };
}

async function statusIcon(id, icon) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();
    const active = mgr.getActiveWorkspace();
    if (!active) return { error: "no active workspace" };
    mgr.setWorkspaceIcon(active, icon || null, null);
    p.updateStatusBar();
    await new Promise((r) => setTimeout(r, 50));
    const el = document.querySelector(".wn-navigator-icon");
    return { hidden: !el || getComputedStyle(el).display === "none" };
}

async function switcherProbe(id, emptyGroup) {
    const cmd = window.app.commands
        .listCommands()
        .find((c) => c.id.startsWith(`${id}:`) && /switcher/i.test(c.name + c.id));
    if (!cmd) return { error: "no switcher command found" };
    window.app.commands.executeCommandById(cmd.id);
    await new Promise((r) => setTimeout(r, 500));

    const headers = [...document.querySelectorAll(".wn-group-header-card")];
    const emptyHeader = headers.find((h) => h.dataset.groupName === emptyGroup);
    const suggestions = document.querySelectorAll(".wn-suggestion-item").length;

    const mgr = window.app.plugins.plugins[id].getWorkspaceManager();
    const activeBefore = mgr.getActiveWorkspace();

    let toggledNotSwitched = null;
    if (emptyHeader) {
        /* The control under test: a real click on the empty group's heading. It
           must toggle collapse, never load a workspace (the v2.20 bug). */
        emptyHeader.click();
        await new Promise((r) => setTimeout(r, 300));
        const activeAfter = mgr.getActiveWorkspace();
        const modalStillOpen = !!document.querySelector(".wn-switcher-modal");
        toggledNotSwitched = activeAfter === activeBefore && modalStillOpen;
    }

    const result = {
        headers: headers.length,
        suggestions,
        emptyHeaderFound: !!emptyHeader,
        emptyIsStandalone: emptyHeader?.classList.contains("is-standalone") ?? null,
        toggledNotSwitched,
    };

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    result.modalClosed = !document.querySelector(".wn-switcher-modal");
    return result;
}

async function teardown(id, wsA, wsB, grp, grpEmpty, originalActive) {
    const p = window.app.plugins.plugins[id];
    const mgr = p.getWorkspaceManager();
    mgr.deleteWorkspace(wsA);
    mgr.deleteWorkspace(wsB);
    for (const g of [grp, grpEmpty]) {
        if (mgr.getGroups().includes(g) || mgr.getGroupOrder().includes(g)) mgr.deleteGroup(g);
    }
    if (originalActive && mgr.getWorkspaceNames().includes(originalActive)) {
        mgr.getStorage().activeWorkspace = originalActive;
    } else {
        mgr.getStorage().activeWorkspace = null;
    }
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
if (pre.error) { console.error(pre.error); session.close(); process.exit(1); }
console.log(`\nverify-ui against ${session.title.replace(/ - Obsidian.*$/, "")}`);
console.log(`pre-state: ${pre.names.length} workspaces, ${pre.groups.length} groups, active: ${pre.active ?? "(none)"}`);
console.log("-".repeat(64));

try {
    const seeded = await run(seed, PLUGIN_ID, WS_A, WS_B, GRP, GRP_EMPTY);
    check("seed created workspaces", seeded.names?.includes(WS_A) && seeded.names?.includes(WS_B));
    check("seed created groups", seeded.groups?.includes(GRP));

    const opened = await run(openSidebar, PLUGIN_ID);
    check("sidebar view open", opened.open >= 1, opened.error);

    const sb = await run(readSidebar, PLUGIN_ID);
    /* Subjects first: these counts make the later checks unable to pass empty. */
    check("sidebar has rows (subject)", sb.rows >= 2, `${sb.rows} rows`);
    check("sidebar shows seeded groups (subject)", sb.groupNames?.includes(GRP) && sb.groupNames?.includes(GRP_EMPTY));
    check("exactly one active checkmark", sb.checks === 1, `${sb.checks} found`);
    check("checkmark row agrees with manager", sb.checkRowNames?.[0] === sb.active, `${sb.checkRowNames?.[0]} vs ${sb.active}`);
    check("status bar agrees with manager", !!sb.statusText && sb.statusText.includes(sb.active ?? " "), sb.statusText ?? "no status text");
    check("plugin DOM inspected (subject)", sb.inspected > 20, `${sb.inspected} elements`);
    check("no legacy workspace- classes", sb.legacy.length === 0, sb.legacy.join(", "));

    const fv = await run(focusVisibleRules);
    check("interactive elements exist (subject)", fv.interactive > 0, `${fv.interactive}`);
    check("focus-visible rules present", fv.rules >= 5, `${fv.rules} wn- rules across ${fv.sheets} sheets`);

    const iconOff = await run(statusIcon, PLUGIN_ID, "");
    check("status icon hidden without icon", iconOff.hidden === true);
    const iconOn = await run(statusIcon, PLUGIN_ID, "star");
    check("status icon shown with icon", iconOn.hidden === false);
    await run(statusIcon, PLUGIN_ID, "");

    const sw = await run(switcherProbe, PLUGIN_ID, GRP_EMPTY);
    check("switcher suggestions exist (subject)", sw.suggestions >= 2, `${sw.suggestions}`);
    check("switcher group headers exist (subject)", sw.headers >= 1, `${sw.headers}`);
    check("empty group header rendered", sw.emptyHeaderFound === true, sw.error);
    check("empty group is a standalone card", sw.emptyIsStandalone === true);
    check("empty-heading click toggles, not switches", sw.toggledNotSwitched === true);
    check("switcher closed after Escape", sw.modalClosed === true);
} finally {
    const post = await run(teardown, PLUGIN_ID, WS_A, WS_B, GRP, GRP_EMPTY, pre.active);
    const restored =
        JSON.stringify(post.names) === JSON.stringify(pre.names) &&
        JSON.stringify(post.groups) === JSON.stringify(pre.groups) &&
        post.active === pre.active;
    check("teardown restored pre-state", restored,
        restored ? "" : `now ${post.names?.length} workspaces, ${post.groups?.length} groups, active ${post.active}`);
    session.close();
}

console.log("-".repeat(64));
if (failures.length) {
    console.error(`${failures.length} check(s) failed.`);
    process.exit(1);
}
console.log("All checks passed inside Obsidian.\n");
