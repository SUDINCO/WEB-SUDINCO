

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, AlertTriangle, LoaderCircle, Send, ArrowLeft, ArrowRight, Check, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';


interface UserProfile {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  departamento: string;
  cargo: string;
  liderArea?: string;
  empresa?: string;
}

interface VacationRequest {
    id: string;
    requestType: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    status: 'pending' | 'approved' | 'rejected';
    requestDate: string;
    reason?: string;
}

const requestSchema = z.object({
  requestType: z.string().min(1, 'El tipo de solicitud es obligatorio.'),
  reason: z.string().optional(),
  startDate: z.date({ required_error: 'La fecha de inicio es obligatoria.' }),
  endDate: z.date({ required_error: 'La fecha de fin es obligatoria.' }),
}).refine(data => data.endDate >= data.startDate, {
  message: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
  path: ['endDate'],
});

type FormData = z.infer<typeof requestSchema>;

function IntroductionView({ onContinue }: { onContinue: () => void }) {
    const terms = [
        {
            title: "Plazo de Solicitud",
            description: "Las solicitudes deben ser enviadas al menos 5 días hábiles antes de la fecha deseada. El plazo máximo para realizar la solicitud será el día 22 de cada mes, en el caso de que la solicitud corresponda al mismo mes. Las solicitudes enviadas fuera de este plazo no serán autorizadas."
        },
        {
            title: "Confirmación de Recepción",
            description: "Una vez enviada la solicitud, recibirás una confirmación de recepción. El jefe inmediato evaluará la solicitud, y tras su aprobación, será gestionada con el área de Recursos Humanos en la misma plataforma."
        },
        {
            title: "Tiempo de Respuesta",
            description: "La empresa se compromete a responder dentro de 3 días hábiles. Si no recibes respuesta en ese plazo, podrás consultar el estado de tu solicitud."
        },
        {
            title: "Excepciones y Situaciones Especiales",
            description: "En situaciones excepcionales y emergentes, podrás solicitar un permiso fuera del plazo habitual, el cual será evaluado por Recursos Humanos de acuerdo con las circunstancias."
        }
    ];

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Solicitud de vacaciones y permisos</h1>
                <p className="text-muted-foreground">
                    Este módulo está diseñado para la gestión eficiente de las solicitudes de vacaciones y permisos de los empleados. A través de este sistema, podrás registrar y formalizar tu solicitud, especificando las fechas deseadas, el tipo de solicitud (vacaciones o permisos) y cualquier otra información adicional que sea relevante para su evaluación y aprobación.
                </p>
                 <p className="text-muted-foreground pt-2">
                    Para garantizar un proceso rápido y eficaz, te pedimos que completes todos los campos con la mayor precisión posible. La aprobación estará sujeta a las prioridades del departamento y de la organización, la cual será validada por tu superior inmediato o el líder del departamento.
                </p>
            </div>
            
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-center">Términos y condiciones</h2>
                {terms.map((term, index) => (
                    <div key={index}>
                        <h3 className="font-semibold text-lg">{term.title}</h3>
                        <div className="flex items-start gap-2 mt-2">
                            <Check className="h-4 w-4 mt-1 text-green-500 flex-shrink-0" />
                            <p className="text-muted-foreground">{term.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end pt-6">
                <Button size="lg" onClick={onContinue}>
                    Realizar Solicitud
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function RequestFormView({ onBack, userProfile }: { onBack: () => void, userProfile: UserProfile | null }) {
  const [isEmergency, setIsEmergency] = useState(false);
  const [totalDays, setTotalDays] = useState(0);
  const firestore = useFirestore();

  const form = useForm<FormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      requestType: '',
      reason: '',
      startDate: undefined,
      endDate: undefined,
    },
  });

  const { watch } = form;
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  useEffect(() => {
    if (startDate && endDate && endDate >= startDate) {
      const days = differenceInDays(endDate, startDate) + 1;
      setTotalDays(days);
    } else {
      setTotalDays(0);
    }
  }, [startDate, endDate]);

  const onSubmit = async (data: FormData) => {
    if (!userProfile || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar la solicitud. Perfil no cargado.'});
        return;
    }

    if (!userProfile.liderArea) {
      toast({
        variant: 'destructive',
        title: 'Líder no asignado',
        description: 'Falta de asignación de líder. Póngase en contacto con el área de recursos humanos.',
      });
      return;
    }
    
    const requestData = {
        userId: userProfile.id,
        userName: `${userProfile.nombres} ${userProfile.apellidos}`,
        userCedula: userProfile.cedula,
        userArea: userProfile.departamento,
        userCargo: userProfile.cargo,
        leaderEmail: userProfile.liderArea,
        requestType: data.requestType,
        reason: data.reason,
        startDate: format(data.startDate, 'yyyy-MM-dd'),
        endDate: format(data.endDate, 'yyyy-MM-dd'),
        totalDays: totalDays,
        status: 'pending' as const,
        requestDate: new Date().toISOString(),
    };

    try {
        const requestsCollectionRef = collection(firestore, 'vacationRequests');
        await addDoc(requestsCollectionRef, requestData);
        toast({ title: 'Solicitud Enviada', description: 'Tu solicitud ha sido enviada para aprobación.' });
        form.reset();
        onBack();
    } catch(error) {
        console.error("Error submitting request:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar la solicitud.'});
    }
  };

  const minDate = useMemo(() => {
    if (isEmergency) return undefined;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return addDays(today, 7);
  }, [isEmergency]);
  
  if (!userProfile) {
    return <p className="text-red-500">No se pudo cargar el perfil del usuario.</p>
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-between items-center">
                 <div className="text-sm text-muted-foreground">Recursos Humanos &raquo; Solicitud de Vacaciones</div>
                 <Button variant="outline" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                 </Button>
            </div>
            
            <div className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                    <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Cédula</p>
                        <p className="font-semibold">{userProfile.cedula}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Colaborador</p>
                        <p className="font-semibold">{`${userProfile.nombres} ${userProfile.apellidos}`}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Área</p>
                        <p className="font-semibold">{userProfile.departamento}</p>
                    </div>
                     <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Cargo</p>
                        <p className="font-semibold">{userProfile.cargo}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="font-medium text-muted-foreground">Líder de área</p>
                        <p className="font-semibold">{userProfile.liderArea || 'No asignado'}</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                     <FormField
                        control={form.control}
                        name="requestType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo Solicitud *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="vacaciones">Vacaciones</SelectItem>
                                        <SelectItem value="permiso">Permiso</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Motivo Solicitud</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Especifique el motivo de su permiso (opcional)..." {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Fecha Inicio *</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={'outline'}
                                                className={cn(
                                                    'w-full justify-start text-left font-normal',
                                                    !field.value && 'text-muted-foreground'
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, 'dd/MM/yyyy') : <span>dd/mm/aaaa</span>}
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) => minDate ? date < minDate : false}
                                            initialFocus
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Fecha Fin *</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={'outline'}
                                                className={cn(
                                                    'w-full justify-start text-left font-normal',
                                                    !field.value && 'text-muted-foreground'
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, 'dd/MM/yyyy') : <span>dd/mm/aaaa</span>}
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) => startDate ? date < startDate : (minDate ? date < minDate : false)}
                                            initialFocus
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                
                <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center space-y-2">
                        <div className="flex items-center justify-center gap-2">
                           <Pin className="h-4 w-4 text-yellow-700" />
                           <p className="text-xs font-medium text-yellow-800">
                             Active el botón si su solicitud es extemporánea por causas mayores.
                           </p>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                           <label htmlFor="emergency-mode" className="text-sm font-bold text-yellow-900"> Emergencia </label>
                           <Switch id="emergency-mode" checked={isEmergency} onCheckedChange={setIsEmergency} />
                        </div>
                    </div>
                     <div className="p-4 border rounded-lg text-center">
                        <p className="text-sm font-medium text-muted-foreground">Total días solicitados</p>
                        <p className="text-3xl font-bold text-primary">{totalDays}</p>
                    </div>
                </div>

            </div>

            <div className="flex justify-end pt-4">
                <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {form.formState.isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                </Button>
            </div>
        </form>
       </Form>
  )
}


export default function VacationRequestPage() {
  const { user: authUser, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [view, setView] = useState<'introduction' | 'form'>('introduction');

  const usersCollectionRef = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  
  const userRequestsQuery = useMemo(() => {
    if (!firestore || !userProfile) return null;
    return query(collection(firestore, 'vacationRequests'), where("userId", "==", userProfile.id));
  }, [firestore, userProfile]);

  const { data: userRequests, isLoading: requestsLoading } = useCollection<VacationRequest>(userRequestsQuery);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser || !firestore || !usersCollectionRef) {
        if (!authLoading) setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      const userQuery = query(usersCollectionRef, where("email", "==", authUser.email));
      const querySnapshot = await getDocs(userQuery);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
      }
      setProfileLoading(false);
    };
    fetchUserProfile();
  }, [authUser, firestore, authLoading, usersCollectionRef]);

  if (profileLoading || authLoading) {
    return (
        <div className="flex items-center justify-center space-x-2 h-full">
            <LoaderCircle className="h-6 w-6 animate-spin" />
            <p>Cargando información del usuario...</p>
        </div>
    );
  }

  if (view === 'introduction') {
      return <IntroductionView onContinue={() => setView('form')} />;
  }
  
  const getStatusBadge = (status: VacationRequest['status']) => {
    switch (status) {
        case 'pending':
            return <Badge variant="secondary">Pendiente</Badge>;
        case 'approved':
            return <Badge className="bg-green-100 text-green-800">Aprobado</Badge>;
        case 'rejected':
            return <Badge variant="destructive">Rechazado</Badge>;
        default:
            return <Badge>{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
        <RequestFormView onBack={() => setView('introduction')} userProfile={userProfile} />

        <Card>
            <CardHeader>
                <CardTitle>Mis Solicitudes</CardTitle>
                <CardDescription>Aquí puedes ver el historial y el estado de tus solicitudes.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="md:hidden">
                    {requestsLoading ? (
                        <p className="text-center text-muted-foreground">Cargando...</p>
                    ) : userRequests && userRequests.length > 0 ? (
                        userRequests.map(req => (
                            <Card key={req.id} className="mb-4">
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold capitalize">{req.requestType}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {format(new Date(req.startDate), 'dd/MM/yy')} - {format(new Date(req.endDate), 'dd/MM/yy')}
                                            </p>
                                        </div>
                                        {getStatusBadge(req.status)}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        <p>Días: {req.totalDays}</p>
                                        <p>Solicitado: {format(new Date(req.requestDate), 'dd/MM/yyyy')}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No tienes solicitudes.</p>
                    )}
                </div>
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha Solicitud</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Desde</TableHead>
                                <TableHead>Hasta</TableHead>
                                <TableHead>Días</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requestsLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center h-24">Cargando solicitudes...</TableCell></TableRow>
                            ) : userRequests && userRequests.length > 0 ? (
                                userRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{format(new Date(req.requestDate), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="capitalize">{req.requestType}</TableCell>
                                        <TableCell>{format(new Date(req.startDate), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{format(new Date(req.endDate), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{req.totalDays}</TableCell>
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={6} className="text-center h-24">No tienes solicitudes registradas.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

    