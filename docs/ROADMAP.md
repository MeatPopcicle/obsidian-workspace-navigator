# Workspace Navigator - Roadmap

**Current Version:** v2.26.0
**Last Updated:** 2026-08-26

---

## Primary Surfaces

The plugin is intentionally driven by **two** surfaces only:

1. **Sidebar view** — the tree of groups → workspaces → files (primary).
2. **Status-bar widget** — click to open the grouped switcher modal.

The separate "Manage Workspaces" editor modal is **slated for removal** (see Planned) — its functionality is covered by the sidebar.

---

## Implemented Features

### Core Functionality
- [x] Navigation layout memory per workspace (folder expansion states)
- [x] Alphabetical/numeric workspace sorting (memoized)
- [x] Manual sort order with drag-drop
- [x] Status bar indicator with workspace name
- [x] Fuzzy search switcher modal (opened from the status bar)
- [x] Workspace renaming (inline or hover button)
- [x] Workspace deletion (trash icon / context menu)
- [x] Workspace duplication
- [x] Create new workspace
- [x] Save shortcuts (Shift+Enter, Alt+Enter, Shift+Click)
- [x] Active workspace indicator
- [x] Auto-save on workspace switch
- [x] Auto-save on layout change
- [x] Import from core Workspaces plugin
- [x] Debug mode (gated logging + debug-only commands)

### Groups & Organization
- [x] Workspace groups (categorization)
- [x] Group drag-drop reordering
- [x] "No Group" section reorderable
- [x] Collapsible groups (incremental re-render on toggle)
- [x] Robust group lifecycle (rename/delete maintain order + styling; orphan pruning on load)

### Styling
- [x] Workspace icons (Lucide icon picker)
- [x] Workspace colors
- [x] Workspace text formatting (bold, italic)
- [x] Group icons and colors
- [x] Theme-proof layout (fixed px units)

### UI Options
- [x] Transparent modal option
- [x] Configurable keyboard shortcuts display
- [x] Configurable style controls visibility

---

## Planned

### Done this round (v2.17 work)
- [x] **Last-workspace toggle** — "Switch to last workspace" command that bounces between the two most-recently-active workspaces. (Bind a hotkey in Settings → Hotkeys.)
- [x] **Removed the "Manage Workspaces" editor modal** — consolidated to the sidebar + status-bar switcher; `workspace-editor.ts` and its CSS deleted.
- [x] **Updated shipped defaults** — auto-save on switch **on**, auto-save on layout change **on**, manual sort order **on**, transparent modal **on**, show keyboard shortcuts **off**.

### Deferred
- [ ] **Sidebar filter box** — type-to-filter the workspace tree. Deferred; not clearly useful yet.

### Future
- [ ] **Per-workspace theming hook** — set a `data-workspace-name` (and, later, `data-space`) attribute on `<body>` so the whole UI can be tinted per workspace/client via CSS. Parked for later, alongside Scoped Spaces.
- [ ] **File pinned to a workspace ("this file always opens in workspace XYZ")** — a per-file binding so opening a bound note switches to its designated workspace first. Added 2026-08-27; challenges foreseen and deliberately deferred until pickup, sketched here so the thinking isn't lost:
  - *Interception point*: Obsidian has no "before file open" hook; the realistic option is reacting on `file-open` (switch after the fact, then re-reveal the note in the target workspace), which must not loop: the reveal-triggered open of the same file has to be recognized and ignored.
  - *When it should NOT fire*: quick-peek flows (hover preview, search result glance, backlink click?) would make an always-switch aggressive. Likely needs a bypass (modifier-click or a per-binding "only via quick switcher / explorer" scope), or an opt-in prompt-once behavior.
  - *Binding storage and UX*: per-file map in plugin data (`path -> workspace`), set via file context menu ("Always open in workspace..."), cleared the same way; rename/move tracking via the vault rename event.
  - *Interaction with reveal_note / MRU*: a binding should outrank MRU in the reveal policy; the API response should say the binding decided.
  - *Relation to Scoped Spaces*: a binding is a per-file version of what Spaces does per-subtree; if Spaces lands, bindings may become derived defaults rather than a separate map.

---

## Parked / Future

- **Scoped Spaces** — the big evolution: multiple clients in a single vault, with the file explorer **and** the workspace list scoped to one client's subtree at a time (optionally with a per-space accent). A foundation exists on the `feature/scoped-spaces-v2` branch, but it predates the v2.13–2.16 restructure — when revisited, it should be **re-founded cleanly on current `main`**, not rebased from that branch.

---

## Won't Do (decided against)

- **Centered switcher modal** — the last-workspace toggle covers the actual need; no separate centered command-palette switcher.
- **Ribbon icon (show/hide)** — not wanted.
- **Pinned / favorite workspaces** — redundant; quick workspace access is already the whole point of the plugin.
- **Workspace templates** — not wanted (was an AI suggestion).
- **Unsaved-layout indicator** — with auto-save-on-switch and auto-save-on-layout-change both on (now the defaults), a workspace is effectively always saved (only a ~2s debounce window), so the indicator would never meaningfully show. It would only matter under a manual-save workflow, which isn't the intended use.
- **Workspace descriptions, recent-list panel, hover preview, file overrides with template variables** — previously floated, not planned.

---

## Completed Phases

### Phase 1 - Core Features (v1.x)
Delete, create, save shortcuts, active indicator.

### Phase 2 - Enhanced UX (v2.0-2.5)
Duplication, auto-save on layout change, import/export.

### Phase 3 - Organization (v2.6-2.10)
Groups, group styling, workspace styling, drag-drop reordering.

### Phase 4 - Polish (v2.11-2.12)
Fixed px layout, transparent modal, search box removal.

### Phase 5 - Audit & Hardening (v2.13-2.16)
Full multi-pass code review and cleanup, landed in tiers:
- **Safety:** fixed a `saveNavigationLayout` data-loss race, a stuck `isLoadingWorkspace` flag, and unmigrated workspace order on group rename/delete.
- **Cruft:** removed leftover debug instrumentation, deleted dead code (incl. the unused `debug-logger.ts`), gated debug commands behind debug mode, guarded auto-backup for mobile, synced version files.
- **Leaks & correctness:** listener leaks (editor refresh, tab indicators), the `\x00nogroup` sentinel bug, stale collapse-state, confirm-modal hardening, `defaultGroup` validation.
- **Structure:** moved sources into `src/`, consolidated docs, expanded `.gitignore`; `STYLE_MAPS`-driven group styling, memoized name sort, incremental sidebar render, and a typed surface over Obsidian's private chooser internals.

### Phase 6 - Surfaces & active marker (v2.17-2.18)
- **v2.17:** removed the Manage Workspaces editor modal (sidebar + status-bar switcher only); added the "Switch to last workspace" toggle; new shipped defaults.
- **v2.18:** status bar can show the active workspace's group (configurable); explicit active-workspace checkmark in the sidebar and switcher; configurable active-row highlight (accent bar + tinted fill) that no longer overrides custom name colors.

### Phase 7 - Theming & settings (v2.19)
- **Style Settings integration:** plugin-specific `--wn-*` CSS variables exposed via a `/* @settings */` block — active-highlight colors, tree guide-line color/visibility, row hover, badge colors, and sizing (density, font scale, bar width, checkmark size, corner radius). Defaults inherit the theme.
- **Style Settings shortcut:** an "Open Style Settings" button in the settings tab, plus toggleable palette buttons in the sidebar header and switcher (gated on Style Settings being installed).
- **Settings panel redesign:** six purpose-based collapsible sections with indented, conditionally-shown dependent options.

### Phase 8 - Switcher fixes (v2.20)
- **Empty-group heading no longer switches:** clicking an empty group's heading in the switcher now toggles it open/closed instead of attempting to load a nonexistent workspace.
- **Empty-group corners fixed:** an empty group (no workspaces) renders as a full standalone card with rounded bottom corners, matching collapsed groups.
- **Status-bar icon:** the status-bar widget now shows the active workspace's icon (falling back to its group's icon, then the default), colored to match.

### Phase 9 - File-op simplification & drag fixes (v2.21)
- **Context-menu simplification:** removed "Close in other workspaces" / "Close in all workspaces" (tab menu) and "Remove from other workspaces" (sidebar); removed the orphaned `removeFileFromAllWorkspaces`.
- **"Open in N other workspaces" submenu:** both context menus now list which other workspaces have the file open; clicking a name switches to it (new `switchToWorkspace()` honors auto-save-on-switch).
- **Drag-into-group fix:** new `moveWorkspaceToGroup()` maintains both groups' manual-order arrays, so a dropped workspace lands where expected instead of sorting to the bottom; all user-driven group moves converted. The expanded group body's indent padding now accepts drops.
- **Status-bar sync on create:** creating a workspace (sidebar or modal) updates the status bar immediately; the modal path also refreshes the sidebar.
- **Small fixes:** awaited `saveSettings()` in file drag-drop; sidebar file ops now refresh live tab badges.

### Phase 10 - Reliability & UI rulebook compliance (v2.22-2.24)
- **v2.22:** modal group-delete confirmation; file-op flaw fixes (dual leaf-shape matching, container pruning, root-leaf removal, tabs-creation for empty layouts, correct view types, honest Moved/Sent notices, persisted moves, active-workspace removal closes the live tab, vanished-file guards, one shared `sendFileToWorkspace()`).
- **v2.23:** unconditional delete confirmation (toggle removed); red danger CTA on the confirm modal; `notify()` wrapper for all notices (check/cross prefixes, errors linger 8s).
- **v2.24:** full rulebook migration (see `docs/rulebook-migration.md`): `wn-` class prefix (393 renames), `setIcon()` everywhere (no hand-rolled SVGs), hardcoded colors removed, `:focus-visible` on every interactive element + keyboard reveal of hover-only buttons, kit token scale on `.wn-root`, settings danger zone + reset-to-defaults, sidebar first-run empty state, deduped style-modal builders, legacy icon class removed, group-header styling moved from inline JS to CSS. The Style Settings block stays as a documented exception.
- **v2.25:** "Delete all workspaces" in the settings danger zone, guarded by the new typed-name confirmation modal (type DELETE; rulebook tier-2). Also ships the `.Workspace Navigator` display-name grouping prefix.
- **v2.25.1:** two bugs found by the CDP verification suite's first live runs: the auto-save debounce resurrecting deleted workspaces (name now re-resolved at fire time), and switcher heading clicks closing the modal (selection intercepted, toggles in place).

### Phase 11 - Automation surface (v2.26)
- **Local HTTP API:** loopback-only, token-authed, desktop-only, off by default (Settings > Local API, default port 27125): status, workspace listing with MRU order, workspace-for-note lookup, switch, and reveal.
- **Reveal-note policy:** MRU wins among multiple owning workspaces (alternatives reported); no switch when the current workspace contains the note; a workspace-less note opens in place and is reported.
- **MCP server:** `mcp/server.mjs`, zero-dependency stdio bridge exposing list_workspaces / current_workspace / workspace_for_note / switch_workspace / reveal_note.
- **Command:** "Switch to workspace containing current note" (palette + invokable by id for tooling).
- **MRU tracking:** workspaces stamp `lastUsedAt` on load.
- Verified end-to-end by the new `scripts/verify-api.mjs` (auth, endpoints, all three reveal policies, MCP stdio round-trips).

---

## Notes

- The two primary surfaces are the **sidebar** and the **status-bar switcher**; the standalone editor modal is on its way out (see Planned).
- The switcher's search box remains disabled by default (code retained behind the `showSearchBox` setting).
- Scoped Spaces work is parked on `feature/scoped-spaces-v2` (reference only — predates the restructure).
