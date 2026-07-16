import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weekly Study Plan | AlAndalus Private Schools",
  description: "Weekly lessons, homework, and teacher notes for AlAndalus Private Schools — Egyptian Section.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
