import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Literata } from "next/font/google";
import "./globals.css";

// next/font has no metric overrides for this family yet, so no generated fallback.
const ui = Atkinson_Hyperlegible_Next({ variable: "--font-ui", subsets: ["latin"], display: "swap", adjustFontFallback: false });
const text = Literata({ variable: "--font-text", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Stet: college essay review", template: "%s · Stet" },
  description:
    "Feedback on your college essay that points at the sentence: a rubric-based review, voice and writing-pattern checks, and revision help that keeps your words yours.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2ef" },
    { media: "(prefers-color-scheme: dark)", color: "#15171b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${text.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
