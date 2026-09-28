import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Options Intelligence Tracker",
  description: "Advanced options portfolio tracker with built-in Gemini Intelligence and Pro Scanners",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="font-sans antialiased"
      >
        {children}
      </body>
    </html>
  );
}
