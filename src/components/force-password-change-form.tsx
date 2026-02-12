
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { LoaderCircle, KeyRound } from 'lucide-react';
import Image from 'next/image';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es obligatoria.'),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});


export function ForcePasswordChangeForm() {
    const { user } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof passwordSchema>>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
    });

    const onSubmit = async (data: z.infer<typeof passwordSchema>) => {
        if (!user || !firestore || !user.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la contraseña. Usuario no autenticado.' });
            return;
        }

        setIsSubmitting(true);
        try {
            // Step 1: Re-authenticate user
            const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Step 2: Update Firebase Auth password
            await updatePassword(user, data.newPassword);
            
            // Step 3: Update the flag in Firestore
            const userDocRef = doc(firestore, 'users', user.uid);
            await updateDoc(userDocRef, {
                requiresPasswordChange: false,
            });

            toast({ title: 'Contraseña Actualizada', description: 'Tu contraseña ha sido actualizada exitosamente. Por favor, inicia sesión de nuevo.' });

            // Step 4: Sign out and redirect
            if (auth) {
                await signOut(auth);
            }
            router.push('/');

        } catch (error: any) {
            console.error("Error updating password:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                form.setError('currentPassword', { message: 'La contraseña actual es incorrecta.' });
            } else {
                toast({ variant: 'destructive', title: 'Error al actualizar', description: error.message || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center items-center">
                <Image
                    src="https://core.gruposudinco.com/_images/companies/logo_azul.png"
                    alt="Acceso CORE"
                    width={150}
                    height={50}
                    className="mb-4"
                />
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <KeyRound className="h-6 w-6" />
                    Actualiza tu Contraseña
                </CardTitle>
                <CardDescription>
                    Por tu seguridad, es necesario que actualices la contraseña temporal que te fue asignada.
                </CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="currentPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contraseña Actual</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} placeholder="Tu número de cédula" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nueva Contraseña</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} placeholder="Mínimo 8 caracteres" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirmar Nueva Contraseña</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmitting ? "Actualizando..." : "Actualizar Contraseña y Continuar"}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
