import { defineConfig } from "vite";

export default defineConfig({
  // The Food Banks Canada chart lives in ../shared so Android and Cloud Functions read the same file.
  server: { fs: { allow: [".."] } },
});
