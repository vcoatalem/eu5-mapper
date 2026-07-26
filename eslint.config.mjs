import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

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
    files: ["**/*.model.ts", "app/lib/cameraController.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type='NewExpression']",
          message:
            "Exporting a module-level `new` instance creates a shared singleton across every consumer. Instantiate inside a class/factory instead, or inject via context (e.g. GameEngine). If this one is genuinely safe (stateless/immutable value), disable this rule on the line with a comment explaining why.",
        },
        {
          selector: "CallExpression[callee.property.name='subscribe']",
          message:
            "Do not call .subscribe() directly in model files — subscriptions must be tracked for proper disposal. Use `createManagedSubscription` from the ModelInitParams passed into init() instead.",
        },
        {
          selector: "CallExpression[callee.property.name='addEventListener']",
          message:
            "Do not call .addEventListener() directly in model files — listeners must be tracked for proper disposal. Use `createManagedEventListener` from the ModelInitParams passed into init() instead.",
        },
        {
          selector: "NewExpression[callee.name='ObservableCombiner']",
          message:
            "Do not construct ObservableCombiner directly in model files — its own dispose() must be tracked too, not just your subscription to it. Use `createManagedCombinerSubscription` from the ModelInitParams passed into init() instead.",
        },
      ],
    },
  },
]);

export default eslintConfig;
