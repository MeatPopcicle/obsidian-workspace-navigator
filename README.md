# .Workspace Navigator

Enhanced workspace management for Obsidian with navigation layout memory and alphabetical sorting. (The leading dot in the display name is a personal-vault convention that groups my plugins at the top of Obsidian's Community Plugins list; the plugin id is unaffected.)

## Features

### 🎯 Core Features

- **Navigation Layout Memory**: Each workspace remembers its own sidebar state (open/closed, active tab, width)
- **Alphabetical Sorting**: Workspaces are displayed in natural alphabetical/numerical order (e.g., "Workspace 2" comes before "Workspace 10")
- **Quick Switcher**: Fuzzy search modal for fast workspace switching
- **Status Bar Indicator**: Shows current workspace name in the status bar
- **Auto-save**: Optionally save workspace before switching

### 🎛️ Navigation Layout Behavior

You have full control over how navigation layouts are handled:

1. **Remember navigation layout per workspace** (default: ON)
   - Each workspace saves and restores its own complete navigation state
   - **Folder Expansion State**: Which directories are expanded/collapsed in the file explorer
   - Sidebar State: Open/closed, active tabs, and widths
   - This is the critical feature that keeps your folder tree exactly as you left it per workspace!

2. **Maintain layout across workspaces** (default: OFF)
   - When enabled, your current navigation layout (including folder tree) stays the same when switching workspaces
   - When disabled, each workspace loads its saved navigation layout
   - Choose based on your workflow preference

This solves the inconsistent navigation layout behavior in the original Workspaces Plus plugin!

## Installation

### Manual Installation

1. Download the latest release from the Releases page
2. Extract the files to your vault's `.obsidian/plugins/workspace-navigator/` folder
3. Reload Obsidian
4. Enable "Workspace Navigator" in Settings → Community Plugins

### For Development

```bash
# Clone to your vault's plugins folder
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/yourusername/obsidian-workspace-navigator.git workspace-navigator
cd workspace-navigator

# Install dependencies
npm install

# Build the plugin
npm run build

# Or run in development mode with auto-rebuild
npm run dev
```

## Usage

### Switching Workspaces

- **Click** the workspace name in the status bar
- Use command: **"Open workspace switcher"**
- Navigate with arrow keys, select with Enter

### Saving Workspaces

- Use command: **"Save current workspace"**
- Enable "Auto-save on workspace switch" in settings

### Settings

Go to Settings → Workspace Navigator to configure:

- Navigation layout behavior
- Status bar visibility
- Alphabetical sorting
- Auto-save options
- Instruction visibility

## Requirements

- Obsidian v1.8.0 or higher
- Core "Workspaces" plugin must be enabled

## Comparison with Workspaces Plus

This plugin was built from scratch to address issues in the older Workspaces Plus plugin:

| Feature | Workspace Navigator | Workspaces Plus |
|---------|-------------------|-----------------|
| Navigation Layout Memory | ✅ Consistent & configurable | ⚠️ Inconsistent |
| Alphabetical Sorting | ✅ Natural sort (numeric-aware) | ⚠️ Not working reliably |
| Modern Obsidian API | ✅ v1.8.7+ | ❌ v1.1.1 (2022) |
| Maintenance | ✅ Active | ❌ Abandoned |
| Code Complexity | ✅ Clean, focused | ⚠️ Heavy patching |

## How It Works

### Navigation Layout Memory

When you switch workspaces, the plugin:

1. **Saves** the current workspace's navigation state:
   - Folder expansion state (which directories are expanded/collapsed)
   - Sidebar open/closed state
   - Active sidebar tabs
   - Sidebar widths
2. **Loads** the new workspace via the core Workspaces plugin
3. **Restores** the navigation state (unless "maintain layout" is enabled)

This is done by:
- Hooking into the core Workspaces plugin's `loadWorkspace` method
- Capturing folder expansion state from localStorage (`file-explorer-unfold`)
- Capturing sidebar state before/after workspace changes
- Storing layout data per workspace in plugin data
- Restoring folder expansion state by updating localStorage and refreshing the file explorer view

### Alphabetical Sorting

Workspaces are sorted using JavaScript's `localeCompare` with the `numeric: true` option, which provides natural sorting:

```typescript
workspaces.sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base'
}));
```

This ensures:
- "Project 2" comes before "Project 10"
- Case-insensitive sorting
- Proper handling of special characters

## Development

### Building

```bash
npm run build         # Production build
npm run dev          # Development build with watch mode
```

### Project Structure

```
workspace-navigator/
├── main.ts              # Main plugin class
├── settings.ts          # Settings interface and tab
├── workspace-modal.ts   # Workspace switcher modal
├── styles.css           # Plugin styles
├── manifest.json        # Plugin manifest
└── package.json         # Dependencies
```

## Local API and MCP server

For automation (Claude sessions, scripts): the plugin can run a loopback-only, token-authed HTTP API (Settings > Local API; desktop only, off by default; default port 27125). Endpoints: `GET /status`, `GET /workspaces`, `GET /workspace-for?path=`, `POST /switch`, `POST /reveal`. `reveal` opens a note in the workspace it belongs to: the most-recently-used workspace containing it wins (alternatives are reported), no switch happens if the current workspace already contains it, and a note in no workspace opens in place with `inNoWorkspace: true`.

`mcp/server.mjs` is a zero-dependency stdio MCP server bridging to that API, exposing `list_workspaces`, `current_workspace`, `workspace_for_note`, `switch_workspace`, and `reveal_note`. Register per vault:

```bash
claude mcp add workspace-navigator -e WN_API_TOKEN=<token from settings> -- node /path/to/obsidian-workspace-navigator/mcp/server.mjs
```

There is also a command, "Switch to workspace containing current note", usable from the palette or invokable by id (`workspace-navigator:switch-to-note-workspace`) from any tooling that can execute Obsidian commands.

Symlinked-vault caveat: vaults sharing this repo's `data.json` share the API settings too, including the port; the second instance to start logs a port-in-use notice and runs without the API. Give clone/test instances their own port if both need it.

## Notes

- Settings and workspace data persist to the plugin's `data.json` via Obsidian's `saveData`. If this repo is symlinked into multiple vaults, those vaults share one `data.json` (settings, workspaces, groups, and styles are common to all of them).

## License

MIT

## Support

For issues, feature requests, or questions, please visit the [GitHub repository](https://github.com/yourusername/obsidian-workspace-navigator).
