import { fetchJson } from "../hooks/use-api";
import {
  getBrowserCoverConfig,
  getBrowserServiceSelection,
  loadBrowserServices,
  type BrowserServiceConfig,
  type BrowserServiceSelection,
} from "./browser-service-config";

type JsonFetcher = typeof fetchJson;

interface ServerServiceConfigResponse {
  readonly service?: string | null;
  readonly defaultModel?: string | null;
}

function serviceConfigPayload(config: BrowserServiceConfig): Record<string, unknown> {
  if (config.service.startsWith("custom:")) {
    return {
      service: "custom",
      name: config.service.slice("custom:".length) || config.label,
      baseUrl: config.baseUrl ?? "",
      temperature: config.temperature,
      apiFormat: config.apiFormat,
      stream: config.stream,
    };
  }
  return {
    service: config.service,
    temperature: config.temperature,
    apiFormat: config.apiFormat,
    stream: config.stream,
  };
}

export async function getServerServiceSelection(
  fetchJsonImpl: JsonFetcher = fetchJson,
): Promise<BrowserServiceSelection | null> {
  const config = await fetchJsonImpl<ServerServiceConfigResponse>("/services/config");
  const service = typeof config.service === "string" ? config.service.trim() : "";
  const model = typeof config.defaultModel === "string" ? config.defaultModel.trim() : "";
  return service && model ? { service, model } : null;
}

export async function syncBrowserServiceConfigsToServer(
  fetchJsonImpl: JsonFetcher = fetchJson,
): Promise<void> {
  const services = loadBrowserServices();
  for (const config of services) {
    await fetchJsonImpl(`/services/${encodeURIComponent(config.service)}/secret`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: config.apiKey }),
    });
    await fetchJsonImpl("/services/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: config.service,
        ...(config.defaultModel ? { defaultModel: config.defaultModel } : {}),
        services: [serviceConfigPayload(config)],
      }),
    });
  }

  const selection = getBrowserServiceSelection();
  if (selection) {
    await fetchJsonImpl("/services/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: selection.service,
        defaultModel: selection.model,
      }),
    });
  }

  const cover = getBrowserCoverConfig();
  if (cover) {
    await fetchJsonImpl(`/cover/secret/${encodeURIComponent(cover.service)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: cover.apiKey }),
    });
    await fetchJsonImpl("/cover/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: cover.service, model: cover.model }),
    });
  }
}
