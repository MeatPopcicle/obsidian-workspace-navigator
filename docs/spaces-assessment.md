# Scoped Spaces: Deep-Dive Assessment

Written 2026-08-28 at the user's request, before pursuing other roadmap items. This is the missing design documentation for the parked Spaces work: what exists, what the code's architecture already decided, fork-vs-integrate, and which roadmap features belong to Spaces. No code was changed.

## What Scoped Spaces is

Multiple clients (or life-areas) in a single vault. A **space** is a named scope over a vault subtree; while a space is active, the file explorer shows only that subtree and the workspace list shows only that space's workspaces, optionally with a per-space accent so the whole UI says where you are. "Soon to come" evolution per the user; not yet needed day-to-day as of this writing.

## What exists today (inventory)

**Two branches, no documents.** All detail lives in code; nothing was ever written down before this assessment.

- `feature/scoped-spaces-v2` (6 commits, June 2026): the foundation. Adds `space-manager.ts` (352 lines, complete and coherent), file-explorer filtering, spaces hierarchy in the sidebar.
- `bugfix/space-improvements` (5 more commits on top; **this is the real tip**, not the feature branch): folder deletion/rename handling for spaces, Create Space button, edit/delete action buttons on space rows.
- Net: ~1,600 added lines across `space-manager.ts` (new), `main.ts` (+505), `workspace-sidebar-view.ts` (+230), `styles.css` (+132).
- Era: branched from v2.15.0, files at repo root (predates the `src/` restructure), pre-rename `workspace-*` CSS classes, pre-notify, pre everything from v2.16 through v2.26.

### The architecture the code implies (reconstructed from the branch, not from memory)

- `Space { id, name, rootPath, icon, iconColor, ... }` where `rootPath` is `/` for the full vault or a directory like `Projects/Work`.
- `SpaceManager` holds a **`WorkspaceManager` per space** (`workspacesBySpace: spaceId -> WorkspacesStorage`) and exposes `getActiveManager()`.
- **The pivotal line**: on the branch, the plugin's own `getWorkspaceManager()` returns `spaceManager.getActiveManager()`. The entire existing plugin becomes "the workspace layer of whichever space is active," untouched.
- `FULL_VAULT_SPACE_ID = '__full_vault__'`: the vault itself is just the default space with `rootPath: "/"`. Today's plugin behavior is literally "Spaces with one space."
- File-explorer scoping is CSS-driven (`isPathInActiveSpace()` feeding selectors that hide out-of-scope explorer items), plus a `data-space-scope` attribute on `<body>` for theming.
- Vault events (folder rename/delete) update space `rootPath`s, from the bugfix branch.

## Fork, or integrate? The code already answered

The user's instinct was possibly to fork the project and disable workspace-navigator when using the Spaces one, because of remembered interop issues. Assessment: **do not fork; re-found Spaces as a layer inside this plugin.** Reasons:

1. **Spaces is architected as a superset, not a sibling.** With `getWorkspaceManager()` delegating to the active space's manager and full-vault as the default space, a "Spaces plugin" would contain 100% of workspace-navigator. A fork means maintaining a diverged copy of everything this plugin is, while wsn keeps evolving; the two-week window of v2.20 to v2.26 alone produced twelve releases of drift (order-maintenance fixes, deletion safety, the notify layer, the `wn-` prefix migration, empty-layout support, the API/MCP surface, the CDP suite). A fork inherits none of it and re-fights every bug.
2. **The interop problem dissolves instead of being managed.** Two plugins fighting over layouts, the status bar, and `data.json` is the interop issue; one plugin where zero-configured-spaces IS the current behavior has no interop with itself. The remembered issues most likely came from running the spaces-era build alongside or instead of release builds against the same vault data; that is a symptom of the superset being run as a sibling.
3. **Every automation investment carries over free**: the local API, MCP server, and CDP verification suite would need duplication in a fork, but extend naturally in-plugin (see below).
4. The one argument FOR forking, blast-radius protection while Spaces stabilizes, is better served by a **settings gate**: `spacesEnabled` (default off) with the spaces UI, storage migration, and explorer filtering completely inert when off. Daily driving stays on the stable path; Vault-WSN-Test and the CDP suite exercise the enabled path.

## Re-founding plan (when picked up; the branch is reference-only, per the standing roadmap note)

The branches predate the restructure and every hardening pass, so code moves by **re-implementation with the branch open as reference**, not by rebase/merge. Sketch:

1. **Storage layer**: port `space-manager.ts` into `src/` against today's `WorkspaceManager` (which has since gained `moveWorkspaceToGroup`, `resetAllWorkspaces`, MRU stamps, empty-layout support). Migration: existing `WorkspacesStorage` becomes `workspacesBySpace[FULL_VAULT_SPACE_ID]`; reversible, and a no-op when `spacesEnabled` stays off.
2. **The delegation pivot**: `getWorkspaceManager()` returns the active space's manager. Nearly all existing code is untouched by design; the CDP suite will prove it (full regression must stay green with spaces off AND with one full-vault space).
3. **Sidebar**: spaces level above groups, using today's `wn-` classes, notify, confirm modals, and rulebook idioms (the branch's UI predates all of them).
4. **Explorer scoping + theming**: re-derive the CSS filtering against current Obsidian (the branch needed two rounds of selector fixes in June; selectors have likely drifted again), `data-space` on body per the existing theming-hook roadmap item.
5. **Deletion safety**: space deletion is tier-2 catastrophic (it holds a whole workspace set); reuse `TypedConfirmationModal`.
6. **Verification**: `verify-spaces.mjs` in the CDP suite, following the counts-first rules; plus regression: all existing scripts green with spaces off.

## Roadmap items that belong to (or must be aware of) Spaces

The user is right that much of the roadmap is really Spaces-shaped. Per item:

- **Per-workspace theming hook**: subsumed. `data-workspace-name` exists; the branch already adds `data-space-scope`. One theming recipe should cover both levels.
- **Create workspace/group from folder**: sibling feature. Right-click folder gains "Create space from folder" as the third option, and it is the most natural of the three (a folder IS a space's rootPath). Build the workspace/group version space-aware from the start: created items land in the active space.
- **File pinned to a workspace**: binding becomes `path -> (space, workspace)`. The roadmap entry's note stands: if Spaces lands first, pins may become derived defaults; if pins land first, the map needs a space column added at migration time.
- **Sidebar filter box**: weaker with Spaces (scoping is the better filter); keep deferred.
- **Local API / MCP**: needs a space dimension: `GET /spaces`, space field in `/status` and `/workspaces`, `switch_space` tool, and `reveal_note` crossing spaces (a note in another space's subtree should offer/perform a space switch first; the response should say the space changed). Workspace names are only unique per space, so API calls referencing workspaces by bare name need a space qualifier or active-space default.
- **Rename position-jump bug**: space-agnostic; fix any time, benefits both.
- **Deletion safety, notify, wn- prefix, rulebook conformance**: already done on main; the re-founded spaces UI inherits them, which is exactly why re-founding beats rebasing.

## Recommended sequencing

1. Fix the rename position-jump bug (small, space-agnostic, standing annoyance).
2. Build folder right-click (space-aware data model from day one, even before spaces ship: a `spaceId` field that is always `__full_vault__` costs nothing).
3. Re-found Spaces behind `spacesEnabled` per the plan above.
4. File-pinning and API space-awareness after Spaces stabilizes.

## Open questions for the user (deferred until pickup)

- Can a workspace ever span spaces, or is strict per-space ownership right? (The branch says strict; strict is simpler and probably correct.)
- Should switching spaces auto-load that space's last workspace, or land on a space "home"?
- Explorer scoping: hard filter (branch behavior) or dim-but-visible out-of-scope items?
- Does the status bar show `space › group › workspace`, and does the `.Workspace Navigator` display name survive a plugin whose headline becomes Spaces?

## Session provenance

Assessed in the workspace-navigator session of 2026-08-28 (post-v2.26.1), from `feature/scoped-spaces-v2` and `bugfix/space-improvements` read at their tips. No spaces code was executed; confidence about "what worked in June" comes from commit messages and session memory, not from running the branch.
