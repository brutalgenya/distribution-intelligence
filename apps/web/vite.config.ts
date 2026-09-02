import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL ?? "/api";
  const proxyTarget = env.VITE_API_PROXY_TARGET ?? "http://localhost:4000";
  const shouldProxy = apiBaseUrl.startsWith("/");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: shouldProxy
        ? {
            [apiBaseUrl]: {
              target: proxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(new RegExp(`^${apiBaseUrl}`), ""),
            },
          }
        : undefined,
    },
  };
});
