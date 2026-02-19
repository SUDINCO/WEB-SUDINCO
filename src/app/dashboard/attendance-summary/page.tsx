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
import { collection, doc, query, where, getDocs, addDoc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format, parse, differenceInMinutes, startOfDay, set, isPast, isToday, subMonths, addMonths, eachDayOfInterval, isSameDay, isSaturday, isSunday } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import {
  CalendarIcon, Download, Search, Edit, LoaderCircle, AlertTriangle, CheckCircle, Clock, Info, User, Trash2,
} from 'lucide-react';
import type { UserProfile, SavedSchedule, AttendanceRecord, OvertimeRule, GenericOption, ShiftPattern } from '@/lib/types';
import { getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';


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

// Helper para el cálculo de la fecha del período
const currentDateForPeriod = (date: Date) => {
    return date.getDate() < 21 ? date : addMonths(date, 1);
};


function AttendanceControlPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [filters, setFilters] = useState({ ubicacion: 'todos', cargo: 'todos', colaborador: 'todos' });
    const [editingRecord, setEditingRecord] = useState<TableRowData | null>(null);
    const [recordToDelete, setRecordToDelete] = useState<TableRowData | null>(null);

    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: savedSchedules, isLoading: schedulesLoading } = useCollection<SavedSchedule>(useMemo(() => firestore ? collection(firestore, 'savedSchedules') : null, [firestore]));
    const { data: attendanceRecordsData, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(useMemo(() => firestore ? collection(firestore, 'attendance') : null, [firestore]));
    const { data: overtimeRules, isLoading: rulesLoading } = useCollection<OvertimeRule>(useMemo(() => firestore ? collection(firestore, 'overtimeRules') : null, [firestore]));
    const { data: ubicaciones, isLoading: ubicacionesLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'ubicaciones') : null, [firestore]));
    const { data: cargos, isLoading: cargosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
    const { data: shiftPatterns, isLoading: patternsLoading } = useCollection<ShiftPattern>(useMemo(() => firestore ? collection(firestore, 'shiftPatterns') : null, [firestore]));
    
    const isLoading = usersLoading || schedulesLoading || attendanceLoading || rulesLoading || ubicacionesLoading || cargosLoading || patternsLoading;

    const form = useForm<z.infer<typeof editAttendanceSchema>>({
        resolver: zodResolver(editAttendanceSchema)
    });

    const attendanceRecords = useMemo(() => {
        if (!attendanceRecordsData) return [];
        return attendanceRecordsData.map(rec => ({
            ...rec,
            date: rec.date && (rec.date as any).toDate ? (rec.date as any).toDate() : null,
            entryTime: rec.entryTime && (rec.entryTime as any).toDate ? (rec.entryTime as any).toDate() : null,
            exitTime: rec.exitTime && (rec.exitTime as any).toDate ? (rec.exitTime as any).toDate() : null,
        }));
    }, [attendanceRecordsData]);

    
    useEffect(() => {
        if(editingRecord) {
            form.reset({
                entrada: editingRecord.attendance?.entryTime ? format(editingRecord.attendance.entryTime as Date, 'HH:mm') : '',
                salida: editingRecord.attendance?.exitTime ? format(editingRecord.attendance.exitTime as Date, 'HH:mm') : '',
                turno: editingRecord.scheduledShift || 'LIB',
                observaciones: (editingRecord.attendance as any)?.observations || '',
                justificacion: '',
            });
        }
    }, [editingRecord, form]);

    const tableData = useMemo((): TableRowData[] => {
        if (isLoading || !users || !savedSchedules || !attendanceRecords || !shiftPatterns) return [];

        const dayKey = format(selectedDate, 'yyyy-MM-dd');
        const periodDate = currentDateForPeriod(selectedDate);
        const periodIdentifier = format(periodDate, 'yyyy-MM');

        // 1. Get manually scheduled users
        const periodSchedules = savedSchedules.filter(s => s.id.startsWith(periodIdentifier));
        const manuallyScheduledUserIds = new Set<string>();
        const allCollaboratorsForDay: { id: string; shift: string | null }[] = [];

        periodSchedules.forEach(scheduleDoc => {
            Object.entries(scheduleDoc.schedule).forEach(([collabId, dayMap]) => {
                if (dayMap[dayKey] !== undefined) {
                    if (!manuallyScheduledUserIds.has(collabId)) {
                       allCollaboratorsForDay.push({ id: collabId, shift: dayMap[dayKey] });
                       manuallyScheduledUserIds.add(collabId);
                    }
                }
            });
        });

        // 2. Get default "N9" users
        const shiftPatternsByCargo = new Map<string, any>(shiftPatterns.map(p => [p.jobTitle, p]));
        const isWeekend = isSaturday(selectedDate) || isSunday(selectedDate);

        users.forEach(user => {
            if (user.Status === 'active' && !manuallyScheduledUserIds.has(user.id)) {
                if (!shiftPatternsByCargo.has(user.cargo)) {
                    const shift = isWeekend ? null : 'N9';
                    allCollaboratorsForDay.push({ id: user.id, shift: shift });
                }
            }
        });

        const fullCollaboratorData = allCollaboratorsForDay
            .map(cs => {
                const collaborator = users.find(u => u.id === cs.id);
                if (!collaborator) return null;
                return { collaborator, scheduledShift: cs.shift };
            })
            .filter((item): item is { collaborator: UserProfile; scheduledShift: string | null } => !!item);
        
        // 3. Apply UI Filters
        const filteredByDropdowns = fullCollaboratorData.filter(item => 
            (filters.ubicacion === 'todos' || item.collaborator.ubicacion === filters.ubicacion) &&
            (filters.cargo === 'todos' || item.collaborator.cargo === filters.cargo) &&
            (filters.colaborador === 'todos' || item.collaborator.id === filters.colaborador)
        );

        // 4. Map to final TableRowData structure
        return filteredByDropdowns.map(({ collaborator, scheduledShift }) => {
            const attendance = attendanceRecords.find(ar => ar.collaboratorId === collaborator.id && ar.date && isSameDay(ar.date, selectedDate)) || null;

            let lateness = null;
            let workedHours = null;
            let status: TableRowData['status'] = 'N/A';
            const entryTime = attendance?.entryTime;
            const exitTime = attendance?.exitTime;

            if (scheduledShift && scheduledShift !== 'LIB') {
                const shiftDetails = getShiftDetailsFromRules(scheduledShift, collaborator.cargo, 'NORMAL', overtimeRules || []);
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
                collaborator,
                scheduledShift,
                attendance,
                lateness,
                workedHours,
                status,
                manuallyEdited: !!(attendance as any)?.manuallyEditedBy
            };
        });
        
    }, [selectedDate, filters, isLoading, users, savedSchedules, attendanceRecords, overtimeRules, shiftPatterns]);
    
    const handleFilterChange = (filterName: 'ubicacion' | 'cargo' | 'colaborador', value: string) => {
        setFilters(prev => {
            if (filterName === 'ubicacion') {
                return { ubicacion: value, cargo: 'todos', colaborador: 'todos' };
            }
            if (filterName === 'cargo') {
                return { ...prev, cargo: value, colaborador: 'todos' };
            }
            return { ...prev, [filterName]: value };
        });
    };
    
     const ubicacionOptions = useMemo(() => {
        if (!users) return [];
        const uniqueUbicaciones = [...new Set(users.map(u => u.ubicacion).filter(Boolean) as string[])].sort();
        return [{ value: 'todos', label: 'Todas las ubicaciones' }, ...uniqueUbicaciones.map(name => ({ value: name, label: name }))];
    }, [users]);

    const cargoOptions = useMemo(() => {
        if (!users) return [{ value: 'todos', label: 'Todos los cargos' }];
        
        let filteredUsers = users;
        if (filters.ubicacion !== 'todos') {
            filteredUsers = filteredUsers.filter(u => u.ubicacion === filters.ubicacion);
        }
        const uniqueCargos = [...new Set(filteredUsers.map(u => u.cargo))].sort();
        return [{ value: 'todos', label: 'Todos los cargos' }, ...uniqueCargos.map(c => ({ value: c, label: c }))];

    }, [users, filters.ubicacion]);

    const colaboradorOptions = useMemo(() => {
        if (!users) return [{ value: 'todos', label: 'Todos los colaboradores' }];
        let filteredUsers = users;

        if (filters.ubicacion !== 'todos') {
            filteredUsers = filteredUsers.filter(u => u.ubicacion === filters.ubicacion);
        }
        if (filters.cargo !== 'todos') {
            filteredUsers = filteredUsers.filter(u => u.cargo === filters.cargo);
        }

        return [
            { value: 'todos', label: 'Todos los colaboradores' },
            ...filteredUsers.map(u => ({ value: u.id, label: `${u.nombres} ${u.apellidos}` }))
        ];
    }, [users, filters.ubicacion, filters.cargo]);
    
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

    const handleDeleteRecord = async () => {
        if (!recordToDelete?.attendance?.id || !firestore) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No hay registro para eliminar.'
            });
            setRecordToDelete(null);
            return;
        }

        try {
            await deleteDoc(doc(firestore, 'attendance', recordToDelete.attendance.id));
            toast({
                title: 'Registro Eliminado',
                description: 'El registro de asistencia ha sido eliminado correctamente.'
            });
        } catch (error) {
            console.error("Error deleting attendance record:", error);
            toast({
                variant: 'destructive',
                title: 'Error al Eliminar',
                description: 'No se pudo eliminar el registro de asistencia.'
            });
        } finally {
            setRecordToDelete(null);
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
                'Observaciones': (item.attendance as any)?.observations || ''
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
                    <Combobox options={ubicacionOptions} value={filters.ubicacion} onChange={(v) => handleFilterChange('ubicacion', v)} placeholder="Todas las ubicaciones" />
                    <Combobox options={cargoOptions} value={filters.cargo} onChange={(v) => handleFilterChange('cargo', v)} placeholder="Todos los cargos" />
                    <Combobox options={colaboradorOptions} value={filters.colaborador} onChange={(v) => handleFilterChange('colaborador', v)} placeholder="Todos los colaboradores" />
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

            <AlertDialog open={!!recordToDelete} onOpenChange={() => setRecordToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente el registro de asistencia para este colaborador en este día. No se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteRecord}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar Registro
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


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
                                    <TableCell className={cn(item.manuallyEdited && "text-blue-600")}>
                                        <div className="flex items-center gap-1">
                                            {entry}
                                            {item.manuallyEdited && <TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button"><User className="h-3 w-3"/></button></TooltipTrigger><TooltipContent><p>Registro manual</p></TooltipContent></Tooltip></TooltipProvider>}
                                        </div>
                                    </TableCell>
                                    <TableCell className={cn(item.manuallyEdited && "text-blue-600")}>
                                        <div className="flex items-center gap-1">
                                            {exit}
                                            {item.manuallyEdited && <TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button"><User className="h-3 w-3"/></button></TooltipTrigger><TooltipContent><p>Registro manual</p></TooltipContent></Tooltip></TooltipProvider>}
                                        </div>
                                    </TableCell>
                                    <TableCell>{tardanza}</TableCell>
                                    <TableCell>{workedHours}</TableCell>
                                    <TableCell>{statusBadge}</TableCell>
                                    <TableCell className="text-xs max-w-xs truncate">{ (item.attendance as any)?.observations || (item.status === 'Falta' ? 'No se presenta al turno' : (item.status === 'Día Libre' ? 'Día Libre' : ''))}</TableCell>
                                    <TableCell className="text-right flex items-center justify-end">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingRecord(item)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" disabled={!item.attendance} onClick={() => setRecordToDelete(item)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
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
