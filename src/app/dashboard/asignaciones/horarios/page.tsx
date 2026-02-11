
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PlusCircle, Edit, CheckCircle, Clock } from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, addDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { ShiftPattern } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WorkShift {
  id: string;
  jobTitle: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface CargoScheduleStatus {
  jobTitle: string;
  pattern: string[];
  isComplete: boolean;
  definedShifts: WorkShift[];
}

const editorSchema = z.object({
  shifts: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato inválido (HH:mm)."),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato inválido (HH:mm)."),
  }))
});

function ShiftEditorDialog({
  isOpen,
  onOpenChange,
  cargoData,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cargoData: CargoScheduleStatus | null;
}) {
  const firestore = useFirestore();
  const form = useForm<z.infer<typeof editorSchema>>({
    resolver: zodResolver(editorSchema),
    defaultValues: { shifts: [] },
  });

  const { control, handleSubmit, reset } = form;
  const { fields } = useFieldArray({ control, name: 'shifts' });

  useEffect(() => {
    if (isOpen && cargoData) {
      const shiftsForForm = cargoData.pattern
        .filter(name => name !== 'LIB')
        .map(shiftName => {
          const existingShift = cargoData.definedShifts.find(s => s.name === shiftName);
          return {
            id: existingShift?.id,
            name: shiftName,
            startTime: existingShift?.startTime || '00:00',
            endTime: existingShift?.endTime || '00:00',
          };
        });
      reset({ shifts: shiftsForForm });
    }
  }, [isOpen, cargoData, reset]);

  const onSubmit = async (data: z.infer<typeof editorSchema>) => {
    if (!firestore || !cargoData) return;
    
    const batch = writeBatch(firestore);
    const shiftsCollectionRef = collection(firestore, 'workShifts');

    data.shifts.forEach(shift => {
      const dataToSave = {
        jobTitle: cargoData.jobTitle,
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
      };

      if (shift.id) { // Update existing
        const docRef = doc(shiftsCollectionRef, shift.id);
        batch.update(docRef, dataToSave);
      } else { // Create new
        const docRef = doc(shiftsCollectionRef);
        batch.set(docRef, dataToSave);
      }
    });

    try {
      await batch.commit();
      toast({ title: "Horarios Guardados", description: `Se han guardado los horarios para ${cargoData.jobTitle}.`});
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving shifts:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los horarios.' });
    }
  };
  
  if (!cargoData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gestionar Horarios para: {cargoData.jobTitle}</DialogTitle>
          <DialogDescription>
            Define las horas de inicio y fin para cada turno del patrón.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                {fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardHeader className="p-4">
                      <CardTitle className="text-base">Turno: {field.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={control}
                          name={`shifts.${index}.startTime`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hora Inicio</FormLabel>
                              <FormControl><Input type="time" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={control}
                          name={`shifts.${index}.endTime`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hora Fin</FormLabel>
                              <FormControl><Input type="time" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Guardar Cambios</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


export default function WorkSchedulesPage() {
  const [cargoToEdit, setCargoToEdit] = useState<CargoScheduleStatus | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const firestore = useFirestore();
  const { data: allPatterns, isLoading: patternsLoading } = useCollection<ShiftPattern>(useMemo(() => firestore ? collection(firestore, 'shiftPatterns') : null, [firestore]));
  const { data: allShifts, isLoading: shiftsLoading } = useCollection<WorkShift>(useMemo(() => firestore ? collection(firestore, 'workShifts') : null, [firestore]));
  
  const scheduleSummary = useMemo<CargoScheduleStatus[]>(() => {
    if (!allPatterns || !allShifts) return [];

    return allPatterns.map(pattern => {
        const uniqueShiftsInPattern = Array.from(new Set(pattern.cycle.filter(s => s && s !== 'LIB')));
        const definedShiftsForCargo = allShifts.filter(s => s.jobTitle === pattern.jobTitle);
        
        const definedShiftNames = new Set(definedShiftsForCargo.map(s => s.name));
        
        const isComplete = uniqueShiftsInPattern.every(shiftName => definedShiftNames.has(shiftName));
        
        return {
            jobTitle: pattern.jobTitle,
            pattern: Array.from(new Set(pattern.cycle.filter(Boolean))),
            isComplete,
            definedShifts: definedShiftsForCargo,
        };
    }).sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));
  }, [allPatterns, allShifts]);

  const handleEditClick = (cargoData: CargoScheduleStatus) => {
    setCargoToEdit(cargoData);
    setIsEditorOpen(true);
  };

  const isLoading = patternsLoading || shiftsLoading;

  return (
    <>
      <ShiftEditorDialog
        isOpen={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        cargoData={cargoToEdit}
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Horarios de Trabajo</h1>
          <p className="text-sm text-muted-foreground mt-1">
              Define los horarios de inicio y fin para las abreviaturas de turnos de cada cargo.
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Horarios por Cargo</CardTitle>
            <CardDescription>
              Gestiona los horarios para cada cargo que tiene un patrón de turnos asignado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Cargo</TableHead>
                  <TableHead>Patrón de Turnos</TableHead>
                  <TableHead className="w-[150px]">Estado</TableHead>
                  <TableHead className="text-right w-[180px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell colSpan={4} className="h-12"><div className="bg-gray-200 rounded animate-pulse h-8 w-full"></div></TableCell>
                    </TableRow>
                  ))
                ) : scheduleSummary.length > 0 ? (
                  scheduleSummary.map((item) => (
                    <TableRow key={item.jobTitle}>
                      <TableCell className="font-medium">{item.jobTitle}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.pattern.map(shift => (
                            <Badge key={shift} variant="secondary">{shift}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.isComplete ? (
                          <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" /> Completo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300"><Clock className="mr-1 h-3 w-3" /> Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" onClick={() => handleEditClick(item)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Gestionar Horarios
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No hay cargos con patrones de turnos definidos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

    
