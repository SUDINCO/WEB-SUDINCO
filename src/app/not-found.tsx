
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <TriangleAlert className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-4xl font-bold">404 - Página No Encontrada</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Lo sentimos, no pudimos encontrar la página que estás buscando. Es posible que haya sido eliminada o que la URL sea incorrecta.
      </p>
      <Button asChild className="mt-8">
        <Link href="/dashboard">
          Volver al Dashboard
        </Link>
      </Button>
    </div>
  );
}
