/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Force full rebuild - cache key v3
  generateBuildId: async () => `build-${Date.now()}`,
}

export default nextConfig
