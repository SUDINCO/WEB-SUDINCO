
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { User, Lock } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
import { useAuth, useUser, useFirestore } from "@/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from 'firebase/firestore';
import { useEffect } from "react";


const formSchema = z.object({
  email: z.string().email("Por favor, ingrese una dirección de correo electrónico válida."),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "", 
    },
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) {
      form.setError("password", { message: "El servicio de autenticación no está disponible." });
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido de nuevo.",
      });
      router.push('/dashboard');
    } catch (error: any) {
        // Handle admin creation on first login with emulator
        if (error.code === 'auth/invalid-credential' && values.email === 'jaespinoza@sudinco.com') {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, values.email, '1723518575JAER');
                const adminUser = userCredential.user;
                
                const userDocRef = doc(firestore, 'users', adminUser.uid);
                await setDoc(userDocRef, {
                    apellidos: "Espinoza", cargo: "Gerente de TI y Seguridad de la Informacion", cedula: "1723518575",
                    codigo: "123", departamento: "TI Y SEG. DE LA INFORMACION", email: "jaespinoza@sudinco.com",
                    empresa: "SUDINCO", fechaIngreso: "2023-01-01", fechaNacimiento: "1990-01-01",
                    isLeader: true, liderArea: "jaespinoza@sudinco.com", nombres: "Javier",
                    rol: "MASTER", Status: "active", tipoContrato: "INDEFINIDO", ubicacion: "OFICINA CENTRAL",
                });
                
                toast({ title: 'Usuario administrador creado', description: 'Por favor, inicia sesión de nuevo. La contraseña se ha insertado por ti.' });
                form.setValue('password', '1723518575JAER');
                return;

            } catch (creationError: any) {
                if (creationError.code === 'auth/email-already-in-use') {
                    // This means user exists, so password must be wrong
                    form.setError("password", { message: "Contraseña incorrecta para el usuario administrador." });
                } else {
                    form.setError("password", { message: `Error al crear admin: ${creationError.message}` });
                }
                return;
            }
        }
        
        // For any other login error, show a generic message under the password field
        form.setError("password", {
          message: "El correo electrónico o la contraseña son incorrectos."
        });
    }
  }
  
  if (loading || user) {
    return null; // Or a loading spinner
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl">
      <CardHeader className="text-center items-center">
        <Image
          src="https://core.gruposudinco.com/_images/companies/logo_azul.png"
          alt="Acceso CORE"
          width={150}
          height={50}
          className="mb-4"
        />
        <CardDescription>¡Bienvenido de nuevo! Por favor, inicie sesión para continuar.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="nombre@ejemplo.com" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Contraseña</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="••••••••" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
