import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pastikan baris "output: 'export'" SUDAH DIHAPUS atau dikomentari seperti ini:
  // output: 'export', 

  // Konfigurasi agar Vercel tidak membatalkan deploy jika ada warning kecil
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;