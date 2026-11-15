import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Listen on IPv4 loopback. On Windows "localhost" resolves to ::1 only, and a phone
    // tunnelled over USB (adb reverse tcp:5173 tcp:5173) connects on 127.0.0.1.
    host: "127.0.0.1",
    // The Food Banks Canada chart lives in ../shared so Android and Cloud Functions read the same file.
    fs: { allow: [".."] },
  },
});
