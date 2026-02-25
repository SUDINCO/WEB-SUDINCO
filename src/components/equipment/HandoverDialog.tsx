'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { Check, Eraser, LoaderCircle, Shield, User, Camera, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import Image from 'next/image';

interface HandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: string;
  currentUser: UserProfile;
  suggestedGuard: UserProfile | null;
  onSuccess: () => void;
}

const EQUIPMENT_CATALOG = ['Radio', 'Chaleco', 'Arma de Fuego', 'Celular', 'Bitácora'];
const ISSUE_TYPES = [
  'Dañado / No funciona',
  'Faltante',
  'Mal estado estético',
  'Batería agotada / No carga',
  'Pantalla rota',
  'Botones trabados',
  'Otro (especificar en notas)'
];

interface HandoverItem {
  name: string;
  status: 'good' | 'issue';
  issueType: string;
  notes: string;
  photoUrl: string | null;
}

export function HandoverDialog({ open, onOpenChange, location, currentUser, suggestedGuard, onSuccess }: HandoverDialogProps) {
  const [items, setItems] = useState<HandoverItem[]>(
    EQUIPMENT_CATALOG.map(name => ({ name, status: 'good', issueType: '', notes: '', photoUrl: null }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  
  const outgoingCanvasRef = useRef<HTMLCanvasElement>(null);
  const incomingCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const [isDrawingOutgoing, setIsDrawingOutgoing] = useState(false);
  const [isDrawingIncoming, setIsDrawingIncoming] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(EQUIPMENT_CATALOG.map(name => ({ name, status: 'good', issueType: '', notes: '', photoUrl: null })));
      clearCanvas(outgoingCanvasRef);
      clearCanvas(incomingCanvasRef);
    }
  }, [open]);

  const clearCanvas = (ref: React.RefObject<HTMLCanvasElement>) => {
    const canvas = ref.current;
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
    const newItems = [...items];
    newItems[index].status = status;
    if (status === 'good') {
      newItems[index].issueType = '';
      newItems[index].photoUrl = null;
    }
    setItems(newItems);
  };

  const handleItemUpdate = (index: number, field: keyof HandoverItem, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
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
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            handleItemUpdate(activePhotoIndex, 'photoUrl', dataUrl);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
    setActivePhotoIndex(null);
  };

  const startDrawing = (ref: React.RefObject<HTMLCanvasElement>, setDrawing: (val: boolean) => void, e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true);
    draw(ref, true, e);
  };

  const stopDrawing = (ref: React.RefObject<HTMLCanvasElement>, setDrawing: (val: boolean) => void) => {
    setDrawing(false);
    const canvas = ref.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (ref: React.RefObject<HTMLCanvasElement>, isDrawing: boolean, e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const validateCanvas = (ref: React.RefObject<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return false;
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = canvas.width;
    emptyCanvas.height = canvas.height;
    return canvas.toDataURL() !== emptyCanvas.toDataURL();
  };

  const handleSubmit = async () => {
    if (!firestore || !suggestedGuard) return;

    if (!validateCanvas(outgoingCanvasRef) || !validateCanvas(incomingCanvasRef)) {
      toast({
        variant: 'destructive',
        title: 'Firmas obligatorias',
        description: 'Ambos guardias deben firmar el acta para proceder.',
      });
      return;
    }

    const incompleteIssues = items.some(item => item.status === 'issue' && !item.issueType);
    if (incompleteIssues) {
      toast({
        variant: 'destructive',
        title: 'Información incompleta',
        description: 'Por favor, selecciona el tipo de problema para los equipos con novedad.',
      });
      return;
    }

    setIsSubmitting(true);

    const handoverData = {
      location,
      date: new Date().toISOString().split('T')[0],
      outgoingGuardId: suggestedGuard.id,
      outgoingGuardName: `${suggestedGuard.nombres} ${suggestedGuard.apellidos}`,
      incomingGuardId: currentUser.id,
      incomingGuardName: `${currentUser.nombres} ${currentUser.apellidos}`,
      items,
      outgoingSignature: outgoingCanvasRef.current!.toDataURL('image/png'),
      incomingSignature: incomingCanvasRef.current!.toDataURL('image/png'),
      timestamp: Date.now(),
    };

    try {
      await addDoc(collection(firestore, 'equipmentHandovers'), handoverData);
      toast({ title: 'Acta Registrada', description: 'Relevo de puesto completado exitosamente.' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving handover:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el acta.' });
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
            ACTA PREMIUM DE RELEVO DE PUESTO
          </DialogTitle>
          <DialogDescription>
            Validación bipartita de activos y equipos críticos. Ambos guardias deben certificar el estado actual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-blue-100 p-2 rounded-full">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Guardia Saliente (Entrega)</p>
                  <p className="font-bold text-blue-900">{suggestedGuard ? `${suggestedGuard.nombres} ${suggestedGuard.apellidos}` : 'Cargando...'}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50/50 border-emerald-200">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-emerald-100 p-2 rounded-full">
                  <User className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Guardia Entrante (Recibe)</p>
                  <p className="font-bold text-emerald-900">{currentUser.nombres} {currentUser.apellidos}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[180px] font-bold">Equipo</TableHead>
                  <TableHead className="text-center w-[180px] font-bold">Estado</TableHead>
                  <TableHead className="font-bold">Detalle de Novedad</TableHead>
                  <TableHead className="w-[100px] text-center font-bold">Evidencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <React.Fragment key={item.name}>
                    <TableRow className={cn(item.status === 'issue' && "bg-red-50/30")}>
                      <TableCell className="font-semibold text-slate-700">{item.name}</TableCell>
                      <TableCell>
                        <RadioGroup
                          defaultValue={item.status}
                          onValueChange={(val) => handleStatusChange(index, val as 'good' | 'issue')}
                          className="flex justify-center gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="good" id={`good-${index}`} className="text-emerald-600" />
                            <Label htmlFor={`good-${index}`} className="text-xs cursor-pointer font-medium">OPERATIVO</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="issue" id={`issue-${index}`} className="text-red-600" />
                            <Label htmlFor={`issue-${index}`} className="text-xs cursor-pointer text-red-600 font-bold">NOVEDAD</Label>
                          </div>
                        </RadioGroup>
                      </TableCell>
                      <TableCell>
                        {item.status === 'issue' ? (
                          <div className="flex flex-col gap-2">
                            <Select value={item.issueType} onValueChange={(val) => handleItemUpdate(index, 'issueType', val)}>
                              <SelectTrigger className="h-8 text-xs border-red-200">
                                <SelectValue placeholder="Tipo de problema..." />
                              </SelectTrigger>
                              <SelectContent>
                                {ISSUE_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Notas adicionales..."
                              value={item.notes}
                              onChange={(e) => handleItemUpdate(index, 'notes', e.target.value)}
                              className="h-8 text-xs border-red-200"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin observaciones</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.status === 'issue' && (
                          <div className="flex flex-col items-center gap-1">
                            {item.photoUrl ? (
                              <div className="relative group">
                                <div className="w-12 h-12 rounded border overflow-hidden">
                                  <Image src={item.photoUrl} alt="Evidencia" width={48} height={48} className="object-cover" unoptimized />
                                </div>
                                <button onClick={() => handleItemUpdate(index, 'photoUrl', null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <Button variant="outline" size="icon" className="h-10 w-10 border-dashed" onClick={() => { setActivePhotoIndex(index); fileInputRef.current?.click(); }}>
                                <Camera className="h-5 w-5 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <Label className="font-bold text-slate-700 flex items-center gap-2">
                  <Check className="h-4 w-4 text-slate-500" />
                  FIRMA GUARDIA SALIENTE (ENTREGA)
              </Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white relative">
                <canvas
                  ref={outgoingCanvasRef}
                  width={400}
                  height={150}
                  className="w-full h-[120px] cursor-crosshair touch-none"
                  onMouseDown={(e) => startDrawing(outgoingCanvasRef, setIsDrawingOutgoing, e)}
                  onMouseMove={(e) => draw(outgoingCanvasRef, isDrawingOutgoing, e)}
                  onMouseUp={() => stopDrawing(outgoingCanvasRef, setIsDrawingOutgoing)}
                  onMouseOut={() => stopDrawing(outgoingCanvasRef, setIsDrawingOutgoing)}
                  onTouchStart={(e) => startDrawing(outgoingCanvasRef, setIsDrawingOutgoing, e)}
                  onTouchMove={(e) => draw(outgoingCanvasRef, isDrawingOutgoing, e)}
                  onTouchEnd={() => stopDrawing(outgoingCanvasRef, setIsDrawingOutgoing)}
                />
                <Button variant="ghost" size="icon" className="absolute bottom-1 right-1 h-7 w-7 text-muted-foreground" onClick={() => clearCanvas(outgoingCanvasRef)}>
                  <Eraser className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <Label className="font-bold text-slate-700 flex items-center gap-2">
                  <Check className="h-4 w-4 text-slate-500" />
                  FIRMA GUARDIA ENTRANTE (RECIBE)
              </Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white relative">
                <canvas
                  ref={incomingCanvasRef}
                  width={400}
                  height={150}
                  className="w-full h-[120px] cursor-crosshair touch-none"
                  onMouseDown={(e) => startDrawing(incomingCanvasRef, setIsDrawingIncoming, e)}
                  onMouseMove={(e) => draw(incomingCanvasRef, isDrawingIncoming, e)}
                  onMouseUp={() => stopDrawing(incomingCanvasRef, setIsDrawingIncoming)}
                  onMouseOut={() => stopDrawing(incomingCanvasRef, setIsDrawingIncoming)}
                  onTouchStart={(e) => startDrawing(incomingCanvasRef, setIsDrawingIncoming, e)}
                  onTouchMove={(e) => draw(incomingCanvasRef, isDrawingIncoming, e)}
                  onTouchEnd={() => stopDrawing(incomingCanvasRef, setIsDrawingIncoming)}
                />
                <Button variant="ghost" size="icon" className="absolute bottom-1 right-1 h-7 w-7 text-muted-foreground" onClick={() => clearCanvas(incomingCanvasRef)}>
                  <Eraser className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="min-w-[250px] shadow-lg">
            {isSubmitting ? (
              <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Procesando Acta...</>
            ) : (
              <><CheckCircle className="mr-2 h-4 w-4" /> Certificar Relevo y Guardar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}