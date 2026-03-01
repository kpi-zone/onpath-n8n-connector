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
		description: 'Push KPI values into Canvas Creation Studio.',
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
						description: 'Send one API call per input item',
					},
					{
						name: 'Batch',
						value: 'batch',
						description: 'Collect all input items and send them in one API call',
					},
				],
				default: 'single',
			},
			// Single Mode
			{
				displayName: 'Canvas External ID',
				name: 'canvasExternalId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { sendMode: ['single'] } },
				placeholder: 'sales-2026',
			},
			{
				displayName: 'Element Slug',
				name: 'elementSlug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { sendMode: ['single'] } },
				placeholder: 'revenue-q1',
			},
			{
				displayName: 'Value',
				name: 'value',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { sendMode: ['single'] } },
			},
			// Batch Mode
			{
				displayName: 'Canvas External ID Field',
				name: 'canvasExternalIdField',
				type: 'string',
				default: 'canvas_external_id',
				required: true,
				displayOptions: { show: { sendMode: ['batch'] } },
			},
			{
				displayName: 'Element Slug Field',
				name: 'elementSlugField',
				type: 'string',
				default: 'element_slug',
				required: true,
				displayOptions: { show: { sendMode: ['batch'] } },
			},
			{
				displayName: 'Value Field',
				name: 'valueField',
				type: 'string',
				default: 'value',
				required: true,
				displayOptions: { show: { sendMode: ['batch'] } },
			},
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
		
		// 1. Clean up inputs
		const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
		const apiKey = (credentials.apiKey as string).trim();

		if (!apiKey) {
			throw new NodeOperationError(this.getNode(), 'API key is missing in credentials.');
		}

		// 2. Format Basic Auth specifically for your Supabase extractApiKey function
		const authHeader = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');

		const sendMode = this.getNodeParameter('sendMode', 0) as string;
		const options = this.getNodeParameter('options', 0) as { timeout?: number };
		const timeout = options.timeout ?? 10000;

		const returnData: INodeExecutionData[] = [];

		if (sendMode === 'batch') {
			const canvasField = this.getNodeParameter('canvasExternalIdField', 0) as string;
			const slugField = this.getNodeParameter('elementSlugField', 0) as string;
			const valueField = this.getNodeParameter('valueField', 0) as string;

			const payload: KpiItem[] = items.map((item, idx) => ({
				canvas_external_id: item.json[canvasField] as string,
				element_slug: item.json[slugField] as string,
				value: Number(item.json[valueField]),
			}));

			const response = await makeRequest.call(this, baseUrl, authHeader, payload, timeout);
			return [this.helpers.returnJsonArray(response.data)];
		}

		// Single Mode
		for (let i = 0; i < items.length; i++) {
			try {
				const payload: KpiItem = {
					canvas_external_id: this.getNodeParameter('canvasExternalId', i) as string,
					element_slug: this.getNodeParameter('elementSlug', i) as string,
					value: this.getNodeParameter('value', i) as number,
				};

				const response = await makeRequest.call(this, baseUrl, authHeader, payload, timeout);
				returnData.push({ json: response.data[0] || { success: true }, pairedItem: { item: i } });
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
			'Authorization': authHeader,
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
			throw new NodeOperationError(this.getNode(), 
				'Auth Failed: Either the API Key is wrong, or the Canvas ID/Element Slug does not exist for this user.');
		}
		if (statusCode === 403) {
			throw new NodeOperationError(this.getNode(), 'Pro subscription required for this endpoint.');
		}
		if (statusCode === 429) {
			throw new NodeOperationError(this.getNode(), 'Rate limit hit. Wait 1 second.');
		}

		throw new NodeApiError(this.getNode(), err);
	}
}
