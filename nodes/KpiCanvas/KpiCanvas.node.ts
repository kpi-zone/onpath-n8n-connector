import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeApiError,
  NodeOperationError,
  IHttpRequestOptions,
} from 'n8n-workflow';

interface KpiItem {
  canvas_external_id: string;
  element_slug: string;
  value: number;
}

interface IngestResponse {
  success: boolean;
  data: Array<{
    canvas_external_id: string;
    element_slug: string;
    value: number;
    imported_at: string;
  }>;
}

export class KpiCanvas implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'KPI Canvas',
    name: 'kpiCanvas',
    icon: 'file:kpi-canvas.svg',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["sendMode"] === "batch" ? "Batch upsert" : "Upsert · " + $parameter["elementSlug"]}}',
    description: 'Push KPI values into Canvas Creation Studio. Requires a Pro subscription.',
    defaults: { name: 'KPI Canvas' },
    inputs: ['main'] as any,
    outputs: ['main'] as any,
    credentials: [
      {
        name: 'kpiCanvasApi',
        required: true,
      },
    ],
    properties: [
      // ── Send mode ────────────────────────────────────────────────────────
      {
        displayName: 'Send Mode',
        name: 'sendMode',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Single Item',
            value: 'single',
            description: 'Send one API call per input item (use expressions to map fields)',
          },
          {
            name: 'Batch',
            value: 'batch',
            description: 'Collect all input items and send them in one API call',
          },
        ],
        default: 'single',
      },

      // ── Single mode fields ────────────────────────────────────────────────
      {
        displayName: 'Canvas External ID',
        name: 'canvasExternalId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { sendMode: ['single'] } },
        description:
          'The external_id set on the canvas (e.g. "sales-2026"). ' +
          'Set this in Canvas Settings inside the app.',
        placeholder: 'sales-2026',
      },
      {
        displayName: 'Element Slug',
        name: 'elementSlug',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { sendMode: ['single'] } },
        description:
          'The slug set on the KPI element (e.g. "revenue-q1"). ' +
          'Set this in the element properties panel.',
        placeholder: 'revenue-q1',
      },
      {
        displayName: 'Value',
        name: 'value',
        type: 'number',
        default: 0,
        required: true,
        displayOptions: { show: { sendMode: ['single'] } },
        description: 'The numeric KPI value to import.',
      },

      // ── Batch mode fields ─────────────────────────────────────────────────
      {
        displayName: 'Canvas External ID Field',
        name: 'canvasExternalIdField',
        type: 'string',
        default: 'canvas_external_id',
        required: true,
        displayOptions: { show: { sendMode: ['batch'] } },
        description: 'Name of the input field containing the canvas external_id.',
      },
      {
        displayName: 'Element Slug Field',
        name: 'elementSlugField',
        type: 'string',
        default: 'element_slug',
        required: true,
        displayOptions: { show: { sendMode: ['batch'] } },
        description: 'Name of the input field containing the element slug.',
      },
      {
        displayName: 'Value Field',
        name: 'valueField',
        type: 'string',
        default: 'value',
        required: true,
        displayOptions: { show: { sendMode: ['batch'] } },
        description: 'Name of the input field containing the numeric value.',
      },

      // ── Options ───────────────────────────────────────────────────────────
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Timeout (ms)',
            name: 'timeout',
            type: 'number',
            default: 10000,
            description: 'Request timeout in milliseconds.',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials('kpiCanvasApi');

    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
    const apiKey = credentials.apiKey as string;

    if (!apiKey) {
      throw new NodeOperationError(this.getNode(), 'API key is not set in the KPI Canvas credential.');
    }

    // Basic Auth header — "api" as placeholder username, actual key as password
    const authHeader = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');

    const sendMode = this.getNodeParameter('sendMode', 0) as string;
    const options = this.getNodeParameter('options', 0) as { timeout?: number };
    const timeout = options.timeout ?? 10000;

    const returnData: INodeExecutionData[] = [];

    // ── Batch mode: one request for all items ────────────────────────────────
    if (sendMode === 'batch') {
      const canvasField = this.getNodeParameter('canvasExternalIdField', 0) as string;
      const slugField = this.getNodeParameter('elementSlugField', 0) as string;
      const valueField = this.getNodeParameter('valueField', 0) as string;

      const payload: KpiItem[] = items.map((item, idx) => {
        const canvasId = item.json[canvasField];
        const slug = item.json[slugField];
        const val = item.json[valueField];

        if (!canvasId || typeof canvasId !== 'string') {
          throw new NodeOperationError(
            this.getNode(),
            `Item ${idx}: field "${canvasField}" is missing or not a string.`,
          );
        }
        if (!slug || typeof slug !== 'string') {
          throw new NodeOperationError(
            this.getNode(),
            `Item ${idx}: field "${slugField}" is missing or not a string.`,
          );
        }
        if (typeof val !== 'number' || !isFinite(val)) {
          throw new NodeOperationError(
            this.getNode(),
            `Item ${idx}: field "${valueField}" must be a finite number (got ${JSON.stringify(val)}).`,
          );
        }

        return { canvas_external_id: canvasId, element_slug: slug, value: val };
      });

      const response = await makeRequest.call(this, baseUrl, authHeader, payload, timeout);

      for (const row of response.data) {
        returnData.push({ json: row });
      }

      return [returnData];
    }

    // ── Single mode: one request per item ────────────────────────────────────
    for (let i = 0; i < items.length; i++) {
      try {
        const canvasExternalId = this.getNodeParameter('canvasExternalId', i) as string;
        const elementSlug = this.getNodeParameter('elementSlug', i) as string;
        const value = this.getNodeParameter('value', i) as number;

        if (!canvasExternalId) {
          throw new NodeOperationError(this.getNode(), 'Canvas External ID is required.', { itemIndex: i });
        }
        if (!elementSlug) {
          throw new NodeOperationError(this.getNode(), 'Element Slug is required.', { itemIndex: i });
        }
        if (!isFinite(value)) {
          throw new NodeOperationError(this.getNode(), 'Value must be a finite number.', { itemIndex: i });
        }

        const payload: KpiItem = { canvas_external_id: canvasExternalId, element_slug: elementSlug, value };
        const response = await makeRequest.call(this, baseUrl, authHeader, payload, timeout);

        returnData.push({ json: response.data[0] ?? payload, pairedItem: { item: i } });
      } catch (err) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: err instanceof Error ? err.message : String(err) },
            pairedItem: { item: i },
          });
          continue;
        }
        throw err;
      }
    }

    return [returnData];
  }
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function makeRequest(
  this: IExecuteFunctions,
  baseUrl: string,
  authHeader: string,
  payload: KpiItem | KpiItem[],
  timeout: number,
): Promise<IngestResponse> {
  const requestOptions: IHttpRequestOptions = {
    method: 'POST',
    url: `${baseUrl}/kpi-ingest`,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: payload,
    json: true,
    timeout,
  };

  let statusCode = 200;
  let responseBody: unknown;

  try {
    responseBody = await this.helpers.httpRequest(requestOptions);
  } catch (err: any) {
    // n8n wraps HTTP errors — extract status and body where possible
    statusCode = err.response?.status ?? err.statusCode ?? 0;
    responseBody = err.response?.data ?? err.response?.body ?? {};

    const body = responseBody as Record<string, unknown>;

    if (statusCode === 401) {
      throw new NodeOperationError(
        this.getNode(),
        'Invalid API key. Generate a new one in Profile → API Key.',
      );
    }
    if (statusCode === 403) {
      throw new NodeOperationError(
        this.getNode(),
        `Pro subscription required. Current status: ${body.subscription_status ?? 'unknown'}.`,
      );
    }
    if (statusCode === 429) {
      throw new NodeOperationError(
        this.getNode(),
        'Rate limit exceeded (10 req/s). Retry after 1 second.',
      );
    }
    if (statusCode === 400) {
      throw new NodeOperationError(
        this.getNode(),
        `Bad request: ${body.error ?? 'invalid payload'}`,
      );
    }

    throw new NodeApiError(this.getNode(), err, {
      message: `KPI Canvas API error (${statusCode}): ${body.error ?? err.message}`,
    });
  }

  return responseBody as IngestResponse;
}
