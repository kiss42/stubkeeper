import type { NextConfig } from "next";

// Static export for GitHub Pages. BASE_PATH is set by the deploy workflow
// (e.g. "/stubkeeper" for a project page).
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
