
import { isWithinInterval } from 'date-fns';
import type { Collaborator, TemporaryTransfer, RoleChange } from './types';

export function getEffectiveDetails(
  collaborator: Collaborator,
  day: Date,
  transfers: TemporaryTransfer[],
  roleChanges: RoleChange[]
): { location: string; jobTitle: string } {
  // El cambio de rol tiene prioridad sobre el traslado
  const activeRoleChange = roleChanges.find(rc => 
    rc.collaboratorId === collaborator.id && isWithinInterval(day, { start: rc.startDate, end: rc.endDate })
  );

  if (activeRoleChange) {
    return {
      location: activeRoleChange.newLocation,
      jobTitle: activeRoleChange.newJobTitle,
    };
  }

  const activeTransfer = transfers.find(t =>
    t.collaboratorId === collaborator.id && isWithinInterval(day, { start: t.startDate, end: t.endDate })
  );

  if (activeTransfer) {
    return {
      location: activeTransfer.newLocation,
      jobTitle: collaborator.originalJobTitle, // En un traslado, el cargo original se mantiene
    };
  }
  
  // Si no hay ninguno activo, devuelve los detalles originales.
  return {
    location: collaborator.originalLocation,
    jobTitle: collaborator.originalJobTitle,
  };
}
