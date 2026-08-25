/**
 * Talking to a running Obsidian over the Chrome DevTools Protocol.
 *
 * Adapted from the jsa-v3 reference implementation (see
 * ~/Scratch/obsidian/driving-electron-uis.md for the methodology). Attaches to
 * an Obsidian the user already has open; needs nothing that is not in Node 22+.
 *
 * Launch Obsidian with the port open (the flag only works at process start):
 *   /usr/lib/electron43/electron /usr/lib/obsidian/app.asar \
 *     --remote-debugging-port=9222 "obsidian://vault/Vault-Test"
 *
 * The vault is named, never guessed: Obsidian restores previously-open vaults,
 * so "first page" attaches to the wrong window and the symptom looks like a
 * plugin bug that is not there.
 */
/* CDP_PORT is the standard name (driving-electron-uis.md section 1a); it is
 * read here, inside the module that uses it, because `import` hoists and an
 * importer setting process.env after its imports runs too late. Set it in the
 * shell: `CDP_PORT=9224 node scripts/verify-ui.mjs`.
 *
 * The default is THIS project's registered port (9224, see the registry table
 * in driving-electron-uis.md), never 9222: a 9222 default silently drives the
 * user's own instance in the multi-agent setup. */
const PORT = process.env.CDP_PORT ?? process.env.OBSIDIAN_CDP_PORT ?? "9224";

/** The vault these verifications run against: this project's local clone
 *  (cloned from Vault-Test 2026-08-25), owned by the 9224 instance. Never a
 *  production vault, never the shared Vault-Test that other agents drive. */
export const TEST_VAULT = process.env.WSN_TEST_VAULT ?? "Vault-WSN-Test";

/** The plugin under test. */
export const PLUGIN_ID = "workspace-navigator";

export async function attach(vault = TEST_VAULT) {
    /* A Settings window's title also contains " - <vault> - " but its JS
       context has no window.app; never pick it as the main session. */
    return attachTitled(` - ${vault} - `, (title) => !title.startsWith("Settings - "));
}

/**
 * Attach to any Obsidian window on our port whose title contains the substring.
 * Needed because Obsidian attaches modals and the settings UI to its ACTIVE
 * window's document; when a separate Settings window exists, DOM probes for
 * those must run in THAT target, not the main window's (found live 2026-08-25:
 * settings-driven modal checks measured an empty document).
 */
export async function attachTitled(titleIncludes, extraFilter = () => true) {
    let targets;
    try {
        targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    } catch {
        throw new Error(
            `Nothing is listening on CDP port ${PORT}. Launch Obsidian with ` +
            `--remote-debugging-port=${PORT}, or set CDP_PORT to the right port ` +
            `(this project's registered port is 9224; see driving-electron-uis.md).`,
        );
    }
    const pages = targets.filter((t) => t.type === "page" && /Obsidian/i.test(t.title ?? ""));
    const page = pages.find((t) => (t.title ?? "").includes(titleIncludes) && extraFilter(t.title ?? ""));

    if (!page) {
        const found = pages.map((t) => (t.title ?? "").replace(/ - Obsidian.*$/, "")).join(", ") || "none";
        throw new Error(`No Obsidian window matching "${titleIncludes}" on port ${PORT}. Windows found: ${found}`);
    }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.addEventListener("open", resolve);
        ws.addEventListener("error", () => reject(new Error("could not attach to the debugging socket")));
    });

    let seq = 0;
    const evaluate = (expression) =>
        new Promise((resolve) => {
            const id = ++seq;
            const handler = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id !== id) return;
                ws.removeEventListener("message", handler);
                if (msg.result?.exceptionDetails) {
                    resolve({ error: msg.result.exceptionDetails.exception?.description ?? "evaluation threw" });
                    return;
                }
                resolve(msg.result?.result?.value);
            };
            ws.addEventListener("message", handler);
            ws.send(
                JSON.stringify({
                    id,
                    method: "Runtime.evaluate",
                    params: { expression, awaitPromise: true, returnByValue: true },
                }),
            );
        });

    return { evaluate, close: () => ws.close(), title: page.title };
}

/** Serialize a real function and run it in the page with JSON arguments. */
export const call = (session, fn, ...args) =>
    session.evaluate(`(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(",")})`);

/**
 * Refuse to run any state-mutating script outside the test vault.
 *
 * workspace-navigator has no source-root setting to key on, so the guard is
 * the vault itself: the attached window's title carries the vault name, and a
 * second check confirms the plugin is actually loaded there.
 */
export async function requireTestVault(session) {
    /* Title matching FINDS the window; the app API is what we trust — a note
       whose name contains " - Vault-X - " can make a title lie (protocol from
       driving-electron-uis.md, "Several agents, several instances"). */
    const ident = await session.evaluate(`(() => ({
        name: window.app?.vault?.getName?.() ?? null,
        base: window.app?.vault?.adapter?.basePath ?? null,
    }))()`);
    if (ident?.name !== TEST_VAULT) {
        throw new Error(
            `Attached window's vault is ${JSON.stringify(ident?.name)} at ${JSON.stringify(ident?.base)}, ` +
            `not ${TEST_VAULT}. Refusing to run.`,
        );
    }

    /* Fresh debug profiles start in restricted mode, sometimes with no visible
       prompt; setEnable(true) is what the trust button calls underneath. */
    const restricted = await session.evaluate(`window.app?.plugins?.isEnabled?.() === false`);
    if (restricted === true) {
        await session.evaluate(`window.app.plugins.setEnable(true)`);
        await new Promise((r) => setTimeout(r, 1500));
    }

    const loaded = await session.evaluate(
        `!!window.app?.plugins?.plugins?.[${JSON.stringify(PLUGIN_ID)}]`,
    );
    if (loaded !== true) {
        throw new Error(`Plugin ${PLUGIN_ID} is not loaded in ${TEST_VAULT} (community plugins enabled: check trust gate).`);
    }
}

/** A wedged renderer makes every other failure misleading; check it first. */
export async function requireResponsive(session) {
    const two = await Promise.race([
        session.evaluate("1+1"),
        new Promise((r) => setTimeout(() => r("timeout"), 3000)),
    ]);
    if (two !== 2) {
        throw new Error("Renderer did not answer 1+1; it is busy or wedged. Restart Obsidian and look for a loop.");
    }
}
