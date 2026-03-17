// rollup.config.js — CStoreGrid.app build config
//
// Bundles:
//   CStoreGrid.js (dApp shell, ES6)
//   + ../engine/*.ts (StoreVault engine, TypeScript)
//
// Excludes all Gridnet OS system libraries — they are
// provided by the OS runtime and must never be bundled.

import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"

// All /lib/* imports are OS-provided globals — mark as external.
// Rollup will leave these import statements intact in the output,
// which is exactly what the OS expects.
const SYSTEM_LIBS = [
  "/lib/window.js",
  "/lib/MetaData.js",
  "/lib/tools.js",
  "/lib/SettingsManager.js",
  "/lib/GridScriptCompiler.js",
  "/lib/NetMsg.js",
  "/lib/AppSelector.js",
  "/lib/BlockDesc.js",
  "/lib/Transaction.js",
]

export default {
  input: "store-v1/dapp/CStoreGrid.js",

  output: {
    file:    "dist/CStoreGrid.js",   // rename to CStoreGrid.app before upload
    format:  "es",                   // OS expects ES module
    strict:  true,                   // Belt-and-suspenders; "use strict" already in source
    banner:  '"use strict"',         // Ensure it leads the output file
  },

external: [
  ...SYSTEM_LIBS,
  "crypto",
  "../engine/StoreVault.js",
  "../engine/guards.js",
  "../engine/transitions.js",
  "../engine/receipts.js",
  "../adapter/SimAdapter.js"
],

plugins: [
  // Resolve relative imports (../engine/*.ts etc.)
  nodeResolve({
    extensions: [".js", ".ts"]
  }),

  // Compile TypeScript engine files inline — no separate tsc step needed
  typescript({
    tsconfig: "./tsconfig.json",

    // Prevent tests and scripts from entering the dApp bundle
    exclude: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "store-v1/tests/**",
      "store-v1/scripts/**"
    ],

    declaration: false,
    sourceMap: false,

    compilerOptions: {
      module: "ESNext",
      target: "ES2020",
      moduleResolution: "bundler",
      declaration: false,
      declarationMap: false,
      composite: false,
      verbatimModuleSyntax: false
    }
  })
],
}
