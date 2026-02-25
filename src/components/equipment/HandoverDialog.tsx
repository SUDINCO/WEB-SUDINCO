
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
import { Check, Eraser, LoaderCircle, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

interface HandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: string;
  currentUser: UserProfile;
  suggestedGuard: UserProfile | null;
  onSuccess: () => void;
}

const EQUIPMENT_CATALOG = ['Radio', 'Chaleco', 'Arma de Fuego', 'Celular', 'Bitácora'];

export function HandoverDialog({ open, onOpenChange, location, currentUser, suggestedGuard, onSuccess }: HandoverDialogProps) {
  const [items, setItems] = useState(
    EQUIPMENT_CATALOG.map(name => ({ name, status: 'good' as 'good' | 'issue', notes: '' }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(EQUIPMENT_CATALOG.map(name => ({ name, status: 'good' as 'good' | 'issue', notes: '' })));
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
    }
  }, [open]);

  const handleStatusChange = (index: number, status: 'good' | 'issue') => {
    const newItems = [...items];
    newItems[index].status = status;
    setItems(newItems);
  };

  const handleNotesChange = (index: number, notes: string) => {
    const newItems = [...items];
    newItems[index].notes = notes;
    setItems(newItems);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
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

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSubmit = async () => {
    if (!firestore) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const signatureData = canvas.toDataURL('image/png');
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = canvas.width;
    emptyCanvas.height = canvas.height;
    const isEmpty = canvas.toDataURL() === emptyCanvas.toDataURL();
    
    if (isEmpty) {
      toast({
        variant: 'destructive',
        title: 'Firma requerida',
        description: 'El guardia que termina el turno debe firmar para validar el acta.',
      });
      return;
    }

    if (!suggestedGuard) {
        toast({
            variant: 'destructive',
            title: 'Falta guardia saliente',
            description: 'No se ha detectado al guardia que entrega el puesto.',
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
      outgoingSignature: signatureData,
      timestamp: Date.now(),
    };

    try {
      await addDoc(collection(firestore, 'equipmentHandovers'), handoverData);
      toast({
        title: 'Relevo Registrado',
        description: 'El acta de relevo ha sido guardada exitosamente.',
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving handover:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el acta. Inténtalo de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-primary">
            <Shield className="h-6 w-6" />
            Acta Única de Relevo de Puesto
          </DialogTitle>
          <DialogDescription>
            El guardia entrante realiza el checklist y el guardia saliente aprueba mediante su firma digital.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
          <Card className="bg-muted/30 border-primary/20">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase font-bold">Guardia que Entrega (Saliente)</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold">{suggestedGuard ? `${suggestedGuard.nombres} ${suggestedGuard.apellidos}` : 'Cargando relevo...'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase font-bold">Guardia que Recibe (Entrante)</Label>
                <div className="flex items-center gap-2 text-primary">
                  <User className="h-4 w-4" />
                  <p className="font-bold">{currentUser.nombres} {currentUser.apellidos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-[200px]">Material / Equipo</TableHead>
                  <TableHead className="text-center w-[200px]">Estado</TableHead>
                  <TableHead>Observaciones del Guardia Entrante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <RadioGroup
                        defaultValue={item.status}
                        onValueChange={(val) => handleStatusChange(index, val as 'good' | 'issue')}
                        className="flex justify-center gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="good" id={`good-${index}`} className="text-green-600" />
                          <Label htmlFor={`good-${index}`} className="text-xs cursor-pointer">OK</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="issue" id={`issue-${index}`} className="text-red-600" />
                          <Label htmlFor={`issue-${index}`} className="text-xs cursor-pointer text-red-600 font-bold">NOVEDAD</Label>
                        </div>
                      </RadioGroup>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder={item.status === 'issue' ? "Describa la novedad..." : "Opcional..."}
                        value={item.notes}
                        onChange={(e) => handleNotesChange(index, e.target.value)}
                        className={cn(item.status === 'issue' && "border-red-300 bg-red-50")}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
            <Label className="font-bold text-red-700 flex items-center gap-2">
                <Edit className="h-4 w-4" />
                FIRMA DEL GUARDIA SALIENTE (PARA APROBACIÓN)
            </Label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full h-[150px] cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute bottom-2 right-2 text-muted-foreground hover:text-destructive"
                onClick={clearSignature}
              >
                <Eraser className="h-4 w-4 mr-2" />
                Borrar Firma
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center italic">
              Al firmar, el guardia saliente confirma la entrega de los equipos en el estado reportado por el guardia entrante.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} size="lg" className="min-w-[200px]">
            {isSubmitting ? (
              <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
            ) : (
              <><Check className="mr-2 h-4 w-4" /> Aprobar y Guardar Acta</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
