import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    globalIgnores(["**/dist", "**/node_modules/**", "**/build/**", "./eslint.config.mjs"]), {
    extends: compat.extends("eslint:recommended"),

    languageOptions: {
        globals: {
            ...globals.node,
        },

        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        indent: ["error", 4, {
            SwitchCase: 1,
        }],

        "linebreak-style": 0,
        quotes: ["error", "single"],
        semi: ["error", "never"],
        "no-var": ["error"],
        "no-console": [0],
        "no-control-regex": [0],

        "no-unused-vars": ["error", {
            vars: "all",
            args: "none",
            ignoreRestSiblings: false,
            argsIgnorePattern: "reject",
        }],

        "no-async-promise-executor": [0],
        "no-undef": 0,
    },
}, {
    files: ["app/assets/js/scripts/*.js"],

    rules: {
        "no-unused-vars": [0],
        "no-undef": [0],
    },
}]);