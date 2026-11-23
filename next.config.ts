import type { NextConfig } from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),  // Uncomment this line if you want to use path.resolve(__dirname, '../../')
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
