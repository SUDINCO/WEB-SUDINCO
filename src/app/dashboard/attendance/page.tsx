
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  LogIn,
  LogOut,
  CalendarDays,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Hourglass,
  Info,
} from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from 'firebase/firestore';
import {
  format,
  isToday,
  isAfter,
  isBefore,
  differenceInSeconds,
  startOfDay,
  subDays,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isSameDay,
  startOfWeek,
  endOfWeek,
  subWeeks,
  addWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { ScheduleProvider, useScheduleState } from '@/context/schedule-context';
import type { Collaborator, ShiftPattern, Vacation, TemporaryTransfer, RoleChange, Absence, Lactation, ManualOverrides } from '@/lib/types';
import { obtenerHorarioUnificado } from '@/lib/schedule-generator';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

type UserProfile = {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  ubicacion?: string;
  [key: string]: any;
};

type AttendanceRecord = {
    id: string;
    collaboratorId: string;
    date: Date;
    scheduledShift: string | null;
    entryTime: Date | null;
    exitTime: Date | null;
    status: 'on-time' | 'late' | 'absent' | 'in-progress' | 'completed' | 'day-off';
    entryLatitude?: number;
    entryLongitude?: number;
    exitLatitude?: number;
    exitLongitude?: number;
    entryWorkLocationName?: string;
    exitWorkLocationName?: string;
};

type WorkLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
};

interface WorkShift {
  name: string;
  startTime: string;
  endTime: string;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const d = R * c; // in metres
  return d;
}


function TimeTracker({ userProfile, schedule, onClockIn, onClockOut, latestRecord, isClocking }: { 
    userProfile: UserProfile | null, 
    schedule: Map<string, string | null> | undefined,
    onClockIn: () => void,
    onClockOut: () => void,
    latestRecord: AttendanceRecord | null,
    isClocking: boolean
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayShift = schedule?.get(todayKey);

  const canClockIn = !latestRecord;
  const canClockOut = latestRecord && !latestRecord.exitTime;
  
  const [workedSeconds, setWorkedSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (latestRecord && latestRecord.entryTime && !latestRecord.exitTime) {
      const updateDuration = () => {
        setWorkedSeconds(differenceInSeconds(new Date(), new Date(latestRecord.entryTime!)));
      };
      updateDuration();
      interval = setInterval(updateDuration, 1000);
    } else if (latestRecord && latestRecord.entryTime && latestRecord.exitTime) {
       setWorkedSeconds(differenceInSeconds(new Date(latestRecord.exitTime), new Date(latestRecord.entryTime)));
    } else {
        setWorkedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [latestRecord]);

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const entryTimeDisplay = latestRecord?.entryTime ? format(new Date(latestRecord.entryTime), 'HH:mm:ss') : '--:--:--';
  const exitTimeDisplay = latestRecord?.exitTime ? format(new Date(latestRecord.exitTime), 'HH:mm:ss') : '--:--:--';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi Registro de Asistencia</CardTitle>
        <CardDescription>
          {format(currentTime, "'Hoy es' EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-6 text-center">
          {/* Clock In */}
          <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg bg-green-50/50 border border-green-200">
              <p className="font-semibold text-green-800">Hora de Entrada</p>
              <p className="text-4xl font-bold text-green-900 tabular-nums">{entryTimeDisplay}</p>
              <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={onClockIn} disabled={!canClockIn || isClocking}>
                {isClocking && canClockIn ? <LoaderCircle className="animate-spin" /> : <LogIn />} 
                Registrar Entrada
             </Button>
          </div>

          {/* Middle section with current time and worked duration */}
          <div className="flex flex-col items-center justify-center gap-4 order-first md:order-none">
              <div className="mb-4">
                  <p className="text-5xl font-bold tabular-nums">{format(currentTime, 'HH:mm:ss')}</p>
                  <p className="text-muted-foreground">Hora Actual</p>
              </div>
              <div className="p-4 rounded-lg bg-muted w-full">
                  <p className="text-sm font-medium text-muted-foreground">Tiempo Trabajado Hoy</p>
                  <p className="text-3xl font-bold tabular-nums">{formatDuration(workedSeconds)}</p>
                   {latestRecord && !latestRecord.exitTime ? (
                      <Badge variant="default" className="bg-blue-500 mt-1">Turno en progreso</Badge>
                   ) : (
                      <Badge variant="secondary" className="mt-1">Fuera de turno</Badge>
                   )}
              </div>
          </div>

          {/* Clock Out */}
          <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg bg-red-50/50 border border-red-200">
              <p className="font-semibold text-red-800">Hora de Salida</p>
              <p className="text-4xl font-bold text-red-900 tabular-nums">{exitTimeDisplay}</p>
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700" onClick={onClockOut} disabled={!canClockOut || isClocking}>
                  {isClocking && canClockOut ? <LoaderCircle className="animate-spin" /> : <LogOut />}
                   Registrar Salida
              </Button>
          </div>
      </CardContent>
    </Card>
  );
}

function WeeklySchedule({
  schedule,
  workShifts,
  attendanceByDay,
  onInfoClick,
}: {
  schedule: Map<string, string | null> | undefined;
  workShifts: WorkShift[];
  attendanceByDay: Map<string, AttendanceRecord>;
  onInfoClick: (day: Date, record?: AttendanceRecord, shift?: string | null) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const weekTitle = useMemo(() => {
      const start = weekDays[0];
      const end = weekDays[weekDays.length - 1];
      
      const startMonthFmt = format(start, 'MMMM', { locale: es });
      const endMonthFmt = format(end, 'MMMM', { locale: es });
      const yearFmt = format(start, 'yyyy');
      
      const title = startMonthFmt === endMonthFmt ? `${startMonthFmt} de ${yearFmt}` : `${startMonthFmt} / ${endMonthFmt} de ${yearFmt}`;
      const subtitle = `Semana del ${format(start, 'd')} al ${format(end, "d 'de' MMMM")}`;

      return { title, subtitle };
  }, [weekDays]);


  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const shiftTimesMap = useMemo(() => {
    const map = new Map<string, string>();
    if (workShifts) {
        workShifts.forEach(shift => {
          map.set(shift.name, `${shift.startTime} - ${shift.endTime}`);
        });
    }
    return map;
  }, [workShifts]);

  if (!schedule) {
    return <Card><CardContent className="p-4 text-center text-muted-foreground">Cargando horario...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Cronograma Semanal</CardTitle>
                <CardDescription>{weekTitle.title} - {weekTitle.subtitle}</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={handleNextWeek}><ChevronRight className="h-4 w-4" /></Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead className="text-right">Info</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const shift = schedule.get(dayKey);
              const scheduleTime = shift ? shiftTimesMap.get(shift) : null;
              const record = attendanceByDay.get(dayKey);
              const entryTime = record?.entryTime ? format(new Date(record.entryTime), 'HH:mm') : '-';
              const exitTime = record?.exitTime ? format(new Date(record.exitTime), 'HH:mm') : '-';
              
              let displayHorario = 'Libre';
              if (scheduleTime) {
                displayHorario = scheduleTime;
              } else if (shift) { // Shows VAC, PM, etc.
                const absenceTypes: {[key: string]: string} = {
                    'VAC': 'Vacaciones', 'PM': 'Permiso Médico', 'LIC': 'Licencia',
                    'SUS': 'Suspensión', 'RET': 'Retiro', 'FI': 'Falta Injustificada', 'TRA': 'Traslado'
                };
                displayHorario = absenceTypes[shift] || shift;
              }

              return (
                <TableRow key={dayKey}>
                  <TableCell>
                    <div className="font-medium capitalize">{format(day, 'E', { locale: es })}</div>
                    <div className="text-sm text-muted-foreground">{format(day, 'd/M')}</div>
                  </TableCell>
                  <TableCell>{displayHorario}</TableCell>
                  <TableCell>{entryTime}</TableCell>
                  <TableCell>{exitTime}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onInfoClick(day, record, shift)}>
                      <Info className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


function AttendanceDetailDialog({ dayInfo, open, onOpenChange }: { dayInfo: { date: Date, record?: AttendanceRecord, shift?: string | null } | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    if (!dayInfo) return null;

    const { date, record, shift } = dayInfo;

    let workedDuration = 'N/A';
    if (record?.entryTime && record?.exitTime) {
        const diff = differenceInSeconds(new Date(record.exitTime), new Date(record.entryTime));
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        workedDuration = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
    } else if (record?.entryTime) {
        workedDuration = 'En progreso...';
    }

    let statusComponent;
    if (record?.status === 'completed' || record?.status === 'on-time' || record?.status === 'late') {
        statusComponent = <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-2 h-4 w-4"/>Laborado</Badge>;
    } else if (record?.status === 'in-progress') {
        statusComponent = <Badge className="bg-yellow-100 text-yellow-800"><Hourglass className="mr-2 h-4 w-4"/>Incompleto</Badge>;
    } else if (isBefore(date, startOfDay(new Date()))) {
        statusComponent = <Badge variant="destructive"><XCircle className="mr-2 h-4 w-4"/>Falta (No timbró)</Badge>;
    } else {
        statusComponent = <Badge variant="secondary">Turno Futuro</Badge>;
    }


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Resumen de Asistencia</DialogTitle>
                    <DialogDescription>
                        Detalle del día {format(date, 'EEEE, dd \'de\' MMMM', { locale: es })}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold">Estado:</p>
                        {statusComponent}
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-start gap-4">
                            <LogIn className="h-5 w-5 text-green-600 mt-1"/>
                            <div>
                                <p className="font-semibold">Entrada</p>
                                {record?.entryTime ? (
                                    <>
                                        <p>{format(new Date(record.entryTime), 'HH:mm:ss')}</p>
                                        <p className="text-sm text-muted-foreground">{record.entryWorkLocationName || 'Ubicación no registrada'}</p>
                                    </>
                                ) : <p className="text-sm text-muted-foreground">Sin registro</p>}
                            </div>
                        </div>
                         <div className="flex items-start gap-4">
                            <LogOut className="h-5 w-5 text-red-600 mt-1"/>
                            <div>
                                <p className="font-semibold">Salida</p>
                                {record?.exitTime ? (
                                    <>
                                        <p>{format(new Date(record.exitTime), 'HH:mm:ss')}</p>
                                        <p className="text-sm text-muted-foreground">{record.exitWorkLocationName || 'Ubicación no registrada'}</p>
                                    </>
                                ) : <p className="text-sm text-muted-foreground">Sin registro</p>}
                            </div>
                        </div>
                    </div>
                     <div className="flex justify-between items-center pt-4 border-t">
                        <p className="font-semibold">Tiempo Trabajado:</p>
                        <p className="font-bold text-lg">{workedDuration}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AttendancePageContent() {
  const { user: authUser, loading: authLoading } = useUser();
  const firestore = useFirestore();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);
  const [isClocking, setIsClocking] = useState(false);
  
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ date: Date, record?: AttendanceRecord, shift?: string | null } | null>(null);

  const context = useScheduleState();
  const { shiftPatterns, savedSchedules, loading: contextLoading } = context;

  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: vacations, isLoading: vacationsLoading } = useCollection<Vacation>(useMemo(() => firestore ? collection(firestore, 'vacationRequests') : null, [firestore]));
  const { data: workLocations, isLoading: locationsLoading } = useCollection<WorkLocation>(useMemo(() => firestore ? collection(firestore, 'workLocations') : null, [firestore]));
  const { data: workShifts, isLoading: workShiftsLoading } = useCollection<WorkShift>(useMemo(() => firestore ? collection(firestore, 'workShifts') : null, [firestore]));
  
  const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(useMemo(() => {
    if (!firestore || !userProfile) return null;
    return query(collection(firestore, 'attendance'), where('collaboratorId', '==', userProfile.id));
  }, [firestore, userProfile]));

  const { schedule } = useMemo(() => {
    if (usersLoading || contextLoading || vacationsLoading) {
      return { schedule: new Map(), days: [] };
    }
    const allCollaborators = (users || []).map(u => ({
        id: u.id,
        name: `${u.nombres} ${u.apellidos}`,
        jobTitle: u.cargo,
        location: u.ubicacion || 'N/A',
        entryDate: new Date(), 
        originalJobTitle: u.cargo,
        originalLocation: u.ubicacion || 'N/A',
    }));

    const scheduleContext = {
      vacations: (vacations as Vacation[] | undefined) || [],
      transfers: [],
      lactations: [],
      roleChanges: [],
      absences: [],
      manualOverrides: new Map(),
      savedPeriodSettings: new Map(),
      notifications: [],
      shiftPatterns,
      allCollaborators: allCollaborators as Collaborator[],
    };

    const scheduleDays = eachDayOfInterval({ start: subMonths(new Date(), 2), end: addMonths(new Date(), 2) });
    const generatedSchedule = obtenerHorarioUnificado(scheduleDays, scheduleContext, 'collaborator');
    return { schedule: generatedSchedule, days: scheduleDays };
  }, [users, context, vacations, usersLoading, contextLoading, vacationsLoading, shiftPatterns]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (authLoading || !users) return;
      if (!authUser) {
        setProfileLoading(false);
        return;
      }
      const profile = users.find(u => u.email.toLowerCase() === authUser.email!.toLowerCase());
      setUserProfile(profile || null);
      setProfileLoading(false);
    };
    fetchUserProfile();
  }, [authUser, authLoading, users]);
  
  useEffect(() => {
    if (attendanceRecords) {
      const todaysRecords = attendanceRecords
        .filter(r => r.date && typeof (r.date as any).toDate === 'function' && isToday((r.date as any).toDate()))
        .map(r => ({
            ...r,
            date: (r.date as any).toDate(),
            entryTime: r.entryTime && typeof (r.entryTime as any).toDate === 'function' ? (r.entryTime as any).toDate() : null,
            exitTime: r.exitTime && typeof (r.exitTime as any).toDate === 'function' ? (r.exitTime as any).toDate() : null,
        }))
        .sort((a, b) => (b.entryTime?.getTime() || 0) - (a.entryTime?.getTime() || 0));

      setLatestRecord(todaysRecords.length > 0 ? todaysRecords[0] : null);
    }
  }, [attendanceRecords]);

  const attendanceByDay = useMemo(() => {
    if (!attendanceRecords) return new Map<string, AttendanceRecord>();
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach(rec => {
        const recordDate = (rec.date as any)?.toDate();
        if (recordDate) {
            const dateKey = format(recordDate, 'yyyy-MM-dd');
            const entryTime = (rec.entryTime as any)?.toDate();
            if (!map.has(dateKey) || (entryTime && map.get(dateKey)!.entryTime! < entryTime)) {
                map.set(dateKey, {
                    ...rec,
                    date: recordDate,
                    entryTime: entryTime || null,
                    exitTime: (rec.exitTime as any)?.toDate() || null,
                });
            }
        }
    });
    return map;
  }, [attendanceRecords]);

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
              reject(new Error('La geolocalización no es soportada por este navegador.'));
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
          });
      });
  };

  const handleClockAction = async (action: 'in' | 'out') => {
    if (!userProfile || !firestore) return;
    if (action === 'in' && latestRecord) return;
    if (action === 'out' && !latestRecord) return;

    setIsClocking(true);
    let position = null;
    let locationName = "Ubicación no registrada";

    try {
        toast({ title: 'Obteniendo ubicación...', description: 'Por favor, autoriza el acceso a tu ubicación.' });
        position = await getCurrentPosition();
        
        if (position && workLocations) {
            for (const location of workLocations) {
                const distance = getDistance(position.coords.latitude, position.coords.longitude, location.latitude, location.longitude);
                if (distance <= location.radius) {
                    locationName = location.name;
                    break;
                }
            }
        }
    } catch (e: any) {
        let description = 'No se pudo obtener la ubicación, pero se continuará con el registro.';
        if (e.code === 1) { // PERMISSION_DENIED
             description = 'Permiso de ubicación denegado. El registro continuará sin geolocalización.';
        }
        toast({ variant: 'destructive', title: 'Advertencia de Ubicación', description });
    }

    try {
        if (action === 'in') {
            const newRecord = {
                collaboratorId: userProfile.id,
                date: new Date(),
                scheduledShift: schedule.get(userProfile.id)?.get(format(new Date(), 'yyyy-MM-dd')) || null,
                entryTime: new Date(),
                exitTime: null,
                status: 'in-progress' as const,
                entryLatitude: position?.coords.latitude || null,
                entryLongitude: position?.coords.longitude || null,
                entryWorkLocationName: locationName,
            };
            const attendanceCollection = collection(firestore, 'attendance');
            await addDoc(attendanceCollection, newRecord);
            toast({ title: 'Entrada Registrada', description: `Ubicación: ${locationName}. ¡Que tengas una excelente jornada!` });
        } else if (action === 'out' && latestRecord) {
            const recordDoc = doc(firestore, 'attendance', latestRecord.id);
            await updateDoc(recordDoc, {
                exitTime: new Date(),
                status: 'completed' as const,
                exitLatitude: position?.coords.latitude || null,
                exitLongitude: position?.coords.longitude || null,
                exitWorkLocationName: locationName,
            });
            toast({ title: 'Salida Registrada', description: `Ubicación: ${locationName}. ¡Disfruta tu descanso!` });
        }
    } catch(error) {
        console.error("Error clocking action:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo registrar la acción.' });
    } finally {
        setIsClocking(false);
    }
  };


  const currentUserSchedule = useMemo(() => {
    if (!schedule || !userProfile) return undefined;
    return schedule.get(userProfile.id);
  }, [schedule, userProfile]);

  const handleInfoClick = (date: Date, record?: AttendanceRecord, shift?: string | null) => {
      setSelectedDayInfo({ date, record, shift });
  };


  const isLoading = authLoading || profileLoading || usersLoading || contextLoading || vacationsLoading || locationsLoading || workShiftsLoading || attendanceLoading;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userProfile) {
    return <p>No se pudo cargar tu perfil. Contacta a soporte.</p>;
  }

  return (
    <div className="space-y-6">
      <AttendanceDetailDialog
        dayInfo={selectedDayInfo}
        open={!!selectedDayInfo}
        onOpenChange={() => setSelectedDayInfo(null)}
      />
      <TimeTracker 
        userProfile={userProfile} 
        schedule={currentUserSchedule}
        onClockIn={() => handleClockAction('in')}
        onClockOut={() => handleClockAction('out')}
        latestRecord={latestRecord}
        isClocking={isClocking}
      />
      <div className="mt-6">
        <WeeklySchedule 
          schedule={currentUserSchedule}
          workShifts={workShifts || []}
          attendanceByDay={attendanceByDay}
          onInfoClick={handleInfoClick}
        />
      </div>
    </div>
  );
}

export default function AttendancePage() {
    return (
        <ScheduleProvider>
            <AttendancePageContent />
        </ScheduleProvider>
    );
}
