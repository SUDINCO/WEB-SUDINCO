'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Camera, MapPin, Clock, Send, LoaderCircle, X, ArrowLeft, ShieldCheck, ClipboardList, User, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';
import type { WorkLocation, UserProfile } from '@/lib/types';
import { cn, normalizeText } from '@/lib/utils';

// Helper to calculate distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

type ReportStep = 'selection' | 'capturing' | 'details';
type ReportType = 'supervision' | 'report';

export default function ReportLocationPage() {
  const { user: authUser } = useUser();
  const firestore = useFirestore();
  
  const [step, setStep] = useState<ReportStep>('selection');
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [reportData, setReportData] = useState<{
    latitude: number;
    longitude: number;
    locationName: string;
    timestamp: Date;
    photoPreview: string | null;
  } | null>(null);

  const [notes, setNotes] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch locations and users for filtering
  const { data: workLocations } = useCollection<WorkLocation>(
    useMemo(() => firestore ? collection(firestore, 'workLocations') : null, [firestore])
  );
  const { data: allUsers } = useCollection<UserProfile>(
    useMemo(() => (firestore ? collection(firestore, 'users') : null), [firestore])
  );

  const filteredUsersAtLocation = useMemo(() => {
    if (!allUsers || !reportData?.locationName || reportData.locationName === 'Ubicación no registrada') return [];
    
    const normalizedLocation = normalizeText(reportData.locationName);
    return allUsers.filter(u => 
        u.Status === 'active' && 
        u.ubicacion && 
        normalizeText(u.ubicacion) === normalizedLocation
    ).map(u => ({
        value: u.id,
        label: `${u.nombres} ${u.apellidos}`,
        description: u.cargo
    }));
  }, [allUsers, reportData?.locationName]);

  const captureLocation = useCallback(() => {
    setIsCapturingLocation(true);
    setReportData(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let detectedLocation = "Ubicación no registrada";

        if (workLocations) {
          for (const loc of workLocations) {
            const distance = getDistance(lat, lon, Number(loc.latitude), Number(loc.longitude));
            if (distance <= Number(loc.radius)) {
              detectedLocation = loc.name;
              break;
            }
          }
        }

        setReportData({
          latitude: lat,
          longitude: lon,
          locationName: detectedLocation,
          timestamp: new Date(),
          photoPreview: null,
        });
        setIsCapturingLocation(false);
        setStep('details');
      },
      (error) => {
        console.error("Error getting location:", error);
        toast({
          variant: 'destructive',
          title: 'Error de Ubicación',
          description: 'No se pudo obtener tu ubicación. Revisa los permisos de tu navegador.'
        });
        setIsCapturingLocation(false);
        setStep('selection');
      },
      { enableHighAccuracy: true }
    );
  }, [workLocations]);

  const handleStartProcess = (type: ReportType) => {
    setReportType(type);
    setStep('capturing');
    captureLocation();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality compression
            setReportData(prev => prev ? { ...prev, photoPreview: dataUrl } : null);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!reportData || !reportData.photoPreview || !authUser || !firestore) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Se requiere ubicación y foto para enviar.' });
      return;
    }

    if (reportType === 'supervision' && !responsibleId) {
        toast({ variant: 'destructive', title: 'Responsable requerido', description: 'Debes seleccionar al responsable de turno.' });
        return;
    }

    setIsSubmitting(true);
    
    const selectedResponsible = allUsers?.find(u => u.id === responsibleId);

    try {
      await addDoc(collection(firestore, 'locationReports'), {
        userId: authUser.uid,
        userName: authUser.displayName || authUser.email,
        type: reportType,
        timestamp: reportData.timestamp.getTime(),
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        locationName: reportData.locationName,
        photoUrl: reportData.photoPreview,
        notes: notes,
        responsibleId: responsibleId || null,
        responsibleName: selectedResponsible ? `${selectedResponsible.nombres} ${selectedResponsible.apellidos}` : null,
      });

      toast({ title: 'Éxito', description: 'El reporte ha sido enviado correctamente.' });
      setStep('selection');
      setReportData(null);
      setNotes('');
      setResponsibleId('');
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el reporte.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToSelection = () => {
    setStep('selection');
    setReportType(null);
    setReportData(null);
    setNotes('');
    setResponsibleId('');
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
      
      <h1 className="text-2xl font-bold tracking-tight">Reportar Ubicación</h1>

      <div className="max-w-2xl mx-auto w-full">
        {step === 'selection' && (
          <Card className="border-2">
            <CardHeader className="text-center">
              <CardTitle>¿Qué actividad vas a realizar?</CardTitle>
              <CardDescription>Selecciona una opción para comenzar la captura.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-40 flex flex-col gap-4 text-lg border-2 hover:border-primary hover:bg-primary/5"
                onClick={() => handleStartProcess('supervision')}
              >
                <ShieldCheck className="h-12 w-12 text-primary" />
                SUPERVISIÓN
              </Button>
              <Button 
                variant="outline" 
                className="h-40 flex flex-col gap-4 text-lg border-2 hover:border-primary hover:bg-primary/5"
                onClick={() => handleStartProcess('report')}
              >
                <ClipboardList className="h-12 w-12 text-primary" />
                REPORTE
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'capturing' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
              <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
              <p className="font-medium">Capturando ubicación y validando zona...</p>
              <Button variant="ghost" onClick={handleBackToSelection} className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'details' && reportData && (
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {reportType === 'supervision' ? <ShieldCheck className="h-5 w-5 text-primary" /> : <ClipboardList className="h-5 w-5 text-primary" />}
                  Detalles del {reportType === 'supervision' ? 'Supervisión' : 'Reporte'}
                </CardTitle>
                <CardDescription>Completa la información requerida.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleBackToSelection}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Cambiar tipo
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={cn("p-3 rounded-lg border flex items-center gap-3", reportData.locationName !== "Ubicación no registrada" ? "bg-green-50 border-green-200" : "bg-muted")}>
                  <MapPin className={cn("h-5 w-5", reportData.locationName !== "Ubicación no registrada" ? "text-green-600" : "text-muted-foreground")} />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Ubicación Detectada</p>
                    <p className="text-sm font-bold">{reportData.locationName}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-muted flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Hora de Captura</p>
                    <p className="text-sm font-bold">{format(reportData.timestamp, "HH:mm:ss", { locale: es })}</p>
                  </div>
                </div>
              </div>

              {reportType === 'supervision' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    <User className="h-4 w-4" /> Responsable de Turno *
                  </Label>
                  {filteredUsersAtLocation.length > 0 ? (
                    <Combobox 
                      options={filteredUsersAtLocation}
                      value={responsibleId}
                      onChange={setResponsibleId}
                      placeholder="Seleccionar responsable..."
                      searchPlaceholder="Buscar por nombre o cargo..."
                    />
                  ) : (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <p className="text-xs text-yellow-800">
                            {reportData.locationName === "Ubicación no registrada" 
                                ? "No se puede listar personal porque estás fuera de una zona de trabajo registrada." 
                                : "No hay personal activo registrado en esta ubicación en la nómina."}
                        </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-semibold">Evidencia Fotográfica *</Label>
                {reportData.photoPreview ? (
                  <div className="relative group">
                    <Image
                      src={reportData.photoPreview}
                      alt="Vista previa"
                      width={800}
                      height={600}
                      className="rounded-lg object-cover w-full aspect-video border-2"
                      unoptimized
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 shadow-md"
                      onClick={() => setReportData(prev => prev ? { ...prev, photoPreview: null } : null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="secondary" 
                    className="w-full h-32 border-2 border-dashed flex flex-col gap-2 bg-muted/50 hover:bg-muted"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Tocar para tomar foto</span>
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">{reportType === 'supervision' ? 'Novedades Adicionales' : 'Comentarios (Opcional)'}</Label>
                <Textarea 
                  placeholder={reportType === 'supervision' ? "Establecer cualquier detalle adicional de la supervisión..." : "Añadir una nota al reporte..."}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleBackToSelection} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSubmit} 
                disabled={isSubmitting || !reportData.photoPreview || (reportType === 'supervision' && !responsibleId)}
              >
                {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar {reportType === 'supervision' ? 'Supervisión' : 'Reporte'}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
