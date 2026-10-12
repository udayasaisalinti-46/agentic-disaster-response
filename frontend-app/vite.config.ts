import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/health": "http://127.0.0.1:8000",
      "/dashboard": "http://127.0.0.1:8000",
      "/incidents": "http://127.0.0.1:8000",
      "/resources": "http://127.0.0.1:8000",
      "/shelters": "http://127.0.0.1:8000",
      "/approvals": "http://127.0.0.1:8000",
      "/actions": "http://127.0.0.1:8000",
      "/agents": "http://127.0.0.1:8000",
      "/roads": "http://127.0.0.1:8000",
      "/alerts": "http://127.0.0.1:8000",
      "/workflow": "http://127.0.0.1:8000",
      "/weather": "http://127.0.0.1:8000",
      "/demo": "http://127.0.0.1:8000",
      "/reports": "http://127.0.0.1:8000",
      "/api-info": "http://127.0.0.1:8000",
    },
  },
});
