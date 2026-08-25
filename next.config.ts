import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/quotes", destination: "/offers", permanent: false },
      { source: "/quotes/:path*", destination: "/offers/:path*", permanent: false },
    ];
  },
};

export default nextConfig;

