import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--f-display", display: "swap" });
const body = Inter_Tight({ subsets: ["latin"], variable: "--f-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kinesis Studio — describe a motion, get a timeline", template: "%s · Kinesis Studio" },
  description: "Describe motion in plain words and get a production-ready, editable animation timeline. Exports to Lottie, CSS, GSAP and Framer Motion. Powered by Otari.",
};
export const viewport: Viewport = { themeColor: "#0b0b0f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
