import { fetchJson } from "../hooks/use-api";

type JsonFetcher = typeof fetchJson;

interface ServerServiceConfigResponse {
  readonly service?: string | null;
  readonly defaultModel?: string | null;
}

export interface ServerServiceSelection {
  readonly service: string;
  readonly model: string;
}

export async function getServerServiceSelection(
  fetchJsonImpl: JsonFetcher = fetchJson,
): Promise<ServerServiceSelection | null> {
  const config = await fetchJsonImpl<ServerServiceConfigResponse>("/services/config");
  const service = typeof config.service === "string" ? config.service.trim() : "";
  const model = typeof config.defaultModel === "string" ? config.defaultModel.trim() : "";
  return service && model ? { service, model } : null;
}
