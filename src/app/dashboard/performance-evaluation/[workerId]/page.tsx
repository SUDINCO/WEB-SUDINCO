

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { EvaluationCriteriaGroup } from '@/components/evaluation-criteria-group';
import { ArrowLeft, Save, LoaderCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, addDoc, updateDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';

type UserProfile = {
  id: string;
  codigo: string;
  cedula: string;
  apellidos: string;
  nombres: string;
  fechaIngreso: string;
  email: string;
  empresa: string;
  ubicacion?: string;
  departamento: string;
  cargo: string;
  liderArea?: string;
  evaluador?: string;
  rol?: string;
  isLeader?: boolean;
  Status: 'active' | 'inactive';
  observerEmail?: string;
};

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


export default function PerformanceEvaluationFormPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { workerId } = params;
    const reviewEvaluationId = searchParams.get('reviewEvaluationId');

    const firestore = useFirestore();
    const { user: authUser } = useUser();
    
    const workerDocRef = useMemo(() => {
        if (!firestore || typeof workerId !== 'string') return null;
        return doc(firestore, 'users', workerId);
    }, [firestore, workerId]);
    const { data: worker, isLoading: workerLoading } = useDoc<UserProfile>(workerDocRef);

    const { data: allUsers, isLoading: usersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));

    const evaluator = useMemo(() => {
        if (!allUsers || !worker) return null;
        const evaluatorEmail = worker.evaluador || worker.liderArea || authUser?.email;
        if (!evaluatorEmail) return null;
        return allUsers.find(u => u.email === evaluatorEmail) || null;
    }, [allUsers, worker, authUser]);
    
    const evaluationToReviewRef = useMemo(() => {
        if (!firestore || !reviewEvaluationId) return null;
        return doc(firestore, 'performanceEvaluations', reviewEvaluationId);
    }, [firestore, reviewEvaluationId]);
    const { data: evaluationToReview, isLoading: isReviewLoading } = useDoc(evaluationToReviewRef);

    const form = useForm<z.infer<typeof evaluationSchema>>({
        resolver: zodResolver(evaluationSchema),
        defaultValues: {
            conocimientosTecnicos: "NT",
            conocimientosTecnicosJustification: "",
            calidadTrabajo: "NT",
            calidadTrabajoJustification: "",
            cumplimientoPoliticas: "NT",
            cumplimientoPoliticasJustification: "",
            proactividad: "NT",
            proactividadJustification: "",
            comunicacion: "NT",
            comunicacionJustification: "",
            integridad: "NT",
            integridadJustification: "",
            adaptabilidad: "NT",
            adaptabilidadJustification: "",
            servicioCliente: "NT",
            servicioClienteJustification: "",
            compromisoCompania: "NT",
            compromisoCompaniaJustification: "",
            observations: "",
            messageForWorker: "",
            observerId: "",
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
                    where('workerId', '==', worker.id)
                );
                const querySnapshot = await getDocs(evalsQuery);
                if (!querySnapshot.empty) {
                    const allEvals = querySnapshot.docs.map(doc => doc.data());
                    // Sort client-side to find the latest
                    allEvals.sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime());
                    const lastEval = allEvals[0];
                    form.reset(lastEval);
                }
            };
            fetchLastEvaluation();
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
                                                        <MultiSelectCombobox options={currentSkillOptions} selected={field.value || []} onChange={field.onChange} placeholder="Seleccionar habilidades..." searchPlaceholder="Buscar o crear habilidad..." />
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
