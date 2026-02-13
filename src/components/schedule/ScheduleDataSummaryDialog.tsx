
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, getDay, isWithinInterval, parseISO, subMonths, eachDayOfInterval, startOfYear, endOfYear, set } from 'date-fns';
import type { Collaborator, Holiday, OvertimeRule, RoleChange, SavedSchedule, TemporaryTransfer } from '@/lib/types';
import { getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { getEffectiveDetails } from '@/lib/schedule-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';

type Option = {
  value: string;
  label: string;
  isSaved?: boolean;
};

interface ScheduleDataSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Map<string, Map<string, string | null>>;
  savedSchedules: { [key: string]: SavedSchedule };
  collaborators: Collaborator[];
  days: Date[];
  currentDate: Date;
  periodTitle: string;
  holidays: Holiday[];
  overtimeRules: OvertimeRule[];
  transfers: TemporaryTransfer[];
  roleChanges: RoleChange[];
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  locationOptions: Option[];
  jobTitleOptions: Option[];
  selectedLocation: string;
  onLocationChange: (value: string) => void;
  selectedJobTitle: string;
  onJobTitleChange: (value: string) => void;
}

interface SummaryData {
    id: string;
    name: string;
    jobTitle: string;
    shiftCounts: Map<string, number>;
    freeDaysByWeekday: number[];
    extraHours: { he25: number; he50: number; he100: number; };
    compensationHours: number;
    compensationDetails: { day: Date, shift: string | null }[];
}

function calculateScheduleSummary(
    collaboratorsToProcess: Collaborator[],
    scheduleToProcess: Map<string, Map<string, string | null>>,
    daysToProcess: Date[],
    allHolidays: Holiday[],
    allOvertimeRules: OvertimeRule[],
    allTransfers: TemporaryTransfer[],
    allRoleChanges: RoleChange[]
) {
    const collaboratorData = collaboratorsToProcess.map(collaborator => {
        const collaboratorSchedule = scheduleToProcess.get(collaborator.id);
        if (!collaboratorSchedule) return null;

        const shiftCounts = new Map<string, number>();
        const freeDaysByWeekday = new Array(7).fill(0);
        let workedDayKeys: string[] = [];
        
        daysToProcess.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const shift = collaboratorSchedule.get(dayKey);

            if (shift && shift !== 'LIB' && shift !== 'VAC' && shift !== 'TRA' && !['PM', 'LIC', 'SUS', 'RET', 'FI'].includes(shift)) {
                workedDayKeys.push(dayKey);
                shiftCounts.set(shift, (shiftCounts.get(shift) || 0) + 1);
            } else if (shift === 'LIB' || shift === null) {
                const dayOfWeek = getDay(day);
                freeDaysByWeekday[dayOfWeek]++;
            }
        });
        
        let compensationHours = 0;
        let compensationDetails: { day: Date, shift: string | null }[] = [];
        let finalWorkedDayKeys = [...workedDayKeys];

        if (workedDayKeys.length > 22) {
            const extraDaysCount = workedDayKeys.length - 22;
            const compensationDayKeys = workedDayKeys.slice(-extraDaysCount);
            finalWorkedDayKeys = workedDayKeys.slice(0, 22);

            compensationDayKeys.forEach(dayKey => {
                const day = new Date(`${dayKey}T00:00:00`);
                const shift = collaboratorSchedule.get(dayKey);
                if (shift) {
                    const { jobTitle } = getEffectiveDetails(collaborator, day, allTransfers, allRoleChanges);
                    const shiftDetails = getShiftDetailsFromRules(shift, jobTitle, allOvertimeRules);
                    if (shiftDetails) {
                        compensationHours += shiftDetails.hours;
                        compensationDetails.push({ day, shift });
                    }
                }
            });
        }
        
        const extraHours = finalWorkedDayKeys.reduce((acc, dayKey) => {
            const day = new Date(`${dayKey}T00:00:00`);
            const dayIsHoliday = allHolidays.some(h => isWithinInterval(day, { start: h.startDate, end: h.endDate }));
            const jornada = dayIsHoliday ? "FESTIVO" : "NORMAL"; 
            const shift = collaboratorSchedule.get(dayKey);

            if (shift) {
                const { jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, allTransfers, allRoleChanges);
                const rule = allOvertimeRules.find(r => r.jobTitle === effectiveJobTitle && r.dayType === jornada && r.shift === shift);
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
            compensationHours,
            compensationDetails,
        };
    }).filter((c): c is NonNullable<typeof c> => c !== null);

    const grouped = collaboratorData.reduce((acc, data) => {
        let group = acc.find(g => g.jobTitle === data.jobTitle);
        if (!group) {
            group = { jobTitle: data.jobTitle, employees: [] };
            acc.push(group);
        }
        group.employees.push(data);
        return acc;
    }, [] as { jobTitle: string, employees: typeof collaboratorData }[]);
    
    grouped.sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));
    grouped.forEach(group => group.employees.sort((a,b) => a.name.localeCompare(b.name)));

    const allShifts = new Set(collaboratorData.flatMap(d => Array.from(d.shiftCounts.keys())));
    const sortedShifts = ['M8', 'T8', 'N8', 'D12', 'N12', 'TA', 'T24', 'D10', 'D9'].filter(s => allShifts.has(s));
    
    return { groupedData: grouped, uniqueShifts: sortedShifts };
}

const SummaryTable = ({ groupedData, uniqueShifts }: { groupedData: any[], uniqueShifts: string[] }) => {
    const weekDaysLabels = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    
    return (
      <Table>
          <TableHeader className="sticky top-0 bg-background z-20">
              <TableRow>
                  <TableHead rowSpan={2} className="sticky left-0 bg-background z-30 p-2 min-w-[200px] border-r">TRABAJADORES</TableHead>
                  <TableHead colSpan={uniqueShifts.length + 1} className="text-center p-1 border-x">TURNO</TableHead>
                  <TableHead colSpan={7} className="text-center p-1 border-x">CONTADOR DE DÍAS LIBRES</TableHead>
                  <TableHead colSpan={5} className="text-center p-1 border-x">TOTALES</TableHead>
              </TableRow>
              <TableRow>
                  {uniqueShifts.map(shift => <TableHead key={shift} className="p-1 text-center w-10 border-x">{shift}</TableHead>)}
                  <TableHead className="p-1 text-center w-10 border-x font-bold">LIB</TableHead>
                  {weekDaysLabels.map(day => <TableHead key={day} className="p-1 text-center w-10 border-x">{day}</TableHead>)}
                  <TableHead className="p-1 text-center w-16 border-x">H.E. 25%</TableHead>
                  <TableHead className="p-1 text-center w-16 border-x">H.E. 50%</TableHead>
                  <TableHead className="p-1 text-center w-16 border-x">H.E. 100%</TableHead>
                  <TableHead className="p-1 text-center w-16 border-x">H. Comp.</TableHead>
                  <TableHead className="p-1 text-center w-16 border-x">Multas (%)</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {groupedData.length > 0 ? (
                  groupedData.map(group => (
                      <React.Fragment key={group.jobTitle}>
                          <TableRow className="bg-amber-400 hover:bg-amber-400">
                              <TableCell colSpan={uniqueShifts.length + 14} className="font-bold text-center text-black p-1 sticky left-0 bg-amber-400 z-10">
                                  {group.jobTitle}
                              </TableCell>
                          </TableRow>
                          {group.employees.map((employee: SummaryData) => {
                              const totalFreeDays = employee.freeDaysByWeekday.reduce((a, b) => a + b, 0);
                              return (
                                  <TableRow key={employee.id}>
                                      <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">{employee.name}</TableCell>
                                      {uniqueShifts.map(shift => <TableCell key={shift} className="text-center">{employee.shiftCounts.get(shift) || ''}</TableCell>)}
                                      <TableCell className="text-center font-bold border-x">{totalFreeDays || ''}</TableCell>
                                      {employee.freeDaysByWeekday.map((count, index) => <TableCell key={index} className="text-center border-x">{count > 0 ? count : ''}</TableCell>).slice(1).concat(
                                          <TableCell key={0} className="text-center border-x">{employee.freeDaysByWeekday[0] > 0 ? employee.freeDaysByWeekday[0] : ''}</TableCell>
                                      )}
                                      <TableCell className="text-center">{employee.extraHours.he25 > 0 ? employee.extraHours.he25.toFixed(2) : ''}</TableCell>
                                      <TableCell className="text-center">{employee.extraHours.he50 > 0 ? employee.extraHours.he50.toFixed(2) : ''}</TableCell>
                                      <TableCell className="text-center">{employee.extraHours.he100 > 0 ? employee.extraHours.he100.toFixed(2) : ''}</TableCell>
                                      <TableCell className="text-center font-bold text-blue-600">
                                          {employee.compensationHours > 0 && (
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <span className="flex items-center justify-center gap-1 cursor-help">
                                                          {employee.compensationHours.toFixed(2)}
                                                          <Info className="h-3 w-3"/>
                                                      </span>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                      <div className="text-xs p-1">
                                                          <p className="font-bold mb-1">Días Compensados:</p>
                                                          <ul className="space-y-0.5">
                                                              {employee.compensationDetails.map(d => <li key={d.day.toISOString()}>{format(d.day, 'dd/MM')}: {d.shift}</li>)}
                                                          </ul>
                                                      </div>
                                                  </TooltipContent>
                                              </Tooltip>
                                          )}
                                      </TableCell>
                                      <TableCell className="text-center"></TableCell>
                                  </TableRow>
                              )
                          })}
                      </React.Fragment>
                  ))
              ) : (
                  <TableRow>
                      <TableCell colSpan={uniqueShifts.length + 14} className="h-48 text-center text-muted-foreground">
                          No hay datos aprobados para mostrar con los filtros seleccionados.
                      </TableCell>
                  </TableRow>
              )}
          </TableBody>
      </Table>
    )
}

export function ScheduleDataSummaryDialog({ 
    open, 
    onOpenChange, 
    savedSchedules,
    collaborators,
    days,
    currentDate,
    periodTitle,
    holidays,
    overtimeRules,
    transfers,
    roleChanges,
    onPrevPeriod,
    onNextPeriod,
    locationOptions,
    jobTitleOptions,
    selectedLocation: periodLocation,
    onLocationChange: onPeriodLocationChange,
    selectedJobTitle: periodJobTitle,
    onJobTitleChange: onPeriodJobTitleChange,
}: ScheduleDataSummaryDialogProps) {

  const [viewMode, setViewMode] = React.useState<'period' | 'annual'>('period');
  const [annualLocation, setAnnualLocation] = React.useState('todos');
  const [annualJobTitle, setAnnualJobTitle] = React.useState('todos');

  const periodIdentifier = React.useMemo(() => format(currentDate, 'yyyy-MM'), [currentDate]);
  const yearTitle = React.useMemo(() => format(currentDate, 'yyyy'), [currentDate]);

  React.useEffect(() => {
    if (open) {
      setViewMode('period');
      setAnnualLocation('todos');
      setAnnualJobTitle('todos');
    }
  }, [open]);

  const { groupedData: periodGroupedData, uniqueShifts: periodUniqueShifts } = React.useMemo(() => {
    if (collaborators.length === 0 || days.length === 0) {
      return { groupedData: [], uniqueShifts: [] };
    }

    const periodSchedules = Object.values(savedSchedules).filter(s => s.id.startsWith(periodIdentifier));
    
    const relevantSchedules = periodSchedules.filter(s => 
        (periodLocation === 'todos' || s.location === periodLocation) &&
        (periodJobTitle === 'todos' || s.jobTitle === periodJobTitle)
    );

    const relevantCollaboratorIds = new Set<string>();
    relevantSchedules.forEach(s => {
        Object.keys(s.schedule).forEach(id => relevantCollaboratorIds.add(id));
    });

    const unifiedSchedule = new Map<string, Map<string, string | null>>();
    relevantSchedules.forEach(s => {
        Object.entries(s.schedule).forEach(([collabId, dayMap]) => {
            if (!unifiedSchedule.has(collabId)) unifiedSchedule.set(collabId, new Map());
            const userSchedule = unifiedSchedule.get(collabId)!;
            Object.entries(dayMap).forEach(([dayKey, shift]) => userSchedule.set(dayKey, shift));
        });
    });

    const relevantCollaborators = collaborators.filter(c => relevantCollaboratorIds.has(c.id));

    return calculateScheduleSummary(relevantCollaborators, unifiedSchedule, days, holidays, overtimeRules, transfers, roleChanges);
  }, [periodIdentifier, periodLocation, periodJobTitle, savedSchedules, collaborators, days, holidays, overtimeRules, transfers, roleChanges]);


  const { groupedData: annualGroupedData, uniqueShifts: annualUniqueShifts } = React.useMemo(() => {
    if (collaborators.length === 0) {
        return { groupedData: [], uniqueShifts: [] };
    }

    const currentYear = format(currentDate, 'yyyy');
    
    const yearSchedules = Object.values(savedSchedules).filter(s => s.id.startsWith(currentYear));

    const annualData = new Map<string, SummaryData>();

    yearSchedules.forEach(periodSchedule => {
        const periodId = periodSchedule.id.split('_')[0];
        const [year, month] = periodId.split('-').map(Number);
        if (!year || !month) return;

        const periodDate = set(new Date(), { year, month: month - 1, date: 1 });
        const prevMonthForPeriod = subMonths(periodDate, 1);
        const start = new Date(prevMonthForPeriod.getFullYear(), prevMonthForPeriod.getMonth(), 21);
        const end = new Date(periodDate.getFullYear(), periodDate.getMonth(), 20);
        const periodDays = eachDayOfInterval({ start, end });

        if (periodDays.length === 0) return;

        const periodScheduleMap = new Map<string, Map<string, string | null>>();
        Object.entries(periodSchedule.schedule).forEach(([collabId, dayMap]) => {
            periodScheduleMap.set(collabId, new Map(Object.entries(dayMap)));
        });

        const periodCollaborators = collaborators.filter(c => Object.keys(periodSchedule.schedule).includes(c.id));
        
        if (periodCollaborators.length === 0) return;

        const periodSummary = calculateScheduleSummary(periodCollaborators, periodScheduleMap, periodDays, holidays, overtimeRules, transfers, roleChanges);

        periodSummary.groupedData.forEach(group => {
            group.employees.forEach(employee => {
                if (!annualData.has(employee.id)) {
                    annualData.set(employee.id, {
                        id: employee.id, name: employee.name, jobTitle: employee.jobTitle,
                        shiftCounts: new Map(),
                        freeDaysByWeekday: new Array(7).fill(0),
                        extraHours: { he25: 0, he50: 0, he100: 0 },
                        compensationHours: 0,
                        compensationDetails: []
                    });
                }
                const summary = annualData.get(employee.id)!;
                employee.shiftCounts.forEach((count, shift) => summary.shiftCounts.set(shift, (summary.shiftCounts.get(shift) || 0) + count));
                employee.freeDaysByWeekday.forEach((count, i) => summary.freeDaysByWeekday[i] += count);
                summary.extraHours.he25 += employee.extraHours.he25;
                summary.extraHours.he50 += employee.extraHours.he50;
                summary.extraHours.he100 += employee.extraHours.he100;
                summary.compensationHours += employee.compensationHours;
                summary.compensationDetails.push(...employee.compensationDetails);
            });
        });
    });
    
    let collaboratorData = Array.from(annualData.values());
    const fullCollaboratorMap = new Map(collaborators.map(c => [c.id, c]));
        
    collaboratorData = collaboratorData.filter(summary => {
        const collaborator = fullCollaboratorMap.get(summary.id);
        if (!collaborator) return false;

        const locationMatch = annualLocation === 'todos' || collaborator.originalLocation === annualLocation;
        const jobTitleMatch = annualJobTitle === 'todos' || summary.jobTitle === annualJobTitle;
        
        return locationMatch && jobTitleMatch;
    });
    
    const grouped = collaboratorData.reduce((acc, data) => {
        let group = acc.find(g => g.jobTitle === data.jobTitle);
        if (!group) {
            group = { jobTitle: data.jobTitle, employees: [] };
            acc.push(group);
        }
        group.employees.push(data);
        return acc;
    }, [] as { jobTitle: string, employees: typeof collaboratorData }[]);
    
    grouped.sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));
    grouped.forEach(group => group.employees.sort((a,b) => a.name.localeCompare(b.name)));

    const allShifts = new Set(collaboratorData.flatMap(d => Array.from(d.shiftCounts.keys())));
    const sortedShifts = ['M8', 'T8', 'N8', 'D12', 'N12', 'TA', 'T24', 'D10', 'D9'].filter(s => allShifts.has(s));

    return { groupedData: grouped, uniqueShifts: sortedShifts };

  }, [currentDate, savedSchedules, annualLocation, annualJobTitle, collaborators, holidays, overtimeRules, transfers, roleChanges]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cuadro Resumen de Horarios</DialogTitle>
          <DialogDescription>
             Este resumen muestra el total de turnos y días libres por colaborador para el período seleccionado.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'period' | 'annual')} className="flex flex-col flex-grow min-h-0">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
                <TabsList>
                    <TabsTrigger value="period">Resumen del Período</TabsTrigger>
                    <TabsTrigger value="annual">Resumen Anual</TabsTrigger>
                </TabsList>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="grid w-full items-center gap-1.5">
                    <Label>Ubicación</Label>
                    <Combobox
                        options={locationOptions}
                        value={viewMode === 'period' ? periodLocation : annualLocation}
                        onChange={viewMode === 'period' ? onPeriodLocationChange : setAnnualLocation}
                        placeholder="Filtrar por ubicación..."
                        searchPlaceholder="Buscar ubicación..."
                        notFoundMessage="No se encontró la ubicación."
                    />
                </div>
                <div className="grid w-full items-center gap-1.5">
                    <Label>Cargo</Label>
                     <Combobox
                        options={jobTitleOptions}
                        value={viewMode === 'period' ? periodJobTitle : annualJobTitle}
                        onChange={viewMode === 'period' ? onPeriodJobTitleChange : setAnnualJobTitle}
                        placeholder="Filtrar por cargo..."
                        searchPlaceholder="Buscar cargo..."
                        notFoundMessage="No se encontró el cargo."
                    />
                </div>
            </div>
            
            <div className="flex-grow min-h-0 pt-4">
                <TabsContent value="period" className="m-0 h-full flex flex-col">
                    <div className="flex items-center justify-center gap-2 mb-4 flex-shrink-0">
                        <Button variant="outline" size="icon" onClick={onPrevPeriod} aria-label="Periodo anterior">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold text-center w-64 text-sm">{periodTitle}</span>
                        <Button variant="outline" size="icon" onClick={onNextPeriod} aria-label="Periodo siguiente">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <ScrollArea className="flex-grow">
                        <TooltipProvider>
                          <SummaryTable groupedData={periodGroupedData} uniqueShifts={periodUniqueShifts} />
                        </TooltipProvider>
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="annual" className="m-0 h-full flex flex-col">
                   <div className="flex items-center justify-center gap-2 mb-4 flex-shrink-0">
                        <span className="font-semibold text-center w-64 text-sm">Resumen del Año {yearTitle}</span>
                    </div>
                   <ScrollArea className="flex-grow">
                        <TooltipProvider>
                          <SummaryTable groupedData={annualGroupedData} uniqueShifts={annualUniqueShifts} />
                        </TooltipProvider>
                    </ScrollArea>
                </TabsContent>
            </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
