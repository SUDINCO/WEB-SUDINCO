
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: {
    default: "PERFORMA",
    template: "%s | PERFORMA",
  },
  description: 'Página de acceso para la aplicación PERFORMA',
  icons: {
    icon: 'https://i.postimg.cc/qRKPcjMj/logo4.png',
    apple: 'https://i.postimg.cc/qRKPcjMj/logo4.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
