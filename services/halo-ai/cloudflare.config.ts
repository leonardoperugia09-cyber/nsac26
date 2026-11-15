import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "halo-ai",
    compatibilityDate: "2026-09-21",
    entrypoint,
    exports: { Budget: exports.durableObject({ storage: "sqlite" }) },
    env: {
      ANTHROPIC_API_KEY: bindings.secret(),
      BUDGET: bindings.durableObject({
        worker: "halo-ai",
        exportName: "Budget",
      }),
    },
    observability: { enabled: true },
  },
});
