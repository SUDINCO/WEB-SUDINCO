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
import { format, getDay, isWithinInterval, parseISO, subMonths, eachDayOfInterval, startOfYear, endOfYear, set, startOfMonth, endOfMonth, isSaturday, isSunday } from 'date-fns';
import type { Collaborator, Holiday, OvertimeRule, RoleChange, SavedSchedule, TemporaryTransfer, ShiftPattern } from '@/lib/types';
import { getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { getEffectiveDetails } from '@/lib/schedule-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { normalizeText } from '@/lib/utils';
import { calculateScheduleSummary } from '@/lib/schedule-generator';


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
  shiftPatterns: ShiftPattern[];
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
                  <TableHead className="p-1 text-center w-24 border-x">Recargo Noct. (25%)</TableHead>
                  <TableHead className="p-1 text-center w-24 border-x">H. Suplem. (50%)</TableHead>
                  <TableHead className="p-1 text-center w-24 border-x">H. Extraord. (100%)</TableHead>
                  <TableHead className="p-1 text-center w-24 border-x">H. Comp.</TableHead>
                  <TableHead className="p-1 text-center w-24 border-x">Multas (%)</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
              {groupedData.length > 0 ? (
                  groupedData.map(group => (
                      <React.Fragment key={group.jobTitle}>
                          <TableRow className="bg-primary/10 hover:bg-primary/10">
                              <TableCell colSpan={uniqueShifts.length + 14} className="font-bold text-center text-primary p-1 sticky left-0 bg-primary/10 z-10">
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
    shiftPatterns,
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
    if (open && viewMode === 'annual') {
      setAnnualLocation('todos');
      setAnnualJobTitle('todos');
    }
  }, [open, viewMode]);

  const { groupedData: periodGroupedData, uniqueShifts: periodUniqueShifts } = React.useMemo(() => {
    if (collaborators.length === 0 || days.length === 0 || Object.keys(savedSchedules).length === 0) {
      return { groupedData: [], uniqueShifts: [] };
    }

    const periodSchedules = Object.values(savedSchedules).filter(s => s.id.startsWith(periodIdentifier));
    if (periodSchedules.length === 0) {
      return { groupedData: [], uniqueShifts: [] };
    }

    const allPeriodCollaboratorIds = new Set<string>();
    const unifiedSchedule = new Map<string, Map<string, string | null>>();

    periodSchedules.forEach(s => {
      Object.entries(s.schedule).forEach(([collabId, dayMap]) => {
        allPeriodCollaboratorIds.add(collabId);
        if (!unifiedSchedule.has(collabId)) {
          unifiedSchedule.set(collabId, new Map(Object.entries(dayMap)));
        } else {
          const existingMap = unifiedSchedule.get(collabId)!;
          Object.entries(dayMap).forEach(([dayKey, shift]) => {
            existingMap.set(dayKey, shift);
          });
        }
      });
    });

    const allPeriodCollaborators = collaborators.filter(c => allPeriodCollaboratorIds.has(c.id));
    if (allPeriodCollaborators.length === 0) {
      return { groupedData: [], uniqueShifts: [] };
    }
    
    const { groupedData: allGroupedData, uniqueShifts } = calculateScheduleSummary(
        allPeriodCollaborators, unifiedSchedule, days, holidays, overtimeRules, transfers, roleChanges
    );

    if (periodLocation === 'todos' && periodJobTitle === 'todos') {
      return { groupedData: allGroupedData, uniqueShifts };
    }
    
    const fullCollaboratorMap = new Map(collaborators.map(c => [c.id, c]));

    const filteredGroupedData = allGroupedData
      .map(group => {
        const filteredEmployees = group.employees.filter(employee => {
          const collaborator = fullCollaboratorMap.get(employee.id);
          if (!collaborator) return false;
          
          const locationMatch = periodLocation === 'todos' || collaborator.originalLocation === periodLocation;
          const jobTitleMatch = periodJobTitle === 'todos' || employee.jobTitle === periodJobTitle;

          return locationMatch && jobTitleMatch;
        });

        return { ...group, employees: filteredEmployees };
      })
      .filter(group => group.employees.length > 0);

    return { groupedData: filteredGroupedData, uniqueShifts };

  }, [periodIdentifier, periodLocation, periodJobTitle, savedSchedules, collaborators, days, holidays, overtimeRules, transfers, roleChanges]);


  const { groupedData: annualGroupedData, uniqueShifts: annualUniqueShifts } = React.useMemo(() => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const allYearDays = eachDayOfInterval({ start: yearStart, end: yearEnd });

    if (collaborators.length === 0 || allYearDays.length === 0 || !shiftPatterns) {
        return { groupedData: [], uniqueShifts: [] };
    }

    const fullYearSchedule = new Map<string, Map<string, string | null>>();
    const shiftPatternsByCargo = new Map(shiftPatterns.map(p => [normalizeText(p.jobTitle), p]));
    
    collaborators.forEach(collaborator => {
        const collabYearSchedule = new Map<string, string | null>();
        
        allYearDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            
            const periodDate = day.getDate() < 21 ? subMonths(day, 1) : day;
            const periodId = format(periodDate, 'yyyy-MM');

            const { location: effectiveLocation, jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, transfers, roleChanges);
            const savedScheduleKey = `${periodId}_${normalizeText(effectiveLocation)}_${normalizeText(effectiveJobTitle)}`;
            
            const savedScheduleData = savedSchedules[savedScheduleKey];
            
            let shift: string | null | undefined = undefined;

            if (savedScheduleData && savedScheduleData.schedule[collaborator.id]) {
                shift = savedScheduleData.schedule[collaborator.id][dayKey];
            }
            
            if (shift === undefined) {
                if (!shiftPatternsByCargo.has(normalizeText(collaborator.originalJobTitle))) {
                     shift = isSaturday(day) || isSunday(day) ? null : 'N9';
                } else {
                    shift = null;
                }
            }
            
            collabYearSchedule.set(dayKey, shift ?? null);
        });

        fullYearSchedule.set(collaborator.id, collabYearSchedule);
    });

    const { groupedData, uniqueShifts } = calculateScheduleSummary(
        collaborators, fullYearSchedule, allYearDays, holidays, overtimeRules, transfers, roleChanges
    );

    if (annualLocation === 'todos' && annualJobTitle === 'todos') {
      return { groupedData, uniqueShifts };
    }
    
    const fullCollaboratorMap = new Map(collaborators.map(c => [c.id, c]));

    const filteredGroupedData = groupedData.map(group => {
        const filteredEmployees = group.employees.filter(employee => {
          const collaborator = fullCollaboratorMap.get(employee.id);
          if (!collaborator) return false;
          
          const locationMatch = annualLocation === 'todos' || collaborator.originalLocation === annualLocation;
          const jobTitleMatch = annualJobTitle === 'todos' || collaborator.originalJobTitle === annualJobTitle;

          return locationMatch && jobTitleMatch;
        });

        return { ...group, employees: filteredEmployees };
      })
      .filter(group => group.employees.length > 0);
      
    return { groupedData: filteredGroupedData, uniqueShifts };

}, [currentDate, savedSchedules, collaborators, holidays, overtimeRules, transfers, roleChanges, annualLocation, annualJobTitle, shiftPatterns]);


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
                 <div className="flex items-center justify-center gap-2">
                    {viewMode === 'period' ? (
                        <>
                         <Button variant="outline" size="icon" onClick={onPrevPeriod} aria-label="Periodo anterior">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold text-center w-64 text-sm">{periodTitle}</span>
                        <Button variant="outline" size="icon" onClick={onNextPeriod} aria-label="Periodo siguiente">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        </>
                    ) : (
                         <span className="font-semibold text-center w-64 text-sm">Resumen del Año {yearTitle}</span>
                    )}
                </div>
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
                <TabsContent value="period" className="m-0 h-full overflow-y-auto">
                    <TooltipProvider>
                      <SummaryTable groupedData={periodGroupedData} uniqueShifts={periodUniqueShifts} />
                    </TooltipProvider>
                </TabsContent>
                <TabsContent value="annual" className="m-0 h-full overflow-y-auto">
                   <TooltipProvider>
                      <SummaryTable groupedData={annualGroupedData} uniqueShifts={annualUniqueShifts} />
                    </TooltipProvider>
                </TabsContent>
            </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
