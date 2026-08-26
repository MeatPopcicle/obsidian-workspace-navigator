# scripts — CDP verification suite

**What this is.** Agent-runnable UI and data-path verification for workspace-navigator, driven over the Chrome DevTools Protocol against a live Obsidian, per the methodology in `~/Scratch/obsidian/driving-electron-uis.md`. Adapted from the working jsa-v3 implementations.

**State: written ahead of live use, never yet run against a real Obsidian.** Syntax-checked with `node --check`; every internal API call (21 methods) and DOM class (15 selectors) the scripts reference was grep-verified against `src/` and `styles.css` at commit time. The first live run is expected to shake out timing waits and any private-API drift (`app.commands`, `app.setting`, modal internals are undocumented Obsidian surfaces). Do not treat a script in this directory as trusted until it has both passed and been *seen failing* at least once.

## One-time setup

Two ways to get the port (details and caveats in `driving-electron-uis.md`):

**Restart with the flag** (flag only takes effect at process start):

```bash
/usr/lib/electron43/electron /usr/lib/obsidian/app.asar \
  --remote-debugging-port=9222 "obsidian://vault/Vault-Test"
# confirm: curl -s http://127.0.0.1:9222/json/list
```

**Or a side-by-side debug instance** (doc section 1a) — separate `--user-data-dir` profile with `obsidian.json` copied in, on port **9223**, while the user's normal instance keeps running. Then point the scripts at it:

```bash
CDP_PORT=9223 node scripts/verify-ui.mjs
```

Section-1a caveats that read like plugin bugs but are not: the fresh profile shows a one-time trust prompt (until clicked, every check fails "plugin not installed"), and the same vault must never be open in both instances at once.

## The scripts

| Script | What it holds |
| --- | --- |
| `lib/cdp.mjs` | attach-by-vault-name, `call()` function serialization, the Vault-Test-only guard, wedged-renderer check |
| `reload-plugin.mjs` | build (`--build`) + disable/enable in place; no Obsidian restart |
| `verify-ui.mjs` | the shipped-regression suite: one active checkmark agreeing with the status bar; empty-group standalone cards; empty-heading click toggles (never switches); no legacy `workspace-` classes; focus-visible rules present; status-bar icon hidden/shown |
| `verify-workspace-ops.mjs` | data round-trips: move-to-group order maintenance; add/remove file incl. the legacy `state.file` leaf shape (F3); the Delete-All typed confirm (CTA disabled until exact `DELETE`, Cancel cancels, **the enabled CTA is never clicked**) |
| `verify-api.mjs` | the Local HTTP API + MCP server: auth rejection, every endpoint, all three reveal policies (MRU-switch / in-current / no-workspace), MCP stdio round-trips; restores API settings (shared `data.json` across symlinked vaults makes the restore mandatory) |

The loop: `node scripts/reload-plugin.mjs --build && node scripts/verify-ui.mjs && node scripts/verify-workspace-ops.mjs`

## Rules the scripts follow (and future checks must too)

- **Reach states through the plugin's API** (`WorkspaceManager`); click only the control under test.
- **Every check asserts its subject exists** in the same pass that measures it; a check that can pass on an empty page is not a check.
- **Guarded and restoring**: both verify scripts refuse to run outside Vault-Test, prefix everything they create with `WSN-Verify`/`WSN-Ops`, and verify their own teardown against a recorded pre-state rather than assuming it.
- **Wedge check first**: if `1+1` does not come back, the renderer is busy-looped and every other failure is noise.

## Session provenance

Written 2026-08-21 in the workspace-navigator session, pre-built while the user finished JSA work, so the first joint session starts at "launch Obsidian with the port and run them" rather than at writing them.
