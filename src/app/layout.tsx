import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Toaster } from '@/components/layout/Toaster';
import { MotionProvider } from '@/components/motion/MotionProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-value',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wire Anomaly Detection | Crowe',
  description: 'Upload, validate, and profile wire transaction datasets for anomaly detection.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <MotionProvider>
          <Navbar />
          <div className="min-h-screen">
            {children}
          </div>
          <Footer />
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
