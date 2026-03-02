
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { collection, doc, updateDoc, query, where } from 'firebase/firestore';
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
    CheckCircle, 
    Eye,
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

    // Get current user profile directly by ID
    const userDocRef = useMemo(() => {
        if (!firestore || !authUser?.uid) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [firestore, authUser?.uid]);

    const { data: currentUserProfile, isLoading: profileLoading } = useDoc<UserProfile>(userDocRef);

    // Simplificamos la query eliminando el orderBy para evitar errores de índice compuesto
    // El ordenamiento se hará en memoria (sortedMemos)
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
        // Mark as read if it's the first time and it's not a warning memo (which needs signature)
        if (memo.status === 'issued' && firestore) {
            const newStatus = memo.type === "Memorando de Llamado de Atención" ? 'issued' : 'read';
            await updateDoc(doc(firestore, 'memorandums', memo.id), {
                status: newStatus,
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
            toast({ title: 'Documento Firmado', description: 'El documento ha sido legalizado y archivado.' });
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
                    <p className="text-muted-foreground">Memorandos y comunicaciones oficiales recibidas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {memosLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="animate-pulse h-48 bg-muted" />
                    ))
                ) : sortedMemos.length > 0 ? (
                    sortedMemos.map(memo => (
                        <Card key={memo.id} className={cn(
                            "hover:shadow-lg transition-all border-l-4",
                            memo.status === 'signed' ? 'border-l-green-500' : 'border-l-blue-500'
                        )}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline">{memo.code}</Badge>
                                    {memo.status === 'signed' ? (
                                        <Badge className="bg-green-100 text-green-800">Firmado</Badge>
                                    ) : memo.status === 'read' ? (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">Leído</Badge>
                                    ) : (
                                        <Badge variant="destructive" className="animate-pulse">Pendiente</Badge>
                                    )}
                                </div>
                                <CardTitle className="text-sm mt-2">{memo.type}</CardTitle>
                                <CardDescription>{format(memo.createdAt, 'PPP', { locale: es })}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <p className="text-xs font-semibold mb-1">Motivo:</p>
                                <p className="text-sm text-muted-foreground line-clamp-2">{memo.reason}</p>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button variant="secondary" className="w-full gap-2" onClick={() => handleOpenMemo(memo)}>
                                    <Eye className="h-4 w-4" /> {memo.type === "Memorando de Llamado de Atención" && memo.status !== 'signed' ? 'Ver y Firmar' : 'Ver Documento'}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                        <p className="text-muted-foreground">No tienes documentos pendientes.</p>
                    </div>
                )}
            </div>

            {/* Memo Viewer Dialog */}
            <Dialog open={!!selectedMemo} onOpenChange={(open) => !open && setSelectedMemo(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedMemo && (
                        <>
                            <DialogHeader>
                                <div className="text-center space-y-1">
                                    <h2 className="text-lg font-black text-slate-900 uppercase">
                                        {selectedMemo.targetUserCargo?.includes('GUARDIA') ? 'CADENVILL SECURITY' : 'GRUPO SUDINCO'}
                                    </h2>
                                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Sistema de Gestión Documental – Performa</p>
                                </div>
                            </DialogHeader>

                            <div className="py-6 space-y-6 bg-white p-8 border rounded-lg shadow-inner font-serif text-slate-800">
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

                                <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[200px]">
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
                                                    <p className="text-[10px] text-muted-foreground italic mt-4">Pendiente de firma</p>
                                                ) : (
                                                    <Badge variant="outline" className="text-[8px] h-4" style={{ marginTop: '16px' }}>No requiere firma</Badge>
                                                )
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Firma del Colaborador</p>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="pt-6 border-t mt-6">
                                <Button variant="outline" onClick={() => setSelectedMemo(null)}>Cerrar Vista</Button>
                                {selectedMemo.type === "Memorando de Llamado de Atención" && selectedMemo.status !== 'signed' && (
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
                            Al firmar, usted confirma que ha leído y comprendido el contenido del documento oficial.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label>Descargo / Comentarios (Opcional)</Label>
                            <Textarea 
                                placeholder="Escriba aquí su respuesta o aclaración si lo desea..."
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
