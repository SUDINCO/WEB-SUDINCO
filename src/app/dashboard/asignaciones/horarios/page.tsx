
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { PlusCircle, Trash2, Edit, Clock, Watch } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import type { ShiftPattern } from '@/lib/types';


interface WorkShift {
  id: string;
  jobTitle: string;
  name: string;
  startTime: string;
  endTime: string;
}

const shiftSchema = z.object({
  name: z.string(), // Will be read-only in the form
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)."),
});

type ShiftFormData = z.infer<typeof shiftSchema>;

export default function WorkSchedulesPage() {
  const [selectedCargo, setSelectedCargo] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Partial<WorkShift> | null>(null);
  const [shiftToDelete, setShiftToDelete] = useState<WorkShift | null>(null);

  const firestore = useFirestore();
  const shiftsCollectionRef = useMemo(() => firestore ? collection(firestore, 'workShifts') : null, [firestore]);
  const patternsCollectionRef = useMemo(() => firestore ? collection(firestore, 'shiftPatterns') : null, [firestore]);
  
  const { data: allShifts, isLoading: shiftsLoading } = useCollection<WorkShift>(shiftsCollectionRef);
  const { data: allPatterns, isLoading: patternsLoading } = useCollection<ShiftPattern>(patternsCollectionRef);

  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { name: '', startTime: '00:00', endTime: '00:00' },
  });

  const cargoOptions = useMemo(() => {
    if (!allPatterns) return [];
    return allPatterns.map(p => ({ label: p.jobTitle, value: p.jobTitle }));
  }, [allPatterns]);

  const uniqueShiftsInPattern = useMemo(() => {
    if (!selectedCargo || !allPatterns) return [];
    const pattern = allPatterns.find(p => p.jobTitle === selectedCargo);
    if (!pattern || !pattern.cycle) return [];
    // Filter out null/empty strings and get unique values
    return Array.from(new Set(pattern.cycle.filter(Boolean)));
  }, [selectedCargo, allPatterns]);

  const definedShiftsForCargo = useMemo(() => {
    if (!selectedCargo || !allShifts) return [];
    return allShifts.filter(s => s.jobTitle === selectedCargo);
  }, [selectedCargo, allShifts]);

  const handleOpenForm = (shift: Partial<WorkShift>) => {
    setEditingShift(shift);
    form.reset({
        name: shift.name || '',
        startTime: shift.startTime || '06:00',
        endTime: shift.endTime || '18:00',
    });
    setIsFormOpen(true);
  };
  
  const onSubmit = async (data: ShiftFormData) => {
    if (!shiftsCollectionRef || !selectedCargo || !editingShift?.name) return;

    const dataToSave = {
        name: editingShift.name.toUpperCase(), // Ensure name is uppercase
        jobTitle: selectedCargo,
        startTime: data.startTime,
        endTime: data.endTime,
    };

    try {
        if(editingShift.id) { // It's an update
            const docRef = doc(shiftsCollectionRef, editingShift.id);
            await updateDoc(docRef, dataToSave);
            toast({ title: "Horario Actualizado", description: `El horario para el turno "${dataToSave.name}" ha sido guardado.` });
        } else { // It's a new definition
            await addDoc(shiftsCollectionRef, dataToSave);
            toast({ title: "Horario Creado", description: `El horario para el turno "${dataToSave.name}" ha sido creado.` });
        }
        setIsFormOpen(false);
        setEditingShift(null);
    } catch (error) {
        console.error("Error saving shift:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el horario.' });
    }
  };

  const handleDeleteShift = async () => {
    if (!shiftToDelete || !shiftsCollectionRef) return;
    try {
        await deleteDoc(doc(shiftsCollectionRef, shiftToDelete.id));
        toast({ title: 'Horario Eliminado', description: `El horario para el turno "${shiftToDelete.name}" ha sido eliminado.` });
    } catch(error) {
        console.error("Error deleting shift:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el horario.' });
    } finally {
        setShiftToDelete(null);
    }
  };

  const isLoading = shiftsLoading || patternsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">Horarios de Trabajo</h1>
        <p className="text-sm text-muted-foreground mt-1">
            Define los horarios de inicio y fin para las abreviaturas de turnos de cada cargo.
        </p>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Definir Horario para Turno: {editingShift?.name}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="startTime" render={({ field }) => (
                  <FormItem><FormLabel>Hora de Inicio</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endTime" render={({ field }) => (
                  <FormItem><FormLabel>Hora de Fin</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Horario'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!shiftToDelete} onOpenChange={() => setShiftToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente la definición de este horario.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteShift} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Horarios por Cargo</CardTitle>
          <CardDescription>
            Selecciona un cargo para ver los turnos definidos en su patrón y establecer sus horarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="max-w-sm mb-6">
                <Combobox 
                    options={cargoOptions}
                    value={selectedCargo}
                    onChange={setSelectedCargo}
                    placeholder="Selecciona un cargo..."
                    searchPlaceholder="Buscar cargo..."
                    notFoundMessage="No se encontró el cargo."
                />
            </div>
            {selectedCargo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading ? <p>Cargando...</p> : uniqueShiftsInPattern.map(shiftName => {
                        if (shiftName.toUpperCase() === 'LIB') {
                            return (
                                <Card key={shiftName} className="bg-gray-50 dark:bg-gray-800">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">TURNO LIBRE</CardTitle>
                                        <Badge variant="outline">LIB</Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-xs text-muted-foreground">Este es un día libre y no requiere horario.</p>
                                    </CardContent>
                                </Card>
                            )
                        }

                        const existingShift = definedShiftsForCargo.find(s => s.name === shiftName);

                        return (
                            <Card key={shiftName}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Turno: {shiftName}</CardTitle>
                                    <Watch className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    {existingShift ? (
                                        <div className="space-y-3">
                                            <div className="text-2xl font-bold">{existingShift.startTime} - {existingShift.endTime}</div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleOpenForm(existingShift)}>
                                                    <Edit className="mr-2 h-4 w-4"/> Editar
                                                </Button>
                                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShiftToDelete(existingShift)}>
                                                    <Trash2 className="mr-2 h-4 w-4"/> Eliminar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                             <p className="text-2xl font-bold text-muted-foreground">--:-- - --:--</p>
                                            <Button size="sm" onClick={() => handleOpenForm({ name: shiftName })}>
                                                <PlusCircle className="mr-2 h-4 w-4"/> Definir Horario
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/50 rounded-md">
                    <Clock className="h-10 w-10 mb-2" />
                    <p className="font-medium">Por favor, selecciona un cargo para comenzar.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
