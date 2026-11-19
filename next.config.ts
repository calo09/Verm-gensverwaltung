import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CSV-Dateien werden als Text an den Server geschickt.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
