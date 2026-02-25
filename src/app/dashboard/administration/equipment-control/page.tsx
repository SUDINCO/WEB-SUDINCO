
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
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { EquipmentHandover } from '@/lib/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function EquipmentControlPage() {
  const [filter, setFilter] = useState('');
  const [selectedHandover, setSelectedHandover] = useState<EquipmentHandover | null>(null);
  const firestore = useFirestore();

  const handoversQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'equipmentHandovers'), orderBy('timestamp', 'desc'), limit(100));
  }, [firestore]);

  const { data: handovers, isLoading } = useCollection<EquipmentHandover>(handoversQuery);

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
    if (!handovers) return { total: 0, withIssues: 0 };
    return {
      total: handovers.length,
      withIssues: handovers.filter(h => h.items.some(i => i.status === 'issue')).length
    };
  }, [handovers]);

  const handleExport = async () => {
    const XLSX = await import('xlsx');
    const dataToExport = filteredHandovers.map(h => ({
      Fecha: format(new Date(h.timestamp), 'dd/MM/yyyy HH:mm'),
      Ubicación: h.location,
      'Guardia Saliente (Entrega)': h.outgoingGuardName,
      'Guardia Entrante (Recibe)': h.incomingGuardName,
      'Novedades': h.items.filter(i => i.status === 'issue').map(i => `${i.name}: ${i.notes}`).join('; ') || 'Ninguna'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Actas de Dotación');
    XLSX.writeFile(wb, `Control_Dotacion_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Dotación por Puesto</h1>
          <p className="text-muted-foreground">Monitoreo de actas de relevo firmadas en el cambio de turno.</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar Reporte
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription>Total Relevos Registrados</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-600">Actas con Novedades</CardDescription>
            <CardTitle className="text-3xl font-bold text-red-700">{stats.withIssues}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estado de Activos</CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600">
              {stats.total > 0 ? Math.round(((stats.total - stats.withIssues) / stats.total) * 100) : 0}% OK
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle>Historial de Relevos</CardTitle>
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
                <TableHead>G. Saliente (Entrega)</TableHead>
                <TableHead>G. Entrante (Recibe)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell colSpan={6} className="h-12"><div className="h-6 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filteredHandovers.length > 0 ? (
                filteredHandovers.map((handover) => {
                  const hasIssues = handover.items.some(i => i.status === 'issue');
                  return (
                    <TableRow key={handover.id} className={cn(hasIssues && "bg-red-50/30")}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{format(new Date(handover.timestamp), 'dd/MM/yyyy')}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(handover.timestamp), 'HH:mm')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {handover.location}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{handover.outgoingGuardName}</TableCell>
                      <TableCell className="text-xs">{handover.incomingGuardName}</TableCell>
                      <TableCell>
                        {hasIssues ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Novedad
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedHandover(handover)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Acta
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No se encontraron relevos registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedHandover} onOpenChange={() => setSelectedHandover(null)}>
        <DialogContent className="max-w-2xl">
          {selectedHandover && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Acta de Relevo #{selectedHandover.id.slice(-6).toUpperCase()}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Ubicación</p>
                    <p className="font-semibold">{selectedHandover.location}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Fecha / Hora</p>
                    <p className="font-semibold">{format(new Date(selectedHandover.timestamp), 'PPP p', { locale: es })}</p>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground uppercase font-bold">Entregado por (Saliente)</p>
                    <p className="font-semibold">{selectedHandover.outgoingGuardName}</p>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground uppercase font-bold">Recibido por (Entrante)</p>
                    <p className="font-semibold">{selectedHandover.incomingGuardName}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sm border-b pb-1">Estado de Equipos en el Relevo</h4>
                  <div className="space-y-2">
                    {selectedHandover.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="flex items-center gap-2">
                          {item.status === 'good' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium text-sm">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <Badge variant={item.status === 'good' ? 'outline' : 'destructive'} className="text-[10px] h-5">
                            {item.status === 'good' ? 'OPERATIVO' : 'NOVEDAD'}
                          </Badge>
                          {item.notes && <p className="text-xs text-muted-foreground italic mt-1">{item.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t flex flex-col items-center">
                  <p className="text-xs text-muted-foreground font-bold mb-2 uppercase">Firma del Guardia Saliente (Aprobación)</p>
                  <div className="border rounded bg-white p-2">
                    <Image 
                      src={selectedHandover.outgoingSignature} 
                      alt="Firma Saliente" 
                      width={300} 
                      height={100} 
                      className="max-h-[100px] w-auto object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
