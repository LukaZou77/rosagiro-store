import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const ignored = [
  ".next/**",
  "dist/**",
  "node_modules/**",
  "src/generated/**",
  "public/assets/**"
];

const config = [
  {
    ignores: ignored
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-img-element": "off"
    }
  }
];

export default config;
