# n8n-nodes-kpi-canvas

An [n8n](https://n8n.io) community node that pushes KPI values into [Canvas Creation Studio](https://github.com/your-org/canvas-creation-studio) via the KPI Import API.

Requires a **Pro subscription** on Canvas Creation Studio.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Development setup](#development-setup)
- [Build](#build)
- [Install into a local n8n instance](#install-into-a-local-n8n-instance)
- [Publish to npm](#publish-to-npm)
- [Install from npm (end users)](#install-from-npm-end-users)
- [Usage](#usage)
  - [1. Add the credential](#1-add-the-credential)
  - [2. Configure the node — Single mode](#2-configure-the-node--single-mode)
  - [3. Configure the node — Batch mode](#3-configure-the-node--batch-mode)
- [Error reference](#error-reference)

---

## Prerequisites

| Tool | Minimum version |
| --- | --- |
| Node.js | 18 |
| npm | 9 |
| n8n | 1.0.0 |

---

## Development setup

```bash
# 1. Enter the package directory
cd n8n-nodes-kpi-canvas

# 2. Install dependencies
npm install
```

The only runtime peer dependency is `n8n-workflow`, which n8n itself provides. All other dependencies are dev-only (TypeScript, type definitions).

---

## Build

```bash
npm run build
```

This runs two steps in sequence:

1. **`tsc`** — compiles all TypeScript in `credentials/` and `nodes/` into `dist/`
2. **`node scripts/copy-icons.mjs`** — copies `.svg` icons alongside the compiled JS in `dist/`

The `dist/` directory is what gets published to npm (`"files": ["dist"]` in `package.json`).

To watch for changes during development:

```bash
npm run dev
```

---

## Install into a local n8n instance

Use this during development to test the node before publishing.

### Option A — npm link (recommended for active development)

```bash
# 1. Inside this package — build and create a global symlink
cd n8n-nodes-kpi-canvas
npm run build
npm link

# 2. Inside your n8n data directory (usually ~/.n8n)
cd ~/.n8n
npm link n8n-nodes-kpi-canvas

# 3. Restart n8n
n8n start
```

Changes to the source only require a rebuild (`npm run build`) and an n8n restart — no re-linking needed.

### Option B — install from local path

```bash
# Inside your n8n data directory
cd ~/.n8n
npm install /absolute/path/to/n8n-nodes-kpi-canvas

# Restart n8n
n8n start
```

### Option C — Docker / n8n self-hosted

Mount the built package into the container and add it to `N8N_CUSTOM_EXTENSIONS`:

```yaml
# docker-compose.yml
services:
  n8n:
    environment:
      - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
    volumes:
      - ./n8n-nodes-kpi-canvas/dist:/home/node/.n8n/custom/node_modules/n8n-nodes-kpi-canvas/dist
      - ./n8n-nodes-kpi-canvas/package.json:/home/node/.n8n/custom/node_modules/n8n-nodes-kpi-canvas/package.json
```

---

## Publish to npm

### First-time setup

```bash
# Create an npm account if you don't have one
npm adduser

# Verify you are logged in
npm whoami
```

### Publish

```bash
cd n8n-nodes-kpi-canvas

# 1. Build (also runs automatically via "prepublishOnly" script)
npm run build

# 2. Dry-run to verify what will be included
npm publish --dry-run

# 3. Publish publicly
npm publish --access public
```

The `prepublishOnly` script runs `npm run build` automatically, so step 1 is only needed if you want to inspect `dist/` before publishing.

### Update an existing release

```bash
# Bump the version (patch / minor / major)
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.0 → 0.2.0
npm version major   # 0.1.0 → 1.0.0

npm publish --access public
```

---

## Install from npm (end users)

### Via n8n UI (recommended)

1. Open n8n → **Settings → Community Nodes**
2. Click **Install**
3. Enter `n8n-nodes-kpi-canvas`
4. Click **Install** and restart n8n when prompted

### Via CLI

```bash
cd ~/.n8n
npm install n8n-nodes-kpi-canvas
# Restart n8n
```

---

## Usage

### 1. Add the credential

1. In n8n go to **Credentials → New Credential**
2. Search for **KPI Canvas API**
3. Fill in:

| Field | Value |
| --- | --- |
| **API Key** | Your `kpi_...` key — generate it in Canvas Creation Studio → Profile → API Key |
| **Base URL** | `https://vyhsvdbdbbnstusvziin.supabase.co/functions/v1` (default, leave unless self-hosting) |

> The API key is shown **once** when generated and never retrievable again. Store it in n8n credentials immediately after generation.

---

### 2. Configure the node — Single mode

Use **Single** mode when each workflow execution pushes one KPI value. The fields support n8n expressions so you can map values from upstream nodes.

| Parameter | Example | Description |
| --- | --- | --- |
| **Send Mode** | `Single Item` | One API call per input item |
| **Canvas External ID** | `sales-2026` | The `external_id` set in Canvas Settings |
| **Element Slug** | `revenue-q1` | The `slug` set on the KPI element |
| **Value** | `={{ $json.revenue }}` | Numeric value (expressions supported) |

**Example workflow:**

```text
Schedule trigger (hourly)
  → HTTP Request (fetch revenue from your data source)
  → KPI Canvas [Single] (canvas: "sales-2026", slug: "revenue-q1", value: {{ $json.revenue }})
```

---

### 3. Configure the node — Batch mode

Use **Batch** mode when an upstream node produces multiple rows (e.g. a database query returning several KPIs at once). All rows are sent in a single API call.

| Parameter | Default | Description |
| --- | --- | --- |
| **Send Mode** | `Batch` | One API call for all input items |
| **Canvas External ID Field** | `canvas_external_id` | Name of the field in each item that holds the canvas key |
| **Element Slug Field** | `element_slug` | Name of the field in each item that holds the element slug |
| **Value Field** | `value` | Name of the field in each item that holds the numeric value |

**Example input items:**

```json
[
  { "canvas_external_id": "sales-2026", "element_slug": "revenue-q1", "value": 125000 },
  { "canvas_external_id": "sales-2026", "element_slug": "churn-rate",  "value": 2.4 }
]
```

**Example workflow:**

```text
Schedule trigger (hourly)
  → Postgres (SELECT canvas_external_id, element_slug, value FROM kpi_export_view)
  → KPI Canvas [Batch]
```

---

## Error reference

| Status | Node error message | What to do |
| --- | --- | --- |
| `401` | Invalid API key | Regenerate the API key in Profile settings and update the credential |
| `403` | Pro subscription required | Upgrade the account to Pro |
| `429` | Rate limit exceeded (10 req/s) | Add a **Wait** node (1 s) before the KPI Canvas node, or switch to Batch mode |
| `400` | Bad request: … | Check that all three fields are present and `value` is a finite number |
| `500` | Failed to store KPI value(s) | Check Supabase logs — usually a transient DB error |

Enable **Continue on Fail** on the node to route errors as output items instead of halting the workflow.
