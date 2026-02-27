'use client';

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Download, 
  Eye,
  MapPin,
  Camera,
  X,
  Clock,
  Trash2,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { EquipmentHandover } from '@/lib/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const LOGO_URL = 'https://i.postimg.cc/B6HGbmCz/LOGO-CADENVILL.png';

export default function EquipmentControlPage() {
  const [filter, setFilter] = useState('');
  const [selectedHandover, setSelectedHandover] = useState<EquipmentHandover | null>(null);
  const [handoverToDelete, setHandoverToDelete] = useState<EquipmentHandover | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const firestore = useFirestore();

  const handoversQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'equipmentHandovers'), orderBy('timestamp', 'desc'), limit(100));
  }, [firestore]);

  const { data: handovers, isLoading: handoversLoading } = useCollection<EquipmentHandover>(handoversQuery);

  const filteredHandovers = useMemo(() => {
    if (!handovers) return [];
    if (!filter) return handovers;
    const lower = filter.toLowerCase();
    return handovers.filter(h => 
      h.location.toLowerCase().includes(lower) ||
      h.outgoingGuardName.toLowerCase().includes(lower) ||
      h.incomingGuardName.toLowerCase().includes(lower)
    );
  }, [handovers, filter]);

  const stats = useMemo(() => {
    if (!handovers) return { total: 0, withIssues: 0, pending: 0 };
    return {
      total: handovers.length,
      withIssues: handovers.filter(h => h.items.some(i => i.status === 'issue')).length,
      pending: handovers.filter(h => h.status === 'pending').length
    };
  }, [handovers]);

  const handleDeleteHandover = async () => {
    if (!handoverToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'equipmentHandovers', handoverToDelete.id));
      toast({ title: 'Acta eliminada', description: 'El registro ha sido borrado exitosamente.' });
    } catch (error) {
      console.error("Error deleting handover:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el acta.' });
    } finally {
      setHandoverToDelete(null);
    }
  };

  const handleExport = async () => {
    const XLSX = await import('xlsx');
    const dataToExport = filteredHandovers.map(h => ({
      Fecha: format(new Date(h.timestamp), 'dd/MM/yyyy HH:mm'),
      Estado: h.status === 'approved' ? 'Aprobado' : 'Pendiente',
      Ubicación: h.location,
      'Guardia Saliente (Entregó)': h.outgoingGuardName,
      'Guardia Entrante (Recibió)': h.incomingGuardName,
      'Novedades': h.items.filter(i => i.status === 'issue').map(i => `${i.name} (${i.issueType || 'Novedad'}): ${i.notes || ''}`).join('; ') || 'Ninguna'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Control de Dotación');
    XLSX.writeFile(wb, `Reporte_Dotacion_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Dotación</h1>
          <p className="text-muted-foreground">Auditoría de relevos con doble identidad digital y validación institucional.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20 text-center">
          <CardHeader className="pb-2">
            <CardDescription>Total Relevos</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-yellow-50 border-yellow-100 text-center">
          <CardHeader className="pb-2">
            <CardDescription className="text-yellow-600 font-bold">Esperando Aprobación</CardDescription>
            <CardTitle className="text-3xl font-bold text-yellow-700">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-red-50 border-red-100 text-center">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-600 font-bold">Actas con Novedades</CardDescription>
            <CardTitle className="text-3xl font-bold text-red-700">{stats.withIssues}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 text-center">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-600 font-bold">Índice de Operatividad</CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-700">
              {stats.total > 0 ? Math.round(((stats.total - stats.withIssues) / stats.total) * 100) : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle>Historial de Auditoría Institucional</CardTitle>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por puesto o guardia..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha / Hora</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Relevo</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Novedades</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {handoversLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell colSpan={6} className="h-12"><div className="h-6 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filteredHandovers.length > 0 ? (
                filteredHandovers.map((handover) => {
                  const hasIssues = handover.items.some(i => i.status === 'issue');
                  return (
                    <TableRow key={handover.id} className={cn(hasIssues && "bg-red-50/20")}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{format(new Date(handover.timestamp), 'dd/MM/yyyy')}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(handover.timestamp), 'HH:mm')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-semibold text-slate-700">
                          <MapPin className="h-3 w-3 text-primary" />
                          {handover.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p><span className="text-blue-600 font-bold">Sal:</span> {handover.outgoingGuardName}</p>
                          <p><span className="text-emerald-600 font-bold">Ent:</span> {handover.incomingGuardName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {handover.status === 'approved' ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Validado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 gap-1 animate-pulse">
                            <Clock className="h-3 w-3" />
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasIssues ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Novedad
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ninguna</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedHandover(handover)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Acta
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setHandoverToDelete(handover)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No se encontraron registros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!handoverToDelete} onOpenChange={() => setHandoverToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar esta acta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el registro del relevo y no se podrá deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHandover} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar Acta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedHandover} onOpenChange={() => setSelectedHandover(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-100 border-none">
          {selectedHandover && (
            <>
              {/* Document Scrollable Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-10">
                <div className="bg-white shadow-2xl mx-auto max-w-4xl min-h-full border border-slate-200 relative flex flex-col">
                  
                  {/* Institucional Letterhead */}
                  <div className="w-full flex justify-center pt-8 px-8">
                    <div className="relative w-full max-w-[250px] h-[100px]">
                      <Image 
                        src={LOGO_URL} 
                        alt="Logo Cadenvill Security" 
                        fill
                        className="object-contain object-center"
                        unoptimized
                      />
                    </div>
                  </div>

                  {/* Document Body */}
                  <div className="px-8 md:px-16 py-6 space-y-8 flex-1">
                    
                    <div className="text-center space-y-1">
                      <h2 className="text-2xl font-black tracking-tighter text-slate-900 border-b-2 border-primary inline-block px-4 pb-1 uppercase italic">
                        Acta de Relevo Digital de Puesto
                      </h2>
                      <p className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">Control de Auditoría #{selectedHandover.id.slice(-6).toUpperCase()}</p>
                    </div>

                    {/* Meta Data Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Ubicación / Puesto</p>
                        <p className="text-sm font-bold text-slate-800">{selectedHandover.location}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Estado del Acta</p>
                        <Badge className={cn("text-[9px] font-black uppercase", selectedHandover.status === 'approved' ? "bg-emerald-600" : "bg-yellow-600")}>
                          {selectedHandover.status === 'approved' ? 'VALIDADO' : 'PENDIENTE'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Relevo Entrante</p>
                        <p className="text-sm font-bold text-emerald-700">{selectedHandover.incomingGuardName}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Relevo Saliente</p>
                        <p className="text-sm font-bold text-blue-700">{selectedHandover.outgoingGuardName}</p>
                      </div>
                    </div>

                    {/* Inventory */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 border-l-4 border-primary pl-3 bg-slate-100 py-2">
                        <ShieldCheck className="h-4 w-4" />
                        REPORTE DE ESTADO DE ACTIVOS RECIBIDOS
                      </h3>
                      
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-900">
                            <TableRow>
                              <TableHead className="text-white font-bold h-10 text-[10px] uppercase">Activo</TableHead>
                              <TableHead className="text-white font-bold h-10 text-center text-[10px] uppercase">Estado</TableHead>
                              <TableHead className="text-white font-bold h-10 text-[10px] uppercase">Novedad Detallada</TableHead>
                              <TableHead className="text-white font-bold h-10 text-center text-[10px] uppercase">Evidencia</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedHandover.items.map((item) => (
                              <TableRow key={item.name} className={cn("h-14", item.status === 'issue' && "bg-red-50")}>
                                <TableCell className="font-bold text-slate-700 text-xs">{item.name}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={item.status === 'good' ? 'outline' : 'destructive'} className="text-[9px] font-bold">
                                    {item.status === 'good' ? 'OPERATIVO' : 'NOVEDAD'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {item.status === 'issue' ? (
                                    <div className="space-y-0.5 py-1">
                                      <p className="text-[10px] font-bold text-red-700 uppercase">{item.issueType || 'Novedad'}</p>
                                      <p className="text-[10px] text-slate-600 italic">"{item.notes || 'Sin descripción'}"</p>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Sin novedad reportada</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.photoUrl && (
                                    <button onClick={() => setViewPhoto(item.photoUrl!)} className="hover:scale-110 transition-transform">
                                      <Image src={item.photoUrl} alt="Foto" width={32} height={32} className="rounded border object-cover shadow-sm" unoptimized />
                                    </button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Signatures Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-10">
                      <div className="flex flex-col items-center space-y-4">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest border-b pb-1 w-full text-center">Firma de Entrega (Saliente)</p>
                        <div className="w-full h-32 border bg-slate-50 rounded-lg flex items-center justify-center p-2">
                          {selectedHandover.outgoingSignature ? (
                            <Image 
                              src={selectedHandover.outgoingSignature} 
                              alt="Firma Saliente" 
                              width={250} 
                              height={100} 
                              className="max-h-full w-auto object-contain"
                              unoptimized
                            />
                          ) : <span className="text-[10px] text-slate-400 italic">Pendiente de validación</span>}
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-bold text-slate-800">{selectedHandover.outgoingGuardName}</p>
                          {selectedHandover.approvalTimestamp && (
                            <p className="text-[8px] text-slate-400 font-medium">Validado: {format(new Date(selectedHandover.approvalTimestamp), 'dd/MM/yy HH:mm')}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-center space-y-4">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest border-b pb-1 w-full text-center">Firma de Recepción (Entrante)</p>
                        <div className="w-full h-32 border bg-slate-50 rounded-lg flex items-center justify-center p-2">
                          {selectedHandover.incomingSignature && (
                            <Image 
                              src={selectedHandover.incomingSignature} 
                              alt="Firma Entrante" 
                              width={250} 
                              height={100} 
                              className="max-h-full w-auto object-contain"
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-bold text-slate-800">{selectedHandover.incomingGuardName}</p>
                          <p className="text-[8px] text-slate-400 font-medium">Registrado: {format(new Date(selectedHandover.timestamp), 'dd/MM/yy HH:mm')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Terms Footer */}
                    <div className="pt-12 border-t border-slate-100 pb-4">
                      <p className="text-[8px] text-slate-400 leading-tight text-center italic">
                        Documento oficial emitido por la plataforma Performa para Cadenvill Security. 
                        Este registro electrónico constituye una prueba auditable del estado de los activos en el momento del relevo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-slate-900 p-4 flex justify-between items-center px-8 border-t border-slate-800">
                <Button variant="ghost" onClick={() => setSelectedHandover(null)} className="text-white hover:bg-white/10">Cerrar Vista</Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="bg-transparent text-white border-white/20 hover:bg-white/10" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Imprimir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPhoto} onOpenChange={() => setViewPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-none">
          {viewPhoto && (
            <div className="relative aspect-auto max-h-[80vh] w-full flex justify-center">
              <Image src={viewPhoto} alt="Evidencia Ampliada" width={1200} height={800} className="object-contain" unoptimized />
              <button className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2" onClick={() => setViewPhoto(null)}>
                <X className="h-6 w-6" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
