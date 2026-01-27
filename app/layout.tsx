import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EU5 Map App",
  description: "Interactive map for Europa Universalis 5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
