

"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Check,
  X,
  UserCheck,
  Download,
  MessageCircle,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ShortlistDialog } from '@/components/approvals/ShortlistDialog';
import { format } from 'date-fns';
import type { HiringApproval, UserProfile, HiringProcess, Candidate } from '@/lib/types';


const HiringApprovalStatus = ({ status }: { status: HiringApproval['status'] }) => {
  switch (status) {
    case 'pending':
    case 'approved-boss':
      return <Badge variant="secondary">Pendiente</Badge>;
    case 'approved-rh':
      return <Badge className="bg-green-100 text-green-800">Aprobado</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rechazado</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function ApprovalsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [shortlistToView, setShortlistToView] = useState<HiringApproval | null>(null);
  const [imageToView, setImageToView] = useState<string | null>(null);
  

  const { data: approvals, isLoading: approvalsLoading } =
    useCollection<HiringApproval>(
      useMemo(
        () => (firestore ? collection(firestore, 'hiringApprovals') : null),
        [firestore]
      )
    );
  const { data: allWorkers, isLoading: workersLoading } = useCollection<UserProfile>(
    useMemo(() => (firestore ? collection(firestore, 'users') : null), [
      firestore,
    ])
  );
  const { data: allProcesses, isLoading: processesLoading } =
    useCollection<HiringProcess>(
      useMemo(
        () => (firestore ? collection(firestore, 'hiringProcesses') : null),
        [firestore]
      )
    );
  const { data: allCandidates, isLoading: candidatesLoading } =
    useCollection<Candidate>(
      useMemo(
        () => (firestore ? collection(firestore, 'candidates') : null),
        [firestore]
      )
    );
  
  const loading = approvalsLoading || workersLoading || processesLoading || candidatesLoading;
  
  const currentUserProfile = useMemo(() => {
    if (!user || !allWorkers) return null;
    return allWorkers.find(w => w.email?.toLowerCase() === user.email?.toLowerCase());
  }, [user, allWorkers]);

  const handleHiringApprovalAction = async (
    approval: HiringApproval,
    newStatus: HiringApproval['status'],
    details?: { selectedCandidateId?: string; comments?: string }
  ) => {
    if (!firestore) return;
    const approvalDocRef = doc(firestore, 'hiringApprovals', approval.id);
    const batch = writeBatch(firestore);

    if (newStatus === 'approved-boss') {
        if (!details?.selectedCandidateId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debe seleccionar un candidato.' });
            return;
        }
        batch.update(approvalDocRef, {
            status: 'approved-boss',
            bossSelection: {
                selectedCandidateId: details.selectedCandidateId,
                bossComments: details.comments || '',
                selectionDate: Date.now(),
            }
        });
    } else if (newStatus === 'approved-rh') {
        if (!approval.bossSelection?.selectedCandidateId) {
             toast({ variant: 'destructive', title: 'Error', description: 'El jefe inmediato aún no ha seleccionado un candidato.' });
             return;
        }
        const hiredCandidateInfo = approval.shortlist?.find(c => c.candidateId === approval.bossSelection!.selectedCandidateId);
        
        batch.update(approvalDocRef, { status: 'approved-rh' });
        
        if (hiredCandidateInfo && approval.processId) {
             const processDocRef = doc(firestore, 'hiringProcesses', approval.processId);
             const processToUpdate = allProcesses?.find(p => p.id === approval.processId);
             const newHiredIds = Array.from(
                new Set([...(processToUpdate?.hiredCandidateIds || []), hiredCandidateInfo.candidateId])
             );
             batch.update(processDocRef, { hiredCandidateIds: newHiredIds });
        }
    } else if (newStatus === 'rejected') {
        batch.update(approvalDocRef, { status: 'rejected' });
    }

    try {
      await batch.commit();

      toast({
        title: 'Acción registrada',
        description: `La solicitud ha sido actualizada.`,
      });
      setShortlistToView(null);
    } catch (error) {
      console.error('Error updating approval status: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la solicitud.',
      });
    }
  };
  
  const handleDownload = async (approval: HiringApproval) => {
    const { generateHiringApprovalPDF } = await import('@/lib/pdf-generator');
    const selectedCandidateId = approval.bossSelection?.selectedCandidateId;

    if (!selectedCandidateId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se ha seleccionado un candidato final.' });
        return;
    }

    const shortlistItem = approval.shortlist?.find(c => c.candidateId === selectedCandidateId);
    
    if (!shortlistItem) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontraron los datos del candidato seleccionado.' });
        return;
    }
    
    const candidate = shortlistItem.candidateInfo;
    const evaluation = shortlistItem.evaluationInfo;

    const evaluator = allWorkers?.find((w) => w.email === approval.requesterEmail);
    const boss = allWorkers?.find((w) => w.email === approval.jefeInmediatoEmail);
    const rhDirector = allWorkers?.find((w) => w.cargo === 'DIRECTOR DE RECURSOS HUMANOS');
    
    const process = allProcesses?.find(p => p.id === approval.processId);

    if (!candidate || !evaluation || !evaluator || !boss || !rhDirector || !process) {
      toast({
        variant: 'destructive',
        title: 'Error al generar PDF',
        description:
          'Faltan datos para generar el resumen (candidato, proceso, evaluadores, o evaluación).',
      });
      return;
    }
    
    generateHiringApprovalPDF(approval, candidate, evaluation, evaluator, boss, rhDirector, process);
  };

  const HiringApprovalActions = ({ approval }: { approval: HiringApproval }) => {
    if (!user || !user.email) return null;

    const isMaster = currentUserProfile?.rol === 'MASTER';
    const isDirectorRH = currentUserProfile?.cargo === 'DIRECTOR DE RECURSOS HUMANOS';
    const canApproveAsRH = isMaster || isDirectorRH;

    const isAdmin = isMaster;
    const isBoss = user.email.toLowerCase() === approval.jefeInmediatoEmail?.toLowerCase();

    if (approval.status === 'rejected' || approval.status === 'approved-rh') {
      return <span className="text-sm text-muted-foreground">-</span>;
    }
    
    if ((isBoss || isAdmin) && approval.status === 'pending') {
      return (
        <Button size="sm" onClick={() => setShortlistToView(approval)}>
          <Users className="mr-2 h-4 w-4" /> Revisar Terna
        </Button>
      );
    }

    if (canApproveAsRH && approval.status === 'approved-boss') {
      return (
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            className="h-8 bg-green-600 hover:bg-green-700"
            onClick={() => handleHiringApprovalAction(approval, 'approved-rh')}
          >
            <UserCheck className="mr-2 h-4 w-4" /> Aprobar Contratación
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            onClick={() => handleHiringApprovalAction(approval, 'rejected')}
          >
            <X className="mr-2 h-4 w-4" /> Rechazar
          </Button>
        </div>
      );
    }
    
    // Fallback for other states
    return <span className="text-sm text-muted-foreground">-</span>;
  };

  const pendingBossApprovals = React.useMemo(
    () =>
      approvals
        ?.filter((a) => a.status === 'pending')
        .sort((a, b) => b.createdAt - a.createdAt) || [],
    [approvals]
  );

  const pendingRHApprovals = React.useMemo(
    () =>
      approvals
        ?.filter((a) => a.status === 'approved-boss')
        .sort((a, b) => b.createdAt - a.createdAt) || [],
    [approvals]
  );

  const completedApprovals = React.useMemo(
    () =>
      approvals
        ?.filter((a) => a.status === 'approved-rh' || a.status === 'rejected')
        .sort((a, b) => b.createdAt - a.createdAt) || [],
    [approvals]
  );

  const HiringApprovalsTable = ({
    data,
    isLoading,
    isFinal,
  }: {
    data: HiringApproval[];
    isLoading: boolean;
    isFinal: boolean;
  }) => (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proceso de Contratación</TableHead>
            <TableHead>Jefe Inmediato</TableHead>
            <TableHead>Fecha Solicitud</TableHead>
            <TableHead>Estado Aprobación</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={`skel-pending-${i}`}>
                <TableCell colSpan={5}>
                  <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                </TableCell>
              </TableRow>
            ))
          ) : data.length > 0 ? (
            data.map((approval) => {
              const selectedByBoss = approval.bossSelection ? approval.shortlist.find(c => c.candidateId === approval.bossSelection?.selectedCandidateId) : null;
              const selectedCandidateFullData = selectedByBoss && allCandidates ? allCandidates.find(c => c.id === selectedByBoss.candidateId) : null;

              return (
                <TableRow key={approval.id}>
                  <TableCell className="font-medium">
                     <div className='flex items-center gap-2'>
                        <span>Terna para {approval.processInfo?.cargo}</span>
                        {approval.processInfo?.isRetroactive && (
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Retroactivo</Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                     <p className="font-bold">Proceso Retroactivo</p>
                                     <p>Fecha de Ingreso: {format(new Date(approval.processInfo.effectiveHiringDate!), 'dd/MM/yyyy')}</p>
                                     {approval.processInfo.justificationForRetroactive && (
                                         <p className="mt-2"><span className="font-semibold">Justificación:</span> {approval.processInfo.justificationForRetroactive}</p>
                                     )}
                                 </TooltipContent>
                            </Tooltip>
                        )}
                        {approval.recommendations && approval.recommendations.length > 0 && (
                           <Tooltip>
                            <TooltipTrigger>
                              <MessageCircle className="h-4 w-4 text-blue-500 cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="p-2 space-y-2 max-w-xs">
                                    <p className="font-bold">Recomendaciones ({approval.recommendations.length}):</p>
                                    {approval.recommendations.map(rec => {
                                        const candInfo = approval.shortlist.find(c => c.candidateId === rec.candidateId)?.candidateInfo;
                                        return (
                                            <div key={rec.candidateId} className="text-xs">
                                                <p className="font-semibold">{candInfo?.nombres} {candInfo?.apellidos}:</p>
                                                <p className="italic">"{rec.comment}"</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                    </div>
                    {selectedByBoss && (
                       <div className="flex items-center gap-2 mt-1">
                           <Tooltip>
                                <TooltipTrigger asChild>
                                    <button type="button" onClick={() => setImageToView(selectedCandidateFullData?.photoUrl || null)} className="cursor-pointer rounded-full">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={selectedCandidateFullData?.photoUrl || undefined} />
                                            <AvatarFallback>{selectedByBoss.candidateInfo.nombres?.[0]}{selectedByBoss.candidateInfo.apellidos?.[0]}</AvatarFallback>
                                        </Avatar>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Ver foto ampliada</p>
                                </TooltipContent>
                           </Tooltip>
                          <p className="text-xs text-muted-foreground">
                             Seleccionado por Jefe: <span className="font-semibold text-foreground">{selectedByBoss.candidateInfo.nombres} {selectedByBoss.candidateInfo.apellidos}</span>
                          </p>
                       </div>
                    )}
                  </TableCell>
                  <TableCell>{approval.jefeInmediatoEmail}</TableCell>
                  <TableCell>
                    {new Date(approval.createdAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <HiringApprovalStatus status={approval.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {isFinal && approval.status === 'approved-rh' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => handleDownload(approval)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Descargar Resumen
                      </Button>
                    ) : (
                      <HiringApprovalActions approval={approval} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No hay solicitudes en esta sección.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );

  return (
    <div className="space-y-6">
        <Dialog open={!!imageToView} onOpenChange={() => setImageToView(null)}>
            <DialogContent className="max-w-xl p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Vista previa del candidato</DialogTitle>
                </DialogHeader>
                {imageToView && <Image
                    src={imageToView}
                    alt="Vista previa del candidato"
                    width={600}
                    height={600}
                    className="rounded-md object-contain"
                    unoptimized
                />}
            </DialogContent>
        </Dialog>

      {shortlistToView && (
        <ShortlistDialog
          approval={shortlistToView}
          allCandidates={allCandidates || []}
          open={!!shortlistToView}
          onOpenChange={() => setShortlistToView(null)}
          onApprove={(selectedCandidateId, comments) => handleHiringApprovalAction(shortlistToView, 'approved-boss', { selectedCandidateId, comments })}
          onReject={() => handleHiringApprovalAction(shortlistToView, 'rejected')}
          onViewImage={(url) => setImageToView(url)}
        />
      )}

      <h1 className="text-lg font-semibold md:text-2xl">
        Aprobaciones
      </h1>

      <Tabs defaultValue="pending-boss">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending-boss">Pendientes Jefes de Área</TabsTrigger>
          <TabsTrigger value="pending-rh">Pendientes RRHH</TabsTrigger>
          <TabsTrigger value="completed">Finalizadas</TabsTrigger>
        </TabsList>
        <TabsContent value="pending-boss">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes Pendientes de Jefes de Área</CardTitle>
              <CardDescription>
                Procesos que requieren la selección y aprobación de un candidato por parte del Jefe Inmediato.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HiringApprovalsTable
                data={pendingBossApprovals}
                isLoading={loading}
                isFinal={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pending-rh">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes Pendientes de RRHH</CardTitle>
              <CardDescription>
                Procesos aprobados por el Jefe de Área que requieren la aprobación final del Director de RRHH.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HiringApprovalsTable
                data={pendingRHApprovals}
                isLoading={loading}
                isFinal={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes Finalizadas</CardTitle>
              <CardDescription>
                Historial de solicitudes que ya han sido aprobadas o
                rechazadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HiringApprovalsTable
                data={completedApprovals}
                isLoading={loading}
                isFinal={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
