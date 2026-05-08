import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "_workspace/**", "coverage/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: { "@typescript-eslint": tseslint, import: importPlugin },
    rules: {
      // 레이어 강제: from → to 금지
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // L4 config는 L1/L2/L3 import 금지
            {
              target: "./src/config",
              from: "./src/api",
              message:
                "L4 (config) → L3 (api) import 금지. Config는 환경변수만 의존",
            },
            {
              target: "./src/config",
              from: "./src/raw",
              message: "L4 (config) → L2 (raw) import 금지",
            },
            {
              target: "./src/config",
              from: "./src/pivot",
              message: "L4 (config) → L2 (pivot) import 금지",
            },
            {
              target: "./src/config",
              from: "./src/excel",
              message: "L4 (config) → L2 (excel) import 금지",
            },
            {
              target: "./src/config",
              from: "./src/mcp",
              message: "L4 (config) → L1 (mcp) import 금지",
            },
            // L5 types는 src/ 내부 구현 모듈 import 금지
            {
              target: "./src/api/types.ts",
              from: "./src/api/client.ts",
              message: "L5 (types) → L3 (api/client) import 금지",
            },
            {
              target: "./src/api/types.ts",
              from: "./src/api/signer.ts",
              message: "L5 (types) → L3 (api/signer) import 금지",
            },
            {
              target: "./src/api/types.ts",
              from: "./src/config",
              message: "L5 (types) → L4 (config) import 금지",
            },
            // raw/, pivot/, excel/은 mcp/, cli 미import (역방향 금지)
            {
              target: "./src/raw",
              from: "./src/mcp",
              message: "L2 (raw) → L1 (mcp) 역방향 import 금지",
            },
            {
              target: "./src/pivot",
              from: "./src/mcp",
              message: "L2 (pivot) → L1 (mcp) 역방향 import 금지",
            },
            {
              target: "./src/excel",
              from: "./src/mcp",
              message: "L2 (excel) → L1 (mcp) 역방향 import 금지",
            },
            // raw/, pivot/은 api/client 직접 import 금지 (INaverAdsClient 인터페이스만)
            {
              target: "./src/raw",
              from: "./src/api/client.ts",
              message:
                "raw/는 NaverAdsClient 클래스 import 금지. INaverAdsClient 인터페이스(api/types.ts) 사용",
            },
            {
              target: "./src/pivot",
              from: "./src/api/client.ts",
              message:
                "pivot/는 api/client import 금지. RAW row 타입만 받음 (raw/builder.ts)",
            },
            // excel/은 api/, config/ import 금지
            {
              target: "./src/excel",
              from: "./src/api",
              message:
                "L2 (excel) → L3 (api) import 금지. excel은 타입 레이어(raw/builder, pivot/types)만 의존",
            },
            {
              target: "./src/excel",
              from: "./src/config",
              message: "L2 (excel) → L4 (config) import 금지",
            },
            // util/은 도메인 의존성 0 (순수 함수만)
            {
              target: "./src/util",
              from: "./src/api",
              message: "util/은 순수 함수만 허용. 도메인 모듈 import 금지",
            },
            {
              target: "./src/util",
              from: "./src/raw",
              message: "util/은 순수 함수만 허용. 도메인 모듈 import 금지",
            },
            {
              target: "./src/util",
              from: "./src/pivot",
              message: "util/은 순수 함수만 허용. 도메인 모듈 import 금지",
            },
            {
              target: "./src/util",
              from: "./src/excel",
              message: "util/은 순수 함수만 허용. 도메인 모듈 import 금지",
            },
            {
              target: "./src/util",
              from: "./src/mcp",
              message: "util/은 순수 함수만 허용. 도메인 모듈 import 금지",
            },
            {
              target: "./src/util",
              from: "./src/config",
              message: "util/은 순수 함수만 허용. 도메인 모듈 import 금지",
            },
          ],
        },
      ],
      // 순환 참조 방지
      "import/no-cycle": ["error", { maxDepth: 3 }],
      "import/no-self-import": "error",
      // CLI stderr 사용은 OK, 나머지 console 경고
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    rules: {
      "no-console": "off",
    },
  },
];
