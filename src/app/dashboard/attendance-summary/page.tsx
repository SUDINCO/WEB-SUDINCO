
'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, doc, query, where, getDocs, addDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format, parse, differenceInMinutes, startOfDay, set, isPast, isToday, subMonths, addMonths, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import {
  CalendarIcon, Download, Search, Edit, LoaderCircle, AlertTriangle, CheckCircle, Clock, Info, User,
} from 'lucide-react';
import type { UserProfile, SavedSchedule, AttendanceRecord, OvertimeRule, GenericOption } from '@/lib/types';
import { getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TableRowData = {
    collaborator: UserProfile;
    scheduledShift: string | null;
    attendance: Partial<AttendanceRecord> | null;
    lateness: number | null;
    workedHours: number | null;
    status: 'Completo' | 'Incompleto' | 'Falta' | 'Día Libre' | 'N/A';
    manuallyEdited: boolean;
};

const editAttendanceSchema = z.object({
  entrada: z.string().optional(),
  salida: z.string().optional(),
  turno: z.string().optional(),
  observaciones: z.string().optional(),
  justificacion: z.string().optional(),
});


function AttendanceControlPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [filters, setFilters] = useState({ ubicacion: 'todos', cargo: 'todos', colaborador: 'todos' });
    const [editingRecord, setEditingRecord] = useState<TableRowData | null>(null);

    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: savedSchedules, isLoading: schedulesLoading } = useCollection<SavedSchedule>(useMemo(() => firestore ? collection(firestore, 'savedSchedules') : null, [firestore]));
    const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(useMemo(() => firestore ? collection(firestore, 'attendance') : null, [firestore]));
    const { data: overtimeRules, isLoading: rulesLoading } = useCollection<OvertimeRule>(useMemo(() => firestore ? collection(firestore, 'overtimeRules') : null, [firestore]));
    const { data: ubicaciones, isLoading: ubicacionesLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'ubicaciones') : null, [firestore]));
    const { data: cargos, isLoading: cargosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
    
    const isLoading = usersLoading || schedulesLoading || attendanceLoading || rulesLoading || ubicacionesLoading || cargosLoading;

    const form = useForm<z.infer<typeof editAttendanceSchema>>({
        resolver: zodResolver(editAttendanceSchema)
    });
    
    useEffect(() => {
        if(editingRecord) {
            form.reset({
                entrada: editingRecord.attendance?.entryTime ? format(editingRecord.attendance.entryTime as Date, 'HH:mm') : '',
                salida: editingRecord.attendance?.exitTime ? format(editingRecord.attendance.exitTime as Date, 'HH:mm') : '',
                turno: editingRecord.scheduledShift || 'LIB',
                observaciones: editingRecord.attendance?.observations || '',
                justificacion: '',
            });
        }
    }, [editingRecord, form]);

    const tableData = useMemo((): TableRowData[] => {
        if (isLoading || !users || !savedSchedules) return [];

        const dayKey = format(selectedDate, 'yyyy-MM-dd');
        const periodIdentifier = format(selectedDate.getDate() >= 21 ? addMonths(selectedDate, 1) : selectedDate, 'yyyy-MM');

        const periodSchedules = savedSchedules.filter(s => s.id.startsWith(periodIdentifier));
        
        let collaboratorsForDay: { id: string; shift: string | null }[] = [];
        periodSchedules.forEach(scheduleDoc => {
            Object.entries(scheduleDoc.schedule).forEach(([collabId, dayMap]) => {
                if (dayMap[dayKey] !== undefined) {
                    if (!collaboratorsForDay.some(c => c.id === collabId)) {
                       collaboratorsForDay.push({ id: collabId, shift: dayMap[dayKey] });
                    }
                }
            });
        });
        
        const filteredCollaborators = collaboratorsForDay.map(cs => users.find(u => u.id === cs.id)).filter((u): u is UserProfile => !!u);
        
        const filteredByDropdowns = filteredCollaborators.filter(u => 
            (filters.ubicacion === 'todos' || u.ubicacion === filters.ubicacion) &&
            (filters.cargo === 'todos' || u.cargo === filters.cargo) &&
            (filters.colaborador === 'todos' || u.id === filters.colaborador)
        );

        return filteredByDropdowns.map(collab => {
            const scheduledShift = collaboratorsForDay.find(cs => cs.id === collab.id)?.shift || null;
            const rawAttendance = attendanceRecords?.find(ar => ar.collaboratorId === collab.id && format((ar.date as any).toDate(), 'yyyy-MM-dd') === dayKey) || null;
            
            const attendance = rawAttendance 
                ? {
                    ...rawAttendance,
                    entryTime: rawAttendance.entryTime && (rawAttendance.entryTime as any).toDate ? (rawAttendance.entryTime as any).toDate() : null,
                    exitTime: rawAttendance.exitTime && (rawAttendance.exitTime as any).toDate ? (rawAttendance.exitTime as any).toDate() : null,
                  }
                : null;

            let lateness = null;
            let workedHours = null;
            let status: TableRowData['status'] = 'N/A';

            const entryTime = attendance?.entryTime;
            const exitTime = attendance?.exitTime;

            if (scheduledShift && scheduledShift !== 'LIB') {
                const shiftDetails = getShiftDetailsFromRules(scheduledShift, collab.cargo, 'NORMAL', overtimeRules || []);
                if (entryTime && shiftDetails) {
                    const shiftStart = set(selectedDate, { hours: shiftDetails.start.h, minutes: shiftDetails.start.m });
                    const diff = differenceInMinutes(entryTime, shiftStart);
                    lateness = Math.max(0, diff);
                }

                if (isPast(selectedDate) || isToday(selectedDate)) {
                    if (!entryTime && !exitTime) status = 'Falta';
                    else if (entryTime && !exitTime) status = 'Incompleto';
                    else if (entryTime && exitTime) status = 'Completo';
                }
            } else {
                 status = 'Día Libre';
            }

            if(entryTime && exitTime) {
                workedHours = differenceInMinutes(exitTime, entryTime) / 60;
            }

            return {
                collaborator: collab,
                scheduledShift,
                attendance,
                lateness,
                workedHours,
                status,
                manuallyEdited: !!(rawAttendance as any)?.manuallyEditedBy
            };
        });
        
    }, [selectedDate, filters, isLoading, users, savedSchedules, attendanceRecords, overtimeRules]);
    
    const handleFilterChange = (filterName: 'ubicacion' | 'cargo' | 'colaborador', value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };
    
    const allShiftOptions = useMemo(() => {
        const shifts = new Set<string>();
        overtimeRules?.forEach(r => shifts.add(r.shift));
        return ['LIB', ...Array.from(shifts).sort()];
    }, [overtimeRules]);

    const handleSaveAttendance = async (data: z.infer<typeof editAttendanceSchema>) => {
        if (!editingRecord || !firestore || !user) return;
        
        try {
            const supervisorLocation = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
        
            const entryTime = data.entrada ? set(selectedDate, { hours: parseInt(data.entrada.split(':')[0]), minutes: parseInt(data.entrada.split(':')[1]) }) : null;
            const exitTime = data.salida ? set(selectedDate, { hours: parseInt(data.salida.split(':')[0]), minutes: parseInt(data.salida.split(':')[1]) }) : null;

            const recordToSave = {
                collaboratorId: editingRecord.collaborator.id,
                date: startOfDay(selectedDate),
                scheduledShift: data.turno === 'LIB' ? null : data.turno,
                entryTime,
                exitTime,
                observations: data.observaciones,
                manuallyEditedBy: user.uid,
                manualEditLocation: {
                    latitude: supervisorLocation.coords.latitude,
                    longitude: supervisorLocation.coords.longitude,
                },
                manualEditJustification: data.justificacion
            };

            if (editingRecord.attendance?.id) {
                // Update existing record
                const docRef = doc(firestore, 'attendance', editingRecord.attendance.id);
                await updateDoc(docRef, recordToSave);
            } else {
                // Create new record
                await addDoc(collection(firestore, 'attendance'), recordToSave);
            }

            toast({ title: "Registro de Asistencia Guardado", description: "Los cambios han sido guardados exitosamente." });
            setEditingRecord(null);
        } catch (error) {
            console.error("Error saving attendance:", error);
            toast({ variant: 'destructive', title: "Error al Guardar", description: "No se pudo guardar el registro de asistencia. Asegúrese de tener permisos de ubicación." });
        }
    };
    
     const handleExport = () => {
        const dataToExport = tableData.map(item => {
            const entry = item.attendance?.entryTime ? format(item.attendance.entryTime as Date, 'HH:mm:ss') : '--';
            const exit = item.attendance?.exitTime ? format(item.attendance.exitTime as Date, 'HH:mm:ss') : '--';
            const latenessMinutes = item.lateness || 0;
            const tardanza = `${String(Math.floor(latenessMinutes / 60)).padStart(2, '0')}:${String(latenessMinutes % 60).padStart(2, '0')}`;
            const workedHours = item.workedHours !== null ? item.workedHours.toFixed(2) : '--';
            
            return {
                'Colaborador': `${item.collaborator.nombres} ${item.collaborator.apellidos}`,
                'Cargo': item.collaborator.cargo,
                'Turno': item.scheduledShift || 'LIB',
                'Entrada': entry,
                'Salida': exit,
                'Tardanza (HH:mm)': tardanza,
                'T. Laborado (Horas)': workedHours,
                'Registro': item.status,
                'Observaciones': item.attendance?.observations || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Asistencia_${format(selectedDate, 'yyyy-MM-dd')}`);
        XLSX.writeFile(workbook, `Control_Asistencia_${format(selectedDate, 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold md:text-2xl">Control de Asistencia Diario</h1>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Filtros y Acciones</CardTitle>
                        <CardDescription>Gestiona la asistencia del personal para el día: {format(selectedDate, 'EEEE, d \'de\' MMMM \'de\' yyyy', { locale: es })}</CardDescription>
                      </div>
                      <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Combobox options={(ubicaciones || []).map(o => ({ value: o.name, label: o.name }))} value={filters.ubicacion} onChange={(v) => handleFilterChange('ubicacion', v)} placeholder="Todas las ubicaciones" />
                    <Combobox options={(cargos || []).map(o => ({ value: o.name, label: o.name }))} value={filters.cargo} onChange={(v) => handleFilterChange('cargo', v)} placeholder="Todos los cargos" />
                    <Combobox options={(users || []).map(u => ({ value: u.id, label: `${u.nombres} ${u.apellidos}` }))} value={filters.colaborador} onChange={(v) => handleFilterChange('colaborador', v)} placeholder="Todos los colaboradores" />
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
                </CardContent>
            </Card>

            <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Registro de Asistencia</DialogTitle>
                        <DialogDescription>
                            Editando para <strong>{editingRecord?.collaborator.nombres} {editingRecord?.collaborator.apellidos}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSaveAttendance)} className="space-y-4 py-4">
                             <FormField control={form.control} name="turno" render={({ field }) => (
                                <FormItem><FormLabel>Turno Asignado</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {allShiftOptions.map(shift => <SelectItem key={shift} value={shift}>{shift}</SelectItem>)}
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="entrada" render={({ field }) => (
                                <FormItem><FormLabel>Hora de Entrada</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="salida" render={({ field }) => (
                                <FormItem><FormLabel>Hora de Salida</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="observaciones" render={({ field }) => (
                                <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="justificacion" render={({ field }) => (
                                <FormItem><FormLabel>Justificación del Cambio</FormLabel><FormControl><Textarea {...field} placeholder="Motivo de la edición manual..."/></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setEditingRecord(null)}>Cancelar</Button>
                                <Button type="submit">Guardar Cambios</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <p className="text-sm text-muted-foreground">Mostrando {tableData.length} registros de asistencia.</p>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Turno</TableHead>
                                <TableHead>Entrada</TableHead>
                                <TableHead>Salida</TableHead>
                                <TableHead>Tardanza</TableHead>
                                <TableHead>T. Laborado</TableHead>
                                <TableHead>Registro</TableHead>
                                <TableHead>Observaciones</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={10} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                            ) : tableData.length > 0 ? tableData.map(item => {
                                const entry = item.attendance?.entryTime ? format(item.attendance.entryTime as Date, 'HH:mm:ss') : '--';
                                const exit = item.attendance?.exitTime ? format(item.attendance.exitTime as Date, 'HH:mm:ss') : '--';
                                const latenessMinutes = item.lateness || 0;
                                const tardanza = latenessMinutes > 0 ? `${String(Math.floor(latenessMinutes / 60)).padStart(2, '0')}:${String(latenessMinutes % 60).padStart(2, '0')}` : '--';
                                const workedHours = item.workedHours !== null ? `${item.workedHours.toFixed(2)}h` : '--';
                                
                                let statusBadge;
                                switch (item.status) {
                                    case 'Completo': statusBadge = <Badge className="bg-green-100 text-green-800">Completo</Badge>; break;
                                    case 'Incompleto': statusBadge = <Badge className="bg-yellow-100 text-yellow-800">Incompleto</Badge>; break;
                                    case 'Falta': statusBadge = <Badge variant="destructive">Falta</Badge>; break;
                                    default: statusBadge = <Badge variant="secondary">{item.status}</Badge>;
                                }

                                return (
                                <TableRow key={item.collaborator.id}>
                                    <TableCell className="font-medium">{`${item.collaborator.nombres} ${item.collaborator.apellidos}`}</TableCell>
                                    <TableCell>{item.collaborator.cargo}</TableCell>
                                    <TableCell>{item.scheduledShift || 'LIB'}</TableCell>
                                    <TableCell className={cn("flex items-center gap-1", item.manuallyEdited && "text-blue-600")}>{entry} {item.manuallyEdited && <User className="h-3 w-3"/>}</TableCell>
                                    <TableCell className={cn("flex items-center gap-1", item.manuallyEdited && "text-blue-600")}>{exit} {item.manuallyEdited && <User className="h-3 w-3"/>}</TableCell>
                                    <TableCell>{tardanza}</TableCell>
                                    <TableCell>{workedHours}</TableCell>
                                    <TableCell>{statusBadge}</TableCell>
                                    <TableCell className="text-xs max-w-xs truncate">{item.attendance?.observations || (item.status === 'Falta' ? 'No se presenta al turno' : (item.status === 'Día Libre' ? 'Día Libre' : ''))}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingRecord(item)}><Edit className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                                )
                            }) : (
                                <TableRow><TableCell colSpan={10} className="h-24 text-center">No hay datos de asistencia para los filtros seleccionados.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AttendanceControlPageWrapper() {
    // This wrapper can be used to provide any necessary context if needed in the future.
    return <AttendanceControlPage />;
}
