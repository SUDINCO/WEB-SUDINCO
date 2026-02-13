
"use client";

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2, Edit, MapPin, LocateFixed, LoaderCircle, Map, ArrowLeft } from 'lucide-react';
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
import type { WorkLocation } from '@/lib/types';

const LocationsMap = dynamic(() => import('@/components/map/locations-map'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin" /> <p className="ml-2">Cargando mapa...</p></div>
});


const locationSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  latitude: z.coerce.number().min(-90, 'Latitud inválida').max(90, 'Latitud inválida'),
  longitude: z.coerce.number().min(-180, 'Longitud inválida').max(180, 'Longitud inválida'),
  radius: z.coerce.number().min(1, 'El radio debe ser mayor a 0.'),
});

type LocationFormData = z.infer<typeof locationSchema>;

export default function WorkLocationsPage() {
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<WorkLocation | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Default center on Guayaquil, Ecuador
  const [mapCenter, setMapCenter] = useState<[number, number]>([-2.14, -79.9]);
  const [mapZoom, setMapZoom] = useState(12);

  const firestore = useFirestore();
  const locationsCollectionRef = useMemo(() => firestore ? collection(firestore, 'workLocations') : null, [firestore]);
  
  const { data: locations, isLoading: locationsLoading } = useCollection<WorkLocation>(locationsCollectionRef);

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: { name: '', latitude: 0, longitude: 0, radius: 50 },
  });

  const handleAddNew = () => {
    setEditingLocation(null);
    form.reset({ name: '', latitude: mapCenter[0], longitude: mapCenter[1], radius: 50 });
    setViewMode('form');
  };

  const handleEdit = (location: WorkLocation) => {
    setEditingLocation(location);
    form.reset(location);
    setViewMode('form');
    setMapCenter([location.latitude, location.longitude]);
    setMapZoom(16);
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingLocation(null);
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
        setViewMode('list');
        setEditingLocation(null);
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
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setMapZoom(17);
        setIsGettingLocation(false);
        toast({ title: "Ubicación obtenida", description: "Las coordenadas actuales se han llenado en el formulario y el mapa se ha centrado." });
      },
      (error) => {
        console.error("Error getting location:", error);
        let description = 'No se pudo obtener la ubicación. Revisa los permisos en tu navegador.';
        if (error.code === 1) description = 'Permiso de ubicación denegado.';
        if (error.message.includes('disabled')) description = 'La geolocalización está deshabilitada en este documento. Intenta en una pestaña nueva.';
        toast({ variant: 'destructive', title: 'Error de Ubicación', description });
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };
  
  const handleMapDoubleClick = useCallback((latlng: { lat: number, lng: number }) => {
    if (viewMode === 'form' && !editingLocation) {
        form.setValue('latitude', latlng.lat);
        form.setValue('longitude', latlng.lng);
        toast({ title: 'Coordenadas Fijadas', description: 'Se han establecido las coordenadas desde el mapa.'});
    }
  }, [form, viewMode, editingLocation]);

  const handleMarkerClick = useCallback((locationId: string) => {
      const location = locations?.find(l => l.id === locationId);
      if (location) {
          handleEdit(location);
      }
  }, [locations]);

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          {viewMode === 'list' ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Ubicaciones Registradas</CardTitle>
                        <CardDescription>Lista de todas las geocercas para el registro de asistencia.</CardDescription>
                    </div>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir Ubicación
                    </Button>
                </div>
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
                          <TableRow key={loc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(loc)}>
                              <TableCell className="font-medium">{loc.name}</TableCell>
                              <TableCell>{loc.latitude.toFixed(6)}</TableCell>
                              <TableCell>{loc.longitude.toFixed(6)}</TableCell>
                              <TableCell>{loc.radius}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); handleEdit(loc); }}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); setLocationToDelete(loc); }}>
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
          ) : (
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>{editingLocation ? 'Editar Ubicación' : 'Nueva Ubicación'}</CardTitle>
                            <CardDescription>
                            {editingLocation ? `Modificando "${editingLocation.name}"` : 'Define la nueva geocerca. Haz doble clic en el mapa para fijar coordenadas.'}
                            </CardDescription>
                        </div>
                         <Button variant="outline" size="sm" onClick={handleCancel}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a la lista
                         </Button>
                    </div>
                </CardHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardContent className="space-y-4">
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
                             <Button type="button" variant="outline" onClick={handleGetCurrentLocation} disabled={isGettingLocation}>
                                {isGettingLocation ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                                Obtener Coordenadas Actuales
                            </Button>
                            <FormField control={form.control} name="radius" render={({ field }) => (
                                <FormItem><FormLabel>Radio (en metros)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={handleCancel}>Cancelar</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Ubicación'}
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
          )}
        </div>
        <div className="xl:col-span-2 min-h-[500px] xl:h-[75vh]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5"/>
                Mapa de Ubicaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-4rem)]">
              <LocationsMap 
                locations={locations || []}
                center={mapCenter}
                zoom={mapZoom}
                onMapDoubleClick={handleMapDoubleClick}
                onMarkerClick={handleMarkerClick}
                selectedLocationId={editingLocation?.id || null}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
