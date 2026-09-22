import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? process.env.INTERNAL_API_URL ?? 'http://server:3001';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'server',
        port: '3001',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/uploads/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/docs',
        destination: `${backendUrl}/api/docs`,
      },
      {
        source: '/api/docs/:path*',
        destination: `${backendUrl}/api/docs/:path*`,
      },
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
