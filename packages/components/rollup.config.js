import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import dts from "rollup-plugin-dts";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json");

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: packageJson.main,
        format: "cjs",
        sourcemap: true,
        exports: "named",
      },
      {
        file: packageJson.module,
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      typescript({
        tsconfig: "./tsconfig.json",
        sourceMap: true,
        inlineSources: false,
      }),
      resolve({
        browser: true,
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      }),
      commonjs(),
    ],
    external: ["react", "react-dom", "lucide-react", "clsx"],
  },
  {
    input: "src/index.ts",
    output: [{ file: "dist/index.d.ts", format: "esm" }],
    plugins: [
      dts({
        tsconfig: "./tsconfig.json",
      }),
    ],
    external: ["react", "react-dom", "lucide-react", "clsx"],
  },
];
