
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

function MonthlySchedule({ schedule, month, onMonthChange, attendanceByDay, onDayClick }: { 
  schedule: Map<string, string | null> | undefined,
  month: Date,
  onMonthChange: (newMonth: Date) => void,
  attendanceByDay: Map<string, AttendanceRecord>,
  onDayClick: (day: Date, record?: AttendanceRecord, shift?: string | null) => void,
}) {
  if (!schedule) {
    return <Card><CardContent className="p-4 text-center text-muted-foreground">Cargando horario...</CardContent></Card>;
  }

  const shifts = new Map<string, string>();
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  daysInMonth.forEach(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const shift = schedule.get(dayKey);
    const displayShift = shift === null ? 'LIB' : shift;
    if (displayShift) {
        shifts.set(dayKey, displayShift);
    }
  });

  const DayWithShift = ({ date, shift, record, onClick }: { date: Date, shift: string | null | undefined, record: AttendanceRecord | undefined, onClick: () => void }) => {
    const isTodayFlag = isSameDay(date, new Date());
    const isPastDay = isBefore(date, startOfDay(new Date()));
    
    let workedDuration = null;
    if (record?.entryTime && record?.exitTime) {
        const diff = differenceInSeconds(new Date(record.exitTime), new Date(record.entryTime));
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        workedDuration = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
    }

    let dayStatus: 'completed' | 'in-progress' | 'absent' | 'day-off' | null = null;
    if (record?.status === 'completed' || record?.status === 'on-time' || record?.status === 'late') {
        dayStatus = 'completed';
    } else if (record?.status === 'in-progress') {
        dayStatus = 'in-progress';
    } else if (isPastDay && shift && shift !== 'LIB' && !record) {
        dayStatus = 'absent';
    } else if (!shift || shift === 'LIB') {
        dayStatus = 'day-off';
    }


    return (
      <button
        type="button"
        onClick={onClick}
        disabled={dayStatus === 'day-off' && !record}
        className={cn(
            "relative flex flex-col items-start justify-start h-24 md:h-36 w-full p-1 text-xs border-t border-r text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed",
            isTodayFlag && "ring-2 ring-primary ring-inset",
            dayStatus === 'completed' && "bg-green-50 hover:bg-green-100",
            dayStatus === 'in-progress' && "bg-yellow-50 hover:bg-yellow-100",
            dayStatus === 'absent' && "bg-red-50 hover:bg-red-100",
            dayStatus === 'day-off' && "bg-gray-50",
            !dayStatus && "hover:bg-accent/50",
        )}
      >
        <div className={cn("font-semibold", isTodayFlag && "text-primary")}>{date.getDate()}</div>
        {shift && (
          <Badge 
            variant={shift === 'LIB' ? 'outline' : 'secondary'} 
            className={cn(
                "mt-1 text-[10px] px-1.5 py-0.5 h-auto font-bold",
                shift === 'VAC' && "bg-yellow-400 text-yellow-900",
                shift && shift.startsWith('N') && "bg-gray-700 text-white",
                shift && shift.startsWith('T') && "bg-orange-400 text-orange-900",
                shift && shift.startsWith('M') && "bg-blue-400 text-white",
            )}
          >
            {shift}
          </Badge>
        )}
        {record?.entryTime && (
             <div className="hidden md:block text-[10px] leading-tight mt-2 w-full space-y-1 text-left px-1">
                 {workedDuration && (
                    <div className="flex items-center gap-1 font-semibold">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{workedDuration}</span>
                    </div>
                 )}
                 <div className="flex items-start gap-1">
                    <LogIn className="h-3 w-3 shrink-0 mt-0.5 text-green-600"/>
                    <div>
                        <span>{format(new Date(record.entryTime), 'HH:mm')}</span>
                        <p className="text-muted-foreground truncate">{record.entryWorkLocationName || 'N/A'}</p>
                    </div>
                 </div>
                 {record.exitTime && (
                    <div className="flex items-start gap-1">
                        <LogOut className="h-3 w-3 shrink-0 mt-0.5 text-red-600"/>
                        <div>
                            <span>{format(new Date(record.exitTime), 'HH:mm')}</span>
                            <p className="text-muted-foreground truncate">{record.exitWorkLocationName || 'N/A'}</p>
                        </div>
                    </div>
                 )}
             </div>
        )}
      </button>
    );
  };

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const firstDayOfMonth = startOfMonth(month);
  const startingDayOfWeek = getDay(firstDayOfMonth);
  const emptyCells = Array(startingDayOfWeek).fill(null);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <CardTitle className="capitalize text-xl">{format(month, 'MMMM yyyy', { locale: es })}</CardTitle>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(month, 1))}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>Hoy</Button>
            <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 border-l border-b">
          {dayNames.map(day => (
            <div key={day} className="text-center font-bold text-xs p-2 border-t border-r bg-muted/50">{day}</div>
          ))}
          {emptyCells.map((_, index) => (
            <div key={`empty-${index}`} className="h-24 md:h-36 border-t border-r bg-muted/20"></div>
          ))}
          {daysInMonth.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const shift = shifts.get(dayKey);
            const record = attendanceByDay.get(dayKey);
            return <DayWithShift key={day.toString()} date={day} shift={shift} record={record} onClick={() => onDayClick(day, record, shift)} />
          })}
        </div>
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
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ date: Date, record?: AttendanceRecord, shift?: string | null } | null>(null);

  const context = useScheduleState();
  const { shiftPatterns, savedSchedules, loading: contextLoading } = context;

  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: vacations, isLoading: vacationsLoading } = useCollection<Vacation>(useMemo(() => firestore ? collection(firestore, 'vacationRequests') : null, [firestore]));
  const { data: workLocations, isLoading: locationsLoading } = useCollection<WorkLocation>(useMemo(() => firestore ? collection(firestore, 'workLocations') : null, [firestore]));
  
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
            // Get the latest record for a given day
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
                timeout: 10000, // 10 seconds
                maximumAge: 0
            });
        });
    };

  const handleClockIn = async () => {
    if (!userProfile || !firestore || latestRecord) return;
    setIsClocking(true);
    try {
        toast({ title: 'Obteniendo ubicación...', description: 'Por favor, autoriza el acceso a tu ubicación.' });
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        if (!workLocations) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las ubicaciones de trabajo.' });
            setIsClocking(false);
            return;
        }

        let validLocation: WorkLocation | null = null;
        for (const location of workLocations) {
            const distance = getDistance(latitude, longitude, location.latitude, location.longitude);
            if (distance <= location.radius) {
                validLocation = location;
                break;
            }
        }
        
        const locationName = validLocation ? validLocation.name : "Ubicación no registrada";

        const newRecord = {
            collaboratorId: userProfile.id,
            date: new Date(),
            scheduledShift: schedule.get(userProfile.id)?.get(format(new Date(), 'yyyy-MM-dd')) || null,
            entryTime: new Date(),
            exitTime: null,
            status: 'in-progress' as const,
            entryLatitude: latitude,
            entryLongitude: longitude,
            entryWorkLocationName: locationName,
        };
        const attendanceCollection = collection(firestore, 'attendance');
        await addDoc(attendanceCollection, newRecord);
        
        if (validLocation) {
            toast({ title: 'Entrada Registrada', description: `Ubicación: ${locationName}. ¡Que tengas una excelente jornada!` });
        } else {
            toast({ 
                variant: 'destructive',
                title: 'Entrada Registrada Fuera de Rango', 
                description: 'Tu entrada ha sido registrada, pero no te encuentras en una ubicación de trabajo autorizada.' 
            });
        }
    } catch (e: any) {
        let description = 'No se pudo registrar la entrada.';
        if (e.code === 1) { // PERMISSION_DENIED
            description = 'Permiso de ubicación denegado. No se puede registrar la entrada.';
        } else if (e.message) {
            description = e.message;
        }
        toast({ variant: 'destructive', title: 'Error', description });
    } finally {
        setIsClocking(false);
    }
  };

  const handleClockOut = async () => {
    if (!latestRecord || !firestore) return;
    setIsClocking(true);
    try {
        toast({ title: 'Obteniendo ubicación...', description: 'Por favor, autoriza el acceso a tu ubicación.' });
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        if (!workLocations) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las ubicaciones de trabajo.' });
            setIsClocking(false);
            return;
        }

        let validLocation: WorkLocation | null = null;
        for (const location of workLocations) {
            const distance = getDistance(latitude, longitude, location.latitude, location.longitude);
            if (distance <= location.radius) {
                validLocation = location;
                break;
            }
        }
        
        const locationName = validLocation ? validLocation.name : "Ubicación no registrada";

        const recordDoc = doc(firestore, 'attendance', latestRecord.id);
        await updateDoc(recordDoc, {
            exitTime: new Date(),
            status: 'completed' as const,
            exitLatitude: latitude,
            exitLongitude: longitude,
            exitWorkLocationName: locationName,
        });

        if (validLocation) {
            toast({ title: 'Salida Registrada', description: `Ubicación: ${locationName}. ¡Disfruta tu descanso!` });
        } else {
            toast({ 
                variant: 'destructive',
                title: 'Salida Registrada Fuera de Rango', 
                description: 'Tu salida ha sido registrada, pero no te encuentras en una ubicación de trabajo autorizada.' 
            });
        }
    } catch (e: any) {
        let description = 'No se pudo registrar la salida.';
        if (e.code === 1) { // PERMISSION_DENIED
            description = 'Permiso de ubicación denegado. No se puede registrar la salida.';
        } else if (e.message) {
            description = e.message;
        }
        toast({ variant: 'destructive', title: 'Error', description });
    } finally {
      setIsClocking(false);
    }
  };

  const currentUserSchedule = useMemo(() => {
    if (!schedule || !userProfile) return undefined;
    return schedule.get(userProfile.id);
  }, [schedule, userProfile]);

  const handleDayClick = (date: Date, record?: AttendanceRecord, shift?: string | null) => {
    if (record || (shift && shift !== 'LIB')) {
      setSelectedDayInfo({ date, record, shift });
    }
  };


  const isLoading = authLoading || profileLoading || usersLoading || contextLoading || vacationsLoading || locationsLoading;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin" />
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
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        latestRecord={latestRecord}
        isClocking={isClocking}
      />
      <div className="mt-6">
        <MonthlySchedule 
          schedule={currentUserSchedule} 
          month={currentMonth} 
          onMonthChange={setCurrentMonth} 
          attendanceByDay={attendanceByDay}
          onDayClick={handleDayClick}
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
