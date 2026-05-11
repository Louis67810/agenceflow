function visibleText(element) {
  return (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value) {
  if (!value) return undefined;
  try {
    return new URL(value, location.origin).toString();
  } catch {
    return undefined;
  }
}

function normalizeText(value) {
  return (value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeMessageText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function findConversationRoot() {
  const candidates = [
    ...document.querySelectorAll(".msg-convo-wrapper, .msg-thread, .msg__detail, .scaffold-layout__detail"),
    ...document.querySelectorAll('[role="main"], main, [aria-label*="Messaging"], [aria-label*="messagerie"]'),
  ];
  return candidates.find((node) => node.querySelector(".msg-s-event-listitem[data-event-urn], [data-view-name='message-list-item'][data-event-urn]")) || document.body;
}

function findProspect(root) {
  const titleLink = root.querySelector(".msg-thread__link-to-profile[href]");
  const profileLink = titleLink || [...root.querySelectorAll('a[href*="/in/"], a[href*="/sales/lead/"]')]
    .map((link) => link)
    .find((link) => visibleText(link).length > 1);
  const profileUrl = absoluteUrl(profileLink?.getAttribute("href"));
  const name =
    visibleText(root.querySelector(".msg-entity-lockup__entity-title, .msg-title-bar h2")) ||
    visibleText(profileLink).split(/\s{2,}|Le statut est|En activité|Active now/i)[0]?.trim() ||
    visibleText(root.querySelector("h1, h2, [data-anonymize='person-name']")) ||
    document.title.replace(/\|.*$/, "").replace(/LinkedIn/i, "").trim();
  const avatar = root.querySelector(".msg-thread__link-to-profile img, img.presence-entity__image, img.EntityPhoto-circle-3");

  return {
    name: name || "Prospect LinkedIn",
    profileUrl,
    avatarUrl: absoluteUrl(avatar?.getAttribute("src")),
    headline: undefined,
  };
}

function getLinkedInThreadKey() {
  const match = location.href.match(/messaging\/thread\/([^/?#]+)/i);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const mini = location.href.match(/messaging\/compose\/\?[^#]*recipient=([^&#]+)/i);
  if (mini?.[1]) return decodeURIComponent(mini[1]);
  return undefined;
}

function senderFromElement(element) {
  const senderName = getSenderName(element);
  const aria = [
    element.getAttribute("aria-label"),
    element.closest("[aria-label]")?.getAttribute("aria-label"),
    element.closest("[data-event-urn]")?.getAttribute("aria-label"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const classes = [
    element.className,
    element.closest("[class]")?.className,
    element.parentElement?.className,
  ]
    .join(" ")
    .toLowerCase();

  if (senderName && normalizeText(senderName) === "louis staub") return "me";
  if (element.classList.contains("msg-s-event-listitem--other")) return "them";
  if (/\byou\b|\bvous\b|\bmoi\b/.test(aria) || /msg-s-message-list__event--self|from-me|outgoing/.test(classes)) {
    return "me";
  }
  return "me";
}

function messageNodes(root) {
  const selectors = ".msg-s-event-listitem[data-event-urn], [data-view-name='message-list-item'][data-event-urn]";
  const scopedNodes = [...root.querySelectorAll(selectors)];
  const documentNodes = scopedNodes.length ? scopedNodes : [...document.querySelectorAll(selectors)];
  const nodes = documentNodes.length
    ? documentNodes
    : [...root.querySelectorAll(".msg-s-event-listitem"), ...document.querySelectorAll(".msg-s-event-listitem")];
  const uniqueNodes = [...new Set(nodes)];

  return uniqueNodes.filter((node) => {
    if (node.querySelector(".msg-s-event-listitem__body--recalled")) return false;
    return Boolean(node.querySelector(".msg-s-event-listitem__body, .msg-s-event-listitem__message-bubble"));
  });
}

function extractMessageText(node) {
  const body = node.querySelector(".msg-s-event-listitem__body");
  if (!body) return "";

  const clone = body.cloneNode(true);
  clone.querySelectorAll(".t-14.t-black--light.t-normal.pl1").forEach((item) => item.remove());
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return normalizeMessageText(clone.textContent)
    .replace(/\s+\((Modifié|Edited)\)$/i, "")
    .trim();
}

function extractVisibleDate(node) {
  const time = node.querySelector("time[datetime]");
  const datetime = time?.getAttribute("datetime");
  if (datetime) {
    const parsed = new Date(datetime);
    return Number.isNaN(parsed.getTime()) ? datetime : parsed.toISOString();
  }

  const sentTitle = node.querySelector(".msg-s-event-with-indicator__sending-indicator")?.getAttribute("title");
  if (sentTitle) return sentTitle;

  const messageTime = visibleText(node.querySelector(".msg-s-message-group__timestamp"));
  const event = node.closest(".msg-s-message-list__event");
  const dateHeading = visibleText(event?.querySelector(".msg-s-message-list__time-heading"));
  return [dateHeading, messageTime].filter(Boolean).join(" ");
}

function getSenderName(node) {
  const nameNode = node.querySelector(".msg-s-message-group__name, [data-anonymize='person-name'], h3, strong");
  return visibleText(nameNode);
}

function extractSenderName(node, prospectName, sender) {
  const name = getSenderName(node);
  if (name) return name;
  return sender === "me" ? "me" : prospectName;
}

function extractMessageLinks(node, text) {
  const body = node.querySelector(".msg-s-event-listitem__body");
  const hrefs = [...(body?.querySelectorAll("a[href]") ?? [])]
    .map((link) => absoluteUrl(link.getAttribute("href")))
    .filter(Boolean);
  const textUrls = [...(text || "").matchAll(/https?:\/\/[^\s<>"')]+/gi)]
    .map((match) => absoluteUrl(match[0]))
    .filter(Boolean);

  return [...new Set([...hrefs, ...textUrls])];
}

function extractMessageImages(node) {
  return [...node.querySelectorAll(".msg-s-event-listitem__message-bubble img")]
    .filter((img) => {
      const className = img.className || "";
      const containerClass = img.closest("[class]")?.className || "";
      if (/profile-picture|seen-receipt|EntityPhoto|update-components-article|ivm-view-attr/i.test(`${className} ${containerClass}`)) {
        return false;
      }
      if (img.closest(".update-components-article, .msg-s-event-listitem__unrolled-update-v2")) return false;
      return Boolean(img.getAttribute("src"));
    })
    .map((img) => ({ url: absoluteUrl(img.getAttribute("src")), alt: img.getAttribute("alt") || undefined }))
    .filter((image) => image.url);
}

async function extractConversation() {
  const root = findConversationRoot();
  const prospect = findProspect(root);
  const nodes = messageNodes(root);
  const seen = new Set();
  const messages = [];

  for (const node of nodes) {
    const text = extractMessageText(node);
    const links = extractMessageLinks(node, text);
    const images = extractMessageImages(node);

    if (!text && links.length === 0 && images.length === 0) continue;

    const sender = senderFromElement(node);
    const sentAt = extractVisibleDate(node);
    const rawHash = await sha256(
      [sender, normalizeText(text), sentAt || "", links.slice().sort().join("|"), images.map((image) => image.url || image.alt || "").sort().join("|")].join("\n")
    );
    if (seen.has(rawHash)) continue;
    seen.add(rawHash);

    messages.push({
      externalId: node.getAttribute("data-event-urn") || `linkedin_visible_${rawHash.slice(0, 16)}`,
      sender,
      senderName: extractSenderName(node, prospect.name, sender),
      text,
      sentAt,
      links,
      images,
      rawHash,
    });
  }

  return {
    source: "linkedin_chrome_extension",
    importedAt: new Date().toISOString(),
    prospect,
    thread: {
      linkedinThreadKey: getLinkedInThreadKey(),
      pageUrl: location.href,
    },
    messages,
  };
}

function extractionDebugSummary() {
  return [
    `${document.querySelectorAll(".msg-s-event-listitem").length} item(s)`,
    `${document.querySelectorAll(".msg-s-event-listitem__body").length} body`,
    `${document.querySelectorAll(".msg-s-message-group__name").length} name`,
  ].join(" / ");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "AGENCEFLOW_EXTRACT_LINKEDIN_DM") return false;
  extractConversation()
    .then((payload) =>
      sendResponse({
        ok: payload.messages.length > 0,
        payload,
        error: payload.messages.length > 0 ? undefined : `Aucun message visible détecté (${extractionDebugSummary()}).`,
      })
    )
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Extraction impossible." }));
  return true;
});
