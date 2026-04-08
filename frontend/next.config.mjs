/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable proper TypeScript error reporting
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable image optimization for better performance
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
    ],
  },
}

export default nextConfig
