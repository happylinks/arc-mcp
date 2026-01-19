# arc-mcp

MCP (Model Context Protocol) server for Arc browser. Manage spaces and tabs programmatically.

## Features

- **List spaces** - Get all Arc browser spaces
- **Create space** - Create new spaces with custom names and icons
- **Delete space** - Remove spaces
- **Focus space** - Switch to a specific space (AppleScript)
- **List tabs** - Get tabs from all spaces or a specific space
- **Add tab** - Add tabs to spaces
- **Delete tab** - Remove tabs
- **Open URL** - Open URLs in Arc immediately (AppleScript)

## Requirements

- macOS (Arc browser is macOS-only)
- Arc browser installed
- **Arc Sync must be disabled** for space/tab modifications to persist

## Installation

```bash
bun install
```

## Usage

### With Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "arc": {
      "command": "npx",
      "args": ["tsx", "/path/to/arc-mcp/src/index.ts"]
    }
  }
}
```

### Running directly

```bash
bun start
# or
npx tsx src/index.ts
```

## Tools

### `list_spaces`

List all Arc browser spaces.

### `create_space`

Create a new space.

| Parameter | Type   | Required | Description                                    |
| --------- | ------ | -------- | ---------------------------------------------- |
| name      | string | Yes      | Name of the new space                          |
| icon      | string | No       | Emoji or SF Symbol name (default: "star")      |

### `delete_space`

Delete a space.

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| space     | string | Yes      | Name or ID of space to delete  |

### `focus_space`

Switch to a space (uses AppleScript).

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| space     | string | Yes      | Name or ID of space to focus  |

### `list_tabs`

List tabs, optionally filtered by space.

| Parameter | Type   | Required | Description                         |
| --------- | ------ | -------- | ----------------------------------- |
| space     | string | No       | Name or ID of space to filter by    |

### `add_tab`

Add a tab to a space. Requires Arc restart.

| Parameter | Type    | Required | Description                        |
| --------- | ------- | -------- | ---------------------------------- |
| space     | string  | Yes      | Name or ID of space                |
| url       | string  | Yes      | URL for the tab                    |
| title     | string  | No       | Tab title (defaults to URL)        |
| pinned    | boolean | No       | Add as pinned tab (default: false) |

### `delete_tab`

Delete a tab by ID. Requires Arc restart.

| Parameter | Type   | Required | Description         |
| --------- | ------ | -------- | ------------------- |
| tabId     | string | Yes      | ID of tab to delete |

### `open_url`

Open a URL immediately in Arc (uses AppleScript).

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| url       | string | Yes      | URL to open                    |
| space     | string | No       | Space to open the URL in       |

## Important Notes

1. **Arc Sync**: For space/tab modifications to persist, disable Arc Sync in Arc settings. Otherwise, the sync will overwrite local changes.

2. **Restart Required**: Most modifications (create/delete space, add/delete tab) require restarting Arc to take effect.

3. **Backup**: The server automatically creates backups before modifying Arc's sidebar data.

## How It Works

Arc stores its sidebar data in `~/Library/Application Support/Arc/StorableSidebar.json`. This MCP server reads and modifies that file directly for space and tab management.

For immediate actions (focus space, open URL), it uses AppleScript to control Arc.

## License

MIT
