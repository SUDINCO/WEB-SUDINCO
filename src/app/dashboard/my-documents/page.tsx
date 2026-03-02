
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { collection, doc, updateDoc, query, where } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';
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
    Send,
    ShieldCheck,
    Paperclip,
    Download
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

const LOGO_URL = 'https://i.postimg.cc/B6HGbmCz/LOGO-CADENVILL.png';

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
                toast({ title: 'Documento Firmado', description: 'El documento ha sido archivado exitosamente.' });
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
            toast({ variant: 'destructive', title: 'Justificación requerida', description: 'Debe ingresar el motivo de su descargo.' });
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
                toast({ title: 'Respuesta Registrada', description: 'Su descargo ha sido enviado a la administración.' });
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
        return <div className="flex h-full items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mis Documentos</h1>
                    <p className="text-sm text-muted-foreground">Expediente digital de comunicaciones institucionales.</p>
                </div>
            </div>

            <Card className="shadow-md overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="font-black uppercase text-[10px] tracking-widest px-4 whitespace-nowrap">Código</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] tracking-widest px-4 whitespace-nowrap">Tipo</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] tracking-widest px-4 whitespace-nowrap">Fecha</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] tracking-widest px-4 whitespace-nowrap">Estado</TableHead>
                                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest px-4">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {memosLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-32 text-center"><LoaderCircle className="animate-spin inline-block mr-2" /> Cargando...</TableCell></TableRow>
                                ) : sortedMemos.length > 0 ? (
                                    sortedMemos.map(memo => (
                                        <TableRow key={memo.id} className="group hover:bg-slate-50 transition-all cursor-pointer" onClick={() => handleOpenMemo(memo)}>
                                            <TableCell className="font-mono text-[10px] font-bold text-primary px-4 whitespace-nowrap">{memo.code}</TableCell>
                                            <TableCell className="px-4">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3 w-3 text-blue-500" />
                                                    <span className="font-bold text-[10px] uppercase text-slate-700 truncate max-w-[120px]">{memo.type}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[10px] text-slate-500 px-4 whitespace-nowrap">
                                                {format(memo.createdAt, 'dd/MM/yy')}
                                            </TableCell>
                                            <TableCell className="px-4 text-center">
                                                {memo.status === 'signed' ? (
                                                    <Badge className="bg-emerald-600 text-[8px] font-black uppercase">Firmado</Badge>
                                                ) : memo.status === 'rejected' ? (
                                                    <Badge variant="destructive" className="text-[8px] font-black uppercase">Descargo</Badge>
                                                ) : memo.status === 'read' ? (
                                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[8px] font-black uppercase">Leído</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="animate-pulse border-blue-500 text-blue-600 text-[8px] font-black uppercase">Nuevo</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right px-4">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-primary hover:text-white" onClick={(e) => { e.stopPropagation(); handleOpenMemo(memo); }}>
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground text-xs italic">No tienes documentos registrados aún.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedMemo} onOpenChange={(open) => !open && setSelectedMemo(null)}>
                <DialogContent className="max-w-5xl max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-100 border-none w-[95vw]">
                    {selectedMemo && (
                        <>
                            <div className="flex-1 overflow-y-auto p-2 sm:p-10">
                                <div className="bg-white shadow-2xl mx-auto max-w-2xl min-h-full border border-slate-200 relative flex flex-col">
                                    <div className="w-full relative h-[80px] sm:h-[140px] border-b overflow-hidden bg-white">
                                        <Image 
                                            src={LOGO_URL} 
                                            alt="Header Cadenvill Security" 
                                            fill
                                            className="object-fill object-center"
                                            unoptimized
                                        />
                                    </div>

                                    <div className="px-4 sm:px-10 py-6 sm:py-8 space-y-6 sm:space-y-8 flex-1 font-serif text-slate-800">
                                        <div className="text-center space-y-1">
                                            <h2 className="text-base sm:text-xl font-black tracking-tight text-slate-900 border-b-2 border-primary inline-block px-4 pb-1 uppercase italic">
                                                Memorando Institucional - {selectedMemo.targetUserEmpresa || 'GENERAL'}
                                            </h2>
                                            <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 tracking-[0.2em] uppercase">Control Interno</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Código</p>
                                                <p className="font-bold text-slate-800 truncate">{selectedMemo.code}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Emisión</p>
                                                <p className="font-bold text-slate-800">{format(selectedMemo.createdAt, "d 'de' MMMM, yyyy", { locale: es })}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">PARA</p>
                                                <p className="font-bold text-slate-800 uppercase truncate">{selectedMemo.targetUserName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Cargo</p>
                                                <p className="font-bold text-slate-800 uppercase truncate">{selectedMemo.targetUserCargo}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Fecha Evento</p>
                                                <p className="font-bold text-slate-800">{selectedMemo.eventDate ? format(parseISO(selectedMemo.eventDate), "d 'de' MMMM, yyyy", { locale: es }) : 'N/A'}</p>
                                            </div>
                                        </div>

                                        <div className="border-y py-3">
                                            <p className="font-black text-[10px] sm:text-sm uppercase tracking-tight">ASUNTO: {selectedMemo.type} – {selectedMemo.reason}</p>
                                        </div>

                                        <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[150px] px-1 text-slate-700">
                                            {selectedMemo.content}
                                        </div>

                                        <div className="pt-8 sm:pt-12 grid grid-cols-2 gap-8 sm:gap-16">
                                            <div className="flex flex-col items-center space-y-2">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-1 w-full text-center">Emisor</p>
                                                <div className="w-full h-16 sm:h-24 flex flex-col items-center justify-center text-center">
                                                    {selectedMemo.issuerSignature && (
                                                        <div className="mb-2">
                                                            <img src={selectedMemo.issuerSignature} alt="Firma Emisor" className="h-8 sm:h-12 object-contain opacity-90 mx-auto" />
                                                            <p className="font-black text-[9px] sm:text-[11px] text-slate-900 leading-tight uppercase truncate max-w-full">{selectedMemo.issuerName}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center space-y-2">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-1 w-full text-center">Colaborador</p>
                                                <div className="w-full h-16 sm:h-24 flex flex-col items-center justify-center text-center">
                                                    {selectedMemo.signature ? (
                                                        <div className="mb-2">
                                                            <img src={selectedMemo.signature} alt="Firma Colaborador" className="h-8 sm:h-12 object-contain opacity-90 mx-auto" />
                                                            <p className="font-black text-[9px] sm:text-[11px] text-slate-900 leading-tight uppercase truncate max-w-full">{selectedMemo.targetUserName}</p>
                                                        </div>
                                                    ) : (
                                                        selectedMemo.status === 'rejected' ? (
                                                            <Badge variant="destructive" className="rotate-[-5deg] text-[10px]">RECHAZADO</Badge>
                                                        ) : (
                                                            <p className="text-[8px] text-muted-foreground italic uppercase opacity-50">Pendiente</p>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {selectedMemo.type === "Memorando de Llamado de Atención" && 
                                 selectedMemo.status !== 'signed' && 
                                 selectedMemo.status !== 'rejected' && (
                                    <div className="max-w-2xl mx-auto mt-8 bg-white p-4 sm:p-8 rounded-xl shadow-xl border-2 border-slate-200">
                                        {interactionMode === 'view' && (
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3 text-amber-600">
                                                    <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 shrink-0" />
                                                    <div>
                                                        <h3 className="font-black uppercase tracking-tighter text-base sm:text-xl leading-tight">Acción Requerida</h3>
                                                        <p className="text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Notificación Disciplinaria</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-3">
                                                    <Button className="w-full h-12 gap-2 bg-emerald-600 hover:bg-emerald-700 font-black uppercase text-xs tracking-widest" onClick={() => setInteractionMode('sign')}>
                                                        <FileSignature className="h-4 w-4" /> Aceptar y Firmar
                                                    </Button>
                                                    <Button variant="outline" className="w-full h-12 gap-2 border-red-200 hover:bg-red-50 hover:text-red-700 font-black uppercase text-xs tracking-widest" onClick={() => setInteractionMode('reject')}>
                                                        <XCircle className="h-4 w-4" /> Registrar Descargo
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {interactionMode === 'reject' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-black uppercase text-[10px] sm:text-xs tracking-widest text-red-700 flex items-center gap-2">
                                                        <MessageSquare className="h-4 w-4" /> Justificación del Descargo *
                                                    </Label>
                                                    <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase" onClick={() => setInteractionMode('view')}>Volver</Button>
                                                </div>
                                                <Textarea 
                                                    placeholder="Escriba aquí los motivos por los cuales no acepta este memorando..."
                                                    value={defense}
                                                    onChange={(e) => setDefense(e.target.value)}
                                                    className="min-h-[120px] bg-slate-50 text-sm"
                                                />
                                                <Button className="w-full h-11 bg-red-600 hover:bg-red-700 font-black uppercase text-xs tracking-widest" disabled={!defense.trim() || isSaving} onClick={handleReject}>
                                                    {isSaving ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                                                    Confirmar Descargo
                                                </Button>
                                            </div>
                                        )}

                                        {interactionMode === 'sign' && (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                <div className="flex justify-between items-center">
                                                    <Label className="font-black uppercase text-[10px] sm:text-xs tracking-widest text-emerald-700 flex items-center gap-2">
                                                        <FileSignature className="h-4 w-4" /> Firma Digital *
                                                    </Label>
                                                    <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase" onClick={() => setInteractionMode('view')}>Volver</Button>
                                                </div>
                                                
                                                <div className={cn(
                                                    "p-3 sm:p-6 rounded-xl border-2 transition-all",
                                                    isLocked ? "bg-slate-50 border-emerald-500/20" : "bg-white border-dashed border-slate-300"
                                                )}>
                                                    <div className="bg-white border rounded-lg relative overflow-hidden">
                                                        <canvas 
                                                            ref={canvasRef}
                                                            width={600}
                                                            height={150}
                                                            className={cn("w-full h-[100px] cursor-crosshair touch-none", isLocked && "pointer-events-none opacity-50 grayscale")}
                                                            onMouseDown={startDrawing}
                                                            onMouseMove={draw}
                                                            onMouseUp={() => setIsDrawing(false)}
                                                            onMouseOut={() => setIsDrawing(false)}
                                                            onTouchStart={startDrawing}
                                                            onTouchMove={draw}
                                                            onTouchEnd={() => setIsDrawing(false)}
                                                        />
                                                        {!isLocked && (
                                                            <Button variant="ghost" size="icon" className="absolute bottom-2 right-2 h-8 w-8" onClick={clearCanvas}>
                                                                <Eraser className="h-4 w-4 text-slate-400" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="mt-4 flex flex-col gap-2">
                                                        <Button variant={isLocked ? "outline" : "secondary"} className="w-full h-10 text-[10px] font-black uppercase tracking-widest" onClick={() => setIsLocked(!isLocked)}>
                                                            {isLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                                            {isLocked ? "Modificar" : "Certificar Firma"}
                                                        </Button>
                                                        <Button className="w-full h-10 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700" disabled={!isLocked || isSaving} onClick={handleSign}>
                                                            {isSaving ? <LoaderCircle className="animate-spin mr-2 h-3 w-3" /> : <CheckCircle className="mr-2 h-3 w-3" />}
                                                            Finalizar y Firmar
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="bg-slate-900 p-4 border-t border-slate-800">
                                <Button variant="ghost" onClick={() => setSelectedMemo(null)} className="text-white hover:bg-white/10 font-bold uppercase text-[10px] w-full">Cerrar</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
