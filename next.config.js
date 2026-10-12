/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // microphone=(self): mode karaoke butuh getUserMedia atas gestur
            // pengguna. Kamera & geolokasi tetap dimatikan (tidak dipakai).
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
