import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetSignal",
  description: "Score your LinkedIn relationships and surface hot leads for outreach",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
