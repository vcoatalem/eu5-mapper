import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppContextProvider } from "../appContextProvider";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EU5 Map App",
  description: "Interactive map for Europa Universalis 5",
};

export default function VersionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppContextProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}
        >
          {children}
        </body>
      </html>
    </AppContextProvider>
  );
}
