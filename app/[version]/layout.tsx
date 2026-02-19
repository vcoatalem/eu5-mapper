import { AppContextProvider } from "@/app/appContextProvider";
import { ClickContextProvider } from "@/app/clickContext.provider";

export default function VersionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppContextProvider><ClickContextProvider>{children}</ClickContextProvider></AppContextProvider>;
}
