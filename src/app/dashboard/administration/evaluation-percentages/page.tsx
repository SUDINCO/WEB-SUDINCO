
"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ThumbsUp, XCircle, Search, Undo } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type Publication = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  imageUrl?: string;
  category: string;
  createdAt: { seconds: number; nanoseconds: number; } | number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
};

const formatTimestamp = (timestamp: Publication['createdAt']) => {
    if (!timestamp) return '';
    let date;
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (timestamp && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000);
    } else {
        return '';
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

function PublicationCard({ publication, onApprove, onReject, onRevert }: {
    publication: Publication;
    onApprove: (id: string) => void;
    onReject: (pub: Publication) => void;
    onRevert: (id: string) => void;
}) {
    return (
        <Card key={publication.id} className="p-4">
            <div className="flex gap-4">
                <Avatar>
                    <AvatarImage src={publication.authorAvatarUrl} />
                    <AvatarFallback>{publication.authorName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold">{publication.authorName}</p>
                            <p className="text-xs text-muted-foreground">{formatTimestamp(publication.createdAt)}</p>
                        </div>
                        <Badge variant="outline">{publication.category}</Badge>
                    </div>
                    <p className="text-sm">{publication.text}</p>
                    {publication.imageUrl && <Image src={publication.imageUrl} alt="Imagen de publicación" width={400} height={250} className="rounded-md border object-cover" />}
                    
                    {publication.status === 'rejected' && publication.rejectionReason && (
                        <div className="p-2 text-sm bg-destructive/10 border-l-4 border-destructive text-destructive-foreground rounded-r-md">
                            <p className="font-semibold">Motivo del Rechazo:</p>
                            <p className="italic">"{publication.rejectionReason}"</p>
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                        {publication.status === 'pending' && (
                            <>
                                <Button variant="outline" size="sm" className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700" onClick={() => onReject(publication)}>
                                    <XCircle className="mr-2 h-4 w-4" /> Rechazar
                                </Button>
                                <Button variant="outline" size="sm" className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700" onClick={() => onApprove(publication.id)}>
                                    <ThumbsUp className="mr-2 h-4 w-4" /> Aprobar
                                </Button>
                            </>
                        )}
                        {publication.status === 'rejected' && (
                             <Button variant="outline" size="sm" onClick={() => onApprove(publication.id)}>
                                <ThumbsUp className="mr-2 h-4 w-4"/> Aprobar de todas formas
                            </Button>
                        )}
                        {publication.status === 'approved' && (
                             <Button variant="outline" size="sm" onClick={() => onRevert(publication.id)}>
                                <Undo className="mr-2 h-4 w-4"/> Revertir a Pendiente
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default function ApprovePublicationsPage() {
  const [publicationToReject, setPublicationToReject] = useState<Publication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filter, setFilter] = useState('');
  const firestore = useFirestore();

  const { data: allPublications, isLoading: publicationsLoading } = useCollection<Publication>(
    useMemo(() => firestore ? collection(firestore, 'publications') : null, [firestore])
  );

  const filteredPublications = useMemo(() => {
    if (!allPublications) return [];
    if (!filter) return allPublications;
    const lowercasedFilter = filter.toLowerCase();
    return allPublications.filter(p => 
        p.authorName.toLowerCase().includes(lowercasedFilter) ||
        p.text.toLowerCase().includes(lowercasedFilter) ||
        p.category.toLowerCase().includes(lowercasedFilter)
    );
  }, [allPublications, filter]);

  const pendingPublications = React.useMemo(() =>
    filteredPublications?.filter(p => p.status === 'pending')
    .sort((a, b) => (typeof b.createdAt === 'number' ? b.createdAt : b.createdAt.seconds) - (typeof a.createdAt === 'number' ? a.createdAt : a.createdAt.seconds)) || [],
    [filteredPublications]
  );
  
  const approvedPublications = React.useMemo(() =>
    filteredPublications?.filter(p => p.status === 'approved')
    .sort((a, b) => (typeof b.createdAt === 'number' ? b.createdAt : b.createdAt.seconds) - (typeof a.createdAt === 'number' ? a.createdAt : a.createdAt.seconds)) || [],
    [filteredPublications]
  );

  const rejectedPublications = React.useMemo(() =>
    filteredPublications?.filter(p => p.status === 'rejected')
    .sort((a, b) => (typeof b.createdAt === 'number' ? b.createdAt : b.createdAt.seconds) - (typeof a.createdAt === 'number' ? a.createdAt : a.createdAt.seconds)) || [],
    [filteredPublications]
  );

  const handlePublicationAction = async (publicationId: string, newStatus: 'approved' | 'rejected' | 'pending', reason?: string) => {
    if (!firestore) return;

    const publicationDocRef = doc(firestore, 'publications', publicationId);

    try {
      await updateDoc(publicationDocRef, {
        status: newStatus,
        rejectionReason: reason || (newStatus === 'rejected' ? 'Rechazado sin motivo específico.' : ''),
      });
      toast({
        title: 'Publicación Actualizada',
        description: `La publicación ha sido marcada como ${newStatus === 'approved' ? 'aprobada' : (newStatus === 'rejected' ? 'rechazada' : 'pendiente')}.`,
      });
    } catch (error) {
      console.error('Error updating publication status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la publicación.',
      });
    } finally {
      setPublicationToReject(null);
      setRejectionReason('');
    }
  }

  const handleApprove = (id: string) => {
    handlePublicationAction(id, 'approved');
  }

  const handleReject = (pub: Publication) => {
    setPublicationToReject(pub);
  }

  const handleConfirmReject = () => {
    if (publicationToReject) {
        handlePublicationAction(publicationToReject.id, 'rejected', rejectionReason);
    }
  }

  const handleRevertToPending = (id: string) => {
    handlePublicationAction(id, 'pending');
  }

  const PublicationsList = ({ publications }: { publications: Publication[] }) => {
    if (publicationsLoading) {
      return <p className="text-center py-8">Cargando publicaciones...</p>;
    }
    if (publications.length === 0) {
      return <p className="text-center text-muted-foreground py-8">No hay publicaciones en esta sección.</p>;
    }
    return (
      <div className="space-y-4">
        {publications.map(pub => (
          <PublicationCard 
            key={pub.id}
            publication={pub}
            onApprove={handleApprove}
            onReject={handleReject}
            onRevert={handleRevertToPending}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <AlertDialog open={!!publicationToReject} onOpenChange={() => setPublicationToReject(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Rechazar Publicación</AlertDialogTitle>
                    <AlertDialogDescription>
                        Por favor, especifica el motivo del rechazo. Este será visible para el autor.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                    placeholder="Ej: El contenido no es apropiado para un canal de comunicación oficial..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                />
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmReject}
                        disabled={!rejectionReason.trim()}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                        Confirmar Rechazo
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <h1 className="text-lg font-semibold md:text-2xl">Aprobación de Publicaciones</h1>

        <Card>
            <Tabs defaultValue="pending">
                <CardHeader className="border-b p-4">
                     <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <TabsList className="w-full md:w-auto">
                            <TabsTrigger value="pending" className="flex-1 md:flex-initial">Pendientes <Badge variant="secondary" className="ml-2">{pendingPublications.length}</Badge></TabsTrigger>
                            <TabsTrigger value="approved" className="flex-1 md:flex-initial">Aprobadas <Badge variant="secondary" className="ml-2">{approvedPublications.length}</Badge></TabsTrigger>
                            <TabsTrigger value="rejected" className="flex-1 md:flex-initial">Rechazadas <Badge variant="secondary" className="ml-2">{rejectedPublications.length}</Badge></TabsTrigger>
                        </TabsList>
                        <div className="relative w-full md:max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por autor, contenido o categoría..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-4 md:p-6">
                    <TabsContent value="pending" className="m-0">
                       <PublicationsList publications={pendingPublications} />
                    </TabsContent>
                    <TabsContent value="approved" className="m-0">
                        <PublicationsList publications={approvedPublications} />
                    </TabsContent>
                    <TabsContent value="rejected" className="m-0">
                        <PublicationsList publications={rejectedPublications} />
                    </TabsContent>
                </CardContent>
            </Tabs>
        </Card>
    </div>
  );
}
