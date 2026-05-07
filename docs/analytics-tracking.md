# AgenceFlow analytics tracking

## Installation Framer

Add this script in the site `<head>`:

```html
<script
  async
  src="https://YOUR_AGENCEFLOW_DOMAIN/agenceflow-track.js"
  data-site-id="framer-main-site"
  data-debug="true"
></script>
```

When validation is done, switch debug off:

```html
<script
  async
  src="https://YOUR_AGENCEFLOW_DOMAIN/agenceflow-track.js"
  data-site-id="framer-main-site"
></script>
```

Optional attributes:

- `data-endpoint="https://YOUR_AGENCEFLOW_DOMAIN/api/analytics/collect"`: override the collection endpoint.
- `data-debug="true"`: logs every event in the browser console.
- `data-sample-rate="0.5"`: collect 50 percent of sessions.
- `data-track-clicks="false"`: disable click tracking.
- `data-track-forms="false"`: disable form submit tracking.
- `data-track-errors="false"`: disable JS error tracking.
- `data-track-performance="false"`: disable performance events.
- `data-track-sections="false"`: disable section visibility tracking.

## What the script collects

Session and visitor:

- Anonymous `visitor_id` stored in `localStorage`.
- Anonymous `session_id` stored in `sessionStorage`.
- Session duration.
- Page hidden / page leave events.

Page context:

- Full URL.
- Path.
- Page title.
- Referrer.
- Language.
- Timezone.
- Viewport size.
- Screen size.
- Pixel ratio.
- UTM parameters.
- Ad click IDs: `gclid`, `fbclid`, `msclkid`.

Engagement:

- Page view.
- Scroll depth at 25, 50, 75, 90, and 100 percent.
- Max scroll depth at page leave.
- Clicks on links, buttons, `[role="button"]`, `[data-af-event]`, and `[data-af-cta]`.
- CTA label when `data-af-cta` is present.
- Custom event name when `data-af-event` is present.
- Section views for `[data-af-section]`, `section[id]`, and `main [id]`.

Forms:

- Form submit event.
- Form selector.
- Form ID/name.
- Action URL.
- Method.
- Field count.

Important: the script does not collect field values by default.

Performance:

- DNS timing.
- Connection timing.
- Time to first byte.
- Download timing.
- DOM interactive timing.
- Load timing.
- Largest Contentful Paint.
- Cumulative Layout Shift.

Errors:

- JavaScript errors.
- Unhandled promise rejections.
- Source file, line, and column when available.

Manual events:

```js
window.AgenceFlowAnalytics.track("lead_qualified", {
  source: "contact_form",
  offer: "Audit SEO"
});
```

Identify-like event without exposing secrets:

```js
window.AgenceFlowAnalytics.identify({
  plan: "pro",
  segment: "agency"
});
```

Avoid sending names, emails, phone numbers, or raw form values unless consent and legal basis are clear.

## Backend environment

Required for storage:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Optional CORS restriction:

```bash
ANALYTICS_ALLOWED_ORIGINS=https://www.example.com,https://example.framer.website
```

If `SUPABASE_SERVICE_ROLE_KEY` is missing, `/api/analytics/collect` still responds but returns `stored: false`.

## Data model

Events are inserted in `analytics_events`:

- `site_id`
- `visitor_id`
- `session_id`
- `event_name`
- `event_time`
- `url`
- `path`
- `referrer`
- `user_agent`
- `metadata`

`metadata` keeps the flexible payload so new events can be added without a database migration.

## How this merges with Google Analytics and Cloudflare

Use this script for product and behavior analytics:

- CTA clicks.
- Scroll depth.
- Sections viewed.
- Form intent.
- Custom business events.
- Framer-specific page interactions.

Use Google Analytics for acquisition and marketing reporting:

- Traffic channels.
- Campaigns.
- Conversions.
- Audience reports.

Use Cloudflare for edge and technical analytics:

- Requests.
- Bandwidth.
- Cache.
- Bot traffic.
- Countries.
- WAF/security events.
- Origin errors.

The final dashboard should join these sources by `site_id`, date, path, URL, and campaign parameters.
