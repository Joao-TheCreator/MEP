import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** `npm run balance`: prints the season tables of docs/design.md §15.5. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/game/balance.report.ts"], silent: false },
});
