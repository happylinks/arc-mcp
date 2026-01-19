#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  listSpaces,
  createSpace,
  deleteSpace,
  focusSpace,
  listTabs,
  addTab,
  deleteTab,
  openUrl,
} from "./arc.js";

const server = new McpServer({
  name: "arc-mcp",
  version: "1.0.0",
});

// Tool: List spaces
server.tool(
  "list_spaces",
  "List all Arc browser spaces",
  {},
  async () => {
    const spaces = listSpaces();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(spaces, null, 2),
        },
      ],
    };
  }
);

// Tool: Create space
server.tool(
  "create_space",
  "Create a new Arc browser space. Requires Arc restart to take effect. Note: Arc sync must be disabled for changes to persist.",
  {
    name: z.string().describe("Name of the new space"),
    icon: z
      .string()
      .optional()
      .default("star")
      .describe("Icon for the space - an emoji (e.g., '🚀') or SF Symbol name (e.g., 'star.fill')"),
  },
  async ({ name, icon }) => {
    const result = createSpace(name, icon);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Space "${name}" created successfully (ID: ${result.spaceId}). Restart Arc to see the new space.`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create space: ${result.error}`,
          },
        ],
      };
    }
  }
);

// Tool: Delete space
server.tool(
  "delete_space",
  "Delete an Arc browser space by name or ID. Requires Arc restart to take effect.",
  {
    space: z.string().describe("Name or ID of the space to delete"),
  },
  async ({ space }) => {
    const result = deleteSpace(space);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Space "${space}" deleted successfully. Restart Arc to see the changes.`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Failed to delete space: ${result.error}`,
          },
        ],
      };
    }
  }
);

// Tool: Focus space
server.tool(
  "focus_space",
  "Switch to a specific Arc browser space (uses AppleScript)",
  {
    space: z.string().describe("Name or ID of the space to focus"),
  },
  async ({ space }) => {
    const result = focusSpace(space);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Switched to space "${space}"`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Failed to focus space: ${result.error}`,
          },
        ],
      };
    }
  }
);

// Tool: List tabs
server.tool(
  "list_tabs",
  "List tabs and folders in an Arc browser space with full hierarchy. Shows pinned and unpinned sections with nested folders.",
  {
    space: z
      .string()
      .optional()
      .describe("Name or ID of the space to list tabs from (optional, defaults to first space)"),
  },
  async ({ space }) => {
    const result = listTabs(space);
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: space ? `Space not found: ${space}` : "No spaces found",
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Tool: Add tab
server.tool(
  "add_tab",
  "Add a new tab to an Arc browser space. Requires Arc restart to see in sidebar. For immediate opening, use open_url instead.",
  {
    space: z.string().describe("Name or ID of the space to add the tab to"),
    url: z.string().url().describe("URL for the new tab"),
    title: z.string().optional().describe("Title for the tab (defaults to URL)"),
    pinned: z.boolean().optional().default(false).describe("Whether to add as a pinned tab"),
  },
  async ({ space, url, title, pinned }) => {
    const result = addTab(space, url, title, pinned);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Tab added successfully (ID: ${result.tabId}). Restart Arc to see the tab in the sidebar.`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Failed to add tab: ${result.error}`,
          },
        ],
      };
    }
  }
);

// Tool: Delete tab
server.tool(
  "delete_tab",
  "Delete a tab from Arc browser by its ID. Requires Arc restart to take effect.",
  {
    tabId: z.string().describe("ID of the tab to delete"),
  },
  async ({ tabId }) => {
    const result = deleteTab(tabId);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: `Tab deleted successfully. Restart Arc to see the changes.`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Failed to delete tab: ${result.error}`,
          },
        ],
      };
    }
  }
);

// Tool: Open URL
server.tool(
  "open_url",
  "Open a URL in Arc browser immediately (uses AppleScript). Optionally specify a space.",
  {
    url: z.string().url().describe("URL to open"),
    space: z.string().optional().describe("Name or ID of the space to open the URL in (optional)"),
  },
  async ({ url, space }) => {
    const result = openUrl(url, space);
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: space ? `Opened ${url} in space "${space}"` : `Opened ${url}`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Failed to open URL: ${result.error}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Arc MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
