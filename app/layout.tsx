import type { Metadata } from "next";
import { Bebas_Neue, Great_Vibes, Jost } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const greatVibes = Great_Vibes({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-great",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hamsun — Branch Manager Weekly Checklist",
  description: "Weekly checklist for Hamsun Hospitality branch managers",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${greatVibes.variable} ${jost.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}