import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlyClear SG — Drone Pre-Flight Zone & Lightning Checker',
  description:
    'Check Singapore drone restricted areas and recent NEA lightning observations around your planned flying point.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-SG">
      <body>{children}</body>
    </html>
  );
}
