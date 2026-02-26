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
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { EquipmentHandover } from '@/lib/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

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
          <p className="text-muted-foreground">Auditoría de relevos con doble identidad digital y validación personal.</p>
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
            <CardTitle>Historial de Auditoría</CardTitle>
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
                            Ver
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

      {/* Delete Confirmation */}
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedHandover} onOpenChange={() => setSelectedHandover(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedHandover && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold border-b pb-2">
                  <FileText className="h-6 w-6 text-primary" />
                  Acta de Relevo Digital #{selectedHandover.id.slice(-6).toUpperCase()}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-8 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Ubicación</p>
                    <p className="font-bold text-slate-800">{selectedHandover.location}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Estado Acta</p>
                    <Badge variant={selectedHandover.status === 'approved' ? 'default' : 'secondary'}>
                      {selectedHandover.status === 'approved' ? 'APROBADA Y CERRADA' : 'PENDIENTE DE REVISIÓN SALIENTE'}
                    </Badge>
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">Guardia Saliente</p>
                    <p className="font-bold">{selectedHandover.outgoingGuardName}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase">Guardia Entrante</p>
                    <p className="font-bold">{selectedHandover.incomingGuardName}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-lg text-slate-800 border-l-4 border-primary pl-3">Checklist de Activos (Reportado por Relevo Entrante)</h4>
                  <div className="space-y-3">
                    {selectedHandover.items.map((item) => (
                      <div key={item.name} className={cn("p-4 border rounded-xl flex flex-col gap-3", item.status === 'issue' ? "bg-red-50/50 border-red-200" : "bg-white")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.status === 'good' ? (
                              <CheckCircle className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                            )}
                            <span className="font-bold text-slate-700">{item.name}</span>
                          </div>
                          <Badge variant={item.status === 'good' ? 'outline' : 'destructive'}>
                            {item.status === 'good' ? 'OPERATIVO' : 'NOVEDAD'}
                          </Badge>
                        </div>
                        {item.status === 'issue' && (
                          <div className="pl-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-red-700 uppercase">Problema Reportado</p>
                              <p className="text-sm font-semibold">{item.issueType || 'Novedad'}</p>
                              <p className="text-xs text-muted-foreground italic">"{item.notes || 'Sin notas'}"</p>
                            </div>
                            {item.photoUrl && (
                              <div className="flex justify-end">
                                <button className="relative group" onClick={() => setViewPhoto(item.photoUrl!)}>
                                  <div className="w-24 h-16 rounded border-2 border-white shadow-sm overflow-hidden">
                                    <Image src={item.photoUrl} alt="Evidencia" width={96} height={64} className="object-cover" unoptimized />
                                  </div>
                                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="h-4 w-4 text-white" />
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] text-blue-600 font-bold mb-2 uppercase">Firma Guardia Saliente (Aprobación)</p>
                    <div className="border bg-slate-50 rounded-lg p-2 w-full flex justify-center min-h-[80px] items-center">
                      {selectedHandover.outgoingSignature ? (
                        <Image 
                          src={selectedHandover.outgoingSignature} 
                          alt="Firma Saliente" 
                          width={300} 
                          height={100} 
                          className="max-h-[80px] w-auto object-contain"
                          unoptimized
                        />
                      ) : <span className="text-xs text-muted-foreground italic">Pendiente de firma en sesión personal</span>}
                    </div>
                    {selectedHandover.approvalTimestamp && (
                      <p className="text-[9px] text-muted-foreground mt-1">Aprobado: {format(new Date(selectedHandover.approvalTimestamp), 'dd/MM/yy HH:mm')}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] text-emerald-600 font-bold mb-2 uppercase">Firma Guardia Entrante (Registro)</p>
                    <div className="border bg-slate-50 rounded-lg p-2 w-full flex justify-center">
                      {selectedHandover.incomingSignature && (
                        <Image 
                          src={selectedHandover.incomingSignature} 
                          alt="Firma Entrante" 
                          width={300} 
                          height={100} 
                          className="max-h-[80px] w-auto object-contain"
                          unoptimized
                        />
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">Registrado: {format(new Date(selectedHandover.timestamp), 'dd/MM/yy HH:mm')}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Preview Dialog */}
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