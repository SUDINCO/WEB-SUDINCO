'use client';

import {
  format,
  isWithinInterval,
  startOfDay,
  addMinutes,
  differenceInMinutes,
  isToday,
  set,
  endOfDay,
  getDay,
  addDays,
  isSameDay,
  isSunday,
  parse,
  isSaturday,
  subDays,
  subMonths,
} from 'date-fns';
import type { Collaborator, Vacation, TemporaryTransfer, Lactation, AttendanceRecord, RoleChange, Holiday, OvertimeRule, ShiftPattern, Notification, ManualOverride, ManualOverrides, SavedSchedule } from '@/lib/types';
import { getEffectiveDetails } from './schedule-utils';
import { normalizeText } from './utils';

/**
 * Función para generar un hash numérico simple a partir de un string.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return Math.abs(hash);
}

const isNightShift = (shift: string | null): boolean => {
    if (!shift) return false;
    const s = shift.toUpperCase();
    return s.includes('N') || s.includes('T24');
};

/**
 * Encuentra la posición en el ciclo basándose en el historial de los últimos días del periodo anterior.
 */
function findCyclePosition(cycle: (string | null)[], history: (string | null)[]): number {
    if (history.length === 0) return -1;
    
    const sequenceSize = Math.min(3, history.length);
    const lastSequence = history.slice(-sequenceSize);

    for (let i = 0; i < cycle.length; i++) {
        let match = true;
        for (let j = 0; j < sequenceSize; j++) {
            const cycleIdx = (i - (sequenceSize - 1) + j + cycle.length * 10) % cycle.length;
            if (cycle[cycleIdx] !== lastSequence[j]) {
                match = false;
                break;
            }
        }
        if (match) return (i + 1) % cycle.length; 
    }

    const lastShift = history[history.length - 1];
    const lastIdx = cycle.indexOf(lastShift);
    return lastIdx !== -1 ? (lastIdx + 1) % cycle.length : -1;
}

/**
 * Garantiza que para cargos operativos (no-cajeros) haya EXACTAMENTE 1 persona por cada turno obligatorio
 * definido en su patrón en cada ubicación.
 */
function enforceStrictCoverage(
    schedule: Map<string, Map<string, string | null>>,
    allCollaborators: Collaborator[],
    days: Date[],
    transfers: TemporaryTransfer[],
    roleChanges: RoleChange[],
    shiftPatterns: ShiftPattern[]
) {
    const patternsMap = new Map(shiftPatterns.map(p => [normalizeText(p.jobTitle), p]));

    days.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        
        // Agrupar colaboradores por su ubicación y cargo efectivos para este día
        const groups = new Map<string, string[]>();
        allCollaborators.forEach(c => {
            const { location, jobTitle } = getEffectiveDetails(c, day, transfers, roleChanges);
            const groupKey = `${normalizeText(location)}|${normalizeText(jobTitle)}`;
            if (!groups.has(groupKey)) groups.set(groupKey, []);
            groups.get(groupKey)!.push(c.id);
        });

        groups.forEach((collabIds, groupKey) => {
            const [loc, jobTitle] = groupKey.split('|');
            
            // Excluir Cajeros y Horario de Oficina de esta regla estricta 1:1
            if (jobTitle === 'CAJERO DE RECAUDO' || jobTitle === 'HORARIO OFICINA') return;

            const pattern = patternsMap.get(jobTitle);
            if (!pattern) return;

            // Determinar qué turnos operativos (no LIB) existen en el patrón de este cargo
            const requiredShifts = Array.from(new Set(pattern.cycle.filter(s => s && s !== 'LIB') as string[]));

            requiredShifts.forEach(requiredShift => {
                const currentAssigned = collabIds.filter(id => schedule.get(id)?.get(dayKey) === requiredShift);
                
                // REGLA A: Si hay más de 1 persona en el mismo turno, liberar al resto
                if (currentAssigned.length > 1) {
                    currentAssigned.slice(1).forEach(id => {
                        schedule.get(id)?.set(dayKey, 'LIB');
                    });
                }
                
                // REGLA B: Si nadie está cubriendo el turno, buscar a alguien que esté en LIB y asignarlo
                if (currentAssigned.length === 0) {
                    const candidatePool = collabIds.filter(id => {
                        const currentShift = schedule.get(id)?.get(dayKey);
                        // Solo candidatos que estén en LIB y no tengan ausencias especiales (TRA, VAC, etc)
                        return currentShift === 'LIB' || currentShift === null;
                    });

                    if (candidatePool.length > 0) {
                        const assignedId = candidatePool[0];
                        schedule.get(assignedId)?.set(dayKey, requiredShift);
                    }
                }
            });
        });
    });
}

export function generarHorariosEstaticos(
  allCollaborators: Collaborator[],
  days: Date[],
  shiftPatterns: ShiftPattern[],
  vacations: Vacation[] = [],
  transfers: TemporaryTransfer[] = [],
  lactations: Lactation[] = [],
  roleChanges: RoleChange[] = [],
  manualOverrides: ManualOverrides = new Map(),
  savedSchedules: {[key: string]: SavedSchedule} = {}
): Map<string, Map<string, string | null>> {
  const schedule = new Map<string, Map<string, string | null>>();
  if (!allCollaborators || allCollaborators.length === 0 || !days || days.length === 0) {
    return schedule;
  }

  const JOB_CYCLES = new Map<string, ShiftPattern>();
  shiftPatterns.forEach(p => JOB_CYCLES.set(normalizeText(p.jobTitle), p));

  const periodIdentifier = format(days[0], 'yyyy-MM');
  const prevPeriodDate = subMonths(days[0], 1);
  const prevPeriodId = format(prevPeriodDate, 'yyyy-MM');

  const immediateHistoryMap = new Map<string, (string | null)[]>();
  const allSaved = Object.values(savedSchedules);

  allSaved.forEach(saved => {
      if (saved.id.startsWith(prevPeriodId)) {
          Object.entries(saved.schedule).forEach(([collabId, dayMap]) => {
              if (!immediateHistoryMap.has(collabId)) immediateHistoryMap.set(collabId, []);
              const sortedShifts = Object.entries(dayMap)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(entry => entry[1]);
              immediateHistoryMap.set(collabId, sortedShifts);
          });
      }
  });

  // Agrupación para escalonamiento (Staggering)
  const collaboratorsByGroup = new Map<string, Collaborator[]>();
  allCollaborators.forEach(c => {
      const key = `${normalizeText(c.originalLocation)}|${normalizeText(c.originalJobTitle)}`;
      if (!collaboratorsByGroup.has(key)) collaboratorsByGroup.set(key, []);
      collaboratorsByGroup.get(key)!.push(c);
  });

  collaboratorsByGroup.forEach((group, groupKey) => {
      const [loc, jobTitle] = groupKey.split('|');
      const patternData = JOB_CYCLES.get(jobTitle);
      
      group.sort((a, b) => a.id.localeCompare(b.id));

      group.forEach((collaborator, indexInGroup) => {
          const collaboratorSchedule = new Map<string, string | null>();
          schedule.set(collaborator.id, collaboratorSchedule);

          const history = immediateHistoryMap.get(collaborator.id) || [];
          
          days.forEach((day, dayIndex) => {
              const dayKey = format(day, 'yyyy-MM-dd');

              // 1. Overrides manuales
              const manualOverride = manualOverrides.get(collaborator.id)?.get(dayKey);
              if (manualOverride !== undefined) {
                  collaboratorSchedule.set(dayKey, manualOverride.shift);
                  return;
              }
              
              // 2. Ausencias legales
              const isOnVacation = vacations.some(v => v.requestType === 'vacaciones' && v.userId === collaborator.id && isWithinInterval(day, { start: new Date(v.startDate), end: new Date(v.endDate) }));
              if (isOnVacation) {
                collaboratorSchedule.set(dayKey, 'VAC');
                return;
              }
              
              const activeAbsenceRequest = vacations.find(v => v.requestType === 'permiso' && v.userId === collaborator.id && isWithinInterval(day, { start: new Date(v.startDate), end: new Date(v.endDate) }));
              if (activeAbsenceRequest) {
                  const reason = activeAbsenceRequest.reason || '';
                  const absenceCode = reason.split(':')[0].trim().toUpperCase().slice(0, 3);
                  collaboratorSchedule.set(dayKey, absenceCode || 'PER');
                  return;
              }
              
              // 3. Traslados
              const { location: effectiveLocation, jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, transfers, roleChanges);
              const activeRoleChange = roleChanges.find(rc => rc.collaboratorId === collaborator.id && isWithinInterval(day, { start: rc.startDate, end: rc.endDate }));

              if (effectiveLocation !== collaborator.originalLocation && !activeRoleChange) {
                collaboratorSchedule.set(dayKey, 'TRA');
                return;
              }

              // 4. Lógica de Ciclo con Escalonamiento
              if (!patternData) {
                const isWeekday = !isSaturday(day) && !isSunday(day);
                collaboratorSchedule.set(dayKey, isWeekday ? 'N9' : null);
                return;
              }
              
              if (patternData.scheduleType === 'MONDAY_TO_FRIDAY') {
                  const isWeekday = !isSaturday(day) && !isSunday(day);
                  collaboratorSchedule.set(dayKey, isWeekday ? (patternData.cycle[0] || 'D12') : null);
                  return;
              }
              
              const cycle = patternData.cycle;
              let startPosition = findCyclePosition(cycle, history);

              if (startPosition === -1) {
                  // No hay historia? Escalonar basado en la posición en el grupo para cubrir todos los turnos
                  const step = Math.max(1, Math.floor(cycle.length / group.length));
                  startPosition = (indexInGroup * step) % cycle.length;
              }

              const currentCycleIndex = (startPosition + dayIndex) % cycle.length;
              let shift = cycle[currentCycleIndex];

              // 5. Protección de Lactancia
              const isOnLactationThisDay = lactations.some(l => l.collaboratorId === collaborator.id && isWithinInterval(day, { start: l.startDate, end: l.endDate }));
              if (isOnLactationThisDay && isNightShift(shift)) {
                  shift = 'M8';
              }
              
              collaboratorSchedule.set(dayKey, shift);
          });
      });
  });

  // APLICAR COBERTURA ESTRICTA 1:1 (Post-procesamiento)
  enforceStrictCoverage(schedule, allCollaborators, days, transfers, roleChanges, shiftPatterns);

  return schedule;
}

export function applyConditioningRebalance(
  baseSchedule: Map<string, Map<string, string | null>>,
  conditioning: { morning: number; afternoon: number; night: number },
  cashiersInLocation: Collaborator[],
  days: Date[]
): Map<string, Map<string, string | null>> {
  const rebalancedSchedule = new Map(Array.from(baseSchedule.entries()).map(([k, v]) => [k, new Map(v)]));
  
  days.forEach(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dailyShiftCounts = { M8: 0, T8: 0, N8: 0, LIB: 0 };
    const shiftAssignments = new Map<'M8' | 'T8' | 'N8' | null, string[]>();
    
    cashiersInLocation.forEach(c => {
      const shift = rebalancedSchedule.get(c.id)?.get(dayKey);
      const s = shift as 'M8' | 'T8' | 'N8' | null;
      
      if (s === 'M8' || s === 'T8' || s === 'N8' || s === null) {
        if (s === null) dailyShiftCounts.LIB++;
        else dailyShiftCounts[s]++;
        
        if (!shiftAssignments.has(s)) shiftAssignments.set(s, []);
        shiftAssignments.get(s)!.push(c.id);
      }
    });

    const shiftNeeds = {
      M8: conditioning.morning - dailyShiftCounts.M8,
      T8: conditioning.afternoon - dailyShiftCounts.T8,
      N8: conditioning.night - dailyShiftCounts.N8,
    };
    
    const shiftsToFill = (Object.keys(shiftNeeds) as ('M8'|'T8'|'N8')[]).filter(s => shiftNeeds[s] > 0);
    const shiftsWithSurplus = (Object.keys(shiftNeeds) as ('M8'|'T8'|'N8')[]).filter(s => shiftNeeds[s] < 0);

    for (const needShift of shiftsToFill) {
      while (shiftNeeds[needShift] > 0) {
          const donorPool = [...(shiftAssignments.get(null) || [])];
          for(const surplusShift of shiftsWithSurplus) {
              if (shiftNeeds[surplusShift] < 0) {
                  donorPool.push(...(shiftAssignments.get(surplusShift) || []));
              }
          }
          
          if (donorPool.length === 0) break; 
          
          const donorId = donorPool[0]; 
          const originalDonorShift = rebalancedSchedule.get(donorId)?.get(dayKey) as 'M8'|'T8'|'N8'|null;

          rebalancedSchedule.get(donorId)!.set(dayKey, needShift);
          shiftNeeds[needShift]--;

          const originalList = shiftAssignments.get(originalDonorShift);
          if (originalList) {
              const index = originalList.indexOf(donorId);
              if (index > -1) originalList.splice(index, 1);
          }

          if (!shiftAssignments.has(needShift)) shiftAssignments.set(needShift, []);
          shiftAssignments.get(needShift)!.push(donorId);

          if(originalDonorShift && originalDonorShift !== null) {
              shiftNeeds[originalDonorShift]++;
          }
      }
    }
  });

  return rebalancedSchedule;
}

export const getShiftDetailsFromRules = (shift: string, effectiveJobTitle: string, dayType: "NORMAL" | "FESTIVO", overtimeRules: OvertimeRule[]): { start: { h: number; m: number }; hours: number } | null => {
    const normalizedJobTitle = normalizeText(effectiveJobTitle);
    
    let rule = overtimeRules.find(r => 
        normalizeText(r.jobTitle) === normalizedJobTitle && 
        r.shift === shift && 
        r.dayType === dayType
    );
    
    if (!rule && shift === 'N9') {
        rule = overtimeRules.find(r => 
            normalizeText(r.jobTitle) === 'HORARIO OFICINA' &&
            r.shift === shift &&
            r.dayType === dayType
        );
    }

    if (!rule) {
        switch (shift) {
            case 'N12': return { start: { h: 18, m: 0 }, hours: 12 };
            case 'D12': return { start: { h: 6, m: 0 }, hours: 12 };
            case 'T24': return { start: { h: 6, m: 0 }, hours: 24 };
            default: return null;
        }
    }

    if (rule && rule.startTime && rule.endTime) {
        try {
            const start = parse(rule.startTime, 'HH:mm', new Date());
            const end = parse(rule.endTime, 'HH:mm', new Date());
            let diff = differenceInMinutes(end, start);
            if (diff < 0) diff += 24 * 60;
            return {
                start: { h: start.getHours(), m: start.getMinutes() },
                hours: diff / 60
            };
        } catch (e) {
            return null;
        }
    }
    return null;
};

type ScheduleContext = {
    vacations: Vacation[];
    transfers: TemporaryTransfer[];
    lactations: Lactation[];
    roleChanges: RoleChange[];
    savedSchedules?: {[key: string]: SavedSchedule};
    manualOverrides: ManualOverrides;
    notifications: Notification[];
    shiftPatterns: ShiftPattern[];
    isAutomatic?: boolean;
    draftConditioning?: { morning: number; afternoon: number; night: number };
    allCollaborators: Collaborator[];
    filters?: { location: string; jobTitle: string; collaboratorId: string };
};

export function obtenerHorarioUnificado(
  days: Date[],
  context: ScheduleContext,
  role: 'coordinator' | 'admin' | 'rrhh' | 'collaborator'
): Map<string, Map<string, string | null>> {
  
  const { allCollaborators, shiftPatterns, vacations, transfers, lactations, roleChanges, manualOverrides, notifications, filters, isAutomatic, draftConditioning, savedSchedules = {} } = context;

  const locationFilter = filters?.location;
  const cargoFilter = filters?.jobTitle;

  if (role !== 'coordinator') {
      const resultSchedule = new Map<string, Map<string, string | null>>();
      const shiftPatternsByCargo = new Map(shiftPatterns.map(p => [normalizeText(p.jobTitle), p]));

      allCollaborators.forEach(c => {
          const userSchedule = new Map<string, string | null>();
          const normalizedJobTitle = normalizeText(c.originalJobTitle);
          
          if (!shiftPatternsByCargo.has(normalizedJobTitle)) {
              days.forEach(day => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const isWeekend = isSaturday(day) || isSunday(day);
                  userSchedule.set(dayKey, isWeekend ? null : 'N9');
              });
          }
          resultSchedule.set(c.id, userSchedule);
      });

      Object.values(savedSchedules).forEach(saved => {
          Object.entries(saved.schedule).forEach(([collabId, dayMap]) => {
              if (resultSchedule.has(collabId)) {
                  const userSchedule = resultSchedule.get(collabId)!;
                  Object.entries(dayMap).forEach(([dayKey, shift]) => {
                      userSchedule.set(dayKey, shift);
                  });
              }
          });
      });
      return resultSchedule;
  }

  let schedule = generarHorariosEstaticos(
    allCollaborators,
    days,
    shiftPatterns,
    vacations,
    transfers,
    lactations,
    roleChanges,
    manualOverrides,
    savedSchedules
  );
  
  if (locationFilter && locationFilter !== 'todos' && cargoFilter === 'CAJERO DE RECAUDO' && isAutomatic === false && draftConditioning) {
      const cashiersInLocation = allCollaborators.filter(c => c.originalJobTitle === 'CAJERO DE RECAUDO' && c.originalLocation === locationFilter);
      schedule = applyConditioningRebalance(
          schedule,
          draftConditioning,
          cashiersInLocation,
          days
      );
  }
  
  return schedule;
}

export function calculateScheduleSummary(
    collaboratorsToProcess: Collaborator[],
    scheduleToProcess: Map<string, Map<string, string | null>>,
    daysToProcess: Date[],
    allHolidays: Holiday[],
    allOvertimeRules: OvertimeRule[],
    allTransfers: TemporaryTransfer[],
    allRoleChanges: RoleChange[],
    shiftPatterns: ShiftPattern[]
) {
    if (collaboratorsToProcess.length === 0 || daysToProcess.length === 0) {
        return { groupedData: [], uniqueShifts: [] };
    }

    const collaboratorData = collaboratorsToProcess.map(collaborator => {
        const shiftCounts = new Map<string, number>();
        const freeDaysByWeekday = new Array(7).fill(0);
        let workedDayKeys: string[] = [];
        
        daysToProcess.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const shift = scheduleToProcess.get(collaborator.id)?.get(dayKey);

            if (shift === undefined) return;

            if (shift && !['LIB', 'VAC', 'TRA', 'PM', 'LIC', 'SUS', 'RET', 'FI'].includes(shift)) {
                workedDayKeys.push(dayKey);
                shiftCounts.set(shift, (shiftCounts.get(shift) || 0) + 1);
            } else if (shift === 'LIB' || shift === null) {
                const dayOfWeek = getDay(day);
                freeDaysByWeekday[dayOfWeek]++;
            }
        });
        
        const extraHours = workedDayKeys.reduce((acc, dayKey) => {
            const day = new Date(`${dayKey}T00:00:00`);
            const dayIsHoliday = allHolidays.some(h => isWithinInterval(day, { start: h.startDate, end: h.endDate }));
            const jornada = dayIsHoliday ? "FESTIVO" : "NORMAL"; 
            const shift = scheduleToProcess.get(collaborator.id)?.get(dayKey);

            if (shift) {
                const { jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, allTransfers, allRoleChanges);
                const normalizedEffectiveJobTitle = normalizeText(effectiveJobTitle);
                const rule = allOvertimeRules.find(r => 
                    normalizeText(r.jobTitle) === normalizedEffectiveJobTitle && 
                    r.shift === shift && 
                    r.dayType === jornada
                );

                if (rule) {
                    acc.he25 += rule.nightSurcharge || 0;
                    acc.he50 += rule.sup50 || 0;
                    acc.he100 += rule.ext100 || 0;
                }
            }
            return acc;
        }, { he25: 0, he50: 0, he100: 0 });

        return {
            id: collaborator.id,
            name: collaborator.name,
            jobTitle: getEffectiveDetails(collaborator, daysToProcess[0], allTransfers, allRoleChanges).jobTitle,
            shiftCounts,
            freeDaysByWeekday,
            extraHours,
        };
    }).filter(Boolean);

    const grouped = collaboratorData.reduce((acc, data) => {
        let group = acc.find(g => g.jobTitle === data.jobTitle);
        if (!group) {
            group = { jobTitle: data.jobTitle, employees: [] };
            acc.push(group);
        }
        group.employees.push(data);
        return acc;
    }, [] as any[]);
    
    const allShifts = new Set(collaboratorData.flatMap(d => Array.from(d.shiftCounts.keys())));
    const sortedShifts = Array.from(allShifts).sort();
    
    return { groupedData: grouped, uniqueShifts: sortedShifts };
}