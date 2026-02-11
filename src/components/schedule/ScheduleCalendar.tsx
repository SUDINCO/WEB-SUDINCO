
'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  addMonths,
  subMonths,
  format,
  isToday,
  isWithinInterval,
  startOfDay,
  parseISO,
  isPast,
  isBefore,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, PlusCircle, BookUser, ClipboardCheck, Info, ArrowRightLeft, Plane, SlidersHorizontal, Baby, Briefcase, CheckCircle2, HandPlatter, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Collaborator, TemporaryTransfer, Vacation, Lactation, AttendanceRecord, RoleChange, ManualOverride, ManualOverrides, Notification, NotificationChange, Absence } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// import { ScheduleSummary } from './schedule-summary';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getEffectiveDetails } from '@/lib/schedule-utils';
import { useUser } from '@/firebase';

interface ScheduleCalendarProps {
  collaborators: Collaborator[];
  schedule: Map<string, Map<string, string | null>>;
  baseSchedule: Map<string, Map<string, string | null>>;
  days: Date[];
  filters?: {
    location: string;
    jobTitle: string;
    collaboratorId: string;
  };
  onOpenApprovals: () => void;
  onOpenTransfers: () => void;
  onOpenVacations: () => void;
  onOpenAbsences: () => void;
  onOpenLactations: () => void;
  onOpenRoleChanges: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  manualOverrides: ManualOverrides;
  onManualOverridesChange: (overrides: ManualOverrides) => void;
  isScheduleLocked?: boolean;
  transfers: TemporaryTransfer[];
  vacations: Vacation[];
  absences: Absence[];
  lactations: Lactation[];
  roleChanges: RoleChange[];
  periodTitle: string;
  allCollaborators: Collaborator[];
  savedPeriodSettings: Map<string, { conditioning: { morning: number; afternoon: number; night: number }, isAutomatic: boolean }>;
  attendanceForPeriod: Map<string, AttendanceRecord>;
  showConsiderationsButton?: boolean;
  attendancePath?: string;
  onAdminOverride?: (override: { collaboratorId: string; date: Date; shift: string | null; note?: string; originalShift: string | null; }) => void;
  notifications?: Notification[];
}

const allShiftTypes = ['M8', 'T8', 'N8', 'D12', 'N12', 'TA', 'T24', 'D10', 'D9', 'LIB'];

export function ScheduleCalendar({ 
  collaborators, 
  schedule,
  baseSchedule,
  days,
  filters, 
  onOpenApprovals, 
  onOpenTransfers,
  onOpenVacations,
  onOpenAbsences,
  onOpenLactations,
  onOpenRoleChanges,
  currentDate, 
  onDateChange,
  manualOverrides,
  onManualOverridesChange,
  isScheduleLocked = false,
  transfers,
  vacations,
  absences,
  lactations,
  roleChanges,
  periodTitle,
  allCollaborators,
  savedPeriodSettings,
  attendanceForPeriod,
  showConsiderationsButton = true,
  attendancePath = '/attendance',
  onAdminOverride,
  notifications = [],
}: ScheduleCalendarProps) {
  
  const router = useRouter();
  const { user } = useUser();
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ collaboratorId: string; date: Date; originalShift: string | null; } | null>(null);
  const [selectedShift, setSelectedShift] = useState('LIB');
  
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);

  const { dailyCounts, uniqueShifts } = useMemo(() => {
    const counts: { [day: string]: { [shift: string]: number } } = {};
    const allShifts = new Set<string>();

    if (!days || days.length === 0 || !collaborators || collaborators.length === 0 ) {
      return { dailyCounts: {}, uniqueShifts: [] };
    }

    days.forEach(day => {
      counts[format(day, 'yyyy-MM-dd')] = {};
    });

    collaborators.forEach(collaborator => {
      const collaboratorSchedule = schedule.get(collaborator.id);
      if (collaboratorSchedule) {
        days.forEach(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const finalShift = collaboratorSchedule.get(dayKey);

          const { location: effectiveLocation, jobTitle: effectiveJobTitle } = getEffectiveDetails(
            collaborator,
            day,
            transfers,
            roleChanges
          );
          
          const locationMatch = !filters || filters.location === 'todos' || effectiveLocation === filters.location;
          const jobTitleMatch = !filters || filters.jobTitle === 'todos' || effectiveJobTitle === filters.jobTitle;

          if (locationMatch && jobTitleMatch) {
            if (counts[dayKey] && finalShift && finalShift !== 'VAC' && finalShift !== 'TRA' && !['PM', 'LIC', 'SUS', 'RET', 'FI'].includes(finalShift)) {
              allShifts.add(finalShift);
              counts[dayKey][finalShift] = (counts[dayKey][finalShift] || 0) + 1;
            }
          }
        });
      }
    });

    const orderedShiftTypes = ['M8', 'T8', 'N8', 'D12', 'N12', 'TA', 'T24', 'D10', 'D9'];
    const sortedUniqueShifts = Array.from(allShifts).sort((a, b) => {
        const indexA = orderedShiftTypes.indexOf(a);
        const indexB = orderedShiftTypes.indexOf(b);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return {
      dailyCounts: counts,
      uniqueShifts: sortedUniqueShifts,
    };
  }, [schedule, days, collaborators, filters, transfers, roleChanges]);


  const nextPeriod = () => onDateChange(addMonths(currentDate, 1));
  const prevPeriod = () => onDateChange(subMonths(currentDate, 1));

  const handleOpenModal = (collaboratorId: string, date: Date) => {
    const dayKey = format(date, 'yyyy-MM-dd');
    const overrideInfo = manualOverrides.get(collaboratorId)?.get(dayKey);
    const originalShift = baseSchedule.get(collaboratorId)?.get(dayKey) || null;
    
    const currentShift = schedule.get(collaboratorId)?.get(dayKey) || null;
    const currentNoteValue = overrideInfo?.note || '';

    setSelectedCell({ collaboratorId, date, originalShift });
    setSelectedShift(currentShift === null ? 'LIB' : currentShift);

    setTimeout(() => {
        if (noteInputRef.current) {
          noteInputRef.current.value = currentNoteValue;
        }
    }, 0);
    
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = () => {
    if (!selectedCell) return;

    const { collaboratorId, date, originalShift } = selectedCell;
    const note = noteInputRef.current?.value.trim() || '';
    const newShift = selectedShift === 'LIB' ? null : selectedShift;

    if (onAdminOverride) {
      onAdminOverride({ collaboratorId, date, shift: newShift, note, originalShift });
    } else {
      const dayKey = format(date, 'yyyy-MM-dd');
      const newOverrides = new Map(manualOverrides);
      let collaboratorShifts = newOverrides.get(collaboratorId);
      if (!collaboratorShifts) {
          collaboratorShifts = new Map();
      } else {
          collaboratorShifts = new Map(collaboratorShifts);
      }
      
      const shiftToSet: ManualOverride = {
          shift: newShift,
          note: note,
          originalShift: originalShift
      };
      collaboratorShifts.set(dayKey, shiftToSet);
      newOverrides.set(collaboratorId, collaboratorShifts);
      
      onManualOverridesChange(newOverrides);
    }
    
    setIsShiftModalOpen(false);
    setSelectedCell(null);
  };
  
  const handleDeleteOverride = () => {
    if (!selectedCell) return;
    const { collaboratorId, date } = selectedCell;

    const newOverrides = new Map(manualOverrides);
    const collaboratorShifts = newOverrides.get(collaboratorId);

    if (collaboratorShifts) {
        const newCollaboratorShifts = new Map(collaboratorShifts);
        const dayKey = format(date, 'yyyy-MM-dd');
        newCollaboratorShifts.delete(dayKey);
        
        if (newCollaboratorShifts.size === 0) {
            newOverrides.delete(collaboratorId);
        } else {
            newOverrides.set(collaboratorId, newCollaboratorShifts);
        }
        onManualOverridesChange(newOverrides);
    }
    
    setIsShiftModalOpen(false);
    setSelectedCell(null);
  };


  const handleCellDoubleClick = (collaboratorId: string, dayKey: string) => {
    router.push(`${attendancePath}?collaboratorId=${collaboratorId}&date=${dayKey}`);
  };
  
  const selectedCollaboratorName = useMemo(() => {
    if (!selectedCell) return '';
    return collaborators.find(c => c.id === selectedCell.collaboratorId)?.name || '';
  }, [selectedCell, collaborators]);

  const isCurrentCellOverridden = useMemo(() => {
    if (!selectedCell) return false;
    const { collaboratorId, date } = selectedCell;
    const dayKey = format(date, 'yyyy-MM-dd');
    return manualOverrides.get(collaboratorId)?.has(dayKey) || false;
  }, [selectedCell, manualOverrides]);

  return (
    <TooltipProvider>
      <Card className="overflow-hidden shadow-lg border-border">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
          <CardTitle className="text-lg font-semibold text-foreground">{periodTitle}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" size="icon" onClick={prevPeriod} aria-label="Periodo anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextPeriod} aria-label="Periodo siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
             {/* <Button variant="outline" onClick={() => setIsSummaryModalOpen(true)}>
              <BookUser className="mr-2 h-4 w-4" />
              Resumen
            </Button> */}
            {showConsiderationsButton && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isScheduleLocked}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Consideraciones
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onOpenAbsences}>
                    <HandPlatter className="mr-2 h-4 w-4" />
                    <span>Solicitudes</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onOpenTransfers}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    <span>Traslados</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onOpenRoleChanges}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span>Apoyo a Cargo</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onOpenVacations}>
                    <Plane className="mr-2 h-4 w-4" />
                    <span>Vacaciones</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onOpenLactations}>
                    <Baby className="mr-2 h-4 w-4" />
                    <span>Lactancia</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* <Button variant="outline" onClick={onOpenApprovals}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Aprobaciones
            </Button> */}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto relative">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/30">
                  <th className="sticky left-0 z-30 bg-card p-2 border-b border-r text-left font-semibold text-foreground whitespace-nowrap">
                    Colaborador
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        "p-2 border-b text-center font-medium text-muted-foreground w-16",
                        isToday(day) && "bg-primary/10"
                      )}
                    >
                      <div className="capitalize text-xs">{format(day, 'E', { locale: es })}</div>
                      <div className="text-lg font-semibold text-foreground">{format(day, 'd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collaborators.length > 0 ? (
                  collaborators.map((collaborator) => {
                    const collaboratorSchedule = schedule.get(collaborator.id);
                    const collaboratorBaseSchedule = baseSchedule.get(collaborator.id);
                    const collaboratorOverrides = manualOverrides.get(collaborator.id);
                    
                    const activeRoleChangeForPeriod = roleChanges.find(rc =>
                        rc.collaboratorId === collaborator.id &&
                        days.some(day => isWithinInterval(day, { start: rc.startDate, end: rc.endDate }))
                    );
                    const activeTransferForPeriod = transfers.find(t =>
                        t.collaboratorId === collaborator.id &&
                        days.some(day => isWithinInterval(day, { start: t.startDate, end: t.endDate }))
                    );
                    const lactationInfo = lactations.find(l => 
                        l.collaboratorId === collaborator.id &&
                        days.some(day => isWithinInterval(day, { start: l.startDate, end: l.endDate }))
                    );

                    return (
                    <tr key={collaborator.id} className="hover:bg-muted/50">
                      <td className="sticky left-0 z-20 bg-card p-2 border-b border-r whitespace-nowrap">
                        <div className="flex items-center gap-2 w-[180px]">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={collaborator.avatarUrl} alt={collaborator.name} data-ai-hint="person portrait"/>
                            <AvatarFallback>{collaborator.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-medium truncate flex items-center gap-1.5">
                              {collaborator.name}
                               {activeRoleChangeForPeriod && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className='flex items-center'><Briefcase className="h-3 w-3 text-purple-500" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-sm p-1">
                                      <p className="font-bold">Apoyo a Cargo</p>
                                      <p>Nuevo Cargo: <strong>{activeRoleChangeForPeriod.newJobTitle}</strong></p>
                                      <p>Nueva Ubicación: <strong>{activeRoleChangeForPeriod.newLocation}</strong></p>
                                      <p>Período: <strong>{format(activeRoleChangeForPeriod.startDate, 'dd/MM/yy')}</strong> al <strong>{format(activeRoleChangeForPeriod.endDate, 'dd/MM/yy')}</strong></p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {activeTransferForPeriod && !activeRoleChangeForPeriod && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className='flex items-center'><ArrowRightLeft className="h-3 w-3 text-blue-500" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-sm p-1">
                                      <p className="font-bold">Traslado Temporal</p>
                                      <p>Destino: <strong>{activeTransferForPeriod.newLocation}</strong></p>
                                      <p>Período: <strong>{format(activeTransferForPeriod.startDate, 'dd/MM/yy')}</strong> al <strong>{format(activeTransferForPeriod.endDate, 'dd/MM/yy')}</strong></p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {lactationInfo && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className='flex items-center'><Baby className="h-3 w-3 text-pink-500" /></span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-sm p-1">
                                      <p className="font-bold">Período de Lactancia</p>
                                      <p>Período: <strong>{format(lactationInfo.startDate, 'dd/MM/yy')}</strong> al <strong>{format(lactationInfo.endDate, 'dd/MM/yy')}</strong></p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">{collaborator.jobTitle}</span>
                          </div>
                        </div>
                      </td>
                      {days.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const shiftInfo = collaboratorSchedule?.get(dayKey);
                        const isPastDay = isBefore(day, today);
                        
                        if (isPastDay) {
                            return (
                                <td key={day.toISOString()} className={cn("p-1 border-b text-center h-20 w-16 bg-gray-50")}>
                                  <div className="rounded-md p-1 w-full h-full" />
                                </td>
                            );
                        }
                        
                        const isEditable = !isScheduleLocked && day >= today;
                        const isOnLactationThisDay = lactations.some(v => v.collaboratorId === collaborator.id && isWithinInterval(day, { start: v.startDate, end: v.endDate }));
                        
                        const { jobTitle: effectiveJobTitle } = getEffectiveDetails(collaborator, day, transfers, roleChanges);
                        const isSupportRoleDay = effectiveJobTitle !== collaborator.jobTitle;

                        const attendanceKey = `${dayKey}-${collaborator.id}`;
                        const attendanceRecord = attendanceForPeriod.get(attendanceKey);
                        
                        const renderAbsenceCell = (absenceType: string) => {
                             const absence = absences.find(a => a.collaboratorId === collaborator.id && a.type === absenceType && isWithinInterval(day, { start: a.startDate, end: a.endDate }));
                            return (
                                <td key={day.toISOString()} className={cn("p-1 border-b text-center h-20 w-16", isToday(day) && "bg-primary/10")}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="rounded-md p-1 text-xs w-full h-full flex items-center justify-center bg-destructive text-destructive-foreground font-semibold">
                                                {absenceType}
                                            </div>
                                        </TooltipTrigger>
                                        {absence && (
                                            <TooltipContent>
                                                <div className="text-sm p-1">
                                                    <p className="font-bold">{absence.description || `Ausencia (${absenceType})`}</p>
                                                    <p>Período: <strong>{format(absence.startDate, 'dd/MM/yy')}</strong> al <strong>{format(absence.endDate, 'dd/MM/yy')}</strong></p>
                                                </div>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </td>
                            );
                        };

                        if (['PM', 'LIC', 'SUS', 'RET', 'FI'].includes(shiftInfo || '')) {
                            return renderAbsenceCell(shiftInfo!);
                        }

                        if (shiftInfo === 'VAC') {
                            const vacation = vacations.find(v => v.collaboratorId === collaborator.id && isWithinInterval(day, { start: v.startDate, end: v.endDate }));
                            return (
                                <td key={day.toISOString()} className={cn(
                                  "p-1 border-b text-center h-20 w-16", 
                                  isToday(day) && "bg-primary/10"
                                )}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="rounded-md p-1 text-xs w-full h-full flex items-center justify-center bg-yellow-400 text-yellow-900 font-semibold">
                                                VAC
                                            </div>
                                        </TooltipTrigger>
                                        {vacation && (
                                            <TooltipContent>
                                                <div className="text-sm p-1">
                                                    <p className="font-bold">De Vacaciones</p>
                                                    <p>Período: <strong>{format(vacation.startDate, 'dd/MM/yy')}</strong> al <strong>{format(vacation.endDate, 'dd/MM/yy')}</strong></p>
                                                </div>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </td>
                            );
                        }
                        
                        if (shiftInfo === 'TRA') {
                            const activeTransfer = transfers.find(t => t.collaboratorId === collaborator.id && isWithinInterval(day, { start: t.startDate, end: t.endDate }));
                            return (
                                <td key={day.toISOString()} className={cn(
                                  "p-1 border-b text-center h-20 w-16", 
                                  isToday(day) && "bg-primary/10"
                                  )}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="rounded-md p-1 text-xs w-full h-full flex items-center justify-center bg-blue-500 text-white font-semibold">
                                                TRA
                                            </div>
                                        </TooltipTrigger>
                                        {activeTransfer && (
                                        <TooltipContent>
                                            <div className="text-sm p-1">
                                                <p className="font-bold">En Traslado</p>
                                                <p>Origen: <strong>{collaborator.location}</strong></p>
                                                <p>Destino: <strong>{activeTransfer.newLocation}</strong></p>
                                            </div>
                                        </TooltipContent>
                                        )}
                                    </Tooltip>
                                </td>
                            );
                        }
                        
                        const overrideInfo = collaboratorOverrides?.get(dayKey);
                        const isOverridden = !!overrideInfo;

                        const isPendingChange = notifications.some(n =>
                            n.recordId === `${dayKey}-${collaborator.id}` &&
                            Array.isArray(n.changes) &&
                            n.changes.some(change => change.field === 'scheduledShift') &&
                            n.status === 'pending'
                        );

                        const approvedChangeNotifications = notifications
                            .filter(n =>
                                n.recordId === `${dayKey}-${collaborator.id}` &&
                                Array.isArray(n.changes) &&
                                n.changes.some(change => change.field === 'scheduledShift') &&
                                n.status === 'approved'
                            )
                            .sort((a,b) => parseISO(b.actedAt || '1970-01-01').getTime() - parseISO(a.actedAt || '1970-01-01').getTime());
                        
                        const isApprovedChange = approvedChangeNotifications.length > 0;
                        const latestApprovedNotification = approvedChangeNotifications[0];
                        
                        const displayContent = shiftInfo || "LIB";
                        const isWorkShift = shiftInfo && shiftInfo !== 'LIB';
                        const originalShiftForCell = overrideInfo?.originalShift ?? (collaboratorBaseSchedule?.get(dayKey) || null);
                        
                        let cellBgClass = '';
                        if (isWorkShift) {
                            if(isPast(day) || isToday(day)) {
                                cellBgClass = 'bg-green-100 text-green-800';
                            } else {
                                cellBgClass = 'bg-yellow-100 text-yellow-800';
                            }
                        }
                        

                        const cellWrapperClasses = cn(
                          "rounded-md p-1 text-xs font-bold w-full h-full flex items-center justify-center relative transition-colors",
                          isWorkShift ? cellBgClass : "text-muted-foreground",
                          isOverridden && !isPendingChange && !isApprovedChange && "bg-blue-200 text-blue-800",
                          isSupportRoleDay && 'ring-2 ring-purple-500 ring-inset',
                          isPendingChange && 'bg-orange-100 text-orange-800',
                          isApprovedChange && !isPendingChange && 'bg-sky-100 text-sky-800',
                          isOnLactationThisDay && isWorkShift && "bg-pink-100 text-pink-800"
                        );

                        const CellContent = (
                            <div className={cellWrapperClasses}>
                                {isOnLactationThisDay && isWorkShift && <Baby className="h-3 w-3 absolute top-1 left-1" />}
                                {displayContent}
                            </div>
                        );

                        const showEditButton = isOverridden || isEditable || isPendingChange || isApprovedChange;

                        return (
                          <td
                            key={day.toISOString()}
                            className={cn(
                              "p-1 border-b text-center h-20 w-16 group relative",
                              isToday(day) && "bg-primary/10",
                              isPastDay && "cursor-pointer"
                            )}
                            onDoubleClick={isPastDay ? () => handleCellDoubleClick(collaborator.id, dayKey) : undefined}
                          >
                            <div className="flex flex-col items-center justify-center h-full w-full">
                               {isPastDay && isWorkShift ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>{CellContent}</TooltipTrigger>
                                        <TooltipContent>
                                          {attendanceRecord ? (
                                            <p>Asistencia: {attendanceRecord.registrationStatus}, {attendanceRecord.complianceStatus}</p>
                                          ) : (
                                            <p>Sin datos de asistencia</p>
                                          )}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                  <div className="h-full w-full">{CellContent}</div>
                                )}
                            </div>
                            
                            {showEditButton && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className={cn(
                                        "h-7 w-7 rounded-full transition-opacity absolute top-1 right-1 z-20",
                                        (isOverridden || isPendingChange || isApprovedChange) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                      )}
                                      onClick={() => handleOpenModal(collaborator.id, day)} 
                                      disabled={!isEditable}
                                    >
                                      {(isOverridden || isPendingChange || isApprovedChange) ? <Info className="h-4 w-4 text-muted-foreground" /> : <PlusCircle className="h-4 w-4 text-muted-foreground" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isApprovedChange && !isPendingChange && latestApprovedNotification ? (
                                        <div className="flex flex-col gap-1 text-sm p-1">
                                        <p className="font-bold text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Cambio Aprobado</p>
                                        {Array.isArray(latestApprovedNotification.changes) && latestApprovedNotification.changes.map( (c, i) => (
                                          <p key={i}>
                                            Cambiado de <span className="font-semibold text-destructive">{c.from ?? 'ninguno'}</span> a <span className="font-semibold text-green-600">{c.to ?? 'ninguno'}</span>.
                                          </p>
                                        ))}
                                        {latestApprovedNotification.adminObservation && <p><span className="font-semibold">Obs. Admin:</span> {latestApprovedNotification.adminObservation}</p>}
                                        {latestApprovedNotification.actedBy && latestApprovedNotification.actedAt && <p className="text-xs text-muted-foreground">Aprobado por {latestApprovedNotification.actedBy.split('@')[0]} el {format(parseISO(latestApprovedNotification.actedAt), 'dd/MM/yy HH:mm', { locale: es })}</p>}
                                        </div>
                                    ) : isPendingChange ? (
                                      <div className="flex flex-col gap-1 text-sm p-1">
                                        <p className="font-bold">Cambio Pendiente</p>
                                        <p>Esperando aprobación del coordinador.</p>
                                      </div>
                                    ) : isOverridden ? (
                                      <div className="flex flex-col gap-1 text-sm p-1">
                                        <p className="font-bold">Cambio Manual</p>
                                        {transfers.find(t => t.collaboratorId === collaborator.id && isWithinInterval(day, { start: t.startDate, end: t.endDate })) && (
                                          <div className='border-y border-border my-1 py-1'>
                                            <p><span className="font-semibold">Origen:</span> {collaborator.location}</p>
                                            <p><span className="font-semibold">Destino:</span> {transfers.find(t => t.collaboratorId === collaborator.id && isWithinInterval(day, { start: t.startDate, end: t.endDate }))!.newLocation}</p>
                                          </div>
                                        )}
                                        <p><span className="font-semibold">Original:</span> {originalShiftForCell || 'LIB'}</p>
                                        <p><span className="font-semibold">Actual:</span> {displayContent}</p>
                                        {overrideInfo.note && <p><span className="font-semibold">Novedad:</span> {overrideInfo.note}</p>}
                                        {isEditable && <p className="text-xs text-muted-foreground mt-2">Clic para editar</p>}
                                      </div>
                                    ) : (
                                      <p>{isEditable ? 'Añadir/Editar turno' : 'Horario bloqueado'}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )
                })
                ) : (
                  <tr>
                    <td colSpan={days.length + 1} className="text-center p-8 text-muted-foreground">
                      No se encontraron colaboradores con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
              {uniqueShifts.length > 0 && (
                <tfoot className="border-t-4 border-primary/20">
                  <tr>
                    <th 
                      colSpan={days.length + 1} 
                      className="p-3 text-left text-base font-bold text-foreground bg-card border-b"
                    >
                      Resumen de Turnos
                    </th>
                  </tr>
                  {uniqueShifts.map((shift) => (
                    <tr key={shift} className="hover:bg-muted/50 bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card p-2 border-b border-r whitespace-nowrap font-medium">
                        {shift}
                      </td>
                      {days.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const count = dailyCounts[dayKey]?.[shift] || 0;
                        const isPastDay = isBefore(day, today);
                        
                        return (
                          <td
                            key={day.toISOString()}
                            className="p-1 border-b text-center h-12 w-16"
                          >
                            <div className="w-full h-full flex items-center justify-center font-semibold">
                              { isPastDay ? '' : (count > 0 ? count : '')}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
      {/* <ScheduleSummary
        open={isSummaryModalOpen}
        onOpenChange={setIsSummaryModalOpen}
        collaborators={collaborators}
        schedule={schedule}
        days={days}
        periodTitle={periodTitle}
        onPrevPeriod={prevPeriod}
        onNextPeriod={nextPeriod}
        allCollaborators={allCollaborators}
        savedPeriodSettings={savedPeriodSettings}
        vacations={vacations}
        transfers={transfers}
        lactations={lactations}
        roleChanges={roleChanges}
        role={user?.role}
      /> */}
      <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
        <DialogContent
          className="sm:max-w-lg"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-popper-content-wrapper]')) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Asignar Turno y Novedad</DialogTitle>
            {selectedCell && (
              <DialogDescription>
                Editando turno para <strong>{selectedCollaboratorName}</strong> el día <strong>{format(selectedCell.date, 'd MMMM yyyy', { locale: es })}</strong>.
                <br/>
                Turno original: <strong>{selectedCell.originalShift || 'LIB'}</strong>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="shift-select">Turno</Label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger id="shift-select">
                    <SelectValue placeholder="Selecciona un turno" />
                  </SelectTrigger>
                  <SelectContent>
                      {allShiftTypes.map(shift => (
                          <SelectItem key={shift} value={shift}>
                            {shift === 'LIB' ? 'LIB (Libre)' : shift}
                          </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shift-note">Novedad (Opcional)</Label>
                <Textarea
                  id="shift-note"
                  placeholder="Ej: Permiso médico, calamidad..."
                  ref={noteInputRef}
                  className="mt-1"
                />
              </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {isCurrentCellOverridden ? (
              <Button variant="destructive" onClick={handleDeleteOverride} className="sm:mr-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Cambio
              </Button>
            ) : <div/>}
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsShiftModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveShift}>Guardar Cambio</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

    
