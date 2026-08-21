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
const PORT = process.env.OBSIDIAN_CDP_PORT ?? "9222";

/** The vault these verifications run against. Never a production vault. */
export const TEST_VAULT = "Vault-Test";

/** The plugin under test. */
export const PLUGIN_ID = "workspace-navigator";

export async function attach(vault = TEST_VAULT) {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const pages = targets.filter((t) => t.type === "page" && /Obsidian/i.test(t.title ?? ""));
    const page = pages.find((t) => (t.title ?? "").includes(` - ${vault} - `));

    if (!page) {
        const found = pages.map((t) => (t.title ?? "").replace(/ - Obsidian.*$/, "")).join(", ") || "none";
        throw new Error(`No Obsidian window for ${vault} on port ${PORT}. Windows found: ${found}`);
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
    if (!session.title.includes(` - ${TEST_VAULT} - `)) {
        throw new Error(`Attached window is "${session.title}", not ${TEST_VAULT}. Refusing to run.`);
    }
    const loaded = await session.evaluate(
        `!!window.app?.plugins?.plugins?.[${JSON.stringify(PLUGIN_ID)}]`,
    );
    if (loaded !== true) {
        throw new Error(`Plugin ${PLUGIN_ID} is not loaded in ${TEST_VAULT}. Enable it first.`);
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
