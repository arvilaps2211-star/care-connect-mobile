import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Publishable (safe for client) backend fallbacks so exported/native builds
// never end up with an undefined backend URL -> "Failed to fetch" on login.
const FALLBACK_SUPABASE_URL = "https://fiporvgykkrsdodggdvy.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcG9ydmd5a2tyc2RvZGdnZHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzU0NzAsImV4cCI6MjA3OTc1MTQ3MH0.Fl-d6TQSbB8IM3M0zwQc8QovQwR1Sq4F_y-8YDNIiwY";
const FALLBACK_SUPABASE_PROJECT_ID = "fiporvgykkrsdodggdvy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isAmbulance = mode === "ambulance";
  const env = loadEnv(mode, process.cwd(), "");

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
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL,
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        env.VITE_SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID,
      ),
    },
    build: {
      outDir: isAmbulance ? "dist-ambulance" : "dist",
    },
  };
});
