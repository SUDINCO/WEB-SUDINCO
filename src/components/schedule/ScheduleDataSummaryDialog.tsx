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
import { format, getDay } from 'date-fns';
import type { Collaborator, Holiday, OvertimeRule, RoleChange, TemporaryTransfer } from '@/lib/types';
import { generateAttendanceRecords, getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { getEffectiveDetails } from '@/lib/schedule-utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';

// This is the option type for the combobox
type Option = {
  value: string;
  label: string;
  isSaved?: boolean;
};

interface ScheduleDataSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Map<string, Map<string, string | null>>;
  collaborators: Collaborator[];
  days: Date[];
  periodTitle: string;
  holidays: Holiday[];
  overtimeRules: OvertimeRule[];
  transfers: TemporaryTransfer[];
  roleChanges: RoleChange[];
  // New props for navigation and filtering
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  locationOptions: Option[];
  jobTitleOptions: Option[];
  selectedLocation: string;
  onLocationChange: (value: string) => void;
  selectedJobTitle: string;
  onJobTitleChange: (value: string) => void;
}

export function ScheduleDataSummaryDialog({ 
    open, 
    onOpenChange, 
    schedule,
    collaborators,
    days,
    periodTitle,
    holidays,
    overtimeRules,
    transfers,
    roleChanges,
    onPrevPeriod,
    onNextPeriod,
    locationOptions,
    jobTitleOptions,
    selectedLocation,
    onLocationChange,
    selectedJobTitle,
    onJobTitleChange,
}: ScheduleDataSummaryDialogProps) {

  const [viewMode, setViewMode] = React.useState<'period' | 'annual'>('period');

  const { groupedData, uniqueShifts } = React.useMemo(() => {
    if (!schedule || collaborators.length === 0 || days.length === 0) {
      return { groupedData: [], uniqueShifts: [] };
    }

    const attendanceRecords = generateAttendanceRecords(
        collaborators,
        days,
        schedule,
        holidays,
        overtimeRules
    );

    const collaboratorData = collaborators.map(collaborator => {
        const collaboratorSchedule = schedule.get(collaborator.id);
        if (!collaboratorSchedule) return null;

        const shiftCounts = new Map<string, number>();
        const freeDaysByWeekday = new Array(7).fill(0);
        let workedDayKeys: string[] = [];
        
        days.forEach(day => {
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
                    const { jobTitle } = getEffectiveDetails(collaborator, day, transfers, roleChanges);
                    const shiftDetails = getShiftDetailsFromRules(shift, jobTitle, overtimeRules);
                    if (shiftDetails) {
                        compensationHours += shiftDetails.hours;
                        compensationDetails.push({ day, shift });
                    }
                }
            });
        }
        
        const extraHours = finalWorkedDayKeys.reduce((acc, dayKey) => {
            const attendanceRecord = attendanceRecords.get(`${dayKey}-${collaborator.id}`);
            if (attendanceRecord) {
                acc.he25 += attendanceRecord.extraHours25 || 0;
                acc.he50 += attendanceRecord.extraHours50 || 0;
                acc.he100 += attendanceRecord.extraHours100 || 0;
            }
            return acc;
        }, { he25: 0, he50: 0, he100: 0 });

        return {
            id: collaborator.id,
            name: collaborator.name,
            jobTitle: getEffectiveDetails(collaborator, days[0], transfers, roleChanges).jobTitle,
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
  }, [schedule, collaborators, days, holidays, overtimeRules, transfers, roleChanges]);

  const weekDaysLabels = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cuadro Resumen de Horarios</DialogTitle>
          <DialogDescription>
             Este resumen muestra el total de turnos y días libres por colaborador para el período seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-y py-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'period' | 'annual')}>
                <TabsList>
                    <TabsTrigger value="period">Resumen del Período</TabsTrigger>
                    <TabsTrigger value="annual">Resumen Anual</TabsTrigger>
                </TabsList>
            </Tabs>
            
            {viewMode === 'period' && (
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={onPrevPeriod} aria-label="Periodo anterior">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-center w-64 text-sm">{periodTitle}</span>
                    <Button variant="outline" size="icon" onClick={onNextPeriod} aria-label="Periodo siguiente">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="grid w-full items-center gap-1.5">
                <Label>Ubicación</Label>
                <Combobox
                    options={locationOptions}
                    value={selectedLocation}
                    onChange={onLocationChange}
                    placeholder="Filtrar por ubicación..."
                    searchPlaceholder="Buscar ubicación..."
                    notFoundMessage="No se encontró la ubicación."
                />
            </div>
            <div className="grid w-full items-center gap-1.5">
                <Label>Cargo</Label>
                <Combobox
                    options={jobTitleOptions}
                    value={selectedJobTitle}
                    onChange={onJobTitleChange}
                    placeholder="Filtrar por cargo..."
                    searchPlaceholder="Buscar cargo..."
                    notFoundMessage="No se encontró el cargo."
                />
            </div>
        </div>
        
        <div className="flex-grow min-h-0">
            <TabsContent value="period" className="m-0 h-full">
                <ScrollArea className="h-full">
                    <TooltipProvider>
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
                                        {group.employees.map(employee => {
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
                                        No hay datos para mostrar con los filtros seleccionados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    </TooltipProvider>
                </ScrollArea>
            </TabsContent>
            <TabsContent value="annual">
                <div className="h-full flex items-center justify-center text-muted-foreground">
                    <p>El resumen anual estará disponible en una futura actualización.</p>
                </div>
            </TabsContent>
        </div>
      </DialogContent>
    </Dialog>
  );
}
