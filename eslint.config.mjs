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
    "*.js",
    "**/*.js",
  ]),
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type='NewExpression']",
          message:
            "Exporting a module-level `new` instance creates a shared singleton across every consumer. Instantiate inside a class/factory instead, or inject via context (e.g. GameEngine). If this one is genuinely safe (stateless/immutable value), disable this rule on the line with a comment explaining why.",
        },
      ],
    },
  },
]);

export default eslintConfig;
