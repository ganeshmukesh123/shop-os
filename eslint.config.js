import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/release/**", "**/drizzle/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Constitution principle VIII: no single-letter names for variables, parameters, functions or properties.
      "id-length": ["error", { min: 2, properties: "always" }],
      // Constitution principle VIII: interfaces are IPascalCase, types and enums (and enum members) are PascalCase.
      // Constants (UPPER_SNAKE_CASE), small pure components and file placement are review checks.
      // Warnings for now: existing code predates the convention.
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: { regex: "^I[A-Z]", match: true },
        },
        { selector: "typeAlias", format: ["PascalCase"] },
        { selector: "enum", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase"] },
      ],
      // Design guidelines section 8: no inline styles and no hard-coded colours (use Radix props and tokens).
      // Warnings for now: existing screens predate the guideline.
      // Skills: shopos-engineering-standards. Size and shape limits (warnings: existing code predates them).
      "max-lines": ["warn", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ["warn", 10],
      "max-params": ["warn", 4],
      "max-depth": ["warn", 2],
      "no-else-return": "warn",
      "no-lonely-if": "warn",
      // Control flow: prefer ternary and &&; never continue; never nested ternaries (errors: no violations today).
      "no-continue": "error",
      "no-nested-ternary": "error",
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            "Avoid inline style; use Radix props or tokens (docs/design/design-guidelines.md section 8).",
        },
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            "Hard-coded colour; use a Radix colour token or the color prop (docs/design/design-guidelines.md).",
        },
      ],
    },
  },
  // Layering: @shopos/core stays pure (shopos-core-domain).
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "electron",
                "electron/*",
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "@radix-ui/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "better-sqlite3",
                "node:*",
                "fs",
                "path",
                "os",
                "child_process",
              ],
              message: "@shopos/core must stay pure: no Electron, React, database or Node imports.",
            },
          ],
        },
      ],
    },
  },
  // Layering: the renderer never touches the main process, Node or the database (shopos-electron-ipc).
  {
    files: ["apps/desktop/src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/main/**",
                "electron",
                "electron/*",
                "better-sqlite3",
                "drizzle-orm",
                "drizzle-orm/*",
                "node:*",
                "fs",
                "path",
                "os",
                "child_process",
              ],
              message:
                "The renderer calls typed commands through window.shopos; it never imports main-process, Node or database code.",
            },
          ],
        },
      ],
    },
  },
  // Tests may be longer, and describe blocks are long functions by nature.
  {
    files: ["**/tests/**/*.ts", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
    rules: {
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": "off",
    },
  },
);
