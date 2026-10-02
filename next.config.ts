import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist and mammoth rely on Node internals and must not be bundled.
  serverExternalPackages: ["pdfjs-dist", "mammoth"],
};

export default nextConfig;
