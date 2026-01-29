import { AppContextProvider } from "@/app/appContextProvider";


export default function VersionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppContextProvider>
      {children}
    </AppContextProvider>
  );
}
