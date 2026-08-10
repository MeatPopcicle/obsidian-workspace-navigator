# Rulebook Migration Plan

Compliance audit of workspace-navigator against rules 1-11 of the Obsidian Plugin UI Rulebook (vault: `300 Technological/70 Projects/Obsidian Plugin UI Rulebook.md`), performed 2026-08-09 against commit `525fd4d` (v2.21.2). Phase 1 was a cold read of the code against rules 1-11 only; phase 2 reconciled against rulebook section 12 and `docs/ui-inventory.md`. Reference implementation for shared idioms: `obsidian-ui-kit-demo` (`src/notify.ts`, `src/modals.ts`, token block in `styles.css` under `.ukd-root`).

## Migration checklist (highest leverage first)

| # | Item | Rule | Files | Size |
|---|------|------|-------|------|
| 1 | Remove the "Confirm before deleting" toggle; confirmation becomes unconditional | 7 | settings.ts, workspace-sidebar-view.ts, workspace-modal.ts | S |
| 2 | Add confirmation to the switcher modal's group delete (currently none at all) | 7 | workspace-modal.ts | S |
| 3 | ConfirmModal danger CTA: red `setWarning()`-style button instead of `mod-cta` | 7 | confirm-modal.ts | S |
| 4 | Adopt `notify()` / `notifyProgress()` wrapper; migrate all 98 bare `new Notice()` calls | 6 | new notify.ts, main.ts, workspace-modal.ts, workspace-sidebar-view.ts, workspace-manager.ts, settings.ts | M |
| 5 | Replace hand-rolled `innerHTML` SVGs and the text glyph checkmark with `setIcon()` | 8 | group-header.ts, workspace-modal.ts, workspace-sidebar-view.ts | S |
| 6 | Purge hardcoded colors from styles.css (2 hex hovers, 1 rgba shadow) | 1 | styles.css | S |
| 7 | Add `:focus-visible` styles to every interactive element; focus-reveal for hover-only action buttons | 9 | styles.css | M |
| 8 | Standardize the class prefix: rename bare `workspace-*` classes to `wn-*` | 3 | styles.css, all src/*.ts | L |
| 9 | Move static inline styling from TS into styles.css (group-header.ts and the modal card styling) | 1 | group-header.ts, workspace-modal.ts, styles.css | L |
| 10 | Adopt the kit token scale on a container class applied to sidebar view, settings tab, and owned modals | 2 | styles.css, workspace-sidebar-view.ts, settings.ts, workspace-modal.ts | M |
| 11 | Settings tab: add reset-to-defaults behind a danger confirm; give Maintenance a bordered danger-zone treatment | 4 | settings.ts, styles.css | S |
| 12 | Decide the Style Settings block's fate (move `--wn-*` knobs into plugin settings, or drop) | 10 | styles.css, settings.ts | M |
| 13 | First-run empty state in the sidebar (icon, one-line hint, "create workspace" CTA) | 5 | workspace-sidebar-view.ts | S |
| 14 | Deduplicate WorkspaceStyleModal / GroupStylePickerModal shared DOM (icon grid, swatch row) toward kit FormModal idioms | 11 | workspace-modal.ts | M |
| 15 | Delete the legacy `.workspace-icon` monospace icon class | 8 | styles.css | S |
| 16 | Document the shared-data.json-across-symlinked-vaults caveat | 4 | docs/ | S |

Items 1-3 ship together as one safety pass. Item 8 before item 9 avoids renaming classes that are about to be created; if sequencing them together, do both in a single sweep with a Vault-Test walkthrough afterward. Item 12 blocks nothing and can trail.

## Phase 1 findings by rule

### Rule 1: colors and theme variables

- styles.css:762 `color: #4ade80` and styles.css:767 `color: #c4b5fd` (add-group / add-workspace hover states). Hardcoded hex, banned.
- styles.css:407 `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)` on the drag ghost. Raw rgba literal.
- styles.css:355 and styles.css:1097 `var(--wn-active-fill, hsla(var(--interactive-accent-hsl), 0.12))`. An hsla() literal inside a var() fallback, the exact pattern rule 1 bans. See "rulebook bugs" below, this one is arguably legitimate.
- Static inline styling from TS at scale: group-header.ts has 57 `.style.` mutations (the base card styling for group headers, per the comment at group-header.ts:53 "CSS classes don't work reliably in modals"), workspace-modal.ts has 103 (a mix: drag-ghost positioning is genuinely dynamic and permitted, but row padding, min-heights, card backgrounds, and button offsets at workspace-modal.ts:1685-1830 are static), workspace-sidebar-view.ts has 10, main.ts 3, settings.ts 5 (the settings ones toggle `display` for dependent rows, which is state-driven and borderline acceptable).
- No runtime `<style>` injection anywhere. Clean on that clause.
- The color-swatch palette hex values in workspace-modal.ts:109-118 are data (user-selectable colors rendered as swatches), which rule 1 explicitly permits as genuinely dynamic values.

### Rule 2: design tokens

- No tokens defined on `:root` (clean on the prohibition).
- No kit container class on any surface; the plugin predates the kit. Sizing is raw px throughout (14/16/20/24px icons, 4/6/8px radii, ad hoc paddings), not the 3-step spacing / 2-step radius / 2-step type scale.
- The status bar correctly uses raw Obsidian variables for text, but its hover reads the plugin custom property `var(--wn-hover, ...)` (styles.css:155), which ties it to the Style Settings block (rule 10 grandfather).

### Rule 3: naming

- The dominant prefix is bare `workspace-` across roughly 40 selector families (`.workspace-sidebar-item`, `.workspace-group-header`, `.workspace-suggestion-item`, `.workspace-drag-handle`, ...). This plugin is the rulebook's own cautionary example.
- Three prefixes coexist: `workspace-` (most), `workspace-navigator-` (status bar), `wn-` (settings sections, Style Settings classes). Standardize on one; `wn-` is shortest and already established in newer code.
- Plugin DOM injected into core-owned `.workspace-tab-header-inner` (main.ts:1120-1124, the `.workspace-tab-indicator` badge). Exempted by rule 3 until redesigned; no new instances found beyond it.
- State classes (`is-active`, `drop-above`, `drag-over`) are nested under prefixed parents in CSS, compliant. No global restyling of Obsidian utility classes found.

### Rule 4: settings tabs

- Native `Setting` API throughout, no custom DOM frameworks. Compliant.
- Six `<details>` sections with 20+ settings, which satisfies the size threshold for collapsible sectioning. Compliant.
- Debug logging toggle present (settings.ts:404). Compliant.
- Missing: a reset-to-defaults action behind a danger confirm (only "Reset all workspace styles" exists, which is narrower).
- Missing: the bordered danger zone. Destructive actions ("Import and overwrite" in Import & backup, "Reset all workspace styles" in Maintenance) sit in plain sections with no error-colored border or heading.
- Violation: the "Confirm before deleting" toggle (settings.ts:29, 58, 192-194) is exactly the per-plugin confirmation preference rule 4 and rule 7 prohibit.
- Status/connection line: not applicable, no backend. Async-populated fields: none. `saveData` persistence: compliant (with a serialized save queue).

### Rule 5: panels

- Sidebar is the dense tree idiom, switcher is a modal, no internal-tab panels. Vanilla DOM everywhere, no React. Compliant on structure.
- Chevron accordion: chevron left, title, count badge on collapsed groups, whole header clickable. Compliant.
- Missing: a first-run empty state. With zero workspaces the tree renders empty with no hint or CTA (workspace-sidebar-view.ts renderTree simply produces nothing beyond headers when there is nothing to show).

### Rule 6: feedback

- 98 bare `new Notice()` calls: main.ts 30, workspace-modal.ts 29, workspace-sidebar-view.ts 17, workspace-manager.ts 14, settings.ts 8. No notify wrapper, no success/error glyph distinction, no duration split, no progress notice.
- StatusBlock / inline error box: no long-lived backend state exists, so the role-split is largely not applicable; operation errors currently vanish with default-duration toasts, which the notify wrapper's 8s error duration addresses.

### Rule 7: destructive confirmation

- workspace deletion is confirmed only when the "Confirm before deleting" toggle is on (workspace-sidebar-view.ts:1194, workspace-modal.ts:1983). Toggled off, deletion is immediate. Prohibited path.
- Group deletion from the switcher modal (workspace-modal.ts:2341 onGroupDelete) has no confirmation under any setting. The sidebar's group delete does confirm (workspace-sidebar-view.ts:1206-1224). Surface inconsistency and an unconfirmed deletion path.
- The local ConfirmModal's accept button uses `mod-cta` (confirm-modal.ts:49), not the red danger CTA the contract specifies.
- No typed-name modal exists. Candidate tier-2 operations: "Import and overwrite" (deletes all workspaces first) arguably qualifies as catastrophic bulk.

### Rule 8: icons

- Hand-rolled `innerHTML` SVG icons: group-header.ts:160 (chevron), group-header.ts:274 (edit pencil), group-header.ts:292 (delete trash), workspace-modal.ts:1810 (delete), workspace-modal.ts:1829 (edit). All have Lucide equivalents already used elsewhere in the same codebase via `setIcon()`.
- Text glyph as icon: `' ✓'` appended to workspace names in the sidebar copy-to-workspace submenu (workspace-sidebar-view.ts:709).
- Legacy `.workspace-icon` class styled with `font-family: var(--font-monospace)` (styles.css:478 area) from a pre-Lucide icon system, dead weight.
- The `⚠️` emoji occurrences are console-log strings in workspace-manager.ts, not UI, and are out of scope for rule 8.

### Rule 9: accessibility

- Zero `:focus-visible` rules in styles.css. No interactive element (tree rows, action buttons, accordion headers, modal card buttons, status bar item) has a focus style beyond browser/theme defaults.
- Hover-only reveal of row action buttons (`opacity: 0` until `:hover`) has no `:focus-visible` reveal, so they are keyboard-invisible.
- Color-only state: the active workspace pairs color with a checkmark icon, compliant. No color-only toggles found.

### Rule 10: Style Settings

- Ships the only plugin `/* @settings */` block (styles.css:5-139, 16 entries over `--wn-*` variables). Grandfathered by the rule until migration; the migration decision (move knobs into plugin settings or drop them) is item 12 and has a real cost either way, see rulebook bugs.

### Rule 11: shared kit

- Nothing imported from obsidian-core-utilities; no kit code copied in. The local confirm-modal.ts predates the kit and diverges from the kit ConfirmModal (no warning CTA).
- Near-verbatim duplication between WorkspaceStyleModal and GroupStylePickerModal (icon grid, swatch row) is the in-repo dedup opportunity that should align with kit FormModal idioms when touched.

## Phase 2 reconciliation

Against rulebook section 12 (workspace-navigator entry):

- "rename `workspace-` classes to a proper prefix": confirmed, item 8.
- "tokenize raw px/hex against its own `--wn-*` set or the kit's": confirmed, items 6 and 10.
- "drop or migrate the Style Settings block": confirmed, item 12.
- "remove the delete-without-confirmation path": confirmed and understated, the modal group delete lacks confirmation even with the toggle on, items 1 and 2.
- "keep its ConfirmModal (it is the contract's base)": confirmed with a caveat, the kit's ConfirmModal has since diverged (danger CTA); keeping the local one still requires item 3.

Against docs/ui-inventory.md (generated 2026-08-03 from the same commit):

- Confirmed accurate: prefix analysis and collision risk, tab-indicator injection, hardcoded color list (both hex hovers, the rgba shadow, the swatch palette), bare-Notice-only feedback, no focus styling, legacy `.workspace-icon` wart, style-modal duplication, Style Settings block description, `saveData` persistence details.
- Stale/imprecise: the inventory counts five settings sections; there are six (it merged Theming into the count differently). Cosmetic only.
- Missed by both documents: the switcher modal's group delete has no confirmation at all (both describe deletion confirmation as uniformly gated by the toggle); the mixed three-prefix situation (`workspace-` / `workspace-navigator-` / `wn-`) as a standardization decision; the missing first-run empty state; the missing reset-to-defaults and danger-zone treatments in settings.
- Nothing in the inventory was found to be outright wrong about the code.

## Rulebook bugs and tensions (findings against the rulebook itself)

1. Rule 1's blanket ban on hsl()/rgb() literals, "not even as fallbacks", also bans `hsla(var(--interactive-accent-hsl), 0.12)`, which is Obsidian's own idiomatic alpha-tinting mechanism (the `-hsl` companion variables exist precisely for this). The rule should carve out alpha composition over standard `--*-hsl` variables; without it there is no variable-only way to get a translucent accent tint.
2. Rule 10 says the `--wn-*` options "either move into plugin settings or are dropped", but 16 theming knobs moved into the settings tab collides with rule 4's compactness goal and would roughly double the Appearance section. The ui-inventory's constraints section also notes users may have saved Style Settings values keyed to the current names. A third path (keep the block, namespaced, as an explicit documented exception like the tab-indicator exemption) deserves consideration in the rulebook.
3. Rule 1's "no inline style mutations for static styling" collides with a claim recorded in this codebase (group-header.ts comment: CSS classes are unreliable inside the suggest-modal DOM). The claim is plausibly wrong (the same file already uses CSS classes for interactive states in the same modal), but if it turns out true for base styles under some themes, the rule needs an investigation note rather than silent violation. Treat the item-9 migration as also validating or refuting that claim.
4. Rule 4 mandates a reset-to-defaults action for every plugin but does not define whether "defaults" includes destroying user data structures (here: workspace definitions vs settings). Worth one clarifying sentence; for this plugin the intended reading is settings-only.

## Session provenance

Audit performed in the workspace-navigator working session of 2026-08-09 (same session as the v2.20.0 through v2.21.2 releases). Phase 1 findings were formed from the code before reading rulebook section 12 or docs/ui-inventory.md, per the audit protocol.
