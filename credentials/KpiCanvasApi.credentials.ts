import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class KpiCanvasApi implements ICredentialType {
	name = 'kpiCanvasApi';
	displayName = 'KPI Canvas API';
	documentationUrl = 'https://github.com/your-org/n8n-nodes-kpi-canvas';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'kpi_...',
			description: 'Your KPI Canvas API key. Generate one in Profile → API Key.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://vyhsvdbdbbnstusvziin.supabase.co/functions/v1',
			description: 'Base URL of the KPI Canvas API (Supabase Function URL).',
		},
	];
}
