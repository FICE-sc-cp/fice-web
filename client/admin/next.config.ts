import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'barographic-unmalevolently-myrna.ngrok-free.dev',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'barographic-unmalevolently-myrna.ngrok-free.dev',
      },
    ],
  },
};

export default nextConfig;
