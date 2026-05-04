import {
  ICredentialDataDecryptedObject,
  ICredentialsDecrypted,
  ICredentialTestFunctions,
  IExecuteFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INodeCredentialTestResult,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  NodeApiError,
  NodeOperationError,
} from "n8n-workflow";

interface KpiItem {
  slug: string;
  value: number;
}

interface IngestResponse {
  success: boolean;
  data: Array<{
    slug: string;
    value: number;
    old_value?: number | null;
    imported_at: string;
  }>;
}

interface AuthCheckResponse {
  authenticated: boolean;
  token_name?: string | null;
}

interface FeedListResponse {
  authenticated: boolean;
  feeds: Array<{
    slug: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>;
}

export class KpiCanvas implements INodeType {
  description: INodeTypeDescription = {
    displayName: "KPI Canvas",
    name: "kpiCanvas",
    icon: "file:kpi-canvas.svg",
    group: ["output"],
    version: 2,
    subtitle:
      '={{$parameter["sendMode"] === "batch" ? "Batch upsert" : "Upsert · " + $parameter["feedSlug"]}}',
    description:
      "Push KPI values into Canvas Creation Studio. Requires a Pro subscription.",
    defaults: { name: "KPI Canvas" },
    inputs: ["main"] as any,
    outputs: ["main"] as any,
    credentials: [
      {
        name: "kpiCanvasApi",
        required: true,
        testedBy: "testKpiCanvasConnection",
      },
    ],
    properties: [
      {
        displayName: "Send Mode",
        name: "sendMode",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Single Item",
            value: "single",
            description:
              "Send one API call per input item (use expressions to map fields)",
          },
          {
            name: "Batch",
            value: "batch",
            description:
              "Collect all input items and send them in one API call",
          },
        ],
        default: "single",
      },
      // ── Single mode fields ────────────────────────────────────────────────
      {
        displayName: "Feed",
        name: "feedSlug",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getFeeds",
        },
        default: "",
        required: true,
        displayOptions: { show: { sendMode: ["single"] } },
        description:
          "Feed assigned to this API key. The selected feed's slug is sent to the KPI Ingest API.",
      },
      {
        displayName: "Value",
        name: "value",
        type: "number",
        default: 0,
        required: true,
        displayOptions: { show: { sendMode: ["single"] } },
        description: "The numeric KPI value to import.",
      },
      // ── Batch mode fields ─────────────────────────────────────────────────
      {
        displayName: "Slug Field",
        name: "referenceIdField",
        type: "string",
        default: "slug",
        required: true,
        displayOptions: { show: { sendMode: ["batch"] } },
        description:
          "Name of the input field containing the feed slug.",
      },
      {
        displayName: "Value Field",
        name: "valueField",
        type: "string",
        default: "value",
        required: true,
        displayOptions: { show: { sendMode: ["batch"] } },
        description: "Name of the input field containing the numeric value.",
      },
      // ── Options ───────────────────────────────────────────────────────────
      {
        displayName: "Options",
        name: "options",
        type: "collection",
        placeholder: "Add Option",
        default: {},
        options: [
          {
            displayName: "Timeout (ms)",
            name: "timeout",
            type: "number",
            default: 10000,
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getFeeds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials("kpiCanvasApi");
        const baseUrl = String(credentials.baseUrl ?? "").replace(/\/$/, "");

        if (!baseUrl) {
          throw new NodeOperationError(
            this.getNode(),
            "Base URL is not set in the credentials.",
          );
        }

        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          "kpiCanvasApi",
          {
            method: "GET",
            url: `${baseUrl}/kpi-ingest/feeds`,
            json: true,
          },
        ) as FeedListResponse;

        return (response.feeds ?? []).map((feed) => ({
          name: feed.name,
          value: feed.slug,
          description: feed.slug,
        }));
      },
    },
    credentialTest: {
      async testKpiCanvasConnection(
        this: ICredentialTestFunctions,
        credential: ICredentialsDecrypted<ICredentialDataDecryptedObject>,
      ): Promise<INodeCredentialTestResult> {
        const credentialData = credential.data ?? {};
        const baseUrl = String(credentialData.baseUrl ?? "").replace(/\/$/, "");
        const apiKey = String(credentialData.apiKey ?? "").trim();

        if (!baseUrl || !apiKey) {
          return {
            status: "Error",
            message: "Base URL and API Key are required.",
          };
        }

        try {
          const response = await this.helpers.request({
            method: "GET",
            uri: `${baseUrl}/kpi-ingest`,
            headers: {
              "X-API-Key": apiKey,
              Accept: "application/json",
            },
            json: true,
          }) as AuthCheckResponse;

          if (response.authenticated !== true) {
            return {
              status: "Error",
              message: "Connection test failed: authenticated=false.",
            };
          }

          const tokenName = typeof response.token_name === "string" && response.token_name.trim().length > 0
            ? response.token_name.trim()
            : null;

          return {
            status: "OK",
            message: tokenName
              ? `Connection successful. API key: ${tokenName}`
              : "Connection successful.",
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            status: "Error",
            message: `Connection failed: ${message}`,
          };
        }
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials("kpiCanvasApi");

    const baseUrl = (credentials.baseUrl as string).replace(/\/$/, "");

    const sendMode = this.getNodeParameter("sendMode", 0) as string;
    const options = this.getNodeParameter("options", 0) as { timeout?: number };
    const timeout = options.timeout ?? 10000;

    const returnData: INodeExecutionData[] = [];

    if (sendMode === "batch") {
      const refField = this.getNodeParameter("referenceIdField", 0) as string;
      const valueField = this.getNodeParameter("valueField", 0) as string;

      const payload: KpiItem[] = items.map((item: INodeExecutionData, idx: number) => {
        const slug = item.json[refField];
        const val = item.json[valueField];

        if (!slug || typeof slug !== "string") {
          throw new NodeOperationError(
            this.getNode(),
            `Item ${idx}: field "${refField}" is missing or invalid.`,
          );
        }

        return { slug, value: Number(val) };
      });

      const response = await makeRequest.call(
        this,
        baseUrl,
        payload,
        timeout,
      );
      return [this.helpers.returnJsonArray(response.data)];
    }

    // Single Mode
    for (let i = 0; i < items.length; i++) {
      try {
        const referenceId = this.getNodeParameter("feedSlug", i) as string;
        const value = this.getNodeParameter("value", i) as number;

        const payload: KpiItem = { slug: referenceId, value };
        const response = await makeRequest.call(
          this,
          baseUrl,
          payload,
          timeout,
        );

        returnData.push({
          json: response.data[0] ?? { success: true, ...payload },
          pairedItem: { item: i },
        });
      } catch (err) {
        if (this.continueOnFail()) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          returnData.push({
            json: { error: errorMessage },
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

async function makeRequest(
  this: IExecuteFunctions,
  baseUrl: string,
  payload: KpiItem | KpiItem[],
  timeout: number,
): Promise<IngestResponse> {
  const requestOptions: IHttpRequestOptions = {
    method: "POST",
    url: `${baseUrl}/kpi-ingest`,
    headers: { "Content-Type": "application/json" },
    body: payload,
    json: true,
    timeout,
  };

  try {
    return await this.helpers.httpRequestWithAuthentication.call(
      this,
      "kpiCanvasApi",
      requestOptions,
    );
  } catch (err: any) {
    const statusCode = err.response?.status ?? err.statusCode ?? 0;
    const body = err.response?.data ?? {};
    const message = typeof body?.error === "string" ? body.error : undefined;

    if (statusCode === 401) {
      throw new NodeOperationError(
        this.getNode(),
        "Authentication failed. Verify your API Key and ensure the selected feed slug is assigned to this token.",
      );
    }
    if (statusCode === 403) {
      throw new NodeOperationError(
        this.getNode(),
        message ?? "Pro subscription required.",
      );
    }
    if (statusCode === 429) {
      throw new NodeOperationError(
        this.getNode(),
        message ?? "Rate limit exceeded (10 req/s).",
      );
    }
    if (statusCode === 400 && message) {
      throw new NodeOperationError(this.getNode(), message);
    }

    throw new NodeApiError(this.getNode(), err);
  }
}
