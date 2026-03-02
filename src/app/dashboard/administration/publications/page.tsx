
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, updateDoc, addDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
import { 
    ThumbsUp, 
    XCircle, 
    Search, 
    Undo, 
    Megaphone, 
    Camera, 
    Info, 
    Gift, 
    Award, 
    AlertTriangle, 
    CalendarIcon, 
    BarChart, 
    Rss,
    Send,
    LoaderCircle,
    ImageIcon,
    X,
    PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Publication = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  imageUrl?: string;
  category: string;
  eventDate?: string;
  createdAt: { seconds: number; nanoseconds: number; } | number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
};

const publicationCategories = [
    { value: 'Anuncio / Comunicado', label: 'Anuncio / Comunicado', icon: Megaphone },
    { value: 'Galería', label: 'Galería', icon: Camera },
    { value: 'Información', label: 'Información', icon: Info },
    { value: 'Celebración', label: 'Celebración', icon: Gift },
    { value: 'Logro / Reconocimiento', label: 'Logro / Reconocimiento', icon: Award },
    { value: 'Aviso Importante', label: 'Aviso Importante', icon: AlertTriangle },
    { value: 'Agenda', label: 'Agenda', icon: CalendarIcon },
    { value: 'Resultados / Indicadores', label: 'Resultados / Indicadores', icon: BarChart },
    { value: 'Marketplace', label: 'Marketplace', icon: Rss },
];

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
                    {publication.imageUrl && <Image src={publication.imageUrl} alt="Imagen de publicación" width={400} height={250} className="rounded-md border object-cover" unoptimized />}
                    
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

function CreatePublicationTab() {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    const [text, setText] = useState('');
    const [category, setCategory] = useState('');
    const [eventDate, setEventDate] = useState<Date | undefined>();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: users } = useCollection<any>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    
    const currentUserProfile = useMemo(() => {
        if (!authUser || !users) return null;
        return users.find(u => u.email?.toLowerCase() === authUser.email?.toLowerCase());
    }, [authUser, users]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'Selecciona una imagen de menos de 4MB.' });
            return;
        }
        const reader = new FileReader();
        reader.onloadstart = () => setIsUploading(true);
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!currentUserProfile || !firestore) return;
        if ((!text.trim() && !imagePreview) || !category) {
            toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Por favor, añade texto o una imagen y selecciona una categoría.'});
            return;
        };

        setIsSaving(true);
        try {
            const newPublication = {
                authorId: currentUserProfile.id,
                authorName: `${currentUserProfile.nombres} ${currentUserProfile.apellidos}`,
                authorAvatarUrl: currentUserProfile.photoUrl || '',
                text,
                category,
                imageUrl: imagePreview || null,
                eventDate: eventDate ? format(eventDate, 'yyyy-MM-dd') : null,
                status: 'pending' as const,
                rejectionReason: '',
                createdAt: Date.now(),
                reactions: {},
            };
            await addDoc(collection(firestore, 'publications'), newPublication);
            toast({ title: 'Publicación Enviada', description: 'Tu publicación ha sido enviada para aprobación.' });
            setText('');
            setCategory('');
            setImagePreview(null);
            setEventDate(undefined);
        } catch (error) {
            console.error("Error saving post:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la publicación.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Nueva Publicación</CardTitle>
                <CardDescription>Crea un anuncio o noticia para que sea visible en el muro institucional tras su aprobación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>¿Qué quieres comunicar?</Label>
                    <Textarea
                        placeholder="Escribe el contenido de tu publicación aquí..."
                        className="min-h-[150px] text-base"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                                {publicationCategories.map(cat => (
                                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha del Evento (Opcional)</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {eventDate ? format(eventDate, "PPP", { locale: es }) : <span>Seleccionar fecha...</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus locale={es} />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Evidencia Visual</Label>
                    <div className="flex flex-col gap-4">
                        {imagePreview ? (
                            <div className="relative rounded-lg overflow-hidden border">
                                <Image src={imagePreview} alt="Vista previa" width={800} height={400} className="w-full object-cover aspect-video" unoptimized />
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => setImagePreview(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" className="h-32 w-full border-dashed flex flex-col gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                {isUploading ? <LoaderCircle className="h-8 w-8 animate-spin" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                                <span>{isUploading ? "Cargando..." : "Subir una imagen (Max 4MB)"}</span>
                            </Button>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-6 bg-muted/20">
                <Button className="w-full sm:w-auto ml-auto" onClick={handleSave} disabled={isSaving || isUploading}>
                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {isSaving ? "Enviando..." : "Enviar para Aprobación"}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function PublicationsAdminPage() {
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

        <h1 className="text-lg font-semibold md:text-2xl">Gestión de Publicaciones</h1>

        <Tabs defaultValue="create">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="create">Crear Publicación</TabsTrigger>
                <TabsTrigger value="approve">Aprobación y Moderación</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-6">
                <CreatePublicationTab />
            </TabsContent>

            <TabsContent value="approve" className="mt-6">
                <Card>
                    <CardHeader className="border-b p-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <Tabs defaultValue="pending" className="w-full md:w-auto">
                                <TabsList>
                                    <TabsTrigger value="pending">Pendientes <Badge variant="secondary" className="ml-2">{pendingPublications.length}</Badge></TabsTrigger>
                                    <TabsTrigger value="approved">Aprobadas <Badge variant="secondary" className="ml-2">{approvedPublications.length}</Badge></TabsTrigger>
                                    <TabsTrigger value="rejected">Rechazadas <Badge variant="secondary" className="ml-2">{rejectedPublications.length}</Badge></TabsTrigger>
                                </TabsList>
                                <div className="mt-4">
                                    <TabsContent value="pending" className="m-0">
                                        <PublicationsList publications={pendingPublications} />
                                    </TabsContent>
                                    <TabsContent value="approved" className="m-0">
                                        <PublicationsList publications={approvedPublications} />
                                    </TabsContent>
                                    <TabsContent value="rejected" className="m-0">
                                        <PublicationsList publications={rejectedPublications} />
                                    </TabsContent>
                                </div>
                            </Tabs>
                            <div className="relative w-full md:max-w-sm self-start">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Filtrar moderación..."
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
