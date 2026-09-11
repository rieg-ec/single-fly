import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fly Swipe — neural dating experiment",
  description: "A trained fly-connectome readout swipes through held-out portraits. Watch live brain activity, decisions, and history.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
