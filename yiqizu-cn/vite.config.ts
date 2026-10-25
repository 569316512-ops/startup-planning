import { defineConfig } from "vite";
export default defineConfig({
  base: "/cn-preview/",
  build: { outDir: "dist/h5", target: "es2022", sourcemap: false },
  server: { host: "127.0.0.1" },
});
