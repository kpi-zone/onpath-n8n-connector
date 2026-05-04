import { ICredentialType, INodeProperties } from "n8n-workflow";

const ONPATH_API_BASE_URL = "https://api.onpath.io/functions/v1";

export class DataFeedApi implements ICredentialType {
  name = "dataFeedApi";
  displayName = "Data Feed API";
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
      baseURL: ONPATH_API_BASE_URL,
      url: "/kpi-ingest",
      method: "GET" as const,
      headers: {
        "X-API-Key": "={{$credentials.apiKey}}",
        Accept: "application/json",
      },
    },
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
        "Your Data Feed API key. Generate one in Organization Settings → API Tokens.",
    },
  ];
}
