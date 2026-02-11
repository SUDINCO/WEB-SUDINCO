

export interface UserProfile {
  id: string;
  codigo: string;
  cedula: string;
  apellidos: string;
  nombres: string;
  fechaIngreso: string;
  fechaNacimiento: string;
  email: string;
  empresa: string;
  cargo: string;
  ubicacion?: string;
  departamento: string;
  centroCosto?: string;
  liderArea?: string;
  consultor?: string;
  rol: string;
  isLeader?: boolean;
  tipoContrato: 'INDEFINIDO' | 'EMERGENTE';
  Status: 'active' | 'inactive';
  photoUrl?: string;
  evaluador?: string; // Added from my-evaluations
  observerEmail?: string; // Added from my-evaluations
  fechaEvaluacionAnual?: string; // Added from my-evaluations
  requiresPasswordChange?: boolean;
}

export interface GenericOption {
    id: string;
    name: string;
}

export interface ConsultantGroup {
    id: string;
    name: string;
    members: string[]; // array of user IDs
};

export interface PerformanceEvaluation {
  id: string;
  workerId: string;
  evaluatorId: string;
  evaluationDate: string;
  generalEvaluation: number;
  observerStatus?: 'pending' | 'approved' | 'review_requested';
  observerComments?: string;
  conocimientosTecnicos: string;
  conocimientosTecnicosJustification?: string;
  calidadTrabajo: string;
  calidadTrabajoJustification?: string;
  cumplimientoPoliticas: string;
  cumplimientoPoliticasJustification?: string;
  proactividad: string;
  proactividadJustification?: string;
  comunicacion: string;
  comunicacionJustification?: string;
  integridad: string;
  integridadJustification?: string;
  adaptabilidad: string;
  adaptabilidadJustification?: string;
  servicioCliente: string;
  servicioClienteJustification?: string;
  compromisoCompania: string;
  compromisoCompaniaJustification?: string;
  observations: string;
  messageForWorker?: string;
  observerId?: string;
  reinforcementPlan?: {
      requiresReinforcement: boolean;
      skillType?: 'tecnica' | 'blanda';
      specificSkills?: string[];
      reinforcementType?: string;
      reinforcementDescription?: string;
  };
  [key: string]: any;
};

export interface ManagerEvaluation {
  id: string;
  employeeId: string;
  managerId: string;
  performanceEvaluationId: string;
  evaluationDate: string;
  leadership_q1: number;
  leadership_q2: number;
  leadership_q3: number;
  communication_q1: number;
  communication_q2: number;
  communication_q3: number;
  performance_q1: number;
  performance_q2: number;
  performance_q3: number;
  openFeedback?: string;
  [key: string]: any;
}

export interface HiringProcess {
  id: string;
  empresa: string;
  cargo: string;
  tiempoRequerido: string;
  tipoContrato: 'INDEFINIDO' | 'EMERGENTE';
  ubicacion: string;
  departamento: string;
  jefeInmediato: string;
  status: 'open' | 'closed' | 'on-hold';
  shortlistCandidateIds?: string[];
  hiredCandidateIds?: string[];
  formacionAcademicaPct?: number;
  conocimientosTecnicosPct?: number;
  experienciaPct?: number;
  competenciasPct?: number;
  isRetroactive?: boolean;
  effectiveHiringDate?: string;
  justificationForRetroactive?: string;
};

export interface Candidate {
    id: string;
    photoUrl?: string;
    cedula: string;
    celular: string;
    apellidos: string;
    nombres: string;
    edad: number;
    nivelEstudios: string;
    institucion?: string;
    tituloProfesional?: string;
    anosExperiencia: number;
    cargosAplicables: string[];
    observacion?: string;
}

export interface ProfileEvaluation {
  id: string;
  candidateId: string;
  processId: string;
  candidateCedula: string;
  notaGeneral: number;
  fechaEvaluacion: string;
  cargoPostulado: string;
  formacionAcademica: number;
  conocimientosTecnicos: number;
  experiencia: number;
  competencias: number;
  status: 'C' | 'NC';
  aspiracionSalarial?: number;
};


// For profile evaluation page
export type HiringProcessWithShortlist = HiringProcess & { 
    shortlist: (Candidate & { evaluation?: ProfileEvaluation })[] 
};

// For approvals page
type CandidateInfo = {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
};

type ShortlistItem = {
  candidateId: string;
  candidateInfo: CandidateInfo;
  evaluationInfo: ProfileEvaluation;
};

type Recommendation = {
  candidateId: string;
  comment: string;
};

export type HiringApproval = {
  id: string;
  processId?: string;
  requesterEmail: string;
  jefeInmediatoEmail: string;
  directorRHHEmail: string;
  createdAt: number;
  status: 'pending' | 'approved-boss' | 'approved-rh' | 'rejected';
  processInfo?: {
    cargo: string;
    empresa: string;
    tipoContrato: string;
    isRetroactive?: boolean;
    effectiveHiringDate?: string;
    justificationForRetroactive?: string;
  };
  shortlist: ShortlistItem[];
  recommendations: Recommendation[];
  bossSelection?: {
    selectedCandidateId: string;
    bossComments?: string;
    selectionDate: number;
  };
};

// Types from Schedule
export interface Collaborator {
  id: string;
  name: string;
  avatarUrl?: string;
  jobTitle: string;
  location: string;
  entryDate: Date;
  originalJobTitle: string; 
  originalLocation: string;
}

export interface Vacation {
  id: string;
  collaboratorId: string;
  startDate: Date;
  endDate: Date;
  status: 'approved' | 'pending' | 'rejected';
}

export interface TemporaryTransfer {
  id: string;
  collaboratorId: string;
  newLocation: string;
  startDate: Date;
  endDate: Date;
}

export interface RoleChange {
    id: string;
    collaboratorId: string;
    newJobTitle: string;
    newLocation: string;
    startDate: Date;
    endDate: Date;
}

export interface Lactation {
    id: string;
    collaboratorId: string;
    startDate: Date;
    endDate: Date;
}

export interface Absence {
    id: string;
    collaboratorId: string;
    type: 'PM' | 'LIC' | 'SUS' | 'RET' | 'FI'; // Permiso Médico, Licencia, Suspensión, Retiro, Falta Injustificada
    startDate: Date;
    endDate: Date;
    description?: string;
}

export interface AttendanceRecord {
  id: string;
  collaborator: Collaborator;
  date: Date;
  scheduledShift: string | null;
  entryTime: Date | null;
  exitTime: Date | null;
  isEntryRegistered: boolean;
  isExitRegistered: boolean;
  latenessInMinutes: number;
  workedHours: number | null;
  extraHours25: number;
  extraHours50: number;
  extraHours100: number;
  observations: string;
  registrationStatus: 'Completo' | 'Incompleto' | 'Falta' | 'N/A' | 'Programado';
  complianceStatus: 'A Tiempo' | 'Atraso' | 'Falta' | 'N/A';
}


export interface Holiday {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface OvertimeRule {
    jobTitle: string;
    dayType: "NORMAL" | "FESTIVO";
    shift: string;
    startTime?: string; // HH:mm
    endTime?: string;   // HH:mm
    nightSurcharge: number;
    sup50: number;
    ext100: number;
}

export interface ShiftPattern {
    jobTitle: string;
    scheduleType: 'ROTATING' | 'MONDAY_TO_FRIDAY';
    cycle: (string | null)[];
}

export interface NotificationChange {
  field: 'scheduledShift' | 'entryTime' | 'exitTime' | 'observation';
  from: string | null;
  to: string | null;
}

export interface Notification {
  id: string;
  recordId: string; // e.g., '2023-11-20-collabId'
  requesterId: string;
  requesterName: string;
  changes: NotificationChange[];
  status: 'pending' | 'approved' | 'rejected';
  requestNote: string;
  createdAt: string; // ISO String
  actedAt?: string; // ISO String
  actedBy?: string; // UID or name of admin/coordinator
  adminObservation?: string;
}

export interface ManualOverride {
  shift: string | null;
  note: string;
  originalShift: string | null;
}

export type ManualOverrides = Map<string, Map<string, ManualOverride>>;

export interface SavedSchedule {
  id: string; // periodId_location_jobTitle
  schedule: { [collaboratorId: string]: { [dayKey: string]: string | null } };
  conditioning: {
    isAutomatic: boolean;
    morning: number;
    afternoon: number;
    night: number;
  };
  location: string;
  jobTitle: string;
  savedAt: number;
  savedBy: {
    name: string;
    jobTitle: string;
  };
}


export interface Fine {
    id: string;
    collaboratorId: string;
    eventDate: Date;
    percentage: number;
    reason: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: {
    [key: string]: boolean;
  };
}
