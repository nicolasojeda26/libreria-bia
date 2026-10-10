import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd22fxaf9t8d39k.cloudfront.net',
      },
    ],
  },
  async redirects() {
    return [
      // Dirección del catálogo anterior
      { source: '/libreria', destination: '/productos', permanent: true },
    ];
  },
};

export default nextConfig;
