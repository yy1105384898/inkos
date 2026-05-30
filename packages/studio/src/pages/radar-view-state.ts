export interface RadarModelSelection {
  readonly selectedModel?: string | null;
  readonly selectedService?: string | null;
  readonly configuredModel?: string | null;
  readonly configuredService?: string | null;
}

export interface RadarScanBody {
  readonly service?: string;
  readonly model?: string;
}

function clean(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildRadarScanBody(selection: RadarModelSelection): RadarScanBody {
  const selectedService = clean(selection.selectedService);
  const selectedModel = clean(selection.selectedModel);
  if (selectedService && selectedModel) {
    return { service: selectedService, model: selectedModel };
  }

  const configuredService = clean(selection.configuredService);
  const configuredModel = clean(selection.configuredModel);
  if (configuredService && configuredModel) {
    return { service: configuredService, model: configuredModel };
  }

  return {};
}
