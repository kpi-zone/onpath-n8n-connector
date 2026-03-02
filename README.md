# onpath-n8n-connector

An [n8n](https://n8n.io) community node that pushes KPI values into [onpath Studio](https://www.kpi.zone) via the KPI Import API.

> **Requires a Pro subscription on onpath Studio.**

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Setup: Add the credential](#setup-add-the-credential)
- [Usage](#usage)
  - [Single mode](#single-mode)
  - [Batch mode](#batch-mode)
- [Error reference](#error-reference)

---

## Prerequisites

- An active **n8n** instance (v1.0.0 or later)
- An **onpath Studio Pro** account
- An onpath Studio **API key** (generated in Profile → API Key)

---

## Installation

### Via n8n UI (recommended)

1. Open n8n and go to **Settings → Community Nodes**
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

## Setup: Add the credential

1. In n8n go to **Credentials → New Credential**
2. Search for **KPI Canvas API**
3. Fill in the following fields:

| Field | Value |
| --- | --- |
| **API Key** | Your `kpi_...` key — generate it in onpath Studio → Profile → API Key |
| **Base URL** | `https://vyhsvdbdbbnstusvziin.supabase.co/functions/v1` (default — leave unchanged unless self-hosting) |

> **Important:** The API key is shown **once** when generated and cannot be retrieved again. Copy it into n8n immediately after creation.

---

## Usage

Add the **KPI Canvas** node to any workflow, select your credential, and choose a send mode.

Each KPI element in onpath Studio has a unique **Reference ID** — a short system-generated slug (e.g. `swift-peak-3f9a`) visible in the element's properties panel under **External KPI Source**. This is the identifier used to route values to the correct element.

### Single mode

Use **Single** mode when each workflow execution pushes one KPI value. All fields support n8n expressions, so you can map values directly from upstream nodes.

| Parameter | Example | Description |
| --- | --- | --- |
| **Send Mode** | `Single Item` | One API call per input item |
| **Reference ID** | `swift-peak-3f9a` | The system-generated slug from the KPI element's **External KPI Source** section |
| **Value** | `={{ $json.revenue }}` | Numeric value (expressions supported) |

**Example workflow:**

```text
Schedule trigger (hourly)
  → HTTP Request (fetch revenue from your data source)
  → KPI Canvas [Single] (reference: "swift-peak-3f9a", value: {{ $json.revenue }})
```

---

### Batch mode

Use **Batch** mode when an upstream node produces multiple rows (e.g. a database query returning several KPIs at once). All rows are sent in a single API call, which is more efficient and helps avoid rate limits.

| Parameter | Default field name | Description |
| --- | --- | --- |
| **Send Mode** | — | `Batch` |
| **Reference ID Field** | `reference_id` | Field name in each item that holds the KPI Reference ID |
| **Value Field** | `value` | Field name in each item that holds the numeric value |

**Example input items:**

```json
[
  { "reference_id": "swift-peak-3f9a", "value": 125000 },
  { "reference_id": "amber-rain-7c2b", "value": 2.4 }
]
```

---

## Error reference

| Status | Error message | What to do |
| --- | --- | --- |
| `401` | Authentication failed | Verify your API key and ensure the Reference ID belongs to your account |
| `403` | Pro subscription required | Upgrade your onpath Studio account to Pro |
| `429` | Rate limit exceeded (10 req/s) | Add a **Wait** node (1 s) before the KPI Canvas node, or switch to Batch mode |
| `400` | Bad request: … | Check that `reference_id` is present and that `value` is a finite number |
| `500` | Failed to store KPI value(s) | Transient database error — try again shortly |

> **Tip:** Enable **Continue on Fail** on the node to route errors as output items instead of halting the workflow.
