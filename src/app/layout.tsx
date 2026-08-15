import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Southwest Digital App",
  description: "Multi-brand client platform operated by Southwest Digital Marketing",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

