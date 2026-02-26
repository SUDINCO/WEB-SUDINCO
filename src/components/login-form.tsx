
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { User, Lock, AlertCircle } from "lucide-react";
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
  FormDescription,
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
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from "react";


const formSchema = z.object({
  email: z.string().email("Por favor, ingrese una dirección de correo electrónico válida."),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

interface LoginFormProps {
    selectedAccountEmail: string | null;
    onLoginSuccess: (user: any, profile: any) => void;
}

export function LoginForm({ selectedAccountEmail, onLoginSuccess }: LoginFormProps) {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, loading } = useUser();
  const [showResetHint, setShowResetHint] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: selectedAccountEmail || "",
      password: "", 
    },
  });
  
  useEffect(() => {
    if(selectedAccountEmail) {
        form.setValue('email', selectedAccountEmail);
    }
  }, [selectedAccountEmail, form]);

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
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        const loggedInUser = userCredential.user;

        const userDocRef = doc(firestore, 'users', loggedInUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userProfile = { id: userDoc.id, ...userDoc.data() };
            toast({
                title: "Inicio de sesión exitoso",
                description: "Bienvenido de nuevo.",
            });
            onLoginSuccess(loggedInUser, userProfile);
        } else {
            toast({ variant: 'destructive', title: 'Error de perfil', description: 'No se encontró tu perfil de usuario. Contacta a soporte.' });
            await signOut(auth);
        }
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
                
                toast({ title: 'Usuario administrador creado', description: 'Iniciando sesión...' });
                return;
            } catch (creationError: any) {
                form.setError("password", { message: "Credenciales incorrectas." });
                return;
            }
        }
        
        setShowResetHint(true);
        form.setError("password", {
          message: "Credenciales incorrectas."
        });
    }
  }
  
  if (loading || user) {
    return null;
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl">
      <CardHeader className="text-center items-center">
        <Image
          src="https://i.postimg.cc/kGQrqkFv/login_performa.png"
          alt="Acceso PERFORMA"
          width={300}
          height={100}
          className="mb-4"
        />
        {selectedAccountEmail ? (
            <div className="flex flex-col items-center gap-2">
                <p className="font-semibold">{selectedAccountEmail}</p>
            </div>
        ) : (
            <CardDescription>¡Bienvenido de nuevo! Por favor, inicie sesión para continuar.</CardDescription>
        )}
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {!selectedAccountEmail && (
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
            )}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Contraseña / Cédula</FormLabel>
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
                      <Input type="password" placeholder="Tu contraseña o cédula" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[10px] leading-tight">
                    Si es tu primer ingreso o fue reseteada, intenta con tu número de cédula.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showResetHint && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex gap-2 items-start">
                    <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">
                        Si solicitaste un reseteo de contraseña, tu clave momentánea es tu <strong>número de cédula</strong>.
                    </p>
                </div>
            )}
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
