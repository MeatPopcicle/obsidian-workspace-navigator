# Workspace Navigator - Feature Analysis & Roadmap

## Current Implementation Status (v1.0.6)

### Implemented Features
- ✅ Navigation layout memory per workspace (including folder expansion states)
- ✅ Alphabetical/numeric workspace sorting
- ✅ Status bar indicator with workspace name
- ✅ Fuzzy search modal for workspace switching
- ✅ Workspace renaming (Ctrl+Enter or hover button)
- ✅ Configurable layout behavior settings
- ✅ Auto-save on workspace switch option
- ✅ Debug mode with console logging
- ✅ Diagnostic export to file

---

## Missing Features from Workspaces Plus

### High Priority (Core Functionality)

#### 1. Delete Workspace
- **Description**: Remove workspaces permanently
- **Features**:
  - Shift+Delete keyboard shortcut in modal
  - Delete button (trash icon) next to each workspace
  - Optional confirmation dialog before deletion
  - Settings toggle for delete confirmation
- **Old Plugin**: Lines 239-256, 304-310 in workspaceModal.ts

#### 2. Create New Workspace
- **Description**: Create new workspaces from current layout
- **Features**:
  - Type new name in modal and press Shift+Enter to create
  - "Save as new workspace" button when no match found
  - Creates workspace from current layout state
  - Automatically registers hotkey command for new workspace
- **Old Plugin**: Lines 67-74, 224-231 in workspaceModal.ts

#### 3. Save Workspace Shortcuts
- **Description**: Multiple ways to quickly save workspace state
- **Features**:
  - Shift+Click on status bar to quick-save current workspace
  - Shift+Enter in modal to save current workspace and stay in modal
  - Alt+Enter to save current workspace AND switch to selected one
  - Visual feedback with notices
- **Old Plugin**: Lines 252-257 (main.ts), 379-387 (workspaceModal.ts)

#### 4. Visual Indicators in Modal
- **Description**: Enhanced modal UI with status indicators
- **Features**:
  - Checkmark icon showing which workspace is currently active
  - Platform indicator (desktop/mobile icon) for each workspace
  - Better visual hierarchy with icons
  - Active workspace stands out visually
- **Old Plugin**: Lines 286-293, 323-333 in workspaceModal.ts

---

### Medium Priority (Nice to Have)

#### 5. Workspace Descriptions
- **Description**: Optional text description for documentation
- **Features**:
  - Text field in settings for each workspace
  - Shows below workspace name in modal
  - Helps remember workspace purpose
- **Old Plugin**: Lines 234-242, 312-321 in settings.ts & workspaceModal.ts

#### 6. Ribbon Icon Control
- **Description**: Customizable ribbon (sidebar) icon visibility
- **Features**:
  - Toggle to show/hide workspace switcher in ribbon
  - Option to replace native workspace ribbon icon
  - Better integration with Obsidian UI
- **Old Plugin**: Lines 162-183 in main.ts

#### 7. Save on Layout Change
- **Description**: Automatic workspace saving
- **Features**:
  - Auto-save workspace when any layout change happens
  - Debounced (2 second delay) to avoid excessive saves
  - Toggle in settings
  - Skips save during workspace load operations
- **Old Plugin**: Lines 277-290, 308-315 in main.ts

#### 8. Workspace-Specific CSS Styling
- **Description**: Enable custom CSS per workspace
- **Features**:
  - Add `data-workspace-name` attribute to `<body>` element
  - Updates automatically when switching workspaces
  - Allows users to write CSS like: `body[data-workspace-name="Research"] { ... }`
  - Useful for workspace-specific theming
- **Old Plugin**: Lines 317-324 in main.ts

---

### Low Priority (Advanced Features)

#### 9. File Overrides with Template Variables
- **Description**: Dynamic file loading per workspace pane
- **Features**:
  - Override specific panes with dynamic file paths
  - Support template variables like `{{date:YYYY-MM-DD}}`
  - Useful for daily notes or journal workflows
  - Per-workspace configuration in settings
- **Old Plugin**: Lines 254-280 in settings.ts, 184-206 in utils.ts

#### 10. Workspace Modes System
- **Description**: Save Obsidian settings per "mode"
- **Status**: ⚠️ Very complex, probably skip
- **Features**:
  - Save editor settings (live preview, vim mode, etc.)
  - Save appearance settings (theme, font size, etc.)
  - Toggle between modes within a workspace
  - Separate status bar indicator
- **Complexity**: High - modifies core Obsidian settings, requires careful handling

---

## Suggested New Features (Not in Original Plugin)

### Organization & Workflow

#### 11. Workspace Duplication
- **Description**: Clone existing workspace
- **Features**:
  - Right-click menu or keyboard shortcut
  - Copies layout, folder states, and settings
  - Prompts for new name
  - Quick way to create variations

#### 12. Workspace Pinning
- **Description**: Pin favorites to top
- **Features**:
  - Pin/unpin toggle in modal
  - Pinned workspaces always at top of list
  - Persist pin state in plugin data
  - Visual pin indicator

#### 13. Recent Workspaces
- **Description**: Quick access to recently used
- **Features**:
  - Track last 5-10 accessed workspaces
  - Separate command: "Switch to recent workspace"
  - Show in submenu or separate modal
  - Ordered by recency

#### 14. Workspace Tags/Categories
- **Description**: Organize workspaces by category
- **Features**:
  - Assign tags (e.g., "Writing", "Research", "Projects")
  - Filter modal by category
  - Color-code by category
  - Settings UI for managing categories

### Enhanced UI/UX

#### 15. Workspace Icons
- **Description**: Visual identification with emojis/icons
- **Features**:
  - Optional emoji or icon per workspace
  - Shows in modal and status bar
  - Icon picker in settings
  - Improves visual scanning

#### 16. Better Empty State
- **Description**: Helpful onboarding for new users
- **Features**:
  - When no workspaces exist, show guide
  - Quick "Create your first workspace" button
  - Tips for effective workspace usage
  - Link to documentation

#### 17. Workspace Preview
- **Description**: Hover tooltips with details
- **Features**:
  - Hover over workspace to see info
  - Show last modified, file count, active tabs
  - Preview folder expansion states
  - Helps remember workspace contents

### Import/Export & Sharing

#### 18. Workspace Templates
- **Description**: Reusable workspace configurations
- **Features**:
  - Save workspace as template
  - Create new workspaces from templates
  - Built-in template library
  - Share templates across vaults

#### 19. Import/Export Individual Workspaces
- **Description**: Portable workspace configs
- **Features**:
  - Export workspace config to JSON file
  - Import from JSON
  - Share with other users
  - Validation on import

#### 20. Workspace Backup/Restore
- **Description**: Version history for workspaces
- **Features**:
  - Automatic backup of workspace configs
  - Restore previous workspace states
  - Configurable backup frequency
  - Manual backup command

---

## Implementation Roadmap

### Phase 1 (v1.1.0) - Core Missing Features
**Priority**: Critical
**Target**: Next release

1. **Delete Workspace** - Remove workspaces with confirmation
2. **Create New Workspace** - Create from modal with Shift+Enter
3. **Save Workspace Shortcuts** - Shift+Click, Shift+Enter, Alt+Enter
4. **Active Workspace Indicator** - Checkmark icon in modal

**Estimated Complexity**: Medium
**Dependencies**: None
**Breaking Changes**: None

---

### Phase 2 (v1.2.0) - Enhanced UX
**Priority**: High
**Target**: 2-3 releases out

1. **Workspace Descriptions** - Text descriptions in settings
2. **CSS Data Attribute** - `data-workspace-name` for theming
3. **Workspace Duplication** - Clone existing workspaces
4. **Save on Layout Change** - Auto-save option

**Estimated Complexity**: Low-Medium
**Dependencies**: Phase 1 complete
**Breaking Changes**: None

---

### Phase 3 (v1.3.0) - Organization Features
**Priority**: Medium
**Target**: 4-5 releases out

1. **Workspace Pinning** - Pin favorites to top
2. **Recent Workspaces** - Quick access to recent
3. **Ribbon Icon Control** - Show/hide ribbon button
4. **Platform Indicators** - Desktop/mobile icons

**Estimated Complexity**: Medium
**Dependencies**: Phase 1 & 2 complete
**Breaking Changes**: None

---

### Phase 4 (v2.0.0) - Advanced Features
**Priority**: Low
**Target**: Future major release

1. **Workspace Tags/Categories** - Organize by category
2. **File Overrides with Templates** - Dynamic file loading
3. **Import/Export** - Share workspaces
4. **Workspace Icons** - Emoji/icon per workspace

**Estimated Complexity**: High
**Dependencies**: All previous phases
**Breaking Changes**: Possible data structure changes

---

## Technical Notes

### Phase 1 Implementation Details

#### Delete Workspace
- Add `deleteWorkspace()` method to main plugin
- Hook into workspace plugin's `deleteWorkspace()`
- Add confirmation modal (similar to old plugin's confirm.ts)
- Add Shift+Delete handler in modal scope
- Add delete button with trash icon SVG
- Update hotkey commands list after deletion

#### Create New Workspace
- Add "no suggestion" handler in modal
- Add Shift+Enter handler for creation
- Call workspace plugin's `saveWorkspace()` with new name
- Add to hotkey commands automatically
- Show success notice
- Update modal suggestions list

#### Save Workspace Shortcuts
- Add Shift+Click handler to status bar
- Add Shift+Enter handler in modal (save and stay)
- Add Alt+Enter handler in modal (save and switch)
- Update instructions based on saveOnSwitch setting
- Show appropriate notices

#### Active Workspace Indicator
- Add checkmark SVG icon to active workspace in modal
- Style with CSS (position absolute, left side)
- Update when workspace changes
- Use consistent styling with old plugin

### Data Structures
No changes to core data structures needed for Phase 1.
All features work with existing workspace plugin data model.

### Testing Checklist for Phase 1
- [ ] Delete workspace with confirmation enabled
- [ ] Delete workspace with confirmation disabled
- [ ] Delete active workspace (should handle gracefully)
- [ ] Delete via Shift+Delete shortcut
- [ ] Delete via trash icon click
- [ ] Create workspace via Shift+Enter
- [ ] Create workspace via "no match" button
- [ ] Create workspace with existing name (should handle)
- [ ] Save via Shift+Click on status bar
- [ ] Save via Shift+Enter in modal
- [ ] Save and switch via Alt+Enter in modal
- [ ] Active workspace shows checkmark
- [ ] Checkmark updates after switch
- [ ] All features work with debug mode enabled

---

## References

### Old Plugin Files
- `src/main.ts` - Core plugin logic, event handling, hooks
- `src/workspaceModal.ts` - Modal UI, keyboard shortcuts, rendering
- `src/settings.ts` - Settings tab, per-workspace config
- `src/confirm.ts` - Confirmation dialog implementation
- `src/utils.ts` - Helper functions, workspace operations

### Key Code Patterns
- Workspace plugin wrapping via function replacement
- Scope-based keyboard shortcuts
- FuzzySuggestModal customization
- Data attributes on body for theming
- Debounced save operations

---

## Questions for Consideration

1. **Delete Confirmation**: Should we default to enabled or disabled?
2. **Keyboard Shortcuts**: Keep same as old plugin or modernize?
3. **Modal Behavior**: Close on save or stay open? (configurable?)
4. **Naming**: Keep "Navigator" or change to "Plus" like original?
5. **Instructions**: Show all shortcuts or only relevant ones based on settings?

---

## Version History

- **v1.0.6** (2025-10-13) - Fixed folder expansion state timing issue
- **v1.0.5** (2025-10-13) - Added diagnostic export to file
- **v1.0.4** (2025-10-13) - Added debug mode logging
- **v1.0.3** (2025-10-13) - Changed to inject folder state into workspace data
- **v1.0.2** (2025-10-13) - Added workspace rename feature
- **v1.0.1** (2025-10-13) - First attempt at folder state fix
- **v1.0.0** (2025-10-13) - Initial release with core features
