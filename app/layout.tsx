import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claudmor",
  description: "Authentication, licensing, and Claudium access control."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
