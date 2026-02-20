
"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import {
  Briefcase,
  Users,
  Rss,
  ChevronRight,
  Gift,
  Plane,
  FileSignature,
  Eye,
  Building,
  CalendarDays,
  ArrowRight,
  Star,
  ThumbsUp,
  Heart,
  CalendarIcon,
  Award,
  FileSearch,
  Megaphone,
  Camera,
  Info,
  AlertTriangle,
  BarChart,
  MoreHorizontal,
  CheckCircle,
  Paperclip,
  Send,
  LoaderCircle,
  X,
  Edit,
  Trash2,
  CaseSensitive,
  ImageIcon
} from 'lucide-react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, where, addDoc, deleteDoc } from 'firebase/firestore';
import {
  format,
  formatDistanceToNow,
  isWithinInterval,
  startOfToday,
  endOfToday,
  add,
  isSameMonth,
  parseISO,
  getYear,
  setYear,
  addYears,
  isBefore,
  isSameDay,
  differenceInHours
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRecentLinks } from '@/hooks/use-recent-links';

// Type definitions
interface UserProfile {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  fechaIngreso: string;
  fechaNacimiento: string;
  isLeader?: boolean;
  liderArea?: string;
  cargo: string;
  Status: 'active' | 'inactive';
  photoUrl?: string;
  birthDate?: Date | null;
}

interface Publication {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatarUrl?: string;
    text: string;
    imageUrl?: string;
    category: string;
    eventDate?: string;
    createdAt: {
        seconds: number;
        nanoseconds: number;
    } | number;
    reactions?: {
        [key: string]: string[];
    };
    updatedAt?: number;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
}

interface SimpleEvent {
    id: string;
    title: string;
    eventDate: string;
    eventTime?: string;
    creatorId: string;
    creatorName: string;
}

interface HiringApproval {
    id: string;
    jefeInmediatoEmail: string;
    directorRHHEmail?: string;
    status: 'pending' | 'approved-boss' | 'rejected' | 'approved-rh';
    processInfo?: { cargo: string };
}

interface PerformanceEvaluation {
    id: string;
    workerId: string;
    observerEmail?: string;
    observerStatus?: 'pending' | 'approved' | 'review_requested';
}

interface VacationRequest {
    id: string;
    userId: string;
    startDate: string;
    endDate: string;
    status: 'approved' | 'pending' | 'rejected';
}

const eventSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio.'),
  eventTime: z.string().optional(),
});

const getInitials = (name: string = '', lastName: string = '') => {
    const names = name.split(' ');
    const lastNames = lastName.split(' ');
    const firstInitial = names[0]?.[0] ?? '';
    const lastInitial = lastNames[0]?.[0] ?? '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
}

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

const publicationCategories = [
    { value: 'Anuncio / Comunicado', label: '📣 Anuncio / Comunicado', icon: Megaphone },
    { value: 'Galería', label: '📸 Galería', icon: Camera },
    { value: 'Información', label: '💡 Información', icon: Info },
    { value: 'Celebración', label: '🎉 Celebración', icon: Gift },
    { value: 'Logro / Reconocimiento', label: '🏆 Logro / Reconocimiento', icon: Award },
    { value: 'Aviso Importante', label: '📢 Aviso Importante', icon: AlertTriangle },
    { value: 'Agenda', label: '📅 Agenda', icon: CalendarIcon },
    { value: 'Resultados / Indicadores', label: '📈 Resultados / Indicadores', icon: BarChart },
    { value: 'Marketplace', label: '🛍️ Marketplace', icon: Rss },
];

function CreatePublicationDialog({ open, onOpenChange, editingPost, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, editingPost: Publication | null, onSave: (data: any) => Promise<void> }) {
  const [publicationText, setPublicationText] = useState('');
  const [category, setCategory] = useState('');
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editingPost) {
        setPublicationText(editingPost.text);
        setCategory(editingPost.category);
        setImagePreview(editingPost.imageUrl || null);
        setEventDate(editingPost.eventDate ? parseISO(editingPost.eventDate) : undefined);
      } else {
        setPublicationText('');
        setCategory('');
        setImagePreview(null);
        setEventDate(undefined);
      }
    }
  }, [open, editingPost]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) { // 4MB limit
        toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'Por favor, selecciona una imagen de menos de 4MB.' });
        return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsUploading(true);
    reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setIsUploading(false);
    };
    reader.onerror = () => {
        setIsUploading(false);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo leer el archivo de imagen.' });
    };
    reader.readAsDataURL(file);

    if(event.target) {
        (event.target as HTMLInputElement).value = '';
    }
  };
  
  const handleSave = async () => {
    if ((!publicationText.trim() && !imagePreview) || !category) {
        toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Por favor, añade texto o una imagen y selecciona una categoría.'});
        return;
    };

    setIsSaving(true);
    const dataToSave = {
        text: publicationText,
        category: category,
        imageUrl: imagePreview || null,
        eventDate: eventDate ? format(eventDate, 'yyyy-MM-dd') : null,
    };
    
    await onSave(dataToSave);
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
       <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
        <DialogContent className="sm:max-w-xl">
            <DialogHeader>
                <DialogTitle className="text-xl">{editingPost ? 'Editar Publicación' : 'Crear Publicación'}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                 <Textarea
                    placeholder="¿Sobre qué quieres hablar?"
                    className="min-h-[120px] resize-none border-0 p-0 shadow-none focus-visible:ring-0 text-base"
                    value={publicationText}
                    onChange={(e) => setPublicationText(e.target.value)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona una categoría..." />
                        </SelectTrigger>
                        <SelectContent>
                            {publicationCategories.map(cat => (
                                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn( "w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {eventDate ? format(eventDate, "PPP", { locale: es }) : <span>Fecha del evento (opcional)</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus locale={es} />
                        </PopoverContent>
                    </Popover>
                </div>
                 {isUploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando imagen...
                    </div>
                )}
                
                {imagePreview && !isUploading && (
                    <div className="relative mt-2">
                        <Image src={imagePreview} alt="Vista previa" width={500} height={300} className="rounded-lg object-cover w-full aspect-video" unoptimized />
                        <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => setImagePreview(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
            <DialogFooter className="border-t pt-4">
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            <ImageIcon className="h-5 w-5" />
                        </Button>
                         <Button variant="ghost" size="icon" disabled> <CaseSensitive className="h-5 w-5" /> </Button>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || isUploading}>
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Publicando...' : 'Publicar'}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  )
}


function EventCreatorDialog({ open, onOpenChange, selectedDate, currentUserProfile }: { open: boolean, onOpenChange: (open: boolean) => void, selectedDate: Date | null, currentUserProfile: UserProfile | null }) {
    const firestore = useFirestore();
    const form = useForm<z.infer<typeof eventSchema>>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: '',
            eventTime: '',
        },
    });
    
    useEffect(() => {
        if(open) {
            form.reset();
        }
    }, [open, form]);

    async function onSubmit(data: z.infer<typeof eventSchema>) {
        if (!selectedDate || !currentUserProfile || !firestore) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede crear el evento. Falta información.",
            });
            return;
        }

        const newEvent = {
            title: data.title,
            eventDate: format(selectedDate, 'yyyy-MM-dd'),
            eventTime: data.eventTime || null,
            creatorId: currentUserProfile.id,
            creatorName: `${currentUserProfile.nombres} ${currentUserProfile.apellidos}`,
        };

        try {
            await addDoc(collection(firestore, 'simpleEvents'), newEvent);
            toast({
                title: "Evento Creado",
                description: "Tu evento ha sido añadido al calendario.",
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating simple event:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo crear el evento.",
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Evento</DialogTitle>
                    <DialogDescription>
                        Añade un evento o recordatorio para el {selectedDate ? format(selectedDate, 'd \'de\' MMMM', { locale: es }) : ''}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Título del Evento</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Reunión de equipo" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="eventTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hora (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit">Guardar Evento</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Page Component ---
export default function DashboardHomePage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useUser();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reactionsToShow, setReactionsToShow] = useState<{
    postAuthor: string;
    likers: UserProfile[];
    lovers: UserProfile[];
  } | null>(null);

  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
  
  const [editingPost, setEditingPost] = useState<Publication | null>(null);
  const [postToDelete, setPostToDelete] = useState<Publication | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const firestore = useFirestore();
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: approvals, isLoading: approvalsLoading } = useCollection<HiringApproval>(useMemo(() => firestore ? collection(firestore, 'hiringApprovals') : null, [firestore]));
  const { data: evaluations, isLoading: evaluationsLoading } = useCollection<PerformanceEvaluation>(useMemo(() => firestore ? collection(firestore, 'performanceEvaluations') : null, [firestore]));
  const { data: vacations, isLoading: vacationsLoading } = useCollection<VacationRequest>(useMemo(() => firestore ? collection(firestore, 'vacationRequests') : null, [firestore]));
  
  const publicationsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'publications'), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore]);
  const { data: publications, isLoading: publicationsLoading } = useCollection<Publication>(publicationsCollectionRef);

  const eventsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'publications'), 
        where('eventDate', '>=', format(startOfToday(), 'yyyy-MM-dd')), 
        orderBy('eventDate', 'asc')
    );
  }, [firestore]);
  const { data: upcomingEvents, isLoading: eventsLoading } = useCollection<Publication>(eventsCollectionRef);
  
  const { data: simpleEvents, isLoading: simpleEventsLoading } = useCollection<SimpleEvent>(useMemo(() => firestore ? collection(firestore, 'simpleEvents') : null, [firestore]));

  const isLoading = authLoading || usersLoading || approvalsLoading || evaluationsLoading || vacationsLoading || publicationsLoading || eventsLoading || simpleEventsLoading;

  const currentUserProfile = useMemo(() => {
    if (!authUser || !users || !authUser.email) return null;
    const userEmailLower = authUser.email.toLowerCase();
    return users.find(u => u.email && u.email.toLowerCase() === userEmailLower);
  }, [authUser, users]);

  const approvedPublications = useMemo(() => {
    if (!publications) return [];
    return publications.filter(p => p.status === 'approved');
  }, [publications]);

  const publicationCounts: { [key: string]: number } = useMemo(() => {
    if (!approvedPublications) return { all: 0 };
    const counts: { [key: string]: number } = { all: approvedPublications.length };
    for (const pub of approvedPublications) {
        counts[pub.category] = (counts[pub.category] || 0) + 1;
    }
    return counts;
  }, [approvedPublications]);
  
  const filteredPublications = useMemo(() => {
    if (!approvedPublications) return [];
    if (selectedCategory === 'all') return approvedPublications;
    return approvedPublications.filter(p => p.category === selectedCategory);
  }, [approvedPublications, selectedCategory]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
        setSelectedEventDate(date);
        setIsEventDialogOpen(true);
    }
  };

  const handleOpenEventDialog = () => {
    setSelectedEventDate(new Date());
    setIsEventDialogOpen(true);
  };
  
  const handleSavePublication = async (data: any) => {
    if (!currentUserProfile || !firestore) return;

    try {
        if (editingPost) {
            const postRef = doc(firestore, 'publications', editingPost.id);
            await updateDoc(postRef, {
                ...data,
                status: 'pending' // Re-submit for approval on edit
            });
            toast({ title: 'Publicación Actualizada', description: 'Tu publicación ha sido enviada de nuevo para aprobación.' });
        } else {
            const newPublication = {
              authorId: currentUserProfile.id,
              authorName: `${currentUserProfile.nombres} ${currentUserProfile.apellidos}`,
              authorAvatarUrl: currentUserProfile.photoUrl || '',
              ...data,
              status: 'pending' as const,
              rejectionReason: '',
              createdAt: Date.now(),
              reactions: {},
            };
            const publicationsCollection = collection(firestore, 'publications');
            await addDoc(publicationsCollection, newPublication);
            toast({ title: 'Publicación Enviada', description: 'Tu publicación ha sido enviada para aprobación.' });
        }
        setEditingPost(null);
    } catch (error) {
        console.error("Error saving post:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la publicación.' });
    }
  }

  const handleDeletePost = async () => {
    if (!postToDelete || !firestore) return;
    try {
        await deleteDoc(doc(firestore, 'publications', postToDelete.id));
        toast({ title: 'Publicación eliminada' });
    } catch (error) {
        console.error("Error deleting post:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la publicación.' });
    } finally {
        setPostToDelete(null);
    }
  };


  const handleReaction = async (postId: string, reactionType: 'like' | 'love') => {
    if (!firestore || !currentUserProfile) return;

    const postRef = doc(firestore, 'publications', postId);
    
    const post = publications?.find(p => p.id === postId);
    const hasReacted = post?.reactions?.[reactionType]?.includes(currentUserProfile.id);

    try {
        await updateDoc(postRef, {
            [`reactions.${reactionType}`]: hasReacted ? arrayRemove(currentUserProfile.id) : arrayUnion(currentUserProfile.id)
        });
    } catch (e) {
        console.error("Error updating reaction: ", e);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo registrar tu reacción.",
        });
    }
  };

  const handleShowReactions = (post: Publication) => {
    if (!users) return;
    const likers = (post.reactions?.like || [])
      .map(id => users.find(u => u.id === id))
      .filter((u): u is UserProfile => !!u);

    const lovers = (post.reactions?.love || [])
      .map(id => users.find(u => u.id === id))
      .filter((u): u is UserProfile => !!u);
    
    setReactionsToShow({
      postAuthor: post.authorName,
      likers,
      lovers
    });
  };

  // --- Data processing for components ---

  const tasks = useMemo(() => {
    if (!currentUserProfile || !currentUserProfile.email || (!approvals && !evaluations)) return [];
    
    const userEmailLower = currentUserProfile.email.toLowerCase();

    const approvalTasks = (approvals || [])
      .filter(app => {
          if (app.status === 'pending' && app.jefeInmediatoEmail?.toLowerCase() === userEmailLower) {
              return true;
          }
          if (app.status === 'approved-boss' && currentUserProfile.cargo === 'DIRECTOR DE RECURSOS HUMANOS') {
              return true;
          }
          return false;
      })
      .map(app => ({
        id: `approval-${app.id}`,
        icon: FileSignature,
        title: `Aprobar contratación para ${app.processInfo?.cargo || 'un puesto'}`,
        href: '/dashboard/approvals'
      }));

    const observationTasks = (evaluations || [])
      .filter(ev => ev.observerStatus === 'pending' && ev.observerEmail?.toLowerCase() === userEmailLower)
      .map(ev => {
        const worker = users?.find(u => u.id === ev.workerId);
        return {
          id: `eval-${ev.id}`,
          icon: Eye,
          title: `Revisar evaluación de ${worker?.nombres || 'un colaborador'}`,
          href: '/dashboard/observed-evaluations'
        }
      });

    return [...approvalTasks, ...observationTasks];
  }, [currentUserProfile, approvals, evaluations, users]);
  
   const userApprovedVacations = useMemo(() => {
      if (!currentUserProfile || !vacations) return [];
      return (vacations || []).filter(v => v.userId === currentUserProfile.id && v.status === 'approved');
   }, [currentUserProfile, vacations]);

   const vacationDaysModifier = {
        vacation: userApprovedVacations.flatMap(v => {
            const range: Date[] = [];
            let current = parseISO(v.startDate);
            const end = parseISO(v.endDate);
            while(current <= end) {
                range.push(current);
                current = add(current, { days: 1 });
            }
            return range;
        })
   };
   
    const publicationEventDays = useMemo(() => {
        if (!upcomingEvents) return [];
        return upcomingEvents.map(event => parseISO(event.eventDate!)).filter(date => !isNaN(date.getTime()));
    }, [upcomingEvents]);

    const simpleEventDays = useMemo(() => {
        if (!simpleEvents) return [];
        return simpleEvents.map(event => parseISO(event.eventDate)).filter(date => !isNaN(date.getTime()));
    }, [simpleEvents]);


  const birthdays = useMemo(() => {
    if (!users) return { today: [], upcoming: [] };
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const usersWithBirthDate = users
      .filter(user => user.Status === 'active' && user.fechaNacimiento)
      .map(user => {
        try {
          const birthDate = parseISO(user.fechaNacimiento);
          return { ...user, birthDate };
        } catch {
          return { ...user, birthDate: null };
        }
      })
      .filter((user): user is UserProfile & { birthDate: Date } => user.birthDate !== null);

    const todayBirthdays = usersWithBirthDate.filter(user => 
        user.birthDate.getMonth() === currentMonth &&
        user.birthDate.getDate() === currentDay
    );
    
    const upcomingBirthdays = usersWithBirthDate
        .filter(user => 
            user.birthDate.getMonth() === currentMonth && 
            user.birthDate.getDate() > currentDay
        )
        .sort((a, b) => a.birthDate.getDate() - b.birthDate.getDate());

    return { today: todayBirthdays, upcoming: upcomingBirthdays };
  }, [users]);

  if (isLoading) {
    return (
      <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-4">
        <aside className="hidden lg:flex col-span-1 flex-col gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </aside>
        <main className="col-span-1 lg:col-span-2">
          <Skeleton className="h-[80vh]" />
        </main>
        <aside className="hidden lg:flex col-span-1 flex-col gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </aside>
      </div>
    );
  }

  // --- Sub-components for rendering ---

  const QuickAccess = () => {
    const { recentLinks } = useRecentLinks();

    const linkColors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-amber-100 text-amber-700',
    ];
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Accesos Rápidos</CardTitle>
                <CardDescription>Tus páginas más visitadas recientemente.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-2">
                    {recentLinks.map((link, index) => (
                        <Link href={link.href} key={link.href} className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-muted text-center space-y-1 group">
                            <div className={cn("p-3 rounded-full group-hover:scale-110 transition-transform", linkColors[index % linkColors.length])}>
                                <link.icon className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">{link.name}</p>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
  };

  const MiCalendario = ({ className }: { className?: string }) => {
    const modifiers = {
        vacation: vacationDaysModifier.vacation,
        publicationEvent: publicationEventDays,
        simpleEvent: simpleEventDays,
    };
    const modifiersClassNames = { 
        vacation: 'bg-primary text-primary-foreground rounded-full',
        publicationEvent: 'border-2 border-accent rounded-full',
        simpleEvent: 'border-2 border-green-500 rounded-full',
    };
    
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Mi Calendario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={new Date()}
                        onSelect={(date) => handleDateSelect(date)}
                        className="rounded-md"
                        modifiers={modifiers}
                        modifiersClassNames={modifiersClassNames}
                        locale={es}
                        size="sm"
                    />
                </div>
                <Button variant="outline" className="w-full" onClick={handleOpenEventDialog}>
                    <CalendarIcon className="mr-2 h-4 w-4" /> Crear Evento
                </Button>
            </CardContent>
        </Card>
    );
  };

  const BirthdaysOfTheMonth = () => {
    const allUpcomingBirthdays = [...birthdays.today, ...birthdays.upcoming];

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Celebraciones del Mes</CardTitle>
                <CardDescription>{format(new Date(), 'MMMM', { locale: es })}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-1">
                {allUpcomingBirthdays.length > 0 ? (
                    <Carousel
                        opts={{
                            align: "start",
                            loop: allUpcomingBirthdays.length > 1,
                        }}
                        className="w-full max-w-xs"
                    >
                        <CarouselContent>
                            {allUpcomingBirthdays.map((user) => (
                                <CarouselItem key={user.id}>
                                    <div className="p-1">
                                        <div className="flex flex-col items-center text-center p-4">
                                            <Avatar className="h-16 w-16 mb-3 border-4 border-accent">
                                                <AvatarImage src={user.photoUrl} />
                                                <AvatarFallback>{user.nombres[0]}{user.apellidos[0]}</AvatarFallback>
                                            </Avatar>
                                            <h3 className="font-semibold text-md text-foreground">{user.nombres} {user.apellidos}</h3>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Gift className="h-4 w-4 text-accent" />
                                                <p>
                                                  {isSameDay(user.birthDate!, new Date()) ? '¡Feliz Cumpleaños Hoy!' : format(user.birthDate!, 'd MMMM', { locale: es })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        {allUpcomingBirthdays.length > 1 && (
                            <>
                                <CarouselPrevious className="-left-4" />
                                <CarouselNext className="-right-4" />
                            </>
                        )}
                    </Carousel>
                ) : (
                    <div className="flex h-full items-center justify-center text-center">
                        <p className="text-sm text-muted-foreground">No hay cumpleaños este mes.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
  };
  
  const TareasYEventos = ({ tasks, upcomingEvents, eventsLoading }: { tasks: any[], upcomingEvents: Publication[], eventsLoading: boolean }) => (
      <Card className="flex flex-col">
        <div className="flex flex-col">
          {(tasks.length > 0 || upcomingEvents.length > 0) ? (
            <>
              {tasks.length > 0 && (
                <>
                  <CardHeader>
                    <CardTitle>Mis Tareas ({tasks.length})</CardTitle>
                    <CardDescription>Acciones pendientes que requieren tu atención.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-40 pr-2">
                      <div className="space-y-2">
                        {tasks.map(task => (
                          <Link href={task.href} key={task.id} className="block p-2 rounded-lg hover:bg-muted">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <task.icon className="h-5 w-5 text-primary shrink-0" />
                                    <p className="text-sm font-medium truncate">{task.title}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </>
              )}
      
              {(tasks.length > 0 && upcomingEvents.length > 0) && <Separator className="my-0 mx-6" />}
              
              {upcomingEvents.length > 0 && (
                <>
                  <CardHeader>
                    <CardTitle>Próximos Eventos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {eventsLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : (
                        <ScrollArea className="h-40 pr-2">
                          <div className="space-y-4">
                              {upcomingEvents.map(event => (
                                  <div key={event.id} className="flex items-start gap-4">
                                      <div className="flex flex-col items-center justify-center p-2 bg-muted rounded-md border">
                                          <span className="text-sm font-bold text-primary">{format(parseISO(event.eventDate!), 'dd')}</span>
                                          <span className="text-xs uppercase text-muted-foreground">{format(parseISO(event.eventDate!), 'MMM', { locale: es })}</span>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                          <p className="text-sm font-semibold truncate">{event.category}</p>
                                          <p className="text-sm text-muted-foreground truncate">{event.text}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                        </ScrollArea>
                    )}
                  </CardContent>
                </>
              )}
            </>
          ) : (
             <CardContent className="flex-grow flex items-center justify-center p-6">
               <div className="text-center text-muted-foreground">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-2 text-sm font-semibold">Todo en orden</h3>
                  <p className="mt-1 text-sm">No tienes tareas ni eventos próximos.</p>
               </div>
             </CardContent>
          )}
        </div>
      </Card>
    );

  
  return (
    <>
      <div className="bg-background pb-6 -mt-6 -mx-6 px-6">
          <h1 className="text-3xl font-bold tracking-tight">Bienvenido, {currentUserProfile?.nombres}</h1>
          <p className="text-muted-foreground">Este es tu centro de mando para PERFORMA.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <EventCreatorDialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen} selectedDate={selectedEventDate} currentUserProfile={currentUserProfile || null} />
          <Dialog open={!!reactionsToShow} onOpenChange={() => setReactionsToShow(null)}>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Reacciones para la publicación de {reactionsToShow?.postAuthor}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
                      <div>
                          <h4 className="font-semibold flex items-center gap-2 mb-2 pb-2 border-b">
                              <ThumbsUp className="h-5 w-5 text-primary" /> 
                              <span>{reactionsToShow?.likers.length} Me gusta</span>
                          </h4>
                          <ul className="space-y-2">
                              {reactionsToShow?.likers.map(user => (
                                  <li key={user.id} className="flex items-center gap-2 text-sm">
                                      <Avatar className="h-8 w-8">
                                          <AvatarImage src={user.photoUrl} />
                                          <AvatarFallback>{getInitials(user.nombres, user.apellidos)}</AvatarFallback>
                                      </Avatar>
                                      <span>{user.nombres} {user.apellidos}</span>
                                  </li>
                              ))}
                          </ul>
                      </div>
                      <div>
                          <h4 className="font-semibold flex items-center gap-2 mb-2 pb-2 border-b">
                              <Heart className="h-5 w-5 text-red-500" />
                              <span>{reactionsToShow?.lovers.length} Me encanta</span>
                          </h4>
                          <ul className="space-y-2">
                              {reactionsToShow?.lovers.map(user => (
                                  <li key={user.id} className="flex items-center gap-2 text-sm">
                                      <Avatar className="h-8 w-8">
                                          <AvatarImage src={user.photoUrl} />
                                          <AvatarFallback>{getInitials(user.nombres, user.apellidos)}</AvatarFallback>
                                      </Avatar>
                                      <span>{user.nombres} {user.apellidos}</span>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  </div>
              </DialogContent>
          </Dialog>
           <CreatePublicationDialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen} editingPost={editingPost} onSave={handleSavePublication} />
            <AlertDialog open={!!postToDelete} onOpenChange={() => setPostToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. La publicación será eliminada permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePost} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

          <aside className="hidden lg:flex col-span-1 flex-col gap-6">
              <QuickAccess />
              <MiCalendario />
          </aside>
          <main className="col-span-1 lg:col-span-2 min-h-0 space-y-6">
              <Card onClick={() => { setEditingPost(null); setCreateDialogOpen(true); }}>
                  <CardContent className="p-4 flex items-center gap-4 cursor-pointer">
                      <Avatar>
                          <AvatarImage src={currentUserProfile?.photoUrl} />
                          <AvatarFallback>
                          {currentUserProfile ? getInitials(currentUserProfile.nombres, currentUserProfile.apellidos) : '...'}
                          </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-muted-foreground text-sm font-medium border rounded-full px-4 py-2 hover:bg-muted">
                          Iniciar una publicación...
                      </div>
                      <Button variant="ghost" className="h-auto p-2"> <ImageIcon className="h-5 w-5 text-green-600" /> <span className="ml-2 hidden sm:inline">Foto</span> </Button>
                  </CardContent>
              </Card>

              <Card className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <CardTitle>Anuncios</CardTitle>
                    <div className="flex items-center gap-1 overflow-x-auto">
                        <Button
                            size="sm"
                            variant={selectedCategory === 'all' ? 'secondary' : 'ghost'}
                            onClick={() => setSelectedCategory('all')}
                            className="rounded-full h-8 px-3 shrink-0"
                        >
                            Todos ({publicationCounts.all || 0})
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="rounded-full h-8 px-3 shrink-0">
                                Más
                                <MoreHorizontal className="ml-1 h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            {publicationCategories.map(category => (
                                <DropdownMenuItem key={category.value} onSelect={() => setSelectedCategory(category.value)}>
                                    <category.icon className="mr-2 h-4 w-4" />
                                    <span>{category.label} ({publicationCounts[category.value] || 0})</span>
                                </DropdownMenuItem>
                            ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-6 pt-0">
                    <div className="space-y-4">
                      {filteredPublications && filteredPublications.length > 0 ? (
                        filteredPublications.map(post => {
                          const author = users?.find(u => u.id === post.authorId);
                          const likes = post.reactions?.like?.length || 0;
                          const loves = post.reactions?.love?.length || 0;
                          const hasLiked = !!(currentUserProfile && post.reactions?.like?.includes(currentUserProfile.id));
                          const hasLoved = !!(currentUserProfile && post.reactions?.love?.includes(currentUserProfile.id));
                          const isAuthor = currentUserProfile && post.authorId === currentUserProfile.id;

                          const isNewPost = (() => {
                            if (!post.createdAt) return false;
                            let postDate;
                            if (typeof post.createdAt === 'number') {
                                postDate = new Date(post.createdAt);
                            } else if (post.createdAt && typeof post.createdAt.seconds === 'number') {
                                postDate = new Date(post.createdAt.seconds * 1000);
                            } else {
                                return false;
                            }
                            return differenceInHours(new Date(), postDate) < 24;
                          })();

                          return (
                            <Card key={post.id} className="overflow-hidden">
                              <CardHeader className="p-4">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={author?.photoUrl} />
                                    <AvatarFallback>{getInitials(post.authorName)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="font-semibold text-sm">{post.authorName}</p>
                                    <p className="text-xs text-muted-foreground">{formatTimestamp(post.createdAt)}</p>
                                  </div>
                                   {isAuthor && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onSelect={() => {setEditingPost(post); setCreateDialogOpen(true); }}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            <span>Editar</span>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onSelect={() => setPostToDelete(post)} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            <span>Eliminar</span>
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                </div>
                              </CardHeader>
                              <CardContent className="px-4 pb-2 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{post.category}</Badge>
                                    {isNewPost && <Badge className="bg-blue-100 text-blue-800">Nuevo</Badge>}
                                </div>
                                {post.eventDate && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 font-medium">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    <span>{format(parseISO(post.eventDate), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</span>
                                  </div>
                                )}
                                {post.text && <p className="text-sm whitespace-pre-wrap">{post.text}</p>}
                                {post.imageUrl && (
                                  <div className="rounded-lg overflow-hidden border">
                                    <Image src={post.imageUrl} alt="Imagen de la publicación" width={800} height={500} className="object-cover w-full" unoptimized />
                                  </div>
                                )}
                              </CardContent>
                              <CardFooter className="px-4 py-2 border-t flex justify-between items-center">
                                <div className="flex items-center">
                                  <Button variant="ghost" size="sm" onClick={() => handleReaction(post.id, 'like')} disabled={!currentUserProfile}>
                                    <ThumbsUp className={cn("h-4 w-4", hasLiked && "text-primary fill-primary/20")} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleReaction(post.id, 'love')} disabled={!currentUserProfile}>
                                    <Heart className={cn("h-4 w-4", hasLoved && "text-red-500 fill-red-500/20")} />
                                  </Button>
                                </div>

                                {(likes > 0 || loves > 0) && (
                                  <button
                                    onClick={() => handleShowReactions(post)}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-muted"
                                  >
                                    {likes > 0 && <ThumbsUp className="h-4 w-4 text-primary" />}
                                    {loves > 0 && <Heart className="h-4 w-4 text-red-500" />}
                                    <span className="ml-1 text-xs font-semibold text-muted-foreground">{likes + loves}</span>
                                  </button>
                                )}
                              </CardFooter>
                            </Card>
                          )
                        })
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10">
                          <Rss className="h-10 w-10 mb-2" />
                          <p className="text-sm font-medium">No hay anuncios en esta categoría.</p>
                        </div>
                      )}
                    </div>
                </CardContent>
              </Card>
          </main>
        <aside className="hidden lg:flex col-span-1 flex-col gap-6">
              <BirthdaysOfTheMonth />
              <TareasYEventos tasks={tasks} upcomingEvents={upcomingEvents || []} eventsLoading={eventsLoading} />
        </aside>
      </div>
    </>
  );
}
