
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectToPublications() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirigir a la nueva ubicación del módulo de publicaciones
    router.replace('/dashboard/administration/publications');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Redirigiendo a Publicaciones...</p>
    </div>
  );
}
