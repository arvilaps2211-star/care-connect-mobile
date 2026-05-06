import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isAmbulance = mode === "ambulance";

  return {
    base: "./",
    server: {
      host: "localhost",
      port: 5173,
      open: true,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_APP_TYPE": JSON.stringify(isAmbulance ? "ambulance" : "user"),
    },
    build: {
      outDir: isAmbulance ? "dist-ambulance" : "dist",
    },
  };
});
