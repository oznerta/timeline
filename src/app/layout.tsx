import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'Weekline — Sprint Delivery Timeline Workspace',
  description: 'Clean multi-week sprint delivery schedule and organization workspace platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased light">
      <body className="min-h-full flex flex-col bg-[#F8F9FA] text-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
