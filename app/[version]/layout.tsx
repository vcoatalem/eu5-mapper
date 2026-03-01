import { AppContextProvider } from "@/app/appContextProvider";
import { PopoverContextProvider } from "@/app/lib/popover/popover.provider";

export default function VersionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppContextProvider>
      <PopoverContextProvider>{children}</PopoverContextProvider>
    </AppContextProvider>
  );
}
