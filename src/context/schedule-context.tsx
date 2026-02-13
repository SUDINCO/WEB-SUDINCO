
"use client";

import * as React from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Holiday, OvertimeRule, ShiftPattern, ManualOverrides, Notification, SavedSchedule, Fine, GenericOption } from '@/lib/types';

// Define el tipo para el estado del contexto
interface ScheduleState {
  locations: GenericOption[];
  cargos: GenericOption[];
  fines: Fine[];
  holidays: Holiday[];
  overtimeRules: OvertimeRule[];
  shiftPatterns: ShiftPattern[];
  savedSchedules: { [key: string]: SavedSchedule };
  manualOverrides: ManualOverrides;
  notifications: Notification[];
  loading: boolean;
}

// Crea el contexto con un valor inicial undefined
const ScheduleContext = React.createContext<ScheduleState | undefined>(undefined);

// Hook personalizado para usar el contexto
export const useScheduleState = () => {
  const context = React.useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useScheduleState must be used within a ScheduleProvider');
  }
  return context;
};

// Proveedor del contexto
export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const firestore = useFirestore();

  // Carga de datos desde Firestore
  const { data: locationsData, isLoading: locationsLoading } = useCollection<GenericOption>(React.useMemo(() => firestore ? collection(firestore, 'ubicaciones') : null, [firestore]));
  const { data: cargosData, isLoading: cargosLoading } = useCollection<GenericOption>(React.useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
  const { data: overtimeRulesData, isLoading: overtimeRulesLoading } = useCollection<OvertimeRule>(React.useMemo(() => firestore ? collection(firestore, 'overtimeRules') : null, [firestore]));
  
  // Para los siguientes, como no tenemos colecciones, usamos datos de ejemplo.
  // En una implementación real, cargaríamos esto desde Firestore también.
  const fines: Fine[] = []; 
  const holidays: Holiday[] = [];

  const { data: shiftPatternsData, isLoading: patternsLoading } = useCollection<ShiftPattern>(React.useMemo(() => firestore ? collection(firestore, 'shiftPatterns') : null, [firestore]));
  const { data: savedSchedulesData, isLoading: savedSchedulesLoading } = useCollection<SavedSchedule>(React.useMemo(() => firestore ? collection(firestore, 'savedSchedules') : null, [firestore]));
  
  // Simulando datos que aún no están en Firestore
  const manualOverrides: ManualOverrides = new Map();
  const notifications: Notification[] = [];


  const savedSchedulesMap = React.useMemo(() => {
    const map: { [key: string]: SavedSchedule } = {};
    if (savedSchedulesData) {
      savedSchedulesData.forEach(schedule => {
        map[schedule.id] = schedule;
      });
    }
    return map;
  }, [savedSchedulesData]);

  const state: ScheduleState = {
    locations: locationsData || [],
    cargos: cargosData || [],
    fines,
    holidays,
    overtimeRules: overtimeRulesData || [],
    shiftPatterns: shiftPatternsData || [],
    savedSchedules: savedSchedulesMap,
    manualOverrides,
    notifications,
    loading: locationsLoading || cargosLoading || patternsLoading || savedSchedulesLoading || overtimeRulesLoading,
  };

  return (
    <ScheduleContext.Provider value={state}>
      {children}
    </ScheduleContext.Provider>
  );
};
