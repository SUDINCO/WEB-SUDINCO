
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth, useUser } from '@/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/firestore/use-firestore';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { LoaderCircle } from 'lucide-react';

const passwordSchema = z.object({
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

interface ForcePasswordChangeDialogProps {
    open: boolean;
    onPasswordChanged: () => void;
}

export function ForcePasswordChangeDialog({ open, onPasswordChanged }: ForcePasswordChangeDialogProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof passwordSchema>>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            newPassword: '',
            confirmPassword: '',
        },
    });

    const onSubmit = async (data: z.infer<typeof passwordSchema>) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la contraseña. Usuario no autenticado.' });
            return;
        }

        setIsSubmitting(true);
        try {
            // Step 1: Update Firebase Auth password
            await updatePassword(user, data.newPassword);
            
            // Step 2: Update the flag in Firestore
            const userDocRef = doc(firestore, 'users', user.uid);
            await updateDoc(userDocRef, {
                requiresPasswordChange: false,
            });

            toast({ title: 'Contraseña Actualizada', description: 'Tu contraseña ha sido actualizada exitosamente.' });
            onPasswordChanged(); // This will trigger the parent to close the dialog
        } catch (error: any) {
            console.error("Error updating password:", error);
            toast({ variant: 'destructive', title: 'Error al actualizar', description: 'No se pudo cambiar la contraseña. Es posible que necesites volver a iniciar sesión.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} hideCloseButton>
                <DialogHeader>
                    <DialogTitle>Actualiza tu Contraseña</DialogTitle>
                    <DialogDescription>
                        Por tu seguridad, es necesario que actualices la contraseña temporal que te fue asignada.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nueva Contraseña</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} />
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
                                    <FormLabel>Confirmar Contraseña</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter className="pt-4">
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Actualizar Contraseña
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
