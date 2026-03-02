
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
    Clock, 
    CheckCircle, 
    AlertTriangle, 
    Eye,
    Send,
    LoaderCircle,
    Eraser,
    Lock,
    Unlock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Memorandum, UserProfile } from '@/lib/types';

export default function MyDocumentsPage() {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    const [selectedMemo, setSelectedMemo] = useState<Memorandum | null>(null);
    const [isSignModalOpen, setIsSignModalOpen] = useState(false);
    const [defense, setDefense] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // Signature State
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    const { data: workers } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    
    const currentUserProfile = useMemo(() => {
        if (!authUser || !workers) return null;
        return workers.find(w => w.email?.toLowerCase() === authUser.email?.toLowerCase());
    }, [authUser, workers]);

    const memosQuery = useMemo(() => {
        if (!firestore || !currentUserProfile) return null;
        return query(
            collection(firestore, 'memorandums'), 
            where('targetUserId', '==', currentUserProfile.id),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, currentUserProfile]);

    const { data: myMemos, isLoading: memosLoading } = useCollection<Memorandum>(memosQuery);

    const handleOpenMemo = async (memo: Memorandum) => {
        setSelectedMemo(memo);
        // Mark as read if it's the first time
        if (memo.status === 'issued' && firestore) {
            await updateDoc(doc(firestore, 'memorandums', memo.id), {
                status: 'read',
                readAt: Date.now()
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

        try {
            await updateDoc(doc(firestore, 'memorandums', selectedMemo.id), {
                status: 'signed',
                signedAt: Date.now(),
                signature: signature,
                defense: defense.trim() || null
            });
            toast({ title: 'Documento Firmado', description: 'El documento ha sido legalizado y archivado en tu expediente.' });
            setIsSignModalOpen(false);
            setSelectedMemo(null);
            setDefense("");
            setIsLocked(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo firmar el documento.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Mis Documentos</h1>
                    <p className="text-muted-foreground">Gestión de comunicaciones oficiales, memorandos y actas recibidas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {memosLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="animate-pulse h-48 bg-muted" />
                    ))
                ) : myMemos && myMemos.length > 0 ? (
                    myMemos.map(memo => (
                        <Card key={memo.id} className={cn(
                            "hover:shadow-lg transition-all border-l-4",
                            memo.status === 'signed' ? 'border-l-green-500' : 'border-l-blue-500'
                        )}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline">{memo.code}</Badge>
                                    {memo.status === 'signed' ? (
                                        <Badge className="bg-green-100 text-green-800">Firmado</Badge>
                                    ) : (
                                        <Badge variant="destructive" className="animate-pulse">Pendiente</Badge>
                                    )}
                                </div>
                                <CardTitle className="text-base mt-2">{memo.type}</CardTitle>
                                <CardDescription>{format(memo.createdAt, 'PPP', { locale: es })}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <p className="text-sm font-semibold mb-1">Causal:</p>
                                <p className="text-sm text-muted-foreground line-clamp-2">{memo.causalTitle}</p>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button variant="secondary" className="w-full gap-2" onClick={() => handleOpenMemo(memo)}>
                                    <Eye className="h-4 w-4" /> Ver y Gestionar
                                </Button>
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                        <p className="text-muted-foreground">No tienes documentos pendientes ni archivados.</p>
                    </div>
                )}
            </div>

            {/* Memo Viewer Dialog */}
            <Dialog open={!!selectedMemo} onOpenChange={(open) => !open && setSelectedMemo(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedMemo && (
                        <>
                            <DialogHeader>
                                <div className="flex justify-between items-center pr-8">
                                    <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">
                                        Documento Oficial: {selectedMemo.code}
                                    </DialogTitle>
                                    <Badge variant={selectedMemo.status === 'signed' ? 'default' : 'secondary'}>
                                        {selectedMemo.status === 'signed' ? 'ARCHIVADO' : 'PENDIENTE DE FIRMA'}
                                    </Badge>
                                </div>
                                <DialogDescription>
                                    Emitido el {format(selectedMemo.createdAt, 'PPPP', { locale: es })}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="py-6 space-y-8 bg-white p-8 border rounded-lg shadow-inner">
                                <div className="grid grid-cols-2 gap-8 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Emisor</p>
                                        <p className="font-bold text-primary">{selectedMemo.issuerName}</p>
                                        <p className="text-muted-foreground text-xs">{selectedMemo.issuerCargo}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Destinatario</p>
                                        <p className="font-bold">{selectedMemo.targetUserName}</p>
                                        <p className="text-muted-foreground text-xs">{selectedMemo.targetUserCargo}</p>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <p className="font-bold underline uppercase tracking-widest text-xs">Asunto: {selectedMemo.type} - {selectedMemo.causalTitle}</p>
                                    <div className="text-base leading-relaxed text-slate-800 whitespace-pre-wrap font-serif">
                                        {selectedMemo.content}
                                    </div>
                                </div>

                                {selectedMemo.signedAt && (
                                    <div className="pt-10 border-t space-y-6">
                                        <div className="grid grid-cols-2 gap-12 items-end">
                                            <div className="text-center space-y-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Firma del Colaborador</p>
                                                {selectedMemo.signature && (
                                                    <div className="bg-slate-50 border rounded p-2 h-24 flex items-center justify-center">
                                                        <img src={selectedMemo.signature} alt="Firma" className="max-h-full object-contain" />
                                                    </div>
                                                )}
                                                <p className="text-[10px] font-medium">{format(selectedMemo.signedAt, 'dd/MM/yyyy HH:mm')}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Descargo / Comentario</p>
                                                <div className="bg-slate-50 border rounded p-3 min-h-[96px] text-xs italic">
                                                    {selectedMemo.defense || "Sin comentarios adicionales registrados."}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="pt-6 border-t mt-6">
                                <Button variant="outline" onClick={() => setSelectedMemo(null)}>Cerrar Vista</Button>
                                {selectedMemo.status !== 'signed' && (
                                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setIsSignModalOpen(true)}>
                                        <FileSignature className="h-4 w-4" /> Proceder a Firma
                                    </Button>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Signing Dialog */}
            <Dialog open={isSignModalOpen} onOpenChange={setIsSignModalOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Certificación Digital de Firma</DialogTitle>
                        <DialogDescription>
                            Al firmar, usted confirma que ha leído y comprendido el contenido del documento. Puede incluir un descargo escrito si lo considera necesario.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label>Descargo / Comentarios (Opcional)</Label>
                            <Textarea 
                                placeholder="Escriba aquí su respuesta o aclaración respecto al memorando..."
                                value={defense}
                                onChange={(e) => setDefense(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="font-bold">Firma Manuscrita Digital</Label>
                                {isLocked && <Badge className="bg-primary">CERTIFICADA</Badge>}
                            </div>
                            <div className={cn(
                                "border-2 rounded-lg bg-white relative overflow-hidden transition-all",
                                isLocked ? "border-primary/50 bg-slate-50" : "border-dashed border-slate-300 shadow-inner"
                            )}>
                                <canvas 
                                    ref={canvasRef}
                                    width={600}
                                    height={200}
                                    className={cn(
                                        "w-full h-[150px] cursor-crosshair touch-none",
                                        isLocked && "pointer-events-none opacity-50"
                                    )}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={() => setIsDrawing(false)}
                                    onMouseOut={() => setIsDrawing(false)}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={() => setIsDrawing(false)}
                                />
                                {!isLocked && (
                                    <Button variant="ghost" size="icon" className="absolute bottom-2 right-2" onClick={clearCanvas}>
                                        <Eraser className="h-4 w-4 text-slate-400" />
                                    </Button>
                                )}
                            </div>
                            <Button 
                                variant={isLocked ? "outline" : "default"} 
                                className="w-full gap-2" 
                                onClick={() => setIsLocked(!isLocked)}
                            >
                                {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                {isLocked ? "Modificar Firma" : "Bloquear y Certificar Firma"}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsSignModalOpen(false)}>Cancelar</Button>
                        <Button 
                            className="bg-green-600 hover:bg-green-700 min-w-[150px]" 
                            disabled={!isLocked || isSaving}
                            onClick={handleSign}
                        >
                            {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <FileSignature className="mr-2 h-4 w-4" />}
                            Legalizar Firma
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
