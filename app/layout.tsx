import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContractAI",
  description: "Ask questions about contracts and get answers backed by verified quotes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
