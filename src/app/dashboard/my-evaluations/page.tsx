

"use client";

import React, { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, AlertTriangle, CheckCircle, Clock, LoaderCircle, Download, History, MessageSquareWarning, Edit, Trash2, Users } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateEvaluationPDF } from '@/lib/pdf-generator';
import { PersonDTO } from '@/lib/contracts';
import { toast } from '@/hooks/use-toast';
import { addDays, set, differenceInDays, isSameDay, subDays, addYears, isBefore, isWithinInterval } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { UserProfile, PerformanceEvaluation } from '@/lib/types';


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


const singleWorkerMassEvaluationSchema = z.object({
    workerId: z.string(),
    workerName: z.string(),
    workerCargo: z.string().optional(),
    workerUbicacion: z.string().optional(),
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
    observations: z.string().optional(),
    messageForWorker: z.string().optional(),
    reinforcementPlan: z.object({
        requiresReinforcement: z.boolean().default(false),
        skillType: z.enum(['tecnica', 'blanda']).optional(),
        specificSkills: z.array(z.string()).optional(),
        reinforcementType: z.string().optional(),
        reinforcementDescription: z.string().optional(),
    }).optional(),
}).refine(data => !['NT', 'BA'].includes(data.conocimientosTecnicos) || (data.conocimientosTecnicosJustification && data.conocimientosTecnicosJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['conocimientosTecnicosJustification'],
}).refine(data => !['NT', 'BA'].includes(data.calidadTrabajo) || (data.calidadTrabajoJustification && data.calidadTrabajoJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['calidadTrabajoJustification'],
}).refine(data => !['NT', 'BA'].includes(data.cumplimientoPoliticas) || (data.cumplimientoPoliticasJustification && data.cumplimientoPoliticasJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['cumplimientoPoliticasJustification'],
}).refine(data => !['NT', 'BA'].includes(data.proactividad) || (data.proactividadJustification && data.proactividadJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['proactividadJustification'],
}).refine(data => !['NT', 'BA'].includes(data.comunicacion) || (data.comunicacionJustification && data.comunicacionJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['comunicacionJustification'],
}).refine(data => !['NT', 'BA'].includes(data.integridad) || (data.integridadJustification && data.integridadJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['integridadJustification'],
}).refine(data => !['NT', 'BA'].includes(data.adaptabilidad) || (data.adaptabilidadJustification && data.adaptabilidadJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['adaptabilidadJustification'],
}).refine(data => !['NT', 'BA'].includes(data.servicioCliente) || (data.servicioClienteJustification && data.servicioClienteJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['servicioClienteJustification'],
}).refine(data => !['NT', 'BA'].includes(data.compromisoCompania) || (data.compromisoCompaniaJustification && data.compromisoCompaniaJustification.trim() !== ''), {
    message: 'Justificación obligatoria.', path: ['compromisoCompaniaJustification'],
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


const massEvaluationSchema = z.object({
  evaluations: z.array(singleWorkerMassEvaluationSchema),
});


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
    const isPendingObserver = (ev: PerformanceEvaluation) => !!worker.observerEmail && ev.observerStatus === 'pending';
    
    const daysSinceHire = differenceInDays(today, hireDate);

    // --- LOGIC FOR EMPLOYEES WITH MORE THAN 1 YEAR ---
    if (daysSinceHire > 365) {
        const referenceDate = fechaEvaluacionAnual ? parseDate(fechaEvaluacionAnual) : hireDate;
        if (!referenceDate) return { status: 'invalido', message: 'Fecha ref. inválida', days: NaN, isCompleted: false };

        let nextDueDate = set(new Date(), { 
            month: referenceDate.getUTCMonth(), 
            date: referenceDate.getUTCDate(), 
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
        if (cycleEvaluations.some(isPendingObserver)) {
             return { status: 'pending_observation', message: 'Pendiente de Observador', isCompleted: false, days: Infinity };
        }

        const daysDifference = differenceInDays(today, cycleEndDate);
        
        if (daysDifference > 0) {
            return { status: 'atrasado', message: `Evaluación Anual: ${daysDifference} días de retraso`, days: -daysDifference, isCompleted: false };
        }
        
        const daysLeft = Math.abs(daysDifference);
        
        if (daysLeft <= 30) {
            return { status: 'alerta', message: `Evaluación Anual: ${daysLeft} días restantes`, days: daysLeft, isCompleted: false };
        }
        
        return { status: 'pendiente', message: `Evaluación Anual en ${daysLeft} días`, days: daysLeft, isCompleted: false };
    }

    // --- LOGIC FOR NEW EMPLOYEES (first year) ---
    const checkPeriod = (startDays: number, endDays: number, periodName: string) => {
        const periodEvaluations = evaluations.filter(ev => {
            const evalDate = parseDate(ev.evaluationDate);
            if (!evalDate) return false;
            const daysDiff = differenceInDays(hireDate, evalDate);
            return daysDiff >= startDays && daysDiff < endDays;
        });

        if (periodEvaluations.some(isFinalized)) return { status: 'completado', isPeriodDone: true };
        if (periodEvaluations.some(isPendingObserver)) return { status: 'pending_observation', message: 'Pendiente de Observador', isCompleted: false, days: Infinity };

        if (daysSinceHire >= startDays) {
            const daysLeft = endDays - daysSinceHire;
            if (daysLeft < 0) {
                return { status: 'atrasado', message: `${periodName}: ${Math.abs(daysLeft)} días de retraso`, days: daysLeft, isCompleted: false };
            }
            const alertDays = (endDays - startDays) > 90 ? 45 : 20; // 45 for annual, 20 for 90-day
            if (daysLeft <= alertDays) {
                return { status: 'alerta', message: `${periodName}: ${daysLeft} días restantes`, days: daysLeft, isCompleted: false };
            }
            return { status: 'pendiente', message: `${periodName} en ${daysLeft} días`, days: daysLeft, isCompleted: false };
        }
        return null; // This period is not yet active
    };
    
    // Check 90-day period
    const firstPeriod = checkPeriod(0, 90, '1ª Evaluación (90 días)');
    if (!firstPeriod || firstPeriod.status !== 'completado') {
        return firstPeriod || { status: 'invalido', message: 'Error Lógico', days: NaN, isCompleted: false }; // Should not happen
    }

    // Check annual period for the first year
    const secondPeriod = checkPeriod(90, 365, '2ª Evaluación (Anual)');
    if (!secondPeriod || secondPeriod.status !== 'completado') {
         return secondPeriod || { status: 'invalido', message: 'Error Lógico', days: NaN, isCompleted: false };
    }

    return { status: 'completado', message: 'Ciclo Inicial Completo', days: Infinity, isCompleted: true };
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
            .sort((a, b) => {
                const dateA = parseDate(a.evaluationDate);
                const dateB = parseDate(b.evaluationDate);
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB.getTime() - dateA.getTime();
            });
    }, [worker, allEvaluations]);

    const getEvaluatorName = (evaluatorId: string) => {
        const evaluator = allWorkers.find(w => w.id === evaluatorId);
        return evaluator ? `${evaluator.nombres} ${evaluator.apellidos}` : 'Desconocido';
    };
    
     const handleDownloadPdf = (evaluation: PerformanceEvaluation) => {
        if (!worker) return;
        const evaluator = allWorkers?.find(w => w.id === evaluation.evaluatorId);
        if (!evaluator) {
             toast({
                variant: "destructive",
                title: "Error al generar PDF",
                description: "No se pudo encontrar la información del evaluador.",
            });
            return; 
        }

        const workerDTO: PersonDTO = { // Now uses the correct type
            cedula: worker.cedula,
            nombreCompleto: `${worker.apellidos} ${worker.nombres}`,
            fechaIngreso: worker.fechaIngreso,
            empresa: worker.empresa,
            cargo: worker.cargo,
            ubicacion: worker.ubicacion || 'N/A',
            departamento: worker.departamento,
        };

        const evaluatorDTO: PersonDTO = { // Now uses the correct type
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

const evaluationCriteria = [
    { name: "conocimientosTecnicos", title: "Conocimientos Técnicos" },
    { name: "calidadTrabajo", title: "Calidad del trabajo" },
    { name: "cumplimientoPoliticas", title: "Cumplimiento de Políticas" },
    { name: "proactividad", title: "Proactividad" },
    { name: "comunicacion", title: "Comunicación" },
    { name: "integridad", title: "Integridad y Ética" },
    { name: "adaptabilidad", title: "Adaptabilidad" },
    { name: "servicioCliente", title: "Servicio al Cliente" },
    { name: "compromisoCompania", title: "Compromiso con la Compañía" },
] as const;

const ratingValues: Record<string, number> = { NT: 1, BA: 2, ED: 3, TI: 4 };

type JustificationState = {
  index: number;
  criterionName: (typeof evaluationCriteria)[number]['name'];
  criterionTitle: string;
  rating: 'NT' | 'BA';
} | null;


export default function MyEvaluationsPage() {
    const router = useRouter();
    const { user: authUser, loading: authLoading } = useUser();
    const firestore = useFirestore();
    
    const [selectedWorker, setSelectedWorker] = useState<UserProfile | null>(null);
    const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);
    
    const [isGroupDialogOpen, setGroupDialogOpen] = useState(false);
    const [isMassEvalOpen, setIsMassEvalOpen] = useState(false);
    const [groupEvalSelection, setGroupEvalSelection] = useState<string[]>([]);
    const [groupEvalFilters, setGroupEvalFilters] = useState({ name: '', cargo: 'todos', ubicacion: 'todos' });

    const [justificationState, setJustificationState] = useState<JustificationState>(null);
    const justificationTextRef = useRef<HTMLTextAreaElement>(null);

    const usersCollectionRef = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const evaluationsCollectionRef = useMemo(() => firestore ? collection(firestore, 'performanceEvaluations') : null, [firestore]);
    
    const { data: allWorkers, isLoading: workersLoading } = useCollection<UserProfile>(usersCollectionRef);
    const { data: allEvaluations, isLoading: evaluationsLoading } = useCollection<PerformanceEvaluation>(evaluationsCollectionRef);
    
    const massEvalForm = useForm<z.infer<typeof massEvaluationSchema>>({
        resolver: zodResolver(massEvaluationSchema),
        defaultValues: {
            evaluations: [],
        },
    });

    const { control: massEvalControl, reset: massEvalReset, watch: massEvalWatch, getValues: getMassValues, setValue: setMassValue, handleSubmit: handleMassSubmit, formState: { isSubmitting: isMassSubmitting } } = massEvalForm;
    const { fields } = useFieldArray({ control: massEvalControl, name: "evaluations" });
    const watchedMassEval = massEvalWatch();

    const reviewsRequested = useMemo(() => {
        if (!allEvaluations || !authUser || !allWorkers) return [];
        
        return allEvaluations
            .filter(ev => ev.observerStatus === 'review_requested' && ev.evaluatorId === authUser.uid)
            .map(ev => {
                const worker = allWorkers.find(w => w.id === ev.workerId);
                return {
                    ...ev,
                    workerName: worker ? `${worker.nombres} ${worker.apellidos}` : 'Desconocido',
                    workerCodigo: worker?.codigo,
                }
            })
            .sort((a,b) => {
                const dateA = parseDate(a.evaluationDate);
                const dateB = parseDate(b.evaluationDate);
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB.getTime() - dateA.getTime();
            });

    }, [allEvaluations, allWorkers, authUser]);

    const workersWithStatus = useMemo(() => {
        if (!allWorkers || !authUser || !allEvaluations) return { pending: [], completed: [] };

        const workersToEvaluate = allWorkers.filter(worker => 
            worker.Status === 'active' && 
            (worker.evaluador === authUser.email || (!worker.evaluador && worker.liderArea === authUser.email))
        );

        const pending: any[] = [];
        const completed: any[] = [];

        workersToEvaluate.forEach(worker => {
            const workerEvaluations = allEvaluations.filter(ev => ev.workerId === worker.id);
            const statusInfo = getEvaluationStatus(worker, workerEvaluations);
            
            const lastEvaluation = [...workerEvaluations].sort((a, b) => {
                const dateA = parseDate(a.evaluationDate);
                const dateB = parseDate(b.evaluationDate);
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB.getTime() - dateA.getTime();
            })[0];
            
            if (statusInfo.isCompleted) {
                completed.push({ ...worker, statusInfo, lastEvaluation, evaluationCount: workerEvaluations.length });
            } else {
                pending.push({ ...worker, statusInfo, lastEvaluation, evaluationCount: workerEvaluations.length });
            }
        });

        pending.sort((a, b) => a.statusInfo.days - b.statusInfo.days);
        
        completed.sort((a, b) => {
            const dateA = a.lastEvaluation ? parseDate(a.lastEvaluation.evaluationDate) : null;
            const dateB = b.lastEvaluation ? parseDate(b.lastEvaluation.evaluationDate) : null;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB.getTime() - dateA.getTime();
        });


        return { pending, completed };

    }, [allWorkers, authUser, allEvaluations]);

    const isLoading = authLoading || workersLoading || evaluationsLoading;
    
    const uniqueCargos = useMemo(() => {
        if (!allWorkers) return [];
        return ['todos', ...Array.from(new Set(allWorkers.map(w => w.cargo).filter(Boolean)))];
    }, [allWorkers]);

    const uniqueUbicaciones = useMemo(() => {
        if (!allWorkers) return [];
        const ubicacionesSet = new Set<string>();
        allWorkers.forEach(w => {
            if (w.ubicacion) {
                ubicacionesSet.add(w.ubicacion);
            }
        });
        return ['todos', ...Array.from(ubicacionesSet)];
    }, [allWorkers]);
        
    const pendingWorkersForGroupEval = useMemo(() => {
        let workers = workersWithStatus.pending;
        if (groupEvalFilters.name) {
            workers = workers.filter(w => 
                `${w.nombres} ${w.apellidos}`.toLowerCase().includes(groupEvalFilters.name.toLowerCase())
            );
        }
        if (groupEvalFilters.cargo !== 'todos') {
            workers = workers.filter(w => w.cargo === groupEvalFilters.cargo);
        }
        if (groupEvalFilters.ubicacion !== 'todos') {
            workers = workers.filter(w => (w.ubicacion) === groupEvalFilters.ubicacion);
        }
        return workers;
    }, [workersWithStatus.pending, groupEvalFilters]);

    const handleProceedToMassEval = () => {
        if (groupEvalSelection.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debe seleccionar al menos un empleado.' });
            return;
        }

        const evaluationsForForm = groupEvalSelection.map(workerId => {
            const worker = allWorkers?.find(w => w.id === workerId);
            return {
                workerId: workerId,
                workerName: worker ? `${worker.nombres} ${worker.apellidos}` : 'Desconocido',
                workerCargo: worker?.cargo,
                workerUbicacion: worker?.ubicacion,
                conocimientosTecnicos: "",
                conocimientosTecnicosJustification: "",
                calidadTrabajo: "",
                calidadTrabajoJustification: "",
                cumplimientoPoliticas: "",
                cumplimientoPoliticasJustification: "",
                proactividad: "",
                proactividadJustification: "",
                comunicacion: "",
                comunicacionJustification: "",
                integridad: "",
                integridadJustification: "",
                adaptabilidad: "",
                adaptabilidadJustification: "",
                servicioCliente: "",
                servicioClienteJustification: "",
                compromisoCompania: "",
                compromisoCompaniaJustification: "",
                observations: "",
                messageForWorker: "",
                reinforcementPlan: {
                    requiresReinforcement: false,
                    skillType: undefined,
                    specificSkills: [],
                    reinforcementType: '',
                    reinforcementDescription: ''
                }
            };
        });
        
        massEvalReset({ evaluations: evaluationsForForm });
        setGroupDialogOpen(false);
        setIsMassEvalOpen(true);
    };

    const handleCellClick = (index: number, criterion: (typeof evaluationCriteria)[number], rating: string) => {
        const fieldName = `evaluations.${index}.${criterion.name}` as const;
        const justificationFieldName = `evaluations.${index}.${criterion.name}Justification` as const;

        if (rating === 'NT' || rating === 'BA') {
            setJustificationState({ index, criterionName: criterion.name, criterionTitle: criterion.title, rating: rating as 'NT' | 'BA' });
        } else {
            setMassValue(fieldName, rating);
            setMassValue(justificationFieldName, '');
        }
    }

    const handleSaveJustification = () => {
        if (!justificationState || !justificationTextRef.current) return;
        const { index, criterionName, rating } = justificationState;
        const justification = justificationTextRef.current.value;

        if (!justification.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'La justificación es obligatoria para esta calificación.' });
            return;
        }

        const fieldName = `evaluations.${index}.${criterionName}` as const;
        const justificationFieldName = `evaluations.${index}.${criterionName}Justification` as const;
        
        setMassValue(fieldName, rating);
        setMassValue(justificationFieldName, justification);
        setJustificationState(null);
    }

    const onMassSubmit = async (data: z.infer<typeof massEvaluationSchema>) => {
        if (!firestore || !authUser || !allWorkers) return;
        
        const batch = writeBatch(firestore);
        const evaluationsCollectionRef = collection(firestore, 'performanceEvaluations');
        
        data.evaluations.forEach(evaluation => {
            const worker = allWorkers.find(w => w.id === evaluation.workerId);
            if(worker) {
                const scores = evaluationCriteria.map(c => ratingValues[evaluation[c.name]]).filter(Boolean);
                const totalScore = scores.reduce((acc, score) => acc + score, 0);
                const maxScore = scores.length * 4;
                const generalEvaluation = Math.round((totalScore / maxScore) * 100);

                const observer = allWorkers.find(u => u.email === worker.observerEmail);
                const hasObserver = !!worker.observerEmail;
                
                const evaluationData: any = {
                    ...evaluation,
                    evaluatorId: authUser.uid,
                    evaluationDate: new Date().toISOString().split('T')[0],
                    generalEvaluation,
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

                delete evaluationData.workerName;
                delete evaluationData.workerCargo;
                delete evaluationData.workerUbicacion;

                const newEvalDoc = doc(evaluationsCollectionRef);
                batch.set(newEvalDoc, evaluationData);
            }
        });
        
        try {
            await batch.commit();
            toast({ title: 'Evaluaciones Terminadas', description: `${data.evaluations.length} evaluaciones han sido guardadas.` });
            setIsMassEvalOpen(false);
            setGroupEvalSelection([]);
            setGroupEvalFilters({ name: '', cargo: 'todos', ubicacion: 'todos' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar las evaluaciones grupales.' });
        }
    };


    const handleViewHistory = (worker: UserProfile) => {
        setSelectedWorker(worker);
        setIsHistorySheetOpen(true);
    };

    const displayDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const date = parseDate(dateStr);
        if(!date) return 'N/A';
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    }
    
    const grades = [
        { abbrevia: 'NT', criterio: 'NO TIENE', color: 'bg-red-500' },
        { abbrevia: 'BA', criterio: 'BAJO', color: 'bg-yellow-400' },
        { abbrevia: 'ED', criterio: 'EN DESARROLLO', color: 'bg-green-500' },
        { abbrevia: 'TI', criterio: 'TIENE', color: 'bg-teal-500' },
    ];

    return (
        <>
            <EvaluationHistorySheet 
                open={isHistorySheetOpen}
                onOpenChange={setIsHistorySheetOpen}
                worker={selectedWorker}
                allEvaluations={allEvaluations || []}
                allWorkers={allWorkers || []}
            />
            
            <Dialog open={isGroupDialogOpen} onOpenChange={setGroupDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Selección para Evaluación Grupal</DialogTitle>
                        <DialogDescription>
                            Filtra y selecciona los empleados que deseas evaluar en conjunto.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
                        <Input 
                            placeholder="Buscar por nombre..."
                            value={groupEvalFilters.name}
                            onChange={(e) => setGroupEvalFilters(prev => ({...prev, name: e.target.value}))}
                        />
                        <Select value={groupEvalFilters.cargo} onValueChange={(value) => setGroupEvalFilters(prev => ({...prev, cargo: value}))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                {uniqueCargos.map(cargo => <SelectItem key={cargo} value={cargo}>{cargo === 'todos' ? 'Todos los cargos' : cargo}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={groupEvalFilters.ubicacion} onValueChange={(value) => setGroupEvalFilters(prev => ({...prev, ubicacion: value}))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                {uniqueUbicaciones.map(ubicacion => <SelectItem key={ubicacion} value={ubicacion}>{ubicacion === 'todos' ? 'Todas las ubicaciones' : ubicacion}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox onCheckedChange={(checked) => {
                                        if (checked) {
                                            setGroupEvalSelection(pendingWorkersForGroupEval.map(w => w.id));
                                        } else {
                                            setGroupEvalSelection([]);
                                        }
                                    }}
                                    checked={pendingWorkersForGroupEval.length > 0 && groupEvalSelection.length === pendingWorkersForGroupEval.length}
                                    /></TableHead>
                                    <TableHead>Empleado</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Ubicación</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingWorkersForGroupEval.map(worker => (
                                    <TableRow key={worker.id}>
                                        <TableCell><Checkbox checked={groupEvalSelection.includes(worker.id)} onCheckedChange={() => {
                                            setGroupEvalSelection(prev => 
                                                prev.includes(worker.id) ? prev.filter(id => id !== worker.id) : [...prev, worker.id]
                                            );
                                        }} /></TableCell>
                                        <TableCell>{worker.nombres} {worker.apellidos}</TableCell>
                                        <TableCell>{worker.cargo}</TableCell>
                                        <TableCell>{worker.ubicacion || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleProceedToMassEval} disabled={groupEvalSelection.length === 0}>
                            Evaluar ({groupEvalSelection.length}) Seleccionados
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isMassEvalOpen} onOpenChange={setIsMassEvalOpen}>
                <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col">
                     <DialogHeader>
                        <DialogTitle>Evaluación Masiva</DialogTitle>
                        <DialogDescription>
                           Califica individualmente a los {fields.length} empleados seleccionados.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="border rounded-lg text-sm my-2 p-2">
                        <div className="flex items-center justify-center gap-x-6 gap-y-1 flex-wrap">
                            <span className="font-bold text-xs mr-4">GRADOS:</span>
                            {grades.map(grade => (
                                <div key={grade.abbrevia} className="flex items-center gap-1.5">
                                    <span className={cn("font-bold text-white text-center px-1.5 py-0.5 rounded-sm", grade.color)}>{grade.abbrevia}</span>
                                    <span className="text-xs font-medium">{grade.criterio}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Form {...massEvalForm}>
                        <form onSubmit={handleMassSubmit(onMassSubmit)} className="flex-grow flex flex-col min-h-0">
                            <div className="overflow-auto flex-grow border rounded-lg">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead rowSpan={2} className="sticky left-0 bg-background z-20 min-w-[250px] align-bottom border-r p-2">Empleado</TableHead>
                                            {evaluationCriteria.map(criterion => (
                                                <TableHead colSpan={4} key={criterion.name} className="text-center p-2 border-l border-r-4 border-slate-300">{criterion.title}</TableHead>
                                            ))}
                                            <TableHead rowSpan={2} className="min-w-[250px] align-bottom border-l p-2">Observaciones</TableHead>
                                            <TableHead rowSpan={2} className="min-w-[250px] align-bottom border-l p-2">Mensaje para Colaborador</TableHead>
                                            <TableHead rowSpan={2} className="min-w-[300px] align-bottom border-l p-2">Plan de Capacitación</TableHead>
                                            <TableHead rowSpan={2} className="min-w-[100px] align-bottom text-center border-l p-2">Nota General</TableHead>
                                        </TableRow>
                                        <TableRow>
                                            {evaluationCriteria.flatMap(c => (
                                                ['NT', 'BA', 'ED', 'TI'].map((rating, ratingIndex) => (
                                                    <TableHead key={`${c.name}-${rating}`} className={cn(`text-center p-1 text-white text-xs w-12 border-l`, {
                                                        'bg-red-500': rating === 'NT',
                                                        'bg-yellow-400': rating === 'BA',
                                                        'bg-green-500': rating === 'ED',
                                                        'bg-teal-500': rating === 'TI',
                                                        'border-r-4 border-slate-300': ratingIndex === 3,
                                                    })}>{rating}</TableHead>
                                                ))
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((item, index) => {
                                             const watchedRow = watchedMassEval.evaluations?.[index];
                                             const notaGeneral = (() => {
                                                 if (!watchedRow) return 0;
                                                 const scores = evaluationCriteria
                                                     .map(c => ratingValues[watchedRow[c.name as keyof typeof watchedRow] as string])
                                                     .filter(Boolean);
                                                 if (scores.length === 0) return 0;
                                                 const totalScore = scores.reduce((acc, score) => acc + score, 0);
                                                 const maxScore = scores.length * 4;
                                                 return Math.round((totalScore / maxScore) * 100);
                                             })();
                                             const currentSkillOptions = watchedRow?.reinforcementPlan?.skillType === 'tecnica' ? [] : softSkillsOptions;

                                            return (
                                            <TableRow key={item.id} className="hover:bg-muted/10">
                                                <TableCell className="font-medium sticky left-0 bg-background z-20 border-r p-2 align-top">
                                                  <div className='font-semibold'>{item.workerName}</div>
                                                  <div className="text-xs text-muted-foreground">{item.workerCargo}</div>
                                                  <div className="text-xs text-muted-foreground">{item.workerUbicacion}</div>
                                                </TableCell>
                                                {evaluationCriteria.flatMap(criterion => {
                                                    const currentVal = watchedRow?.[criterion.name];
                                                    const justi = watchedRow?.[`${criterion.name}Justification`];
                                                    return ['NT', 'BA', 'ED', 'TI'].map((rating, ratingIndex) => {
                                                        const isSelected = currentVal === rating;
                                                        const requiresJusti = (rating === 'NT' || rating === 'BA') && isSelected && !justi;
                                                        return (
                                                            <TableCell
                                                                key={`${criterion.name}-${rating}`}
                                                                className={cn("text-center p-0 cursor-pointer border-l hover:bg-blue-50 align-top", isSelected && 'bg-blue-100', {
                                                                    'border-r-4 border-slate-300': ratingIndex === 3
                                                                })}
                                                                onClick={() => handleCellClick(index, criterion, rating)}
                                                            >
                                                                <div className={cn('w-full h-full flex items-center justify-center min-h-[100px]', requiresJusti ? 'bg-red-200' : '')}>
                                                                    {isSelected ? 'X' : ''}
                                                                </div>
                                                            </TableCell>
                                                        )
                                                    })
                                                })}
                                                <TableCell className="border-l align-top p-2">
                                                    <FormField
                                                        control={massEvalControl}
                                                        name={`evaluations.${index}.observations`}
                                                        render={({ field }) => (
                                                            <Textarea {...field} placeholder="Observaciones de uso interno..." className="min-w-[240px]"/>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="border-l align-top p-2">
                                                    <FormField
                                                        control={massEvalControl}
                                                        name={`evaluations.${index}.messageForWorker`}
                                                        render={({ field }) => (
                                                            <Textarea {...field} placeholder="Mensaje visible para el colaborador..." className="min-w-[240px]"/>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="border-l min-w-[300px] align-top p-2 space-y-4">
                                                    <FormField
                                                        control={massEvalControl}
                                                        name={`evaluations.${index}.reinforcementPlan.requiresReinforcement`}
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center gap-2">
                                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                <FormLabel className="text-sm">Requiere Plan de Capacitación</FormLabel>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    {watchedRow?.reinforcementPlan?.requiresReinforcement && (
                                                        <div className="space-y-4 pt-2">
                                                            <FormField
                                                                control={massEvalControl}
                                                                name={`evaluations.${index}.reinforcementPlan.skillType`}
                                                                render={({ field }) => (
                                                                    <FormItem className="space-y-2">
                                                                        <FormLabel className="text-xs font-semibold">Tipo Habilidad</FormLabel>
                                                                        <FormControl>
                                                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                                                    <FormControl><RadioGroupItem value="tecnica" /></FormControl>
                                                                                    <FormLabel className="font-normal text-xs">Técnica</FormLabel>
                                                                                </FormItem>
                                                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                                                    <FormControl><RadioGroupItem value="blanda" /></FormControl>
                                                                                    <FormLabel className="font-normal text-xs">Blanda</FormLabel>
                                                                                </FormItem>
                                                                            </RadioGroup>
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            
                                                            {watchedRow?.reinforcementPlan?.skillType === 'tecnica' && (
                                                                <React.Fragment>
                                                                    <FormField
                                                                        control={massEvalControl}
                                                                        name={`evaluations.${index}.reinforcementPlan.reinforcementDescription`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs font-semibold">Descripción de la Capacitación</FormLabel>
                                                                                <FormControl>
                                                                                    <Textarea placeholder="Detalle el taller, curso o certificación requerido..." {...field} />
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={massEvalControl}
                                                                        name={`evaluations.${index}.reinforcementPlan.reinforcementType`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs font-semibold">Modalidad</FormLabel>
                                                                                <Combobox options={reinforcementTypeOptions} placeholder="Seleccionar..." allowCreate {...field} />
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </React.Fragment>
                                                            )}

                                                            {watchedRow?.reinforcementPlan?.skillType === 'blanda' && (
                                                                <React.Fragment>
                                                                    <FormField
                                                                        control={massEvalControl}
                                                                        name={`evaluations.${index}.reinforcementPlan.specificSkills`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs font-semibold">Habilidades Blandas Específicas</FormLabel>
                                                                                <MultiSelectCombobox options={currentSkillOptions} selected={field.value || []} onChange={field.onChange} placeholder="Seleccionar..." searchPlaceholder="Buscar o crear habilidad..." />
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={massEvalControl}
                                                                        name={`evaluations.${index}.reinforcementPlan.reinforcementDescription`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs font-semibold">Descripción del Plan</FormLabel>
                                                                                <FormControl>
                                                                                    <Textarea placeholder="Detalle el plan..." {...field} />
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={massEvalControl}
                                                                        name={`evaluations.${index}.reinforcementPlan.reinforcementType`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs font-semibold">Modalidad</FormLabel>
                                                                                <Combobox options={reinforcementTypeOptions} placeholder="Seleccionar..." allowCreate {...field} />
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </React.Fragment>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-lg border-l align-top pt-4">{notaGeneral}%</TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>
                             <DialogFooter className="pt-6 border-t mt-4 flex-shrink-0">
                                <Button type="button" variant="ghost" onClick={() => setIsMassEvalOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={isMassSubmitting}>
                                    {isMassSubmitting ? 'Terminando...' : 'Terminar Evaluaciones'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

             <Dialog open={!!justificationState} onOpenChange={() => setJustificationState(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Justificación Requerida</DialogTitle>
                        <DialogDescription>
                            Se necesita una justificación para la calificación '{justificationState?.rating}' en la competencia '{justificationState?.criterionTitle}'.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            ref={justificationTextRef}
                            placeholder="Escribe la justificación aquí..."
                            defaultValue={justificationState ? getMassValues(`evaluations.${justificationState.index}.${justificationState.criterionName}Justification`) : ''}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setJustificationState(null)}>Cancelar</Button>
                        <Button onClick={handleSaveJustification}>Guardar Justificación</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold md:text-2xl">Personal a Evaluar</h1>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setGroupDialogOpen(true)}>
                            <Users className="mr-2 h-4 w-4" />
                            Evaluación Grupal
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="pending">
                    <TabsList>
                        <TabsTrigger value="pending">Pendientes</TabsTrigger>
                        <TabsTrigger value="completed">Completadas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending">
                        <div className="space-y-6">
                            {reviewsRequested.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-amber-700 flex items-center gap-2">
                                            <MessageSquareWarning />
                                            Evaluaciones que Requieren Revisión
                                        </CardTitle>
                                        <CardDescription>
                                            Estas evaluaciones fueron devueltas por un observador. Por favor, revisa los comentarios y realiza una nueva evaluación.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Empleado</TableHead>
                                                    <TableHead>Fecha Evaluación</TableHead>
                                                    <TableHead>Comentarios del Observador</TableHead>
                                                    <TableHead className="text-right">Acción</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reviewsRequested.map(ev => (
                                                    <TableRow key={ev.id} className="bg-amber-50">
                                                        <TableCell className="font-medium">{ev.workerName}</TableCell>
                                                        <TableCell>{displayDate(ev.evaluationDate)}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground italic">"{ev.observerComments}"</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (ev.workerCodigo) {
                                                                        router.push(`/dashboard/performance-evaluation/${ev.workerCodigo}?reviewEvaluationId=${ev.id}`);
                                                                    } else {
                                                                        toast({
                                                                            variant: 'destructive',
                                                                            title: 'Error de Datos',
                                                                            description: 'No se pudo encontrar el código del empleado para esta evaluación.',
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={!ev.workerCodigo}
                                                            >
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Re-Evaluar
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle>Personal con Evaluaciones Pendientes</CardTitle>
                                    <CardDescription>
                                        Esta es la lista de empleados que tienes asignados y que requieren una evaluación.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Empleado</TableHead>
                                                <TableHead>Cargo</TableHead>
                                                <TableHead>Fecha de Ingreso</TableHead>
                                                <TableHead>Estado de Evaluación</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">
                                                        <div className="flex justify-center items-center gap-2">
                                                            <LoaderCircle className="h-5 w-5 animate-spin" />
                                                            <span>Cargando evaluaciones pendientes...</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : workersWithStatus.pending.length > 0 ? (
                                                workersWithStatus.pending.map(worker => (
                                                    <TableRow key={worker.id}>
                                                        <TableCell className="font-medium">{worker.apellidos} {worker.nombres}</TableCell>
                                                        <TableCell>{worker.cargo}</TableCell>
                                                        <TableCell>{displayDate(worker.fechaIngreso)}</TableCell>
                                                        <TableCell>
                                                            <EvaluationStatusBadge status={worker.statusInfo.status} message={worker.statusInfo.message} />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {worker.statusInfo.status === 'pending_observation' ? (
                                                                <Badge variant="secondary" className="bg-purple-100 text-purple-800">Pendiente de Aprobación</Badge>
                                                            ) : (
                                                                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/performance-evaluation/${worker.codigo}`)}>
                                                                    <Activity className="mr-2 h-4 w-4" />
                                                                    Evaluar
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">
                                                        No tienes evaluaciones pendientes asignadas.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                    <TabsContent value="completed">
                         <Card>
                            <CardHeader>
                                <CardTitle>Historial de Evaluaciones Completadas</CardTitle>
                                <CardDescription>
                                    Empleados que ya han sido evaluados en el ciclo actual o anterior.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Empleado</TableHead>
                                            <TableHead>Cargo</TableHead>
                                            <TableHead>Fecha de Ingreso</TableHead>
                                            <TableHead>Última Evaluación</TableHead>
                                            <TableHead>Nro. Evaluaciones</TableHead>
                                            <TableHead>Última Nota</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">
                                                    <div className="flex justify-center items-center gap-2">
                                                        <LoaderCircle className="h-5 w-5 animate-spin" />
                                                        <span>Cargando historial...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : workersWithStatus.completed.length > 0 ? (
                                            workersWithStatus.completed.map(worker => (
                                                <TableRow key={worker.id}>
                                                    <TableCell className="font-medium">{worker.apellidos} {worker.nombres}</TableCell>
                                                    <TableCell>{worker.cargo}</TableCell>
                                                    <TableCell>{displayDate(worker.fechaIngreso)}</TableCell>
                                                    <TableCell>{worker.lastEvaluation ? displayDate(worker.lastEvaluation.evaluationDate) : 'N/A'}</TableCell>
                                                    <TableCell className="text-center font-medium">{worker.evaluationCount}</TableCell>
                                                    <TableCell className="text-center font-bold">{worker.lastEvaluation ? `${worker.lastEvaluation.generalEvaluation}%` : 'N/A'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => handleViewHistory(worker)}>
                                                            <History className="mr-2 h-4 w-4" />
                                                            Ver Historial
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">
                                                    No se han completado evaluaciones.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
