import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/quotes", destination: "/offers", permanent: false },
      { source: "/quotes/:path*", destination: "/offers/:path*", permanent: false },
      { source: "/offers/preview", destination: "/proposal/preview", permanent: false },
      // Builder steps renamed to match their pill labels. Keep the old paths
      // alive so in-flight draft links (they carry ?offer=) still resolve.
      { source: "/offers/new", destination: "/offers/contact", permanent: false },
      { source: "/offers/pricing", destination: "/offers/complexity", permanent: false },
      { source: "/offers/calculator", destination: "/offers/adjustments", permanent: false },
    ];
  },
  async headers() {
    const proposalHeaders = [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/proposal/:path*", headers: proposalHeaders },
      { source: "/api/proposal/:path*", headers: proposalHeaders },
    ];
  },
};

export default nextConfig;

