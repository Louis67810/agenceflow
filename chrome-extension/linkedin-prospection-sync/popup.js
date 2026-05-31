const agencyUrlInput = document.getElementById("agencyUrl");
const extensionKeyInput = document.getElementById("extensionKey");
const saveSettingsButton = document.getElementById("saveSettings");
const importButton = document.getElementById("importConversation");
const loadProspectsButton = document.getElementById("loadProspects");
const connectionStatus = document.getElementById("connectionStatus");
const selectedProspectStatus = document.getElementById("selectedProspectStatus");
const conversationStatus = document.getElementById("conversationStatus");
const importStatus = document.getElementById("importStatus");
const prospectsStatus = document.getElementById("prospectsStatus");
const prospectSearchInput = document.getElementById("prospectSearch");
const prospectsList = document.getElementById("prospectsList");
const connectionDot = document.getElementById("connectionDot");
const pendingBox = document.getElementById("pendingBox");
const pendingMessageTextarea = document.getElementById("pendingMessage");
const copyPendingButton = document.getElementById("copyPending");

let currentPending = null;
let prospects = [];
let selectedProspect = null;
let selectedProspectId = "";
let settingsSaveTimer = null;

function setConfigured(configured) {
  connectionStatus.textContent = configured ? "Configure" : "Non configure";
  connectionDot.classList.toggle("ok", configured);
  importButton.disabled = !configured;
  loadProspectsButton.disabled = !configured;
}

function normalizeAgencyUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/$/, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return withProtocol;
  }
}

async function fetchAgenceFlowJson(pathOrUrl, options = {}) {
  const settings = options.settings || await chrome.storage.local.get(["agencyUrl", "extensionKey"]);
  if (!settings.agencyUrl || !settings.extensionKey) {
    throw new Error("Configurez l'URL AgenceFlow et la cle d'extension.");
  }

  const agencyUrl = normalizeAgencyUrl(settings.agencyUrl);
  if (!agencyUrl) {
    throw new Error("URL AgenceFlow invalide.");
  }

  const url = pathOrUrl instanceof URL
    ? pathOrUrl.toString()
    : `${agencyUrl}${pathOrUrl}`;

  const { settings: _settings, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(fetchOptions.headers || {}),
        Authorization: `Bearer ${settings.extensionKey}`,
      },
    });
  } catch (error) {
    const reason = error?.name === "AbortError" ? "delai depasse" : "requete bloquee";
    throw new Error(`Impossible de joindre AgenceFlow (${reason}). Verifiez l'URL, rechargez l'extension Chrome et confirmez que le site est accessible.`);
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Reponse AgenceFlow illisible (${response.status}). Verifiez l'URL configuree.`);
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Erreur AgenceFlow ${response.status}`);
  }

  return data || {};
}

async function getSavedSettings() {
  const keys = [
    "agencyUrl",
    "extensionKey",
    "selectedProspectId",
    "selectedProspectName",
    "selectedProspectProfileUrl",
  ];
  const [syncSettings, localSettings] = await Promise.all([
    chrome.storage.sync.get(keys).catch(() => ({})),
    chrome.storage.local.get(keys),
  ]);
  return { ...syncSettings, ...localSettings };
}

async function persistSettings(values) {
  await Promise.all([
    chrome.storage.local.set(values),
    chrome.storage.sync.set(values).catch(() => undefined),
  ]);
}

function scheduleSettingsAutosave() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    const agencyUrl = normalizeAgencyUrl(agencyUrlInput.value);
    const extensionKey = extensionKeyInput.value.trim();
    await persistSettings({ agencyUrl, extensionKey });
    setConfigured(Boolean(agencyUrl && extensionKey));
    importStatus.textContent = "Configuration sauvegardee";
  }, 450);
}

function normalizeComparableName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeComparableLinkedInUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value).replace(/\/$/, "").toLowerCase();
  }
}

function selectedProspectMatchesDetected(detectedProspect) {
  if (!selectedProspectId && !selectedProspect?.id) return false;

  const selectedUrl = normalizeComparableLinkedInUrl(selectedProspect?.profileUrl);
  const detectedUrl = normalizeComparableLinkedInUrl(detectedProspect?.profileUrl);
  if (selectedUrl && detectedUrl) return selectedUrl === detectedUrl;

  const selectedName = normalizeComparableName(selectedProspect?.name);
  const detectedName = normalizeComparableName(detectedProspect?.name);
  return Boolean(selectedName && detectedName && selectedName === detectedName);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setPendingMessage(message) {
  currentPending = message || null;
  pendingBox.classList.toggle("hidden", !currentPending);
  pendingMessageTextarea.value = currentPending?.text || "";
}

function updateSelectedProspectStatus() {
  selectedProspectStatus.textContent = selectedProspect?.name || (selectedProspectId ? "Prospect selectionne" : "Fallback profil LinkedIn");
}

function renderProspects() {
  const query = prospectSearchInput.value.trim().toLowerCase();
  const visibleProspects = prospects.filter((prospect) => {
    const haystack = [
      prospect.name,
      prospect.headline,
      prospect.profileUrl,
      prospect.statusLabel,
    ].filter(Boolean).join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  prospectsList.textContent = "";
  if (!visibleProspects.length) {
    const empty = document.createElement("div");
    empty.className = "prospect-empty";
    empty.textContent = prospects.length ? "Aucun prospect trouve" : "Chargez les prospects depuis AgenceFlow";
    prospectsList.appendChild(empty);
    return;
  }

  visibleProspects.forEach((prospect) => {
    const button = document.createElement("button");
    const meta = [
      prospect.statusLabel,
      prospect.conversationCount ? `${prospect.conversationCount} msg` : null,
      prospect.pendingMessage ? "message pret" : null,
    ].filter(Boolean).join(" - ");

    button.type = "button";
    button.className = `prospect-row${selectedProspect?.id === prospect.id ? " selected" : ""}`;
    button.innerHTML = `
      <span class="prospect-name">${escapeHtml(prospect.name || "Prospect sans nom")}</span>
      <span class="prospect-meta">${escapeHtml(meta)}</span>
    `;
    button.addEventListener("click", () => selectProspect(prospect));
    prospectsList.appendChild(button);
  });
}

async function selectProspect(prospect) {
  selectedProspect = prospect || null;
  selectedProspectId = selectedProspect?.id || "";
  await chrome.storage.local.set({
    selectedProspectId,
    selectedProspectName: selectedProspect?.name || "",
    selectedProspectProfileUrl: selectedProspect?.profileUrl || "",
  });
  await chrome.storage.sync.set({
    selectedProspectId,
    selectedProspectName: selectedProspect?.name || "",
    selectedProspectProfileUrl: selectedProspect?.profileUrl || "",
  }).catch(() => undefined);
  updateSelectedProspectStatus();
  setPendingMessage(selectedProspect?.pendingMessage || null);
  renderProspects();
}

async function getActiveLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
  const candidates = tabs
    .filter((tab) => tab.id && tab.url?.startsWith("https://www.linkedin.com/"))
    .sort((a, b) => {
      const aScore = (a.active ? 10_000_000_000_000 : 0) + (a.url?.includes("/messaging") ? 1_000_000_000 : 0) + (a.lastAccessed || 0);
      const bScore = (b.active ? 10_000_000_000_000 : 0) + (b.url?.includes("/messaging") ? 1_000_000_000 : 0) + (b.lastAccessed || 0);
      return bScore - aScore;
    });
  const tab = candidates[0];
  if (!tab?.id) {
    throw new Error("Ouvrez une conversation LinkedIn dans un onglet Chrome.");
  }
  return tab;
}

function scrapeLinkedInConversationFromPage() {
  const visibleText = (element) => (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const normalizeMessageText = (value) =>
    String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  const absoluteUrl = (value) => {
    if (!value) return undefined;
    try {
      return new URL(value, window.location.origin).toString();
    } catch {
      return undefined;
    }
  };
  const simpleHash = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv_${(hash >>> 0).toString(16)}`;
  };

  const detailRoot =
    document.querySelector(".scaffold-layout__detail .msg-convo-wrapper") ||
    document.querySelector(".msg-convo-wrapper") ||
    document.querySelector(".scaffold-layout__detail") ||
    document;

  const activeConversation = document.querySelector(".msg-conversations-container__convo-item-link--active");
  const profileLink = detailRoot.querySelector(".msg-thread__link-to-profile[href], .profile-card-one-to-one__profile-link[href]");
  const prospectName =
    visibleText(detailRoot.querySelector(".msg-entity-lockup__entity-title, .msg-title-bar h2")) ||
    visibleText(detailRoot.querySelector(".profile-card-one-to-one__profile-link .truncate")) ||
    visibleText(activeConversation?.querySelector(".msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names")) ||
    visibleText(profileLink).split(/\s{2,}|Le statut est|Mobile|En ligne|joignable/i)[0]?.trim() ||
    "Prospect LinkedIn";
  const avatar =
    detailRoot.querySelector(".msg-thread__link-to-profile img, .msg-s-profile-card img.presence-entity__image") ||
    activeConversation?.querySelector("img.presence-entity__image, img.EntityPhoto-circle-4");

  const selectors = ".msg-s-event-listitem[data-event-urn], [data-view-name='message-list-item'][data-event-urn]";
  const nodes = [...detailRoot.querySelectorAll(selectors)];
  const fallbackNodes = nodes.length ? nodes : [...detailRoot.querySelectorAll(".msg-s-event-listitem")];
  const messages = [];
  const seen = new Set();

  for (const node of fallbackNodes) {
    if (node.querySelector(".msg-s-event-listitem__body--recalled")) continue;
    const body = node.querySelector(".msg-s-event-listitem__body");
    if (!body) continue;

    const clone = body.cloneNode(true);
    clone.querySelectorAll(".pl1").forEach((element) => element.remove());
    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    const text = normalizeMessageText(clone.textContent).replace(/\s+\((Modifie|Modifié|Edited)\)$/i, "").trim();
    if (!text) continue;

    const ariaHeading = visibleText(node.closest("li")?.querySelector(".msg-s-event-listitem--group-a11y-heading"));
    const senderName =
      visibleText(node.querySelector(".msg-s-message-group__name")) ||
      ariaHeading.replace(/\s+a envoy[eé].*$/i, "").trim() ||
      (node.classList.contains("msg-s-event-listitem--other") ? prospectName : "Louis Staub");
    const sender = normalizeText(senderName) === "louis staub" || !node.classList.contains("msg-s-event-listitem--other") ? "me" : "them";
    const timeHeading = visibleText(node.closest("li")?.querySelector(".msg-s-message-list__time-heading"));
    const timeStamp = visibleText(node.querySelector(".msg-s-message-group__timestamp"));
    const sentAt = [timeHeading, timeStamp].filter(Boolean).join(" ");
    const links = [
      ...new Set([
        ...[...body.querySelectorAll("a[href]")].map((link) => absoluteUrl(link.getAttribute("href"))).filter(Boolean),
        ...(text.match(/https?:\/\/[^\s)]+/g) || []),
      ]),
    ];
    const externalId = node.getAttribute("data-event-urn") || `linkedin_visible_${messages.length + 1}`;
    const rawHash = simpleHash([externalId, senderName, text, sentAt].join("\n"));

    if (seen.has(rawHash)) continue;
    seen.add(rawHash);
    messages.push({
      externalId,
      sender,
      senderName: senderName || (sender === "me" ? "Louis Staub" : prospectName),
      text,
      sentAt: sentAt || undefined,
      links,
      images: [],
      rawHash,
    });
  }

  return {
    source: "linkedin_chrome_extension",
    importedAt: new Date().toISOString(),
    prospect: {
      name: prospectName,
      profileUrl: absoluteUrl(profileLink?.getAttribute("href")),
      avatarUrl: absoluteUrl(avatar?.getAttribute("src")),
      headline: visibleText(detailRoot.querySelector(".artdeco-entity-lockup__subtitle div")) || undefined,
    },
    thread: {
      linkedinThreadKey: absoluteUrl(profileLink?.getAttribute("href")) || window.location.href,
      pageUrl: window.location.href,
    },
    messages,
    debug: {
      events: document.querySelectorAll(".msg-s-event-listitem").length,
      bodies: document.querySelectorAll(".msg-s-event-listitem__body").length,
      names: document.querySelectorAll(".msg-s-message-group__name").length,
      prospectName,
    },
  };
}

async function extractConversation(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: scrapeLinkedInConversationFromPage,
  });

  if (result?.messages?.length) {
    return { ok: true, payload: result };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "AGENCEFLOW_EXTRACT_LINKEDIN_DM" });
    if (response?.ok) return response;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "AGENCEFLOW_EXTRACT_LINKEDIN_DM" });
    if (response?.ok) return response;
  } catch {
    // The direct scraper above is the source of truth for the current LinkedIn DOM.
  }

  const debug = result?.debug
    ? `${result.debug.events} event(s) / ${result.debug.bodies} body / ${result.debug.names} name / prospect: ${result.debug.prospectName}`
    : "debug indisponible";
  return { ok: false, error: `Conversation non detectee (${debug}).` };
}

async function loadSettings() {
  const settings = await getSavedSettings();
  agencyUrlInput.value = settings.agencyUrl || "";
  extensionKeyInput.value = settings.extensionKey || "";
  if (settings.selectedProspectId) {
    selectedProspectId = settings.selectedProspectId;
    selectedProspect = {
      id: selectedProspectId,
      name: settings.selectedProspectName || "Prospect selectionne",
      profileUrl: settings.selectedProspectProfileUrl || "",
    };
  } else {
    selectedProspectId = "";
    selectedProspect = null;
  }
  await persistSettings({
    agencyUrl: settings.agencyUrl || "",
    extensionKey: settings.extensionKey || "",
    selectedProspectId,
    selectedProspectName: selectedProspect?.name || "",
    selectedProspectProfileUrl: selectedProspect?.profileUrl || "",
  });
  updateSelectedProspectStatus();
  renderProspects();
  setConfigured(Boolean(settings.agencyUrl && settings.extensionKey));
  if (settings.agencyUrl && settings.extensionKey) {
    await loadProspects();
  }
}

async function saveSettings() {
  const agencyUrl = normalizeAgencyUrl(agencyUrlInput.value);
  const extensionKey = extensionKeyInput.value.trim();
  await persistSettings({ agencyUrl, extensionKey });
  agencyUrlInput.value = agencyUrl;
  setConfigured(Boolean(agencyUrl && extensionKey));
  if (agencyUrl && extensionKey) {
    try {
      await fetchAgenceFlowJson("/api/linkedin/prospection/health", {
        settings: { agencyUrl, extensionKey },
      });
      importStatus.textContent = "Connexion AgenceFlow valide";
    } catch (error) {
      importStatus.textContent = error instanceof Error ? error.message : "Connexion AgenceFlow impossible";
      return;
    }
    await loadProspects();
  } else {
    importStatus.textContent = "Configuration enregistree";
  }
}

async function loadProspects() {
  loadProspectsButton.disabled = true;
  prospectsStatus.textContent = "Chargement...";

  try {
    const settings = await chrome.storage.local.get(["agencyUrl", "extensionKey", "selectedProspectId"]);
    if (!settings.agencyUrl || !settings.extensionKey) {
      throw new Error("Configurez l'URL AgenceFlow et la cle d'extension.");
    }

    const data = await fetchAgenceFlowJson("/api/linkedin/prospection/prospects", { settings });

    prospects = Array.isArray(data.prospects) ? data.prospects : [];
    selectedProspectId = settings.selectedProspectId || selectedProspectId || "";
    selectedProspect = prospects.find((prospect) => prospect.id === selectedProspectId) || selectedProspect;
    prospectsStatus.textContent = `${prospects.length} prospect(s)`;
    updateSelectedProspectStatus();
    renderProspects();
  } catch (error) {
    prospectsStatus.textContent = error instanceof Error ? error.message : "Erreur";
  } finally {
    const settings = await chrome.storage.local.get(["agencyUrl", "extensionKey"]);
    loadProspectsButton.disabled = !settings.agencyUrl || !settings.extensionKey;
  }
}

async function importConversation() {
  importButton.disabled = true;
  importStatus.textContent = "Extraction...";
  setPendingMessage(null);

  try {
    const settings = await chrome.storage.local.get(["agencyUrl", "extensionKey"]);
    if (!settings.agencyUrl || !settings.extensionKey) {
      throw new Error("Configurez l'URL AgenceFlow et la cle d'extension.");
    }

    const tab = await getActiveLinkedInTab();
    const extracted = await extractConversation(tab.id);
    if (!extracted?.ok) throw new Error(extracted?.error || "Conversation non detectee.");
    const detectedProspect = extracted.payload.prospect;
    const selectedProspectIdForImport = selectedProspectMatchesDetected(detectedProspect)
      ? selectedProspectId || selectedProspect?.id || ""
      : "";

    conversationStatus.textContent = `${extracted.payload.messages.length} message(s) - ${detectedProspect.name}`;
    importStatus.textContent = "Envoi vers AgenceFlow...";

    const data = await fetchAgenceFlowJson("/api/linkedin/prospection/import-conversation", {
      settings,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...extracted.payload,
        selectedProspectId: selectedProspectIdForImport || undefined,
      }),
    });

    importStatus.textContent = `${data.importedCount} importe(s), ${data.skippedDuplicates} doublon(s)`;
    setPendingMessage(data.pendingMessage);

    if (selectedProspectIdForImport === data.prospectId) {
      selectedProspect = {
        ...selectedProspect,
        id: data.prospectId,
        pendingMessage: data.pendingMessage || null,
        conversationCount: (selectedProspect?.conversationCount || 0) + data.importedCount,
      };
      selectedProspectId = data.prospectId;
      prospects = prospects.map((prospect) =>
        prospect.id === data.prospectId
          ? {
              ...prospect,
              pendingMessage: data.pendingMessage || null,
              conversationCount: (prospect.conversationCount || 0) + data.importedCount,
            }
          : prospect
      );
      updateSelectedProspectStatus();
      renderProspects();
    }

    if (!selectedProspectIdForImport && !data.pendingMessage && extracted.payload.prospect.profileUrl) {
      const pendingUrl = new URL(`${normalizeAgencyUrl(settings.agencyUrl)}/api/linkedin/prospection/pending-message`);
      pendingUrl.searchParams.set("profileUrl", extracted.payload.prospect.profileUrl);
      const pendingData = await fetchAgenceFlowJson(pendingUrl, { settings });
      setPendingMessage(pendingData.pendingMessage);
    }
  } catch (error) {
    importStatus.textContent = error instanceof Error ? error.message : "Erreur inconnue";
  } finally {
    const settings = await chrome.storage.local.get(["agencyUrl", "extensionKey"]);
    importButton.disabled = !settings.agencyUrl || !settings.extensionKey;
  }
}

saveSettingsButton.addEventListener("click", saveSettings);
agencyUrlInput.addEventListener("input", scheduleSettingsAutosave);
extensionKeyInput.addEventListener("input", scheduleSettingsAutosave);
agencyUrlInput.addEventListener("blur", saveSettings);
extensionKeyInput.addEventListener("blur", saveSettings);
loadProspectsButton.addEventListener("click", loadProspects);
prospectSearchInput.addEventListener("input", renderProspects);
importButton.addEventListener("click", importConversation);
copyPendingButton.addEventListener("click", async () => {
  if (!currentPending?.text) return;
  await navigator.clipboard.writeText(currentPending.text);
  importStatus.textContent = "Message copie";
});

loadSettings();
