# Workspace Navigator - Roadmap

**Current Version:** v2.20.0
**Last Updated:** 2026-07-29

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

---

## Notes

- The two primary surfaces are the **sidebar** and the **status-bar switcher**; the standalone editor modal is on its way out (see Planned).
- The switcher's search box remains disabled by default (code retained behind the `showSearchBox` setting).
- Scoped Spaces work is parked on `feature/scoped-spaces-v2` (reference only — predates the restructure).
