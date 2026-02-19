
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
} from 'date-fns';
import type { Collaborator, Vacation, TemporaryTransfer, Lactation, AttendanceRecord, RoleChange, Holiday, OvertimeRule, ShiftPattern, Notification, ManualOverride, ManualOverrides } from '@/lib/types';
import { getEffectiveDetails } from './schedule-utils';
import { allJobTitles as ALL_JOB_TITLES } from './data';
import { normalizeText } from './utils';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return Math.abs(hash);
}

function seededRandom(seed: number) {
  let state = seed;
  return function() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function seededShuffle<T>(array: T[], seed: number): T[] {
    const shuffled = [...array];
    const random = seededRandom(seed);
    let currentIndex = shuffled.length;
    let randomIndex;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(random() * currentIndex);
        currentIndex--;
        [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
    }

    return shuffled;
}

const isNightShift = (shift: string | null): boolean => {
    if (!shift) return false;
    return shift.includes('N') || shift.includes('T24');
};


export function generarHorariosEstaticos(
  allCollaborators: Collaborator[],
  days: Date[],
  shiftPatterns: ShiftPattern[],
  vacations: Vacation[] = [],
  transfers: TemporaryTransfer[] = [],
  lactations: Lactation[] = [],
  roleChanges: RoleChange[] = [],
  manualOverrides: ManualOverrides = new Map()
): Map<string, Map<string, string | null>> {
  const schedule = new Map<string, Map<string, string | null>>();
  if (!allCollaborators || allCollaborators.length === 0 || !days || days.length === 0) {
    return schedule;
  }

  const JOB_CYCLES = new Map<string, ShiftPattern>();
  shiftPatterns.forEach(p => JOB_CYCLES.set(p.jobTitle, p));

  allCollaborators.forEach(c => schedule.set(c.id, new Map<string, string | null>()));

  const periodIdentifier = days.length > 0 ? format(days[0], 'yyyy-MM') : 'no-days';
  
  // Optimization: Pre-calculate collaborator groups for each day
  const dailyGroups = new Map<string, Map<string, Collaborator[]>>(); // Map<dayKey, Map<groupKey, Collaborator[]>>
  days.forEach(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const groupsForDay = new Map<string, Collaborator[]>();
    allCollaborators.forEach(c => {
      const { location, jobTitle } = getEffectiveDetails(c, day, transfers, roleChanges);
      const groupKey = `${location}-${jobTitle}`;
      if (!groupsForDay.has(groupKey)) {
        groupsForDay.set(groupKey, []);
      }
      groupsForDay.get(groupKey)!.push(c);
    });
    dailyGroups.set(dayKey, groupsForDay);
  });
  
  const absenceTypeDescriptions: Record<string, string> = { PM: 'Permiso Médico', LIC: 'Licencia', SUS: 'Suspensión', RET: 'Retiro', FI: 'Falta Injustificada'};

  days.forEach((day, dayIndex) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const groupsForThisDay = dailyGroups.get(dayKey);
    if (!groupsForThisDay) return;

    allCollaborators.forEach(collaborator => {
      const manualOverride = manualOverrides.get(collaborator.id)?.get(dayKey);
      if (manualOverride !== undefined) {
          schedule.get(collaborator.id)!.set(dayKey, manualOverride.shift);
          return;
      }
      
      const isOnVacation = vacations.some(v => v.requestType === 'vacaciones' && v.userId === collaborator.id && isWithinInterval(day, { start: new Date(v.startDate), end: new Date(v.endDate) }));
      if (isOnVacation) {
        schedule.get(collaborator.id)!.set(dayKey, 'VAC');
        return;
      }
      
      const activeAbsenceRequest = vacations.find(v => v.requestType === 'permiso' && v.userId === collaborator.id && isWithinInterval(day, { start: new Date(v.startDate), end: new Date(v.endDate) }));
      if (activeAbsenceRequest) {
          const reason = activeAbsenceRequest.reason || '';
          const absenceDescription = reason.split(':')[0].trim();
          const absenceCode = Object.keys(absenceTypeDescriptions).find(key => absenceTypeDescriptions[key] === absenceDescription) || 'PERMISO';
          schedule.get(collaborator.id)!.set(dayKey, absenceCode);
          return;
      }
      
      const { location: effectiveLocation, jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, transfers, roleChanges);
      const activeRoleChange = roleChanges.find(rc => rc.collaboratorId === collaborator.id && isWithinInterval(day, { start: rc.startDate, end: rc.endDate }));

      if (effectiveLocation !== collaborator.originalLocation && !activeRoleChange) {
        schedule.get(collaborator.id)!.set(dayKey, 'TRA');
        return;
      }

      const patternData = JOB_CYCLES.get(effectiveJobTitle);
      
      if (!patternData) { // If no pattern is found for the job title
        const isWeekday = !isSaturday(day) && !isSunday(day);
        schedule.get(collaborator.id)!.set(dayKey, isWeekday ? 'N9' : null); // Assign N9 on weekdays, LIB on weekends
        return; // Continue to next collaborator/day
      }
      
      if (patternData.scheduleType === 'MONDAY_TO_FRIDAY') {
          const isWeekday = !isSaturday(day) && !isSunday(day);
          schedule.get(collaborator.id)!.set(dayKey, isWeekday ? (patternData.cycle[0] || 'D12') : null);
          return;
      }
      
      const cycle = patternData.cycle;
      if (!cycle || cycle.length === 0) return;

      const groupKey = `${effectiveLocation}-${effectiveJobTitle}`;
      const group = groupsForThisDay.get(groupKey) || [];
      
      if (group.length === 0) return;

      const groupSeed = simpleHash(`${periodIdentifier}-${groupKey}`);
      const shuffledGroup = seededShuffle(group, groupSeed);
      const collaboratorIndexInGroup = shuffledGroup.findIndex(c => c.id === collaborator.id);
      
      if (collaboratorIndexInGroup === -1) return;

      let effectiveDayIndex = 0;
      for (let i = 0; i < dayIndex; i++) {
        const prevDayKey = format(days[i], 'yyyy-MM-dd');
        const prevShift = schedule.get(collaborator.id)?.get(prevDayKey);
        
        if (prevShift !== 'VAC' && prevShift !== 'TRA' && prevShift !== 'PM' && prevShift !== 'LIC' && prevShift !== 'SUS' && prevShift !== 'RET' && prevShift !== 'FI') {
            effectiveDayIndex++;
        }
      }

      const staggerStep = Math.max(1, Math.floor(cycle.length / group.length));
      const staggerOffset = (effectiveDayIndex + (collaboratorIndexInGroup * staggerStep)) % cycle.length;
      let shift = cycle[staggerOffset];

      const isOnLactationThisDay = lactations.some(l => l.collaboratorId === collaborator.id && isWithinInterval(day, { start: l.startDate, end: l.endDate }));
      if (isOnLactationThisDay && isNightShift(shift)) {
          shift = 'M8';
      }
      
      schedule.get(collaborator.id)!.set(dayKey, shift);
    });
  });

  return schedule;
}

export function applyConditioningRebalance(
  baseSchedule: Map<string, Map<string, string | null>>,
  conditioning: { morning: number; afternoon: number; night: number },
  cashiersInLocation: Collaborator[],
  allCollaborators: Collaborator[], 
  days: Date[],
  lactations: Lactation[],
  transfers: TemporaryTransfer[],
  roleChanges: RoleChange[],
  shiftPatterns: ShiftPattern[]
): Map<string, Map<string, string | null>> {
  const rebalancedSchedule = new Map(Array.from(baseSchedule.entries()).map(([k, v]) => [k, new Map(v)]));
  
  days.forEach(day => {
    const dayKey = format(day, 'yyyy-MM-dd');

    const dailyShiftCounts = { M8: 0, T8: 0, N8: 0, LIB: 0 };
    const shiftAssignments = new Map<'M8' | 'T8' | 'N8' | null, string[]>();
    
    cashiersInLocation.forEach(c => {
      const shift = rebalancedSchedule.get(c.id)?.get(dayKey);
      
      if (shift === 'M8' || shift === 'T8' || shift === 'N8' || shift === null) {
        if (shift === null) {
          dailyShiftCounts.LIB++;
        } else {
          dailyShiftCounts[shift]++;
        }
        if (!shiftAssignments.has(shift)) {
          shiftAssignments.set(shift, []);
        }
        shiftAssignments.get(shift)!.push(c.id);
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
          const originalDonorShift = rebalancedSchedule.get(donorId)?.get(dayKey);

          rebalancedSchedule.get(donorId)!.set(dayKey, needShift);
          shiftNeeds[needShift]--;

          const originalList = shiftAssignments.get(originalDonorShift as 'M8' | 'T8' | 'N8' | null);
          if (originalList) {
              const index = originalList.indexOf(donorId);
              if (index > -1) originalList.splice(index, 1);
          }

          if (!shiftAssignments.has(needShift)) shiftAssignments.set(needShift, []);
          shiftAssignments.get(needShift)!.push(donorId);

          if(originalDonorShift && (originalDonorShift === 'M8' || originalDonorShift === 'T8' || originalDonorShift === 'N8')) {
              shiftNeeds[originalDonorShift]++;
          }
      }
    }
  });

  return rebalancedSchedule;
}


export const getShiftDetailsFromRules = (shift: string, effectiveJobTitle: string, dayType: "NORMAL" | "FESTIVO", overtimeRules: OvertimeRule[]): { start: { h: number; m: number }; hours: number } | null => {
    // Hardcoded fallback for N9 shift
    if (shift === 'N9') {
        return { start: { h: 8, m: 30 }, hours: 9 };
    }

    const normalizedJobTitle = normalizeText(effectiveJobTitle);
    
    let rule = overtimeRules.find(r => 
        normalizeText(r.jobTitle) === normalizedJobTitle && 
        r.shift === shift && 
        r.dayType === dayType
    );
    
    // Fallback logic for other common shifts if no specific rule is found
    if (!rule) {
        switch (shift) {
            case 'N12':
                return { start: { h: 18, m: 0 }, hours: 12 };
            case 'D12':
                return { start: { h: 6, m: 0 }, hours: 12 };
            case 'T24':
                 return { start: { h: 6, m: 0 }, hours: 24 };
            default:
                break;
        }
    }

    if (rule && rule.startTime && rule.endTime) {
        try {
            const start = parse(rule.startTime, 'HH:mm', new Date());
            const end = parse(rule.endTime, 'HH:mm', new Date());
            
            let diff = differenceInMinutes(end, start);
            if (diff < 0) diff += 24 * 60; // Handles overnight shifts

            return {
                start: { h: start.getHours(), m: start.getMinutes() },
                hours: diff / 60
            };
        } catch (e) {
            console.error(`Invalid time format in overtimeRules for shift ${shift}`, e);
            return null;
        }
    }
    return null;
};


export function generateAttendanceRecords(
  collaborators: Collaborator[],
  days: Date[],
  fullSchedule: Map<string, Map<string, string | null>>,
  holidays: Holiday[] = [],
  overtimeRules: OvertimeRule[] = [],
): Map<string, AttendanceRecord> {
  const recordsMap = new Map<string, AttendanceRecord>();
  if (!days || days.length === 0 || !collaborators || collaborators.length === 0) return recordsMap;

  const today = startOfDay(new Date());
  const now = new Date(); 

  for (const day of days) {
    if (day > today) continue; 

    const isSelectedDateToday = isSameDay(day, today);
    const dayIsHoliday = holidays.some(h => isWithinInterval(day, { start: h.startDate, end: h.endDate }));

    for (const collaborator of collaborators) {
      const { jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, [], []);
      const collaboratorSchedule = fullSchedule.get(collaborator.id);
      if (!collaboratorSchedule) continue;

      const dayKey = format(day, 'yyyy-MM-dd');
      const scheduledShift = collaboratorSchedule.get(dayKey);

      const seed = simpleHash(`${dayKey}-${collaborator.id}`);
      const random = seededRandom(seed);

      const recordId = `${dayKey}-${collaborator.id}`;
      const record: Partial<AttendanceRecord> & { id: string; collaborator: Collaborator; date: Date; scheduledShift: string | null } = {
        id: recordId,
        collaborator,
        date: day,
        scheduledShift: scheduledShift ?? null,
        entryTime: null,
        exitTime: null,
        isEntryRegistered: false,
        isExitRegistered: false,
        latenessInMinutes: 0,
        workedHours: null,
        extraHours25: 0,
        extraHours50: 0,
        extraHours100: 0,
        observations: '',
        registrationStatus: 'N/A',
        complianceStatus: 'N/A',
      };
      
      const isAbsenceShift = scheduledShift && ['PM', 'LIC', 'SUS', 'RET', 'FI', 'VAC', 'TRA'].includes(scheduledShift);
      
      if (isAbsenceShift) {
        record.complianceStatus = 'N/A';
        record.registrationStatus = 'N/A';
        
        switch(scheduledShift) {
          case 'VAC': record.observations = 'Vacaciones'; break;
          case 'TRA': record.observations = 'Traslado'; break;
          case 'PM': record.observations = 'Permiso Médico'; break;
          case 'LIC': record.observations = 'Licencia'; break;
          case 'SUS': record.observations = 'Suspensión'; break;
          case 'RET': record.observations = 'Retiro'; break;
          case 'FI': record.observations = 'Falta Injustificada'; break;
          default: record.observations = `Ausencia (${scheduledShift})`;
        }

      } else if (scheduledShift) {
        const dayType = dayIsHoliday ? "FESTIVO" : "NORMAL";
        const shiftDetails = getShiftDetailsFromRules(scheduledShift, effectiveJobTitle, dayType, overtimeRules);
        
        if (!shiftDetails) {
          record.observations = `Turno sin horario definido en reglas: ${scheduledShift}`;
          recordsMap.set(recordId, record as AttendanceRecord);
          continue;
        }
        
        let shiftStart = set(day, { hours: shiftDetails.start.h, minutes: shiftDetails.start.m, seconds: 0, milliseconds: 0 });
        let shiftEnd = addMinutes(shiftStart, shiftDetails.hours * 60);

        const isAbsent = random() < 0.03;
        
        if (!isAbsent) {
            const arrivalDelay = (random() - 0.2) * 20; 
            const shouldGenerateEntry = !isSelectedDateToday || (isSelectedDateToday && now > addMinutes(shiftStart, -60));

            if (shouldGenerateEntry) {
                record.entryTime = addMinutes(shiftStart, arrivalDelay);
                record.isEntryRegistered = true;

                const didForgetToClockOut = random() < 0.05;
                const shouldGenerateExit = !isSelectedDateToday || (isSelectedDateToday && now > shiftEnd);

                if (shouldGenerateExit && !didForgetToClockOut) {
                    const departureOffset = (random() - 0.5) * 30; 
                    record.exitTime = addMinutes(shiftEnd, departureOffset);
                    record.isExitRegistered = true;
                }
            }
        }
        
        if (record.entryTime && record.exitTime) {
            record.workedHours = differenceInMinutes(record.exitTime, record.entryTime) / 60;
        }

        if (!record.entryTime) {
          if (!isSelectedDateToday || (isSelectedDateToday && now > shiftEnd)) {
            record.registrationStatus = 'Falta';
            record.observations = 'No se presenta al turno';
          } else {
             record.registrationStatus = 'Programado';
             record.observations = 'Turno programado';
          }
        } else if (!record.exitTime) {
          record.registrationStatus = 'Incompleto';
          if (isSelectedDateToday && now < shiftEnd) {
            record.observations = 'Turno en progreso';
          } else {
            record.observations = 'Salida no registrada';
          }
        } else {
          record.registrationStatus = 'Completo';
          record.latenessInMinutes = Math.max(0, differenceInMinutes(record.entryTime, shiftStart));
          record.complianceStatus = record.latenessInMinutes > 0 ? 'Atraso' : 'A Tiempo';
          if (record.complianceStatus === 'Atraso') {
            record.observations = 'Llegada tarde';
          } else {
            record.observations = 'Turno cumplido';
          }
        }
        
        const shiftWasWorked = (record.registrationStatus === 'Completo' || record.complianceStatus === 'A Tiempo' || record.complianceStatus === 'Atraso');

        if (shiftWasWorked) {
            const jornada = dayIsHoliday ? "FESTIVO" : "NORMAL"; 
            
            const rule = overtimeRules.find(r => 
                r.jobTitle === effectiveJobTitle && 
                r.dayType === jornada && 
                r.shift === scheduledShift
            );

            if (rule) {
                record.extraHours25 = rule.nightSurcharge;
                record.extraHours50 = rule.sup50;
                record.extraHours100 = rule.ext100;
            }
        }

      } else { // No shift assigned
        record.registrationStatus = 'N/A';
        record.complianceStatus = 'N/A';
        record.observations = 'Día Libre';
      }

      recordsMap.set(recordId, record as AttendanceRecord);
    }
  }
  return recordsMap;
}

type ScheduleContext = {
    vacations: Vacation[];
    transfers: TemporaryTransfer[];
    lactations: Lactation[];
    roleChanges: RoleChange[];
    savedPeriodSettings: Map<string, any>;
    savedSchedules?: {[key: string]: any};
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
  
  const { allCollaborators, shiftPatterns, vacations, transfers, lactations, roleChanges, manualOverrides, notifications, filters, isAutomatic, draftConditioning } = context;

  let schedule = generarHorariosEstaticos(
    allCollaborators,
    days,
    shiftPatterns,
    vacations,
    transfers,
    lactations,
    roleChanges,
    manualOverrides
  );
  
  const location = filters?.location;
  const isCashierRole = filters?.jobTitle === 'CAJERO DE RECAUDO';
  
  if (role === 'coordinator' && location && location !== 'todos' && isCashierRole && isAutomatic === false && draftConditioning) {
      const cashiersInLocation = allCollaborators.filter(c => c.originalJobTitle === 'CAJERO DE RECAUDO' && c.originalLocation === location);
      schedule = applyConditioningRebalance(
          schedule,
          draftConditioning,
          cashiersInLocation,
          allCollaborators, 
          days,
          lactations,
          transfers,
          roleChanges,
          shiftPatterns
      );
  }
  
  allCollaborators.forEach(collaborator => {
      const overrides = manualOverrides.get(collaborator.id);
      if (overrides) {
          overrides.forEach((overrideInfo, dayKey) => {
              if (schedule.has(collaborator.id) && schedule.get(collaborator.id)?.has(dayKey)) {
                  schedule.get(collaborator.id)!.set(dayKey, overrideInfo.shift);
              }
          });
      }
  });

  if (notifications) {
      notifications.forEach(notification => {
        if ((notification.status === 'pending' || notification.status === 'approved') && Array.isArray(notification.changes)) {
            const recordIdParts = notification.recordId.split('-');
            const dayKey = recordIdParts.slice(0, 3).join('-');
            const collaboratorId = recordIdParts.slice(3).join('-');

            const collaboratorSchedule = schedule.get(collaboratorId);
            if (collaboratorSchedule && collaboratorSchedule.has(dayKey)) {
              notification.changes.forEach(change => {
                  if (change.field === 'scheduledShift') {
                      let value = change.to;
                      if (value === 'LIB') {
                          value = null;
                      }
                      collaboratorSchedule.set(dayKey, value as string | null);
                  }
              });
            }
        }
      });
  }


  return schedule;
}
