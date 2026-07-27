import { GAME_DATA_CDN_URL } from "@/app/config/gameData.config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  crossOrigin: "anonymous",
  images: {
    remotePatterns: [new URL(`${GAME_DATA_CDN_URL}/**/*`)],
  },
  // files in /gui should not be replaced. If they need changing, they should be renamed instead.
  async headers() {
    return [
      {
        source: "/gui/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
