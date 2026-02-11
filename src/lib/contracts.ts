// src/lib/contracts.ts

/**
 * Data Transfer Object (DTO) representing a person for use in utilities like PDF generation.
 * This decouples the utility from specific domain models like UserProfile or Worker.
 */
export interface PersonDTO {
  cedula: string;
  nombreCompleto: string;
  fechaIngreso: string;
  empresa: string;
  cargo: string;
  ubicacion: string;
  departamento: string;
}

/**
 * Data Transfer Object (DTO) for a performance evaluation.
 */
export interface EvaluationDTO {
  evaluationDate: string;
  generalEvaluation: number;
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
}
