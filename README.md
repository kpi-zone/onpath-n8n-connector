# onpath-n8n-connector

An [n8n](https://n8n.io) community node that pushes KPI values into [onpath](https://app.onpath.io) via the KPI Ingest API.

Requires a **Pro subscription** on onpath Studio.

---

## Table of contents

- [Install from npm](#install-from-npm-end-users)
- [Usage](#usage)
  - [1. Add the credential](#1-add-the-credential)
  - [2. Configure the node — Single mode](#2-configure-the-node--single-mode)
  - [3. Configure the node — Batch mode](#3-configure-the-node--batch-mode)
- [Error reference](#error-reference)

---


## Install from npm 

### Via n8n UI

1. Open n8n → **Settings → Community Nodes**
2. Click **Install**
3. Enter `onpath-n8n-connector`
4. Click **Install** and restart n8n when prompted

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
  "token_name": "n8n Prod Key"
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
