import {DM_Sans, Manrope} from 'next/font/google';
import './splash.css';

// Downloaded at build time and served from this site: no request to a font CDN at run time.
const dmSans = DM_Sans({subsets: ['latin'], variable: '--font-dm-sans'});
const manrope = Manrope({subsets: ['latin'], variable: '--font-manrope'});

export const metadata = {
  title: 'Circuit Lab — 3D electronics workbench',
  description:
    'Circuit Lab — a hands-on 3D electronics workbench. Build circuits, write supported Arduino-style firmware, and inspect a deterministic electrical simulation.',
  icons: {icon: {url: '/favicon.svg', type: 'image/svg+xml'}},
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#19191e',
};

export default function RootLayout({children}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
