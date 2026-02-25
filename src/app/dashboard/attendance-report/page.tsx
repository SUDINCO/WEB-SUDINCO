
'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format, isSameDay, isWithinInterval, set, isAfter, addMonths, isSaturday, isSunday, differenceInMinutes, subMonths, eachDayOfInterval, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import {
  CalendarIcon, Download, LoaderCircle,
} from 'lucide-react';
import type { UserProfile, SavedSchedule, AttendanceRecord, OvertimeRule, GenericOption, ShiftPattern, Holiday } from '@/lib/types';
import { getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { normalizeText } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { DateRange } from 'react-day-picker';
import { toast } from '@/hooks/use-toast';


type DailySummaryRow = {
    collaborator: UserProfile;
    scheduledShift: string | null;
    status: 'Completo' | 'Incompleto' | 'Falta';
    extraHours: { he25: number; he50: number; he100: number; };
}

type PeriodSummaryRow = {
    collaborator: UserProfile;
    dLab: number; lib: number; vac: number; pm: number; lic: number;
    sus: number; ret: number; fi: number; he25: number; he50: number;
    he100: number;
};

function findScheduledShift(collaborator: UserProfile, date: Date, savedSchedules: SavedSchedule[], shiftPatterns: ShiftPattern[]): string | null {
    const dayKey = format(date, 'yyyy-MM-dd');
    const periodDate = date.getDate() < 21 ? date : addMonths(date, 1);
    const periodIdentifier = format(periodDate, 'yyyy-MM');

    const relevantSchedules = savedSchedules.filter(s => s.id.startsWith(periodIdentifier));

    for (const scheduleDoc of relevantSchedules) {
        if (scheduleDoc.schedule[collaborator.id]?.[dayKey] !== undefined) {
            return scheduleDoc.schedule[collaborator.id][dayKey];
        }
    }
    
    const shiftPattern = shiftPatterns.find(p => normalizeText(p.jobTitle) === normalizeText(collaborator.cargo));
    if (shiftPattern?.scheduleType === 'MONDAY_TO_FRIDAY') {
        return (isSaturday(date) || isSunday(date)) ? null : (shiftPattern.cycle[0] || 'D12');
    }
    
    if (!shiftPattern) {
        const isWeekend = isSaturday(date) || isSunday(date);
        return isWeekend ? null : 'N9';
    }

    return null; 
};


function AttendanceReportPage() {
    const firestore = useFirestore();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('vista-diaria');
    const [filters, setFilters] = useState({ ubicacion: 'todos', cargo: 'todos', colaborador: 'todos' });

    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>();

    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: savedSchedules, isLoading: schedulesLoading } = useCollection<SavedSchedule>(useMemo(() => firestore ? collection(firestore, 'savedSchedules') : null, [firestore]));
    const { data: attendanceRecordsData, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(useMemo(() => firestore ? collection(firestore, 'attendance') : null, [firestore]));
    const { data: overtimeRules, isLoading: rulesLoading } = useCollection<OvertimeRule>(useMemo(() => firestore ? collection(firestore, 'overtimeRules') : null, [firestore]));
    const { data: ubicaciones, isLoading: ubicacionesLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'ubicaciones') : null, [firestore]));
    const { data: cargos, isLoading: cargosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
    const { data: shiftPatterns, isLoading: patternsLoading } = useCollection<ShiftPattern>(useMemo(() => firestore ? collection(firestore, 'shiftPatterns') : null, [firestore]));
    const { data: holidaysData, isLoading: holidaysLoading } = useCollection<Holiday>(useMemo(() => firestore ? collection(firestore, 'holidays') : null, [firestore]));
    
    const isLoading = usersLoading || schedulesLoading || attendanceLoading || rulesLoading || ubicacionesLoading || cargosLoading || patternsLoading || holidaysLoading;
    
    const holidays = useMemo(() => {
        if (!holidaysData) return [];
        return holidaysData.map(h => ({
            ...h,
            startDate: new Date(`${h.startDate}T00:00:00Z`),
            endDate: new Date(`${h.endDate}T23:59:59Z`),
        }));
    }, [holidaysData]);

    const attendanceRecords = useMemo(() => {
        if (!attendanceRecordsData) return [];
        return attendanceRecordsData.map(rec => ({
            ...rec,
            date: rec.date && (rec.date as any).toDate ? (rec.date as any).toDate() : null,
            entryTime: rec.entryTime && (rec.entryTime as any).toDate ? (rec.entryTime as any).toDate() : null,
            exitTime: rec.exitTime && (rec.exitTime as any).toDate ? (rec.exitTime as any).toDate() : null,
        }));
    }, [attendanceRecordsData]);

    const calculateDailySummaryForDay = (date: Date): DailySummaryRow[] => {
        if (isLoading || !users || !attendanceRecords || !overtimeRules || !savedSchedules || !shiftPatterns || !holidays) return [];
    
        const activeUsers = users.filter(u => u.Status === 'active');
        const dayIsHoliday = holidays.some(h => isWithinInterval(date, { start: h.startDate, end: h.endDate }));
        const jornada = dayIsHoliday ? "FESTIVO" : "NORMAL";
        const summaryRows: DailySummaryRow[] = [];
    
        activeUsers.forEach(collaborator => {
            if (
                (filters.ubicacion !== 'todos' && normalizeText(collaborator.ubicacion) !== normalizeText(filters.ubicacion)) ||
                (filters.cargo !== 'todos' && normalizeText(collaborator.cargo) !== normalizeText(filters.cargo)) ||
                (filters.colaborador !== 'todos' && collaborator.id !== filters.colaborador)
            ) return;
    
            const record = attendanceRecords.find(ar => ar.collaboratorId === collaborator.id && ar.date && isSameDay(ar.date, date));
            const scheduledShift = findScheduledShift(collaborator, date, savedSchedules, shiftPatterns);
    
            let status: 'Completo' | 'Incompleto' | 'Falta' = 'Falta';
            if (!scheduledShift || scheduledShift === 'LIB') return;
    
            if (record && record.entryTime && record.exitTime) {
                const shiftDetails = getShiftDetailsFromRules(scheduledShift, collaborator.cargo, jornada, overtimeRules);
                status = (shiftDetails && differenceInMinutes(record.exitTime, record.entryTime) >= shiftDetails.hours * 60 - 5) ? 'Completo' : 'Incompleto';
            } else if (record && record.entryTime) {
                status = 'Incompleto';
            }
            
            const extraHours = { he25: 0, he50: 0, he100: 0 };
            if (status === 'Completo' && scheduledShift && record?.entryTime && record?.exitTime) {
                 const rule = overtimeRules.find(r => normalizeText(r.jobTitle) === normalizeText(collaborator.cargo) && r.shift === scheduledShift && r.dayType === jornada);
                if (rule) {
                    extraHours.he25 = rule.nightSurcharge || 0;
                    extraHours.he50 = rule.sup50 || 0;
                    extraHours.he100 = rule.ext100 || 0;
                }
            }
            summaryRows.push({ collaborator, scheduledShift, status, extraHours });
        });
        return summaryRows;
    };

    const dailySummaryData = useMemo(() => calculateDailySummaryForDay(selectedDate), 
      [selectedDate, filters, isLoading, users, attendanceRecords, overtimeRules, savedSchedules, shiftPatterns, holidays]
    );
    
    const { days: periodDays, monthName: periodMonthName } = useMemo(() => {
        const referenceDate = selectedDate.getDate() < 21 ? selectedDate : addMonths(selectedDate, 1);
        const prevMonth = subMonths(referenceDate, 1);
        const start = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 21);
        const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 20);
        const days = eachDayOfInterval({ start, end });
        const monthName = `${format(start, 'MMMM', { locale: es })} / ${format(end, 'MMMM yyyy', { locale: es })}`;
        return { days, monthName };
    }, [selectedDate]);

    const periodSummaryData = useMemo((): PeriodSummaryRow[] => {
        if (isLoading || !users || !savedSchedules || !shiftPatterns || !overtimeRules || !holidays || !attendanceRecords) return [];

        const filteredUsers = users.filter(u => 
            u.Status === 'active' &&
            (filters.ubicacion === 'todos' || normalizeText(u.ubicacion) === normalizeText(filters.ubicacion)) &&
            (filters.cargo === 'todos' || normalizeText(u.cargo) === normalizeText(filters.cargo)) &&
            (filters.colaborador === 'todos' || u.id === filters.colaborador)
        );

        return filteredUsers.map(collaborator => {
            const summary: Omit<PeriodSummaryRow, 'collaborator'> = {
                dLab: 0, lib: 0, vac: 0, pm: 0, lic: 0, sus: 0, ret: 0, fi: 0,
                he25: 0, he50: 0, he100: 0
            };

            const collaboratorRecords = attendanceRecords.filter(r => r.collaboratorId === collaborator.id);
            const workedDayKeys: string[] = [];

            periodDays.forEach(day => {
                const scheduledShift = findScheduledShift(collaborator, day, savedSchedules, shiftPatterns);
                const dayKey = format(day, 'yyyy-MM-dd');
                const record = collaboratorRecords.find(r => r.date && isSameDay(r.date, day));

                if (scheduledShift && !['LIB', 'VAC', 'PM', 'LIC', 'SUS', 'RET', 'FI'].includes(scheduledShift)) {
                     const dayIsHoliday = holidays.some(h => isWithinInterval(day, { start: h.startDate, end: h.endDate }));
                    const jornada = dayIsHoliday ? "FESTIVO" : "NORMAL";
                    const shiftDetails = getShiftDetailsFromRules(scheduledShift, collaborator.cargo, jornada, overtimeRules);

                    if (record && record.entryTime && record.exitTime && shiftDetails) {
                        const workedMinutes = differenceInMinutes(record.exitTime, record.entryTime);
                        if (workedMinutes >= (shiftDetails.hours * 60) - 5) {
                            summary.dLab++;
                            workedDayKeys.push(dayKey);
                            const rule = overtimeRules.find(r => 
                                normalizeText(r.jobTitle) === normalizeText(collaborator.cargo) && 
                                r.shift === scheduledShift && 
                                r.dayType === jornada
                            );
                            if (rule) {
                                summary.he25 += rule.nightSurcharge || 0;
                                summary.he50 += rule.sup50 || 0;
                                summary.he100 += rule.ext100 || 0;
                            }
                        } else {
                            summary.fi++; // Incomplete shift is also an unjustified absence for this summary
                        }
                    } else {
                        summary.fi++;
                    }
                } else if (scheduledShift === 'LIB' || scheduledShift === null) {
                    summary.lib++;
                } else if (scheduledShift === 'VAC') {
                    summary.vac++;
                } else if (scheduledShift === 'PM') {
                    summary.pm++;
                } else if (scheduledShift === 'LIC') {
                    summary.lic++;
                } else if (scheduledShift === 'SUS') {
                    summary.sus++;
                } else if (scheduledShift === 'RET') {
                    summary.ret++;
                } else if (scheduledShift === 'FI') {
                    summary.fi++;
                }
            });
            
            return { collaborator, ...summary };
        }).filter(item => item.dLab > 0 || item.lib > 0 || item.vac > 0 || item.pm > 0 || item.lic > 0 || item.sus > 0 || item.ret > 0 || item.fi > 0);
    }, [isLoading, users, filters, savedSchedules, shiftPatterns, overtimeRules, holidays, attendanceRecords, periodDays]);


    const handleFilterChange = (filterName: 'ubicacion' | 'cargo' | 'colaborador', value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const ubicacionOptions = useMemo(() => [{ value: 'todos', label: 'Todas las ubicaciones' }, ...(ubicaciones || []).map(o => ({ value: o.name, label: o.name }))], [ubicaciones]);
    const cargoOptions = useMemo(() => [{ value: 'todos', label: 'Todos los cargos' }, ...(cargos || []).map(o => ({ value: o.name, label: o.name }))], [cargos]);
    const colaboradorOptions = useMemo(() => [{ value: 'todos', label: 'Todos los colaboradores' }, ...(users || []).map(u => ({ value: u.id, label: `${u.nombres} ${u.apellidos}` }))], [users]);

    const handleExport = (range?: DateRange) => {
        let dataToExport;
        let sheetName;

        if (activeTab === 'vista-diaria') {
            if (!range?.from || !range.to) {
                toast({ variant: 'destructive', title: 'Rango requerido', description: 'Por favor, selecciona un rango de fechas para exportar la vista diaria.' });
                return;
            }
            
            const daysInRange = eachDayOfInterval({ start: range.from, end: range.to });
            const multiDayData: any[] = [];
            
            daysInRange.forEach(day => {
                const dailyData = calculateDailySummaryForDay(day);
                dailyData.forEach(item => {
                    multiDayData.push({
                        'Fecha': format(day, 'yyyy-MM-dd'),
                        'Colaborador': `${item.collaborator.nombres} ${item.collaborator.apellidos}`,
                        'Cargo': item.collaborator.cargo,
                        'Turno': item.scheduledShift || 'N/A',
                        'Estado': item.status,
                        'H.E. 25%': item.extraHours.he25,
                        'H.E. 50%': item.extraHours.he50,
                        'H.E. 100%': item.extraHours.he100,
                    });
                });
            });
            dataToExport = multiDayData;
            sheetName = `Resumen_Diario_${format(range.from, 'yyyy-MM-dd')}_a_${format(range.to, 'yyyy-MM-dd')}`;
        } else { // resumen-periodo
            dataToExport = periodSummaryData.map(item => ({
                'Código': item.collaborator.codigo,
                'Cédula': item.collaborator.cedula,
                'Cargo': item.collaborator.cargo,
                'Apellido': item.collaborator.apellidos,
                'Nombre': item.collaborator.nombres,
                'D.LAB': item.dLab,
                'LIB': item.lib,
                'VAC': item.vac,
                'PM': item.pm,
                'LIC': item.lic,
                'SUS': item.sus,
                'RET': item.ret,
                'FI': item.fi,
                'H.E. 25%': item.he25,
                'H.E. 50%': item.he50,
                'H.E. 100%': item.he100,
            }));
            sheetName = `Resumen_Periodo_${periodDays.length > 0 ? format(periodDays[0], 'yyyy-MM') : ''}`;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `Resumen_Asistencia.xlsx`);
        setIsExportDialogOpen(false);
    };

    return (
        <div className="space-y-6">
             <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Seleccionar Rango de Fechas para Exportar</DialogTitle>
                        <DialogDescription>
                            {activeTab === 'vista-diaria' 
                                ? "Selecciona un rango para exportar el reporte diario."
                                : "Para el resumen del período, se exportarán los datos del período actual mostrado en la tabla. No se necesita un rango de fechas."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    {activeTab === 'vista-diaria' && (
                        <div className="py-4 flex justify-center">
                            <Calendar
                                mode="range"
                                selected={exportDateRange}
                                onSelect={setExportDateRange}
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleExport(exportDateRange)}>Confirmar y Descargar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <h1 className="text-lg font-semibold md:text-2xl">Resumen de Asistencia</h1>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Análisis de Asistencia</CardTitle>
                            <CardDescription>
                                Detalle de asistencia para el día seleccionado y resumen para el período correspondiente ({periodMonthName}).
                            </CardDescription>
                        </div>
                        <Button onClick={() => setIsExportDialogOpen(true)}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="resumen-periodo">Resumen del Período</TabsTrigger>
                            <TabsTrigger value="vista-diaria">Vista Diaria</TabsTrigger>
                        </TabsList>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                            <Combobox options={ubicacionOptions} value={filters.ubicacion} onChange={(v) => handleFilterChange('ubicacion', v)} placeholder="Filtrar por ubicación..." />
                            <Combobox options={cargoOptions} value={filters.cargo} onChange={(v) => handleFilterChange('cargo', v)} placeholder="Filtrar por cargo..." />
                            <Combobox options={colaboradorOptions} value={filters.colaborador} onChange={(v) => handleFilterChange('colaborador', v)} placeholder="Filtrar por colaborador..." />
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(selectedDate, 'dd/MM/yyyy')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <TabsContent value="vista-diaria" className="mt-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Colaborador</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead>Turno</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>H.E. 25%</TableHead>
                                        <TableHead>H.E. 50%</TableHead>
                                        <TableHead>H.E. 100%</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                    ) : dailySummaryData.length > 0 ? dailySummaryData.map(item => (
                                        <TableRow key={item.collaborator.id}>
                                            <TableCell>{`${item.collaborator.nombres} ${item.collaborator.apellidos}`}</TableCell>
                                            <TableCell>{item.collaborator.cargo}</TableCell>
                                            <TableCell>{item.scheduledShift || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    item.status === 'Completo' ? 'default' : 
                                                    item.status === 'Incompleto' ? 'secondary' : 
                                                    'destructive'
                                                }>
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{item.extraHours.he25 > 0 ? item.extraHours.he25.toFixed(2) : ''}</TableCell>
                                            <TableCell>{item.extraHours.he50 > 0 ? item.extraHours.he50.toFixed(2) : ''}</TableCell>
                                            <TableCell>{item.extraHours.he100 > 0 ? item.extraHours.he100.toFixed(2) : ''}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No hay registros de asistencia para el día y filtros seleccionados.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TabsContent>

                        <TabsContent value="resumen-periodo" className="mt-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Cédula</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead>Apellido</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>D.LAB</TableHead>
                                        <TableHead>LIB</TableHead>
                                        <TableHead>VAC</TableHead>
                                        <TableHead>PM</TableHead>
                                        <TableHead>LIC</TableHead>
                                        <TableHead>SUS</TableHead>
                                        <TableHead>RET</TableHead>
                                        <TableHead>FI</TableHead>
                                        <TableHead>H.E. 25%</TableHead>
                                        <TableHead>H.E. 50%</TableHead>
                                        <TableHead>H.E. 100%</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={16} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                    ) : periodSummaryData.length > 0 ? periodSummaryData.map(item => (
                                        <TableRow key={item.collaborator.id}>
                                            <TableCell>{item.collaborator.codigo}</TableCell>
                                            <TableCell>{item.collaborator.cedula}</TableCell>
                                            <TableCell>{item.collaborator.cargo}</TableCell>
                                            <TableCell>{item.collaborator.apellidos}</TableCell>
                                            <TableCell>{item.collaborator.nombres}</TableCell>
                                            <TableCell>{item.dLab || ''}</TableCell>
                                            <TableCell>{item.lib || ''}</TableCell>
                                            <TableCell>{item.vac || ''}</TableCell>
                                            <TableCell>{item.pm || ''}</TableCell>
                                            <TableCell>{item.lic || ''}</TableCell>
                                            <TableCell>{item.sus || ''}</TableCell>
                                            <TableCell>{item.ret || ''}</TableCell>
                                            <TableCell>{item.fi || ''}</TableCell>
                                            <TableCell>{item.he25 > 0 ? item.he25.toFixed(2) : ''}</TableCell>
                                            <TableCell>{item.he50 > 0 ? item.he50.toFixed(2) : ''}</TableCell>
                                            <TableCell>{item.he100 > 0 ? item.he100.toFixed(2) : ''}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={16} className="h-24 text-center text-muted-foreground">No hay datos para el período y filtros seleccionados.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AttendanceReportPageWrapper() {
    return <AttendanceReportPage />;
}
