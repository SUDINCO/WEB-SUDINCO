
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
  evaluador?: string;
  observerEmail?: string;
  fechaEvaluacionAnual?: string;
  requiresPasswordChange?: boolean;
}

export type MemorandumType = "Memorando Informativo" | "Memorando de Llamado de Atención" | "Memorando de Reconocimiento";
export type MemorandumStatus = "draft" | "issued" | "read" | "signed" | "rejected";

export interface Memorandum {
  id: string;
  code: string;
  type: MemorandumType;
  reason: string;
  targetUserId: string;
  targetUserName: string;
  targetUserCargo: string;
  targetUserEmpresa?: string;
  eventDate?: string;
  eventShift?: string;
  issuerId: string;
  issuerName: string;
  issuerCargo: string;
  issuerSignature?: string;
  content: string;
  status: MemorandumStatus;
  createdAt: number;
  readAt?: number;
  signedAt?: number;
  signature?: string;
  defense?: string;
}

export interface MemorandumCausal {
  id: string;
  category: "Incumplimiento Laboral" | "Conducta" | "Operativa" | "Administrativa" | "Positiva";
  title: string;
  legalBasis: string;
  severity: "N/A" | "Leve" | "Grave" | "Muy Grave";
}

export interface PrivacyConsent {
  id?: string;
  uid: string;
  acceptedAt: number;
  version: string;
  accepted: boolean;
}

export interface EquipmentHandover {
  id: string;
  location: string;
  date: string;
  outgoingGuardId: string;
  outgoingGuardName: string;
  incomingGuardId: string;
  incomingGuardName: string;
  items: {
    name: string;
    status: 'good' | 'issue';
    issueType?: string;
    notes: string;
    photoUrl?: string;
  }[];
  incomingSignature: string;
  outgoingSignature?: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  approvalTimestamp?: number;
  attendanceRecordId?: string;
}

export interface GenericOption {
    id: string;
    name: string;
}

export interface ConsultantGroup {
    id: string;
    name: string;
    members: string[];
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

export type HiringProcessWithShortlist = HiringProcess & { 
    shortlist: (Candidate & { evaluation?: ProfileEvaluation })[] 
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
  shortlist: any[];
  recommendations: any[];
  bossSelection?: {
    selectedCandidateId: string;
    bossComments?: string;
    selectionDate: number;
  };
};

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
    userId: string;
    userName: string;
    userCedula: string;
    userArea: string;
    userCargo: string;
    leaderEmail: string;
    requestType: 'vacaciones' | 'permiso';
    reason?: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    status: 'pending' | 'approved' | 'rejected';
    requestDate: string;
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

export interface AttendanceRecord {
  id: string;
  collaboratorId?: string;
  date: any;
  scheduledShift: string | null;
  entryTime: any | null;
  exitTime: any | null;
  status?: string;
  entryLatitude?: number;
  entryLongitude?: number;
  exitLatitude?: number;
  exitLongitude?: number;
  entryWorkLocationName?: string;
  exitWorkLocationName?: string;
}

export interface Holiday {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface OvertimeRule {
    id: string;
    jobTitle: string;
    dayType: "NORMAL" | "FESTIVO";
    shift: string;
    startTime: string;
    endTime: string;
    nightSurcharge: number;
    sup50: number;
    ext100: number;
}

export interface ShiftPattern {
    jobTitle: string;
    scheduleType: 'ROTATING' | 'MONDAY_TO_FRIDAY';
    cycle: (string | null)[];
}

export interface WorkLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface LocationReport {
  id: string;
  userId: string;
  userName: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  photoUrl: string;
  notes?: string;
}

export interface ManualOverride {
  shift: string | null;
  note: string;
  originalShift: string | null;
}

export type ManualOverrides = Map<string, Map<string, ManualOverride>>;

export interface SavedSchedule {
  id: string;
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

export interface Role {
  id: string;
  name: string;
  permissions: {
    [key: string]: boolean;
  };
}
