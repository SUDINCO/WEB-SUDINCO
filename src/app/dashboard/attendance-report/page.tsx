
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
import { format, isSameDay, isWithinInterval, set, isAfter, addMonths, isSaturday, isSunday } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import {
  CalendarIcon, Download, LoaderCircle,
} from 'lucide-react';
import type { UserProfile, SavedSchedule, AttendanceRecord, OvertimeRule, GenericOption, ShiftPattern, Holiday } from '@/lib/types';
import { getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { normalizeText } from '@/lib/utils';


type DailySummaryRow = {
    collaborator: UserProfile;
    scheduledShift: string | null;
    status: 'A Tiempo' | 'Atraso';
    extraHours: { he25: number; he50: number; he100: number; };
}

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
    
    // Fallback logic
    const shiftPattern = shiftPatterns.find(p => normalizeText(p.jobTitle) === normalizeText(collaborator.cargo));
    if (shiftPattern?.scheduleType === 'MONDAY_TO_FRIDAY') {
        return (isSaturday(date) || isSunday(date)) ? null : (shiftPattern.cycle[0] || 'D12');
    }
    
    if (!shiftPattern) {
        const isWeekend = isSaturday(date) || isSunday(date);
        return isWeekend ? null : 'N9';
    }

    return null; // Cannot determine from static cycle without full context
};


function AttendanceReportPage() {
    const firestore = useFirestore();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [filters, setFilters] = useState({ ubicacion: 'todos', cargo: 'todos', colaborador: 'todos' });

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

    const dailySummaryData = useMemo((): DailySummaryRow[] => {
        if (isLoading || !users || !attendanceRecords || !overtimeRules || !savedSchedules || !shiftPatterns || !holidays) return [];

        const activeUsers = users.filter(u => u.Status === 'active');
        
        const dayIsHoliday = holidays.some(h => isWithinInterval(selectedDate, { start: h.startDate, end: h.endDate }));
        const jornada = dayIsHoliday ? "FESTIVO" : "NORMAL";

        return activeUsers.map(collaborator => {
            if (
                (filters.ubicacion !== 'todos' && collaborator.ubicacion !== filters.ubicacion) ||
                (filters.cargo !== 'todos' && collaborator.cargo !== filters.cargo) ||
                (filters.colaborador !== 'todos' && collaborator.id !== filters.colaborador)
            ) {
                return null;
            }

            const record = attendanceRecords.find(ar => ar.collaboratorId === collaborator.id && ar.date && isSameDay(ar.date, selectedDate));
            if (!record || !record.entryTime || !record.exitTime) return null;

            const scheduledShift = findScheduledShift(collaborator, selectedDate, savedSchedules, shiftPatterns);

            let status: 'A Tiempo' | 'Atraso' = 'A Tiempo';
            if (scheduledShift) {
                const shiftDetails = getShiftDetailsFromRules(scheduledShift, collaborator.cargo, 'NORMAL', overtimeRules); // 'NORMAL' is ok for start time check
                if (shiftDetails) {
                    const shiftStart = set(selectedDate, { hours: shiftDetails.start.h, minutes: shiftDetails.start.m });
                    if (isAfter(record.entryTime, shiftStart)) {
                        status = 'Atraso';
                    }
                }
            }
            

            const extraHours = { he25: 0, he50: 0, he100: 0 };
            if (scheduledShift) {
                 const rule = overtimeRules.find(r => 
                    normalizeText(r.jobTitle) === normalizeText(collaborator.cargo) && 
                    r.shift === scheduledShift && 
                    r.dayType === jornada
                );
                if (rule) {
                    extraHours.he25 = rule.nightSurcharge || 0;
                    extraHours.he50 = rule.sup50 || 0;
                    extraHours.he100 = rule.ext100 || 0;
                }
            }
            
            return { collaborator, scheduledShift, status, extraHours };
        }).filter((item): item is DailySummaryRow => !!item);
    }, [selectedDate, filters, isLoading, users, attendanceRecords, overtimeRules, savedSchedules, shiftPatterns, holidays]);

    const handleFilterChange = (filterName: 'ubicacion' | 'cargo' | 'colaborador', value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const ubicacionOptions = useMemo(() => [{ value: 'todos', label: 'Todas las ubicaciones' }, ...(ubicaciones || []).map(o => ({ value: o.name, label: o.name }))], [ubicaciones]);
    const cargoOptions = useMemo(() => [{ value: 'todos', label: 'Todos los cargos' }, ...(cargos || []).map(o => ({ value: o.name, label: o.name }))], [cargos]);
    const colaboradorOptions = useMemo(() => [{ value: 'todos', label: 'Todos los colaboradores' }, ...(users || []).map(u => ({ value: u.id, label: `${u.nombres} ${u.apellidos}` }))], [users]);

    const handleExport = () => {
        const dataToExport = dailySummaryData.map(item => ({
            'Colaborador': `${item.collaborator.nombres} ${item.collaborator.apellidos}`,
            'Cargo': item.collaborator.cargo,
            'Turno': item.scheduledShift || 'N/A',
            'Estado': item.status,
            'H.E. 25%': item.extraHours.he25,
            'H.E. 50%': item.extraHours.he50,
            'H.E. 100%': item.extraHours.he100,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Resumen_${format(selectedDate, 'yyyy-MM-dd')}`);
        XLSX.writeFile(workbook, `Resumen_Asistencia_${format(selectedDate, 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold md:text-2xl">Detalle de Asistencia</h1>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Vista de Asistencia</CardTitle>
                            <CardDescription>Detalle de asistencia para el día: {format(selectedDate, 'EEEE, d \'de\' MMMM \'de\' yyyy', { locale: es })}</CardDescription>
                        </div>
                        <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs defaultValue="vista-diaria">
                        <TabsList>
                            <TabsTrigger value="resumen-periodo" disabled>Resumen del Período</TabsTrigger>
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
                                            <TableCell><Badge variant={item.status === 'Atraso' ? 'destructive' : 'default'}>{item.status}</Badge></TableCell>
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
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AttendanceReportPageWrapper() {
    return <AttendanceReportPage />;
}
