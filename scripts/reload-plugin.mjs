/**
 * Reload workspace-navigator inside a running Obsidian, over the debugging port.
 *
 *   node scripts/reload-plugin.mjs           # reload only
 *   node scripts/reload-plugin.mjs --build   # tsc + esbuild first, then reload
 *
 * Pairs with verify-ui.mjs / verify-workspace-ops.mjs: build, reload, verify.
 * NOTE: written ahead of live use; not yet run against a real Obsidian.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attach, requireResponsive, PLUGIN_ID } from "./lib/cdp.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

if (process.argv.includes("--build")) {
    const tsc = path.join(ROOT, "node_modules", ".bin", "tsc");
    execSync(`${JSON.stringify(tsc)} -noEmit -skipLibCheck && node esbuild.config.mjs production`, {
        cwd: ROOT,
        stdio: "inherit",
    });
}

let session;
try {
    session = await attach();
    await requireResponsive(session);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const value = await session.evaluate(`(async () => {
    const plugins = window.app.plugins;
    await plugins.disablePlugin(${JSON.stringify(PLUGIN_ID)});
    await plugins.enablePlugin(${JSON.stringify(PLUGIN_ID)});
    const p = plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
    if (!p) return { ok: false, why: "did not come back up" };
    /* onload registers views/commands synchronously, but give the sidebar and
       status bar a beat to build before anything asserts on them. */
    for (let i = 0; i < 20 && !p.getWorkspaceManager?.(); i++) {
        await new Promise((r) => setTimeout(r, 100));
    }
    const mgr = p.getWorkspaceManager?.();
    return {
        ok: !!mgr,
        workspaces: mgr ? mgr.getWorkspaceNames().length : 0,
        active: mgr ? mgr.getActiveWorkspace() : null,
    };
})()`);

session.close();

if (!value?.ok) {
    console.error("reload failed:", value?.why ?? value?.error ?? "unknown");
    process.exit(1);
}
console.log(
    `reloaded ${PLUGIN_ID} in ${session.title.replace(/ - Obsidian.*$/, "")}: ` +
    `${value.workspaces} workspaces, active: ${value.active ?? "(none)"}`,
);
