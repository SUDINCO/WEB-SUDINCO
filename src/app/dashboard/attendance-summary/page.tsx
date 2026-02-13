
'use client';

import { useState, useMemo, useCallback } from 'react';
import { format, set, addMonths, eachDayOfInterval, subMonths, startOfDay, isSameDay, isWithinInterval, differenceInMinutes, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { useScheduleState } from '@/context/schedule-context';
import type { AttendanceRecord, Collaborator, OvertimeRule, UserProfile, Vacation } from '@/lib/types';
import { obtenerHorarioUnificado, getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { getEffectiveDetails } from '@/lib/schedule-utils';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileDown, CalendarIcon, ChevronsUpDown, Check, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import * as XLSX from 'xlsx';

type ViewMode = 'period' | 'annual';

function AttendanceSummaryPageContent() {
  const { 
    locations: allLocations,
    vacations, 
    transfers, 
    roleChanges, 
    savedSchedules,
    shiftPatterns,
    overtimeRules,
    holidays
  } = useScheduleState();

  const firestore = useFirestore();
  const { data: allUsers, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: attendanceData, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(useMemo(() => firestore ? collection(firestore, 'attendance') : null, [firestore]));

  const [viewMode, setViewMode] = useState<ViewMode>('period');
  const [selectedPeriodDate, setSelectedPeriodDate] = useState(new Date());

  const [filters, setFilters] = useState({
    location: 'todos',
    jobTitle: 'todos',
    collaboratorId: 'todos',
  });
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false);
  const [isJobTitlePopoverOpen, setIsJobTitlePopoverOpen] = useState(false);
  const [isCollaboratorPopoverOpen, setIsCollaboratorPopoverOpen] = useState(false);
  
  const periodInterval = useMemo(() => {
    let currentMonthDate = selectedPeriodDate;
    if (currentMonthDate.getDate() < 21) {
        currentMonthDate = subMonths(currentMonthDate, 1);
    }
    const start = set(currentMonthDate, { date: 21 });
    const end = set(addMonths(currentMonthDate, 1), { date: 20 });
    return { start, end };
  }, [selectedPeriodDate]);

  const daysInPeriod = useMemo(() => {
    return eachDayOfInterval(periodInterval);
  }, [periodInterval]);

  const collaborators = useMemo((): Collaborator[] => {
    if (!allUsers) return [];
    return allUsers.map(u => ({
        id: u.id,
        name: `${u.nombres} ${u.apellidos}`,
        jobTitle: u.cargo,
        location: u.ubicacion || 'N/A',
        entryDate: new Date(u.fechaIngreso),
        originalJobTitle: u.cargo,
        originalLocation: u.ubicacion || 'N/A',
        codigo: u.codigo,
        cedula: u.cedula,
        apellidos: u.apellidos,
        nombres: u.nombres,
    } as any));
  }, [allUsers]);

  const unifiedSchedule = useMemo(() => {
    if (!collaborators.length || !daysInPeriod.length) return new Map();
    
    return obtenerHorarioUnificado(
      daysInPeriod,
      {
        allCollaborators: collaborators,
        vacations,
        transfers,
        lactations: [],
        roleChanges,
        absences: [],
        savedPeriodSettings: new Map(),
        manualOverrides: new Map(),
        notifications: [],
        shiftPatterns
      },
      'rrhh'
    )
  }, [daysInPeriod, collaborators, vacations, transfers, roleChanges, shiftPatterns]);
  
  const filteredCollaboratorsForDisplay = useMemo(() => {
    return collaborators.filter(c => {
        const representativeDay = daysInPeriod.length > 0 ? daysInPeriod[0] : new Date();
        const { location: effectiveLocation, jobTitle: effectiveJobTitle } = getEffectiveDetails(c, representativeDay, transfers, roleChanges);
        
        const locationMatch = filters.location === 'todos' || effectiveLocation === filters.location;
        const jobTitleMatch = filters.jobTitle === 'todos' || effectiveJobTitle === filters.jobTitle;
        const collaboratorMatch = filters.collaboratorId === 'todos' || c.id === filters.collaboratorId;
        
        return locationMatch && jobTitleMatch && collaboratorMatch;
    });
  }, [filters, collaborators, daysInPeriod, transfers, roleChanges]);

  const attendanceRecordsForPeriod = useMemo(() => {
    if (!attendanceData) return [];
    return attendanceData.filter(rec => {
        const recDate = (rec.date as any)?.toDate ? (rec.date as any).toDate() : new Date(rec.date);
        return isWithinInterval(recDate, periodInterval);
    });
  }, [attendanceData, periodInterval]);

  const attendanceSummary = useMemo(() => {
    if (filteredCollaboratorsForDisplay.length === 0) return [];
    
    return filteredCollaboratorsForDisplay.map(c => {
        const collaboratorId = c.id;
        const collaboratorAttendance = attendanceRecordsForPeriod.filter(rec => rec.collaboratorId === collaboratorId);
        const collaboratorAbsences = vacations.filter(req => req.userId === collaboratorId && req.status === 'approved');

        let diasTrabajados = 0;
        let diasDeAusencia = 0;
        let atrasos = 0;
        let horasNormales = 0;
        let horasExtras = 0;

        daysInPeriod.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const scheduledShift = unifiedSchedule.get(collaboratorId)?.get(dayKey);
            const isAbsence = collaboratorAbsences.some(req => isWithinInterval(day, { start: new Date(req.startDate), end: new Date(req.endDate) }));

            if (isAbsence) {
                diasDeAusencia++;
                return;
            }
            if (!scheduledShift || scheduledShift === 'LIB') {
                return;
            }

            const attendanceRecord = collaboratorAttendance.find(rec => isSameDay((rec.date as any).toDate(), day));

            if (attendanceRecord && attendanceRecord.entryTime && attendanceRecord.exitTime) {
                diasTrabajados++;

                const entry = (attendanceRecord.entryTime as any).toDate();
                const exit = (attendanceRecord.exitTime as any).toDate();
                const workedMinutes = differenceInMinutes(exit, entry);
                
                const { jobTitle } = getEffectiveDetails(c, day, transfers, roleChanges);
                const shiftDetails = getShiftDetailsFromRules(scheduledShift, jobTitle, overtimeRules);

                if (shiftDetails) {
                    const shiftStart = set(day, { hours: shiftDetails.start.h, minutes: shiftDetails.start.m });
                    if (isAfter(entry, shiftStart)) {
                        atrasos++;
                    }
                    const scheduledMinutes = shiftDetails.hours * 60;
                    horasNormales += Math.min(workedMinutes, scheduledMinutes);
                    horasExtras += Math.max(0, workedMinutes - scheduledMinutes);
                } else {
                    horasNormales += workedMinutes;
                }
            }
        });

        return {
            id: c.id,
            nombre: c.name,
            codigo: (c as any).codigo,
            cargo: getEffectiveDetails(c, periodInterval.start, transfers, roleChanges).jobTitle,
            ubicacion: getEffectiveDetails(c, periodInterval.start, transfers, roleChanges).location,
            diasTrabajados,
            diasDeAusencia,
            atrasos,
            horasNormales: parseFloat((horasNormales / 60).toFixed(2)),
            horasExtras: parseFloat((horasExtras / 60).toFixed(2)),
        };
    });
  }, [filteredCollaboratorsForDisplay, periodInterval, attendanceRecordsForPeriod, vacations, unifiedSchedule, daysInPeriod, transfers, roleChanges, overtimeRules]);

  const periodTitleText = useMemo(() => {
     const start = format(periodInterval.start, "d 'de' MMMM", { locale: es });
     const end = format(periodInterval.end, "d 'de' MMMM 'de' yyyy", { locale: es });
     return `${start} - ${end}`;
  }, [periodInterval]);

  const handleExportToExcel = useCallback(() => {
    if (!attendanceSummary || attendanceSummary.length === 0) {
        // toast({
        //     variant: "destructive",
        //     title: "Sin datos",
        //     description: "No hay datos para exportar con los filtros actuales.",
        // });
        return;
    }
    
    const dataToExport = attendanceSummary.map(row => ({
        'Código': row.codigo,
        'Nombre': row.nombre,
        'Cargo': row.cargo,
        'Ubicación': row.ubicacion,
        'Días Trabajados': row.diasTrabajados,
        'Días de Ausencia': row.diasDeAusencia,
        'Atrasos': row.atrasos,
        'Horas Normales': row.horasNormales,
        'Horas Extras': row.horasExtras,
    }));
    const fileName = `Resumen_Asistencia_${format(periodInterval.start, 'yyyyMMdd')}-${format(periodInterval.end, 'yyyyMMdd')}.xlsx`;
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen");
    XLSX.writeFile(workbook, fileName);
  }, [attendanceSummary, periodInterval]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    if (key === 'location') {
        newFilters.jobTitle = 'todos';
        newFilters.collaboratorId = 'todos';
    }
    if (key === 'jobTitle') {
        newFilters.collaboratorId = 'todos';
    }
    if (key === 'collaboratorId' && value !== 'todos') {
        const selectedCollaborator = collaborators.find(c => c.id === value);
        if (selectedCollaborator) {
            const representativeDay = daysInPeriod[0] || new Date();
            const { location, jobTitle } = getEffectiveDetails(selectedCollaborator, representativeDay, transfers, roleChanges);
            newFilters.location = location;
            newFilters.jobTitle = jobTitle;
        }
    }
    setFilters(newFilters);
  };
    
  const availableJobTitles = useMemo(() => {
    if (filters.location === 'todos') return [...new Set(collaborators.map(c => c.jobTitle))].sort();
    const titles = new Set<string>();
    collaborators.forEach(c => {
        const representativeDay = daysInPeriod[0] || new Date();
        const { location } = getEffectiveDetails(c, representativeDay, transfers, roleChanges);
        if (location === filters.location) {
            titles.add(c.jobTitle);
        }
    });
    return Array.from(titles).sort();
  }, [filters.location, collaborators, daysInPeriod, transfers, roleChanges]);

  const availableCollaborators = useMemo(() => {
    return collaborators.filter(c => {
        const representativeDay = daysInPeriod[0] || new Date();
        const { location, jobTitle } = getEffectiveDetails(c, representativeDay, transfers, roleChanges);
        const locationMatch = filters.location === 'todos' || location === filters.location;
        const jobTitleMatch = filters.jobTitle === 'todos' || jobTitle === filters.jobTitle;
        return locationMatch && jobTitleMatch;
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [filters.location, filters.jobTitle, collaborators, daysInPeriod, transfers, roleChanges]);

  return (
      <div className="flex flex-col gap-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Resumen de Asistencia</CardTitle>
                        <CardDescription>
                          Análisis consolidado de la asistencia para control y gestión de nómina.
                        </CardDescription>
                    </div>
                     <Button onClick={handleExportToExcel}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Descargar Excel
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 border-b pb-4">
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                    <TabsList>
                      <TabsTrigger value="period">Resumen por Período</TabsTrigger>
                      <TabsTrigger value="annual">Resumen Anual</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {viewMode === 'period' && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setSelectedPeriodDate(prev => subMonths(prev, 1))} aria-label="Periodo anterior">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold text-center w-64 text-sm">{periodTitleText}</span>
                        <Button variant="outline" size="icon" onClick={() => setSelectedPeriodDate(prev => addMonths(prev, 1))} aria-label="Periodo siguiente">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                  )}
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                     <div className="grid w-full items-center gap-1.5">
                        <Label>Ubicación</Label>
                        <Popover open={isLocationPopoverOpen} onOpenChange={setIsLocationPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between">
                              {filters.location === 'todos' ? 'Todas las ubicaciones' : filters.location}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                             <Command>
                                <CommandInput placeholder="Buscar ubicación..." />
                                <CommandList>
                                  <CommandEmpty>No se encontró la ubicación.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem onSelect={() => { handleFilterChange('location', 'todos'); setIsLocationPopoverOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", filters.location === 'todos' ? "opacity-100" : "opacity-0")} />
                                        Todas las ubicaciones
                                    </CommandItem>
                                    {allLocations.map(location => (
                                        <CommandItem key={location.id} value={location.name} onSelect={() => { handleFilterChange('location', location.name); setIsLocationPopoverOpen(false); }}>
                                           <Check className={cn("mr-2 h-4 w-4", filters.location === location.name ? "opacity-100" : "opacity-0")} />
                                           {location.name}
                                        </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                          </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid w-full items-center gap-1.5">
                        <Label>Cargo</Label>
                        <Popover open={isJobTitlePopoverOpen} onOpenChange={setIsJobTitlePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between">
                              {filters.jobTitle === 'todos' ? 'Todos los cargos' : filters.jobTitle}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                             <Command>
                                <CommandInput placeholder="Buscar cargo..." />
                                <CommandList>
                                  <CommandEmpty>No se encontró el cargo.</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem onSelect={() => { handleFilterChange('jobTitle', 'todos'); setIsJobTitlePopoverOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", filters.jobTitle === 'todos' ? "opacity-100" : "opacity-0")} />
                                        Todos los cargos
                                    </CommandItem>
                                    {availableJobTitles.map(title => (
                                        <CommandItem key={title} value={title} onSelect={() => { handleFilterChange('jobTitle', title); setIsJobTitlePopoverOpen(false); }}>
                                           <Check className={cn("mr-2 h-4 w-4", filters.jobTitle === title ? "opacity-100" : "opacity-0")} />
                                           {title}
                                        </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                          </PopoverContent>
                        </Popover>
                    </div>
                     <div className="grid w-full items-center gap-1.5">
                        <Label>Colaborador</Label>
                        <Popover open={isCollaboratorPopoverOpen} onOpenChange={setIsCollaboratorPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between">
                              {filters.collaboratorId === 'todos' ? 'Todos los colaboradores' : availableCollaborators.find(c => c.id === filters.collaboratorId)?.name || 'Seleccionar...'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                             <Command>
                                <CommandInput placeholder="Buscar colaborador..." />
                                <CommandList>
                                  <CommandEmpty>No se encontró colaborador.</CommandEmpty>
                                  <CommandGroup>
                                     <CommandItem onSelect={() => { handleFilterChange('collaboratorId', 'todos'); setIsCollaboratorPopoverOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", filters.collaboratorId === 'todos' ? "opacity-100" : "opacity-0")} />
                                        Todos los colaboradores
                                    </CommandItem>
                                    {availableCollaborators.map(c => (
                                        <CommandItem key={c.id} value={c.name} onSelect={() => { handleFilterChange('collaboratorId', c.id); setIsCollaboratorPopoverOpen(false); }}>
                                           <Check className={cn("mr-2 h-4 w-4", filters.collaboratorId === c.id ? "opacity-100" : "opacity-0")} />
                                           {c.name}
                                        </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                          </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="overflow-x-auto">
                  <TabsContent value="period">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead>Ubicación</TableHead>
                                <TableHead>Días Trabajados</TableHead>
                                <TableHead>Días Ausencia</TableHead>
                                <TableHead>Atrasos</TableHead>
                                <TableHead>Horas Normales</TableHead>
                                <TableHead>Horas Extras</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!attendanceSummary ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">Cargando datos...</TableCell>
                                </TableRow>
                            ) : attendanceSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">No hay datos de asistencia para los filtros seleccionados.</TableCell>
                                </TableRow>
                            ) : (
                                attendanceSummary.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className='font-medium'>{row.nombre}</TableCell>
                                        <TableCell>{row.codigo}</TableCell>
                                        <TableCell>{row.cargo}</TableCell>
                                        <TableCell>{row.ubicacion}</TableCell>
                                        <TableCell>{row.diasTrabajados}</TableCell>
                                        <TableCell>{row.diasDeAusencia}</TableCell>
                                        <TableCell>{row.atrasos}</TableCell>
                                        <TableCell>{row.horasNormales}</TableCell>
                                        <TableCell>{row.horasExtras}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                  </TabsContent>
                  <TabsContent value="annual">
                    <div className="text-center py-10 text-muted-foreground">
                      <p>El resumen anual estará disponible próximamente.</p>
                    </div>
                  </TabsContent>
                </div>
            </CardContent>
        </Card>
      </div>
  );
}

export default function RrhhAttendancePageWrapper() {
  return (
    <ScheduleProvider>
      <AttendanceSummaryPageContent />
    </ScheduleProvider>
  );
}
