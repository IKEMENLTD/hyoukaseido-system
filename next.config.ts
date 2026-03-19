import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 画像最適化
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // 不要な依存の除外（rechartsは未使用だがpackage.jsonに残っている間の安全策）
  serverExternalPackages: ['recharts'],
  // 実験的機能
  experimental: {
    // PPR (Partial Pre-Rendering) - Next.js 16で安定化
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
