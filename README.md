# onpath-n8n-connector

An [n8n](https://n8n.io) community node that pushes KPI values into [onpath Studio](https://www.kpi.zone) via the KPI Ingest API.

Requires a **Pro subscription** on onpath Studio.

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

| Tool    | Minimum version |
| ------- | --------------- |
| Node.js | 18              |
| npm     | 9               |
| n8n     | 1.0.0           |

---

## Development setup

```bash
# 1. Enter the package directory
cd onpath-n8n-connector

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
cd onpath-n8n-connector
npm run build
npm link

# 2. Inside your n8n data directory (usually ~/.n8n)
cd ~/.n8n
npm link onpath-n8n-connector

# 3. Restart n8n
n8n start
```

Changes to the source only require a rebuild (`npm run build`) and an n8n restart — no re-linking needed.

### Option B — install from local path

```bash
# Inside your n8n data directory
cd ~/.n8n
npm install /absolute/path/to/onpath-n8n-connector

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
      - ./n8n-nodes-kpi-canvas/dist:/home/node/.n8n/custom/node_modules/onpath-n8n-connector/dist
      - ./n8n-nodes-kpi-canvas/package.json:/home/node/.n8n/custom/node_modules/onpath-n8n-connector/package.json
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
3. Enter `onpath-n8n-connector`
4. Click **Install** and restart n8n when prompted

### Via CLI

```bash
cd ~/.n8n
npm install onpath-n8n-connector
# Restart n8n
```

---

## Usage

### 1. Add the credential

1. In n8n go to **Credentials → New Credential**
2. Search for **Data Feed API**
3. Fill in:

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| **API Key**  | Your `kpi_...` key — generate it in onpath Studio → Organization Settings → API Tokens |
| **Base URL** | `https://api.onpath.io/functions/v1` (default, leave unless self-hosting) |

> The API key is shown once when generated and never retrievable again. Store it in n8n credentials immediately after generation.

When you test the credential, the node calls `GET /kpi-ingest`. A successful response now includes the authenticated token name, for example:

```json
{
  "authenticated": true,
  "token_name": "Zapier Prod Key"
}
```

---

### 2. Configure the node — Single mode

Use **Single** mode when each workflow execution pushes one KPI value. Fields support n8n expressions so you can map values from upstream nodes.

| Parameter      | Example                | Description                                                                                |
| -------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| **Send Mode**  | `Single Item`          | One API call per input item                                                                |
| **Feed**       | `Revenue Feed`         | Dropdown populated from `GET /kpi-ingest/feeds`; the selected feed's slug is sent to the API |
| **Value**      | `={{ $json.revenue }}` | Numeric value to import (expressions supported)                                            |

Only feeds assigned to the current API token appear in the dropdown.

**Example workflow:**

```text
Schedule trigger (hourly)
  → HTTP Request (fetch revenue from your data source)
  → Data Feed [Single] (feed: "Revenue Feed", value: {{ $json.revenue }})
```

---

### 3. Configure the node — Batch mode

Use **Batch** mode when an upstream node produces multiple rows (e.g. a database query returning several KPIs at once). All rows are sent in a single API call.

| Parameter        | Default field name | Description                                          |
| ---------------- | ------------------ | ---------------------------------------------------- |
| **Send Mode**    | —                  | `Batch`                                              |
| **Slug Field**   | `slug`             | Name of the input field containing the ingest feed slug |
| **Value Field**  | `value`            | Name of the input field containing the numeric value |

**Example input items:**

```json
[
  { "slug": "swift-peak-3f9a", "value": 125000 },
  { "slug": "amber-rain-7c2b", "value": 2.4 }
]
```

---

## Error reference

| Status | Node error message             | What to do                                                                    |
| ------ | ------------------------------ | ----------------------------------------------------------------------------- |
| `401`  | Authentication failed          | Verify your API key and ensure the selected feed slug is assigned to that token |
| `403`  | Pro subscription required      | Upgrade the account to Pro                                                    |
| `429`  | Rate limit exceeded (10 req/s) | Add a **Wait** node (1 s) before the Data Feed node, or switch to Batch mode |
| `400`  | Bad request: …                 | Check that `slug` is present and `value` is a finite number                   |
| `500`  | Failed to store KPI value(s)   | Transient database error — try again shortly                                  |

Enable **Continue on Fail** on the node to route errors as output items instead of halting the workflow.
