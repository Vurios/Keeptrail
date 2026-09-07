import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "react-native": path.resolve(__dirname, "./src/shims/react-native-shim.js"),
    },
  },
  test: {
    environment: "node",
  },
});
