import { GAME_DATA_CDN_URL } from "@/app/config/gameData.config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  crossOrigin: "anonymous",
  images: {
    remotePatterns: [new URL(`${GAME_DATA_CDN_URL}/**/*`)],
  },
};

export default nextConfig;
