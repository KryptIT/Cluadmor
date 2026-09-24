import "./globals.css";
import "./polish.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Claudmor",
    template: "%s · Claudmor"
  },
  description: "Authentication, licensing, provider flows, and Claudium obfuscation for Lua scripts.",
  icons: {
    icon: "/claudmor-mark.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
