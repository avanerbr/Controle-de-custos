import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        casa: "#2563eb",
        empresa: "#16a34a",
        alerta: "#dc2626",
      },
    },
  },
  plugins: [],
};

export default config;
