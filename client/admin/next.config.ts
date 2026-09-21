import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
const devOrigin = process.env.NGROK_HOST;

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigin ? [devOrigin] : [],
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
