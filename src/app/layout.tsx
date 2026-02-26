
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';

// Metadata para la aplicación PERFORMA - Actualizada para forzar reconstrucción de rutas
export const metadata: Metadata = {
  title: {
    default: "PERFORMA",
    template: "%s | PERFORMA",
  },
  description: 'Plataforma integral para la gestión de talento humano y control operativo.',
  icons: {
    icon: 'https://i.postimg.cc/sgYg2NKd/icono-performa.png',
    apple: 'https://i.postimg.cc/sgYg2NKd/icono-performa.png',
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
