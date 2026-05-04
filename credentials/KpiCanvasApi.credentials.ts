import { ICredentialType, INodeProperties } from "n8n-workflow";

export class KpiCanvasApi implements ICredentialType {
  name = "kpiCanvasApi";
  displayName = "KPI Canvas API";
  documentationUrl = "https://github.com/kpi-zone/onpath-n8n-connector";
  authenticate = {
    type: "generic" as const,
    properties: {
      headers: {
        "X-API-Key": "={{$credentials.apiKey}}",
        Accept: "application/json",
      },
    },
  };
  test = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/kpi-ingest",
      method: "GET" as const,
    },
    rules: [
      {
        type: "responseSuccessBody" as const,
        properties: {
          key: "authenticated",
          value: true,
          message: "Connection succeeded but the API did not confirm authentication.",
        },
      },
    ],
  };

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      placeholder: "kpi_...",
      description:
        "Your KPI Canvas API key. Generate one in Organization Settings → API Tokens.",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://api.onpath.io/functions/v1",
      description: "Base URL of the KPI Canvas API (Supabase Function URL).",
    },
  ];
}
