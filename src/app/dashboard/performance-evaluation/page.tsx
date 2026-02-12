

"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { FileDown, FileUp, Search, Activity, AlertTriangle, CheckCircle, Clock, History, Download, Trash2, Edit, CalendarDays, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Combobox } from '@/components/ui/combobox';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, writeBatch, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { generateEvaluationPDF } from '@/lib/pdf-generator';
import { PersonDTO } from '@/lib/contracts';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays, set, isBefore, isSameDay, isWithinInterval, subDays, addYears, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserProfile, PerformanceEvaluation, ManagerEvaluation, GenericOption } from '@/lib/types';


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
    
    // --- Logic for employees with more than 1 year ---
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
    
     const handleDownloadPdf = (evaluation: PerformanceEvaluation) => {
        if(!worker) return;
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

export default function PerformanceEvaluationPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
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
        if (!assignmentData || !selectedNewAssignee || !firestore) return;
        
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
                        const score = ratingValues[ev[key]] || 1; // Default to 1 (NT) if not found
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
                const toPct = (scoreKey: string) => {
                    const score = ratingValues[evaluation[scoreKey]] || 1;
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
                                            <Button variant="outline" size="sm" disabled={statusInfo.isCompleted} onClick={() => router.push(`/dashboard/performance-evaluation/${worker.id}`)}>
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
