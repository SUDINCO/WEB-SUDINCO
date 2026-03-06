
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselPrevious, 
  CarouselNext 
} from "@/components/ui/carousel";

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
  ImageIcon,
  FileText,
  CalendarCheck,
  ShieldAlert,
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
import { useRecentLinks } from '@/hooks/use-recent-links';
import { toast } from '@/hooks/use-toast';
import type { HiringApproval, PerformanceEvaluation, UserProfile, Memorandum, Vacation, EquipmentHandover, Holiday } from "@/lib/types";

const getInitials = (name: string = '', lastName: string = '') => {
    const names = name.split(' ');
    const lastNames = lastName.split(' ');
    const firstInitial = names[0]?.[0] ?? '';
    const lastInitial = lastNames[0]?.[0] ?? '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
}

const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    let date;
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (timestamp && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000);
    } else {
        return false;
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

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

export default function DashboardHomePage() {
  const { user: authUser, loading: authLoading } = useUser();
  const { recentLinks } = useRecentLinks();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reactionsToShow, setReactionsToShow] = useState<{
    postAuthor: string;
    likers: UserProfile[];
    lovers: UserProfile[];
  } | null>(null);

  const [postToDelete, setPostToDelete] = useState<any | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: Date; events: any[] } | null>(null);

  const firestore = useFirestore();
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: approvals, isLoading: approvalsLoading } = useCollection<HiringApproval>(useMemo(() => firestore ? collection(firestore, 'hiringApprovals') : null, [firestore]));
  const { data: evaluations, isLoading: evaluationsLoading } = useCollection<PerformanceEvaluation>(useMemo(() => firestore ? collection(firestore, 'performanceEvaluations') : null, [firestore]));
  const { data: vacationRequests, isLoading: vacationsLoading } = useCollection<Vacation>(useMemo(() => firestore ? collection(firestore, 'vacationRequests') : null, [firestore]));
  const { data: memorandums } = useCollection<Memorandum>(useMemo(() => firestore ? collection(firestore, 'memorandums') : null, [firestore]));
  const { data: equipmentHandovers } = useCollection<EquipmentHandover>(useMemo(() => firestore ? collection(firestore, 'equipmentHandovers') : null, [firestore]));
  const { data: holidaysData, isLoading: holidaysLoading } = useCollection<Holiday>(useMemo(() => firestore ? collection(firestore, 'holidays') : null, [firestore]));

  const publicationsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'publications'), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore]);
  const { data: publications, isLoading: publicationsLoading } = useCollection<any>(publicationsCollectionRef);

  const eventsCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return query(
        collection(firestore, 'publications'), 
        where('eventDate', '>=', format(startOfToday(), 'yyyy-MM-dd')), 
        orderBy('eventDate', 'asc')
    );
  }, [firestore]);
  const { data: upcomingEvents, isLoading: eventsLoading } = useCollection<any>(eventsCollectionRef);
  
  const isLoading = authLoading || usersLoading || approvalsLoading || evaluationsLoading || vacationsLoading || publicationsLoading || eventsLoading || holidaysLoading;

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
        toast({ variant: "destructive", title: "Error", description: "No se pudo registrar tu reacción." });
    }
  };

  const handleShowReactions = (post: any) => {
    if (!users) return;
    const likers = (post.reactions?.like || []).map((id: string) => users.find(u => u.id === id)).filter((u: any): u is UserProfile => !!u);
    const lovers = (post.reactions?.love || []).map((id: string) => users.find(u => u.id === id)).filter((u: any): u is UserProfile => !!u);
    setReactionsToShow({ postAuthor: post.authorName, likers, lovers });
  };

  const tasks = useMemo(() => {
    if (!currentUserProfile || !currentUserProfile.email) return [];
    const userEmailLower = currentUserProfile.email.toLowerCase();
    const userId = currentUserProfile.id;

    const approvalTasks = (approvals || []).filter(app => {
          if (app.status === 'pending' && app.jefeInmediatoEmail?.toLowerCase() === userEmailLower) return true;
          if (app.status === 'approved-boss' && currentUserProfile.cargo === 'DIRECTOR DE RECURSOS HUMANOS') return true;
          return false;
      }).map(app => ({ id: `approval-${app.id}`, icon: FileSignature, title: `Aprobar contratación para ${app.processInfo?.cargo || 'un puesto'}`, href: '/dashboard/approvals' }));

    const observationTasks = (evaluations || []).filter(ev => ev.observerStatus === 'pending' && ev.observerEmail?.toLowerCase() === userEmailLower).map(ev => {
        const worker = users?.find(u => u.id === ev.workerId);
        return { id: `eval-${ev.id}`, icon: Eye, title: `Revisar evaluación de ${worker?.nombres || 'un colaborador'}`, href: '/dashboard/observed-evaluations' }
      });

    const memoTasks = (memorandums || []).filter(m => m.targetUserId === userId && (m.status === 'issued' || m.status === 'read')).map(m => ({ id: `memo-${m.id}`, icon: FileText, title: `Tienes un memorando por firmar`, href: '/dashboard/my-documents' }));

    const vacationTasks = (vacationRequests || []).filter(v => v.leaderEmail?.toLowerCase() === userEmailLower && v.status === 'pending').map(v => ({ id: `vac-${v.id}`, icon: CalendarCheck, title: `Aprobar vacaciones: ${v.userName}`, href: '/dashboard/schedule' }));

    const handoverTasks = (equipmentHandovers || []).filter(h => h.outgoingGuardId === userId && h.status === 'pending').map(h => ({ id: `handover-${h.id}`, icon: ShieldAlert, title: `Validar relevo en ${h.location}`, href: '/dashboard/attendance' }));

    return [...approvalTasks, ...observationTasks, ...memoTasks, ...vacationTasks, ...handoverTasks];
  }, [currentUserProfile, approvals, evaluations, users, memorandums, vacationRequests, equipmentHandovers]);
  
  const userApprovedVacations = useMemo(() => {
      if (!currentUserProfile || !vacationRequests) return [];
      return (vacationRequests || []).filter(v => v.userId === currentUserProfile.id && v.status === 'approved');
  }, [currentUserProfile, vacationRequests]);

  const vacationDaysModifier = {
        vacation: userApprovedVacations.flatMap(v => {
            const range: Date[] = [];
            let current = parseISO(v.startDate);
            const end = parseISO(v.endDate);
            while(current <= end) {
                range.push(new Date(current));
                current = add(current, { days: 1 });
            }
            return range;
        })
  };
   
  const publicationEventDays = useMemo(() => {
        if (!upcomingEvents) return [];
        return upcomingEvents.map(event => parseISO(event.eventDate!)).filter(date => !isNaN(date.getTime()));
  }, [upcomingEvents]);

  const holidaysDays = useMemo(() => {
    if (!holidaysData) return [];
    const dates: Date[] = [];
    holidaysData.forEach(h => {
        let current = typeof h.startDate === 'string' ? parseISO(h.startDate) : h.startDate;
        const end = typeof h.endDate === 'string' ? parseISO(h.endDate) : h.endDate;
        while(current <= end) {
            dates.push(new Date(current));
            current = add(current, { days: 1 });
        }
    });
    return dates;
  }, [holidaysData]);

  const birthdays = useMemo(() => {
    if (!users) return { today: [], upcoming: [] };
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const usersWithBirthDate = users.filter(user => user.Status === 'active' && user.fechaNacimiento).map(user => {
        try { return { ...user, birthDate: parseISO(user.fechaNacimiento) }; } catch { return { ...user, birthDate: null }; }
      }).filter((user): user is UserProfile & { birthDate: Date } => user.birthDate !== null);

    const todayBirthdays = usersWithBirthDate.filter(user => user.birthDate.getMonth() === currentMonth && user.birthDate.getDate() === currentDay);
    const upcomingBirthdays = usersWithBirthDate.filter(user => user.birthDate.getMonth() === currentMonth && user.birthDate.getDate() > currentDay).sort((a, b) => a.birthDate.getDate() - b.birthDate.getDate());

    return { today: todayBirthdays, upcoming: upcomingBirthdays };
  }, [users]);

  const handleDayClick = (day: Date) => {
    const events = [];
    
    // Check Holidays
    const dayHolidays = holidaysData?.filter(h => {
        const start = typeof h.startDate === 'string' ? parseISO(h.startDate) : h.startDate;
        const end = typeof h.endDate === 'string' ? parseISO(h.endDate) : h.endDate;
        return isWithinInterval(day, { start, end });
    });
    dayHolidays?.forEach(h => events.push({ type: 'holiday', title: h.name }));

    // Check Vacations
    const dayVacations = userApprovedVacations.filter(v => {
        const start = parseISO(v.startDate);
        const end = parseISO(v.endDate);
        return isWithinInterval(day, { start, end });
    });
    dayVacations.forEach(v => events.push({ type: 'vacation', title: `Mis Vacaciones (${v.totalDays} días)` }));

    // Check Publication Events
    const dayEvents = upcomingEvents?.filter(e => e.eventDate && isSameDay(parseISO(e.eventDate), day));
    dayEvents?.forEach(e => events.push({ type: 'publication', title: e.text, category: e.category }));

    if (events.length > 0) {
        setSelectedDayEvents({ date: day, events });
    }
  };

  if (isLoading) {
    return (
      <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-4">
        <aside className="hidden lg:flex col-span-1 flex-col gap-6"><Skeleton className="h-48" /><Skeleton className="h-96" /></aside>
        <main className="col-span-1 lg:col-span-2"><Skeleton className="h-[80vh]" /></main>
        <aside className="hidden lg:flex col-span-1 flex-col gap-6"><Skeleton className="h-64" /><Skeleton className="h-64" /></aside>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background pb-6 -mt-6 -mx-6 px-6 pt-6">
          <h1 className="text-3xl font-bold tracking-tight">Bienvenido, {currentUserProfile?.nombres}</h1>
          <p className="text-muted-foreground">Este es tu centro de mando para PERFORMA.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Dialog open={!!reactionsToShow} onOpenChange={() => setReactionsToShow(null)}>
              <DialogContent>
                  <DialogHeader><DialogTitle>Reacciones para la publicación de {reactionsToShow?.postAuthor}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
                      <div>
                          <h4 className="font-semibold flex items-center gap-2 mb-2 pb-2 border-b"><ThumbsUp className="h-5 w-5 text-primary" /><span>{reactionsToShow?.likers.length} Me gusta</span></h4>
                          <ul className="space-y-2">{reactionsToShow?.likers.map(user => (<li key={user.id} className="flex items-center gap-2 text-sm"><Avatar className="h-8 w-8"><AvatarImage src={user.photoUrl} /><AvatarFallback>{getInitials(user.nombres, user.apellidos)}</AvatarFallback></Avatar><span>{user.nombres} {user.apellidos}</span></li>))}</ul>
                      </div>
                      <div>
                          <h4 className="font-semibold flex items-center gap-2 mb-2 pb-2 border-b"><Heart className="h-5 w-5 text-red-500" /><span>{reactionsToShow?.lovers.length} Me encanta</span></h4>
                          <ul className="space-y-2">{reactionsToShow?.lovers.map(user => (<li key={user.id} className="flex items-center gap-2 text-sm"><Avatar className="h-8 w-8"><AvatarImage src={user.photoUrl} /><AvatarFallback>{getInitials(user.nombres, user.apellidos)}</AvatarFallback></Avatar><span>{user.nombres} {user.apellidos}</span></li>))}</ul>
                      </div>
                  </div>
              </DialogContent>
          </Dialog>

          <Dialog open={!!selectedDayEvents} onOpenChange={() => setSelectedDayEvents(null)}>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Eventos para el {selectedDayEvents && format(selectedDayEvents.date, 'd MMMM, yyyy', { locale: es })}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                      {selectedDayEvents?.events.map((ev, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                              {ev.type === 'holiday' && <Badge className="bg-red-500 hover:bg-red-600 mt-1 shrink-0">Feriado</Badge>}
                              {ev.type === 'vacation' && <Badge className="bg-blue-500 hover:bg-blue-600 mt-1 shrink-0">Vacaciones</Badge>}
                              {ev.type === 'publication' && <Badge className="bg-amber-500 hover:bg-amber-600 mt-1 shrink-0">{ev.category}</Badge>}
                              <div className="space-y-1">
                                  <p className="font-semibold leading-none">{ev.title}</p>
                              </div>
                          </div>
                      ))}
                  </div>
                  <DialogFooter>
                      <Button onClick={() => setSelectedDayEvents(null)}>Cerrar</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>

          <AlertDialog open={!!postToDelete} onOpenChange={() => setPostToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer. La publicación será eliminada permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeletePost} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
          </AlertDialog>

          <aside className="hidden lg:flex col-span-1 flex-col gap-6">
              <Card><CardHeader><CardTitle>Accesos Rápidos</CardTitle><CardDescription>Tus páginas más visitadas recientemente.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-3 gap-2">{recentLinks.map((link, index) => (<Link href={link.href} key={link.href} className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-muted text-center space-y-1 group"><div className={cn("p-3 rounded-full group-hover:scale-110 transition-transform", index % 3 === 0 ? 'bg-blue-100 text-blue-700' : index % 3 === 1 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}><link.icon className="h-5 w-5" /></div><p className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">{link.name}</p></Link>))}</div></CardContent></Card>
              <Card>
                <CardHeader>
                  <CardTitle>Mi Calendario</CardTitle>
                  <CardDescription>Eventos y estados institucionales</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <Calendar 
                      mode="single" 
                      selected={new Date()} 
                      className="rounded-md border shadow-sm" 
                      modifiers={{ 
                        vacation: vacationDaysModifier.vacation, 
                        publicationEvent: publicationEventDays, 
                        holiday: holidaysDays 
                      }} 
                      modifiersClassNames={{ 
                        vacation: 'bg-blue-100 text-blue-700 border-blue-200 border font-bold hover:bg-blue-200', 
                        publicationEvent: 'bg-amber-100 text-amber-700 border-amber-200 border font-bold hover:bg-amber-200', 
                        holiday: 'bg-red-100 text-red-700 border-red-200 border font-bold hover:bg-red-200' 
                      }} 
                      locale={es} 
                      size="sm" 
                      onDayClick={handleDayClick}
                    />
                  </div>
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Leyenda</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="h-3 w-3 rounded-full bg-red-100 border border-red-200 shadow-sm" />
                        <span>Días Festivos / Feriados</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="h-3 w-3 rounded-full bg-blue-100 border border-blue-200 shadow-sm" />
                        <span>Mis Vacaciones Aprobadas</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="h-3 w-3 rounded-full bg-amber-100 border border-amber-200 shadow-sm" />
                        <span>Comunicados Institucionales</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </aside>
          <main className="col-span-1 lg:col-span-2 min-h-0 space-y-6">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <CardTitle>Anuncios</CardTitle>
                    <div className="flex items-center gap-1 overflow-x-auto"><Button size="sm" variant={selectedCategory === 'all' ? 'secondary' : 'ghost'} onClick={() => setSelectedCategory('all')} className="rounded-full h-8 px-3 shrink-0">Todos ({publicationCounts.all || 0})</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="rounded-full h-8 px-3 shrink-0">Más<MoreHorizontal className="ml-1 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{publicationCategories.map(category => (<DropdownMenuItem key={category.value} onSelect={() => setSelectedCategory(category.value)}><category.icon className="mr-2 h-4 w-4" /><span>{category.label} ({publicationCounts[category.value] || 0})</span></DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu></div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-6 pt-0">
                    <div className="space-y-4">
                      {filteredPublications && filteredPublications.length > 0 ? (
                        filteredPublications.map(post => {
                          const author = users?.find(u => u.id === post.authorId);
                          const likes = post.reactions?.like?.length || 0;
                          const lovers = post.reactions?.love?.length || 0;
                          const hasLiked = !!(currentUserProfile && post.reactions?.like?.includes(currentUserProfile.id));
                          const hasLoved = !!(currentUserProfile && post.reactions?.love?.includes(currentUserProfile.id));
                          const isAuthor = currentUserProfile && post.authorId === currentUserProfile.id;
                          const isNewPost = post.createdAt && differenceInHours(new Date(), typeof post.createdAt === 'number' ? new Date(post.createdAt) : new Date(post.createdAt.seconds * 1000)) < 24;

                          return (
                            <Card key={post.id} className="overflow-hidden">
                              <CardHeader className="p-4"><div className="flex items-start gap-3"><Avatar className="h-10 w-10"><AvatarImage src={author?.photoUrl} /><AvatarFallback>{getInitials(post.authorName)}</AvatarFallback></Avatar><div className="flex-1"><p className="font-semibold text-sm">{post.authorName}</p><p className="text-xs text-muted-foreground">{formatTimestamp(post.createdAt)}</p></div>{isAuthor && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setPostToDelete(post)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Eliminar</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}</div></CardHeader>
                              <CardContent className="px-4 pb-2 space-y-3"><div className="flex items-center gap-2"><Badge variant="outline">{post.category}</Badge>{isNewPost && <Badge className="bg-blue-100 text-blue-800">Nuevo</Badge>}</div>{post.eventDate && (<div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 font-medium"><CalendarIcon className="mr-2 h-4 w-4" /><span>{format(parseISO(post.eventDate), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</span></div>)}{post.text && <p className="text-sm whitespace-pre-wrap">{post.text}</p>}{post.imageUrl && (<div className="rounded-lg overflow-hidden border"><Image src={post.imageUrl} alt="Imagen de la publicación" width={800} height={500} className="object-cover w-full" unoptimized /></div>)}</CardContent>
                              <CardFooter className="px-4 py-2 border-t flex justify-between items-center"><div className="flex items-center"><Button variant="ghost" size="sm" onClick={() => handleReaction(post.id, 'like')} disabled={!currentUserProfile}><ThumbsUp className={cn("h-4 w-4", hasLiked && "text-primary fill-primary/20")} /></Button><Button variant="ghost" size="sm" onClick={() => handleReaction(post.id, 'love')} disabled={!currentUserProfile}><Heart className={cn("h-4 w-4", hasLoved && "text-red-50 fill-red-500/20")} /></Button></div>{(likes > 0 || lovers > 0) && (<button onClick={() => handleShowReactions(post)} className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-muted">{likes > 0 && <ThumbsUp className="h-4 w-4 text-primary" />}{lovers > 0 && <Heart className="h-4 w-4 text-red-500" />}<span className="ml-1 text-xs font-semibold text-muted-foreground">{likes + lovers}</span></button>)}</CardFooter>
                            </Card>
                          )
                        })
                      ) : (<div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-10"><Rss className="h-10 w-10 mb-2" /><p className="text-sm font-medium">No hay anuncios en esta categoría.</p></div>)}
                    </div>
                </CardContent>
              </Card>
          </main>
          <aside className="hidden lg:flex col-span-1 flex-col gap-6">
              <Card className="flex flex-col"><CardHeader><CardTitle>Celebraciones del Mes</CardTitle><CardDescription>{format(new Date(), 'MMMM', { locale: es })}</CardDescription></CardHeader><CardContent className="flex flex-col items-center justify-center flex-1">{[...birthdays.today, ...birthdays.upcoming].length > 0 ? (
                <Carousel opts={{ align: "start", loop: [...birthdays.today, ...birthdays.upcoming].length > 1 }} className="w-full max-w-xs">
                  <CarouselContent>
                    {[...birthdays.today, ...birthdays.upcoming].map((user) => (
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
                              <p>{isSameDay(user.birthDate!, new Date()) ? '¡Feliz Cumpleaños Hoy!' : format(user.birthDate!, 'd MMMM', { locale: es })}</p>
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {[...birthdays.today, ...birthdays.upcoming].length > 1 && (<><CarouselPrevious className="-left-4" /><CarouselNext className="-right-4" /></>)}
                </Carousel>
              ) : (<div className="flex h-full items-center justify-center text-center"><p className="text-sm text-muted-foreground">No hay cumpleaños este mes.</p></div>)}</CardContent></Card>
              <Card className="flex flex-col"><div className="flex flex-col">{(tasks.length > 0 || (upcomingEvents?.length || 0) > 0) ? (<>{tasks.length > 0 && (<><CardHeader><CardTitle>Mis Tareas ({tasks.length})</CardTitle><CardDescription>Acciones pendientes que requieren tu atención.</CardDescription></CardHeader><CardContent><ScrollArea className="h-40 pr-2"><div className="space-y-2">{tasks.map(task => (<Link href={task.href} key={task.id} className="block p-2 rounded-lg hover:bg-muted"><div className="flex items-center justify-between"><div className="flex items-center gap-3 min-w-0"><task.icon className="h-5 w-5 text-primary shrink-0" /><p className="text-sm font-medium truncate">{task.title}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /></div></Link>))}</div></ScrollArea></CardContent></>)}{(tasks.length > 0 && (upcomingEvents?.length || 0) > 0) && <Separator className="my-0 mx-6" />}{(upcomingEvents?.length || 0) > 0 && (<><CardHeader><CardTitle>Próximos Eventos</CardTitle></CardHeader><CardContent>{eventsLoading ? (<div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>) : (<ScrollArea className="h-40 pr-2"><div className="space-y-4">{upcomingEvents.map(event => (<div key={event.id} className="flex items-start gap-4"><div className="flex flex-col items-center justify-center p-2 bg-muted rounded-md border"><span className="text-sm font-bold text-primary">{format(parseISO(event.eventDate!), 'dd')}</span><span className="text-xs uppercase text-muted-foreground">{format(parseISO(event.eventDate!), 'MMM', { locale: es })}</span></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{event.category}</p><p className="text-sm text-muted-foreground truncate">{event.text}</p></div></div>))}</div></ScrollArea>)}</CardContent></>)}</>) : (<CardContent className="flex-grow flex items-center justify-center p-6"><div className="text-center text-muted-foreground"><CheckCircle className="mx-auto h-12 w-12 text-green-500" /><h3 className="mt-2 text-sm font-semibold">Todo en orden</h3><p className="mt-1 text-sm">No tienes tareas ni eventos próximos.</p></div></CardContent>)}</div></Card>
          </aside>
      </div>
    </>
  );
}
