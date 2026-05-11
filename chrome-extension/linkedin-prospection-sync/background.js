const PANEL_URL = chrome.runtime.getURL("popup.html");
let panelWindowId = null;

async function getPanelBounds() {
  const stored = await chrome.storage.local.get(["panelLeft", "panelTop", "panelWidth", "panelHeight"]);
  return {
    left: Number.isFinite(stored.panelLeft) ? stored.panelLeft : undefined,
    top: Number.isFinite(stored.panelTop) ? stored.panelTop : undefined,
    width: Number.isFinite(stored.panelWidth) ? Math.max(stored.panelWidth, 440) : 460,
    height: Number.isFinite(stored.panelHeight) ? Math.max(stored.panelHeight, 680) : 780,
  };
}

async function rememberPanelBounds(windowId) {
  try {
    const panel = await chrome.windows.get(windowId);
    if (!panel || panel.type !== "popup") return;
    await chrome.storage.local.set({
      panelLeft: panel.left,
      panelTop: panel.top,
      panelWidth: panel.width,
      panelHeight: panel.height,
    });
  } catch {
    // The window may already be closed.
  }
}

async function openPanel() {
  if (panelWindowId) {
    try {
      await chrome.windows.update(panelWindowId, { focused: true });
      return;
    } catch {
      panelWindowId = null;
    }
  }

  const bounds = await getPanelBounds();
  const panel = await chrome.windows.create({
    url: PANEL_URL,
    type: "popup",
    focused: true,
    width: bounds.width,
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
  });
  panelWindowId = panel?.id || null;
}

chrome.action.onClicked.addListener(openPanel);

chrome.windows.onBoundsChanged.addListener((window) => {
  if (window.id === panelWindowId) {
    void rememberPanelBounds(window.id);
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === panelWindowId) {
    panelWindowId = null;
  }
});
