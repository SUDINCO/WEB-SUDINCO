"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { PlusCircle, Trash2, Edit, MapPin, LocateFixed, LoaderCircle, Map } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WorkLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

const locationSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  latitude: z.coerce.number().min(-90, 'Latitud inválida').max(90, 'Latitud inválida'),
  longitude: z.coerce.number().min(-180, 'Longitud inválida').max(180, 'Longitud inválida'),
  radius: z.coerce.number().min(1, 'El radio debe ser mayor a 0.'),
});

type LocationFormData = z.infer<typeof locationSchema>;

export default function WorkLocationsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<WorkLocation | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const firestore = useFirestore();
  const locationsCollectionRef = useMemo(() => firestore ? collection(firestore, 'workLocations') : null, [firestore]);
  
  const { data: locations, isLoading: locationsLoading } = useCollection<WorkLocation>(locationsCollectionRef);

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: { name: '', latitude: 0, longitude: 0, radius: 50 },
  });
  
  const watchedLatitude = form.watch('latitude');
  const watchedLongitude = form.watch('longitude');
  const watchedRadius = form.watch('radius');

  const mapPreviewUrl = useMemo(() => {
    const lat = Number(watchedLatitude);
    const lon = Number(watchedLongitude);
    const radius = Number(watchedRadius);

    if (isNaN(lat) || isNaN(lon)) {
        return `https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik`;
    }

    if (lat === 0 && lon === 0) {
      return `https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik`;
    }

    // Calculation to convert radius in meters to a lat/lon bounding box
    const R = 6371e3; // Earth's radius in meters
    const latDelta = (radius / R) * (180 / Math.PI);
    const lonDelta = (radius / (R * Math.cos(lat * Math.PI / 180))) * (180 / Math.PI);

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;

    const bbox = `${minLon.toFixed(6)},${minLat.toFixed(6)},${maxLon.toFixed(6)},${maxLat.toFixed(6)}`;
    
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  }, [watchedLatitude, watchedLongitude, watchedRadius]);


  const handleOpenForm = (location: WorkLocation | null) => {
    setEditingLocation(location);
    if (location) {
      form.reset(location);
    } else {
      form.reset({ name: '', latitude: 0, longitude: 0, radius: 50 });
    }
    setIsFormOpen(true);
  };
  
  const onSubmit = async (data: LocationFormData) => {
    if (!locationsCollectionRef) return;

    try {
        if(editingLocation) {
            const docRef = doc(locationsCollectionRef, editingLocation.id);
            await updateDoc(docRef, data);
            toast({ title: "Ubicación Actualizada", description: `La ubicación "${data.name}" ha sido guardada.` });
        } else {
            await addDoc(locationsCollectionRef, data);
            toast({ title: "Ubicación Creada", description: `La ubicación "${data.name}" ha sido creada.` });
        }
        setIsFormOpen(false);
    } catch (error) {
        console.error("Error saving location:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la ubicación.' });
    }
  };

  const handleDeleteLocation = async () => {
    if (!locationToDelete || !locationsCollectionRef) return;
    try {
        await deleteDoc(doc(locationsCollectionRef, locationToDelete.id));
        toast({ title: 'Ubicación Eliminada', description: `La ubicación "${locationToDelete.name}" ha sido eliminada.` });
    } catch(error) {
        console.error("Error deleting location:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la ubicación.' });
    } finally {
        setLocationToDelete(null);
    }
  };

  const handleGetCurrentLocation = () => {
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue('latitude', position.coords.latitude);
        form.setValue('longitude', position.coords.longitude);
        setIsGettingLocation(false);
        toast({ title: "Ubicación obtenida", description: "Las coordenadas actuales se han llenado en el formulario." });
      },
      (error) => {
        console.error("Error getting location:", error);
        toast({ variant: 'destructive', title: 'Error de Ubicación', description: error.message });
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h1 className="text-lg font-semibold md:text-2xl">Ubicaciones de Trabajo</h1>
            <p className="text-sm text-muted-foreground mt-1">
                Define las geocercas donde los empleados pueden registrar su asistencia.
            </p>
        </div>
        <Button onClick={() => handleOpenForm(null)} className="w-full md:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Ubicación
        </Button>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Editar Ubicación' : 'Añadir Nueva Ubicación'}</DialogTitle>
            <DialogDescription>
              Define un área geográfica donde los empleados pueden registrar su asistencia.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nombre de la Ubicación</FormLabel><FormControl><Input placeholder="Ej: Oficina Principal" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="latitude" render={({ field }) => (
                  <FormItem><FormLabel>Latitud</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="longitude" render={({ field }) => (
                  <FormItem><FormLabel>Longitud</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Button type="button" variant="outline" onClick={handleGetCurrentLocation} disabled={isGettingLocation} className="w-full sm:w-auto">
                {isGettingLocation ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                Obtener Coordenadas Actuales
              </Button>
              <FormField control={form.control} name="radius" render={({ field }) => (
                <FormItem><FormLabel>Radio (en metros)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <div className="space-y-2">
                <Label>Vista Previa del Mapa</Label>
                <div className="h-64 w-full rounded-md border bg-muted overflow-hidden">
                    <iframe
                        key={mapPreviewUrl} // Use key to force re-render when URL changes
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        src={mapPreviewUrl}
                    ></iframe>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Ubicación'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!locationToDelete} onOpenChange={() => setLocationToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente la ubicación de trabajo.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLocation} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Ubicaciones Registradas</CardTitle>
          <CardDescription>
            Lista de todas las ubicaciones de trabajo y sus geocercas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Latitud</TableHead>
                    <TableHead>Longitud</TableHead>
                    <TableHead>Radio (m)</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {locationsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                        <TableCell colSpan={5} className="p-4"><div className="h-8 bg-gray-200 rounded animate-pulse"></div></TableCell>
                    </TableRow>
                    ))
                ) : locations && locations.length > 0 ? (
                    locations.map((loc) => (
                    <TableRow key={loc.id}>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell>{loc.latitude.toFixed(6)}</TableCell>
                        <TableCell>{loc.longitude.toFixed(6)}</TableCell>
                        <TableCell>{loc.radius}</TableCell>
                        <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(loc)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setLocationToDelete(loc)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No hay ubicaciones registradas.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
