'use client';

import Link from "next/link";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import NextTopLoader from 'nextjs-toploader';
import {
  Home,
  Menu,
  ChevronDown,
  LoaderCircle,
  Bell,
  User,
  Shield,
  FileSignature,
  Eye,
  CheckCircle,
  Cake,
  Gift,
  FileText,
  CalendarCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useAuth, useUser, useCollection, useFirestore } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { toast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { AppsMenu } from "@/components/dashboard/apps-menu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileProvider, useUserProfile } from '@/context/user-profile-context';
import { allNavLinks } from '@/lib/nav-links';
import { useRecentLinks } from '@/hooks/use-recent-links';
import { PrivacyConsentModal } from "@/components/PrivacyConsentModal";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import type { HiringApproval, PerformanceEvaluation, UserProfile, Memorandum, Vacation, EquipmentHandover } from "@/lib/types";
import { format, parseISO, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { addRecentLink } = useRecentLinks();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAppsMenuOpen, setAppsMenuOpen] = useState(false);
  const [birthdayBadgeSeen, setBirthdayBadgeSeen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const { user, loading: userLoading } = useUser();
  const { userProfile, userRole, isLoading: profileLoading } = useUserProfile();
  const auth = useAuth();
  const firestore = useFirestore();
  const inactivityTimer = useRef<NodeJS.Timeout>();

  const { data: approvals } = useCollection<HiringApproval>(useMemo(() => firestore ? collection(firestore, 'hiringApprovals') : null, [firestore]));
  const { data: evaluations } = useCollection<PerformanceEvaluation>(useMemo(() => firestore ? collection(firestore, 'performanceEvaluations') : null, [firestore]));
  const { data: users } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: memorandums } = useCollection<Memorandum>(useMemo(() => firestore ? collection(firestore, 'memorandums') : null, [firestore]));
  const { data: vacationRequests } = useCollection<Vacation>(useMemo(() => firestore ? collection(firestore, 'vacationRequests') : null, [firestore]));
  const { data: equipmentHandovers } = useCollection<EquipmentHandover>(useMemo(() => firestore ? collection(firestore, 'equipmentHandovers') : null, [firestore]));

  const isLoading = userLoading || profileLoading;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (pathname) {
      addRecentLink(pathname);
    }
  }, [pathname, addRecentLink]);

  const handleSignOut = useCallback(() => {
    if (auth) {
      signOut(auth).finally(() => {
        router.push('/');
        toast({ title: "Sesión cerrada", description: "Por tu seguridad, hemos cerrado tu sesión." });
      });
    }
  }, [auth, router]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(handleSignOut, INACTIVITY_TIMEOUT);
  }, [handleSignOut]);

  useEffect(() => {
    if (user && userProfile?.requiresPasswordChange) router.push('/force-password-change');
  }, [user, userProfile, router]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => resetInactivityTimer();
    if (user) {
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetInactivityTimer();
    }
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    if (!isLoading && !user && isMounted) router.push('/');
  }, [user, isLoading, router, isMounted]);

  const onSignOutClick = () => {
    if (auth) signOut(auth).finally(() => router.push('/'));
  };

  const isActive = (href: string) => pathname === href;

  const navLinks = useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.rol === 'MASTER') return allNavLinks;
    if (!userRole) return [];
    const userPermissions = userRole.permissions || {};
    return allNavLinks.map(module => {
      if (module.groups) {
        const accessibleGroups = module.groups.map(group => {
          const accessibleSublinks = group.sublinks.filter(sublink => userPermissions[sublink.id] || sublink.id === 'my-status');
          return { ...group, sublinks: accessibleSublinks };
        }).filter(group => group.sublinks.length > 0);
        return { ...module, groups: accessibleGroups, sublinks: [] };
      }
      const accessibleSublinks = module.sublinks?.filter(sublink => userPermissions[sublink.id] || sublink.id === 'my-status') || [];
      return { ...module, sublinks: accessibleSublinks };
    }).filter(module => (module.sublinks && module.sublinks.length > 0) || (module.groups && module.groups.length > 0));
  }, [userProfile, userRole]);

  const todayBirthdays = useMemo(() => {
    if (!users) return [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    return users.filter(u => u.Status === 'active' && u.fechaNacimiento).map(u => {
        try { return { ...u, birthDate: parseISO(u.fechaNacimiento) }; } catch { return { ...u, birthDate: null }; }
      }).filter((u): u is UserProfile & { birthDate: Date } => u.birthDate !== null && u.birthDate.getMonth() === currentMonth && u.birthDate.getDate() === currentDay);
  }, [users]);

  const tasks = useMemo(() => {
    if (!userProfile || !userProfile.email) return [];
    const userEmailLower = userProfile.email.toLowerCase();
    const userId = userProfile.id;
    const approvalTasks = (approvals || []).filter(app => (app.status === 'pending' && app.jefeInmediatoEmail?.toLowerCase() === userEmailLower) || (app.status === 'approved-boss' && userProfile.cargo === 'DIRECTOR DE RECURSOS HUMANOS')).map(app => ({ id: `approval-${app.id}`, icon: FileSignature, title: `Aprobar contratación: ${app.processInfo?.cargo || 'Puesto'}`, href: '/dashboard/approvals' }));
    const observationTasks = (evaluations || []).filter(ev => ev.observerStatus === 'pending' && ev.observerEmail?.toLowerCase() === userEmailLower).map(ev => ({ id: `eval-${ev.id}`, icon: Eye, title: `Revisar evaluación de colaborador`, href: '/dashboard/observed-evaluations' }));
    const memoTasks = (memorandums || []).filter(m => m.targetUserId === userId && (m.status === 'issued' || m.status === 'read')).map(m => ({ id: `memo-${m.id}`, icon: FileText, title: `Tienes un memorando por firmar`, href: '/dashboard/my-documents' }));
    const vacationTasks = (vacationRequests || []).filter(v => v.leaderEmail?.toLowerCase() === userEmailLower && v.status === 'pending').map(v => ({ id: `vac-${v.id}`, icon: CalendarCheck, title: `Aprobar vacaciones: ${v.userName}`, href: '/dashboard/schedule' }));
    const handoverTasks = (equipmentHandovers || []).filter(h => h.outgoingGuardId === userId && h.status === 'pending').map(h => ({ id: `handover-${h.id}`, icon: ShieldAlert, title: `Validar relevo en ${h.location}`, href: '/dashboard/attendance' }));
    return [...approvalTasks, ...observationTasks, ...memoTasks, ... vacationTasks, ...handoverTasks];
  }, [userProfile, approvals, evaluations, memorandums, vacationRequests, equipmentHandovers]);
  
  const activeModule = useMemo(() => navLinks.find(module => (module.sublinks && module.sublinks.some(sublink => isActive(sublink.href))) || (module.groups && module.groups.some(group => group.sublinks.some(sublink => isActive(sublink.href)))) )?.module, [navLinks, pathname]);
  const activeGroup = useMemo(() => activeModule ? navLinks.find(m => m.module === activeModule)?.groups?.find(group => group.sublinks.some(sublink => isActive(sublink.href)))?.title : null, [activeModule, navLinks, pathname]);
  
  const userNameDisplay = useMemo(() => {
    if (!userProfile) return "...";
    const firstName = userProfile.nombres?.split(' ')[0] || "";
    const firstLastName = userProfile.apellidos?.split(' ')[0] || "";
    return `${firstLastName} ${firstName}`.trim() || user?.email || "";
  }, [userProfile, user]);

  const NavigationMenu = () => (
    <nav className="grid gap-2 text-lg font-medium">
      <Link href="/dashboard" className="flex items-center justify-center gap-2 text-lg font-semibold py-4"><Image src="https://i.postimg.cc/JhmPRP3p/LOGO1.png" alt="Acceso PERFORMA" width={150} height={50} /></Link>
      <h3 className="my-2 px-3 text-sm font-semibold text-primary-foreground/60">Módulos</h3>
      <Accordion type="multiple" className="w-full" defaultValue={activeModule ? [activeModule] : []}>
        {navLinks.map((link) => (
          <AccordionItem value={link.module} key={link.module} className="border-b-0">
            <AccordionTrigger className="flex items-center gap-4 rounded-none px-3 py-2 text-primary-foreground/80 hover:no-underline hover:bg-primary-foreground/10"><div className="flex items-center gap-4"><link.icon className="h-5 w-5" /><span className="text-base font-medium">{link.module}</span></div></AccordionTrigger>
            <AccordionContent className="pt-0 pb-0 pl-4">{link.groups ? (<Accordion type="multiple" className="w-full" defaultValue={activeGroup ? [activeGroup] : []}>{link.groups.map(group => (<AccordionItem value={group.title} key={group.title} className="border-b-0"><AccordionTrigger className="flex items-center gap-2 rounded-none px-3 py-2 text-primary-foreground/70 hover:no-underline hover:bg-primary-foreground/10 text-sm"><span className="font-semibold">{group.title}</span></AccordionTrigger><AccordionContent className="pt-2 pb-0 pl-4"><div className="flex flex-col gap-1 border-l border-primary-foreground/20 pl-4">{group.sublinks.map((sublink: any) => (<Link key={sublink.name} href={sublink.href} onClick={() => setIsSheetOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive(sublink.href) ? 'bg-accent text-accent-foreground' : 'text-primary-foreground/90 hover:bg-primary-foreground/10')}><sublink.icon className="h-4 w-4" />{sublink.name}</Link>))}</div></AccordionContent></AccordionItem>))}</Accordion>) : (<div className="flex flex-col gap-1 ml-4 border-l border-primary-foreground/20 pl-4 py-2">{link.sublinks?.map((sublink: any) => (<Link key={sublink.name} href={sublink.href} onClick={() => setIsSheetOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive(sublink.href) ? 'bg-accent text-accent-foreground' : 'text-primary-foreground/90 hover:bg-primary-foreground/10')}><sublink.icon className="h-4 w-4" />{sublink.name}</Link>))}</div>)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </nav>
  );

  return (
     <>
      <NextTopLoader color="hsl(var(--accent))" height={3} showSpinner={false} />
      <PushNotificationManager />
      <div className="h-full">
        <PrivacyConsentModal />
        <div className="md:hidden">
          <div className="app-container">
            <header className="app-header">
              <div className="app-header-content">
                <Link href="/dashboard"><Image src="https://i.postimg.cc/JhmPRP3p/LOGO1.png" alt="PERFORMA" width={100} height={35} className="app-header-logo" /></Link>
                <div className="header-icons">
                  <DropdownMenu onOpenChange={(open) => { if(open) setBirthdayBadgeSeen(true); }}>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="header-icon-btn"><Cake />{todayBirthdays.length > 0 && !birthdayBadgeSeen && isMounted && <span className="badge bg-accent">{todayBirthdays.length}</span>}</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72"><DropdownMenuLabel className="flex items-center gap-2 text-accent font-bold"><Gift className="h-4 w-4" />Cumpleaños de Hoy</DropdownMenuLabel><DropdownMenuSeparator />{todayBirthdays.length > 0 ? (<div className="max-h-80 overflow-y-auto">{todayBirthdays.map((bday) => (<DropdownMenuItem key={bday.id} className="flex items-center gap-3 py-3"><Avatar className="h-9 w-9 border-2 border-accent"><AvatarImage src={bday.photoUrl} /><AvatarFallback>{bday.nombres[0]}</AvatarFallback></Avatar><div className="flex flex-col min-w-0"><span className="text-xs font-bold truncate text-accent uppercase">{bday.nombres} {bday.apellidos}</span><span className="text-[10px] text-muted-foreground italic">¡Hoy está celebrando su día!</span></div></DropdownMenuItem>))}</div>) : (<div className="py-6 text-center text-xs text-muted-foreground italic">No hay cumpleaños hoy.</div>)}</DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="header-icon-btn"><Bell />{tasks.length > 0 && isMounted && <span className="badge">{tasks.length}</span>}</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72"><DropdownMenuLabel>Notificaciones</DropdownMenuLabel><DropdownMenuSeparator />{tasks.length > 0 ? (<div className="max-h-80 overflow-y-auto">{tasks.map((task) => (<DropdownMenuItem key={task.id} asChild><Link href={task.href} className="flex items-start gap-3 py-3 cursor-pointer"><task.icon className="h-5 w-5 mt-0.5 text-primary shrink-0" /><span className="text-xs leading-tight font-medium">{task.title}</span></Link></DropdownMenuItem>))}</div>) : (<div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2"><CheckCircle className="h-8 w-8 text-green-500/50" />No tienes tareas pendientes.</div>)}</DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="header-icon-btn p-0 h-9 w-9"><Avatar className="h-8 w-8"><AvatarImage src={userProfile?.photoUrl} /><AvatarFallback>{userProfile?.nombres?.[0]}{userProfile?.apellidos?.[0]}</AvatarFallback></Avatar></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel>{userProfile?.nombres} {userProfile?.apellidos}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/dashboard/profile">Mi Perfil</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={onSignOutClick}>Cerrar Sesión</DropdownMenuItem></DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>
            <main className="app-main">{children}</main>
            <AppsMenu isOpen={isAppsMenuOpen} onClose={() => setAppsMenuOpen(false)} navLinks={navLinks} />
            <BottomNav onCentralClick={() => setAppsMenuOpen(true)} />
          </div>
        </div>
        <div className="hidden md:flex h-screen flex-col">
          <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-primary px-4 md:px-6 text-white">
            <div className="flex items-center gap-2 md:gap-4"><Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}><SheetTrigger asChild><Button variant="ghost" className="flex items-center gap-2 text-white hover:bg-primary-foreground/10 px-3 py-2 h-auto text-base rounded-md"><Menu className="h-5 w-5" /><span className="font-medium hidden md:inline">MENÚ</span></Button></SheetTrigger><SheetContent side="left" className="flex flex-col bg-primary text-white border-r-0 p-0"><SheetHeader><SheetTitle className="sr-only">Menú</SheetTitle></SheetHeader><NavigationMenu /></SheetContent></Sheet><Link href="/dashboard" className="flex items-center gap-2 text-white hover:bg-primary-foreground/10 rounded-md px-3 py-2 text-base"><Home className="h-5 w-5" /><span className="font-medium hidden md:inline">INICIO</span></Link></div>
            <div className="flex items-center"><Image src="https://i.postimg.cc/JhmPRP3p/LOGO1.png" alt="PERFORMA" width={120} height={40} /></div>
            <div className="flex items-center gap-4"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="flex items-center gap-2 text-white hover:bg-primary-foreground/10 px-3 py-2 h-auto text-base rounded-md"><User className="h-5 w-5" /><span className="font-medium hidden md:inline">{isMounted ? userNameDisplay : "..."}</span><ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{userProfile?.rol || "Sin rol"}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/dashboard/profile">Mi Perfil</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={onSignOutClick}>Cerrar Sesión</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
          </header>
          <div className="flex-1 overflow-y-auto"><main className="p-4 lg:p-6 bg-background min-h-full">{children}</main></div>
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (<UserProfileProvider><DashboardLayoutContent>{children}</DashboardLayoutContent></UserProfileProvider>)
}
