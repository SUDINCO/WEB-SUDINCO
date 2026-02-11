
"use client";

import React, { useState, useMemo } from 'react';
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
import { PlusCircle, Trash2, Edit, Clock } from 'lucide-react';
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

interface WorkShift {
  id: string;
  jobTitle: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface GenericOption {
    id: string;
    name: string;
}

const shiftSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato de hora inválido (HH:mm)."),
});

type ShiftFormData = z.infer<typeof shiftSchema>;

export default function WorkSchedulesPage() {
  const [selectedCargo, setSelectedCargo] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [shiftToDelete, setShiftToDelete] = useState<WorkShift | null>(null);

  const firestore = useFirestore();
  const shiftsCollectionRef = useMemo(() => firestore ? collection(firestore, 'workShifts') : null, [firestore]);
  const cargosCollectionRef = useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]);
  
  const { data: allShifts, isLoading: shiftsLoading } = useCollection<WorkShift>(shiftsCollectionRef);
  const { data: cargos, isLoading: cargosLoading } = useCollection<GenericOption>(cargosCollectionRef);

  const form = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { name: '', startTime: '', endTime: '' },
  });

  const cargoOptions = useMemo(() => {
      if (!cargos) return [];
      return cargos.map(c => ({ label: c.name, value: c.name }));
  }, [cargos]);

  const filteredShifts = useMemo(() => {
    if (!selectedCargo || !allShifts) return [];
    return allShifts.filter(s => s.jobTitle === selectedCargo);
  }, [selectedCargo, allShifts]);

  const handleOpenForm = (shift: WorkShift | null) => {
    setEditingShift(shift);
    if (shift) {
      form.reset(shift);
    } else {
      form.reset({ name: '', startTime: '00:00', endTime: '00:00' });
    }
    setIsFormOpen(true);
  };
  
  const onSubmit = async (data: ShiftFormData) => {
    if (!shiftsCollectionRef || !selectedCargo) return;

    const dataToSave = {
        ...data,
        jobTitle: selectedCargo,
    };

    try {
        if(editingShift) {
            const docRef = doc(shiftsCollectionRef, editingShift.id);
            await updateDoc(docRef, dataToSave);
            toast({ title: "Turno Actualizado", description: `El turno "${data.name}" ha sido guardado.` });
        } else {
            await addDoc(shiftsCollectionRef, dataToSave);
            toast({ title: "Turno Creado", description: `El turno "${data.name}" ha sido creado.` });
        }
        setIsFormOpen(false);
    } catch (error) {
        console.error("Error saving shift:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el turno.' });
    }
  };

  const handleDeleteShift = async () => {
    if (!shiftToDelete || !shiftsCollectionRef) return;
    try {
        await deleteDoc(doc(shiftsCollectionRef, shiftToDelete.id));
        toast({ title: 'Turno Eliminado', description: `El turno "${shiftToDelete.name}" ha sido eliminado.` });
    } catch(error) {
        console.error("Error deleting shift:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el turno.' });
    } finally {
        setShiftToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h1 className="text-lg font-semibold md:text-2xl">Horarios de Trabajo</h1>
            <p className="text-sm text-muted-foreground mt-1">
                Define los turnos de trabajo con horarios específicos para cada cargo.
            </p>
        </div>
        <Button onClick={() => handleOpenForm(null)} disabled={!selectedCargo}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Turno
        </Button>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Editar Turno' : 'Añadir Nuevo Turno'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nombre del Turno</FormLabel><FormControl><Input placeholder="Ej: Turno Día" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
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
                  {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Turno'}
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
                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente el turno de trabajo.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteShift} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Turnos por Cargo</CardTitle>
          <CardDescription>
            Selecciona un cargo para ver, crear, editar o eliminar sus turnos de trabajo.
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
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre del Turno</TableHead>
                                <TableHead>Hora de Inicio</TableHead>
                                <TableHead>Hora de Fin</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {shiftsLoading ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">Cargando turnos...</TableCell></TableRow>
                        ) : filteredShifts.length > 0 ? (
                            filteredShifts.map((shift) => (
                            <TableRow key={shift.id}>
                                <TableCell className="font-medium">{shift.name}</TableCell>
                                <TableCell>{shift.startTime}</TableCell>
                                <TableCell>{shift.endTime}</TableCell>
                                <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenForm(shift)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setShiftToDelete(shift)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                No hay turnos definidos para este cargo.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
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
