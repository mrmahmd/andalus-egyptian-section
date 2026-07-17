"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", icon: "H" },
  { href: "/weekly-plan", label: "Weekly Plan", icon: "WP" },
  { href: "/timetable", label: "Timetable", icon: "TT" },
  { href: "/support", label: "Support", icon: "?" },
];

export default function MobileNavigation() {
  const pathname = usePathname();
  if (pathname.startsWith("/teachers") || pathname.startsWith("/admin") || pathname.startsWith("/super-admin")) return null;
  return <nav className="mobile-navigation" aria-label="Mobile navigation">{links.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}><span>{link.icon}</span><b>{link.label}</b></Link>)}</nav>;
}
