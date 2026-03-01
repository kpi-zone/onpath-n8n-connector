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
  reference_id: string;
  value: number;
}

interface IngestResponse {
  success: boolean;
  data: Array<{
    reference_id: string;
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
    version: 2,
    subtitle: '={{$parameter["sendMode"] === "batch" ? "Batch upsert" : "Upsert · " + $parameter["referenceId"]}}',
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
        displayName: 'Reference ID',
        name: 'referenceId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { sendMode: ['single'] } },
        description: 'The system-generated reference slug shown in the KPI element\'s "External KPI Source" section.',
        placeholder: 'swift-peak-3f9a',
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
        displayName: 'Reference ID Field',
        name: 'referenceIdField',
        type: 'string',
        default: 'reference_id',
        required: true,
        displayOptions: { show: { sendMode: ['batch'] } },
        description: 'Name of the input field containing the reference ID slug.',
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
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials('kpiCanvasApi');

    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
    const apiKey = (credentials.apiKey as string).trim(); // Cleaned up

    if (!apiKey) {
      throw new NodeOperationError(this.getNode(), 'API key is not set in the credentials.');
    }

    // Basic Auth header setup
    const authHeader = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');

    const sendMode = this.getNodeParameter('sendMode', 0) as string;
    const options = this.getNodeParameter('options', 0) as { timeout?: number };
    const timeout = options.timeout ?? 10000;

    const returnData: INodeExecutionData[] = [];

    if (sendMode === 'batch') {
      const refField = this.getNodeParameter('referenceIdField', 0) as string;
      const valueField = this.getNodeParameter('valueField', 0) as string;

      const payload: KpiItem[] = items.map((item, idx) => {
        const refId = item.json[refField];
        const val = item.json[valueField];

        if (!refId || typeof refId !== 'string') {
          throw new NodeOperationError(this.getNode(), `Item ${idx}: field "${refField}" is missing or invalid.`);
        }
        
        return { reference_id: refId, value: Number(val) };
      });

      const response = await makeRequest.call(this, baseUrl, authHeader, payload, timeout);
      return [this.helpers.returnJsonArray(response.data)];
    }

    // Single Mode
    for (let i = 0; i < items.length; i++) {
      try {
        const referenceId = this.getNodeParameter('referenceId', i) as string;
        const value = this.getNodeParameter('value', i) as number;

        const payload: KpiItem = { reference_id: referenceId, value };
        const response = await makeRequest.call(this, baseUrl, authHeader, payload, timeout);

        returnData.push({ 
          json: response.data[0] ?? { success: true, ...payload }, 
          pairedItem: { item: i } 
        });
      } catch (err) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: err.message }, pairedItem: { item: i } });
          continue;
        }
        throw err;
      }
    }

    return [returnData];
  }
}

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

  try {
    return await this.helpers.httpRequest(requestOptions);
  } catch (err: any) {
    const statusCode = err.response?.status ?? err.statusCode ?? 0;
    const body = err.response?.data ?? {};

    if (statusCode === 401) {
      throw new NodeOperationError(
        this.getNode(),
        'Authentication failed. Verify your API Key and ensure the Reference ID belongs to your account.',
      );
    }
    if (statusCode === 403) {
      throw new NodeOperationError(this.getNode(), 'Pro subscription required.');
    }
    if (statusCode === 429) {
      throw new NodeOperationError(this.getNode(), 'Rate limit exceeded (10 req/s).');
    }

    throw new NodeApiError(this.getNode(), err);
  }
}
