"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to default version
    router.replace("/1.1.4");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-white">Redirecting...</p>
    </div>
  );
}
