

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCheck, Info, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Candidate, HiringApproval } from '@/lib/types';


interface ShortlistDialogProps {
  approval: HiringApproval;
  allCandidates: Candidate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (selectedCandidateId: string, comments: string) => void;
  onReject: () => void;
  onViewImage: (url: string) => void;
}

export function ShortlistDialog({ approval, allCandidates, open, onOpenChange, onApprove, onReject, onViewImage }: ShortlistDialogProps) {
    const [selectedCandidateId, setSelectedCandidateId] = useState('');
    const [bossComments, setBossComments] = useState('');

    useEffect(() => {
        if (open && approval.recommendations.length > 0) {
            setSelectedCandidateId(approval.recommendations[0].candidateId);
            setBossComments('');
        }
    }, [open, approval.recommendations]);

    const handleApproveClick = () => {
        if (!selectedCandidateId) {
            toast({ variant: 'destructive', title: 'Selección requerida', description: 'Por favor, selecciona un candidato para aprobar.' });
            return;
        }
        onApprove(selectedCandidateId, bossComments);
    };

    const recommendedIds = useMemo(() => new Set(approval.recommendations.map(r => r.candidateId)), [approval.recommendations]);
    const recommendationsMap = useMemo(() => {
        const map = new Map<string, string>();
        approval.recommendations.forEach(rec => {
            map.set(rec.candidateId, rec.comment);
        });
        return map;
    }, [approval.recommendations]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Revisar Terna para: {approval.processInfo?.cargo}</DialogTitle>
                    <DialogDescription>
                        Selecciona el candidato final a contratar. Los candidatos recomendados por RRHH están resaltados.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    {approval.processInfo?.isRetroactive && (
                        <Card className="bg-amber-50 border-amber-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base text-amber-900 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Contratación Retroactiva</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-amber-800">
                                    <strong>Fecha de Ingreso Efectiva: {format(new Date(approval.processInfo.effectiveHiringDate!), 'dd MMMM, yyyy', { locale: es })}</strong>
                                </p>
                                {approval.processInfo.justificationForRetroactive && (
                                    <div>
                                        <p className="font-semibold text-sm text-amber-900">Justificación:</p>
                                        <p className="text-sm text-amber-800 italic">"{approval.processInfo.justificationForRetroactive}"</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                    
                    <RadioGroup value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Candidato</TableHead>
                                    <TableHead>Nota</TableHead>
                                    <TableHead>Aspiración</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {approval.shortlist.map(item => {
                                    const candidateData = allCandidates.find(c => c.id === item.candidateId);
                                    const isRecommended = recommendedIds.has(item.candidateId);
                                    const recommendationComment = recommendationsMap.get(item.candidateId);

                                    return (
                                        <React.Fragment key={item.candidateId}>
                                            <TableRow className={isRecommended ? 'bg-amber-50/60' : ''}>
                                                <TableCell>
                                                    <RadioGroupItem value={item.candidateId} id={`r-${item.candidateId}`} />
                                                </TableCell>
                                                <TableCell>
                                                    <Label htmlFor={`r-${item.candidateId}`} className="font-medium flex items-center gap-3 cursor-pointer">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onViewImage(candidateData?.photoUrl || ''); }} className="cursor-pointer">
                                                            <Avatar className="h-12 w-12">
                                                                <AvatarImage src={candidateData?.photoUrl || undefined} alt={item.candidateInfo.nombres} />
                                                                <AvatarFallback>{item.candidateInfo.nombres?.[0]}{item.candidateInfo.apellidos?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                        </button>
                                                        <div className="flex flex-col">
                                                            <span>{item.candidateInfo.nombres} {item.candidateInfo.apellidos}</span>
                                                            {isRecommended && <Badge variant="secondary" className="bg-amber-200 text-amber-900 mt-1 w-fit">Recomendado</Badge>}
                                                        </div>
                                                    </Label>
                                                </TableCell>
                                                <TableCell>{item.evaluationInfo.notaGeneral}%</TableCell>
                                                <TableCell>{item.evaluationInfo.aspiracionSalarial ? `$${item.evaluationInfo.aspiracionSalarial}` : 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={item.evaluationInfo.status === 'C' ? 'default' : 'destructive'}>
                                                        {item.evaluationInfo.status === 'C' ? 'Contratable' : 'No Contratable'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                            {isRecommended && recommendationComment && (
                                                <TableRow className={isRecommended ? 'bg-amber-50/60' : ''}>
                                                    <TableCell></TableCell>
                                                    <TableCell colSpan={4} className="py-2 px-4">
                                                        <div className="p-2 text-sm bg-blue-50 border-l-4 border-blue-500 text-blue-900 rounded-r-md">
                                                            <span className="font-semibold">Recomendación:</span>
                                                            <span className="italic"> "{recommendationComment}"</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                )})}
                            </TableBody>
                        </Table>
                    </RadioGroup>

                    <div className="pt-4">
                        <Label htmlFor="boss-comments">Comentarios Adicionales (Opcional)</Label>
                        <Textarea 
                            id="boss-comments"
                            placeholder="Añade tus comentarios sobre la selección..."
                            value={bossComments}
                            onChange={(e) => setBossComments(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="destructive" onClick={onReject}>Rechazar Proceso</Button>
                    <Button onClick={handleApproveClick}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Aprobar Candidato Seleccionado
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
