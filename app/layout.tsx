import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepTruck",
  description: "Operations intelligence for trucking companies"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
