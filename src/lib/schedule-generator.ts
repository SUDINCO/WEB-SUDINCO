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
import { es } from 'date-fns/locale';
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

/**
 * Generador de números pseudoaleatorios con semilla.
 */
function seededRandom(seed: number) {
  let state = seed;
  return function() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
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
    if (history.length === 0) return -1; // Indica que no hay historial inmediato
    
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
 * Calcula la "Deuda de Fines de Semana" analizando TODOS los cronogramas aprobados.
 * Retorna un mapa de ID -> Score (proporción de fines de semana trabajados).
 */
function calculateWeekendEquity(collaborators: Collaborator[], savedSchedules: SavedSchedule[]): Map<string, number> {
    const weekendStats = new Map<string, { worked: number, total: number }>();
    
    collaborators.forEach(c => weekendStats.set(c.id, { worked: 0, total: 0 }));

    savedSchedules.forEach(saved => {
        Object.entries(saved.schedule).forEach(([collabId, dayMap]) => {
            const stats = weekendStats.get(collabId);
            if (!stats) return;

            Object.entries(dayMap).forEach(([dayKey, shift]) => {
                const date = new Date(`${dayKey}T00:00:00`);
                if (isSaturday(date) || isSunday(date)) {
                    stats.total++;
                    if (shift && !['LIB', 'VAC', 'TRA', 'PM', 'LIC', 'SUS', 'RET', 'FI'].includes(shift)) {
                        stats.worked++;
                    }
                }
            });
        });
    });

    const equityScores = new Map<string, number>();
    weekendStats.forEach((stats, id) => {
        const score = stats.total > 0 ? stats.worked / stats.total : 0.5;
        equityScores.set(id, score);
    });

    return equityScores;
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
  const equityScores = calculateWeekendEquity(allCollaborators, allSaved);

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

  allCollaborators.forEach(collaborator => {
    const collaboratorSchedule = new Map<string, string | null>();
    schedule.set(collaborator.id, collaboratorSchedule);

    const history = immediateHistoryMap.get(collaborator.id) || [];
    const equityScore = equityScores.get(collaborator.id) || 0.5;

    days.forEach((day, dayIndex) => {
      const dayKey = format(day, 'yyyy-MM-dd');

      const manualOverride = manualOverrides.get(collaborator.id)?.get(dayKey);
      if (manualOverride !== undefined) {
          collaboratorSchedule.set(dayKey, manualOverride.shift);
          return;
      }
      
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
      
      const { location: effectiveLocation, jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, transfers, roleChanges);
      const activeRoleChange = roleChanges.find(rc => rc.collaboratorId === collaborator.id && isWithinInterval(day, { start: rc.startDate, end: rc.endDate }));

      if (effectiveLocation !== collaborator.originalLocation && !activeRoleChange) {
        collaboratorSchedule.set(dayKey, 'TRA');
        return;
      }

      const patternData = JOB_CYCLES.get(normalizeText(effectiveJobTitle));
      
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
          const personSeed = simpleHash(collaborator.id + periodIdentifier);
          const equityNudge = equityScore > 0.6 ? 2 : (equityScore < 0.4 ? -2 : 0);
          startPosition = (personSeed + equityNudge) % cycle.length;
      }

      const groupShuffleFactor = simpleHash(periodIdentifier + effectiveLocation) % 3;
      const currentCycleIndex = (startPosition + dayIndex + groupShuffleFactor) % cycle.length;
      
      let shift = cycle[currentCycleIndex];

      const isOnLactationThisDay = lactations.some(l => l.collaboratorId === collaborator.id && isWithinInterval(day, { start: l.startDate, end: l.endDate }));
      if (isOnLactationThisDay && isNightShift(shift)) {
          shift = 'M8';
      }
      
      collaboratorSchedule.set(dayKey, shift);
    });
  });

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

  // LÓGICA PARA ROLES QUE SOLO VEN LO APROBADO (Colaboradores, RRHH en reportes, etc.)
  if (role !== 'coordinator') {
      const resultSchedule = new Map<string, Map<string, string | null>>();
      const shiftPatternsByCargo = new Map(shiftPatterns.map(p => [normalizeText(p.jobTitle), p]));

      allCollaborators.forEach(collaborator => {
          const userSchedule = new Map<string, string | null>();
          const normalizedJobTitle = normalizeText(collaborator.originalJobTitle);
          
          // REGLA: El personal de oficina (sin patrón de rotación asignado) NO requiere aprobación manual
          if (!shiftPatternsByCargo.has(normalizedJobTitle)) {
              days.forEach(day => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const isWeekend = isSaturday(day) || isSunday(day);
                  userSchedule.set(dayKey, isWeekend ? null : 'N9');
              });
          }
          resultSchedule.set(collaborator.id, userSchedule);
      });

      // Añadir cronogramas aprobados (sobrescriben o completan según el caso)
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

  // LÓGICA PARA COORDINADOR (Generación de borrador)
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
                const rule = allOvertimeRules.find(r => 
                    normalizeText(r.jobTitle) === normalizedJobTitle && 
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