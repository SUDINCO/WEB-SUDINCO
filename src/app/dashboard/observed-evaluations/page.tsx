
"use client";

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, LoaderCircle, Check, AlertTriangle, Send, Eye, Search } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
import { PersonDTO } from '@/lib/contracts';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { UserProfile, PerformanceEvaluation } from '@/lib/types';


const ratings: Record<string, string> = {
    NT: "No Tiene",
    BA: "Bajo",
    ED: "En Desarrollo",
    TI: "Tiene",
};

const evaluationCriteria: { key: keyof PerformanceEvaluation, label: string }[] = [
    { key: "conocimientosTecnicos", label: "Conocimientos Técnicos" },
    { key: "calidadTrabajo", label: "Calidad del trabajo" },
    { key: "cumplimientoPoliticas", label: "Cumplimiento de Políticas" },
    { key: "proactividad", label: "Proactividad" },
    { key: "comunicacion", label: "Comunicación" },
    { key: "integridad", label: "Integridad y Ética" },
    { key: "adaptabilidad", label: "Adaptabilidad" },
    { key: "servicioCliente", label: "Servicio al Cliente" },
    { key: "compromisoCompania", label: "Compromiso con la Compañía" },
];

const getStatusBadge = (status: PerformanceEvaluation['observerStatus']) => {
    switch (status) {
        case 'approved':
            return <Badge className="bg-green-100 text-green-800"><Check className="mr-1 h-3 w-3" /> Aprobado</Badge>;
        case 'review_requested':
            return <Badge variant="destructive">Revisión Solicitada</Badge>;
        case 'pending':
        default:
            return <Badge variant="secondary">Pendiente de Revisión</Badge>;
    }
};

function EvaluationDetailSheet({ open, onOpenChange, evaluation, worker, evaluator, onAction, onDownloadPdf }: { 
    open: boolean, 
    onOpenChange: (open: boolean) => void, 
    evaluation: PerformanceEvaluation | null, 
    worker: UserProfile | null,
    evaluator: UserProfile | null,
    onAction: (evaluationId: string, status: 'approved' | 'review_requested', comments?: string) => void,
    onDownloadPdf: (evaluation: PerformanceEvaluation) => void
}) {
    const [isReviewDialogOpen, setReviewDialogOpen] = useState(false);
    const [reviewComments, setReviewComments] = useState('');

    const openReviewDialog = () => {
        setReviewComments(evaluation?.observerComments || '');
        setReviewDialogOpen(true);
    };

    const confirmReviewRequest = () => {
        if (evaluation) {
            onAction(evaluation.id, 'review_requested', reviewComments);
        }
        setReviewDialogOpen(false);
    };

    if (!evaluation || !worker || !evaluator) return null;

    return (
      <>
        <Dialog open={isReviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-md w-[95vw]">
              <DialogHeader>
                  <DialogTitle>Solicitar Revisión de Evaluación</DialogTitle>
                  <DialogDescription>
                      Por favor, detalla los motivos por los cuales esta evaluación requiere una revisión por parte del evaluador original.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <Label htmlFor="review-comments">Comentarios para el Evaluador</Label>
                  <Textarea
                      id="review-comments"
                      placeholder="Ej: Considero que la calificación en 'Proactividad' no refleja completamente..."
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      className="mt-2 min-h-[120px]"
                  />
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="ghost" onClick={() => setReviewDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={confirmReviewRequest} disabled={!reviewComments.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Solicitud
                  </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-3xl flex flex-col p-4 sm:p-6 overflow-hidden">
                <SheetHeader className="mb-4">
                    <SheetTitle>Detalle de la Evaluación</SheetTitle>
                    <SheetDescription>
                        Revisando la evaluación de <span className="font-semibold text-primary">{worker.nombres} {worker.apellidos}</span> realizada por <span className="font-semibold text-primary">{evaluator.nombres} {evaluator.apellidos}</span>.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-grow overflow-hidden">
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-6">
                            {/* Desktop View Table */}
                            <div className="hidden md:block border rounded-lg bg-background overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Competencia</TableHead>
                                            <TableHead className="w-24 text-center">Calificación</TableHead>
                                            <TableHead>Justificación del Evaluador</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {evaluationCriteria.map(criterion => (
                                            <TableRow key={criterion.key}>
                                                <TableCell className="font-medium">{criterion.label}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline">{ratings[evaluation[criterion.key] as string] || evaluation[criterion.key]}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground italic">
                                                    "{evaluation[`${String(criterion.key)}Justification` as keyof PerformanceEvaluation] as string || 'Sin justificación.'}"
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile View Cards */}
                            <div className="md:hidden space-y-4">
                                {evaluationCriteria.map(criterion => (
                                    <Card key={criterion.key} className="border shadow-none">
                                        <CardHeader className="p-3 pb-1">
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="text-sm font-bold leading-tight">{criterion.label}</p>
                                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                                    {ratings[evaluation[criterion.key] as string] || evaluation[criterion.key]}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-3 pt-0">
                                            <p className="text-xs text-muted-foreground italic border-l-2 pl-2 mt-2">
                                                "{evaluation[`${String(criterion.key)}Justification` as keyof PerformanceEvaluation] as string || 'Sin justificación.'}"
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <Separator />
                            <div>
                                <h4 className="font-semibold mb-2 text-md">Observaciones Generales</h4>
                                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md border italic">
                                    "{evaluation.observations || 'Sin observaciones generales.'}"
                                </p>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
                <SheetFooter className="pt-4 mt-auto">
                   <div className="flex flex-col sm:flex-row w-full justify-between items-stretch sm:items-center gap-3">
                        <Button variant="outline" onClick={() => onDownloadPdf(evaluation)} className="w-full sm:w-auto">
                            <Download className="mr-2 h-4 w-4" />
                            Descargar PDF
                        </Button>
                        {(!evaluation.observerStatus || evaluation.observerStatus === 'pending') && (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button variant="secondary" onClick={openReviewDialog} className="w-full sm:w-auto">
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Solicitar Revisión
                                </Button>
                                <Button onClick={() => onAction(evaluation.id, 'approved')} className="w-full sm:w-auto">
                                    <Check className="mr-2 h-4 w-4" />
                                    Aprobar Evaluación
                                </Button>
                            </div>
                        )}
                   </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
      </>
    )
}

function ObservedEvaluationsTable({ evaluations, isLoading, onOpenDetails }: { 
  evaluations: any[], 
  isLoading: boolean,
  onOpenDetails: (evaluation: PerformanceEvaluation) => void
}) {
  return (
    <div className="overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="whitespace-nowrap">Empleado</TableHead>
                    <TableHead className="whitespace-nowrap">Evaluador</TableHead>
                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="whitespace-nowrap">Nota</TableHead>
                    <TableHead className="whitespace-nowrap">Estado</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center">
                            <div className="flex justify-center items-center gap-2">
                                <LoaderCircle className="h-5 w-5 animate-spin" />
                                <span>Cargando evaluaciones...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : evaluations.length > 0 ? (
                    evaluations.map(ev => (
                        <TableRow key={ev.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onOpenDetails(ev)}>
                            <TableCell className="font-medium whitespace-nowrap">{ev.workerName}</TableCell>
                            <TableCell className="whitespace-nowrap">{ev.evaluatorName}</TableCell>
                            <TableCell className="whitespace-nowrap">{new Date(ev.evaluationDate).toLocaleDateString('es-ES')}</TableCell>
                            <TableCell><Badge variant="secondary">{ev.generalEvaluation}%</Badge></TableCell>
                            <TableCell className="whitespace-nowrap">{getStatusBadge(ev.observerStatus)}</TableCell>
                            <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpenDetails(ev); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver
                            </Button>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                            No hay evaluaciones en esta sección.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    </div>
  );
}


export default function ObservedEvaluationsPage() {
    const { user: authUser, loading: authLoading } = useUser();
    const firestore = useFirestore();

    const [selectedEvaluation, setSelectedEvaluation] = useState<PerformanceEvaluation | null>(null);
    const [isSheetOpen, setSheetOpen] = useState(false);
    const [filter, setFilter] = useState('');

    const evaluationsQuery = useMemo(() => {
        if (!firestore || !authUser?.email) return null;
        return query(collection(firestore, 'performanceEvaluations'), where("observerEmail", "==", authUser.email));
    }, [firestore, authUser]);

    const { data: evaluations, isLoading: evaluationsLoading } = useCollection<PerformanceEvaluation>(evaluationsQuery);
    const { data: allWorkers, isLoading: workersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));

    const isLoading = authLoading || evaluationsLoading || workersLoading;

    const evaluationsWithDetails = useMemo(() => {
        if (!evaluations || !allWorkers) return [];
        return evaluations.map(ev => {
            const worker = allWorkers.find(w => w.id === ev.workerId);
            const evaluator = allWorkers.find(w => w.id === ev.evaluatorId);
            return {
                ...ev,
                workerName: worker ? `${worker.nombres} ${worker.apellidos}` : 'Desconocido',
                workerCargo: worker?.cargo || 'N/A',
                evaluatorName: evaluator ? `${evaluator.nombres} ${evaluator.apellidos}` : 'Desconocido',
            };
        }).sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime());
    }, [evaluations, allWorkers]);

    const pendingEvaluations = useMemo(() => {
        const lowercasedFilter = filter.toLowerCase();
        return evaluationsWithDetails
            .filter(ev => ev.observerStatus !== 'approved')
            .filter(ev => ev.workerName.toLowerCase().includes(lowercasedFilter));
    }, [evaluationsWithDetails, filter]);

    const approvedEvaluations = useMemo(() => {
        const lowercasedFilter = filter.toLowerCase();
        return evaluationsWithDetails
            .filter(ev => ev.observerStatus === 'approved')
            .filter(ev => ev.workerName.toLowerCase().includes(lowercasedFilter));
    }, [evaluationsWithDetails, filter]);
    
    const handleAction = async (evaluationId: string, status: PerformanceEvaluation['observerStatus'], comments?: string) => {
        if (!firestore) return;
        const evalDocRef = doc(firestore, 'performanceEvaluations', evaluationId);
        
        const updateData = {
            observerStatus: status,
            observerComments: comments || ''
        };

        try {
            await setDoc(evalDocRef, updateData, { merge: true });
            toast({
                title: 'Acción Registrada',
                description: `La evaluación ha sido marcada como '${status === 'approved' ? 'Aprobada' : 'Revisión Solicitada'}'.`
            });
        } catch(error) {
            console.error("Error updating evaluation status: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la evaluación.' });
        }
        setSheetOpen(false); 
    };

    const handleDownloadPdf = async (evaluation: PerformanceEvaluation) => {
        const { generateEvaluationPDF } = await import('@/lib/pdf-generator');
        const worker = allWorkers?.find(w => w.id === evaluation.workerId);
        const evaluator = allWorkers?.find(w => w.id === evaluation.evaluatorId);

        if (!worker || !evaluator) {
             toast({
                variant: "destructive",
                title: "Error al generar PDF",
                description: "No se pudo encontrar la información completa.",
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

    const handleOpenDetails = (evaluation: PerformanceEvaluation) => {
        setSelectedEvaluation(evaluation);
        setSheetOpen(true);
    }

    return (
        <>
            <EvaluationDetailSheet 
                open={isSheetOpen}
                onOpenChange={setSheetOpen}
                evaluation={selectedEvaluation}
                worker={allWorkers?.find(w => w.id === selectedEvaluation?.workerId) || null}
                evaluator={allWorkers?.find(w => w.id === selectedEvaluation?.evaluatorId) || null}
                onAction={handleAction}
                onDownloadPdf={handleDownloadPdf}
            />

            <div className="space-y-6">
                 <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Evaluaciones Observadas</h1>
                    <p className="text-sm text-muted-foreground">
                        Lista de evaluaciones asignadas para tu revisión y aprobación final.
                    </p>
                </div>
                
                <Tabs defaultValue="pending">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <TabsList className="w-full sm:w-auto">
                            <TabsTrigger value="pending" className="flex-1 sm:flex-none">Pendientes ({pendingEvaluations.length})</TabsTrigger>
                            <TabsTrigger value="approved" className="flex-1 sm:flex-none">Aprobadas ({approvedEvaluations.length})</TabsTrigger>
                        </TabsList>
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar empleado..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <TabsContent value="pending" className="m-0">
                        <Card className="shadow-sm">
                            <CardHeader className="p-4 sm:p-6">
                                <CardTitle className="text-lg">Revisiones Pendientes</CardTitle>
                                <CardDescription>
                                    Estas evaluaciones esperan tu validación técnica.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 border-t">
                               <ObservedEvaluationsTable evaluations={pendingEvaluations} isLoading={isLoading} onOpenDetails={handleOpenDetails} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                     <TabsContent value="approved" className="m-0">
                        <Card className="shadow-sm">
                            <CardHeader className="p-4 sm:p-6">
                                <CardTitle className="text-lg">Evaluaciones Aprobadas</CardTitle>
                                <CardDescription>
                                    Historial de evaluaciones validadas satisfactoriamente.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 border-t">
                               <ObservedEvaluationsTable evaluations={approvedEvaluations} isLoading={isLoading} onOpenDetails={handleOpenDetails} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
