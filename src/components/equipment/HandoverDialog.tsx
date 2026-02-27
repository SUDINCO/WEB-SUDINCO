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
import { Switch } from '@/components/ui/switch';
import { Check, Eraser, LoaderCircle, Shield, User, Camera, X, CheckCircle, Lock, Unlock, Send, Printer, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import type { UserProfile, EquipmentHandover } from '@/lib/types';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HandoverItem {
  name: string;
  present: boolean;
  status: 'good' | 'issue';
  issueType?: string;
  notes: string;
  photoUrl?: string | null;
}

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

const LOGO_URL = 'https://i.postimg.cc/B6HGbmCz/LOGO-CADENVILL.png';

const EQUIPMENT_CATALOG = ['Radio', 'Chaleco', 'Arma de Fuego', 'Celular', 'Bitácora', 'Vehículo'];

const ISSUE_TYPES_MAP: Record<string, string[]> = {
  'Radio': ['Dañado / No funciona', 'Faltante', 'Pantalla rota', 'Botones trabados', 'Batería agotada / No carga', 'Antena dañada', 'Otro (especificar en notas)'],
  'Chaleco': ['Roto / Rasgado', 'Faltante', 'Mal estado estético', 'Sucio', 'Velcro / Cierres dañados', 'Otro (especificar en notas)'],
  'Arma de Fuego': ['Mal estado mecánico', 'Faltante', 'Sin munición completa', 'Seguro dañado', 'Óxido / Falta limpieza', 'Otro (especificar en notas)'],
  'Celular': ['Pantalla rota', 'Faltante', 'No carga / Batería inflada', 'Botones trabados', 'Cámara dañada', 'Otro (especificar en notas)'],
  'Bitácora': ['Hojas faltantes', 'Faltante', 'Mal estado / Mojada', 'Sin espacio para registros', 'Otro (especificar en notas)'],
  'Vehículo': ['Golpes / Rayones nuevos', 'Falta de combustible', 'Llantas en mal estado / bajas', 'Luces fundidas / no funcionan', 'Limpieza interna/externa deficiente', 'Sin documentos (Matrícula/Seguro)', 'Fallo mecánico detectado', 'Otro (especificar en notas)'],
  'default': ['Dañado / No funciona', 'Faltante', 'Mal estado estético', 'Otro (especificar en notas)']
};

export function HandoverDialog({ open, onOpenChange, location, currentUser, suggestedGuard, onSuccess, mode = 'create', existingHandover }: HandoverDialogProps) {
  const isApproving = mode === 'approve';
  const [items, setItems] = useState<HandoverItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const firestore = useFirestore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (open) {
      if (isApproving && existingHandover) {
        setItems(existingHandover.items.map(i => ({
            ...i,
            present: (i as any).present !== undefined ? (i as any).present : true
        })) as HandoverItem[]);
      } else {
        setItems(EQUIPMENT_CATALOG.map(name => ({ 
          name, 
          present: true, 
          status: 'good', 
          issueType: '', 
          notes: '', 
          photoUrl: null 
        })));
        // Actualizar hora cada minuto para el nuevo registro
        timer = setInterval(() => setCurrentTime(new Date()), 60000);
      }
      setIsLocked(false);
      setTimeout(() => clearCanvas(), 150);
    }
    return () => clearInterval(timer);
  }, [open, isApproving, existingHandover]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handlePresenceToggle = (index: number, present: boolean) => {
    if (isApproving) return;
    const newItems = [...items];
    newItems[index].present = present;
    if (!present) {
      newItems[index].status = 'good';
      newItems[index].issueType = '';
      newItems[index].photoUrl = null;
    }
    setItems(newItems);
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

  const handleItemUpdate = (index: number, field: keyof HandoverItem, value: any) => {
    if (isApproving) return;
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

  const getCoordinates = (e: any) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: offsetX * scaleX, y: offsetY * scaleY };
  };

  const startDrawing = (e: any) => {
    if (isLocked) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
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

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSubmit = async () => {
    if (!firestore) return;

    for (const item of items) {
      if (item.present && item.status === 'issue') {
        if (!item.issueType || !item.notes || item.notes.trim() === '') {
          toast({ 
            variant: 'destructive', 
            title: 'Datos incompletos', 
            description: `Para el activo "${item.name}" con novedad, el Tipo y la Observación son obligatorios.` 
          });
          return;
        }
      }
    }

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
        if (!suggestedGuard) {
            toast({ variant: 'destructive', title: 'Error', description: 'No hay un guardia de relevo identificado para este puesto.' });
            setIsSubmitting(false);
            return;
        }
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
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-100 border-none">
        <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
        
        {/* Document Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="bg-white shadow-2xl mx-auto max-w-4xl min-h-full border border-slate-200 relative flex flex-col">
            
            {/* Full Width Institucional Header Image */}
            <div className="w-full relative h-[140px] border-b">
              <Image 
                src={LOGO_URL} 
                alt="Header Cadenvill Security" 
                fill
                className="object-fill object-center"
                unoptimized
              />
            </div>

            {/* Document Body */}
            <div className="px-8 md:px-16 py-6 flex-1 space-y-8">
              
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black tracking-tighter text-slate-900 border-b-2 border-primary inline-block px-4 pb-1 uppercase italic">
                  {isApproving ? 'Validación de Entrega de Equipos' : 'Acta de Recepción de Puesto y Activos'}
                </h2>
                <p className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">Documento de Control Operativo Interno</p>
              </div>

              {/* Meta Data Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Ubicación / Puesto</p>
                  <p className="text-sm font-bold text-slate-800">{location}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Fecha / Hora de Registro</p>
                  <p className="text-sm font-bold text-slate-800">
                    {isApproving && existingHandover 
                      ? format(new Date(existingHandover.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })
                      : format(currentTime, 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Relevo Entrante</p>
                  <p className="text-sm font-bold text-emerald-700">{isApproving ? existingHandover?.incomingGuardName : `${currentUser.nombres} ${currentUser.apellidos}`}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Relevo Saliente</p>
                  <p className="text-sm font-bold text-blue-700">{isApproving ? `${currentUser.nombres} ${currentUser.apellidos}` : (suggestedGuard ? `${suggestedGuard.nombres} ${suggestedGuard.apellidos}` : 'No identificado')}</p>
                </div>
              </div>

              {/* Checklist Table */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 border-l-4 border-primary pl-3 bg-slate-100 py-2">
                  <FileText className="h-4 w-4" />
                  INVENTARIO DE DOTACIÓN Y ESTADO OPERATIVO
                </h3>
                
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-900">
                      <TableRow>
                        <TableHead className="text-white font-bold h-10 text-[10px] uppercase">Activo</TableHead>
                        <TableHead className="text-white font-bold h-10 text-center text-[10px] uppercase">Asignado</TableHead>
                        <TableHead className="text-white font-bold h-10 text-center text-[10px] uppercase">Estado</TableHead>
                        <TableHead className="text-white font-bold h-10 text-[10px] uppercase">Observaciones / Novedad</TableHead>
                        <TableHead className="text-white font-bold h-10 text-center text-[10px] uppercase">Evidencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={item.name} className={cn("h-24", item.status === 'issue' && "bg-red-50", !item.present && "opacity-50 bg-slate-50")}>
                          <TableCell className="font-bold text-slate-700 text-xs">{item.name}</TableCell>
                          <TableCell className="text-center">
                            <Switch 
                              checked={item.present} 
                              onCheckedChange={(val) => handlePresenceToggle(index, val)}
                              disabled={isApproving}
                              className="scale-75"
                            />
                          </TableCell>
                          <TableCell>
                            {item.present ? (
                              <RadioGroup disabled={isApproving} value={item.status} onValueChange={(val) => handleStatusChange(index, val as 'good' | 'issue')} className="flex justify-center gap-2">
                                <div className="flex items-center space-x-1">
                                  <RadioGroupItem value="good" id={`good-${index}`} className="h-3 w-3" />
                                  <Label htmlFor={`good-${index}`} className="text-[10px] font-bold cursor-pointer">OK</Label>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <RadioGroupItem value="issue" id={`issue-${index}`} className="h-3 w-3 text-red-600 border-red-600" />
                                  <Label htmlFor={`issue-${index}`} className="text-[10px] font-bold cursor-pointer text-red-600">NOVEDAD</Label>
                                </div>
                              </RadioGroup>
                            ) : (
                              <div className="flex justify-center"><Badge variant="outline" className="text-[8px] h-4">N/A</Badge></div>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.present && item.status === 'issue' ? (
                              <div className="flex flex-col gap-1 py-1">
                                {isApproving ? (
                                  <p className="text-[10px] leading-tight"><span className="font-bold text-red-700 uppercase">{item.issueType}:</span> <span className="italic text-slate-600">"{item.notes}"</span></p>
                                ) : (
                                  <>
                                    <Select value={item.issueType} onValueChange={(v) => handleItemUpdate(index, 'issueType', v)}>
                                      <SelectTrigger className={cn("h-6 text-[10px] bg-white", !item.issueType && "border-red-500")}><SelectValue placeholder="Tipo (Obligatorio)..." /></SelectTrigger>
                                      <SelectContent>{(ISSUE_TYPES_MAP[item.name] || ISSUE_TYPES_MAP['default']).map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Input 
                                      placeholder="Obs. Obligatoria..." 
                                      value={item.notes} 
                                      onChange={(e) => handleItemUpdate(index, 'notes', e.target.value)} 
                                      className={cn("h-6 text-[10px] bg-white", !item.notes.trim() && "border-red-500")} 
                                    />
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">{item.present ? "Sin novedad" : "-"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.present && item.photoUrl && (
                              <div className="relative inline-block group">
                                <Image src={item.photoUrl} alt="Evidencia" width={80} height={80} className="rounded border object-cover shadow-md mx-auto" unoptimized />
                              </div>
                            )}
                            {!isApproving && item.present && item.status === 'issue' && !item.photoUrl && (
                              <Button variant="outline" size="icon" className="h-6 w-6 border-dashed" onClick={() => { setActivePhotoIndex(index); fileInputRef.current?.click(); }}><Camera className="h-3 w-3" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Signature Section */}
              <div className="space-y-4 pt-4">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 border-l-4 border-primary pl-3 bg-slate-100 py-2">
                  <CheckCircle className="h-4 w-4" />
                  CERTIFICACIÓN DE FIRMA DIGITAL
                </h3>
                
                <div className={cn("p-6 rounded-xl border-2 transition-all", isLocked ? "bg-slate-50 border-primary/20" : "bg-white border-dashed border-slate-300")}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                        {isApproving ? 'Firma de Conformidad (Saliente)' : 'Firma de Responsabilidad (Entrante)'}
                      </Label>
                      <p className="text-[10px] text-slate-500 font-medium">Esta firma vincula legalmente al usuario con el estado reportado en el acta.</p>
                    </div>
                    {isLocked && <Badge className="bg-primary hover:bg-primary font-black px-3 py-1">CERTIFICADA</Badge>}
                  </div>
                  
                  <div className="bg-white border rounded-lg relative overflow-hidden ring-offset-2 ring-primary/20 focus-within:ring-2">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={200}
                      className={cn(
                        "w-full h-[100px] cursor-crosshair touch-none",
                        isLocked && "pointer-events-none opacity-50 grayscale"
                      )}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseOut={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!isLocked && (
                      <Button variant="ghost" size="icon" className="absolute bottom-2 right-2 h-8 w-8 hover:bg-slate-100" onClick={clearCanvas}>
                        <Eraser className="h-4 w-4 text-slate-400" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <Button variant={isLocked ? "outline" : "default"} className="w-full gap-2 font-black text-xs uppercase h-10" onClick={() => setIsLocked(!isLocked)}>
                      {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      {isLocked ? "Modificar Firma" : "Bloquear y Certificar Firma"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Terms Footer */}
              <div className="pt-8 border-t border-slate-100">
                <p className="text-[8px] text-slate-400 leading-tight text-center italic">
                  Este documento digital tiene validez legal de acuerdo con las normativas internas de Cadenvill Security. 
                  La adulteración o el registro de información falsa será motivo de sanción administrativa severa.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <DialogFooter className="bg-slate-900 p-4 border-t border-slate-800">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="text-white hover:bg-white/10">Cancelar</Button>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={isSubmitting || !isLocked} size="lg" className="min-w-[240px] font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              {isApproving ? 'Confirmar y Finalizar Relevo' : 'Enviar para Aprobación'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
