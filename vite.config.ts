import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command, mode }) => {
  const internalPlugins = [];

  // 1. Tailwind CSS integration
  internalPlugins.push(tailwindcss());

  // 2. TypeScript Config Paths resolution
  internalPlugins.push(tsConfigPaths({ projects: ["./tsconfig.json"] }));

  // Cloudflare plugin removed for Netlify support

  // 4. TanStack Start Vite integration with proper route/server-only isolation
  internalPlugins.push(
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/*.server.ts", "**/*.server.tsx"],
          specifiers: ["server-only"],
        },
      },
    }),
  );

  // 5. React framework support
  internalPlugins.push(viteReact());

  // Dynamic environment variables injection (loads all VITE_* env variables)
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "::",
      port: 8080,
      watch: {
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100,
        },
      },
    },
    plugins: internalPlugins,
  };
});
