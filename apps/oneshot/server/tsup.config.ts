import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  clean: true,
  // @oneshot/shared resolves to raw .ts source (see shared/package.json exports),
  // which Node refuses to type-strip under node_modules in production. Inline it
  // into the bundle instead so the deployed server has no runtime dependency on it.
  noExternal: ["@oneshot/shared"],
});
