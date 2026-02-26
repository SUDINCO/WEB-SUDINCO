
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Check, Eraser, LoaderCircle, Shield, User, Camera, X, CheckCircle, Lock, Unlock, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import type { UserProfile, EquipmentHandover } from '@/lib/types';
import Image from 'next/image';

interface HandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: string;
  currentUser: UserProfile;
  suggestedGuard: UserProfile | null;
  onSuccess: () => void;
  mode?: 'create' | 'approve';
  existingHandover?: EquipmentHandover;
}

const EQUIPMENT_CATALOG = ['Radio', 'Chaleco', 'Arma de Fuego', 'Celular', 'Bitácora'];

const ISSUE_TYPES_MAP: Record<string, string[]> = {
  'Radio': ['Dañado / No funciona', 'Faltante', 'Pantalla rota', 'Botones trabados', 'Batería agotada / No carga', 'Antena dañada', 'Otro (especificar en notas)'],
  'Chaleco': ['Roto / Rasgado', 'Faltante', 'Mal estado estético', 'Sucio', 'Velcro / Cierres dañados', 'Otro (especificar en notas)'],
  'Arma de Fuego': ['Mal estado mecánico', 'Faltante', 'Sin munición completa', 'Seguro dañado', 'Óxido / Falta limpieza', 'Otro (especificar en notas)'],
  'Celular': ['Pantalla rota', 'Faltante', 'No carga / Batería inflada', 'Botones trabados', 'Cámara dañada', 'Otro (especificar en notas)'],
  'Bitácora': ['Hojas faltantes', 'Faltante', 'Mal estado / Mojada', 'Sin espacio para registros', 'Otro (especificar en notas)'],
  'default': ['Dañado / No funciona', 'Faltante', 'Mal estado estético', 'Otro (especificar en notas)']
};

export function HandoverDialog({ open, onOpenChange, location, currentUser, suggestedGuard, onSuccess, mode = 'create', existingHandover }: HandoverDialogProps) {
  const isApproving = mode === 'approve';
  const [items, setItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (open) {
      if (isApproving && existingHandover) {
        setItems(existingHandover.items);
      } else {
        setItems(EQUIPMENT_CATALOG.map(name => ({ name, status: 'good', issueType: '', notes: '', photoUrl: null })));
      }
      setIsLocked(false);
      setTimeout(() => clearCanvas(), 100);
    }
  }, [open, isApproving, existingHandover]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleStatusChange = (index: number, status: 'good' | 'issue') => {
    if (isApproving) return;
    const newItems = [...items];
    newItems[index].status = status;
    if (status === 'good') {
      newItems[index].issueType = '';
      newItems[index].photoUrl = null;
    }
    setItems(newItems);
  };

  const handleItemUpdate = (index: number, field: string, value: any) => {
    if (isApproving) return;
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && activePhotoIndex !== null) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX = 1024;
          if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
          else if (height > MAX) { width *= MAX / height; height = MAX; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            handleItemUpdate(activePhotoIndex, 'photoUrl', canvas.toDataURL('image/jpeg', 0.7));
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
    setActivePhotoIndex(null);
  };

  const startDrawing = (e: any) => {
    if (isLocked) return;
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: any) => {
    if (!isDrawing || isLocked || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    canvasRef.current?.getContext('2d')?.beginPath();
  };

  const handleSubmit = async () => {
    if (!firestore || !suggestedGuard) return;
    if (!isLocked) {
      toast({ variant: 'destructive', title: 'Firma requerida', description: 'Debe certificar su firma para continuar.' });
      return;
    }

    setIsSubmitting(true);
    const signature = canvasRef.current!.toDataURL('image/png');

    try {
      if (isApproving && existingHandover) {
        const docRef = doc(firestore, 'equipmentHandovers', existingHandover.id);
        await updateDoc(docRef, {
          status: 'approved',
          outgoingSignature: signature,
          approvalTimestamp: Date.now()
        });
        toast({ title: 'Acta Aprobada', description: 'Has validado la entrega de equipos correctamente.' });
      } else {
        await addDoc(collection(firestore, 'equipmentHandovers'), {
          location,
          date: new Date().toISOString().split('T')[0],
          incomingGuardId: currentUser.id,
          incomingGuardName: `${currentUser.nombres} ${currentUser.apellidos}`,
          outgoingGuardId: suggestedGuard.id,
          outgoingGuardName: `${suggestedGuard.nombres} ${suggestedGuard.apellidos}`,
          items,
          incomingSignature: signature,
          status: 'pending',
          timestamp: Date.now(),
        });
        toast({ title: 'Acta Enviada', description: 'El acta ha sido enviada para la aprobación del relevo saliente.' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving handover:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar el acta.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
        
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2 text-2xl text-primary font-bold">
            <Shield className="h-7 w-7" />
            {isApproving ? 'APROBACIÓN DE RELEVO DE PUESTO' : 'ACTA DE RELEVO - RECEPCIÓN DE PUESTO'}
          </DialogTitle>
          <DialogDescription>
            {isApproving ? 'Revise el estado reportado por su relevo y firme para autorizar la entrega.' : 'Realice el checklist de los equipos recibidos y envíe para aprobación del guardia saliente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-6">
          <Card className={cn("transition-all", isApproving ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200")}>
            <CardContent className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-full", isApproving ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600")}>
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider">{isApproving ? 'Entregado por (Usted)' : 'Recibido por (Usted)'}</p>
                  <p className="font-bold">{currentUser.nombres} {currentUser.apellidos}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Compañero de Relevo</p>
                <p className="font-semibold">{isApproving ? existingHandover?.incomingGuardName : (suggestedGuard ? `${suggestedGuard.nombres} ${suggestedGuard.apellidos}` : '...')}</p>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">Equipo</TableHead>
                  <TableHead className="text-center font-bold">Estado</TableHead>
                  <TableHead className="font-bold">Novedad / Notas</TableHead>
                  <TableHead className="w-[100px] text-center font-bold">Evidencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.name} className={cn(item.status === 'issue' && "bg-red-50/30")}>
                    <TableCell className="font-semibold">{item.name}</TableCell>
                    <TableCell>
                      <RadioGroup disabled={isApproving} value={item.status} onValueChange={(val) => handleStatusChange(index, val as 'good' | 'issue')} className="flex justify-center gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="good" id={`good-${index}`} />
                          <Label htmlFor={`good-${index}`} className="text-xs cursor-pointer">OPERATIVO</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="issue" id={`issue-${index}`} className="text-red-600" />
                          <Label htmlFor={`issue-${index}`} className="text-xs cursor-pointer text-red-600 font-bold">NOVEDAD</Label>
                        </div>
                      </RadioGroup>
                    </TableCell>
                    <TableCell>
                      {item.status === 'issue' ? (
                        <div className="flex flex-col gap-1">
                          {isApproving ? (
                            <p className="text-xs font-bold text-red-700">{item.issueType}: <span className="font-normal italic">"{item.notes}"</span></p>
                          ) : (
                            <>
                              <Select value={item.issueType} onValueChange={(v) => handleItemUpdate(index, 'issueType', v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                                <SelectContent>{(ISSUE_TYPES_MAP[item.name] || ISSUE_TYPES_MAP['default']).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                              </Select>
                              <Input placeholder="Notas..." value={item.notes} onChange={(e) => handleItemUpdate(index, 'notes', e.target.value)} className="h-7 text-xs" />
                            </>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Sin novedad</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.photoUrl && (
                        <div className="relative inline-block">
                          <Image src={item.photoUrl} alt="Evidencia" width={40} height={40} className="rounded border object-cover" unoptimized />
                        </div>
                      )}
                      {!isApproving && item.status === 'issue' && !item.photoUrl && (
                        <Button variant="outline" size="icon" className="h-8 w-8 border-dashed" onClick={() => { setActivePhotoIndex(index); fileInputRef.current?.click(); }}><Camera className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className={cn("p-4 rounded-xl border space-y-3", isLocked ? "bg-muted border-primary/20" : "bg-slate-50")}>
            <div className="flex justify-between items-center">
              <Label className="font-bold flex items-center gap-2"><Check className="h-4 w-4" /> SU FIRMA DIGITAL OBLIGATORIA</Label>
              {isLocked && <Badge>CERTIFICADA</Badge>}
            </div>
            <div className="border rounded-lg bg-white relative">
              <canvas
                ref={canvasRef} width={400} height={120}
                className={cn("w-full h-[120px] cursor-crosshair touch-none", isLocked && "pointer-events-none opacity-50")}
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
              />
              {!isLocked && <Button variant="ghost" size="icon" className="absolute bottom-1 right-1" onClick={clearCanvas}><Eraser className="h-4 w-4" /></Button>}
            </div>
            <Button variant={isLocked ? "outline" : "default"} className="w-full gap-2" onClick={() => setIsLocked(!isLocked)}>
              {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {isLocked ? "Modificar Firma" : "Certificar Firma"}
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !isLocked} size="lg" className="min-w-[200px]">
            {isSubmitting ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
            {isApproving ? 'Aprobar y Finalizar Relevo' : 'Enviar para Aprobación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
