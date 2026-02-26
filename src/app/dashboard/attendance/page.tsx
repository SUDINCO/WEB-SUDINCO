
"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  XCircle,
  Hourglass,
  Info,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  query,
  where,
  doc,
} from 'firebase/firestore';
import {
  format,
  isToday,
  isBefore,
  differenceInSeconds,
  startOfDay,
  subMonths,
  addMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  subWeeks,
  addWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { ScheduleProvider, useScheduleState } from '@/context/schedule-context';
import type { Collaborator, Vacation, UserProfile, EquipmentHandover, AttendanceRecord, WorkLocation } from '@/lib/types';
import { obtenerHorarioUnificado, getShiftDetailsFromRules } from '@/lib/schedule-generator';
import { cn, normalizeText } from '@/lib/utils';
import { HandoverDialog } from '@/components/equipment/HandoverDialog';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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
  const isApproved = todayShift !== undefined;

  const canClockIn = !latestRecord && isApproved;
  const canClockOut = latestRecord && !latestRecord.exitTime;
  
  const [workedSeconds, setWorkedSeconds] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (latestRecord && latestRecord.entryTime && !latestRecord.exitTime) {
      const updateDuration = () => setWorkedSeconds(differenceInSeconds(new Date(), (latestRecord.entryTime as any).toDate()));
      updateDuration();
      interval = setInterval(updateDuration, 1000);
    } else if (latestRecord && latestRecord.entryTime && latestRecord.exitTime) {
       setWorkedSeconds(differenceInSeconds((latestRecord.exitTime as any).toDate(), (latestRecord.entryTime as any).toDate()));
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

  const isGuard = normalizeText(userProfile?.cargo) === 'GUARDIA DE SEGURIDAD';

  return (
    <Card className={cn(isGuard && "border-primary shadow-lg")}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              Mi Registro de Asistencia
              {isGuard && <Badge className="bg-primary hover:bg-primary"><ShieldCheck className="mr-1 h-3 w-3" /> Puesto de Seguridad</Badge>}
            </CardTitle>
            <CardDescription>{format(currentTime, "'Hoy es' EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</CardDescription>
          </div>
          {!isApproved && <Badge variant="destructive">Horario Pendiente de Aprobación</Badge>}
        </div>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg bg-green-50/50 border border-green-200">
              <p className="font-semibold text-green-800">Entrada</p>
              <p className="text-4xl font-bold text-green-900 tabular-nums">
                {latestRecord?.entryTime ? format((latestRecord.entryTime as any).toDate(), 'HH:mm:ss') : '--:--:--'}
              </p>
              <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 shadow-md" onClick={onClockIn} disabled={!canClockIn || isClocking}>
                {isClocking && canClockIn ? <LoaderCircle className="animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />} 
                Registrar Entrada
             </Button>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 order-first md:order-none">
              <div className="mb-4">
                  <p className="text-5xl font-bold tabular-nums">{format(currentTime, 'HH:mm:ss')}</p>
                  <p className="text-muted-foreground">Hora Actual</p>
              </div>
              <div className="p-4 rounded-lg bg-muted w-full">
                  <p className="text-sm font-medium text-muted-foreground">Tiempo Trabajado Hoy</p>
                  <p className="text-3xl font-bold tabular-nums">{formatDuration(workedSeconds)}</p>
              </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg bg-red-50/50 border border-red-200">
              <p className="text-red-800 font-semibold text-center mb-1">Salida</p>
              <p className="text-4xl font-bold text-red-900 tabular-nums">
                {latestRecord?.exitTime ? format((latestRecord.exitTime as any).toDate(), 'HH:mm:ss') : '--:--:--'}
              </p>
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 shadow-md mt-3" onClick={onClockOut} disabled={!canClockOut || isClocking}>
                  {isClocking && canClockOut ? <LoaderCircle className="animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                   Registrar Salida
              </Button>
          </div>
      </CardContent>
    </Card>
  );
}

function WeeklySchedule({ schedule, overtimeRules, attendanceByDay, onInfoClick }: {
  schedule: Map<string, string | null> | undefined;
  overtimeRules: any[];
  attendanceByDay: Map<string, AttendanceRecord>;
  onInfoClick: (day: Date, record?: AttendanceRecord, shift?: string | null) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Cronograma Semanal</CardTitle>
        <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weekDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const shift = schedule?.get(dayKey);
              const record = attendanceByDay.get(dayKey);
              const isApproved = shift !== undefined;
              
              let displayHorario = isApproved ? (shift || 'LIBRE') : 'PENDIENTE';
              
              return (
                <TableRow key={dayKey}>
                  <TableCell>
                    <div className="font-medium capitalize">{format(day, 'EEEE', { locale: es })}</div>
                    <div className="text-xs text-muted-foreground">{format(day, 'd MMM')}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={!isApproved ? "destructive" : (shift ? "default" : "outline")}>
                        {isApproved ? (shift || 'LIB') : 'PEND'}
                    </Badge>
                  </TableCell>
                  <TableCell>{displayHorario}</TableCell>
                  <TableCell>{record?.entryTime ? format((record.entryTime as any).toDate(), 'HH:mm') : '-'}</TableCell>
                  <TableCell>{record?.exitTime ? format((record.exitTime as any).toDate(), 'HH:mm') : '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onInfoClick(day, record, shift)} disabled={!isApproved && !record}>
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

function AttendancePageContent() {
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [latestRecord, setLatestRecord] = useState<AttendanceRecord | null>(null);
  const [isClocking, setIsClocking] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ date: Date, record?: AttendanceRecord, shift?: string | null } | null>(null);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [handoverToApprove, setHandoverToApprove] = useState<EquipmentHandover | null>(null);
  const [reliefGuard, setReliefGuard] = useState<UserProfile | null>(null);

  const { shiftPatterns, savedSchedules, overtimeRules, loading: contextLoading } = useScheduleState();
  const { data: users } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: workLocations } = useCollection<WorkLocation>(useMemo(() => firestore ? collection(firestore, 'workLocations') : null, [firestore]));
  const { data: equipmentHandovers } = useCollection<EquipmentHandover>(useMemo(() => firestore ? collection(firestore, 'equipmentHandovers') : null, [firestore]));
  
  const { data: attendanceRecords } = useCollection<AttendanceRecord>(useMemo(() => {
    if (!firestore || !userProfile) return null;
    return query(collection(firestore, 'attendance'), where('collaboratorId', '==', userProfile.id));
  }, [firestore, userProfile]));

  useEffect(() => {
    if (users && authUser) {
      const profile = users.find(u => u.email.toLowerCase() === authUser.email!.toLowerCase());
      setUserProfile(profile || null);
    }
  }, [authUser, users]);

  useEffect(() => {
    if (attendanceRecords) {
      const todays = attendanceRecords.filter(r => isToday((r.date as any).toDate())).sort((a,b) => (b.entryTime as any).seconds - (a.entryTime as any).seconds);
      setLatestRecord(todays[0] || null);
    }
  }, [attendanceRecords]);

  const schedule = useMemo(() => {
    if (!userProfile) return new Map();
    const days = eachDayOfInterval({ start: subMonths(new Date(), 1), end: addMonths(new Date(), 1) });
    return obtenerHorarioUnificado(days, {
        allCollaborators: userProfile ? [{ ...userProfile, name: `${userProfile.nombres} ${userProfile.apellidos}`, originalJobTitle: userProfile.cargo, originalLocation: userProfile.ubicacion || 'N/A', entryDate: new Date(), jobTitle: userProfile.cargo, location: userProfile.ubicacion || 'N/A' }] : [],
        shiftPatterns,
        vacations: [],
        transfers: [],
        lactations: [],
        roleChanges: [],
        manualOverrides: new Map(),
        notifications: [],
        savedSchedules: savedSchedules || {}
    }, 'collaborator');
  }, [userProfile, shiftPatterns, savedSchedules]);

  const handleClockAction = async (action: 'in' | 'out') => {
    if (!userProfile || !firestore) return;
    const isGuard = normalizeText(userProfile.cargo) === 'GUARDIA DE SEGURIDAD';
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    if (isGuard && action === 'in') {
      const existing = equipmentHandovers?.find(h => h.date === todayStr && h.incomingGuardId === userProfile.id);
      if (!existing) {
        const potential = users?.find(u => u.id !== userProfile.id && normalizeText(u.cargo) === 'GUARDIA DE SEGURIDAD' && normalizeText(u.ubicacion || '') === normalizeText(userProfile.ubicacion || '') && u.Status === 'active');
        setReliefGuard(potential || null);
        setIsHandoverOpen(true);
        return;
      }
    }

    if (isGuard && action === 'out') {
      const approved = equipmentHandovers?.find(h => h.status === 'approved' && h.outgoingGuardId === userProfile.id && h.date === todayStr);
      if (!approved) {
        toast({ variant: 'destructive', title: 'Acta Pendiente', description: 'Debe aprobar el acta de relevo de su compañero entrante para salir.' });
        return;
      }
    }

    setIsClocking(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      let locName = "Fuera de Zona";
      if (workLocations) {
        for (const l of workLocations) {
          if (getDistance(pos.coords.latitude, pos.coords.longitude, l.latitude, l.longitude) <= l.radius) {
            locName = l.name; break;
          }
        }
      }

      if (action === 'in') {
        await addDoc(collection(firestore, 'attendance'), {
          collaboratorId: userProfile.id,
          date: new Date(),
          entryTime: new Date(),
          entryWorkLocationName: locName,
          status: 'in-progress'
        });
      } else if (latestRecord) {
        await updateDoc(doc(firestore, 'attendance', latestRecord.id), {
          exitTime: new Date(),
          exitWorkLocationName: locName,
          status: 'completed'
        });
      }
      toast({ title: 'Éxito', description: `Registro de ${action === 'in' ? 'entrada' : 'salida'} completado en ${locName}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo obtener la ubicación o guardar el registro.' });
    } finally {
      setIsClocking(false);
    }
  };

  const attendanceByDay = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords?.forEach(r => map.set(format((r.date as any).toDate(), 'yyyy-MM-dd'), r));
    return map;
  }, [attendanceRecords]);

  if (!userProfile || contextLoading) return <div className="flex h-full items-center justify-center"><LoaderCircle className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <TimeTracker userProfile={userProfile} schedule={schedule.get(userProfile.id)} latestRecord={latestRecord} onClockIn={() => handleClockAction('in')} onClockOut={() => handleClockAction('out')} isClocking={isClocking} />
      <WeeklySchedule schedule={schedule.get(userProfile.id)} overtimeRules={overtimeRules} attendanceByDay={attendanceByDay} onInfoClick={(date, record, shift) => setSelectedDayInfo({date, record, shift})} />
      
      {isHandoverOpen && <HandoverDialog open={isHandoverOpen} onOpenChange={setIsHandoverOpen} location={userProfile.ubicacion || 'OFICINA'} currentUser={userProfile} suggestedGuard={reliefGuard} onSuccess={() => handleClockAction('in')} />}
      <Dialog open={!!selectedDayInfo} onOpenChange={() => setSelectedDayInfo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle del Día</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <p><strong>Fecha:</strong> {selectedDayInfo ? format(selectedDayInfo.date, 'PPPP', { locale: es }) : ''}</p>
            <p><strong>Turno Programado:</strong> {selectedDayInfo?.shift || 'LIBRE'}</p>
            <p><strong>Entrada:</strong> {selectedDayInfo?.record?.entryTime ? format((selectedDayInfo.record.entryTime as any).toDate(), 'HH:mm:ss') : '-'}</p>
            <p><strong>Salida:</strong> {selectedDayInfo?.record?.exitTime ? format((selectedDayInfo.record.exitTime as any).toDate(), 'HH:mm:ss') : '-'}</p>
          </div>
        </DialogContent>
      </Dialog>
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
