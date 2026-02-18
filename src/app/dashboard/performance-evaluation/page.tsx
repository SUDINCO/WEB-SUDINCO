

"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDown, FileUp, Search, Activity, AlertTriangle, CheckCircle, Clock, History, Download, Trash2, Edit, CalendarDays, LoaderCircle, Save, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Combobox } from '@/components/ui/combobox';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { collection, doc, writeBatch, query, where, getDocs, updateDoc, deleteDoc, addDoc, orderBy, limit } from 'firebase/firestore';
import { PersonDTO } from '@/lib/contracts';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays, set, isBefore, isSameDay, isWithinInterval, subDays, addYears, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserProfile, PerformanceEvaluation, ManagerEvaluation, GenericOption } from '@/lib/types';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { EvaluationCriteriaGroup } from '@/components/evaluation-criteria-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Textarea } from '@/components/ui/textarea';


// --- START OF FORM LOGIC (from [workerId]/page.tsx) ---

const evaluationSchema = z.object({
    conocimientosTecnicos: z.string().min(1),
    conocimientosTecnicosJustification: z.string().optional(),
    calidadTrabajo: z.string().min(1),
    calidadTrabajoJustification: z.string().optional(),
    cumplimientoPoliticas: z.string().min(1),
    cumplimientoPoliticasJustification: z.string().optional(),
    proactividad: z.string().min(1),
    proactividadJustification: z.string().optional(),
    comunicacion: z.string().min(1),
    comunicacionJustification: z.string().optional(),
    integridad: z.string().min(1),
    integridadJustification: z.string().optional(),
    adaptabilidad: z.string().min(1),
    adaptabilidadJustification: z.string().optional(),
    servicioCliente: z.string().min(1),
    servicioClienteJustification: z.string().optional(),
    compromisoCompania: z.string().min(1),
    compromisoCompaniaJustification: z.string().optional(),
    observations: z.string().min(1, "Las observaciones generales son obligatorias."),
    messageForWorker: z.string().optional(),
    observerId: z.string().optional(),
    reinforcementPlan: z.object({
        requiresReinforcement: z.boolean().default(false),
        skillType: z.enum(['tecnica', 'blanda']).optional(),
        specificSkills: z.array(z.string()).optional(),
        reinforcementType: z.string().optional(),
        reinforcementDescription: z.string().optional(),
    }).optional(),
}).refine(data => !['NT', 'BA'].includes(data.conocimientosTecnicos) || (data.conocimientosTecnicosJustification && data.conocimientosTecnicosJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['conocimientosTecnicosJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.calidadTrabajo) || (data.calidadTrabajoJustification && data.calidadTrabajoJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['calidadTrabajoJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.cumplimientoPoliticas) || (data.cumplimientoPoliticasJustification && data.cumplimientoPoliticasJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['cumplimientoPoliticasJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.proactividad) || (data.proactividadJustification && data.proactividadJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['proactividadJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.comunicacion) || (data.comunicacionJustification && data.comunicacionJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['comunicacionJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.integridad) || (data.integridadJustification && data.integridadJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['integridadJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.adaptabilidad) || (data.adaptabilidadJustification && data.adaptabilidadJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['adaptabilidadJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.servicioCliente) || (data.servicioClienteJustification && data.servicioClienteJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['servicioClienteJustification'],
})
.refine(data => !['NT', 'BA'].includes(data.compromisoCompania) || (data.compromisoCompaniaJustification && data.compromisoCompaniaJustification.trim() !== ''), {
    message: 'La justificación es obligatoria para NT o BA.',
    path: ['compromisoCompaniaJustification'],
})
.refine(data => {
    if (data.reinforcementPlan?.requiresReinforcement) {
        return data.reinforcementPlan.skillType;
    }
    return true;
}, { message: "Debe seleccionar un tipo de habilidad.", path: ['reinforcementPlan.skillType']})
.refine(data => {
    if (data.reinforcementPlan?.requiresReinforcement && data.reinforcementPlan.skillType === 'blanda') {
        return data.reinforcementPlan.specificSkills && data.reinforcementPlan.specificSkills.length > 0;
    }
    return true;
}, { message: "Debe seleccionar al menos una habilidad blanda.", path: ['reinforcementPlan.specificSkills']})
.refine(data => {
    if (data.reinforcementPlan?.requiresReinforcement) {
        return !!data.reinforcementPlan.reinforcementType;
    }
    return true;
}, { message: "Debe seleccionar el tipo de capacitación.", path: ['reinforcementPlan.reinforcementType']})
.refine(data => {
    if (data.reinforcementPlan?.requiresReinforcement && data.reinforcementPlan.skillType === 'tecnica') {
        return !!data.reinforcementPlan.reinforcementDescription && data.reinforcementPlan.reinforcementDescription.trim() !== '';
    }
    return true;
}, { message: "La descripción de la capacitación es obligatoria.", path: ['reinforcementPlan.reinforcementDescription']})
.refine(data => {
    if (data.reinforcementPlan?.requiresReinforcement && data.reinforcementPlan.skillType === 'blanda') {
        return !!data.reinforcementPlan.reinforcementDescription && data.reinforcementPlan.reinforcementDescription.trim() !== '';
    }
    return true;
}, { message: "La descripción del plan de capacitación es obligatoria.", path: ['reinforcementPlan.reinforcementDescription']});

const ratingValues: Record<string, number> = { NT: 1, BA: 2, ED: 3, TI: 4 };

const hardSkillsOptions = [
    { value: 'Manejo de maquinaria', label: 'Manejo de maquinaria' },
    { value: 'Operación de vehículos / equipo pesado', label: 'Operación de vehículos / equipo pesado' },
    { value: 'Uso de software de la empresa (ERP, Excel, etc.)', label: 'Uso de software de la empresa (ERP, Excel, etc.)' },
    { value: 'Seguridad laboral / prevención de riesgos', label: 'Seguridad laboral / prevención de riesgos' },
    { value: 'Lectura de planos / métricas de obra', label: 'Lectura de planos / métricas de obra' },
];

const softSkillsOptions = [
    { value: 'Comunicación efectiva', label: 'Comunicación efectiva' },
    { value: 'Trabajo en equipo', label: 'Trabajo en equipo' },
    { value: 'Liderazgo / gestión de personas', label: 'Liderazgo / gestión de personas' },
    { value: 'Resolución de problemas / toma de decisiones', label: 'Resolución de problemas / toma de decisiones' },
    { value: 'Gestión del tiempo / productividad', label: 'Gestión del tiempo / productividad' },
];

const reinforcementTypeOptions = [
    { value: 'Taller práctico', label: 'Taller práctico' },
    { value: 'Capacitación / curso', label: 'Capacitación / curso' },
    { value: 'Certificación', label: 'Certificación' },
    { value: 'Mentoría / acompañamiento', label: 'Mentoría / acompañamiento' },
    { value: 'E-learning / curso virtual', label: 'E-learning / curso virtual' },
];

function EvaluationForm({ workerId, reviewEvaluationId }: { workerId: string, reviewEvaluationId: string | null }) {
    const router = useRouter();
    const firestore = useFirestore();
    
    const workerDocRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'users', workerId);
    }, [firestore, workerId]);
    const { data: worker, isLoading: workerLoading } = useDoc<UserProfile>(workerDocRef);

    const { data: allUsers, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));

    const evaluator = useMemo(() => {
        if (!allUsers || !worker) return null;
        return allUsers.find(u => u.email === (worker.evaluador || worker.liderArea)) || null;
    }, [allUsers, worker]);
    
    const evaluationToReviewRef = useMemo(() => {
        if (!firestore || !reviewEvaluationId) return null;
        return doc(firestore, 'performanceEvaluations', reviewEvaluationId);
    }, [firestore, reviewEvaluationId]);
    const { data: evaluationToReview, isLoading: isReviewLoading } = useDoc(evaluationToReviewRef);

    const form = useForm<z.infer<typeof evaluationSchema>>({
        resolver: zodResolver(evaluationSchema),
        defaultValues: {
            conocimientosTecnicos: "NT",
            calidadTrabajo: "NT",
            cumplimientoPoliticas: "NT",
            proactividad: "NT",
            comunicacion: "NT",
            integridad: "NT",
            adaptabilidad: "NT",
            servicioCliente: "NT",
            compromisoCompania: "NT",
            observations: "",
            reinforcementPlan: {
                requiresReinforcement: false,
                skillType: undefined,
                specificSkills: [],
                reinforcementType: '',
                reinforcementDescription: ''
            }
        }
    });

    useEffect(() => {
        if (evaluationToReview && !isReviewLoading) {
            form.reset(evaluationToReview);
        } else if (!reviewEvaluationId && firestore && worker) {
            const fetchLastEvaluation = async () => {
                const evalsQuery = query(
                    collection(firestore, 'performanceEvaluations'),
                    where('workerId', '==', worker.id),
                    orderBy('evaluationDate', 'desc'),
                    limit(1)
                );
                const querySnapshot = await getDocs(evalsQuery);
                if (!querySnapshot.empty) {
                    const lastEval = querySnapshot.docs[0].data();
                    form.reset(lastEval);
                }
            };
            fetchLastEvaluation().catch(err => {
                // This might fail if the index is missing. We can handle it gracefully.
                console.warn("Could not fetch last evaluation, likely due to a missing index. Starting with a blank form.", err);
            });
        }
    }, [evaluationToReview, isReviewLoading, reviewEvaluationId, firestore, worker, form]);


    const watchedValues = form.watch();

    const generalEvaluation = useMemo(() => {
        const scores = [
            ratingValues[watchedValues.conocimientosTecnicos],
            ratingValues[watchedValues.calidadTrabajo],
            ratingValues[watchedValues.cumplimientoPoliticas],
            ratingValues[watchedValues.proactividad],
            ratingValues[watchedValues.comunicacion],
            ratingValues[watchedValues.integridad],
            ratingValues[watchedValues.adaptabilidad],
            ratingValues[watchedValues.servicioCliente],
            ratingValues[watchedValues.compromisoCompania],
        ].filter(Boolean);

        if (scores.length === 0) return 0;

        const totalScore = scores.reduce((acc, score) => acc + score, 0);
        const maxScore = scores.length * 4;
        return Math.round((totalScore / maxScore) * 100);

    }, [watchedValues]);


    const onSubmit = async (data: z.infer<typeof evaluationSchema>) => {
        if (!worker || !evaluator || !firestore || !allUsers) return;

        const observer = allUsers?.find(u => u.email === worker.observerEmail);
        const hasObserver = !!worker.observerEmail;
        
        const evaluationData: any = {
            ...data,
            workerId: worker.id,
            evaluatorId: evaluator.id,
            evaluationDate: new Date().toISOString().split('T')[0],
            generalEvaluation: generalEvaluation,
            observerId: observer?.id || null,
            observerEmail: worker.observerEmail || null,
            observerStatus: hasObserver ? 'pending' : 'approved' as 'pending' | 'approved' | 'review_requested',
            observerComments: '',
        };

        if (!evaluationData.reinforcementPlan?.requiresReinforcement) {
            evaluationData.reinforcementPlan = {
                requiresReinforcement: false,
                skillType: '',
                specificSkills: [],
                reinforcementType: '',
                reinforcementDescription: ''
            };
        }

        try {
            if (reviewEvaluationId) {
                const evalDocRef = doc(firestore, 'performanceEvaluations', reviewEvaluationId);
                await updateDoc(evalDocRef, {...evaluationData, observerStatus: 'pending' as const });
                toast({
                    title: "Re-evaluación Guardada",
                    description: `La evaluación para ${worker.nombres} ${worker.apellidos} ha sido actualizada y enviada nuevamente al observador.`,
                });
            } else {
                const evaluationsCollectionRef = collection(firestore, 'performanceEvaluations');
                await addDoc(evaluationsCollectionRef, evaluationData);
                toast({
                    title: "Evaluación Terminada",
                    description: `La evaluación para ${worker.nombres} ${worker.apellidos} ha sido guardada.`,
                });
            }
            router.push('/dashboard/my-evaluations');

        } catch (error) {
            console.error("Failed to save evaluation", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la evaluación." });
        }
    };
    
    if (workerLoading || usersLoading || isReviewLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4">Cargando datos del formulario...</p>
            </div>
        );
    }

    if (!worker) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-center">
                <h2 className="text-xl font-semibold text-destructive">Error</h2>
                <p className="text-muted-foreground">Trabajador no encontrado con el ID: {workerId}</p>
                <Button onClick={() => router.back()} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
            </div>
        );
    }

    const evaluationCriteria = [
        { name: "conocimientosTecnicos", title: "Conocimientos Técnicos, Experiencia y Habilidades", description: "Tiene los conocimientos, experiencia y habilidades necesarios para el cargo y desempeñar a cabalidad sus funciones." },
        { name: "calidadTrabajo", title: "Calidad del trabajo", description: "Se interesa en hacer bien su trabajo cumpliendo estándares de calidad con excelencia, la atención al detalle y cumple objetivos." },
        { name: "cumplimientoPoliticas", title: "Cumplimiento de Políticas, procedimientos y funciones", description: "Conoce y cumple las políticas y procedimientos de la empresa, Sistema de Gestión Integrado, Manual de funciones, directrices del jefe inmediato y participa activamente en actividades de cumplimiento." },
        { name: "proactividad", title: "Proactividad", description: "Propone ideas, se anticipa a los problemas y busca mejoras constantemente." },
        { name: "comunicacion", title: "Comunicación y Relaciones Interpersonales", description: "Transmite, recibe y entiende la información de manera clara, concisa y efectiva. Mantiene buenas relaciones con sus jefes y compañeros de trabajo, saluda, es cortés, mantiene respeto y trabaja en equipo." },
        { name: "integridad", title: "Integridad y Ética", description: "Es honesto, dice la verdad, reconoce sus errores, sigue las reglas éticas." },
        { name: "adaptabilidad", title: "Adaptabilidad", description: "Mantiene estabilidad emocional, continúa con actitud positiva, buena predisposición y buen desempeño pese a las circunstancias." },
        { name: "servicioCliente", title: "Servicio al Cliente", description: "Tiene el deseo de ayudar y servir a sus clientes internos y externos, tiene la capacidad de comprender, apoyar y satisfacer sus necesidades." },
        { name: "compromisoCompania", title: "Compromiso con la Compañía", description: "Es responsable con sus herramientas de trabajo, cuida los bienes a cargo, optimiza recursos. Llega puntualmente a su lugar de trabajo y no tiene atrasos o faltas injustificadas. Es leal y está predispuesto a dar un esfuerzo extra." },
    ] as const;

    const grades = [
        { abbrevia: 'NT', criterio: 'NO TIENE', descripcion: 'No conoce, ni evidencia comportamientos asociados a la competencia.', color: 'bg-red-500' },
        { abbrevia: 'BA', criterio: 'BAJO', descripcion: 'Muestra destellos en la aplicación de algunos comportamientos asociados a la competencia.', color: 'bg-yellow-400' },
        { abbrevia: 'ED', criterio: 'EN DESARROLLO', descripcion: 'Demuestra comportamientos asociados a la competencia pero necesita apoyo.', color: 'bg-green-500' },
        { abbrevia: 'TI', criterio: 'TIENE', descripcion: 'Domina con un gran nivel de experticia los comportamientos asociados a la competencia.', color: 'bg-teal-500' },
    ];
    
    const displayDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if(isNaN(date.getTime())) return 'N/A';
        // Adjusting for timezone issues
        const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        return adjustedDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const currentSkillOptions = form.watch("reinforcementPlan.skillType") === 'tecnica' ? [] : softSkillsOptions;


    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <Image 
                        src="https://core.gruposudinco.com/_images/companies/company.png"
                        alt="Grupo Sudinco Logo"
                        width={250}
                        height={125}
                        className="w-48"
                        objectFit='contain'
                    />
                </div>
                <div className="flex-1 text-center font-bold">
                    <h1 className="text-2xl">RECURSOS HUMANOS</h1>
                    <h2 className="text-lg text-muted-foreground">FORMULARIO</h2>
                    <h3 className="text-3xl text-primary whitespace-nowrap">EVALUACIÓN DE DESEMPEÑO</h3>
                </div>
                <div className="flex-1 flex justify-end">
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                </div>
            </div>
            
            <div className="border rounded-lg">
                <div className="bg-gray-400 text-white text-center p-1 font-bold text-sm">DATOS DEL COLABORADOR</div>
                <div className="grid grid-cols-2 md:grid-cols-4 border-t border-gray-300">
                    <div className="p-2 border-r border-gray-300"><span className="font-bold">Cédula:</span> {worker.cedula}</div>
                    <div className="p-2 border-r border-gray-300"><span className="font-bold">Nombre:</span> {worker.apellidos} {worker.nombres}</div>
                    <div className="p-2 border-r border-gray-300"><span className="font-bold">Fecha Ingreso:</span> {displayDate(worker.fechaIngreso)}</div>
                    <div className="p-2"><span className="font-bold">Empresa:</span> {worker.empresa}</div>
                </div>
                 <div className="grid grid-cols-2 md:grid-cols-3 border-t border-gray-300">
                    <div className="p-2 border-r border-gray-300"><span className="font-bold">Cargo:</span> {worker.cargo}</div>
                    <div className="p-2 border-r border-gray-300"><span className="font-bold">Ubicación:</span> {worker.ubicacion || 'N/A'}</div>
                    <div className="p-2"><span className="font-bold">Departamento:</span> {worker.departamento}</div>
                </div>
            </div>

            <Form {...form}>
            <div className="border rounded-lg">
                <div className="bg-gray-400 text-white text-center p-1 font-bold text-sm">DATOS DE LA EVALUACIÓN</div>
                <div className="grid grid-cols-1 md:grid-cols-3 items-center border-t border-gray-300 p-3 gap-4">
                    <div className="space-y-1">
                        <p className="font-bold text-sm">Evaluador:</p>
                        <p>{evaluator?.apellidos || ''} {evaluator?.nombres || ''} ({evaluator?.cargo || 'N/A'})</p>
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-sm">Observador:</p>
                        <p>{worker.observerEmail || 'No asignado'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-sm">Fecha evaluación:</p>
                        <p>{new Date().toLocaleDateString('es-ES')}</p>
                    </div>
                </div>
            </div>

            {reviewEvaluationId && evaluationToReview?.observerComments && (
                 <Card className="bg-amber-50 border-amber-200">
                    <CardHeader>
                        <CardTitle className="text-amber-800 text-lg">Comentarios del Observador para Revisión</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-amber-900 italic">"{evaluationToReview.observerComments}"</p>
                    </CardContent>
                </Card>
            )}

            <div className="border rounded-lg">
                <div className="bg-gray-200 text-center p-2 font-bold text-sm">GRADOS DE EVALUACIÓN</div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px] border font-bold text-center">ABREVIA</TableHead>
                            <TableHead className="w-[150px] border font-bold text-center">CRITERIO</TableHead>
                            <TableHead className="border font-bold text-center">DESCRIPCIÓN</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {grades.map(grade => (
                            <TableRow key={grade.abbrevia}>
                                <TableCell className={`border font-bold text-white text-center ${grade.color}`}>{grade.abbrevia}</TableCell>
                                <TableCell className="border font-semibold text-center">{grade.criterio}</TableCell>
                                <TableCell className="border text-sm">{grade.descripcion}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                        {evaluationCriteria.map(criteria => (
                            <Controller key={criteria.name} name={criteria.name} control={form.control} render={({ field }) => (
                                <Controller name={`${criteria.name}Justification`} control={form.control} render={({ field: justificationField }) => (
                                    <EvaluationCriteriaGroup title={criteria.title} description={criteria.description} field={field} justificationField={justificationField} formInstance={form} />
                                )}/>
                            )}/>
                        ))}
                    </div>
                    
                    <Separator />

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                        <Card className="md:col-span-2">
                            <CardHeader><CardTitle>Comentarios Finales</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="observations"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-semibold">Observaciones Generales (Uso Interno)</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    placeholder="Añada sus observaciones generales..."
                                                    className="min-h-[120px]"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="messageForWorker"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-semibold">Mensaje para el Colaborador</FormLabel>
                                            <FormDescription>Este mensaje será visible para el empleado en su portal.</FormDescription>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    placeholder="Escribe un mensaje constructivo para el colaborador..."
                                                    className="min-h-[120px]"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card className="text-center flex flex-col justify-center">
                            <CardHeader><CardTitle>Evaluación General</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-6xl font-bold text-primary">{generalEvaluation}%</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Plan de Capacitación</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="reinforcementPlan.requiresReinforcement"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">¿El empleado requiere un plan de capacitación?</FormLabel>
                                            <FormDescription>Si la respuesta es afirmativa, se desplegarán campos adicionales.</FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {form.watch("reinforcementPlan.requiresReinforcement") && (
                                <div className="space-y-6 pt-6 border-t">
                                    <FormField
                                        control={form.control}
                                        name="reinforcementPlan.skillType"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel className="font-semibold">Tipo de habilidad a reforzar:</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                                            <FormControl><RadioGroupItem value="tecnica" /></FormControl>
                                                            <FormLabel className="font-normal">Técnica</FormLabel>
                                                        </FormItem>
                                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                                            <FormControl><RadioGroupItem value="blanda" /></FormControl>
                                                            <FormLabel className="font-normal">Blanda</FormLabel>
                                                        </FormItem>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {form.watch("reinforcementPlan.skillType") === 'tecnica' && (
                                        <>
                                            <FormField
                                                control={form.control}
                                                name="reinforcementPlan.reinforcementDescription"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold">Descripción de la Capacitación</FormLabel>
                                                        <FormControl>
                                                            <Textarea placeholder="Detalle el taller, curso o certificación requerido..." {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="reinforcementPlan.reinforcementType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold">Modalidad de la Capacitación</FormLabel>
                                                        <Combobox options={reinforcementTypeOptions} placeholder="Seleccionar modalidad..." searchPlaceholder="Buscar o crear modalidad..." allowCreate {...field} />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </>
                                    )}
                                    {form.watch("reinforcementPlan.skillType") === 'blanda' && (
                                        <>
                                            <FormField
                                                control={form.control}
                                                name="reinforcementPlan.specificSkills"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold">Habilidades Blandas Específicas</FormLabel>
                                                        <MultiSelectCombobox options={softSkillsOptions} selected={field.value || []} onChange={field.onChange} placeholder="Seleccionar habilidades..." searchPlaceholder="Buscar o crear habilidad..." />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="reinforcementPlan.reinforcementDescription"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold">Descripción Detallada del Plan</FormLabel>
                                                        <FormControl>
                                                            <Textarea placeholder="Explique qué se hará, duración, objetivo, etc." {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="reinforcementPlan.reinforcementType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-semibold">Modalidad de la Capacitación</FormLabel>
                                                        <Combobox options={reinforcementTypeOptions} placeholder="Seleccionar modalidad..." searchPlaceholder="Buscar o crear modalidad..." allowCreate {...field} />
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                            <Save className="mr-2 h-5 w-5" />
                            {form.formState.isSubmitting ? "Terminando..." : "Terminar Evaluación"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}

// --- START OF LIST LOGIC (from original page.tsx) ---

const parseDate = (dateString: string): Date | null => {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.split(/[-/]/);
  if (parts.length !== 3) return null;
  let year, month, day;
  if (parts[0].length === 4) { [year, month, day] = parts.map(Number); }
  else { [day, month, year] = parts.map(Number); }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
};

const getEvaluationStatus = (worker: UserProfile, evaluations: PerformanceEvaluation[]) => {
    const { fechaIngreso, fechaEvaluacionAnual } = worker;
    const hireDate = parseDate(fechaIngreso);
    if (!hireDate) return { status: 'invalido', message: 'Fecha inválida', days: NaN, isCompleted: false };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isFinalized = (ev: PerformanceEvaluation) => !worker.observerEmail || ev.observerStatus === 'approved';
    
    const annualReferenceDate = fechaEvaluacionAnual ? parseDate(fechaEvaluacionAnual) : hireDate;
    if (!annualReferenceDate) return { status: 'invalido', message: 'Fecha ref. inválida', days: NaN, isCompleted: false };

    let nextDueDate = set(new Date(), { 
        month: annualReferenceDate.getUTCMonth(), 
        date: annualReferenceDate.getUTCDate(), 
        hours: 0, minutes: 0, seconds: 0, milliseconds: 0 
    });
    
    if (isBefore(nextDueDate, today) || isSameDay(nextDueDate, today)) {
         nextDueDate = addYears(nextDueDate, 1);
    }
    
    const cycleEndDate = nextDueDate;
    const cycleStartDate = addYears(cycleEndDate, -1);
    
    const cycleEvaluations = evaluations.filter(ev => {
        const evalDate = parseDate(ev.evaluationDate);
        return evalDate && isWithinInterval(evalDate, { start: cycleStartDate, end: cycleEndDate });
    });

    if (cycleEvaluations.some(isFinalized)) {
        return { status: 'completado', message: 'Evaluación Anual Completa', days: Infinity, isCompleted: true };
    }
    if (cycleEvaluations.some(ev => ev.observerStatus === 'pending')) {
         return { status: 'pending_observation', message: 'Pendiente de Observador', isCompleted: false, days: Infinity };
    }

    const daysDifference = differenceInDays(today, cycleEndDate);
    
    if (daysDifference > 0) {
        return { status: 'atrasado', message: `Evaluación Anual: ${daysDifference} días de retraso`, days: -daysDifference, isCompleted: false };
    }
    
    const daysLeft = Math.abs(daysDifference);
    
    if (daysLeft <= 45) {
        return { status: 'alerta', message: `Evaluación Anual: ${daysLeft} días restantes`, days: daysLeft, isCompleted: false };
    }
    
    return { status: 'pendiente', message: `Evaluación Anual en ${daysLeft} días`, days: daysLeft, isCompleted: false };
};


const EvaluationStatusBadge = ({ status, message }: { status: string, message: string }) => {
    switch (status) {
        case 'pendiente': return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="mr-1 h-3 w-3" />{message}</Badge>;
        case 'alerta': return <Badge variant="default" className="bg-orange-400 text-orange-900"><AlertTriangle className="mr-1 h-3 w-3" />{message}</Badge>;
        case 'atrasado': return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{message}</Badge>;
        case 'completado': return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />{message}</Badge>;
        case 'pending_observation': return <Badge variant="secondary" className="bg-purple-100 text-purple-800"><Clock className="mr-1 h-3 w-3" />{message}</Badge>;
        default: return <Badge variant="secondary">{message}</Badge>;
    }
};

function EvaluationHistorySheet({ open, onOpenChange, worker, allEvaluations, allWorkers }: { open: boolean, onOpenChange: (open: boolean) => void, worker: UserProfile | null, allEvaluations: PerformanceEvaluation[], allWorkers: UserProfile[] }) {
    const firestore = useFirestore();
    const [evaluationToDelete, setEvaluationToDelete] = useState<PerformanceEvaluation | null>(null);

    const workerEvaluations = useMemo(() => {
        if (!worker || !allEvaluations) return [];
        return allEvaluations
            .filter(e => e.workerId === worker.id)
            .sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime());
    }, [worker, allEvaluations]);

    const getEvaluatorName = (evaluatorId: string) => {
        const evaluator = allWorkers.find(w => w.id === evaluatorId);
        return evaluator ? `${evaluator.nombres} ${evaluator.apellidos}` : 'Desconocido';
    };
    
     const handleDownloadPdf = async (evaluation: PerformanceEvaluation) => {
        if(!worker) return;
        const { generateEvaluationPDF } = await import('@/lib/pdf-generator');
        const evaluator = allWorkers?.find(w => w.id === evaluation.evaluatorId);
        if (!evaluator) {
             toast({
                variant: "destructive",
                title: "Error al generar PDF",
                description: "No se pudo encontrar la información del evaluador.",
            });
            return;
        }

        const workerDTO: PersonDTO = {
            cedula: worker.cedula,
            nombreCompleto: `${worker.apellidos} ${worker.nombres}`,
            fechaIngreso: worker.fechaIngreso,
            empresa: worker.empresa,
            cargo: worker.cargo,
            ubicacion: worker.ubicacion || 'N/A',
            departamento: worker.departamento,
        };

        const evaluatorDTO: PersonDTO = {
            cedula: evaluator.cedula,
            nombreCompleto: `${evaluator.apellidos} ${evaluator.nombres}`,
            fechaIngreso: evaluator.fechaIngreso,
            empresa: evaluator.empresa,
            cargo: evaluator.cargo,
            ubicacion: evaluator.ubicacion || 'N/A',
            departamento: evaluator.departamento,
        };
       
        generateEvaluationPDF(workerDTO, evaluatorDTO, evaluation);
    };

    const handleDeleteClick = (evaluation: PerformanceEvaluation) => {
        setEvaluationToDelete(evaluation);
    };

    const confirmDelete = async () => {
        if (!evaluationToDelete || !firestore) return;
        try {
            await deleteDoc(doc(firestore, "performanceEvaluations", evaluationToDelete.id));
            toast({
                title: "Evaluación Eliminada",
                description: "El registro de la evaluación ha sido eliminado permanentemente.",
            });
        } catch (error) {
            console.error("Error deleting evaluation:", error);
            toast({
                variant: "destructive",
                title: "Error al Eliminar",
                description: "No se pudo eliminar la evaluación.",
            });
        } finally {
            setEvaluationToDelete(null);
        }
    };

    return (
        <>
        <AlertDialog open={!!evaluationToDelete} onOpenChange={() => setEvaluationToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente este registro de evaluación.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                        Eliminar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-3xl w-full">
                <SheetHeader>
                    <SheetTitle>Historial de Evaluaciones</SheetTitle>
                    <SheetDescription>
                        Mostrando el historial para el empleado: <span className="font-semibold text-primary">{worker?.nombres} {worker?.apellidos}</span>.
                    </SheetDescription>
                </SheetHeader>
                <div className="py-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha de Evaluación</TableHead>
                                <TableHead>Evaluador</TableHead>
                                <TableHead>Nota General</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workerEvaluations.length > 0 ? (
                                workerEvaluations.map((evaluation) => (
                                    <TableRow key={evaluation.id}>
                                        <TableCell>{new Date(evaluation.evaluationDate).toLocaleDateString('es-ES')}</TableCell>
                                        <TableCell>{getEvaluatorName(evaluation.evaluatorId)}</TableCell>
                                        <TableCell>{evaluation.generalEvaluation}%</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(evaluation)}>
                                                <Download className="mr-2 h-4 w-4" />
                                                PDF
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(evaluation)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Este empleado aún no tiene evaluaciones.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </SheetContent>
        </Sheet>
        </>
    );
}

function EvaluationList() {
    const router = useRouter();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [filter, setFilter] = useState('');
    const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<UserProfile | null>(null);
    const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
    
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [assignmentData, setAssignmentData] = useState<{ worker: UserProfile; field: 'evaluador' | 'observerEmail' } | null>(null);
    const [selectedNewAssignee, setSelectedNewAssignee] = useState('');
    
    const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
    const [dateAssignmentWorker, setDateAssignmentWorker] = useState<UserProfile | null>(null);
    const [selectedAnnualDate, setSelectedAnnualDate] = useState<Date | undefined>(undefined);

    const [isGeneralDateDialogOpen, setIsGeneralDateDialogOpen] = useState(false);
    const [selectedGeneralDate, setSelectedGeneralDate] = useState<Date | undefined>(undefined);
    const [isConfirmGeneralDateAlertOpen, setIsConfirmGeneralDateAlertOpen] = useState(false);
    
    const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);


    const firestore = useFirestore();
    const usersCollectionRef = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const evaluationsCollectionRef = useMemo(() => firestore ? collection(firestore, 'performanceEvaluations') : null, [firestore]);
    const managerEvaluationsCollectionRef = useMemo(() => firestore ? collection(firestore, 'managerEvaluations') : null, [firestore]);

    const { data: workersData, isLoading: loading } = useCollection<UserProfile>(usersCollectionRef);
    const { data: evaluationsData, isLoading: evaluationsLoading } = useCollection<PerformanceEvaluation>(evaluationsCollectionRef);
    const { data: managerEvaluationsData, isLoading: managerEvaluationsLoading } = useCollection<ManagerEvaluation>(managerEvaluationsCollectionRef);
    
    const evaluationsByWorker = useMemo(() => {
        if (!evaluationsData) return new Map<string, PerformanceEvaluation[]>();
        const map = new Map<string, PerformanceEvaluation[]>();
        for (const evaluation of evaluationsData) {
            if (!map.has(evaluation.workerId)) {
                map.set(evaluation.workerId, []);
            }
            map.get(evaluation.workerId)!.push(evaluation);
        }
        for (const workerId of map.keys()) {
            map.get(workerId)!.sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime());
        }
        return map;
    }, [evaluationsData]);

    const workersWithStatus = useMemo(() => {
        if (loading || evaluationsLoading || !workersData || !evaluationsData) {
          return { pending: [], completed: [] };
        }
    
        const activeWorkers = workersData; // Include all workers
        const pending: any[] = [];
        const completed: any[] = [];
    
        activeWorkers.forEach(worker => {
          if (worker.Status !== 'active') {
              // Inactive workers always go to 'completed'
              completed.push({ ...worker, statusInfo: { isCompleted: true, message: 'Inactivo' }, lastEvaluation: evaluationsByWorker.get(worker.id)?.[0], evaluationCount: (evaluationsByWorker.get(worker.id) || []).length });
              return;
          }

          const workerEvaluations = evaluationsByWorker.get(worker.id) || [];
          const statusInfo = getEvaluationStatus(worker, workerEvaluations);
          
          const lastEvaluation = workerEvaluations[0]; 
    
          if (statusInfo.isCompleted) {
              completed.push({ ...worker, statusInfo, lastEvaluation, evaluationCount: workerEvaluations.length });
          } else {
              pending.push({ ...worker, statusInfo, lastEvaluation, evaluationCount: workerEvaluations.length });
          }
        });
    
        pending.sort((a, b) => a.statusInfo.days - b.statusInfo.days);
        
        completed.sort((a, b) => {
            if (a.Status === 'inactive' && b.Status !== 'inactive') return 1;
            if (a.Status !== 'inactive' && b.Status === 'inactive') return -1;
            const dateA = a.lastEvaluation ? parseDate(a.lastEvaluation.evaluationDate) : null;
            const dateB = b.lastEvaluation ? parseDate(b.lastEvaluation.evaluationDate) : null;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB.getTime() - dateA.getTime();
        });
    
        return { pending, completed };
    }, [loading, evaluationsLoading, workersData, evaluationsByWorker]);

    const { pending: filteredPending, completed: filteredCompleted } = useMemo(() => {
        const { pending, completed } = workersWithStatus;
        
        const normalizeForSearch = (text: string | undefined | null): string => {
            if (!text) return '';
            return text
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();
        };

        const searchTerms = normalizeForSearch(filter).split(/\s+/).filter(Boolean);
        if (searchTerms.length === 0) {
            return { pending, completed };
        }

        const filterFn = (worker: any) => {
            const userString = normalizeForSearch(`
                ${worker.nombres || ''} 
                ${worker.apellidos || ''} 
                ${worker.cedula || ''}
            `);

            return searchTerms.every(term => userString.includes(term));
        };

        return {
            pending: pending.filter(filterFn),
            completed: completed.filter(filterFn),
        };
    }, [workersWithStatus, filter]);

    const userOptions = useMemo(() => {
        if (!workersData) return [];
        return workersData.map(w => ({
            value: w.email,
            label: `${w.nombres} ${w.apellidos}`,
            description: w.cargo
        }));
    }, [workersData]);

    const handleOpenAssignDialog = (worker: UserProfile, field: 'evaluador' | 'observerEmail') => {
        const currentEmail = field === 'evaluador' ? (worker.evaluador || worker.liderArea) : worker.observerEmail;
        setAssignmentData({ worker, field });
        setSelectedNewAssignee(currentEmail || '');
        setIsAssignDialogOpen(true);
    };
    
    const handleConfirmAssignment = async () => {
        if (!assignmentData || !firestore) return;
        
        const { worker, field } = assignmentData;
        const workerDocRef = doc(firestore, 'users', worker.id);

        try {
            await updateDoc(workerDocRef, { [field]: selectedNewAssignee });
            
            toast({
                title: `${field === 'evaluador' ? 'Evaluador' : 'Observador'} actualizado`,
                description: `El rol ha sido asignado correctamente.`
            });
        } catch(e) {
            console.error(`Error updating ${field}:`, e);
            toast({
                variant: 'destructive',
                title: "Error",
                description: `No se pudo actualizar el rol.`
            });
        } finally {
            setIsAssignDialogOpen(false);
            setAssignmentData(null);
            setSelectedNewAssignee('');
        }
    };
    
    const handleOpenDateDialog = (worker: UserProfile) => {
        setDateAssignmentWorker(worker);
        setSelectedAnnualDate(worker.fechaEvaluacionAnual ? parseDate(worker.fechaEvaluacionAnual) ?? undefined : undefined);
        setIsDateDialogOpen(true);
    };
    
    const handleConfirmDateAssignment = async () => {
        if (!dateAssignmentWorker || !selectedAnnualDate || !firestore) return;
        
        const workerDocRef = doc(firestore, 'users', dateAssignmentWorker.id);
        const dateToSave = format(selectedAnnualDate, 'yyyy-MM-dd');

        try {
            await updateDoc(workerDocRef, { fechaEvaluacionAnual: dateToSave });

            toast({
                title: 'Fecha de Evaluación Actualizada',
                description: `Se asignó la fecha de evaluación anual para ${dateAssignmentWorker.nombres}.`
            });
        } catch(e) {
            console.error(`Error updating date:`, e);
            toast({
                variant: 'destructive',
                title: "Error",
                description: `No se pudo actualizar la fecha.`
            });
        } finally {
            setIsDateDialogOpen(false);
            setDateAssignmentWorker(null);
            setSelectedAnnualDate(undefined);
        }
    };
    
    const handleConfirmGeneralDateAssignment = async () => {
        if (!selectedGeneralDate || !firestore || !workersData) return;
        
        const dateToSave = format(selectedGeneralDate, 'yyyy-MM-dd');
        const batch = writeBatch(firestore);
        
        const activeWorkers = workersData.filter(w => w.Status === 'active');
        activeWorkers.forEach(worker => {
            const workerDocRef = doc(firestore, 'users', worker.id);
            batch.update(workerDocRef, { fechaEvaluacionAnual: dateToSave });
        });

        try {
            await batch.commit();
            toast({
                title: 'Fechas Actualizadas',
                description: `Se asignó la fecha de evaluación anual a ${activeWorkers.length} empleados activos.`
            });
        } catch (error) {
            console.error('Error updating general date:', error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: `No se pudieron actualizar las fechas.`
            });
        } finally {
            setIsConfirmGeneralDateAlertOpen(false);
            setIsGeneralDateDialogOpen(false);
        }
    };

    const displayDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const date = parseDate(dateStr);
        if(!date) return 'N/A';
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    }
    
    const getAssigneeName = (email: string | undefined | null) => {
        if (!email || !workersData) return null;
        const user = workersData.find(w => w.email === email);
        return user ? `${user.nombres} ${user.apellidos}` : email;
    };
    
    const handleExportSummary = () => {
        const workersToExport = [...filteredPending, ...filteredCompleted];
        
        const dataToExport = workersToExport.map(worker => {
            const rowData: { [key: string]: any } = {
                'Código': worker.codigo,
                'Empleado': `${worker.apellidos} ${worker.nombres}`,
                'Cargo': worker.cargo,
                'Tipo Contrato': worker.tipoContrato || 'N/A',
                'Evaluador Asignado': getAssigneeName(worker.evaluador || worker.liderArea) || 'No asignado',
                'Observador Asignado': getAssigneeName(worker.observerEmail) || 'No asignado',
            };

            const lastEval = worker.lastEvaluation;
            if (lastEval && lastEval.reinforcementPlan) {
                const plan = lastEval.reinforcementPlan;
                rowData['Plan: Requerido'] = plan.requiresReinforcement ? 'SÍ' : 'NO';
                rowData['Plan: Tipo Habilidad'] = plan.skillType || 'N/A';
                rowData['Plan: Habilidades'] = Array.isArray(plan.specificSkills) ? plan.specificSkills.join(', ') : (plan.specificSkills || 'N/A');
                rowData['Plan: Modalidad'] = plan.reinforcementType || 'N/A';
                rowData['Plan: Descripción'] = plan.reinforcementDescription || 'N/A';
            } else {
                rowData['Plan: Requerido'] = 'N/A';
                rowData['Plan: Tipo Habilidad'] = 'N/A';
                rowData['Plan: Habilidades'] = 'N/A';
                rowData['Plan: Modalidad'] = 'N/A';
                rowData['Plan: Descripción'] = 'N/A';
            }
    
            // Performance Evaluation Averages
            const workerEvaluations = evaluationsByWorker.get(worker.id) || [];
            if (workerEvaluations.length > 0) {
                const ratingValues: Record<string, number> = { NT: 1, BA: 2, ED: 3, TI: 4 };
                const competencyKeys = ["conocimientosTecnicos", "calidadTrabajo", "cumplimientoPoliticas", "proactividad", "comunicacion", "integridad", "adaptabilidad", "servicioCliente", "compromisoCompania"];
    
                competencyKeys.forEach(key => {
                    const sumPercentage = workerEvaluations.reduce((acc, ev) => {
                        const score = ratingValues[ev[key as keyof PerformanceEvaluation] as string] || 1; // Default to 1 (NT) if not found
                        const percentage = ((score - 1) / 3) * 100;
                        return acc + percentage;
                    }, 0);
                    rowData[`Prom. ${key} (%)`] = (sumPercentage / workerEvaluations.length).toFixed(0);
                });
                const generalEvalSum = workerEvaluations.reduce((acc, ev) => acc + (ev.generalEvaluation || 0), 0);
                rowData['Prom. Nota Desempeño (%)'] = (generalEvalSum / workerEvaluations.length).toFixed(0);
            }
    
            // 180 Feedback Averages
            if (worker.isLeader) {
                const leaderEvaluations = managerEvaluationsData?.filter(me => me.managerId === worker.id) || [];
                if (leaderEvaluations.length > 0) {
                    const feedbackKeys = ["leadership_q1", "leadership_q2", "leadership_q3", "communication_q1", "communication_q2", "communication_q3", "performance_q1", "performance_q2", "performance_q3"];
                    let totalAverageSum = 0;
                    
                    feedbackKeys.forEach(key => {
                        const sum = leaderEvaluations.reduce((acc, ev) => acc + (ev[key as keyof ManagerEvaluation] as number || 0), 0);
                        const avg = sum / leaderEvaluations.length;
                        rowData[`Prom. Feedback ${key} (%)`] = avg.toFixed(0);
                        totalAverageSum += sum;
                    });
    
                    const overallAvg = leaderEvaluations.length > 0 ? (totalAverageSum / (leaderEvaluations.length * feedbackKeys.length)) : 0;
                    rowData['Prom. General Feedback 180° (%)'] = overallAvg.toFixed(0);
                }
            }
    
            return rowData;
        });
    
        if (dataToExport.length === 0) {
            toast({ title: "No hay datos para exportar" });
            return;
        }
    
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'ResumenEvaluaciones');
        XLSX.writeFile(workbook, 'resumen_evaluaciones.xlsx');
    };

    const handleExportHistory = () => {
        if (selectedWorkers.length === 0) {
            toast({ title: "Seleccione empleados", description: "Debe seleccionar al menos un empleado para exportar el historial." });
            return;
        }

        const dataToExport: any[] = [];
        const ratingValues: Record<string, number> = { NT: 1, BA: 2, ED: 3, TI: 4 };

        selectedWorkers.forEach(workerId => {
            const worker = workersData?.find(w => w.id === workerId);
            if (!worker) return;

            const workerPerformanceEvals = (evaluationsByWorker.get(workerId) || []);
            const leader180Evals = worker.isLeader ? (managerEvaluationsData?.filter(me => me.managerId === worker.id) || []) : [];

            if (workerPerformanceEvals.length === 0 && leader180Evals.length === 0) {
                dataToExport.push({ 'Código': worker.codigo, 'Empleado': `${worker.apellidos} ${worker.nombres}`, 'Tipo de Registro': 'Sin Evaluaciones' });
                return;
            }

            // Add performance evaluations
            workerPerformanceEvals.forEach(evaluation => {
                const evaluator = workersData?.find(w => w.id === evaluation.evaluatorId);
                const toPct = (scoreKey: keyof PerformanceEvaluation) => {
                    const score = ratingValues[evaluation[scoreKey] as string] || 1;
                    return ((score - 1) / 3 * 100).toFixed(0);
                };
                const row: { [key: string]: any } = {
                    'Código': worker.codigo,
                    'Empleado': `${worker.apellidos} ${worker.nombres}`,
                    'Tipo de Registro': 'Evaluación de Desempeño',
                    'Fecha de Registro': displayDate(evaluation.evaluationDate),
                    'Evaluador': evaluator ? `${evaluator.nombres} ${evaluator.apellidos}` : 'N/A',
                    'Nota Final Desempeño (%)': evaluation.generalEvaluation,
                    'Comp: Conocimientos Técnicos (%)': toPct('conocimientosTecnicos'),
                    'Comp: Calidad del Trabajo (%)': toPct('calidadTrabajo'),
                    'Comp: Cumplimiento de Políticas (%)': toPct('cumplimientoPoliticas'),
                    'Comp: Proactividad (%)': toPct('proactividad'),
                    'Comp: Comunicación (%)': toPct('comunicacion'),
                    'Comp: Integridad y Ética (%)': toPct('integridad'),
                    'Comp: Adaptabilidad (%)': toPct('adaptabilidad'),
                    'Comp: Servicio al Cliente (%)': toPct('servicioCliente'),
                    'Comp: Compromiso con la Compañía (%)': toPct('compromisoCompania'),
                };
                
                const plan = evaluation.reinforcementPlan;
                if (plan) {
                    row['Plan: Requerido'] = plan.requiresReinforcement ? 'SÍ' : 'NO';
                    row['Plan: Tipo Habilidad'] = plan.skillType || 'N/A';
                    row['Plan: Habilidades'] = Array.isArray(plan.specificSkills) ? plan.specificSkills.join(', ') : (plan.specificSkills || 'N/A');
                    row['Plan: Modalidad'] = plan.reinforcementType || 'N/A';
                    row['Plan: Descripción'] = plan.reinforcementDescription || 'N/A';
                } else {
                    row['Plan: Requerido'] = 'N/A';
                    row['Plan: Tipo Habilidad'] = 'N/A';
                    row['Plan: Habilidades'] = 'N/A';
                    row['Plan: Modalidad'] = 'N/A';
                    row['Plan: Descripción'] = 'N/A';
                }

                dataToExport.push(row);
            });

            // Add 180 feedback evaluations
            leader180Evals.forEach(feedback => {
                const feedbackGiver = workersData?.find(w => w.id === feedback.employeeId);
                const feedbackScores = [feedback.leadership_q1, feedback.leadership_q2, feedback.leadership_q3, feedback.communication_q1, feedback.communication_q2, feedback.communication_q3, feedback.performance_q1, feedback.performance_q2, feedback.performance_q3];
                const validScores = feedbackScores.filter(s => typeof s === 'number');
                const avgFeedback = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
                
                const row: { [key: string]: any } = {
                    'Código': worker.codigo,
                    'Empleado': `${worker.apellidos} ${worker.nombres}`,
                    'Tipo de Registro': 'Feedback 180°',
                    'Fecha de Registro': displayDate(feedback.evaluationDate),
                    'Evaluado por (Empleado)': feedbackGiver ? `${feedbackGiver.nombres} ${feedbackGiver.apellidos}` : 'Anónimo',
                    'Promedio Feedback (%)': avgFeedback.toFixed(0),
                    'Feedback: Liderazgo Q1 (Comunica obj.) (%)': feedback.leadership_q1,
                    'Feedback: Liderazgo Q2 (Define pri.) (%)': feedback.leadership_q2,
                    'Feedback: Liderazgo Q3 (Toma dec.) (%)': feedback.leadership_q3,
                    'Feedback: Comunicación Q1 (Escucha) (%)': feedback.communication_q1,
                    'Feedback: Comunicación Q2 (Com. clara) (%)': feedback.communication_q2,
                    'Feedback: Comunicación Q3 (Disponible) (%)': feedback.communication_q3,
                    'Feedback: Desempeño Q1 (Da retroal.) (%)': feedback.performance_q1,
                    'Feedback: Desempeño Q2 (Reconoce) (%)': feedback.performance_q2,
                    'Feedback: Desempeño Q3 (Coherencia) (%)': feedback.performance_q3,
                    'Observaciones del Feedback': feedback.openFeedback || '',
                };
                dataToExport.push(row);
            });
        });
        
        if (dataToExport.length === 0) {
            toast({ title: "No hay datos para exportar" });
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'HistorialEvaluaciones');
        XLSX.writeFile(workbook, 'historial_evaluaciones_seleccion.xlsx');
    };
    
    const handleSelectAll = (tab: 'pending' | 'completed') => {
        const workersToSelect = tab === 'pending' ? filteredPending : filteredCompleted;
        const workerIdsToSelect = workersToSelect.map(w => w.id);
        const allOnPageSelected = workerIdsToSelect.length > 0 && workerIdsToSelect.every(id => selectedWorkers.includes(id));
        
        if (allOnPageSelected) {
            setSelectedWorkers(prev => prev.filter(id => !workerIdsToSelect.includes(id)));
        } else {
            setSelectedWorkers(prev => [...new Set([...prev, ...workerIdsToSelect])]);
        }
    };

    const handleSelectWorker = (workerId: string) => {
        setSelectedWorkers(prev => 
            prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
        );
    };
    
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        // This is a placeholder for the actual import logic
    };
    
    const confirmImport = async () => {
        // This is a placeholder for the actual import logic
    };

    const handleViewHistory = (worker: UserProfile) => {
        setSelectedWorker(worker);
        setIsHistorySheetOpen(true);
    };

    const displayAnnualDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        const date = parseDate(dateStr);
        if(!date) return 'N/A';
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long' }).format(date);
    }
    
    const isLoading = loading || evaluationsLoading || managerEvaluationsLoading;
    
    const WorkersTable = ({ workersList, isLoading, tableType }: { workersList: any[], isLoading: boolean, tableType: 'pending' | 'completed' }) => {
        const allOnPageSelected = workersList.length > 0 && workersList.every(w => selectedWorkers.includes(w.id));
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            <Checkbox 
                                checked={allOnPageSelected}
                                onCheckedChange={() => handleSelectAll(tableType)}
                                aria-label={`Seleccionar todo en ${tableType}`}
                            />
                        </TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Tipo Contrato</TableHead>
                        <TableHead>Evaluador / Observador</TableHead>
                        <TableHead>Última Evaluación</TableHead>
                        <TableHead>Última Nota</TableHead>
                        <TableHead>Fecha Anual</TableHead>
                        <TableHead>Estado de Evaluación</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={`skel-${i}`}>
                                <TableCell colSpan={9}><div className="h-8 bg-gray-200 rounded animate-pulse"></div></TableCell>
                            </TableRow>
                        ))
                    ) : workersList.length > 0 ? (
                        workersList.map(worker => {
                            const currentEvaluatorEmail = worker.evaluador || worker.liderArea;
                            const lastEvaluation = worker.lastEvaluation;
                            const statusInfo = worker.statusInfo;
    
                            return (
                                <TableRow key={worker.id} data-state={selectedWorkers.includes(worker.id) ? "selected" : ""}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedWorkers.includes(worker.id)}
                                            onCheckedChange={() => handleSelectWorker(worker.id)}
                                            aria-label={`Seleccionar a ${worker.nombres}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div>{worker.apellidos} {worker.nombres}</div>
                                        <div className="text-xs text-muted-foreground">{worker.cargo}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={worker.tipoContrato === 'INDEFINIDO' ? 'secondary' : 'outline'}>
                                            {worker.tipoContrato || 'N/A'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className='font-semibold'>E:</span>
                                            <span className="truncate max-w-[150px]">{getAssigneeName(currentEvaluatorEmail) || 'No asignado'}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenAssignDialog(worker, 'evaluador')}>
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className='font-semibold'>O:</span>
                                            <span className="truncate max-w-[150px]">{getAssigneeName(worker.observerEmail) || 'No asignado'}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenAssignDialog(worker, 'observerEmail')}>
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>{lastEvaluation ? displayDate(lastEvaluation.evaluationDate) : 'N/A'}</TableCell>
                                    <TableCell className="text-center font-bold">{lastEvaluation ? `${lastEvaluation.generalEvaluation}%` : 'N/A'}</TableCell>
                                    <TableCell>
                                        <Button variant="link" className="p-0 h-auto text-left" onClick={() => handleOpenDateDialog(worker)}>
                                            {displayAnnualDate(worker.fechaEvaluacionAnual) || 'Asignar'}
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <EvaluationStatusBadge status={statusInfo.status} message={statusInfo.message} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-1 justify-end">
                                            <Button variant="outline" size="sm" onClick={() => handleViewHistory(worker)}>
                                                <History className="mr-2 h-4 w-4" />
                                                Historial
                                            </Button>
                                            <Button variant="outline" size="sm" disabled={statusInfo.isCompleted} onClick={() => router.push(`/dashboard/performance-evaluation?workerId=${worker.id}`)}>
                                                <Activity className="mr-2 h-4 w-4" />
                                                Evaluar
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">
                                No se encontraron empleados para esta vista.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        )
    };


    return (
        <div className="space-y-6">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
                onChange={handleFileChange}
            />
            <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Actualización</AlertDialogTitle>
                        <AlertDialogDescription>
                            {/*Se encontraron {dataToImport.length} registros para actualizar. Se actualizarán los campos de evaluador y/u observador. ¿Deseas continuar?*/}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmImport}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <EvaluationHistorySheet 
                open={isHistorySheetOpen}
                onOpenChange={setIsHistorySheetOpen}
                worker={selectedWorker}
                allEvaluations={evaluationsData || []}
                allWorkers={workersData || []}
            />
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Asignar {assignmentData?.field === 'evaluador' ? 'Evaluador' : 'Observador'}</DialogTitle>
                        <DialogDescription>
                            Selecciona un nuevo {assignmentData?.field === 'evaluador' ? 'evaluador' : 'observador'} para {assignmentData?.worker.nombres} {assignmentData?.worker.apellidos}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Combobox
                            options={userOptions}
                            value={selectedNewAssignee}
                            onChange={setSelectedNewAssignee}
                            placeholder={`Seleccionar ${assignmentData?.field === 'evaluador' ? 'evaluador' : 'observador'}...`}
                            searchPlaceholder='Buscar por nombre o cargo...'
                            notFoundMessage='No se encontró usuario.'
                            allowClear={true}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAssignDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleConfirmAssignment}>Guardar Asignación</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Asignar Fecha de Evaluación Anual</DialogTitle>
                        <DialogDescription>
                            Selecciona una fecha que se repetirá anualmente para {dateAssignmentWorker?.nombres} {dateAssignmentWorker?.apellidos}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 flex justify-center">
                        <Calendar
                            mode="single"
                            selected={selectedAnnualDate}
                            onSelect={setSelectedAnnualDate}
                            locale={es}
                            initialFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDateDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleConfirmDateAssignment}>Guardar Fecha</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isGeneralDateDialogOpen} onOpenChange={setIsGeneralDateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Asignar Fecha de Evaluación General</DialogTitle>
                        <DialogDescription>
                            Selecciona una fecha que se asignará como el día de evaluación anual para todos los empleados activos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 flex justify-center">
                        <Calendar
                            mode="single"
                            selected={selectedGeneralDate}
                            onSelect={setSelectedGeneralDate}
                            locale={es}
                            initialFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsGeneralDateDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => setIsConfirmGeneralDateAlertOpen(true)} disabled={!selectedGeneralDate}>Guardar Fecha General</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isConfirmGeneralDateAlertOpen} onOpenChange={setIsConfirmGeneralDateAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción asignará la fecha {selectedGeneralDate ? format(selectedGeneralDate, 'dd MMMM', {locale: es}) : ''} como la fecha de evaluación anual para todos los empleados activos. Las fechas personalizadas existentes serán sobrescritas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmGeneralDateAssignment}>Confirmar y Asignar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <h1 className="text-lg font-semibold md:text-2xl">Evaluación de Desempeño</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Lista de Empleados</CardTitle>
                    <CardDescription>
                        Gestiona y monitorea las evaluaciones de desempeño de los empleados.
                    </CardDescription>
                    <div className="flex items-center pt-4 justify-between">
                        <div className='relative w-full max-w-sm'>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, apellido o cédula..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={handleExportSummary}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Exportar Resumen
                             </Button>
                             <Button variant="outline" onClick={handleExportHistory} disabled={selectedWorkers.length === 0}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Exportar Historial ({selectedWorkers.length})
                             </Button>
                             <Button variant="outline" onClick={() => setIsGeneralDateDialogOpen(true)}>
                                <CalendarDays className="mr-2 h-4 w-4" />
                                Asignar Fecha General
                             </Button>
                            <Button variant="outline" onClick={handleImportClick}>
                                <FileUp className="h-4 w-4 mr-2" />
                                Importar/Actualizar Roles
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="pending">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="pending">Pendientes ({workersWithStatus.pending.length})</TabsTrigger>
                            <TabsTrigger value="completed">Completadas ({workersWithStatus.completed.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending" className="mt-4">
                             <WorkersTable workersList={filteredPending} isLoading={isLoading} tableType="pending" />
                        </TabsContent>
                        <TabsContent value="completed" className="mt-4">
                            <WorkersTable workersList={filteredCompleted} isLoading={isLoading} tableType="completed" />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

function PerformanceEvaluationPageContent() {
    const searchParams = useSearchParams();
    const workerId = searchParams.get('workerId');
    const reviewEvaluationId = searchParams.get('reviewEvaluationId');
  
    if (workerId) {
      return <EvaluationForm workerId={workerId} reviewEvaluationId={reviewEvaluationId} />;
    }
  
    return <EvaluationList />;
}

export default function PerformanceEvaluationPage() {
    return (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>}>
            <PerformanceEvaluationPageContent />
        </Suspense>
    )
}
