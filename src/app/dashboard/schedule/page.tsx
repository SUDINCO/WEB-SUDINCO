
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  addMonths,
  format,
  set,
} from 'date-fns';
import { es } from 'date-fns/locale';

import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

import type { Collaborator, Vacation, TemporaryTransfer, Lactation, ShiftPattern, ManualOverrides, SavedSchedule, RoleChange, UserProfile } from '@/lib/types';
import { obtenerHorarioUnificado } from '@/lib/schedule-generator';

import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScheduleCalendar } from '@/components/schedule/ScheduleCalendar';
import { ConditioningPanel } from '@/components/schedule/ConditioningPanel';
import { Button } from '@/components/ui/button';
import { Save, BookUser, Edit, Trash2, ClipboardCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { TransferManager } from '@/components/schedule/TransferManager';
import { VacationManager } from '@/components/schedule/VacationManager';
import { LactationManager } from '@/components/schedule/LactationManager';
import { RoleChangeManager } from '@/components/schedule/RoleChangeManager';
import { AbsenceManager } from '@/components/schedule/AbsenceManager';
import { ScheduleSummary } from '@/components/schedule/ScheduleSummary';
import { ScheduleProvider, useScheduleState } from '@/context/schedule-context';
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
import { normalizeText } from '@/lib/utils';


type Option = {
  value: string;
  label: string;
  isSaved?: boolean;
};

// Simplified version of Collaborator for this context
type ScheduleCollaborator = {
  id: string;
  name: string;
  avatarUrl?: string;
  jobTitle: string;
  location: string;
  entryDate: Date;
  originalJobTitle: string; 
  originalLocation: string;
}

function SchedulePageContent() {
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedUbicacion, setSelectedUbicacion] = useState('todos');
  const [selectedCargo, setSelectedCargo] = useState('todos');
  const [selectedTrabajador, setSelectedTrabajador] = useState('todos');
  
  const [draftConditioning, setDraftConditioning] = useState({ morning: 4, afternoon: 4, night: 2 });
  const [isAutomatic, setIsAutomatic] = useState(true);
  const [manualOverrides, setManualOverrides] = useState<ManualOverrides>(new Map());
  
  const [isDirty, setIsDirty] = useState(false);
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);
  
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isLactationModalOpen, setIsLactationModalOpen] = useState(false);
  const [isRoleChangeModalOpen, setIsRoleChangeModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);


  const firestore = useFirestore();
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  const { data: vacationRequests, isLoading: vacationsLoading } = useCollection<Vacation>(useMemo(() => firestore ? collection(firestore, 'vacationRequests') : null, [firestore]));

  // Using context for shared schedule data
  const { shiftPatterns, savedSchedules, loading: contextLoading } = useScheduleState();


  // For now, these are empty arrays. We will fetch them later.
  const [transfers, setTransfers] = useState<TemporaryTransfer[]>([]);
  const [lactations, setLactations] = useState<Lactation[]>([]);
  const [roleChanges, setRoleChanges] = useState<RoleChange[]>([]);
  
  const { days, monthName, periodIdentifier } = useMemo(() => {
    const prevMonth = subMonths(currentDate, 1);
    const start = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 21);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), 20);

    const days = eachDayOfInterval({ start, end });
    const monthName = `${format(start, 'MMMM', { locale: es })} / ${format(end, 'MMMM yyyy', { locale: es })}`;
    const periodId = format(currentDate, 'yyyy-MM');
    return { days, monthName, periodIdentifier: periodId };
  }, [currentDate]);
  
  useEffect(() => {
    if (contextLoading || !selectedUbicacion || !selectedCargo) return;
    
    const saved = savedSchedules[`${periodIdentifier}_${selectedUbicacion}_${selectedCargo}`];

    if (saved) {
      setDraftConditioning(saved.conditioning);
      setIsAutomatic(saved.conditioning.isAutomatic);
      setIsScheduleLocked(true);
      setIsDirty(false);
    } else {
      // Set default conditioning for cashiers when no saved schedule is found
      if(selectedCargo === 'CAJERO DE RECAUDO' && selectedUbicacion !== 'todos') {
        setDraftConditioning({ morning: 4, afternoon: 4, night: 2 });
        setIsAutomatic(false); // Start in manual mode with defaults
      } else {
        setDraftConditioning({ morning: 0, afternoon: 0, night: 0 });
        setIsAutomatic(true);
      }
      setIsScheduleLocked(false);
      setIsDirty(false);
    }
  }, [periodIdentifier, selectedUbicacion, selectedCargo, savedSchedules, contextLoading]);
  
  const collaborators = useMemo((): ScheduleCollaborator[] => {
    if (!users) return [];
    return users.filter(u => u.Status === 'active').map(u => ({
        id: u.id,
        name: `${u.nombres} ${u.apellidos}`,
        jobTitle: normalizeText(u.cargo),
        location: normalizeText(u.ubicacion || 'N/A'),
        entryDate: new Date(), // Placeholder
        originalJobTitle: normalizeText(u.cargo),
        originalLocation: normalizeText(u.ubicacion || 'N/A'),
    }));
  }, [users]);
  
  const filteredCollaborators = useMemo(() => {
    if (!collaborators) return [];
    return collaborators.filter(user => 
        (selectedCargo === 'todos' || user.jobTitle === selectedCargo) &&
        (selectedUbicacion === 'todos' || user.location === selectedUbicacion) &&
        (selectedTrabajador === 'todos' || user.id === selectedTrabajador)
    );
  }, [collaborators, selectedCargo, selectedUbicacion, selectedTrabajador]);
  
  const handleConditioningChange = (newConditioning: { morning: number; afternoon: number; night: number; }, newIsAutomatic: boolean) => {
      setDraftConditioning(newConditioning);
      setIsAutomatic(newIsAutomatic);
      setIsDirty(true);
  };
  
  const schedule = useMemo(() => {
    const savedScheduleData = savedSchedules[`${periodIdentifier}_${selectedUbicacion}_${selectedCargo}`];

    if (savedScheduleData) {
        const scheduleMap = new Map<string, Map<string, string | null>>();
        for (const collabId in savedScheduleData.schedule) {
            const dayMap = new Map<string, string | null>();
            for (const dayKey in savedScheduleData.schedule[collabId]) {
                dayMap.set(dayKey, savedScheduleData.schedule[collabId][dayKey]);
            }
            scheduleMap.set(collabId, dayMap);
        }
        return scheduleMap;
    }

    if (contextLoading || collaborators.length === 0 || days.length === 0) {
        return new Map<string, Map<string, string | null>>();
    }

    const context = {
      vacations: (vacationRequests as Vacation[] | undefined) || [],
      transfers,
      lactations,
      roleChanges,
      manualOverrides,
      savedPeriodSettings: new Map(),
      notifications: [],
      shiftPatterns,
      isAutomatic,
      draftConditioning,
      filters: {
          location: selectedUbicacion,
          jobTitle: selectedCargo,
          collaboratorId: selectedTrabajador,
      },
      allCollaborators: collaborators as Collaborator[]
    };
    return obtenerHorarioUnificado(days, context, 'coordinator');
  }, [collaborators, days, vacationRequests, transfers, lactations, roleChanges, manualOverrides, shiftPatterns, contextLoading, isAutomatic, draftConditioning, selectedUbicacion, selectedCargo, selectedTrabajador, savedSchedules, periodIdentifier]);

  const dynamicFilterOptions = useMemo(() => {
    if (!users) return { cargos: [], ubicaciones: [], trabajadores: [] };
    const activeUsers = users.filter(u => u.Status === 'active');
    
    const uniqueCargos = [...new Set(activeUsers.map(u => normalizeText(u.cargo)).filter(Boolean))].sort();
    const cargosConStatus = uniqueCargos.map(cargo => {
        const isSaved = selectedUbicacion !== 'todos' && !!savedSchedules[`${periodIdentifier}_${normalizeText(selectedUbicacion)}_${normalizeText(cargo)}`];
        return { label: cargo, value: cargo, isSaved };
    });

    const uniqueUbicaciones = [...new Set(activeUsers.map(u => normalizeText(u.ubicacion)).filter(Boolean))].sort();
    const ubicacionesConStatus = uniqueUbicaciones.map(ubicacion => {
        const isSaved = selectedCargo !== 'todos' && !!savedSchedules[`${periodIdentifier}_${normalizeText(ubicacion)}_${normalizeText(selectedCargo)}`];
        return { label: ubicacion, value: ubicacion, isSaved };
    });

    const trabajadoresUnicos = activeUsers.map(u => ({label: `${u.nombres} ${u.apellidos}`, value: u.id}));

    return { 
        cargos: [{ label: 'Todos los Cargos', value: 'todos', isSaved: false }, ...cargosConStatus], 
        ubicaciones: [{ label: 'Todas las Ubicaciones', value: 'todos', isSaved: false }, ...ubicacionesConStatus], 
        trabajadores: [{ label: 'Todos los Trabajadores', value: 'todos', isSaved: false }, ...trabajadoresUnicos] 
    };
  }, [users, periodIdentifier, savedSchedules, selectedUbicacion, selectedCargo]);
  
  const ubicacionesOptions = useMemo<Option[]>(() => {
    return dynamicFilterOptions.ubicaciones;
  }, [dynamicFilterOptions.ubicaciones]);
  
  const cargosOptions = useMemo<Option[]>(() => {
    return dynamicFilterOptions.cargos;
  }, [dynamicFilterOptions.cargos]);

  const trabajadoresOptions = useMemo<Option[]>(() => {
    return dynamicFilterOptions.trabajadores;
  }, [dynamicFilterOptions.trabajadores]);


 const handleSaveSchedule = async () => {
    if (!firestore || isScheduleLocked || !user?.email) return;

    const userProfile = users?.find(u => u.email === user.email);
    
    if (!userProfile) {
        toast({ variant: "destructive", title: "Error de Usuario", description: "No se pudo encontrar tu perfil para guardar la aprobación. Por favor, vuelve a iniciar sesión." });
        return;
    }

    const scheduleObject: { [key: string]: { [key: string]: string | null } } = {};
    schedule.forEach((dayMap, collabId) => {
        const dayObject: { [key: string]: string | null } = {};
        dayMap.forEach((shift, dayKey) => {
            dayObject[dayKey] = shift === undefined ? null : shift;
        });
        scheduleObject[collabId] = dayObject;
    });

    const docId = `${periodIdentifier}_${selectedUbicacion}_${selectedCargo}`;

    const dataToSave: SavedSchedule = {
        id: docId,
        schedule: scheduleObject,
        conditioning: {
            isAutomatic,
            ...draftConditioning,
        },
        location: selectedUbicacion,
        jobTitle: selectedCargo,
        savedAt: Date.now(),
        savedBy: {
            name: userProfile.nombres + ' ' + userProfile.apellidos,
            jobTitle: userProfile.cargo,
        }
    };

    try {
        await setDoc(doc(firestore, "savedSchedules", docId), dataToSave);
        toast({
            title: "Horario Guardado",
            description: "El horario para este período ha sido guardado y bloqueado."
        });
        setIsScheduleLocked(true);
        setIsDirty(false);
    } catch (error) {
        console.error("Error saving schedule:", error);
        toast({
            variant: "destructive",
            title: "Error al Guardar",
            description: "No se pudo guardar el horario."
        });
    }
  };
  
  const handleModifySchedule = () => {
      setIsScheduleLocked(false);
      toast({
          title: "Horario Desbloqueado",
          description: "Ahora puedes realizar cambios en el cronograma."
      });
  };

  const confirmDeleteSchedule = async () => {
    if (!scheduleToDelete || !firestore) return;
    try {
        await deleteDoc(doc(firestore, "savedSchedules", scheduleToDelete));
        toast({
            title: "Aprobación Eliminada",
            description: "El horario guardado ha sido eliminado y desbloqueado."
        });
        setScheduleToDelete(null);
        // Force a re-evaluation of the lock state
        setIsScheduleLocked(false); 
        setIsSummaryModalOpen(false); // Close summary modal after deletion
    } catch (error) {
        console.error("Error deleting schedule:", error);
        toast({
            variant: "destructive",
            title: "Error al Eliminar",
            description: "No se pudo eliminar el horario guardado."
        });
        setScheduleToDelete(null);
    }
  };

  
  const isConditioningDisabled = selectedCargo !== 'CAJERO DE RECAUDO' || selectedUbicacion === 'todos';
  const isLoading = usersLoading || contextLoading || vacationsLoading;

  const isSaveDisabled = useMemo(() => {
    if (selectedCargo === 'CAJERO DE RECAUDO') {
      return selectedUbicacion === 'todos';
    }
    return selectedCargo === 'todos';
  }, [selectedCargo, selectedUbicacion]);
  
  if (isLoading) {
    return <div>Cargando datos del cronograma...</div>
  }

  return (
    <>
      <AlertDialog open={!!scheduleToDelete} onOpenChange={() => setScheduleToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro de eliminar esta aprobación?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará el registro del horario guardado y se desbloqueará para su edición.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteSchedule} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="space-y-6">
        <h1 className="text-lg font-semibold md:text-2xl">Cronograma de Horarios</h1>
          <div className="space-y-6">
              <Card>
                  <CardHeader>
                  <CardTitle>Filtros de Búsqueda</CardTitle>
                  <CardDescription>
                      Selecciona los filtros para encontrar a los trabajadores.
                  </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Combobox
                      options={ubicacionesOptions}
                      value={selectedUbicacion}
                      onChange={setSelectedUbicacion}
                      placeholder="Filtrar por ubicación..."
                      searchPlaceholder="Buscar ubicación..."
                      notFoundMessage="No se encontró la ubicación."
                  />
                  <Combobox
                      options={cargosOptions}
                      value={selectedCargo}
                      onChange={setSelectedCargo}
                      placeholder="Filtrar por cargo..."
                      searchPlaceholder="Buscar cargo..."
                      notFoundMessage="No se encontró el cargo."
                  />
                  <Combobox
                      options={trabajadoresOptions}
                      value={selectedTrabajador}
                      onChange={setSelectedTrabajador}
                      placeholder="Filtrar por trabajador..."
                      searchPlaceholder="Buscar trabajador..."
                      notFoundMessage="No se encontró el trabajador."
                  />
                  </CardContent>
              </Card>

              <ConditioningPanel
                  conditioning={draftConditioning}
                  isAutomatic={isAutomatic}
                  onDraftChange={handleConditioningChange}
                  isLocked={isScheduleLocked}
                  totalCollaborators={filteredCollaborators.length}
                  disabled={isConditioningDisabled}
              />
              
              <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsSummaryModalOpen(true)}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Aprobaciones
                  </Button>
                  {isScheduleLocked ? (
                    <Button onClick={handleModifySchedule} disabled={isSaveDisabled}>
                        <Edit className="mr-2 h-4 w-4" />
                        Modificar Cronograma
                    </Button>
                  ) : (
                    <Button onClick={handleSaveSchedule} disabled={isSaveDisabled}>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Horario
                    </Button>
                  )}
              </div>
              
              <ScheduleCalendar
                  collaborators={filteredCollaborators}
                  schedule={schedule}
                  baseSchedule={schedule} // For now, base is same as final
                  days={days}
                  currentDate={currentDate}
                  onDateChange={setCurrentDate}
                  periodTitle={monthName}
                  manualOverrides={manualOverrides}
                  onManualOverridesChange={(newOverrides) => {
                      setManualOverrides(newOverrides);
                      setIsDirty(true);
                  }}
                  isScheduleLocked={isScheduleLocked}
                  transfers={transfers}
                  vacations={(vacationRequests as Vacation[] | undefined) || []}
                  absences={(vacationRequests?.filter(r => r.requestType === 'permiso') as Vacation[] | undefined) || []}
                  lactations={lactations}
                  roleChanges={roleChanges}
                  allCollaborators={collaborators as Collaborator[]}
                  savedPeriodSettings={new Map()}
                  attendanceForPeriod={new Map()}
                  // Dummy functions for now
                  onOpenApprovals={() => {}}
                  onOpenTransfers={() => setIsTransferModalOpen(true)}
                  onOpenVacations={() => setIsVacationModalOpen(true)}
                  onOpenAbsences={() => setIsAbsenceModalOpen(true)}
                  onOpenLactations={() => setIsLactationModalOpen(true)}
                  onOpenRoleChanges={() => setIsRoleChangeModalOpen(true)}
              />
          </div>
          <TransferManager
              open={isTransferModalOpen}
              onOpenChange={setIsTransferModalOpen}
              transfers={transfers}
              onTransfersChange={setTransfers}
              collaborators={collaborators}
              locations={dynamicFilterOptions.ubicaciones.map(u => u.label).filter((l): l is string => !!l)}
          />
          <VacationManager
              open={isVacationModalOpen}
              onOpenChange={setIsVacationModalOpen}
              vacations={(vacationRequests as Vacation[] | undefined) || []}
              collaborators={collaborators}
              allUsers={users || []}
          />
          <AbsenceManager
              open={isAbsenceModalOpen}
              onOpenChange={setIsAbsenceModalOpen}
              requests={(vacationRequests as Vacation[] | undefined) || []}
              collaborators={collaborators}
              allUsers={users || []}
          />
          <LactationManager
              open={isLactationModalOpen}
              onOpenChange={setIsLactationModalOpen}
              lactations={lactations}
              onLactationsChange={setLactations}
              collaborators={collaborators}
          />
          <RoleChangeManager
              open={isRoleChangeModalOpen}
              onOpenChange={setIsRoleChangeModalOpen}
              roleChanges={roleChanges}
              onRoleChangesChange={setRoleChanges}
              collaborators={collaborators}
              jobTitles={dynamicFilterOptions.cargos.map(c => c.label).filter((l): l is string => !!l)}
              locations={dynamicFilterOptions.ubicaciones.map(u => u.label).filter((l): l is string => !!l)}
          />
          <ScheduleSummary
              open={isSummaryModalOpen}
              onOpenChange={setIsSummaryModalOpen}
              days={days}
              periodTitle={monthName}
              onPrevPeriod={() => setCurrentDate(subMonths(currentDate, 1))}
              onNextPeriod={() => setCurrentDate(addMonths(currentDate, 1))}
              savedSchedules={Object.values(savedSchedules)}
              onDeleteSchedule={setScheduleToDelete}
          />
      </div>
    </>
  );
}

export default function SchedulePage() {
    return (
        <ScheduleProvider>
            <SchedulePageContent />
        </ScheduleProvider>
    );
}
