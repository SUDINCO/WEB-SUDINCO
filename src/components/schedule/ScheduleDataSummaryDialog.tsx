
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '../ui/button';
import { format, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Collaborator } from '@/lib/types';

interface ScheduleDataSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Map<string, Map<string, string | null>>;
  collaborators: Collaborator[];
  days: Date[];
  periodTitle: string;
}

export function ScheduleDataSummaryDialog({ 
    open, 
    onOpenChange, 
    schedule,
    collaborators,
    days,
    periodTitle,
}: ScheduleDataSummaryDialogProps) {

  const summaryData = React.useMemo(() => {
    if (!schedule || collaborators.length === 0 || days.length === 0) {
      return { shiftCounts: new Map(), freeDaysByWeekday: new Array(7).fill(0) };
    }

    const shiftCounts = new Map<string, number>();
    const freeDaysByWeekday = new Array(7).fill(0); // 0: Domingo, 1: Lunes, ..., 6: Sábado

    collaborators.forEach(collaborator => {
      const collaboratorSchedule = schedule.get(collaborator.id);
      if (!collaboratorSchedule) return;

      days.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const shift = collaboratorSchedule.get(dayKey);

        if (shift && shift !== 'VAC' && shift !== 'TRA' && !['PM', 'LIC', 'SUS', 'RET', 'FI'].includes(shift)) {
          if (shift === 'LIB') {
            const dayOfWeek = getDay(day); // Sunday = 0, Monday = 1...
            freeDaysByWeekday[dayOfWeek]++;
          } else {
            shiftCounts.set(shift, (shiftCounts.get(shift) || 0) + 1);
          }
        } else if (shift === null) { // Also count null as a free day
          const dayOfWeek = getDay(day);
          freeDaysByWeekday[dayOfWeek]++;
        }
      });
    });

    const sortedShiftCounts = new Map([...shiftCounts.entries()].sort());

    return { shiftCounts: sortedShiftCounts, freeDaysByWeekday };
  }, [schedule, collaborators, days]);

  const weekDaysLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Resumen del Cronograma</DialogTitle>
          <DialogDescription>
             Resumen de turnos asignados y días libres para el período: {periodTitle}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-grow min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
                <h3 className="font-semibold mb-2">Resumen de Turnos Asignados</h3>
                <ScrollArea className="h-full border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Turno</TableHead>
                                <TableHead className="text-right">Total en Período</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryData.shiftCounts.size > 0 ? (
                                Array.from(summaryData.shiftCounts.entries()).map(([shift, count]) => (
                                    <TableRow key={shift}>
                                        <TableCell className="font-medium">{shift}</TableCell>
                                        <TableCell className="text-right">{count}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-24 text-center">No hay turnos asignados.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            <div className="flex flex-col">
                 <h3 className="font-semibold mb-2">Resumen de Días Libres</h3>
                 <ScrollArea className="h-full border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Día de la Semana</TableHead>
                                <TableHead className="text-right">Total Libres</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {weekDaysLabels.map((dayLabel, index) => (
                                <TableRow key={dayLabel}>
                                    <TableCell className="font-medium">{dayLabel}</TableCell>
                                    <TableCell className="text-right">{summaryData.freeDaysByWeekday[index]}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
