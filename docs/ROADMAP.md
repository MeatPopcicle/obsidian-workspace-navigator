# Workspace Navigator - Roadmap

**Current Version:** v2.12.0
**Last Updated:** 2025-12-23

---

## Implemented Features

### Core Functionality
- [x] Navigation layout memory per workspace (folder expansion states)
- [x] Alphabetical/numeric workspace sorting
- [x] Manual sort order with drag-drop
- [x] Status bar indicator with workspace name
- [x] Fuzzy search modal for workspace switching
- [x] Workspace renaming (Ctrl+Enter or hover button)
- [x] Workspace deletion (Shift+Delete or trash icon)
- [x] Workspace duplication (Ctrl+D)
- [x] Create new workspace (Shift+Enter)
- [x] Save shortcuts (Shift+Enter, Alt+Enter, Shift+Click)
- [x] Active workspace indicator (checkmark)
- [x] Auto-save on workspace switch
- [x] Auto-save on layout change
- [x] Import from core Workspaces plugin
- [x] Debug mode with console logging

### Groups & Organization
- [x] Workspace groups (categorization)
- [x] Group drag-drop reordering
- [x] "No Group" section reorderable
- [x] Collapsible groups

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

## Active Development

### In Progress
- [ ] Modal animations (experiment branch - needs performance testing)

### Next Up
- [ ] Ribbon icon control (show/hide ribbon button)

---

## Deprioritized (Personal Use)

These features are not needed for current use case but documented for potential future public release:

- Workspace descriptions (text field per workspace)
- Workspace pinning (favorites at top)
- Recent workspaces list
- Workspace preview on hover
- CSS data attribute (`data-workspace-name` on body for per-workspace theming)
- File overrides with template variables (dynamic file loading)

---

## Completed Phases

### Phase 1 - Core Features (v1.x)
Completed: Delete, create, save shortcuts, active indicator

### Phase 2 - Enhanced UX (v2.0-2.5)
Completed: Duplication, auto-save on layout change, import/export

### Phase 3 - Organization (v2.6-2.10)
Completed: Groups, group styling, workspace styling, drag-drop reordering

### Phase 4 - Polish (v2.11-2.12)
Completed: Fixed px layout, transparent modal, search box removal

---

## Notes

- Search box permanently disabled (code retained)
- Animation experiment on `experiment/modal-animations` branch
