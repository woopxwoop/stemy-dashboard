import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/stemy-dashboard/",
  build: {
    outDir: "docs",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("xlsx")) return "vendor-xlsx";
          if (id.includes("zrender")) return "vendor-zrender";
          if (id.includes("echarts") || id.includes("echarts-for-react")) {
            return "vendor-echarts";
          }
          if (id.includes("dockview")) return "vendor-dockview";

          return "vendor";
        },
      },
    },
  },
});
