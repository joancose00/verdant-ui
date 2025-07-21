/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Environment variables that should be exposed to the browser
  env: {
    CUSTOM_KEY: 'my-value',
  },
  
  // Optimize for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Enable experimental features if needed
  experimental: {
    // Add experimental features here if needed
  },
  
  // Configure webpack if needed
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add polyfills for Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig;