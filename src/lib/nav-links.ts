
import {
  Award,
  Briefcase,
  CheckSquare,
  ClipboardCheck,
  CalendarCheck,
  CalendarDays,
  Clock,
  Eye,
  FileSearch,
  FileText,
  LayoutGrid,
  Map,
  MapPin,
  Megaphone,
  Shield,
  SlidersHorizontal,
  UserCheck as UserCheckIcon,
  UserCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavLink {
  name: string;
  href: string;
  icon: LucideIcon;
  id: string;
}

export const allNavLinks = [
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
];
