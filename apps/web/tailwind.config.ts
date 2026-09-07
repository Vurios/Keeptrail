import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/shared/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shadcn Core tokens
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        // Katibay Brand Core tokens
        "brand-primary": "var(--brand-primary)",
        "brand-primary-hover": "var(--brand-primary-hover)",
        "brand-primary-fg": "var(--brand-primary-fg)",
        "brand-accent": "var(--brand-accent)",
        "brand-accent-hover": "var(--brand-accent-hover)",
        "brand-accent-fg": "var(--brand-accent-fg)",
        "brand-surface": "var(--brand-surface)",

        // Katibay Semantic Status Scales
        "status-success": {
          bg: "var(--status-success-bg)",
          border: "var(--status-success-border)",
          text: "var(--status-success-text)",
          fill: "var(--status-success-fill)",
          fg: "var(--status-success-fg)",
        },
        "status-warning": {
          bg: "var(--status-warning-bg)",
          border: "var(--status-warning-border)",
          text: "var(--status-warning-text)",
          fill: "var(--status-warning-fill)",
          fg: "var(--status-warning-fg)",
        },
        "status-danger": {
          bg: "var(--status-danger-bg)",
          border: "var(--status-danger-border)",
          text: "var(--status-danger-text)",
          fill: "var(--status-danger-fill)",
          fg: "var(--status-danger-fg)",
        },
        "status-neutral": {
          bg: "var(--status-neutral-bg)",
          border: "var(--status-neutral-border)",
          text: "var(--status-neutral-text)",
          fill: "var(--status-neutral-fill)",
          fg: "var(--status-neutral-fg)",
        },
        "status-info": {
          bg: "var(--status-info-bg)",
          border: "var(--status-info-border)",
          text: "var(--status-info-text)",
          fill: "var(--status-info-fill)",
          fg: "var(--status-info-fg)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
