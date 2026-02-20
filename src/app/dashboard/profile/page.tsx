
'use client';

import type { ChangeEvent } from 'react';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Mail, Phone, UserCircle, QrCode, Briefcase, Building, MapPin, Camera, Edit3, UserRound } from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const MAX_AVATAR_SIZE_MB = 2;
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

interface UserProfile {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  cargo: string;
  departamento: string;
  ubicacion?: string;
  photoUrl?: string;
}

export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const userProfileDocRef = React.useMemo(() => {
    if (!firestore || !authUser?.uid) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [firestore, authUser?.uid]);

  const { data: user, isLoading: profileLoading } = useDoc<UserProfile>(userProfileDocRef);

  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  
  const [isEditPhotoModalOpen, setIsEditPhotoModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      const qrData = `SUDINCO Hub User:\nUID: ${user.id}\n${user.cedula ? `Cédula: ${user.cedula}\n` : ''}Nombre: ${user.nombres} ${user.apellidos}\nCargo: ${user.cargo}`;
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&q=H&data=${encodeURIComponent(qrData)}`);
    }
  }, [user]);

  const getInitials = (name: string, lastName: string) => {
    if (!name || !lastName) return '??';
    return (name[0] || '') + (lastName[0] || '');
  }

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
        toast({ variant: "destructive", title: "Imagen Demasiado Grande", description: `El tamaño máximo es ${MAX_AVATAR_SIZE_MB}MB.` });
        return;
    }
    if (!file.type.startsWith('image/')) {
        toast({ variant: "destructive", title: "Archivo no válido", description: "Selecciona una imagen." });
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 512;
            const MAX_HEIGHT = 512;
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
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setImagePreview(dataUrl);
        };
        img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (imagePreview && user && userProfileDocRef) {
      try {
        await updateDoc(userProfileDocRef, { photoUrl: imagePreview });
        closeEditPhotoModal();
        toast({ title: "Foto de perfil actualizada" });
      } catch (error) {
        console.error("Error updating avatar:", error);
        toast({ variant: "destructive", title: "Error al Guardar", description: "No se pudo actualizar la foto de perfil." });
      }
    } else {
      toast({ variant: "destructive", title: "Error al Guardar", description: "No hay imagen nueva para guardar." });
    }
  };

  const openEditPhotoDialog = () => {
    setImagePreview(user?.photoUrl || null);
    setIsEditPhotoModalOpen(true);
  };
  
  const closeEditPhotoModal = useCallback(() => {
    setIsEditPhotoModalOpen(false);
    setImagePreview(null); 
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  }, []);

  const handleLogout = () => {
    if (auth) {
        signOut(auth).then(() => {
            router.push('/');
        });
    }
  };

  if (authLoading || profileLoading || !user) {
    return <div className="space-y-8 p-4"><p>Cargando perfil...</p></div>;
  }
  
  return (
    <div className="space-y-8">
      <Card className="shadow-xl rounded-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-primary to-accent/90 p-6 relative bg-blue-900">
          <div className="flex items-center space-x-6">
            <div className="relative group">
              <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                <AvatarImage src={user.photoUrl} alt={`${user.nombres} ${user.apellidos}`} />
                <AvatarFallback className="text-4xl">{getInitials(user.nombres, user.apellidos)}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="icon" className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-background/80 text-primary" onClick={openEditPhotoDialog} title="Cambiar foto">
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-primary-foreground">
              <CardTitle className="font-headline text-3xl drop-shadow-sm">{user.nombres} {user.apellidos}</CardTitle>
              <p className="text-lg flex items-center mt-1"><Briefcase className="mr-2 h-5 w-5" /> {user.cargo}</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div><h3 className="text-sm font-medium text-muted-foreground mb-2">Detalles del Empleado</h3>
            <div className="space-y-2 text-sm">
              {user.departamento && <div className="flex items-center"><Building className="mr-3 h-5 w-5 text-primary" /><span>Área:</span>&nbsp;{user.departamento}</div>}
              {user.ubicacion && <div className="flex items-center"><MapPin className="mr-3 h-5 w-5 text-primary" /><span>Ubicación:</span>&nbsp;{user.ubicacion}</div>}
            </div>
          </div>
          <Separator />
          <div><h3 className="text-sm font-medium text-muted-foreground mb-2">Información de Contacto</h3>
            <div className="space-y-2 text-sm">
              {user.email && <div className="flex items-center"><Mail className="mr-3 h-5 w-5 text-primary" /><span>Email:</span>&nbsp;<a href={`mailto:${user.email}`} className="hover:underline">{user.email}</a></div>}
              <div className="flex items-center"><UserCircle className="mr-3 h-5 w-5 text-primary" /><span>Cédula:</span>&nbsp;{user.cedula}</div>
            </div>
          </div>
          <Separator />
          <Button onClick={handleLogout} variant="destructive" className="w-full sm:w-auto">Cerrar Sesión</Button>
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-xl overflow-hidden">
        <CardHeader className="bg-muted/50"><CardTitle className="font-headline text-xl flex items-center"><QrCode className="mr-2 h-6 w-6 text-primary" /> Mi Código QR</CardTitle><CardDescription>Comparte tu información rápidamente.</CardDescription></CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          {qrCodeUrl ? <Image src={qrCodeUrl} alt="Código QR" width={180} height={180} data-ai-hint="qr code" /> : <p>Generando código QR...</p>}
        </CardContent>
      </Card>

      <Dialog open={isEditPhotoModalOpen} onOpenChange={(open) => !open && closeEditPhotoModal()}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="font-headline">Cambiar Foto de Perfil</DialogTitle></DialogHeader>
              <div className="py-4">
                  <div className="flex items-center gap-4">
                      <div className="w-24 text-center">
                        <Label htmlFor="avatarUpload" className="cursor-pointer flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">Vista previa</span>
                          {imagePreview ? (
                              <Image
                                  src={imagePreview}
                                  alt="Vista previa"
                                  width={80}
                                  height={80}
                                  className="rounded-full aspect-square object-cover border"
                                  unoptimized
                              />
                          ) : (
                              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border">
                                  <UserRound className="w-10 h-10 text-muted-foreground" />
                              </div>
                          )}
                        </Label>
                      </div>
                      <div className="flex-1 space-y-2">
                          <Input id="avatarUpload" ref={fileInputRef} type="file" accept="image/png, image/jpeg" onChange={handleFileSelect} className="hidden" />
                          <Button type="button" variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}><Edit3 className="h-4 w-4" /> Seleccionar Archivo</Button>
                          <p className="text-xs text-muted-foreground">La imagen se redimensionará a 512x512 y se comprimirá.</p>
                      </div>
                  </div>
              </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleSavePhoto} disabled={!imagePreview || imagePreview === user?.photoUrl}>Guardar Foto</Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
