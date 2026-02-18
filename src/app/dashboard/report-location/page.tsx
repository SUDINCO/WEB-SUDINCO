'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Camera, MapPin, Clock, Send, LoaderCircle, Image as ImageIcon, X } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UserProfile {
  id: string;
  nombres: string;
  apellidos: string;
}

export default function ReportLocationPage() {
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  const [isReporting, setIsReporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportData, setReportData] = useState<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    photoPreview: string | null;
    photoFile: File | null;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartReport = useCallback(() => {
    setIsReporting(true);
    setReportData(null); // Reset previous data
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReportData({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date(),
          photoPreview: null,
          photoFile: null,
        });
        setIsReporting(false);
        toast({ title: 'Ubicación obtenida', description: 'Ahora puedes tomar una foto.' });
      },
      (error) => {
        console.error("Error getting location:", error);
        toast({
          variant: 'destructive',
          title: 'Error de Ubicación',
          description: 'No se pudo obtener tu ubicación. Revisa los permisos de tu navegador.'
        });
        setIsReporting(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

  const handleTakePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'Por favor, selecciona una imagen de menos de 5MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setReportData(prev => prev ? { ...prev, photoPreview: reader.result as string, photoFile: file } : null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportData || !reportData.photoPreview || !authUser || !firestore) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Se requiere ubicación y foto para enviar el reporte.' });
      return;
    }

    setIsSubmitting(true);
    
    // In a real app, you would upload the photo to Firebase Storage and get a URL.
    // For this prototype, we'll store the photo as a Base64 string (Data URL).
    const photoUrl = reportData.photoPreview;

    try {
      const reportsCollection = collection(firestore, 'locationReports');
      await addDoc(reportsCollection, {
        userId: authUser.uid,
        userName: authUser.displayName || authUser.email,
        timestamp: reportData.timestamp.getTime(),
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        photoUrl: photoUrl,
        notes: notes,
      });

      toast({ title: 'Reporte Enviado', description: 'Tu ubicación ha sido reportada con éxito.' });
      setReportData(null);
      setNotes('');
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({ variant: 'destructive', title: 'Error al Enviar', description: 'No se pudo guardar el reporte.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <h1 className="text-lg font-semibold md:text-2xl">Reportar Ubicación</h1>
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Reporte de Presencia</CardTitle>
          <CardDescription>
            Inicia el proceso para registrar tu ubicación, hora y una evidencia fotográfica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!reportData ? (
            <Button onClick={handleStartReport} disabled={isReporting} className="w-full" size="lg">
              {isReporting ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              {isReporting ? 'Obteniendo ubicación...' : 'Iniciar Reporte'}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">Coordenadas</p>
                    <p className="text-xs">{reportData.latitude.toFixed(5)}, {reportData.longitude.toFixed(5)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">Hora del Reporte</p>
                    <p className="text-xs">{format(reportData.timestamp, "dd/MM/yyyy HH:mm:ss", { locale: es })}</p>
                  </div>
                </div>
              </div>

              <div>
                {reportData.photoPreview ? (
                  <div className="relative">
                    <Image
                      src={reportData.photoPreview}
                      alt="Vista previa del reporte"
                      width={500}
                      height={375}
                      className="rounded-lg object-cover w-full aspect-video border"
                    />
                     <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => setReportData(prev => prev ? { ...prev, photoPreview: null, photoFile: null } : null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                  </div>
                ) : (
                  <Button onClick={handleTakePhotoClick} variant="secondary" className="w-full h-32 border-2 border-dashed">
                    <Camera className="mr-2 h-6 w-6" />
                    Tomar Foto
                  </Button>
                )}
              </div>
              
              <Textarea 
                placeholder="Añade una nota o descripción (opcional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </CardContent>
        {reportData && (
          <CardFooter>
            <Button onClick={handleSubmitReport} disabled={isSubmitting || !reportData.photoPreview} className="w-full" size="lg">
               {isSubmitting ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Enviando Reporte...' : 'Enviar Reporte'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
