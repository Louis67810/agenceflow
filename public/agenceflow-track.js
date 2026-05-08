(function () {
  "use strict";

  var script = document.currentScript;
  var scriptUrl = script && script.src ? new URL(script.src, window.location.href) : null;
  var config = {
    siteId: script?.dataset.siteId || "",
    endpoint: script?.dataset.endpoint || (scriptUrl ? new URL("/api/analytics/collect", scriptUrl.origin).toString() : "/api/analytics/collect"),
    debug: script?.dataset.debug === "true",
    sampleRate: Number(script?.dataset.sampleRate || "1"),
    batchSize: Number(script?.dataset.batchSize || "12"),
    flushInterval: Number(script?.dataset.flushInterval || "5000"),
    trackClicks: script?.dataset.trackClicks !== "false",
    trackForms: script?.dataset.trackForms !== "false",
    trackErrors: script?.dataset.trackErrors !== "false",
    trackPerformance: script?.dataset.trackPerformance !== "false",
    trackSections: script?.dataset.trackSections !== "false"
  };

  if (!config.siteId || Math.random() > config.sampleRate) return;

  var startedAt = Date.now();
  var queue = [];
  var sentScrollDepths = {};
  var sentSections = {};
  var maxScrollDepth = 0;
  var isFlushing = false;
  var visitorId = getOrCreateId("af_visitor_id");
  var sessionId = getSessionId();

  function getOrCreateId(key) {
    try {
      var existing = window.localStorage.getItem(key);
      if (existing) return existing;
      var id = createId();
      window.localStorage.setItem(key, id);
      return id;
    } catch (_) {
      return createId();
    }
  }

  function getSessionId() {
    try {
      var current = JSON.parse(window.sessionStorage.getItem("af_session") || "null");
      if (current && current.id && Date.now() - current.updatedAt < 30 * 60 * 1000) {
        current.updatedAt = Date.now();
        window.sessionStorage.setItem("af_session", JSON.stringify(current));
        return current.id;
      }
      var next = { id: createId(), updatedAt: Date.now() };
      window.sessionStorage.setItem("af_session", JSON.stringify(next));
      return next.id;
    } catch (_) {
      return createId();
    }
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "af_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function safeText(value, limit) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit || 160);
  }

  function getUtm() {
    var params = new URLSearchParams(window.location.search);
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid"];
    var result = {};
    keys.forEach(function (key) {
      var value = params.get(key);
      if (value) result[key] = value.slice(0, 250);
    });
    return result;
  }

  function getPage() {
    return {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer || "",
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      viewport: { width: window.innerWidth, height: window.innerHeight },
      screen: { width: window.screen.width, height: window.screen.height, pixelRatio: window.devicePixelRatio || 1 },
      utm: getUtm()
    };
  }

  function track(name, properties) {
    var event = {
      name: name,
      time: new Date().toISOString(),
      siteId: config.siteId,
      visitorId: visitorId,
      sessionId: sessionId,
      page: getPage(),
      properties: properties || {}
    };
    queue.push(event);
    if (config.debug) console.log("[AgenceFlow analytics]", event);
    if (queue.length >= config.batchSize) flush(false);
  }

  function flush(useBeacon) {
    if (isFlushing || queue.length === 0) return;
    isFlushing = true;
    var events = queue.splice(0, config.batchSize);
    var payload = JSON.stringify({ siteId: config.siteId, events: events });

    if (useBeacon && navigator.sendBeacon) {
      var sent = navigator.sendBeacon(config.endpoint, new Blob([payload], { type: "application/json" }));
      isFlushing = false;
      if (!sent) queue = events.concat(queue);
      return;
    }

    fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "omit"
    }).catch(function () {
      queue = events.concat(queue).slice(0, 80);
    }).finally(function () {
      isFlushing = false;
    });
  }

  function selectorFor(element) {
    if (!element || element === document.body) return "body";
    var parts = [];
    var current = element;
    while (current && current.nodeType === 1 && current !== document.body && parts.length < 4) {
      var part = current.tagName.toLowerCase();
      if (current.id) {
        part += "#" + current.id.slice(0, 60);
        parts.unshift(part);
        break;
      }
      if (current.getAttribute("data-af-event")) part += "[data-af-event]";
      if (current.className && typeof current.className === "string") {
        part += "." + current.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function describeElement(element) {
    var link = element.closest("a");
    var button = element.closest("button");
    var target = link || button || element;
    return {
      tag: target.tagName.toLowerCase(),
      selector: selectorFor(target),
      text: safeText(target.getAttribute("aria-label") || target.innerText || target.textContent, 140),
      href: link ? link.href : "",
      eventName: target.getAttribute("data-af-event") || "",
      cta: target.getAttribute("data-af-cta") || ""
    };
  }

  function trackScroll() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    var height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
    var depth = height > 0 ? Math.round((scrollTop / height) * 100) : 100;
    maxScrollDepth = Math.max(maxScrollDepth, Math.min(100, depth));
    [25, 50, 75, 90, 100].forEach(function (threshold) {
      if (maxScrollDepth >= threshold && !sentScrollDepths[threshold]) {
        sentScrollDepths[threshold] = true;
        track("scroll_depth", { depth: threshold });
      }
    });
  }

  function installSectionTracking() {
    if (!config.trackSections || !("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll("[data-af-section], section[id], main [id]");
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.45) return;
        var el = entry.target;
        var name = el.getAttribute("data-af-section") || el.id || selectorFor(el);
        if (sentSections[name]) return;
        sentSections[name] = true;
        track("section_view", { section: safeText(name, 120), selector: selectorFor(el) });
      });
    }, { threshold: [0.45] });
    targets.forEach(function (target) { observer.observe(target); });
  }

  function installPerformanceTracking() {
    if (!config.trackPerformance) return;
    window.addEventListener("load", function () {
      setTimeout(function () {
        var nav = performance.getEntriesByType("navigation")[0];
        if (nav) {
          track("performance_navigation", {
            dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            connect: Math.round(nav.connectEnd - nav.connectStart),
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            download: Math.round(nav.responseEnd - nav.responseStart),
            domInteractive: Math.round(nav.domInteractive),
            load: Math.round(nav.loadEventEnd)
          });
        }
      }, 0);
    });

    if (!("PerformanceObserver" in window)) return;
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (last) track("web_vital_lcp", { value: Math.round(last.startTime), element: safeText(last.element && last.element.tagName, 80) });
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_) {}
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) track("web_vital_cls", { value: Number(entry.value.toFixed(4)) });
        });
      }).observe({ type: "layout-shift", buffered: true });
    } catch (_) {}
  }

  track("page_view", { source: "script", consent: "not_configured" });
  installSectionTracking();
  installPerformanceTracking();

  if (config.trackClicks) {
    document.addEventListener("click", function (event) {
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      var clickable = target.closest("a, button, [role='button'], [data-af-event], [data-af-cta]");
      if (!clickable) return;
      track("click", describeElement(clickable));
    }, true);
  }

  if (config.trackForms) {
    document.addEventListener("submit", function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      track("form_submit", {
        selector: selectorFor(form),
        id: form.id || "",
        name: form.getAttribute("name") || "",
        action: form.action || "",
        method: form.method || "get",
        fieldCount: form.elements ? form.elements.length : 0
      });
    }, true);
  }

  if (config.trackErrors) {
    window.addEventListener("error", function (event) {
      track("javascript_error", {
        message: safeText(event.message, 500),
        source: event.filename || "",
        line: event.lineno || 0,
        column: event.colno || 0
      });
    });
    window.addEventListener("unhandledrejection", function (event) {
      track("promise_rejection", { reason: safeText(event.reason && (event.reason.message || event.reason), 500) });
    });
  }

  window.addEventListener("scroll", throttle(trackScroll, 700), { passive: true });
  window.addEventListener("pagehide", function () {
    track("page_leave", {
      durationMs: Date.now() - startedAt,
      maxScrollDepth: maxScrollDepth,
      visibility: document.visibilityState
    });
    flush(true);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      track("page_hidden", { durationMs: Date.now() - startedAt, maxScrollDepth: maxScrollDepth });
      flush(true);
    }
  });
  window.setInterval(function () { flush(false); }, config.flushInterval);

  window.AgenceFlowAnalytics = {
    track: track,
    flush: function () { flush(false); },
    identify: function (traits) { track("identify", { traits: traits || {} }); }
  };

  function throttle(fn, wait) {
    var last = 0;
    var timer = null;
    return function () {
      var now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(function () {
        last = Date.now();
        fn();
      }, wait - (now - last));
    };
  }
})();
