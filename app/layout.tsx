import type { Metadata } from "next";
import "./globals.css";
import LanguageSwitcher from "./language-switcher";
import MobileNavigation from "./mobile-navigation";

export const metadata: Metadata = {
  title: "Weekly Study Plan | AlAndalus Private Schools",
  description: "Weekly lessons, homework, and teacher notes for AlAndalus Private Schools — Egyptian Section.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body><LanguageSwitcher>{children}<MobileNavigation /></LanguageSwitcher></body>
    </html>
  );
}
