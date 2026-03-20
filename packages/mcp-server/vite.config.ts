import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: false,
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
