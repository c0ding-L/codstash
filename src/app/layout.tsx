import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Kept distinct from Tailwind's `--font-sans` / `--font-mono` theme keys:
// globals.css maps those to these in its `@theme inline` block. Naming them
// identically makes the theme declaration self-referential, which CSS treats
// as invalid at computed-value time.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codstash",
};

// Dark mode is the only theme for now; tells the browser to render native
// controls and scrollbars dark instead of flashing light.
export const viewport: Viewport = {
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
