import { execSync } from "child_process";
import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const ARC_DIR = join(homedir(), "Library/Application Support/Arc");
const SIDEBAR_FILE = join(ARC_DIR, "StorableSidebar.json");

export interface Space {
  id: string;
  title: string;
  icon?: string;
}

export interface Tab {
  id: string;
  title: string;
  url: string;
  location: "pinned" | "unpinned";
  spaceId: string;
}

interface SidebarData {
  sidebar: {
    containers: Array<{
      spaces?: Array<string | SpaceObject>;
      items?: Array<string | ItemObject>;
    }>;
  };
  sidebarSyncState?: {
    container?: {
      value?: {
        orderedSpaceIDs?: string[];
      };
    };
    spaceModels?: Array<string | { encodedCKRecordFields?: string | null; value: SpaceObject }>;
  };
  firebaseSyncState?: {
    syncData?: {
      orderedSpaceIDs?: {
        value?: string[];
        lastChangeDate?: number;
        lastChangedDevice?: string;
      };
      spaceModels?: Array<string | { id: string; lastChangeDate: number; lastChangedDevice: string; value: SpaceObject }>;
      items?: Array<string | { id: string; lastChangeDate: number; lastChangedDevice: string; value: ItemObject }>;
    };
  };
}

interface SpaceObject {
  id: string;
  title: string;
  profile?: { default: boolean };
  containerIDs?: string[];
  newContainerIDs?: Array<{ pinned?: object } | { unpinned?: { _0?: { shared?: object } } } | string>;
  customInfo?: {
    iconType?: { emoji?: string; icon?: string };
    windowTheme?: object;
  };
}

interface ItemObject {
  id: string;
  title?: string | null;
  parentID?: string | null;
  childrenIds?: string[];
  createdAt?: number;
  originatingDevice?: string;
  isUnread?: boolean;
  data?: {
    tab?: {
      savedURL?: string;
      savedTitle?: string;
      savedMuteStatus?: string;
      timeLastActiveAt?: number;
    };
    itemContainer?: {
      containerType?: {
        spaceItems?: { _0?: string };
      };
    };
  };
}

function loadSidebar(): SidebarData {
  const content = readFileSync(SIDEBAR_FILE, "utf-8");
  return JSON.parse(content) as SidebarData;
}

function saveSidebar(data: SidebarData): void {
  writeFileSync(SIDEBAR_FILE, JSON.stringify(data, null, 2));
}

function createBackup(): string {
  const timestamp = Date.now();
  const backupFile = join(ARC_DIR, `StorableSidebar.backup.${timestamp}.json`);
  copyFileSync(SIDEBAR_FILE, backupFile);
  return backupFile;
}

function getDeviceId(data: SidebarData): string {
  let deviceId = data.firebaseSyncState?.syncData?.orderedSpaceIDs?.lastChangedDevice || "";

  if (!deviceId) {
    const items = data.sidebar?.containers?.[1]?.items || [];
    for (const item of items) {
      if (typeof item === "object" && item.originatingDevice) {
        deviceId = item.originatingDevice;
        break;
      }
    }
  }

  return deviceId;
}

export function listSpaces(): Space[] {
  const data = loadSidebar();
  const spaces: Space[] = [];
  const spaceItems = data.sidebar?.containers?.[1]?.spaces || [];

  for (const item of spaceItems) {
    if (typeof item === "object" && item.id && item.title) {
      const iconType = item.customInfo?.iconType;
      const icon = iconType?.emoji || iconType?.icon;
      spaces.push({
        id: item.id,
        title: item.title,
        icon,
      });
    }
  }

  return spaces;
}

export function createSpace(name: string, icon: string = "star"): { success: boolean; spaceId?: string; error?: string } {
  try {
    const data = loadSidebar();
    createBackup();

    const spaceId = randomUUID().toUpperCase();
    const pinnedId = randomUUID().toUpperCase();
    const unpinnedId = randomUUID().toUpperCase();
    const ts = Date.now() / 1000;
    const deviceId = getDeviceId(data);

    // Get theme from existing space
    const existingSpaces = data.sidebar?.containers?.[1]?.spaces || [];
    let theme: object | undefined;
    for (const s of existingSpaces) {
      if (typeof s === "object" && s.customInfo?.windowTheme) {
        theme = s.customInfo.windowTheme;
        break;
      }
    }

    if (!theme) {
      return { success: false, error: "Could not find theme template from existing spaces" };
    }

    // Build icon object
    const iconObj = icon.includes(".") ? { icon } : { emoji: icon };

    // Build space object
    const spaceObj: SpaceObject = {
      id: spaceId,
      title: name,
      profile: { default: true },
      containerIDs: ["pinned", pinnedId, "unpinned", unpinnedId],
      newContainerIDs: [
        { pinned: {} },
        pinnedId,
        { unpinned: { _0: { shared: {} } } },
        unpinnedId,
      ],
      customInfo: {
        iconType: iconObj,
        windowTheme: theme,
      },
    };

    // Build container base
    const contBase: Omit<ItemObject, "id"> = {
      title: null,
      parentID: null,
      childrenIds: [],
      createdAt: ts,
      originatingDevice: deviceId,
      isUnread: false,
      data: {
        itemContainer: {
          containerType: {
            spaceItems: { _0: spaceId },
          },
        },
      },
    };

    const pinnedCont: ItemObject = { ...contBase, id: pinnedId };
    const unpinnedCont: ItemObject = { ...contBase, id: unpinnedId };

    // 1. sidebar.containers[1].spaces
    data.sidebar.containers[1].spaces = data.sidebar.containers[1].spaces || [];
    data.sidebar.containers[1].spaces.push(spaceId);
    data.sidebar.containers[1].spaces.push(spaceObj);

    // 2. sidebar.containers[1].items
    data.sidebar.containers[1].items = data.sidebar.containers[1].items || [];
    data.sidebar.containers[1].items.push(pinnedId);
    data.sidebar.containers[1].items.push(pinnedCont);
    data.sidebar.containers[1].items.push(unpinnedId);
    data.sidebar.containers[1].items.push(unpinnedCont);

    // 3. sidebarSyncState.container.value.orderedSpaceIDs
    if (data.sidebarSyncState?.container?.value?.orderedSpaceIDs) {
      data.sidebarSyncState.container.value.orderedSpaceIDs.push(spaceId);
    }

    // 4. sidebarSyncState.spaceModels
    if (data.sidebarSyncState?.spaceModels) {
      data.sidebarSyncState.spaceModels.push(spaceId);
      data.sidebarSyncState.spaceModels.push({
        encodedCKRecordFields: null,
        value: spaceObj,
      });
    }

    // 5. firebaseSyncState.syncData.orderedSpaceIDs
    const syncData = data.firebaseSyncState?.syncData;
    if (syncData?.orderedSpaceIDs) {
      syncData.orderedSpaceIDs.value = syncData.orderedSpaceIDs.value || [];
      syncData.orderedSpaceIDs.value.push(spaceId);
      syncData.orderedSpaceIDs.lastChangeDate = ts;
      syncData.orderedSpaceIDs.lastChangedDevice = deviceId;
    }

    // 6. firebaseSyncState.syncData.spaceModels
    if (syncData?.spaceModels) {
      syncData.spaceModels.push(spaceId);
      syncData.spaceModels.push({
        id: spaceId,
        lastChangeDate: ts,
        lastChangedDevice: deviceId,
        value: spaceObj,
      });
    }

    // 7. firebaseSyncState.syncData.items
    if (syncData?.items) {
      syncData.items.push(pinnedId);
      syncData.items.push({
        id: pinnedId,
        lastChangeDate: ts,
        lastChangedDevice: deviceId,
        value: pinnedCont,
      });
      syncData.items.push(unpinnedId);
      syncData.items.push({
        id: unpinnedId,
        lastChangeDate: ts,
        lastChangedDevice: deviceId,
        value: unpinnedCont,
      });
    }

    saveSidebar(data);
    return { success: true, spaceId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function deleteSpace(spaceNameOrId: string): { success: boolean; error?: string } {
  try {
    const data = loadSidebar();
    createBackup();

    // Find the space
    const spaces = data.sidebar?.containers?.[1]?.spaces || [];
    let spaceId: string | undefined;
    let spaceIndex = -1;

    for (let i = 0; i < spaces.length; i++) {
      const item = spaces[i];
      if (typeof item === "object") {
        if (item.id === spaceNameOrId || item.title === spaceNameOrId) {
          spaceId = item.id;
          spaceIndex = i;
          break;
        }
      }
    }

    if (!spaceId || spaceIndex === -1) {
      return { success: false, error: `Space not found: ${spaceNameOrId}` };
    }

    // Get container IDs for this space
    const spaceObj = spaces[spaceIndex] as SpaceObject;
    const containerIds = spaceObj.containerIDs?.filter((id) => id !== "pinned" && id !== "unpinned") || [];

    // Remove from sidebar.containers[1].spaces (remove both the ID string and the object)
    const newSpaces: Array<string | SpaceObject> = [];
    for (const item of spaces) {
      if (typeof item === "string" && item === spaceId) continue;
      if (typeof item === "object" && item.id === spaceId) continue;
      newSpaces.push(item);
    }
    data.sidebar.containers[1].spaces = newSpaces;

    // Remove containers and their children from items
    const items = data.sidebar?.containers?.[1]?.items || [];
    const itemsToRemove = new Set(containerIds);

    // Find all children of the containers (tabs, folders, etc.)
    for (const item of items) {
      if (typeof item === "object" && item.parentID && containerIds.includes(item.parentID)) {
        itemsToRemove.add(item.id);
      }
    }

    const newItems: Array<string | ItemObject> = [];
    for (const item of items) {
      if (typeof item === "string" && itemsToRemove.has(item)) continue;
      if (typeof item === "object" && itemsToRemove.has(item.id)) continue;
      newItems.push(item);
    }
    data.sidebar.containers[1].items = newItems;

    // Remove from sidebarSyncState
    if (data.sidebarSyncState?.container?.value?.orderedSpaceIDs) {
      data.sidebarSyncState.container.value.orderedSpaceIDs =
        data.sidebarSyncState.container.value.orderedSpaceIDs.filter((id) => id !== spaceId);
    }

    if (data.sidebarSyncState?.spaceModels) {
      data.sidebarSyncState.spaceModels = data.sidebarSyncState.spaceModels.filter((item) => {
        if (typeof item === "string") return item !== spaceId;
        return item.value?.id !== spaceId;
      });
    }

    // Remove from firebaseSyncState
    const syncData = data.firebaseSyncState?.syncData;
    if (syncData?.orderedSpaceIDs?.value) {
      syncData.orderedSpaceIDs.value = syncData.orderedSpaceIDs.value.filter((id) => id !== spaceId);
    }

    if (syncData?.spaceModels) {
      syncData.spaceModels = syncData.spaceModels.filter((item) => {
        if (typeof item === "string") return item !== spaceId;
        return item.id !== spaceId;
      });
    }

    if (syncData?.items) {
      syncData.items = syncData.items.filter((item) => {
        if (typeof item === "string") return !itemsToRemove.has(item);
        return !itemsToRemove.has(item.id);
      });
    }

    saveSidebar(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function focusSpace(spaceNameOrId: string): { success: boolean; error?: string } {
  try {
    // First, find the space to get its exact title
    const spaces = listSpaces();
    const space = spaces.find((s) => s.id === spaceNameOrId || s.title === spaceNameOrId);

    if (!space) {
      return { success: false, error: `Space not found: ${spaceNameOrId}` };
    }

    const script = `
      tell application "Arc"
        tell front window
          tell space "${space.title}" to focus
        end tell
      end tell
    `;

    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function listTabs(spaceNameOrId?: string): Tab[] {
  const data = loadSidebar();
  const tabs: Tab[] = [];

  // Build a map of container ID -> space ID and pinned/unpinned status
  const containerToSpace = new Map<string, { spaceId: string; isPinned: boolean }>();
  const spaces = data.sidebar?.containers?.[1]?.spaces || [];

  for (const item of spaces) {
    if (typeof item === "object" && item.id && item.containerIDs) {
      const containerIDs = item.containerIDs.filter((id) => id !== "pinned" && id !== "unpinned");
      // First container is pinned, second is unpinned
      if (containerIDs[0]) containerToSpace.set(containerIDs[0], { spaceId: item.id, isPinned: true });
      if (containerIDs[1]) containerToSpace.set(containerIDs[1], { spaceId: item.id, isPinned: false });
    }
  }

  // Find the target space ID if filtering
  let targetSpaceId: string | undefined;
  if (spaceNameOrId) {
    for (const item of spaces) {
      if (typeof item === "object") {
        if (item.id === spaceNameOrId || item.title === spaceNameOrId) {
          targetSpaceId = item.id;
          break;
        }
      }
    }
    if (!targetSpaceId) {
      return []; // Space not found
    }
  }

  // Find all tabs
  const items = data.sidebar?.containers?.[1]?.items || [];
  for (const item of items) {
    if (typeof item === "object" && item.data?.tab && item.parentID) {
      const containerInfo = containerToSpace.get(item.parentID);
      if (containerInfo) {
        if (targetSpaceId && containerInfo.spaceId !== targetSpaceId) {
          continue;
        }

        tabs.push({
          id: item.id,
          title: item.data.tab.savedTitle || item.data.tab.savedURL || "Untitled",
          url: item.data.tab.savedURL || "",
          location: containerInfo.isPinned ? "pinned" : "unpinned",
          spaceId: containerInfo.spaceId,
        });
      }
    }
  }

  return tabs;
}

export function addTab(
  spaceNameOrId: string,
  url: string,
  title?: string,
  pinned: boolean = false
): { success: boolean; tabId?: string; error?: string } {
  try {
    const data = loadSidebar();
    createBackup();

    // Find the space
    const spaces = data.sidebar?.containers?.[1]?.spaces || [];
    let spaceId: string | undefined;
    let containerIds: string[] = [];

    for (const item of spaces) {
      if (typeof item === "object") {
        if (item.id === spaceNameOrId || item.title === spaceNameOrId) {
          spaceId = item.id;
          containerIds = (item.containerIDs || []).filter((id) => id !== "pinned" && id !== "unpinned");
          break;
        }
      }
    }

    if (!spaceId) {
      return { success: false, error: `Space not found: ${spaceNameOrId}` };
    }

    // Get the appropriate container (pinned or unpinned)
    const containerId = pinned ? containerIds[0] : containerIds[1];
    if (!containerId) {
      return { success: false, error: `Container not found for space: ${spaceId}` };
    }

    const tabId = randomUUID().toUpperCase();
    const ts = Date.now() / 1000;
    const deviceId = getDeviceId(data);

    // Build tab object
    const tabObj: ItemObject = {
      id: tabId,
      title: null,
      parentID: containerId,
      childrenIds: [],
      createdAt: ts,
      originatingDevice: deviceId,
      isUnread: false,
      data: {
        tab: {
          savedURL: url,
          savedTitle: title || url,
          savedMuteStatus: "allowAudio",
          timeLastActiveAt: ts,
        },
      },
    };

    // Add to sidebar items
    data.sidebar.containers[1].items = data.sidebar.containers[1].items || [];
    data.sidebar.containers[1].items.push(tabId);
    data.sidebar.containers[1].items.push(tabObj);

    // Update container's childrenIds
    const items = data.sidebar.containers[1].items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item === "object" && item.id === containerId) {
        item.childrenIds = item.childrenIds || [];
        item.childrenIds.push(tabId);
        break;
      }
    }

    // Add to syncData.items
    const syncData = data.firebaseSyncState?.syncData;
    if (syncData?.items) {
      syncData.items.push(tabId);
      syncData.items.push({
        id: tabId,
        lastChangeDate: ts,
        lastChangedDevice: deviceId,
        value: tabObj,
      });
    }

    saveSidebar(data);
    return { success: true, tabId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function deleteTab(tabId: string): { success: boolean; error?: string } {
  try {
    const data = loadSidebar();
    createBackup();

    // Find the tab and its parent
    const items = data.sidebar?.containers?.[1]?.items || [];
    let parentId: string | undefined;
    let found = false;

    for (const item of items) {
      if (typeof item === "object" && item.id === tabId) {
        parentId = item.parentID || undefined;
        found = true;
        break;
      }
    }

    if (!found) {
      return { success: false, error: `Tab not found: ${tabId}` };
    }

    // Remove from sidebar items
    const newItems: Array<string | ItemObject> = [];
    for (const item of items) {
      if (typeof item === "string" && item === tabId) continue;
      if (typeof item === "object" && item.id === tabId) continue;
      newItems.push(item);
    }
    data.sidebar.containers[1].items = newItems;

    // Remove from parent's childrenIds
    if (parentId) {
      for (const item of data.sidebar.containers[1].items) {
        if (typeof item === "object" && item.id === parentId && item.childrenIds) {
          item.childrenIds = item.childrenIds.filter((id) => id !== tabId);
          break;
        }
      }
    }

    // Remove from syncData.items
    const syncData = data.firebaseSyncState?.syncData;
    if (syncData?.items) {
      syncData.items = syncData.items.filter((item) => {
        if (typeof item === "string") return item !== tabId;
        return item.id !== tabId;
      });
    }

    saveSidebar(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function openUrl(url: string, spaceNameOrId?: string): { success: boolean; error?: string } {
  try {
    let script: string;

    if (spaceNameOrId) {
      const spaces = listSpaces();
      const space = spaces.find((s) => s.id === spaceNameOrId || s.title === spaceNameOrId);

      if (!space) {
        return { success: false, error: `Space not found: ${spaceNameOrId}` };
      }

      script = `
        tell application "Arc"
          tell front window
            tell space "${space.title}"
              make new tab with properties {URL:"${url}"}
            end tell
          end tell
        end tell
      `;
    } else {
      script = `
        tell application "Arc"
          tell front window
            make new tab with properties {URL:"${url}"}
          end tell
        end tell
      `;
    }

    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
