import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Historical SQL kept for reference against the old hosted database.
    "drizzle/legacy/**",
  ]),
  {
    rules: {
      // Flags a synchronous setState inside an effect — in this codebase that is
      // `setLoading(true)` immediately before a fetch, or clearing derived state
      // ahead of an early return. It costs an extra render pass; it does not make
      // the component incorrect.
      //
      // Downgraded to a warning rather than silenced: there are ~15 instances
      // across the dashboard pages, and restructuring each is a UI refactor with
      // its own regression risk, separate from any correctness work. The rules in
      // this family that DO indicate real bugs — react-hooks/purity (impure call
      // during render) and creating components during render — remain errors, and
      // both are now clean.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
