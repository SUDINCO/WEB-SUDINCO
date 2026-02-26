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
import { Check, Eraser, LoaderCircle, Shield, User, Camera, X, CheckCircle, Lock, Unlock } from 'lucide-react';
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

const ISSUE_TYPES_MAP: Record<string, string[]> = {
  'Radio': [
    'Dañado / No funciona',
    'Faltante',
    'Pantalla rota',
    'Botones trabados',
    'Batería agotada / No carga',
    'Antena dañada',
    'Otro (especificar en notas)'
  ],
  'Chaleco': [
    'Roto / Rasgado',
    'Faltante',
    'Mal estado estético',
    'Sucio',
    'Velcro / Cierres dañados',
    'Otro (especificar en notas)'
  ],
  'Arma de Fuego': [
    'Mal estado mecánico',
    'Faltante',
    'Sin munición completa',
    'Seguro dañado',
    'Óxido / Falta limpieza',
    'Otro (especificar en notas)'
  ],
  'Celular': [
    'Pantalla rota',
    'Faltante',
    'No carga / Batería inflada',
    'Botones trabados',
    'Cámara dañada',
    'Otro (especificar en notas)'
  ],
  'Bitácora': [
    'Hojas faltantes',
    'Faltante',
    'Mal estado / Mojada',
    'Sin espacio para registros',
    'Otro (especificar en notas)'
  ],
  'default': [
    'Dañado / No funciona',
    'Faltante',
    'Mal estado estético',
    'Otro (especificar en notas)'
  ]
};

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
  
  const [isOutgoingLocked, setIsOutgoingLocked] = useState(false);
  const [isIncomingLocked, setIsIncomingLocked] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(EQUIPMENT_CATALOG.map(name => ({ name, status: 'good', issueType: '', notes: '', photoUrl: null })));
      setIsOutgoingLocked(false);
      setIsIncomingLocked(false);
      setTimeout(() => {
        clearCanvas(outgoingCanvasRef);
        clearCanvas(incomingCanvasRef);
      }, 100);
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

  const startDrawing = (ref: React.RefObject<HTMLCanvasElement>, setDrawing: (val: boolean) => void, locked: boolean, e: React.MouseEvent | React.TouchEvent) => {
    if (locked) return;
    setDrawing(true);
    draw(ref, true, locked, e);
  };

  const stopDrawing = (ref: React.RefObject<HTMLCanvasElement>, setDrawing: (val: boolean) => void) => {
    setDrawing(false);
    const canvas = ref.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (ref: React.RefObject<HTMLCanvasElement>, isDrawing: boolean, locked: boolean, e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || locked) return;
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

    if (!isOutgoingLocked || !isIncomingLocked) {
      toast({
        variant: 'destructive',
        title: 'Validación requerida',
        description: 'Ambas firmas deben ser certificadas para guardar el acta.',
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

  const toggleLockOutgoing = () => {
    if (!validateCanvas(outgoingCanvasRef)) {
      toast({ variant: 'destructive', title: 'Firma vacía', description: 'El guardia saliente debe firmar antes de certificar.' });
      return;
    }
    setIsOutgoingLocked(!isOutgoingLocked);
  };

  const toggleLockIncoming = () => {
    if (!validateCanvas(incomingCanvasRef)) {
      toast({ variant: 'destructive', title: 'Firma vacía', description: 'El guardia entrante debe firmar antes de certificar.' });
      return;
    }
    setIsIncomingLocked(!isIncomingLocked);
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
            Validación bipartita obligatoria. Firme solo en su recuadro correspondiente y certifique su identidad.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={cn("transition-all duration-300", isOutgoingLocked ? "bg-blue-100 border-blue-400" : "bg-blue-50/50 border-blue-200")}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("p-2 rounded-full", isOutgoingLocked ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600")}>
                  {isOutgoingLocked ? <Lock className="h-6 w-6" /> : <User className="h-6 w-6" />}
                </div>
                <div>
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Guardia Saliente (Entrega)</p>
                  <p className="font-bold text-blue-900">{suggestedGuard ? `${suggestedGuard.nombres} ${suggestedGuard.apellidos}` : 'Cargando...'}</p>
                </div>
              </CardContent>
            </Card>
            <Card className={cn("transition-all duration-300", isIncomingLocked ? "bg-emerald-100 border-emerald-400" : "bg-emerald-50/50 border-emerald-200")}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("p-2 rounded-full", isIncomingLocked ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-600")}>
                  {isIncomingLocked ? <Lock className="h-6 w-6" /> : <User className="h-6 w-6" />}
                </div>
                <div>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Guardia Entrante (Recibe)</p>
                  <p className="font-bold text-emerald-900">{currentUser.nombres} {currentUser.apellidos}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
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
                {items.map((item, index) => {
                  const specificIssues = ISSUE_TYPES_MAP[item.name] || ISSUE_TYPES_MAP['default'];
                  
                  return (
                    <TableRow key={item.name} className={cn(item.status === 'issue' && "bg-red-50/30")}>
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
                                {specificIssues.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {/* Signature Outgoing */}
            <div className={cn("space-y-3 p-4 rounded-xl border transition-all", isOutgoingLocked ? "bg-blue-50 border-blue-300" : "bg-slate-50 border-slate-200")}>
              <div className="flex justify-between items-center">
                <Label className="font-bold text-slate-700 flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" />
                    FIRMA GUARDIA SALIENTE
                </Label>
                {isOutgoingLocked && <Badge className="bg-blue-600">CERTIFICADA</Badge>}
              </div>
              <div className={cn("border-2 border-dashed rounded-lg bg-white relative", isOutgoingLocked ? "border-blue-400 opacity-80" : "border-slate-300")}>
                <canvas
                  ref={outgoingCanvasRef}
                  width={400}
                  height={150}
                  className={cn("w-full h-[120px] cursor-crosshair touch-none", isOutgoingLocked && "pointer-events-none")}
                  onMouseDown={(e) => startDrawing(outgoingCanvasRef, setIsDrawingOutgoing, isOutgoingLocked, e)}
                  onMouseMove={(e) => draw(outgoingCanvasRef, isDrawingOutgoing, isOutgoingLocked, e)}
                  onMouseUp={() => stopDrawing(outgoingCanvasRef, setIsDrawingOutgoing)}
                  onMouseOut={() => stopDrawing(outgoingCanvasRef, setIsDrawingOutgoing)}
                  onTouchStart={(e) => startDrawing(outgoingCanvasRef, setIsDrawingOutgoing, isOutgoingLocked, e)}
                  onTouchMove={(e) => draw(outgoingCanvasRef, isDrawingOutgoing, isOutgoingLocked, e)}
                  onTouchEnd={() => stopDrawing(outgoingCanvasRef, setIsDrawingOutgoing)}
                />
                {!isOutgoingLocked && (
                  <Button variant="ghost" size="icon" className="absolute bottom-1 right-1 h-7 w-7 text-muted-foreground" onClick={() => clearCanvas(outgoingCanvasRef)}>
                    <Eraser className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button 
                variant={isOutgoingLocked ? "outline" : "default"} 
                className={cn("w-full gap-2", isOutgoingLocked ? "text-blue-600 border-blue-300" : "bg-blue-600 hover:bg-blue-700")}
                onClick={toggleLockOutgoing}
              >
                {isOutgoingLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {isOutgoingLocked ? "Modificar Firma Saliente" : "Certificar Firma Saliente"}
              </Button>
            </div>

            {/* Signature Incoming */}
            <div className={cn("space-y-3 p-4 rounded-xl border transition-all", isIncomingLocked ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200")}>
              <div className="flex justify-between items-center">
                <Label className="font-bold text-slate-700 flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    FIRMA GUARDIA ENTRANTE
                </Label>
                {isIncomingLocked && <Badge className="bg-emerald-600">CERTIFICADA</Badge>}
              </div>
              <div className={cn("border-2 border-dashed rounded-lg bg-white relative", isIncomingLocked ? "border-emerald-400 opacity-80" : "border-slate-300")}>
                <canvas
                  ref={incomingCanvasRef}
                  width={400}
                  height={150}
                  className={cn("w-full h-[120px] cursor-crosshair touch-none", isIncomingLocked && "pointer-events-none")}
                  onMouseDown={(e) => startDrawing(incomingCanvasRef, setIsDrawingIncoming, isIncomingLocked, e)}
                  onMouseMove={(e) => draw(incomingCanvasRef, isDrawingIncoming, isIncomingLocked, e)}
                  onMouseUp={() => stopDrawing(incomingCanvasRef, setIsDrawingIncoming)}
                  onMouseOut={() => stopDrawing(incomingCanvasRef, setIsDrawingIncoming)}
                  onTouchStart={(e) => startDrawing(incomingCanvasRef, setIsDrawingIncoming, isIncomingLocked, e)}
                  onTouchMove={(e) => draw(incomingCanvasRef, isDrawingIncoming, isIncomingLocked, e)}
                  onTouchEnd={() => stopDrawing(incomingCanvasRef, setIsDrawingIncoming)}
                />
                {!isIncomingLocked && (
                  <Button variant="ghost" size="icon" className="absolute bottom-1 right-1 h-7 w-7 text-muted-foreground" onClick={() => clearCanvas(incomingCanvasRef)}>
                    <Eraser className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button 
                variant={isIncomingLocked ? "outline" : "default"} 
                className={cn("w-full gap-2", isIncomingLocked ? "text-emerald-600 border-emerald-300" : "bg-emerald-600 hover:bg-emerald-700")}
                onClick={toggleLockIncoming}
              >
                {isIncomingLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {isIncomingLocked ? "Modificar Firma Entrante" : "Certificar Firma Entrante"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !isOutgoingLocked || !isIncomingLocked} 
            size="lg" 
            className="min-w-[250px] shadow-lg"
          >
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
