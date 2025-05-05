import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Remove Replit specific plugins if they were present
    // runtimeErrorOverlay(), // Consider removing for production builds
  ],
  // Define aliases for cleaner imports
  resolve: {
    alias: {
      // Ensure paths are resolved correctly relative to this config file (in client/)
      "@db": path.resolve(__dirname, "../db"), // Go up one level to db/
      "@": path.resolve(__dirname, "./src"),   // src/ within client/
      "@shared": path.resolve(__dirname, "../shared"), // Go up one level to shared/
      // Add other aliases if needed
    },
  },
  // Set the root directory to the 'client' folder where this config resides
  root: path.resolve(__dirname),
  // Define build output directory relative to the project root
  build: {
    // Output to /dist/public in the project root, ready for S3 sync
    outDir: path.resolve(__dirname, "../dist/public"),
    emptyOutDir: true, // Clean the output directory before build
    sourcemap: process.env.NODE_ENV !== 'production', // Generate sourcemaps only for non-production builds
  },
  // Server proxy is usually NOT needed when deploying frontend/backend separately
  // CORS should be handled by the backend API server (server/auth.ts)
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'http://localhost:5000', // Target backend during local dev
  //       changeOrigin: true,
  //       secure: false, // Allow self-signed certs if backend uses HTTPS locally
  //     }
  //   }
  // }
});
