export default defineConfig({
  // ...existing config...
  server: {
    host: "127.0.0.1",
    hmr: {
      overlay: false, // disable the red overlay so missing envs don't block the page
    },
  },
});
function defineConfig<T>(config: T): T {
    return config;
}