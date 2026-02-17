/** @type {import('next').NextConfig} */
// Cache bust: env vars reloaded
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
