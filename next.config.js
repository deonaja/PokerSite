/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev-only: LAN origins allowed to load /_next/* dev assets + HMR when testing
  // on a phone over Wi-Fi. Must match the machine's current LAN subnet, or the
  // phone gets SSR HTML but no hydrated JS (buttons dead, only <a> links work).
  // Cover the common home subnets so this doesn't break when the router hands out
  // a different range.
  allowedDevOrigins: ['192.168.0.*', '192.168.1.*', '192.168.18.*'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
