import { isValidVersion } from "@/app/[version]/version.guard";
import { AppContextProvider } from "@/app/appContextProvider";
import { PopoverContextProvider } from "@/app/lib/popover/popover.provider";

export default async function VersionLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{
    version: string;
  }>;
}>) {
  const { version } = await params;

  if (!isValidVersion(version)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-white text-2xl">404 - Version not found</h1>
      </div>
    );
  }

  return (
    <AppContextProvider>
      <PopoverContextProvider>{children}</PopoverContextProvider>
    </AppContextProvider>
  );
}
