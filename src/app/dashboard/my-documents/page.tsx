"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { collection, doc, updateDoc, query, where } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    FileText, 
    FileSignature, 
    CheckCircle, 
    Eye,
    LoaderCircle,
    Eraser,
    Lock,
    Unlock,
    XCircle,
    MessageSquare,
    ChevronRight,
    AlertTriangle,
    Send
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Memorandum, UserProfile } from '@/lib/types';

export default function MyDocumentsPage() {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
    const [interactionMode, setInteractionMode] = useState<'view' | 'sign' | 'reject'>('view');
    const [defense, setDefense] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // Signature State
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    // Get current user profile directly by ID
    const userDocRef = useMemo(() => {
        if (!firestore || !authUser?.uid) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [firestore, authUser?.uid]);

    const { data: currentUserProfile, isLoading: profileLoading } = useDoc<UserProfile>(userDocRef);

    const memosQuery = useMemo(() => {
        if (!firestore || !authUser?.uid) return null;
        // Simplified query to avoid index requirement issues if not created yet
        return query(
            collection(firestore, 'memorandums'), 
            where('targetUserId', '==', authUser.uid)
        );
    }, [firestore, authUser?.uid]);

    const { data: myMemos, isLoading: memosLoading } = useCollection<Memorandum>(memosQuery);

    const sortedMemos = useMemo(() => {
        if (!myMemos) return [];
        return [...myMemos].sort((a, b) => b.createdAt - a.createdAt);
    }, [myMemos]);

    const handleOpenMemo = async (memo: Memorandum) => {
        setSelectedMemo(memo);
        setInteractionMode('view');
        setDefense("");
        setIsLocked(false);
        
        // Mark as read if it's the first time
        if (memo.status === 'issued' && firestore) {
            const memoRef = doc(firestore, 'memorandums', memo.id);
            const updateData = {
                status: 'read',
                readAt: Date.now()
            };
            updateDoc(memoRef, updateData).catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: memoRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                }));
            });
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const getCoordinates = (e: any) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: any) => {
        if (isLocked) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000';
            setIsDrawing(true);
        }
    };

    const draw = (e: any) => {
        if (!isDrawing || isLocked || !canvasRef.current) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const handleSign = async () => {
        if (!selectedMemo || !firestore || !isLocked) return;

        setIsSaving(true);
        const signature = canvasRef.current!.toDataURL('image/png');
        const memoRef = doc(firestore, 'memorandums', selectedMemo.id);
        const updateData = {
            status: 'signed',
            signedAt: Date.now(),
            signature: signature,
            defense: defense.trim() || null
        };

        updateDoc(memoRef, updateData)
            .then(() => {
                toast({ title: 'Documento Firmado', description: 'El documento ha sido legalizado y archivado.' });
                setSelectedMemo(null);
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: memoRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                }));
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    const handleReject = async () => {
        if (!selectedMemo || !firestore || !defense.trim()) {
            toast({ variant: 'destructive', title: 'Comentario requerido', description: 'Debe ingresar un motivo para el rechazo.' });
            return;
        }

        setIsSaving(true);
        const memoRef = doc(firestore, 'memorandums', selectedMemo.id);
        const updateData = {
            status: 'rejected',
            defense: defense.trim()
        };

        updateDoc(memoRef, updateData)
            .then(() => {
                toast({ title: 'Documento Rechazado', description: 'Su descargo ha sido registrado oficialmente.' });
                setSelectedMemo(null);
            })
            .catch(async (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: memoRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                }));
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    if (profileLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Mis Documentos</h1>
                    <p className="text-muted-foreground">Recepción y firma de memorandos y comunicaciones oficiales.</p>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">Código</TableHead>
                                <TableHead>Tipo de Documento</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Motivo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {memosLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <LoaderCircle className="animate-spin inline-block mr-2" /> Cargando documentos...
                                    </TableCell>
                                </TableRow>
                            ) : sortedMemos.length > 0 ? (
                                sortedMemos.map(memo => (
                                    <TableRow key={memo.id} className="group hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-mono text-xs font-bold">{memo.code}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-blue-500" />
                                                <span className="font-medium">{memo.type}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(memo.createdAt, 'dd/MM/yyyy')}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate italic text-xs">
                                            {memo.reason}
                                        </TableCell>
                                        <TableCell>
                                            {memo.status === 'signed' ? (
                                                <Badge className="bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Firmado</Badge>
                                            ) : memo.status === 'rejected' ? (
                                                <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rechazado</Badge>
                                            ) : memo.status === 'read' ? (
                                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">Leído</Badge>
                                            ) : (
                                                <Badge variant="outline" className="animate-pulse border-blue-500 text-blue-600">Pendiente</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all" onClick={() => handleOpenMemo(memo)}>
                                                {memo.type === "Memorando de Llamado de Atención" && (memo.status !== 'signed' && memo.status !== 'rejected') ? 'Gestionar' : 'Ver'}
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="h-12 w-12 opacity-20" />
                                            <p>No tienes documentos registrados en tu historial.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!selectedMemo} onOpenChange={(open) => !open && setSelectedMemo(null)}>
                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                    {selectedMemo && (
                        <>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <DialogHeader>
                                    <div className="text-center space-y-1">
                                        <h2 className="text-lg font-black text-slate-900 uppercase">
                                            {selectedMemo.targetUserCargo?.includes('GUARDIA') ? 'CADENVILL SECURITY' : 'GRUPO SUDINCO'}
                                        </h2>
                                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Sistema de Gestión Documental – Performa</p>
                                    </div>
                                </DialogHeader>

                                <div className="space-y-6 bg-white p-8 border rounded-lg shadow-sm font-serif text-slate-800">
                                    <div className="flex justify-between text-sm">
                                        <div className="space-y-1">
                                            <p><span className="font-bold">Código:</span> {selectedMemo.code}</p>
                                            <p><span className="font-bold">Fecha:</span> {format(selectedMemo.createdAt, "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-sm">
                                        <p><span className="font-bold">PARA:</span> {selectedMemo.targetUserName}</p>
                                        <p><span className="font-bold">CARGO:</span> {selectedMemo.targetUserCargo}</p>
                                        <p><span className="font-bold">PUESTO:</span> {currentUserProfile?.ubicacion || 'N/A'}</p>
                                    </div>

                                    <div className="border-y py-2">
                                        <p className="font-bold text-sm">ASUNTO: {selectedMemo.type} – {selectedMemo.reason}</p>
                                    </div>

                                    <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[150px]">
                                        {selectedMemo.content}
                                    </div>

                                    <div className="pt-10 grid grid-cols-2 gap-12">
                                        <div className="text-center border-t pt-2">
                                            <div className="h-24 flex flex-col items-center justify-center mt-1">
                                                {selectedMemo.issuerSignature && (
                                                    <img src={selectedMemo.issuerSignature} alt="Firma Emisor" className="h-12 mb-1 opacity-90" />
                                                )}
                                                <p className="font-bold text-[11px] text-primary leading-tight">{selectedMemo.issuerName}</p>
                                                <p className="text-[9px] text-muted-foreground uppercase leading-tight">{selectedMemo.issuerCargo}</p>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Firma del Emisor</p>
                                        </div>
                                        <div className="text-center border-t pt-2">
                                            <div className="h-24 flex flex-col items-center justify-center mt-1">
                                                {selectedMemo.signature ? (
                                                    <>
                                                        <img src={selectedMemo.signature} alt="Firma Colaborador" className="h-12 mb-1 opacity-90" />
                                                        <p className="font-bold text-[11px] text-primary leading-tight">{selectedMemo.targetUserName}</p>
                                                        <p className="text-[9px] text-muted-foreground uppercase leading-tight">{selectedMemo.targetUserCargo}</p>
                                                    </>
                                                ) : (
                                                    selectedMemo.type === "Memorando de Llamado de Atención" ? (
                                                        selectedMemo.status === 'rejected' ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <XCircle className="h-6 w-6 text-red-500" />
                                                                <span className="text-[10px] font-bold text-red-600">RECHAZADO</span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] text-muted-foreground italic mt-4">Pendiente de firma</p>
                                                        )
                                                    ) : (
                                                        <Badge variant="outline" className="text-[8px] h-4 mt-4">No requiere firma</Badge>
                                                    )
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Firma del Colaborador</p>
                                        </div>
                                    </div>
                                </div>

                                {selectedMemo.type === "Memorando de Llamado de Atención" && 
                                 selectedMemo.status !== 'signed' && 
                                 selectedMemo.status !== 'rejected' && (
                                    <div className="bg-slate-50 p-6 rounded-lg border-2 border-dashed border-slate-200">
                                        {interactionMode === 'view' && (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-primary font-bold">
                                                    <AlertTriangle className="h-5 w-5" />
                                                    <h3>Acción Requerida</h3>
                                                </div>
                                                <p className="text-sm text-muted-foreground">Por favor, lea atentamente el documento y seleccione una opción:</p>
                                                <div className="flex gap-4">
                                                    <Button variant="outline" className="flex-1 gap-2 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => setInteractionMode('reject')}>
                                                        <XCircle className="h-4 w-4" /> Rechazar y Presentar Descargo
                                                    </Button>
                                                    <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => setInteractionMode('sign')}>
                                                        <FileSignature className="h-4 w-4" /> Aceptar y Firmar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {interactionMode === 'reject' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-bold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Justificación del Rechazo</Label>
                                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setInteractionMode('view')}>Cancelar</Button>
                                                </div>
                                                <Textarea 
                                                    placeholder="Escriba aquí los motivos por los cuales no acepta este memorando..."
                                                    value={defense}
                                                    onChange={(e) => setDefense(e.target.value)}
                                                    className="min-h-[100px] bg-white"
                                                />
                                                <Button className="w-full bg-red-600 hover:bg-red-700" disabled={!defense.trim() || isSaving} onClick={handleReject}>
                                                    {isSaving ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                                                    Enviar Descargo y Rechazar
                                                </Button>
                                            </div>
                                        )}

                                        {interactionMode === 'sign' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="flex justify-between items-center">
                                                    <Label className="font-bold flex items-center gap-2"><FileSignature className="h-4 w-4" /> Firma Manuscrita Digital</Label>
                                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setInteractionMode('view')}>Cancelar</Button>
                                                </div>
                                                <div className={cn(
                                                    "border-2 rounded-lg bg-white relative overflow-hidden transition-all",
                                                    isLocked ? "bg-slate-50 border-primary/20" : "border-dashed border-slate-300"
                                                )}>
                                                    <canvas 
                                                        ref={canvasRef}
                                                        width={600}
                                                        height={150}
                                                        className={cn("w-full h-[100px] cursor-crosshair touch-none", isLocked && "pointer-events-none opacity-50")}
                                                        onMouseDown={startDrawing}
                                                        onMouseMove={draw}
                                                        onMouseUp={() => setIsDrawing(false)}
                                                        onMouseOut={() => setIsDrawing(false)}
                                                        onTouchStart={startDrawing}
                                                        onTouchMove={draw}
                                                        onTouchEnd={() => setIsDrawing(false)}
                                                    />
                                                    {!isLocked && (
                                                        <Button variant="ghost" size="icon" className="absolute bottom-1 right-1 h-6 w-6" onClick={clearCanvas}>
                                                            <Eraser className="h-3 w-3 text-slate-400" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant={isLocked ? "outline" : "secondary"} className="flex-1 h-8 text-xs font-bold uppercase" onClick={() => setIsLocked(!isLocked)}>
                                                        {isLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                                        {isLocked ? "Modificar Firma" : "Bloquear y Certificar"}
                                                    </Button>
                                                    <Button className="flex-1 h-8 text-xs font-bold uppercase bg-green-600 hover:bg-green-700" disabled={!isLocked || isSaving} onClick={handleSign}>
                                                        {isSaving ? <LoaderCircle className="animate-spin mr-2 h-3 w-3" /> : <CheckCircle className="mr-2 h-3 w-3" />}
                                                        Confirmar Firma
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="p-4 border-t bg-slate-50">
                                <Button variant="outline" onClick={() => setSelectedMemo(null)}>Cerrar Vista</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}