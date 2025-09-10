/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Standalone output creates the minimal Node server bundle under .next/standalone
   * which helps both Vercel (for faster cold starts) and Netlify (with the Next plugin).
   */
  output: 'standalone'
};

module.exports = nextConfig;
