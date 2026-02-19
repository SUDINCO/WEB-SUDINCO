

'use client';

import Link from "next/link";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import NextTopLoader from 'nextjs-toploader';
import {
  Home,
  Menu,
  Briefcase,
  FileText,
  User,
  ChevronDown,
  Shield,
  LoaderCircle,
  FileSearch,
  CheckSquare,
  ClipboardCheck,
  CalendarDays,
  UserCog,
  Users,
  Award,
  CalendarCheck,
  SlidersHorizontal,
  Eye,
  Megaphone,
  Rss,
  UserCheck as UserCheckIcon,
  Clock,
  MapPin,
  Bell,
  MessageSquare,
  LayoutGrid,
  BarChart,
  Map,
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
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import { toast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { AppsMenu } from "@/components/dashboard/apps-menu";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileProvider, useUserProfile } from '@/context/user-profile-context';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAppsMenuOpen, setAppsMenuOpen] = useState(false);

  const { user, loading: userLoading } = useUser();
  const { userProfile, userRole, isLoading: profileLoading } = useUserProfile();
  const auth = useAuth();
  const inactivityTimer = useRef<NodeJS.Timeout>();

  const isLoading = userLoading || profileLoading;

  const handleSignOut = useCallback(() => {
    if (auth) {
      signOut(auth).finally(() => {
        router.push('/');
        toast({
          title: "Sesión cerrada por inactividad",
          description: "Por tu seguridad, hemos cerrado tu sesión.",
        });
      });
    }
  }, [auth, router]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(handleSignOut, INACTIVITY_TIMEOUT);
  }, [handleSignOut]);

  useEffect(() => {
    if (user && userProfile?.requiresPasswordChange) {
      router.push('/force-password-change');
    }
  }, [user, userProfile, router]);


  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    if (user) {
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetInactivityTimer();
    }

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  const onSignOutClick = () => {
    if (auth) {
      signOut(auth).finally(() => {
        router.push('/');
      });
    }
  };

  const isActive = (href: string) => pathname === href;

  const allNavLinks = useMemo(() => [
    {
      module: "Recursos Humanos",
      icon: Briefcase,
      groups: [
        {
          title: "Evaluaciones de Desempeño",
          sublinks: [
            { name: "Personal a Evaluar", href: "/dashboard/my-evaluations", icon: Award, id: "my-evaluations" },
            { name: "Evaluaciones Observadas", href: "/dashboard/observed-evaluations", icon: Eye, id: "observed-evaluations" },
            { name: "Mi Estado de Evaluación", href: "/dashboard/my-status", icon: UserCheckIcon, id: "my-status" },
          ]
        },
        {
          title: "Aprobación de Contrataciones",
          sublinks: [
            { name: "Evaluación de Perfil", href: "/dashboard/profile-evaluation", icon: FileSearch, id: "profile-evaluation" },
            { name: "Aprobaciones", href: "/dashboard/approvals", icon: CheckSquare, id: "approvals" },
          ]
        },
        {
            title: "Nómina y Asistencia",
            sublinks: [
                { name: "Nómina", href: "/dashboard/staff", icon: Users, id: "staff" },
                { name: "Mi Registro", href: "/dashboard/attendance", icon: Clock, id: "attendance" },
                { name: "Mapa de Asistencia", href: "/dashboard/attendance-map", icon: Map, id: "attendance-map" },
                { name: "Cronograma", href: "/dashboard/schedule", icon: CalendarCheck, id: "schedule" },
                { name: "Control de Asistencia", href: "/dashboard/attendance-summary", icon: ClipboardCheck, id: "attendance-summary" },
                { name: "Reportar Ubicación", href: "/dashboard/report-location", icon: MapPin, id: "report-location" },
            ]
        },
        {
          title: "Solicitudes",
          sublinks: [
            { name: "Vacaciones y Permisos", href: "/dashboard/vacation-requests", icon: CalendarDays, id: "vacation-requests" },
          ]
        },
      ]
    },
    {
      module: "Asignaciones",
      icon: ClipboardCheck,
      sublinks: [
        { name: "Ubicaciones de Trabajo", href: "/dashboard/administration/work-locations", icon: MapPin, id: "work-locations" },
      ]
    },
    {
      module: "Administración",
      icon: Shield,
      sublinks: [
        { name: "Aprobación de Publicaciones", href: "/dashboard/administration/evaluation-percentages", icon: Megaphone, id: "publications" },
        { name: "Evaluación de Desempeño", href: "/dashboard/performance-evaluation", icon: ClipboardCheck, id: "performance-evaluation" },
        { name: "Roles y Permisos", href: "/dashboard/administration/roles", icon: FileText, id: "roles" },
        { name: "Asignación de Líderes", href: "/dashboard/administration/leader-assignment", icon: UserCog, id: "leader-assignment" },
        { name: "Configuración de Horarios", href: "/dashboard/administration/schedule-settings", icon: SlidersHorizontal, id: "schedule-settings" },
      ]
    }
  ], []);

  const navLinks = useMemo(() => {
    if (!userProfile) return [];

    const userRoleName = userProfile.rol;
    if (userRoleName === 'MASTER') return allNavLinks;
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
  }, [userProfile, userRole, allNavLinks]);
  
  const activeModule = useMemo(() => navLinks.find(module =>
    (module.sublinks && module.sublinks.some(sublink => isActive(sublink.href))) ||
    (module.groups && module.groups.some(group => group.sublinks.some(sublink => isActive(sublink.href))))
  )?.module, [navLinks, pathname]);
  
  const activeGroup = useMemo(() => activeModule
    ? navLinks.find(m => m.module === activeModule)?.groups?.find(group => group.sublinks.some(sublink => isActive(sublink.href)))?.title
    : null, [activeModule, navLinks, pathname]);
  
  const handleLinkClick = () => {
    if (isSheetOpen) {
      setIsSheetOpen(false);
    }
  };

  const NavigationMenu = () => (
    <nav className="grid gap-2 text-lg font-medium">
      <Link href="/dashboard" className="flex items-center justify-center gap-2 text-lg font-semibold">
        <Image
          src="https://i.postimg.cc/jSvfPdzH/LOGO1.png"
          alt="Acceso PERFORMA"
          width={150}
          height={50}
        />
      </Link>
      
      <h3 className="my-2 px-3 text-sm font-semibold text-blue-300/80">
        Módulos
      </h3>
      <Accordion type="multiple" className="w-full" defaultValue={activeModule ? [activeModule] : []}>
        {navLinks.map((link) => (
          <AccordionItem value={link.module} key={link.module} className="border-b-0">
            <AccordionTrigger className="flex items-center gap-4 rounded-none px-3 py-2 text-blue-200 hover:no-underline hover:bg-blue-800/50">
              <div className="flex items-center gap-4">
                <link.icon className="h-5 w-5" />
                <span className="text-base font-medium">{link.module}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0 pb-0 pl-4">
              {link.groups ? (
                <Accordion type="multiple" className="w-full" defaultValue={activeGroup ? [activeGroup] : []}>
                  {link.groups.map(group => (
                    <AccordionItem value={group.title} key={group.title} className="border-b-0">
                      <AccordionTrigger className="flex items-center gap-2 rounded-none px-3 py-2 text-blue-300/80 hover:no-underline hover:bg-blue-800/50 text-sm">
                        <span className="font-semibold">{group.title}</span>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-0 pl-4">
                        <div className="flex flex-col gap-1 border-l border-blue-700 pl-4">
                          {group.sublinks.map((sublink: any) => (
                            <Link
                              key={sublink.name}
                              href={sublink.href}
                              onClick={handleLinkClick}
                              className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive(sublink.href) ? 'bg-amber-400 text-blue-900' : 'text-blue-200 hover:bg-blue-800')}
                            >
                              <sublink.icon className="h-4 w-4" />
                              {sublink.name}
                            </Link>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="flex flex-col gap-1 ml-4 border-l border-blue-700 pl-4 py-2">
                  {link.sublinks?.map((sublink: any) => (
                    <Link
                      key={sublink.name}
                      href={sublink.href}
                      onClick={handleLinkClick}
                      className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive(sublink.href) ? 'bg-amber-400 text-blue-900' : 'text-blue-200 hover:bg-blue-800')}
                    >
                      <sublink.icon className="h-4 w-4" />
                      {sublink.name}
                    </Link>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </nav>
  );

  const renderLayout = () => (
     <>
      <NextTopLoader
        color="#2563EB"
        initialPosition={0.08}
        crawlSpeed={200}
        height={3}
        crawl={true}
        showSpinner={false}
        easing="ease"
        speed={200}
        shadow="0 0 10px #2563EB,0 0 5px #2563EB"
      />
      
      {/* Container for both mobile and desktop views */}
      <div className="h-full">
        
        {/* Mobile View */}
        <div className="md:hidden">
          <div className="app-container">
            <header className="app-header">
              <div className="app-header-content">
                <Link href="/dashboard">
                  <Image
                    src="https://i.postimg.cc/jSvfPdzH/LOGO1.png"
                    alt="Acceso PERFORMA"
                    width={100}
                    height={35}
                    className="app-header-logo"
                  />
                </Link>
                <div className="header-icons">
                  <Button variant="ghost" className="header-icon-btn">
                    <MessageSquare />
                  </Button>
                  <Button variant="ghost" className="header-icon-btn">
                    <Bell />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="header-icon-btn p-0 h-9 w-9">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={userProfile?.photoUrl} />
                          <AvatarFallback>{userProfile?.nombres?.[0]}{userProfile?.apellidos?.[0]}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>{userProfile?.nombres} {userProfile?.apellidos}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/profile">Mi Perfil</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={onSignOutClick}>
                        Cerrar Sesión
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>
            <main className="app-main">{children}</main>
            <AppsMenu
              isOpen={isAppsMenuOpen}
              onClose={() => setAppsMenuOpen(false)}
              navLinks={navLinks}
            />
            <BottomNav onCentralClick={() => setAppsMenuOpen(true)} />
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex h-screen flex-col">
          <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-blue-900 px-4 md:px-6 text-white">
            <div className="flex items-center gap-2 md:gap-4">
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-white hover:bg-blue-800 hover:text-white px-2 md:px-3 py-2 h-auto text-base rounded-md">
                    <Menu className="h-5 w-5" />
                    <span className="font-medium hidden md:inline">MENÚ</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col bg-blue-900 text-white border-r-0 p-0">
                  <SheetHeader>
                    <SheetTitle className="sr-only">Menú Principal</SheetTitle>
                  </SheetHeader>
                  <NavigationMenu />
                </SheetContent>
              </Sheet>
              <Link href="/dashboard" className="flex items-center gap-2 text-white hover:bg-blue-800 rounded-md px-2 md:px-3 py-2 text-base">
                <Home className="h-5 w-5" />
                <span className="font-medium hidden md:inline">HOME</span>
              </Link>
            </div>
            
            <div className="flex items-center">
              <Image
                src="https://i.postimg.cc/jSvfPdzH/LOGO1.png"
                alt="PERFORMA Logo"
                width={120}
                height={40}
              />
            </div>

            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-white hover:bg-blue-800 hover:text-white px-3 py-2 h-auto text-base rounded-md">
                    <User className="h-5 w-5" />
                    <span className="font-medium hidden md:inline">{user?.email}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{userProfile?.rol || "Sin rol asignado"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile">Mi Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onSignOutClick}>
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <main className="p-4 lg:p-6 bg-slate-50 min-h-full">
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // If done loading but no user, or if password change is required, show spinner while redirect effect runs.
  if (!user || userProfile?.requiresPasswordChange) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Master user gets access regardless of profile status
  if (user.email === 'master@sudinco.com') {
    return renderLayout();
  }

  // For all other users, a profile is required.
  if (!userProfile) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-center">
        <Shield className="h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Acceso Denegado</h1>
        <p className="mt-2 text-lg text-gray-600">
          Tu usuario no está registrado como trabajador en el sistema.
        </p>
        <p className="text-sm text-gray-500">Por favor, contacta al administrador.</p>
        <Button onClick={onSignOutClick} className="mt-6">Cerrar Sesión</Button>
      </div>
    );
  }

  // Profile exists, check status.
  if (userProfile.Status === 'inactive') {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-center">
        <Shield className="h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Acceso Denegado</h1>
        <p className="mt-2 text-lg text-gray-600">
          Tu usuario se encuentra inactivo.
        </p>
        <p className="text-sm text-gray-500">Por favor, contacta al administrador.</p>
        <Button onClick={onSignOutClick} className="mt-6">Cerrar Sesión</Button>
      </div>
    );
  }
  
  // User is valid, active, and has a profile.
  return renderLayout();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProfileProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </UserProfileProvider>
  )
}
