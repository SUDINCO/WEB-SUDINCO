
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Edit, Save, XCircle, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import type { ShiftPattern, GenericOption } from '@/lib/types';


const patternsFormSchema = z.object({
  patterns: z.array(z.object({
    jobTitle: z.string(),
    scheduleType: z.enum(['ROTATING', 'MONDAY_TO_FRIDAY']),
    cycle: z.array(z.string().nullable()).min(1, "El ciclo debe tener al menos un turno."),
  })),
});

const newPatternSchema = z.object({
  jobTitle: z.string().min(1, "Debe seleccionar un cargo."),
  scheduleType: z.enum(['ROTATING', 'MONDAY_TO_FRIDAY']),
  cycle: z.array(z.string().nullable()).min(1, "El ciclo debe tener al menos un turno."),
});


function RulesTabContent() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Reglas del Sistema de Turnos</CardTitle>
                <CardDescription>
                    El motor de horarios sigue estas reglas fundamentales para generar cronogramas lógicos, justos y funcionales.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Lógica de Generación de Horarios</h3>
                    <ul className="list-decimal pl-5 space-y-3 text-sm text-muted-foreground">
                        <li>
                            <strong className="text-foreground">Prioridad de Ausencias (Disponibilidad):</strong> Antes de asignar cualquier turno, el sistema verifica si el colaborador tiene vacaciones, un permiso médico, una licencia u otra ausencia registrada para ese día. Si es así, se asigna la ausencia correspondiente (ej. 'VAC', 'PM') y se ignora el patrón de turnos para esa fecha.
                        </li>
                        <li>
                            <strong className="text-foreground">Rol y Ubicación Efectivos:</strong> Para cada día del período, el sistema determina el cargo y la ubicación "efectiva" de cada colaborador, considerando traslados temporales y apoyos a otros cargos. El patrón de turnos se aplica basándose en este rol efectivo, no necesariamente en el original del colaborador.
                        </li>
                        <li>
                            <strong className="text-foreground">Respeto al Patrón por Cargo:</strong> La estructura de turnos (el ciclo) definida en "Patrones de Horarios" para el cargo efectivo del colaborador es la base para la asignación del cronograma.
                        </li>
                         <li>
                            <strong className="text-foreground">Rotación Equitativa y Consistente:</strong> Para garantizar una distribución justa de turnos y descansos a largo plazo, el punto de inicio de cada colaborador en su ciclo de trabajo se asigna de forma pseudoaleatoria. Esta asignación es consistente durante todo el período (del 21 al 20 del mes siguiente) para evitar saltos ilógicos.
                        </li>
                         <li>
                            <strong className="text-foreground">Condicionamiento de Cobertura (Cajeros):</strong> Para el cargo "Cajero de Recaudo", después de la asignación inicial basada en el ciclo, el sistema puede reajustar los turnos (M8, T8, N8) y los días libres para intentar cumplir con la demanda de personal configurada manualmente por el coordinador.
                        </li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Condiciones Especiales y Restricciones</h3>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                         <li>
                            <strong className="text-foreground">Descanso Post-Noche Obligatorio:</strong> Después de cualquier turno nocturno (ej. N8, N12) o de 24 horas (T24), el sistema forzará un día libre al día siguiente, independientemente de lo que dicte el ciclo de trabajo. El ciclo se pausará y se reanudará después de este descanso obligatorio.
                        </li>
                         <li>
                            <strong className="text-foreground">Jornada de Lunes a Viernes:</strong> Si el cargo efectivo de un colaborador está configurado con esta jornada, los sábados y domingos se asignarán automáticamente como libres. El ciclo de trabajo para estos roles solo avanzará en los días laborables (lunes a viernes).
                        </li>
                        <li>
                            <strong className="text-foreground">Protección al Personal en Lactancia:</strong> A las colaboradoras en período de lactancia activo no se les asignarán turnos nocturnos (N8, N12) ni de 24 horas. Si su ciclo indica un turno de este tipo, el sistema lo reemplazará por el primer turno diurno disponible en su patrón (ej. 'M8') para no afectar sus días laborables.
                        </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

function PatternsTabContent({ initialPatterns }: { initialPatterns: ShiftPattern[] }) {
    const { toast } = useToast();
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const firestore = useFirestore();

    const sortedPatterns = useMemo(() => {
        if (!initialPatterns) return [];
        return [...initialPatterns].sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));
    }, [initialPatterns]);

    const form = useForm<z.infer<typeof patternsFormSchema>>({
        resolver: zodResolver(patternsFormSchema),
        defaultValues: {
            patterns: sortedPatterns,
        },
    });

    React.useEffect(() => {
        form.reset({ patterns: sortedPatterns });
    }, [sortedPatterns, form]);

    const { fields, update } = useFieldArray({
        control: form.control,
        name: 'patterns',
        keyName: 'formId',
    });

    const onSubmit = async (data: z.infer<typeof patternsFormSchema>) => {
        if (!firestore) return;
        const patternToSave = data.patterns.find(p => p.jobTitle === editingId);
        if (!patternToSave) return;

        const cleanedPattern = {
            ...patternToSave,
            cycle: patternToSave.cycle.map(s => s === 'LIB' ? null : s?.toUpperCase() || null).filter(s => s !== '' && s !== undefined)
        };
        
        try {
            const patternRef = doc(firestore, 'shiftPatterns', cleanedPattern.jobTitle);
            await setDoc(patternRef, cleanedPattern, { merge: true });

            // The data will be re-fetched by useCollection, no need to update state manually
            setEditingId(null);
            toast({
                title: "Patrón Guardado",
                description: "El patrón de horario se ha actualizado."
            });
        } catch (error) {
            console.error("Error saving pattern:", error);
            toast({
                variant: 'destructive',
                title: "Error al guardar",
                description: "No se pudo actualizar el patrón de horario."
            });
        }
    };

    const handleEdit = (index: number) => {
        const pattern = form.getValues(`patterns.${index}`);
        const newCycle = [...(pattern.cycle || [])];
        while (newCycle.length < 15) { newCycle.push(''); }
        const displayCycle = newCycle.map(shift => (shift === null ? 'LIB' : shift === undefined ? '' : shift));
        update(index, { ...pattern, cycle: displayCycle as (string | null)[] });
        setEditingId(pattern.jobTitle);
    };

    const handleCancelEdit = (index: number) => {
        const originalPattern = sortedPatterns.find(p => p.jobTitle === fields[index].jobTitle);
        if (originalPattern) {
            update(index, originalPattern);
        }
        setEditingId(null);
    };

    const handleSaveRow = (index: number) => {
        form.trigger(`patterns.${index}`).then(isValid => {
            if (isValid) {
                onSubmit(form.getValues());
            } else {
                toast({
                    variant: 'destructive',
                    title: "Error de Validación",
                    description: "Por favor, corrija los errores en la fila antes de guardar."
                });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Patrones de Turnos por Cargo</CardTitle>
                <CardDescription>
                    Estos patrones definen la secuencia de turnos y la jornada que el generador de horarios asignará a cada colaborador.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted">
                                        <TableHead className="min-w-[200px]">Cargo</TableHead>
                                        <TableHead className="w-[200px]">Jornada</TableHead>
                                        <TableHead className="w-full">Patrón de Turnos (Ciclo)</TableHead>
                                        <TableHead className="text-center w-[120px]">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => {
                                        const isEditing = editingId === field.jobTitle;
                                        return (
                                            <TableRow key={field.formId}>
                                                <TableCell className="font-medium align-top pt-5">{field.jobTitle}</TableCell>
                                                <TableCell className="align-top pt-3">
                                                    {isEditing ? (
                                                        <FormField
                                                            control={form.control}
                                                            name={`patterns.${index}.scheduleType`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="ROTATING">Semana Completa (Rotativo)</SelectItem>
                                                                            <SelectItem value="MONDAY_TO_FRIDAY">Lunes a Viernes</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium text-muted-foreground">
                                                            {field.scheduleType === 'MONDAY_TO_FRIDAY' ? 'Lunes a Viernes' : 'Semana Completa'}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="align-top pt-2 w-full">
                                                    {isEditing ? (
                                                        <Controller
                                                            name={`patterns.${index}.cycle`}
                                                            control={form.control}
                                                            render={({ field: { onChange, value } }) => (
                                                                <div className="flex flex-wrap items-center gap-1 p-1 w-full">
                                                                    {(value as (string | null)[]).map((shift, i) => (
                                                                        <Input
                                                                            key={i}
                                                                            value={shift === null ? 'LIB' : shift ?? ''}
                                                                            onChange={(e) => {
                                                                                const newCycle = [...value];
                                                                                newCycle[i] = e.target.value.toUpperCase();
                                                                                onChange(newCycle);
                                                                            }}
                                                                            className="w-16 h-8 text-center"
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        />
                                                    ) : (
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            {(field.cycle || []).map((shift, i) => (
                                                                <Badge key={i} variant={shift ? 'default' : 'secondary'} className="text-xs">
                                                                    {shift || 'LIB'}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center align-top pt-2">
                                                    {isEditing ? (
                                                        <div className="flex gap-2 justify-center">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleSaveRow(index)}>
                                                                <Save className="h-4 w-4 text-green-600" />
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleCancelEdit(index)}>
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 justify-center">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(index)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export default function ScheduleSettingsPage() {
    const firestore = useFirestore();
    const { data: initialPatterns, isLoading: patternsLoading } = useCollection<ShiftPattern>(useMemo(() => firestore ? collection(firestore, 'shiftPatterns') : null, [firestore]));
    const { data: cargos, isLoading: cargosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
    
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const { toast } = useToast();

    const addForm = useForm<z.infer<typeof newPatternSchema>>({
        resolver: zodResolver(newPatternSchema),
        defaultValues: {
            jobTitle: '',
            scheduleType: 'ROTATING',
            cycle: Array(15).fill(''),
        }
    });

    const { control: addFormControl, handleSubmit: handleAddSubmit, reset: resetAddForm } = addForm;
    const { fields: cycleFields } = useFieldArray({
        control: addFormControl,
        name: 'cycle',
    });

    const availableCargos = useMemo(() => {
        if (!cargos || !initialPatterns) return [];
        const existingJobTitles = new Set(initialPatterns.map(p => p.jobTitle));
        return cargos.filter(c => !existingJobTitles.has(c.name)).map(c => ({ label: c.name, value: c.name }));
    }, [cargos, initialPatterns]);

    const onAddSubmit = async (data: z.infer<typeof newPatternSchema>) => {
        if (!firestore) return;

        const cleanedPattern = {
            ...data,
            jobTitle: data.jobTitle.trim().toUpperCase(),
            cycle: data.cycle.map(s => s === 'LIB' ? null : s?.toUpperCase() || null).filter(s => s !== '' && s !== undefined)
        };

        if (cleanedPattern.cycle.length === 0) {
            addForm.setError('cycle', { type: 'manual', message: 'El ciclo no puede estar vacío.' });
            return;
        }
        
        try {
            const batch = writeBatch(firestore);
            
            const patternRef = doc(firestore, 'shiftPatterns', cleanedPattern.jobTitle);
            batch.set(patternRef, cleanedPattern);

            // Check if cargo exists, if not, create it
            const cargoExists = cargos?.some(c => c.name.toUpperCase() === cleanedPattern.jobTitle);
            if (!cargoExists) {
                const newCargoRef = doc(collection(firestore, 'cargos'));
                batch.set(newCargoRef, { name: cleanedPattern.jobTitle });
                toast({
                    title: "Nuevo Cargo Creado",
                    description: `El cargo "${cleanedPattern.jobTitle}" se ha añadido al sistema.`
                });
            }

            await batch.commit();

            toast({
                title: "Patrón Creado",
                description: `Se ha creado un nuevo patrón para el cargo ${cleanedPattern.jobTitle}.`
            });
            setIsAddDialogOpen(false);
            resetAddForm({
                jobTitle: '',
                scheduleType: 'ROTATING',
                cycle: Array(15).fill(''),
            });
        } catch (error) {
            console.error("Error creating pattern:", error);
            toast({
                variant: 'destructive',
                title: "Error al crear",
                description: "No se pudo crear el nuevo patrón."
            });
        }
    };

    if (patternsLoading || cargosLoading) {
        return <div>Cargando configuración de horarios...</div>;
    }

    return (
        <>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Añadir Nuevo Patrón de Turno</DialogTitle>
                        <DialogDescription>
                            Selecciona un cargo y define su ciclo de trabajo y tipo de jornada.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...addForm}>
                        <form onSubmit={handleAddSubmit(onAddSubmit)} className="space-y-6 pt-4">
                             <FormField
                                control={addFormControl}
                                name="jobTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cargo</FormLabel>
                                        <Combobox 
                                            options={availableCargos}
                                            placeholder="Seleccionar o crear cargo..."
                                            searchPlaceholder="Buscar cargo..."
                                            notFoundMessage="No se encontró el cargo. Puedes crear uno nuevo."
                                            {...field}
                                            allowCreate
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={addFormControl}
                                name="scheduleType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Jornada</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="ROTATING">Semana Completa (Rotativo)</SelectItem>
                                                <SelectItem value="MONDAY_TO_FRIDAY">Lunes a Viernes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div>
                                <FormLabel>Patrón de Turnos (Ciclo)</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                    Introduce los turnos en secuencia. Usa 'LIB' para días libres. Los campos vacíos se ignorarán.
                                </p>
                                <div className="grid grid-cols-5 gap-2 mt-2">
                                     {cycleFields.map((field, index) => (
                                        <FormField
                                            key={field.id}
                                            control={addFormControl}
                                            name={`cycle.${index}`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input {...field} value={field.value ?? ''} className="text-center h-8" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit">Crear Patrón</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold md:text-2xl">Configuración de Patrones de Turno</h1>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir Patrón por Cargo
                    </Button>
                </div>

                <Tabs defaultValue="patterns">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="patterns">Patrones de Turnos</TabsTrigger>
                        <TabsTrigger value="rules">Reglas del Sistema</TabsTrigger>
                    </TabsList>
                    <TabsContent value="patterns" className="mt-6">
                        {initialPatterns && <PatternsTabContent initialPatterns={initialPatterns} />}
                    </TabsContent>
                    <TabsContent value="rules" className="mt-6">
                        <RulesTabContent />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
