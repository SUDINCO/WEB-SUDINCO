
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
          <DialogContent>
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
                      placeholder="Ej: Considero que la calificación en 'Proactividad' no refleja completamente las contribuciones del empleado en el último proyecto..."
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      className="mt-2 min-h-[120px]"
                  />
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setReviewDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={confirmReviewRequest} disabled={!reviewComments.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Solicitud
                  </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-3xl flex flex-col">
                <SheetHeader>
                    <SheetTitle>Detalle de la Evaluación</SheetTitle>
                    <SheetDescription>
                        Revisando la evaluación de <span className="font-semibold text-primary">{worker.nombres} {worker.apellidos}</span> realizada por <span className="font-semibold text-primary">{evaluator.nombres} {evaluator.apellidos}</span>.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-grow overflow-hidden">
                    <ScrollArea className="h-full pr-6">
                        <div className="py-6 space-y-6">
                            <div className="border rounded-lg bg-background">
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
                   <div className="flex w-full justify-between items-center">
                        <Button variant="outline" onClick={() => onDownloadPdf(evaluation)}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar PDF
                        </Button>
                        {(!evaluation.observerStatus || evaluation.observerStatus === 'pending') && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={openReviewDialog}>
                                    <AlertTriangle className="mr-2 h-4 w-4" />
                                    Solicitar Revisión
                                </Button>
                                <Button onClick={() => onAction(evaluation.id, 'approved')}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Aprobar
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
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Evaluador</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex justify-center items-center gap-2">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                            Cargando evaluaciones...
                        </div>
                    </TableCell>
                </TableRow>
            ) : evaluations.length > 0 ? (
                evaluations.map(ev => (
                    <TableRow key={ev.id}>
                        <TableCell className="font-medium">{ev.workerName}</TableCell>
                        <TableCell>{ev.evaluatorName}</TableCell>
                        <TableCell>{new Date(ev.evaluationDate).toLocaleDateString('es-ES')}</TableCell>
                        <TableCell><Badge variant="secondary">{ev.generalEvaluation}%</Badge></TableCell>
                        <TableCell>{getStatusBadge(ev.observerStatus)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => onOpenDetails(ev)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalles
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
        setSheetOpen(false); // Close sheet after action
    };

    const handleDownloadPdf = async (evaluation: PerformanceEvaluation) => {
        const { generateEvaluationPDF } = await import('@/lib/pdf-generator');
        const worker = allWorkers?.find(w => w.id === evaluation.workerId);
        const evaluator = allWorkers?.find(w => w.id === evaluation.evaluatorId);

        if (!worker || !evaluator) {
             toast({
                variant: "destructive",
                title: "Error al generar PDF",
                description: "No se pudo encontrar la información completa del trabajador o evaluador.",
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
                    <h1 className="text-lg font-semibold md:text-2xl">Evaluaciones Observadas</h1>
                    <p className="text-sm text-muted-foreground">
                        Lista de evaluaciones asignadas para tu revisión. Aprueba o solicita una corrección al evaluador.
                    </p>
                </div>
                
                <Tabs defaultValue="pending">
                    <div className="flex justify-between items-center mb-4">
                        <TabsList>
                            <TabsTrigger value="pending">Pendientes de Revisión ({pendingEvaluations.length})</TabsTrigger>
                            <TabsTrigger value="approved">Aprobadas ({approvedEvaluations.length})</TabsTrigger>
                        </TabsList>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre de empleado..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <TabsContent value="pending">
                        <Card>
                             <CardHeader>
                                <CardTitle>Evaluaciones Pendientes de Revisión</CardTitle>
                                <CardDescription>
                                    Estas evaluaciones están esperando tu aprobación o solicitud de revisión.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                               <ObservedEvaluationsTable evaluations={pendingEvaluations} isLoading={isLoading} onOpenDetails={handleOpenDetails} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                     <TabsContent value="approved">
                        <Card>
                             <CardHeader>
                                <CardTitle>Evaluaciones Aprobadas</CardTitle>
                                <CardDescription>
                                    Este es el historial de evaluaciones que ya has aprobado.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                               <ObservedEvaluationsTable evaluations={approvedEvaluations} isLoading={isLoading} onOpenDetails={handleOpenDetails} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
