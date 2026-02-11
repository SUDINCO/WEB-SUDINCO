
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { Mail, ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase";

const formSchema = z.object({
  email: z.string().email("Por favor, ingrese una dirección de correo electrónico válida."),
});

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const auth = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El servicio de autenticación no está disponible.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: "Enlace Enviado",
        description: `Se ha enviado un enlace de recuperación a ${values.email}. Revisa tu bandeja de entrada.`,
      });
      form.reset();
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      let description = "Ocurrió un error al intentar enviar el correo.";
      if (error.code === 'auth/user-not-found') {
        description = "No se encontró ningún usuario con ese correo electrónico.";
      } else if (error.code === 'auth/network-request-failed') {
        description = "Error de red. No se pudo conectar con el servicio de autenticación.";
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: description,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
            <KeyRound className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">¿Olvidaste tu contraseña?</CardTitle>
        <CardDescription>No te preocupes, te enviaremos instrucciones para restablecerla.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="nombre@ejemplo.com" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Enviando..." : "Enviar enlace de recuperación"}
            </Button>
            <Button variant="ghost" asChild className="w-full">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Iniciar Sesión
                </Link>
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
