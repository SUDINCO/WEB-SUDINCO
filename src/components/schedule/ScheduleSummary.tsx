
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
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { SavedSchedule } from '@/lib/types';
import { format, set } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo } from 'react';

interface ScheduleSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: Date[];
  periodTitle: string;
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  savedSchedules: SavedSchedule[];
  onDeleteSchedule: (scheduleId: string) => void;
}

export function ScheduleSummary({ 
    open, 
    onOpenChange, 
    days, 
    periodTitle, 
    onPrevPeriod, 
    onNextPeriod,
    savedSchedules,
    onDeleteSchedule,
}: ScheduleSummaryProps) {
  const periodIdentifier = useMemo(() => {
    if (!days || days.length === 0) return '';
    const dateForPeriod = days[15] || days[0]; // Use a mid-period date
    return format(set(dateForPeriod, { date: 1 }), 'yyyy-MM');
  }, [days]);

  const approvedSchedules = useMemo(() => {
    if (!savedSchedules || !periodIdentifier) {
      return [];
    }
    
    return savedSchedules
      .filter(s => s.id.startsWith(periodIdentifier))
      .sort((a, b) => a.location.localeCompare(b.location) || a.jobTitle.localeCompare(b.jobTitle));

  }, [periodIdentifier, savedSchedules]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Resumen de Cronogramas Aprobados</DialogTitle>
          <DialogDescription>
             Aquí se muestran los cronogramas que ya han sido guardados y aprobados para el período seleccionado.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-2 py-4 border-y">
            <Button variant="outline" size="icon" onClick={onPrevPeriod} aria-label="Periodo anterior">
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-center min-w-[200px]">{periodTitle}</span>
            <Button variant="outline" size="icon" onClick={onNextPeriod} aria-label="Periodo siguiente">
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>

        <div className="flex-grow min-h-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Aprobado por</TableHead>
                  <TableHead>Fecha de Aprobación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedSchedules.length > 0 ? (
                  approvedSchedules.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.location}</TableCell>
                      <TableCell>{item.jobTitle}</TableCell>
                      <TableCell>
                         {item.savedBy ? `${item.savedBy.name} (${item.savedBy.jobTitle})` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {item.savedAt ? format(new Date(item.savedAt), 'dd/MM/yyyy, hh:mm a', { locale: es }) : '-'}
                      </TableCell>
                       <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={() => onDeleteSchedule(item.id)}>
                           <Trash2 className="h-4 w-4 text-destructive" />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                      No hay cronogramas aprobados para este período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
