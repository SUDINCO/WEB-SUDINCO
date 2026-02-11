
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Briefcase, PlusCircle, Search, Edit, Trash2, UserPlus, Users, UserCheck, History, Star, Activity, UserRound, CheckCircle, Send, LoaderCircle, Hand, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, addDoc, updateDoc, writeBatch, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { format, isBefore, startOfToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Candidate, HiringProcess, ProfileEvaluation, HiringProcessWithShortlist, UserProfile, GenericOption } from '@/lib/types';


const hiringProcessSchema = z.object({
  empresa: z.string().min(1, 'La empresa es obligatoria.'),
  cargo: z.string().min(1, 'El cargo es obligatorio.'),
  formacionAcademicaPct: z.coerce.number().min(0, "Debe ser >= 0").max(100, "Debe ser <= 100"),
  conocimientosTecnicosPct: z.coerce.number().min(0, "Debe ser >= 0").max(100, "Debe ser <= 100"),
  experienciaPct: z.coerce.number().min(0, "Debe ser >= 0").max(100, "Debe ser <= 100"),
  competenciasPct: z.coerce.number().min(0, "Debe ser >= 0").max(100, "Debe ser <= 100"),
  tiempoRequeridoNumero: z.coerce.number().min(1, 'Debe ser al menos 1.'),
  tiempoRequeridoUnidad: z.enum(['MESES', 'AÑOS']),
  tipoContrato: z.enum(['INDEFINIDO', 'EMERGENTE']),
  ubicacion: z.string().min(1, 'La ubicación es obligatoria.'),
  departamento: z.string().min(1, 'El departamento es obligatorio.'),
  jefeInmediato: z.string().email('Debe ser un email válido para el jefe inmediato.'),
  status: z.enum(['open', 'closed', 'on-hold']).default('open'),
  effectiveHiringDate: z.date().optional(),
  justificationForRetroactive: z.string().optional(),
}).refine(data => {
    return (data.formacionAcademicaPct + data.conocimientosTecnicosPct + data.experienciaPct + data.competenciasPct) === 100;
}, {
    message: 'La suma de los porcentajes debe ser 100.',
    path: ['competenciasPct'], 
}).refine(data => {
    if (data.effectiveHiringDate && isBefore(data.effectiveHiringDate, startOfToday())) {
        return !!data.justificationForRetroactive && data.justificationForRetroactive.trim().length > 0;
    }
    return true;
}, {
    message: 'La justificación es obligatoria para procesos retroactivos.',
    path: ['justificationForRetroactive'],
});


const candidateSchema = z.object({
    photoUrl: z.string().optional(),
    cedula: z.string().length(10, 'La cédula debe tener 10 caracteres.'),
    celular: z.string().length(10, 'El celular debe tener 10 dígitos.'),
    apellidos: z.string().min(1, 'Los apellidos son obligatorios.'),
    nombres: z.string().min(1, 'Los nombres son obligatorios.'),
    edad: z.coerce.number().min(18, 'La edad debe ser mayor a 18.'),
    nivelEstudios: z.string().min(1, 'El nivel de estudios es obligatorio.'),
    institucion: z.string().optional(),
    tituloProfesional: z.string().optional(),
    anosExperiencia: z.coerce.number().min(0, 'La experiencia es obligatoria.'),
    cargosAplicables: z.array(z.string()).min(1, 'Debes seleccionar al menos un cargo.'),
    observacion: z.string().optional(),
}).refine(data => {
    const higherEducationLevels = [
        "BACHILLERATO",
        "EDUCACIÓN SUPERIOR – TÉCNICO / TECNOLÓGICO",
        "EDUCACIÓN SUPERIOR – UNIVERSITARIA",
        "EDUCACIÓN SUPERIOR – DE POSGRADO (ESPECIALIZACIÓN, MAESTRÍA, DOCTORADO)"
    ];
    if (higherEducationLevels.includes(data.nivelEstudios)) {
        return !!data.institucion && !!data.tituloProfesional;
    }
    return true;
}, {
    message: "Institución y título son obligatorios para este nivel de estudios.",
    path: ["institucion"],
}).refine(data => {
    const higherEducationLevels = [
        "BACHILLERATO",
        "EDUCACIÓN SUPERIOR – TÉCNICO / TECNOLÓGICO",
        "EDUCACIÓN SUPERIOR – UNIVERSITARIA",
        "EDUCACIÓN SUPERIOR – DE POSGRADO (ESPECIALIZACIÓN, MAESTRÍA, DOCTORADO)"
    ];
    if (higherEducationLevels.includes(data.nivelEstudios)) {
        return !!data.tituloProfesional;
    }
    return true;
}, {
    message: "El título profesional es obligatorio para este nivel de estudios.",
    path: ["tituloProfesional"],
});

const evaluationSchema = z.object({
  formacionAcademica: z.coerce.number().min(0).max(1),
  conocimientosTecnicos: z.coerce.number().min(1).max(10),
  experiencia: z.coerce.number().min(0).max(20),
  competencias: z.coerce.number().min(1).max(5),
  status: z.enum(['C', 'NC']),
  aspiracionSalarial: z.coerce.number().min(0, "La aspiración salarial no puede ser negativa.").default(0),
});


const normalizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
      .normalize('NFD') 
      .replace(/[\u0300-\u036f]/g, '') 
      .toUpperCase() 
      .replace(/\s+/g, ' ') 
      .trim();
};

const NIVELES_ESTUDIOS = [
    "NO APLICA",
    "EDUCACIÓN GENERAL BÁSICA",
    "BACHILLERATO",
    "EDUCACIÓN SUPERIOR – TÉCNICO / TECNOLÓGICO",
    "EDUCACIÓN SUPERIOR – UNIVERSITARIA",
    "EDUCACIÓN SUPERIOR – DE POSGRADO (ESPECIALIZACIÓN, MAESTRÍA, DOCTORADO)"
];

function CreateProcessDialog({ open, onOpenChange, onProcessSubmit, uniqueOptions, editingProcess }: { open: boolean, onOpenChange: (open: boolean) => void, onProcessSubmit: (data: z.infer<typeof hiringProcessSchema>) => void, uniqueOptions: any, editingProcess: HiringProcess | null }) {
    const processForm = useForm<z.infer<typeof hiringProcessSchema>>({
        resolver: zodResolver(hiringProcessSchema),
    });

    const watchedDate = processForm.watch('effectiveHiringDate');
    const [isRetroactive, setIsRetroactive] = useState(false);

    useEffect(() => {
        setIsRetroactive(!!(watchedDate && isBefore(watchedDate, startOfToday())));
    }, [watchedDate]);

    useEffect(() => {
        if (open) {
            if (editingProcess) {
                const [numero, unidad] = editingProcess.tiempoRequerido?.split(' ') || ['1', 'MESES'];
                processForm.reset({
                    ...editingProcess,
                    formacionAcademicaPct: editingProcess.formacionAcademicaPct ?? 10,
                    conocimientosTecnicosPct: editingProcess.conocimientosTecnicosPct ?? 40,
                    experienciaPct: editingProcess.experienciaPct ?? 20,
                    competenciasPct: editingProcess.competenciasPct ?? 30,
                    tiempoRequeridoNumero: parseInt(numero, 10) || 1,
                    tiempoRequeridoUnidad: (unidad?.toUpperCase() === 'AÑOS' ? 'AÑOS' : 'MESES'),
                    effectiveHiringDate: editingProcess.effectiveHiringDate ? parseISO(editingProcess.effectiveHiringDate) : undefined,
                    justificationForRetroactive: editingProcess.justificationForRetroactive || '',
                });
            } else {
                processForm.reset({
                    empresa: '',
                    cargo: '',
                    formacionAcademicaPct: 10,
                    conocimientosTecnicosPct: 40,
                    experienciaPct: 20,
                    competenciasPct: 30,
                    tiempoRequeridoNumero: 1,
                    tiempoRequeridoUnidad: 'MESES',
                    tipoContrato: 'INDEFINIDO',
                    ubicacion: '',
                    departamento: '',
                    jefeInmediato: '',
                    status: 'open',
                    effectiveHiringDate: undefined,
                    justificationForRetroactive: '',
                });
            }
        }
    }, [open, editingProcess, processForm]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editingProcess ? <Edit className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                        {editingProcess ? 'Editar Proceso de Contratación' : 'Crear Nuevo Proceso de Contratación'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingProcess ? 'Modifica los detalles del puesto.' : 'Define el puesto que necesitas cubrir.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...processForm}>
                    <form onSubmit={processForm.handleSubmit(onProcessSubmit)} className="space-y-4 pt-4">
                        
                         <FormField
                            control={processForm.control}
                            name="effectiveHiringDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Fecha de Ingreso (Opcional)</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-[240px] pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value ? (
                                        format(field.value, "PPP", { locale: es })
                                        ) : (
                                        <span>Seleccionar fecha</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                    locale={es}
                                    />
                                </PopoverContent>
                                </Popover>
                                <FormDescription>
                                   Si se selecciona una fecha pasada, el proceso se marcará como retroactivo y se requerirá justificación.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         {isRetroactive && (
                            <FormField
                                control={processForm.control}
                                name="justificationForRetroactive"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Justificación de Proceso Retroactivo</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Explique por qué este proceso se registra después de la fecha de ingreso..." {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={processForm.control}
                                name="empresa"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Empresa</FormLabel>
                                        <Combobox
                                            options={uniqueOptions.empresas.map((val: string) => ({ label: val, value: val }))}
                                            placeholder="Selecciona o crea una empresa..."
                                            searchPlaceholder="Buscar empresa..."
                                            notFoundMessage="No se encontró la empresa."
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            allowCreate
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={processForm.control}
                                name="cargo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cargo</FormLabel>
                                        <Combobox
                                            options={uniqueOptions.cargos.map((val: string) => ({ label: val, value: val }))}
                                            placeholder="Selecciona o crea un cargo..."
                                            searchPlaceholder="Buscar cargo..."
                                            notFoundMessage="No se encontró el cargo."
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            allowCreate
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div>
                            <FormLabel>Ponderación de Evaluación (%)</FormLabel>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 items-start">
                                <FormField control={processForm.control} name="formacionAcademicaPct" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Form. Académica</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={processForm.control} name="conocimientosTecnicosPct" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Conoc. Técnicos</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={processForm.control} name="experienciaPct" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Experiencia</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )}/>
                                <FormField control={processForm.control} name="competenciasPct" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">Competencias</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <FormLabel>Tiempo Requerido</FormLabel>
                                <div className="flex gap-2 items-start mt-2">
                                    <FormField
                                        control={processForm.control}
                                        name="tiempoRequeridoNumero"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <Input type="number" min="1" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={processForm.control}
                                        name="tiempoRequeridoUnidad"
                                        render={({ field }) => (
                                            <FormItem className="w-32">
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="MESES">Meses</SelectItem>
                                                        <SelectItem value="AÑOS">Años</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                             <FormField
                                control={processForm.control}
                                name="tipoContrato"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Contrato</FormLabel>
                                         <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                                                <SelectItem value="EMERGENTE">Emergente</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={processForm.control}
                                name="ubicacion"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ubicación</FormLabel>
                                        <Combobox
                                            options={uniqueOptions.ubicaciones.map((val: string) => ({ label: val, value: val }))}
                                            placeholder="Selecciona o crea una ubicación..."
                                            searchPlaceholder="Buscar ubicación..."
                                            notFoundMessage="No se encontró la ubicación."
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            allowCreate
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={processForm.control}
                                name="departamento"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Departamento o Área</FormLabel>
                                        <Combobox
                                            options={uniqueOptions.departamentos.map((val: string) => ({ label: val, value: val }))}
                                            placeholder="Selecciona o crea un depto..."
                                            searchPlaceholder="Buscar departamento..."
                                            notFoundMessage="No se encontró el depto."
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            allowCreate
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={processForm.control}
                                name="jefeInmediato"
                                render={({ field }) => (
                                    <FormItem className="col-span-1 md:col-span-2">
                                        <FormLabel>Jefe Inmediato</FormLabel>
                                        <Combobox
                                            options={uniqueOptions.jefes.map((jefe: UserProfile) => ({ label: `${jefe.nombres} ${jefe.apellidos} (${jefe.cargo})`, value: jefe.email }))}
                                            placeholder="Selecciona un jefe inmediato..."
                                            searchPlaceholder="Buscar por nombre o cargo..."
                                            notFoundMessage="No se encontró el jefe."
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={processForm.formState.isSubmitting}>
                                {editingProcess ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                {processForm.formState.isSubmitting ? "Guardando..." : (editingProcess ? "Guardar Cambios" : "Crear Proceso")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

function AddCandidateDialog({ open, onOpenChange, allCandidates, editingCandidate, onCandidateSaved, cargoOptions }: { open: boolean, onOpenChange: (open: boolean) => void, allCandidates: Candidate[], editingCandidate: Candidate | null, onCandidateSaved: (candidate: Omit<Candidate, 'id'>) => void, cargoOptions: string[] }) {
    const form = useForm<z.infer<typeof candidateSchema>>({
        resolver: zodResolver(candidateSchema),
        defaultValues: {
            photoUrl: '',
            cedula: '',
            celular: '',
            apellidos: '',
            nombres: '',
            edad: 18,
            nivelEstudios: '',
            institucion: '',
            tituloProfesional: '',
            anosExperiencia: 0,
            cargosAplicables: [],
            observacion: '',
        },
    });

    const [experienceUnit, setExperienceUnit] = React.useState<'AÑOS' | 'MESES'>('AÑOS');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const watchedNivelEstudios = form.watch('nivelEstudios');

    const showConditionalFields = useMemo(() => {
        const levels = [
            "BACHILLERATO",
            "EDUCACIÓN SUPERIOR – TÉCNICO / TECNOLÓGICO",
            "EDUCACIÓN SUPERIOR – UNIVERSITARIA",
            "EDUCACIÓN SUPERIOR – DE POSGRADO (ESPECIALIZACIÓN, MAESTRÍA, DOCTORADO)"
        ];
        return levels.includes(watchedNivelEstudios);
    }, [watchedNivelEstudios]);

    useEffect(() => {
        if (open) {
            if (editingCandidate) {
                form.reset({
                    ...editingCandidate,
                    celular: editingCandidate.celular || '',
                    institucion: editingCandidate.institucion || '',
                    tituloProfesional: editingCandidate.tituloProfesional || '',
                    observacion: editingCandidate.observacion || '',
                    photoUrl: editingCandidate.photoUrl || '',
                });
                setImagePreview(editingCandidate.photoUrl || null);
                const years = editingCandidate.anosExperiencia || 0;
                if (years > 0 && years < 1) {
                    setExperienceUnit('MESES');
                } else {
                    setExperienceUnit('AÑOS');
                }
            } else {
                form.reset({
                    photoUrl: '',
                    cedula: '',
                    celular: '',
                    apellidos: '',
                    nombres: '',
                    edad: 18,
                    nivelEstudios: '',
                    institucion: '',
                    tituloProfesional: '',
                    anosExperiencia: 0,
                    cargosAplicables: [],
                    observacion: '',
                });
                setImagePreview(null);
                setExperienceUnit('AÑOS');
            }
        }
    }, [open, editingCandidate, form]);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                toast({
                    variant: 'destructive',
                    title: 'Imagen demasiado grande',
                    description: 'Por favor, selecciona una imagen de menos de 2MB.',
                });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setImagePreview(result);
                form.setValue('photoUrl', result, { shouldValidate: true });
            };
            reader.readAsDataURL(file);
        }
    };


    async function onSubmit(data: z.infer<typeof candidateSchema>) {
        const isEditing = !!editingCandidate;
        const cedulaToCheck = data.cedula;

        if (!isEditing) {
            const existingCandidate = allCandidates?.find(c => c.cedula === cedulaToCheck);
            if (existingCandidate) {
                toast({
                    variant: "destructive",
                    title: "Candidato ya existe",
                    description: `Ya existe un candidato con la cédula ${cedulaToCheck} en el repositorio.`
                });
                return;
            }
        }
        
        const normalizedData = {
            ...data,
            apellidos: normalizeText(data.apellidos),
            nombres: normalizeText(data.nombres),
            institucion: normalizeText(data.institucion),
            tituloProfesional: normalizeText(data.tituloProfesional),
            cargosAplicables: data.cargosAplicables.map(normalizeText),
        };
        
        onCandidateSaved(normalizedData);
        toast({ title: isEditing ? "Candidato Actualizado" : "Candidato Añadido", description: `${data.nombres} ${data.apellidos} ha sido guardado.` });
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editingCandidate ? <Edit className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        {editingCandidate ? 'Editar Candidato del Repositorio' : 'Añadir Nuevo Candidato al Repositorio'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingCandidate ? 'Actualiza la información del candidato.' : `Completa la información del candidato para añadirlo al repositorio general.`}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-4">
                        
                        <FormField control={form.control} name="photoUrl" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Foto del Candidato (Opcional)</FormLabel>
                                <div className="flex items-center gap-4">
                                    {imagePreview ? (
                                        <Image src={imagePreview} alt="Vista previa" width={80} height={80} className="rounded-full aspect-square object-cover" unoptimized />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                                            <UserRound className="w-10 h-10 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                        <FormControl>
                                            <Input
                                                type="file"
                                                accept="image/png, image/jpeg"
                                                onChange={handleImageChange}
                                            />
                                        </FormControl>
                                        <FormDescription>La imagen debe ser JPG o PNG y pesar menos de 2MB.</FormDescription>
                                    </div>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField control={form.control} name="cedula" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cédula</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Ej: 0987654321" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="celular" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Celular</FormLabel>
                                     <FormControl>
                                      <Input type="number" placeholder="Ej: 0991234567" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <FormField control={form.control} name="edad" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Edad</FormLabel>
                                 <FormControl>
                                  <Input type="number" placeholder="Ej: 25" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="apellidos" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Apellidos</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ej: Pérez González" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="nombres" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombres</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ej: Juan Carlos" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField
                            control={form.control}
                            name="nivelEstudios"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nivel de Estudios</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona un nivel..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {NIVELES_ESTUDIOS.map(level => (
                                                <SelectItem key={level} value={level}>{level}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {showConditionalFields && (
                            <>
                                <FormField control={form.control} name="institucion" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Institución Educativa</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Ej: Universidad de Guayaquil" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="tituloProfesional" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Título Profesional</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Ej: Ingeniero en Sistemas" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </>
                        )}

                        <FormField
                            control={form.control}
                            name="anosExperiencia"
                            render={({ field }) => {
                                const displayValue = experienceUnit === 'MESES' ? Math.round(field.value * 12) : field.value;

                                const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numValue = e.target.value === '' ? 0 : Number(e.target.value);
                                    const yearsValue = experienceUnit === 'AÑOS' ? numValue : numValue / 12;
                                    field.onChange(yearsValue);
                                };

                                const handleUnitChange = (unit: 'AÑOS' | 'MESES') => {
                                    setExperienceUnit(unit);
                                };
                                
                                let convertedValueText = '';
                                if(field.value > 0) {
                                    convertedValueText = experienceUnit === 'AÑOS' 
                                        ? `(equivale a ${Math.round(field.value * 12)} meses)` 
                                        : `(equivale a ${(field.value).toFixed(1)} años)`;
                                }

                                return (
                                    <FormItem>
                                        <FormLabel>Experiencia</FormLabel>
                                        <div className="flex gap-2 items-start">
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="Ej: 5"
                                                    value={displayValue === 0 ? '' : displayValue}
                                                    onChange={handleInputChange}
                                                />
                                            </FormControl>
                                            <Select onValueChange={handleUnitChange} value={experienceUnit}>
                                                <FormControl>
                                                    <SelectTrigger className="w-32">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="MESES">Meses</SelectItem>
                                                    <SelectItem value="AÑOS">Años</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {field.value > 0 && (
                                            <FormDescription>
                                                {convertedValueText}
                                            </FormDescription>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />

                        <FormField
                            control={form.control}
                            name="cargosAplicables"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cargos a los que puede aplicar</FormLabel>
                                    <MultiSelectCombobox
                                        options={cargoOptions.map(cargo => ({ label: cargo, value: cargo }))}
                                        selected={field.value}
                                        onChange={field.onChange}
                                        placeholder="Selecciona o crea cargos..."
                                        searchPlaceholder="Buscar cargos..."
                                        notFoundMessage="No se encontró el cargo."
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField control={form.control} name="observacion" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Observaciones / Debida Diligencia</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Añade cualquier observación relevante o notas de debida diligencia..." {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {editingCandidate ? <Edit className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                {form.formState.isSubmitting ? "Guardando..." : (editingCandidate ? 'Guardar Cambios' : 'Añadir Candidato')}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

function EvaluationDialog({ open, onOpenChange, candidate, process, user, onEvaluationSaved }: { open: boolean, onOpenChange: (open: boolean) => void, candidate: Candidate | null, process: HiringProcess | null, user: any, onEvaluationSaved: (evaluation: Omit<ProfileEvaluation, 'id'>) => void }) {
    
    const form = useForm<z.infer<typeof evaluationSchema>>({
        resolver: zodResolver(evaluationSchema),
        defaultValues: {
            formacionAcademica: 1,
            conocimientosTecnicos: 1,
            experiencia: 0,
            competencias: 1,
            status: 'C',
            aspiracionSalarial: 0,
        }
    });

    const { setValue, reset, watch } = form;
    const watchedValues = watch();

    const processPercentages = useMemo(() => {
        return {
            formacion: process?.formacionAcademicaPct ?? 10,
            conocimientos: process?.conocimientosTecnicosPct ?? 40,
            experiencia: process?.experienciaPct ?? 20,
            competencias: process?.competenciasPct ?? 30,
        };
    }, [process]);
    
    const notaGeneral = useMemo(() => {
        const formacionScore = (watchedValues.formacionAcademica || 0) * (processPercentages.formacion / 100);
        const conocimientosScore = ((watchedValues.conocimientosTecnicos || 1) / 10) * (processPercentages.conocimientos / 100);
        const competenciasScore = (((watchedValues.competencias || 1) - 1) / 4) * (processPercentages.competencias / 100);
        const experienciaScore = ((watchedValues.experiencia ?? 0) / 20) * (processPercentages.experiencia / 100);
        
        const total = (formacionScore + conocimientosScore + competenciasScore + experienciaScore) * 100;
        return Math.round(total);
    }, [watchedValues, processPercentages]);

    const evaluationDate = useMemo(() => new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }), []);

    useEffect(() => {
        if (open && process && candidate) {
            let initialExperienceScore = 0;
            const tiempoRequeridoStr = process.tiempoRequerido;
            const parts = tiempoRequeridoStr.split(' ');

            if (parts.length === 2) {
                const num = parseFloat(parts[0]);
                const unit = parts[1].toUpperCase();

                if (!isNaN(num) && (unit === 'MESES' || unit === 'AÑOS')) {
                    const requiredMonths = unit === 'MESES' ? num : num * 12;
                    const candidateMonths = (candidate.anosExperiencia || 0) * 12;
                    if (requiredMonths > 0) {
                        const experienceRatio = Math.min(1, candidateMonths / requiredMonths);
                        initialExperienceScore = Math.round(experienceRatio * 20);
                    }
                }
            }
             reset({
                formacionAcademica: 1,
                conocimientosTecnicos: 1,
                experiencia: initialExperienceScore,
                competencias: 1,
                status: 'C',
                aspiracionSalarial: 0,
            });
        }
    }, [open, candidate, process, reset]);


    async function onSubmit(data: z.infer<typeof evaluationSchema>) {
        if (!candidate || !process) {
            toast({ variant: "destructive", title: "Error", description: "No se puede guardar la evaluación." });
            return;
        }

        const evaluationData: Omit<ProfileEvaluation, 'id'> = {
            ...data,
            candidateId: candidate.id,
            processId: process.id,
            candidateCedula: candidate.cedula,
            cargoPostulado: process.cargo,
            fechaEvaluacion: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            notaGeneral: notaGeneral,
        };

        onEvaluationSaved(evaluationData);
        toast({ title: "Evaluación Guardada", description: `La evaluación para ${candidate.nombres} ha sido guardada.` });
        onOpenChange(false);
    }
    
    const formacionOptions = [{ value: 1, label: 'Cumple' }, { value: 0, label: 'No Cumple' }];
    const competenciasOptions = [
        { value: 1, label: '1 - Deficiente' },
        { value: 2, label: '2 - En desarrollo' },
        { value: 3, label: '3 - Aceptable' },
        { value: 4, label: '4 - Competente' },
        { value: 5, label: '5 - Sobresaliente' },
    ];

    if (!candidate || !process || !user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Activity className="h-6 w-6 text-primary" />
                        Evaluación de Perfil
                    </DialogTitle>
                    <DialogDescription>
                        Evaluando a <span className="font-bold text-primary">{candidate.nombres} {candidate.apellidos}</span> para el puesto de <span className="font-bold text-primary">{process.cargo}</span>.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            
                            <FormField control={form.control} name="formacionAcademica" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Formación Académica ({processPercentages.formacion}%)</FormLabel>
                                    <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {formacionOptions.map(opt => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="conocimientosTecnicos" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Conocimientos Técnicos ({processPercentages.conocimientos}%)</FormLabel>
                                    <FormControl>
                                      <Input
                                          type="number"
                                          step="0.1"
                                          min="1"
                                          max="10"
                                          placeholder="1.0 - 10.0"
                                          {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                             <FormField control={form.control} name="experiencia" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Experiencia ({processPercentages.experiencia}%)</FormLabel>
                                    <div className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                                        <p>Puntaje obtenido: <strong>{field.value} / 20</strong></p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Calculado: {candidate.anosExperiencia.toFixed(1)} años vs. {process.tiempoRequerido} requerido.</p>
                                </FormItem>
                            )} />

                             <FormField control={form.control} name="competencias" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Competencias ({processPercentages.competencias}%)</FormLabel>
                                    <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {competenciasOptions.map(opt => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>

                        <div className="flex justify-between items-center bg-muted p-4 rounded-lg">
                            <h3 className="text-lg font-bold">Nota General:</h3>
                            <p className="text-2xl font-bold text-primary">{notaGeneral}%</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estado Final</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="C">C - Contratable</SelectItem>
                                            <SelectItem value="NC">NC - No Contratable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="aspiracionSalarial" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Aspiración Salarial (USD)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Ej: 800" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>


                        <div className="pt-6 mt-6 border-t">
                            <p className="text-sm text-center text-muted-foreground">
                                Evaluado por: <span className="font-medium text-foreground">{user.email}</span>
                            </p>
                            <p className="text-sm text-center text-muted-foreground">
                                Fecha de Evaluación: <span className="font-medium text-foreground">{evaluationDate}</span>
                            </p>
                        </div>
                        
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                <Star className="mr-2 h-4 w-4" />
                                {form.formState.isSubmitting ? "Guardando..." : "Guardar Evaluación"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

function EvaluationHistorySheet({ open, onOpenChange, candidate, evaluations }: { open: boolean, onOpenChange: (open: boolean) => void, candidate: Candidate | null, evaluations: ProfileEvaluation[] | null }) {
    const candidateEvals = useMemo(() => {
        if (!candidate || !evaluations) return [];
        return evaluations
            .filter(e => e.candidateCedula === candidate.cedula)
            .sort((a, b) => new Date(b.fechaEvaluacion).getTime() - new Date(a.fechaEvaluacion).getTime());
    }, [candidate, evaluations]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-2xl">
                <SheetHeader>
                    <SheetTitle>Historial de Evaluaciones</SheetTitle>
                    <SheetDescription>
                        Mostrando el historial para el candidato {candidate?.nombres} {candidate?.apellidos}.
                    </SheetDescription>
                </SheetHeader>
                <div className="py-6">
                    {evaluations === null ? (
                        <div className="flex items-center justify-center h-24 text-muted-foreground">
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Cargando historial...
                        </div>
                    ) : candidateEvals.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {candidateEvals.map((evalItem) => (
                                <AccordionItem value={evalItem.id} key={evalItem.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className="text-left">
                                                <p className="font-semibold">{evalItem.cargoPostulado}</p>
                                                <p className="text-sm text-muted-foreground">{format(parseISO(evalItem.fechaEvaluacion), "d 'de' MMMM, yyyy", { locale: es })}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge variant={evalItem.status === 'C' ? 'default' : 'destructive'}>
                                                    {evalItem.status === 'C' ? 'Contratable' : 'No Contratable'}
                                                </Badge>
                                                <span className="font-bold text-lg">{evalItem.notaGeneral}%</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-2 p-2 bg-muted/50 rounded-md">
                                            <h4 className="font-semibold text-sm mb-2">Desglose de Calificación:</h4>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                                <p><strong>Formación Académica:</strong> {evalItem.formacionAcademica === 1 ? 'Cumple' : 'No Cumple'}</p>
                                                <p><strong>Conocimientos Técnicos:</strong> {evalItem.conocimientosTecnicos} / 10</p>
                                                <p><strong>Experiencia:</strong> {evalItem.experiencia} / 20</p>
                                                <p><strong>Competencias:</strong> {evalItem.competencias} / 5</p>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="h-24 flex items-center justify-center text-center text-muted-foreground">
                           Este candidato aún no tiene evaluaciones.
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function RepositoryViewSheet({ 
    open, 
    onOpenChange, 
    candidates,
    isLoading,
    onEdit,
    onDelete,
    onViewHistory
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    candidates: Candidate[];
    isLoading: boolean;
    onEdit: (candidate: Candidate) => void;
    onDelete: (candidate: Candidate) => void;
    onViewHistory: (candidate: Candidate) => void;
}) {
    const [filter, setFilter] = useState('');

    const filteredCandidates = useMemo(() => {
        if (!candidates) return [];
        if (!filter) return candidates;
        const lowercasedFilter = filter.toLowerCase();
        return candidates.filter(c => 
            c.nombres.toLowerCase().includes(lowercasedFilter) ||
            c.apellidos.toLowerCase().includes(lowercasedFilter) ||
            c.cedula.includes(lowercasedFilter)
        );
    }, [candidates, filter]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-7xl w-full">
                <SheetHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        Repositorio Central de Candidatos
                    </DialogTitle>
                    <DialogDescription>
                        Busca, visualiza y gestiona todos los candidatos en tu base de datos.
                    </DialogDescription>
                </SheetHeader>
                <div className="py-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por nombre, apellido o cédula..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-10 max-w-sm"
                        />
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Candidato</TableHead>
                                    <TableHead>Cédula</TableHead>
                                    <TableHead>Cargos Aplicables</TableHead>
                                    <TableHead>Años Exp.</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={`repo-skel-${i}`}>
                                            <TableCell colSpan={5} className="p-4"><div className="h-6 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredCandidates.length > 0 ? (
                                    filteredCandidates.map((candidate) => (
                                        <TableRow key={candidate.id}>
                                            <TableCell className="font-medium flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={candidate.photoUrl} alt={candidate.nombres} />
                                                    <AvatarFallback>{candidate.nombres?.[0]}{candidate.apellidos?.[0]}</AvatarFallback>
                                                </Avatar>
                                                {`${candidate.nombres} ${candidate.apellidos}`}
                                            </TableCell>
                                            <TableCell>{candidate.cedula}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {(candidate.cargosAplicables || []).map(cargo => (
                                                        <Badge key={cargo} variant="secondary">{cargo}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>{candidate.anosExperiencia}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" onClick={() => onViewHistory(candidate)}>
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => onEdit(candidate)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => onDelete(candidate)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No se encontraron candidatos.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function RecommendationDialog({ open, onOpenChange, process, onSubmit, isSubmitting }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: HiringProcessWithShortlist | null;
  onSubmit: (recommendations: { candidateId: string; comment: string }[]) => void;
  isSubmitting: boolean;
}) {
  const [recommendations, setRecommendations] = React.useState<Map<string, string>>(new Map());

  useEffect(() => {
    if(open) {
      setRecommendations(new Map());
    }
  }, [open]);

  const contratableCandidates = useMemo(() => {
    return process?.shortlist.filter(c => c.evaluation?.status === 'C') || [];
  }, [process]);
  
  const handleToggleCandidate = (candidateId: string) => {
    setRecommendations(prev => {
      const newMap = new Map(prev);
      if (newMap.has(candidateId)) {
        newMap.delete(candidateId);
      } else {
        newMap.set(candidateId, ''); // Initialize with empty comment
      }
      return newMap;
    });
  };

  const handleCommentChange = (candidateId: string, comment: string) => {
    setRecommendations(prev => {
      const newMap = new Map(prev);
      newMap.set(candidateId, comment);
      return newMap;
    });
  };

  const handleSubmit = () => {
    const recommendationsArray = Array.from(recommendations.entries())
      .map(([candidateId, comment]) => ({ candidateId, comment }));

    if (recommendationsArray.length === 0) {
      toast({ variant: 'destructive', title: 'Selección requerida', description: 'Debes seleccionar al menos un candidato para recomendar.' });
      return;
    }

    for (const rec of recommendationsArray) {
      if (!rec.comment.trim()) {
        toast({ variant: 'destructive', title: 'Comentario requerido', description: `Por favor, añade un comentario para cada candidato seleccionado.` });
        return;
      }
    }
    onSubmit(recommendationsArray);
  };
  
  if (!process) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Recomendar Candidatos para Contratación</DialogTitle>
          <DialogDescription>
            Selecciona los candidatos que deseas recomendar al jefe inmediato y añade un comentario para cada uno.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2 -mr-4">
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold">Candidatos Contratables</h3>
                <div className="space-y-4">
                    {contratableCandidates.map(candidate => {
                        const isSelected = recommendations.has(candidate.id);
                        return (
                            <div key={candidate.id} className={cn("p-3 rounded-lg border", isSelected ? "border-primary bg-primary/5" : "border-border")}>
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`rec-${candidate.id}`}
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggleCandidate(candidate.id)}
                                    />
                                    <Label htmlFor={`rec-${candidate.id}`} className="font-normal w-full cursor-pointer">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={candidate.photoUrl} alt={candidate.nombres} />
                                                    <AvatarFallback>{candidate.nombres?.[0]}{candidate.apellidos?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <span>{candidate.nombres} {candidate.apellidos}</span>
                                            </div>
                                            <span className="text-sm font-semibold">{candidate.evaluation?.notaGeneral}%</span>
                                        </div>
                                    </Label>
                                </div>
                                {isSelected && (
                                    <div className="mt-3 pl-8">
                                        <Label htmlFor={`comment-${candidate.id}`} className="text-xs font-semibold">Comentario de Recomendación</Label>
                                        <Textarea
                                            id={`comment-${candidate.id}`}
                                            placeholder={`¿Por qué recomiendas a ${candidate.nombres}?`}
                                            className="mt-1"
                                            value={recommendations.get(candidate.id) || ''}
                                            onChange={(e) => handleCommentChange(candidate.id, e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {contratableCandidates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No hay candidatos marcados como 'Contratables' en esta terna.</p>}
                </div>
            </div>
        </div>
        <DialogFooter className="pt-4 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || recommendations.size === 0}>
                {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Enviando..." : "Enviar Recomendaciones"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProfileEvaluationPage() {
  const [activeProcess, setActiveProcess] = useState<HiringProcessWithShortlist | null>(null);
  const [editingProcess, setEditingProcess] = useState<HiringProcess | null>(null);
  const [isProcessDialogOpen, setProcessDialogOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<HiringProcess | null>(null);
  const [deletingProcessId, setDeletingProcessId] = useState<string | null>(null);

  const [isCandidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [isCandidateSheetOpen, setIsCandidateSheetOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [isEvaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
  const [candidateToEvaluate, setCandidateToEvaluate] = useState<Candidate | null>(null);
  const [isRepositorySheetOpen, setIsRepositorySheetOpen] = useState(false);
  
  const [isHistorySheetOpen, setHistorySheetOpen] = useState(false);
  const [selectedCandidateForHistory, setSelectedCandidateForHistory] = useState<Candidate | null>(null);
  
  const [titleFilter, setTitleFilter] = useState('');
  const [professionalTitleFilter, setProfessionalTitleFilter] = useState('');
  const { user } = useUser();
  const [submittingProcessId, setSubmittingProcessId] = useState<string | null>(null);

  const [isRecommendDialogOpen, setRecommendDialogOpen] = useState(false);
  const [processForRecommendation, setProcessForRecommendation] = useState<HiringProcessWithShortlist | null>(null);

  const firestore = useFirestore();
  const { data: cargosCollection, isLoading: cargosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
  const { data: empresasCollection, isLoading: empresasLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'empresas') : null, [firestore]));
  const { data: ubicacionesCollection, isLoading: ubicacionesLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'ubicaciones') : null, [firestore]));
  const { data: areasCollection, isLoading: areasLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'areas') : null, [firestore]));
  const { data: workers, isLoading: workersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
  
  const { data: hiringProcesses, isLoading: processesLoading } = useCollection<HiringProcess>(useMemo(() => firestore ? collection(firestore, 'hiringProcesses') : null, [firestore]));
  const { data: allCandidates, isLoading: candidatesLoading } = useCollection<Candidate>(useMemo(() => firestore ? collection(firestore, 'candidates') : null, [firestore]));
  const { data: allEvaluations, isLoading: evaluationsLoading } = useCollection<ProfileEvaluation>(useMemo(() => firestore ? collection(firestore, 'profileEvaluations') : null, [firestore]));
  const { data: allApprovals, isLoading: approvalsLoading } = useCollection<any>(useMemo(() => firestore ? collection(firestore, 'hiringApprovals') : null, [firestore]));

  const isLoading = cargosLoading || empresasLoading || ubicacionesLoading || areasLoading || workersLoading || processesLoading || candidatesLoading || evaluationsLoading || approvalsLoading;

  const [processesWithShortlist, setProcessesWithShortlist] = useState<HiringProcessWithShortlist[]>([]);

  useEffect(() => {
    if (!hiringProcesses || !allCandidates || !allEvaluations) return;
    const processesWithData = hiringProcesses.map(process => {
        const shortlist = (process.shortlistCandidateIds || [])
            .map(candidateId => {
                const candidateData = allCandidates.find(c => c.id === candidateId);
                if (!candidateData) return null;

                const evaluation = allEvaluations.find(e => e.candidateId === candidateId && e.processId === process.id);
                
                const result: any = { ...candidateData };
                if (evaluation) {
                    result.evaluation = { ...evaluation };
                }
                return result;
            })
            .filter((c): c is (Candidate & { evaluation?: ProfileEvaluation }) => c !== null);

        return { ...process, shortlist };
    });

    setProcessesWithShortlist(processesWithData);
  }, [hiringProcesses, allCandidates, allEvaluations]);
  
  useEffect(() => {
    if (activeProcess) {
        const updatedProcess = processesWithShortlist.find(p => p.id === activeProcess.id);
        if (updatedProcess) {
            setActiveProcess(updatedProcess);
        }
    }
  }, [processesWithShortlist, activeProcess?.id]);

  const shortlistedCandidates = useMemo(() => {
    if (!activeProcess || !allCandidates) return [];
    return allCandidates.filter(c => activeProcess.shortlistCandidateIds?.includes(c.id));
  }, [activeProcess, allCandidates]);

  const availableCandidates = useMemo(() => {
    if (!allCandidates || !activeProcess || !hiringProcesses || !allApprovals) return [];
    
    const hiredIds = new Set(hiringProcesses.flatMap(p => p.hiredCandidateIds || []));
    
    const pendingOrApprovedCandidateIds = new Set(
        allApprovals
            .filter(app => app.status === 'pending' || app.status === 'approved-boss')
            .flatMap(app => app.shortlist?.map((s: any) => s.candidateId))
            .filter(Boolean)
    );

    return allCandidates.filter(c => 
        !activeProcess.shortlistCandidateIds?.includes(c.id) && 
        !hiredIds.has(c.id) &&
        !pendingOrApprovedCandidateIds.has(c.id)
    );
  }, [allCandidates, activeProcess, hiringProcesses, allApprovals]);

  const uniqueOptions = useMemo(() => {
    const allWorkers = workers || [];
    const allHiringProcesses = hiringProcesses || [];
    const allCands = allCandidates || [];
    
    const cargos = Array.from(new Set(cargosCollection?.map(c => c.name) || []));
    const empresas = Array.from(new Set(empresasCollection?.map(c => c.name) || []));
    const ubicaciones = Array.from(new Set(ubicacionesCollection?.map(c => c.name) || []));
    const departamentos = Array.from(new Set(areasCollection?.map(c => c.name) || []));
    
    const seenEmails = new Set();
    const jefes = allWorkers.filter(w => {
      if (w.email && !seenEmails.has(w.email)) {
        seenEmails.add(w.email);
        return true;
      }
      return false;
    });

    const candidateCargos = Array.from(new Set(allCands.flatMap(c => c.cargosAplicables || []).filter((t): t is string => !!t)));
    const allCandidateTitulos = Array.from(new Set(allCands.map(c => c.tituloProfesional).filter((t): t is string => !!t)));

    return { cargos, empresas, ubicaciones, departamentos, jefes, candidateCargos, allCandidateTitulos };
  }, [workers, hiringProcesses, allCandidates, cargosCollection, empresasCollection, ubicacionesCollection, areasCollection]);
  
  const professionalTitleOptions = useMemo(() => {
    if (!titleFilter) {
      return uniqueOptions.allCandidateTitulos.map(titulo => ({ label: titulo, value: titulo }));
    }
    const filteredCands = availableCandidates.filter(candidate => 
        (candidate.cargosAplicables || []).some(cargo => 
            normalizeText(cargo).includes(normalizeText(titleFilter))
        )
    );
    const titles = new Set(filteredCands.map(c => c.tituloProfesional).filter((t): t is string => !!t));
    return Array.from(titles).map(titulo => ({ label: titulo, value: titulo }));
  }, [titleFilter, availableCandidates, uniqueOptions.allCandidateTitulos]);

  const filteredAvailableCandidates = useMemo(() => {
    if(!availableCandidates) return [];
    let filtered = availableCandidates;

    if (titleFilter) {
      filtered = filtered.filter(candidate =>
        (candidate.cargosAplicables || []).some(cargo =>
          normalizeText(cargo).includes(normalizeText(titleFilter))
        )
      );
    }
    
    if (professionalTitleFilter) {
      filtered = filtered.filter(candidate =>
        candidate.tituloProfesional && normalizeText(candidate.tituloProfesional).includes(normalizeText(professionalTitleFilter))
      );
    }

    return filtered;
  }, [availableCandidates, titleFilter, professionalTitleFilter]);
  
  const handleTitleFilterChange = (value: string) => {
    setTitleFilter(value);
    setProfessionalTitleFilter(''); 
  };


  const handleShortlistToggle = useCallback(async (candidateId: string) => {
      if (!activeProcess || !firestore) return;
      
      const isCurrentlyInShortlist = activeProcess.shortlistCandidateIds?.includes(candidateId);
      
      const updatedShortlist = isCurrentlyInShortlist
        ? activeProcess.shortlistCandidateIds?.filter(id => id !== candidateId)
        : [...(activeProcess.shortlistCandidateIds || []), candidateId];

      const processDocRef = doc(firestore, 'hiringProcesses', activeProcess.id);
      try {
        await updateDoc(processDocRef, { shortlistCandidateIds: updatedShortlist });
        toast({ title: "Terna actualizada", description: "La lista de candidatos preseleccionados ha sido modificada."})
      } catch (error) {
        console.error("Error updating shortlist: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la terna." });
      }
  }, [activeProcess, firestore]);

  const handleShowHistory = (candidate: Candidate) => {
    setSelectedCandidateForHistory(candidate);
    setHistorySheetOpen(true);
  };

  const openProcesses = useMemo(() => processesWithShortlist?.filter(p => p.status === 'open') || [], [processesWithShortlist]);
  
  const closedProcesses = useMemo(() => {
    if (!processesWithShortlist || !allCandidates || !workers) return [];
    return processesWithShortlist
      .filter(p => p.status === 'closed')
      .map(p => {
        const hiredCandidatesList = (p.hiredCandidateIds || [])
          .map(id => allCandidates.find(c => c.id === id) || workers.find(w => w.id === id))
          .filter((c): c is (Candidate | UserProfile) => c !== undefined);

        const uniqueHired = hiredCandidatesList.filter((value, index, self) =>
            index === self.findIndex((t) => ((t as any).id || (t as any).cedula) === ((value as any).id || (value as any).cedula))
        );

        return { ...p, hired: uniqueHired };
      });
  }, [processesWithShortlist, allCandidates, workers]);


  
  const handleOpenCreateProcessDialog = () => {
    setEditingProcess(null);
    setProcessDialogOpen(true);
  };

  const handleOpenEditProcessDialog = (e: React.MouseEvent, process: HiringProcess) => {
    e.stopPropagation();
    setEditingProcess(process);
    setProcessDialogOpen(true);
  };
  
  const handleProcessSubmit = async (data: z.infer<typeof hiringProcessSchema>) => {
      if (!firestore) return;
      const isEditing = !!editingProcess;
      
      const tiempoRequerido = `${data.tiempoRequeridoNumero} ${data.tiempoRequeridoUnidad}`;

      const { tiempoRequeridoNumero, tiempoRequeridoUnidad, effectiveHiringDate, ...restOfData } = data;
      
      const isRetroactive = effectiveHiringDate ? isBefore(effectiveHiringDate, startOfToday()) : false;

      const processData = { 
          ...restOfData,
          tiempoRequerido: tiempoRequerido.toUpperCase(),
          empresa: normalizeText(data.empresa),
          cargo: normalizeText(data.cargo),
          ubicacion: normalizeText(data.ubicacion),
          departamento: normalizeText(data.departamento),
          shortlistCandidateIds: isEditing ? editingProcess.shortlistCandidateIds || [] : [],
          hiredCandidateIds: isEditing ? editingProcess.hiredCandidateIds || [] : [],
          isRetroactive,
          effectiveHiringDate: effectiveHiringDate ? format(effectiveHiringDate, 'yyyy-MM-dd') : null,
          justificationForRetroactive: isRetroactive ? data.justificationForRetroactive : null,
      };
      
      try {
          const batch = writeBatch(firestore);
  
          // Check and create new generic options
          const newOptions = [
              { collection: 'empresas', value: data.empresa, existing: uniqueOptions.empresas },
              { collection: 'cargos', value: data.cargo, existing: uniqueOptions.cargos },
              { collection: 'ubicaciones', value: data.ubicacion, existing: uniqueOptions.ubicaciones },
              { collection: 'areas', value: data.departamento, existing: uniqueOptions.departamentos },
          ];
  
          newOptions.forEach(opt => {
              if (opt.value && !opt.existing.some(ex => normalizeText(ex) === normalizeText(opt.value))) {
                  const newDocRef = doc(collection(firestore, opt.collection));
                  batch.set(newDocRef, { name: normalizeText(opt.value) });
              }
          });
  
          if(isEditing) {
              const docRef = doc(firestore, 'hiringProcesses', editingProcess.id);
              batch.update(docRef, processData as any);
          } else {
              const docRef = doc(collection(firestore, 'hiringProcesses'));
              batch.set(docRef, processData);
          }
  
          await batch.commit();
  
          toast({ title: isEditing ? "Proceso Actualizado" : "Proceso Creado", description: `El proceso para ${data.cargo} ha sido guardado.` });
          
          setProcessDialogOpen(false);
          setEditingProcess(null);
  
      } catch (error) {
          console.error("Error saving process: ", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el proceso." });
      }
  };


  const handleDeleteProcessClick = (e: React.MouseEvent, process: HiringProcess) => {
    e.stopPropagation();
    setProcessToDelete(process);
  };
  
  const confirmDeleteProcess = async () => {
    if (!processToDelete || !firestore || deletingProcessId) return;

    setDeletingProcessId(processToDelete.id);
    const processIdToDelete = processToDelete.id;

    try {
        const approvalsCollectionRef = collection(firestore, 'hiringApprovals');
        const q = query(approvalsCollectionRef, where("processId", "==", processIdToDelete));
        
        const approvalsSnapshot = await getDocs(q);

        const batch = writeBatch(firestore);

        if (!approvalsSnapshot.empty) {
            approvalsSnapshot.docs.forEach(approvalDoc => {
                batch.delete(approvalDoc.ref);
            });
        }

        const processDocRef = doc(firestore, 'hiringProcesses', processIdToDelete);
        batch.delete(processDocRef);

        await batch.commit();

        toast({
            title: "Proceso Eliminado Correctamente",
            description: `El proceso y sus ${approvalsSnapshot.size} aprobaciones asociadas han sido eliminados.`,
        });

        if (activeProcess?.id === processIdToDelete) {
            setActiveProcess(null);
        }

    } catch (error: any) {
        console.error("Error al eliminar el proceso y sus aprobaciones:", error);
        
        let errorMessage = "Ocurrió un error inesperado. Revisa la consola para más detalles.";

        if (error.code === 'failed-precondition') {
             errorMessage = `La base de datos requiere un índice para poder borrar las aprobaciones asociadas. El mensaje de error del sistema es: ${error.message}`;
        } else if (error.code === 'permission-denied') {
            errorMessage = "No tienes permisos para eliminar este proceso o sus aprobaciones. Contacta al administrador."
        }
        
        toast({
            variant: "destructive",
            title: "Error al Eliminar",
            description: errorMessage,
            duration: 15000,
        });
    } finally {
        setProcessToDelete(null);
        setDeletingProcessId(null);
    }
  };
  
  useEffect(() => {
      if(activeProcess) {
          setTitleFilter('');
          setProfessionalTitleFilter('');
      }
  }, [activeProcess]);

  const handleProcessSelect = (process: HiringProcessWithShortlist) => {
    setActiveProcess(process);
    setIsCandidateSheetOpen(true);
  };
  
  const handleOpenAddCandidateDialog = () => {
    setEditingCandidate(null);
    setCandidateDialogOpen(true);
  }

  const handleOpenEditCandidateDialog = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setCandidateDialogOpen(true);
  };
  
  const handleCandidateSaved = async (candidateData: Omit<Candidate, 'id'>) => {
      if (!firestore) return;
      const collectionRef = collection(firestore, 'candidates');
      try {
        if(editingCandidate) {
          const docRef = doc(firestore, 'candidates', editingCandidate.id);
          await updateDoc(docRef, candidateData as any);
        } else {
          await addDoc(collectionRef, candidateData);
        }
      } catch (error) {
         console.error("Error saving candidate: ", error);
         toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el candidato." });
      }
  }

  const handleDeleteCandidateClick = (candidate: Candidate) => {
      setCandidateToDelete(candidate);
  };

  const confirmDeleteCandidate = async () => {
    if (!candidateToDelete || !firestore) return;
    
    const batch = writeBatch(firestore);

    // Remove from all hiring processes shortlists
    hiringProcesses?.forEach(p => {
        if (p.shortlistCandidateIds?.includes(candidateToDelete.id)) {
            const processDocRef = doc(firestore, 'hiringProcesses', p.id);
            const newShortlist = p.shortlistCandidateIds.filter(id => id !== candidateToDelete.id);
            batch.update(processDocRef, { shortlistCandidateIds: newShortlist });
        }
    });

    try {
        await batch.commit();
        toast({ title: "Candidato Eliminado de Ternas", description: `${candidateToDelete.nombres} ${candidateToDelete.apellidos} ha sido removido de todas las ternas.` });
    } catch (error) {
        console.error("Error removing candidate from shortlists:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo quitar al candidato de las ternas."});
    } finally {
        setCandidateToDelete(null);
    }
  };

  const handleOpenEvaluationDialog = (e: React.MouseEvent, candidate: Candidate, process: HiringProcess) => {
    e.stopPropagation();
    setCandidateToEvaluate(candidate);
    setActiveProcess(process as HiringProcessWithShortlist);
    setEvaluationDialogOpen(true);
  };

  const handleEvaluationSaved = async (evaluationData: Omit<ProfileEvaluation, 'id'>) => {
    if (!firestore) return;
    const collectionRef = collection(firestore, 'profileEvaluations');
    try {
      await addDoc(collectionRef, evaluationData);
    } catch (error) {
      console.error("Error saving evaluation: ", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la evaluación." });
    }
  };
  
  const handleOpenRecommendDialog = (process: HiringProcessWithShortlist) => {
    setProcessForRecommendation(process);
    setRecommendDialogOpen(true);
  }

  const handleSendRecommendation = async (recommendations: { candidateId: string; comment: string }[]) => {
    if (!firestore || !user || !processForRecommendation || submittingProcessId) return;

    const process = processForRecommendation;
    setSubmittingProcessId(process.id);
    
    const contratableCandidates = process.shortlist.filter(c => c.evaluation?.status === 'C');

    if (contratableCandidates.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "No hay candidatos contratables en la terna."});
        setSubmittingProcessId(null);
        return;
    }

    const directorRHHEmail = "director.rrhh@sudinco.com";

    const shortlistForApproval = contratableCandidates.map(c => {
        const evalData = c.evaluation!;
        const sanitizedEvaluationInfo = {
            candidateId: evalData.candidateId,
            processId: evalData.processId,
            candidateCedula: evalData.candidateCedula,
            notaGeneral: evalData.notaGeneral,
            fechaEvaluacion: evalData.fechaEvaluacion,
            cargoPostulado: evalData.cargoPostulado,
            formacionAcademica: evalData.formacionAcademica,
            conocimientosTecnicos: evalData.conocimientosTecnicos,
            experiencia: evalData.experiencia,
            competencias: evalData.competencias,
            status: evalData.status,
            aspiracionSalarial: evalData.aspiracionSalarial ?? null,
        };

        return {
            candidateId: c.id,
            candidateInfo: { 
                id: c.id, 
                nombres: c.nombres, 
                apellidos: c.apellidos, 
                cedula: c.cedula, 
            },
            evaluationInfo: sanitizedEvaluationInfo,
        };
    });

    const approvalData = {
        processId: process.id,
        requesterEmail: user.email,
        jefeInmediatoEmail: process.jefeInmediato,
        directorRHHEmail: directorRHHEmail,
        status: 'pending' as const,
        createdAt: Date.now(),
        processInfo: {
            cargo: process.cargo,
            empresa: process.empresa,
            tipoContrato: process.tipoContrato,
            isRetroactive: process.isRetroactive,
            effectiveHiringDate: process.effectiveHiringDate || null,
            justificationForRetroactive: process.justificationForRetroactive || null,
        },
        shortlist: shortlistForApproval,
        recommendations: recommendations,
    };
    
    const approvalsCollectionRef = collection(firestore, 'hiringApprovals');
    const processDocRef = doc(firestore, 'hiringProcesses', process.id);
    
    try {
        const batch = writeBatch(firestore);
        const newApprovalRef = doc(approvalsCollectionRef);
        batch.set(newApprovalRef, approvalData);
        batch.update(processDocRef, { status: 'closed' });
        await batch.commit();

        toast({
            title: 'Recomendaciones Enviadas y Proceso Cerrado',
            description: `La solicitud de aprobación para el proceso de ${process.cargo} ha sido enviada.`,
        });
        
        setIsCandidateSheetOpen(false);
        setRecommendDialogOpen(false);
        setActiveProcess(null);

    } catch (error) {
        console.error("Error sending to approval:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo enviar la solicitud de aprobación."});
    } finally {
        setSubmittingProcessId(null);
        setProcessForRecommendation(null);
    }
  };

  const CandidateTable = ({ title, icon, candidates, isLoading, filter, noCandidatesMessage, onCheckChange, getChecked }: {
    title: string,
    icon: React.ElementType,
    candidates: Candidate[],
    isLoading: boolean,
    filter?: React.ReactNode,
    noCandidatesMessage: string,
    onCheckChange: (candidateId: string) => void,
    getChecked: (candidateId: string) => boolean,
  }) => {
    const Icon = icon;
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {title}
                </h3>
            </div>
            {filter}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className='w-12'></TableHead>
                            <TableHead>Candidato</TableHead>
                            <TableHead>Cédula</TableHead>
                            <TableHead>Cargos Aplicables</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                             Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={`skel-${i}`}>
                                    <TableCell colSpan={5} className="p-4"><div className="h-6 bg-gray-200 rounded animate-pulse"></div></TableCell>
                                </TableRow>
                            ))
                        ) : candidates && candidates.length > 0 ? (
                            candidates.map((candidate) => (
                                <TableRow key={candidate.id} data-state={getChecked(candidate.id) ? 'selected' : ''}>
                                    <TableCell> <Checkbox checked={getChecked(candidate.id)} onCheckedChange={() => onCheckChange(candidate.id)} aria-label={`Seleccionar a ${candidate.nombres}`} /> </TableCell>
                                    <TableCell className="font-medium flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={candidate.photoUrl} alt={candidate.nombres} />
                                            <AvatarFallback>{candidate.nombres?.[0]}{candidate.apellidos?.[0]}</AvatarFallback>
                                        </Avatar>
                                        {`${candidate.nombres} ${candidate.apellidos}`}
                                    </TableCell>
                                    <TableCell>{candidate.cedula}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(candidate.cargosAplicables || []).map(cargo => (
                                                <Badge key={cargo} variant="secondary">{cargo}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleShowHistory(candidate)}>
                                            <History className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditCandidateDialog(candidate)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCandidateClick(candidate)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    {noCandidatesMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold md:text-2xl">Evaluación de Perfil</h1>
            <div className='flex gap-2'>
              <Button variant="outline" onClick={() => setIsRepositorySheetOpen(true)}> <Users className="mr-2 h-4 w-4" /> Ver Repositorio </Button>
              <Button variant="outline" onClick={handleOpenAddCandidateDialog}> <UserPlus className="mr-2 h-4 w-4" /> Añadir Candidato </Button>
              <Button onClick={handleOpenCreateProcessDialog}> <PlusCircle className="mr-2 h-4 w-4" /> Crear Proceso </Button>
            </div>
       </div>

      <CreateProcessDialog open={isProcessDialogOpen} onOpenChange={setProcessDialogOpen} onProcessSubmit={handleProcessSubmit} uniqueOptions={uniqueOptions} editingProcess={editingProcess} />
      
      <AddCandidateDialog open={isCandidateDialogOpen} onOpenChange={setCandidateDialogOpen} allCandidates={allCandidates || []} editingCandidate={editingCandidate} onCandidateSaved={handleCandidateSaved} cargoOptions={uniqueOptions.cargos} />

      {candidateToEvaluate && activeProcess && user && (
          <EvaluationDialog open={isEvaluationDialogOpen} onOpenChange={setEvaluationDialogOpen} candidate={candidateToEvaluate} process={activeProcess} user={user} onEvaluationSaved={handleEvaluationSaved} />
      )}

      <RecommendationDialog open={isRecommendDialogOpen} onOpenChange={setRecommendDialogOpen} process={processForRecommendation} onSubmit={handleSendRecommendation} isSubmitting={!!submittingProcessId}/>

      <EvaluationHistorySheet open={isHistorySheetOpen} onOpenChange={setHistorySheetOpen} candidate={selectedCandidateForHistory} evaluations={allEvaluations} />

      <RepositoryViewSheet 
        open={isRepositorySheetOpen}
        onOpenChange={setIsRepositorySheetOpen}
        candidates={allCandidates || []}
        isLoading={candidatesLoading}
        onEdit={(candidate) => {
            setIsRepositorySheetOpen(false);
            handleOpenEditCandidateDialog(candidate);
        }}
        onDelete={(candidate) => {
            handleDeleteCandidateClick(candidate);
        }}
        onViewHistory={handleShowHistory}
      />

      <AlertDialog open={!!processToDelete} onOpenChange={() => setProcessToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro de eliminar el proceso?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. Esto eliminará permanentemente el proceso de contratación y cualquier solicitud de aprobación asociada.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteProcess} className='bg-destructive text-destructive-foreground hover:bg-destructive/90' disabled={deletingProcessId === processToDelete?.id}>
                  {deletingProcessId === processToDelete?.id ? (
                      <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</>
                  ) : "Eliminar"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!candidateToDelete} onOpenChange={() => setCandidateToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro de eliminar al candidato?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. El candidato será eliminado de todas las ternas, pero permanecerá en el repositorio central.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteCandidate} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>Eliminar de Ternas</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="nuevos">
        <TabsList>
            <TabsTrigger value="nuevos">Procesos Nuevos</TabsTrigger>
            <TabsTrigger value="cerrados">Procesos Cerrados</TabsTrigger>
        </TabsList>
        <TabsContent value="nuevos">
            <Card>
                <CardHeader>
                    <CardTitle>Selecciona un Proceso</CardTitle>
                    <CardDescription> Elige un proceso de la lista para gestionar los candidatos. </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? ( <p>Cargando procesos...</p> ) : openProcesses.length > 0 ? (
                       <div className="grid grid-cols-1 gap-6">
                         {openProcesses.map(process => {
                            const allCandidatesEvaluated = process.shortlist.length > 0 && process.shortlist.every(c => c.evaluation);
                             const contratableCandidatesExist = process.shortlist.some(c => c.evaluation?.status === 'C');
                            const processHasPendingApproval = allApprovals?.some(
                                (approval) => approval.processId === process.id && (approval.status === 'pending' || approval.status === 'approved-boss')
                            );
                            const isSubmittingThisProcess = submittingProcessId === process.id;

                            return (
                                <div key={process.id} className="p-4 rounded-lg border text-left transition-colors flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold text-primary">{process.cargo}</p>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                                  <span>{process.empresa} &middot; {process.ubicacion}</span>
                                                  <Badge variant="outline">{process.tipoContrato}</Badge>
                                                  {process.isRetroactive && <Badge variant="destructive">Retroactivo</Badge>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleProcessSelect(process)}>
                                                    <UserRound className="mr-2 h-4 w-4" />
                                                    Candidatos
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleOpenEditProcessDialog(e, process)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleDeleteProcessClick(e, process)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                        {process.shortlist.length > 0 && (
                                            <div className="mt-4 pt-4 border-t">
                                                <div className="flex justify-between items-center mb-2">
                                                  <h4 className="text-sm font-semibold text-gray-800">Terna Seleccionada</h4>
                                                   {allCandidatesEvaluated && contratableCandidatesExist && !processHasPendingApproval && (
                                                    <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => handleOpenRecommendDialog(process)} disabled={isSubmittingThisProcess}>
                                                      <Hand className="mr-2 h-4 w-4" />
                                                      Recomendar Contratación
                                                    </Button>
                                                  )}
                                                  {processHasPendingApproval && <Badge variant="secondary">Proceso Cerrado</Badge>}
                                                </div>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Candidato</TableHead>
                                                            <TableHead>Estado</TableHead>
                                                            <TableHead>Nota</TableHead>
                                                            <TableHead>Aspiración</TableHead>
                                                            <TableHead className="text-right">Acción</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {process.shortlist.map(candidate => (
                                                            <TableRow key={candidate.id}>
                                                                <TableCell className="font-medium flex items-center gap-3">
                                                                    <Avatar className="h-9 w-9">
                                                                        <AvatarImage src={candidate.photoUrl} alt={candidate.nombres} />
                                                                        <AvatarFallback>{candidate.nombres?.[0]}{candidate.apellidos?.[0]}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span>{candidate.nombres} {candidate.apellidos}</span>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {candidate.evaluation ? (
                                                                        <Badge variant={candidate.evaluation.status === 'C' ? 'default' : 'destructive'}>
                                                                            Evaluado ({candidate.evaluation.status})
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="secondary">Pendiente</Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {candidate.evaluation?.notaGeneral !== undefined ? `${candidate.evaluation.notaGeneral}%` : '--'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {candidate.evaluation?.aspiracionSalarial ? `$${candidate.evaluation.aspiracionSalarial}` : '--'}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {!candidate.evaluation && (
                                                                        <Button size="sm" variant="outline" className="h-8" onClick={(e) => handleOpenEvaluationDialog(e, candidate, process)}>Evaluar</Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                         })}
                       </div>
                    ) : (
                        <div className="text-center py-10">
                            <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay procesos nuevos</h3>
                            <p className="mt-1 text-sm text-gray-500">Empieza por crear un nuevo proceso de contratación.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="cerrados">
             <Card>
                <CardHeader>
                    <CardTitle>Lista de Procesos Cerrados</CardTitle>
                    <CardDescription> Historial de procesos de contratación que ya han finalizado. </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? ( <p>Cargando procesos...</p> ) : closedProcesses.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {closedProcesses.map(process => (
                               <div key={process.id} className="p-4 rounded-lg border flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="font-semibold text-primary">{process.cargo}</p>
                                         <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                          <span>{process.empresa} &middot; {process.ubicacion}</span>
                                          <Badge variant="outline">{process.tipoContrato}</Badge>
                                          
                                        </div>
                                    </div>
                                    
                                     {process.hired && process.hired.length > 0 && (
                                        <div className="w-1/2 pl-4 border-l ml-4">
                                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Candidatos Contratados:</h4>
                                            <ul className="space-y-1">
                                                {process.hired.map(candidate => (
                                                    <li key={(candidate as any).id || (candidate as any).cedula} className="text-sm">
                                                        - {candidate.nombres} {candidate.apellidos}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1 ml-4">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleOpenEditProcessDialog(e, process)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleDeleteProcessClick(e, process)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                               </div>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-10">
                            <Search className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay procesos cerrados</h3>
                            <p className="mt-1 text-sm text-gray-500">Aquí aparecerá el historial de procesos finalizados.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      

      <Sheet open={isCandidateSheetOpen} onOpenChange={setIsCandidateSheetOpen}>
        <SheetContent className="sm:max-w-4xl w-full">
            {activeProcess && (
                <>
                <SheetHeader>
                    <div className="flex items-center justify-between">
                         <div>
                            <DialogTitle>Gestionar Terna</DialogTitle>
                            <DialogDescription>
                                Añade candidatos del repositorio a la terna para el proceso de <span className="font-semibold text-primary">{activeProcess.cargo}</span>.
                            </DialogDescription>
                        </div>
                    </div>
                </SheetHeader>
                <div className="py-6 space-y-8">
                     <CandidateTable
                        title="Repositorio de Candidatos"
                        icon={Users}
                        candidates={filteredAvailableCandidates}
                        isLoading={candidatesLoading}
                        filter={
                            <div className="flex gap-4 mb-4">
                                <Combobox
                                    options={uniqueOptions.candidateCargos.map(cargo => ({ label: cargo, value: cargo }))}
                                    value={titleFilter}
                                    onChange={handleTitleFilterChange}
                                    placeholder="Filtrar por cargo aplicable..."
                                    searchPlaceholder="Buscar cargo..."
                                    notFoundMessage="No se encontró el cargo."
                                    className="max-w-xs"
                                />
                                <div className={cn(!titleFilter && "opacity-50 pointer-events-none")}>
                                    <Combobox
                                        options={professionalTitleOptions}
                                        value={professionalTitleFilter}
                                        onChange={setProfessionalTitleFilter}
                                        placeholder="Filtrar por título profesional..."
                                        searchPlaceholder="Buscar título..."
                                        notFoundMessage="No se encontró el título."
                                        className="max-w-xs"
                                    />
                                </div>
                            </div>
                        }
                        noCandidatesMessage={titleFilter ? `No se encontraron candidatos para el cargo "${titleFilter}".` : "No hay más candidatos en el repositorio."}
                        onCheckChange={handleShortlistToggle}
                        getChecked={(candidateId) => activeProcess.shortlistCandidateIds?.includes(candidateId) || false}
                    />

                    <CandidateTable
                        title="Terna Seleccionada"
                        icon={UserCheck}
                        candidates={shortlistedCandidates}
                        isLoading={candidatesLoading}
                        noCandidatesMessage="Selecciona candidatos del repositorio para añadirlos a la terna."
                        onCheckChange={handleShortlistToggle}
                        getChecked={(candidateId) => activeProcess.shortlistCandidateIds?.includes(candidateId) || false}
                    />
                </div>
                </>
            )}
        </SheetContent>
      </Sheet>
    </div>
  );
}





    