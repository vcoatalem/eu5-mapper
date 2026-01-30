import { execSync } from "child_process";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      config.plugins.push({
        apply: (compiler: any) => {
          compiler.hooks.done.tap("CopyWorkersPlugin", () => {
            execSync("npm run build:workers");
          });
        },
      });
    }
    return config;
  },
};

export default nextConfig;
