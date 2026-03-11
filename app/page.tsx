"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GameDataVersion } from "@/app/[version]/version.guard";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to default version
    const version: GameDataVersion = "1.1.9";
    router.replace(`/${version}`);
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-white">Redirecting...</p>
    </div>
  );
}
