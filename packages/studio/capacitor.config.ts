import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "top.yangyangnj.inkos",
  appName: "YANGYANG 小说 Agent",
  webDir: "dist/client",
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
