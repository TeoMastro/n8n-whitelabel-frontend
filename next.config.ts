import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', 'mammoth'],
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
