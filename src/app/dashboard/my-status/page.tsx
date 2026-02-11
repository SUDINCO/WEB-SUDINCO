
"use client";

import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoaderCircle, CheckCircle, Clock, AlertCircle, Award, ThumbsUp } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { UserProfile, PerformanceEvaluation, ManagerEvaluation } from '@/lib/types';


// Extend PerformanceEvaluation to include optional manager details
type PerformanceEvaluationWithManager = PerformanceEvaluation & {
  manager?: UserProfile;
};


const managerEvaluationSchema = z.object({
  leadership_q1: z.coerce.number().min(0).max(100),
  leadership_q2: z.coerce.number().min(0).max(100),
  leadership_q3: z.coerce.number().min(0).max(100),
  communication_q1: z.coerce.number().min(0).max(100),
  communication_q2: z.coerce.number().min(0).max(100),
  communication_q3: z.coerce.number().min(0).max(100),
  performance_q1: z.coerce.number().min(0).max(100),
  performance_q2: z.coerce.number().min(0).max(100),
  performance_q3: z.coerce.number().min(0).max(100),
  openFeedback: z.string().optional(),
});

const evaluationQuestions = {
    "Liderazgo y dirección": [
        { id: "leadership_q1", text: "Comunica claramente los objetivos del área." },
        { id: "leadership_q2", text: "Define prioridades claras para el trabajo diario." },
        { id: "leadership_q3", text: "Toma decisiones oportunas cuando el equipo lo necesita." },
    ],
    "Comunicación y trato": [
        { id: "communication_q1", text: "Escucha las opiniones y sugerencias del equipo." },
        { id: "communication_q2", text: "Se comunica de forma clara y respetuosa." },
        { id: "communication_q3", text: "Está disponible cuando el equipo necesita apoyo." },
    ],
    "Gestión del desempeño": [
        { id: "performance_q1", text: "Da retroalimentación clara sobre el desempeño." },
        { id: "performance_q2", text: "Reconoce el buen trabajo cuando corresponde." },
        { id: "performance_q3", text: "Mantiene coherencia entre la retroalimentación y las acciones que toma." },
    ]
};

const ratingOptions = [
    { value: 25, label: 'Nunca' },
    { value: 50, label: 'A veces' },
    { value: 75, label: 'Casi siempre' },
    { value: 100, label: 'Siempre' },
];

const ratingStyles: { [key: number]: string } = {
    25: 'bg-red-500 text-white',
    50: 'bg-orange-400 text-white',
    75: 'bg-lime-500 text-white',
    100: 'bg-green-600 text-white',
};

function ManagerEvaluationDialog({ open, onOpenChange, performanceEval, manager, employee, onEvaluationComplete }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    performanceEval: PerformanceEvaluation;
    manager: UserProfile;
    employee: UserProfile;
    onEvaluationComplete: () => void;
}) {
    const firestore = useFirestore();
    const form = useForm<z.infer<typeof managerEvaluationSchema>>({
        resolver: zodResolver(managerEvaluationSchema),
        defaultValues: {
            openFeedback: '',
        },
    });

    const onSubmit = async (data: z.infer<typeof managerEvaluationSchema>) => {
        if (!firestore) return;
        const evaluationData = {
            ...data,
            employeeId: employee.id,
            managerId: manager.id,
            performanceEvaluationId: performanceEval.id,
            evaluationDate: new Date().toISOString(),
        };
        try {
            const collectionRef = collection(firestore, 'managerEvaluations');
            await addDoc(collectionRef, evaluationData);
            toast({
                title: 'Evaluación enviada',
                description: 'Gracias por tu retroalimentación.',
            });
            onEvaluationComplete();
            onOpenChange(false);
        } catch (error) {
            console.error("Error submitting manager evaluation:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo enviar tu evaluación.',
            });
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Evaluar a tu líder: {manager.nombres} {manager.apellidos}</DialogTitle>
                    <DialogDescription>
                        Tu feedback es confidencial y nos ayuda a mejorar.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                     <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="border rounded-lg">
                           {/* Desktop Header */}
                            <div className="hidden md:grid md:grid-cols-[minmax(0,3fr)_repeat(4,minmax(0,1fr))]">
                                <div className="p-2 font-semibold text-sm border-b">Competencia</div>
                                {ratingOptions.map(opt => (
                                    <div key={opt.value} className={cn("p-2 text-center font-bold text-xs border-b", ratingStyles[opt.value])}>
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                           
                            {Object.entries(evaluationQuestions).map(([category, questions]) => (
                                <React.Fragment key={category}>
                                    <div className="p-3 bg-muted border-b border-t">
                                        <h4 className="font-semibold text-sm">{category}</h4>
                                    </div>
                                    {questions.map((q) => (
                                        <FormField
                                            key={q.id}
                                            control={form.control}
                                            name={q.id as keyof z.infer<typeof managerEvaluationSchema>}
                                            render={({ field }) => (
                                                <FormItem className="md:grid md:grid-cols-[minmax(0,3fr)_repeat(4,minmax(0,1fr))] border-b last:border-b-0">
                                                    <FormLabel className="flex items-center p-3 font-normal text-sm md:border-r">{q.text}</FormLabel>
                                                    
                                                    <RadioGroup
                                                        onValueChange={field.onChange}
                                                        value={String(field.value)}
                                                        className="grid grid-cols-4 md:contents"
                                                    >
                                                        {ratingOptions.map(opt => (
                                                            <FormControl key={opt.value}>
                                                                <Label
                                                                    className="flex flex-col-reverse md:flex-row h-full items-center justify-center p-3 md:py-0 border-t md:border-t-0 md:border-r last:md:border-r-0 cursor-pointer hover:bg-accent/50 data-[state=checked]:bg-accent"
                                                                    data-state={field.value === opt.value ? 'checked' : 'unchecked'}
                                                                >
                                                                    <RadioGroupItem value={String(opt.value)} />
                                                                    <span className={cn("md:hidden text-xs font-semibold mb-2 md:mb-0", field.value === opt.value ? "text-accent-foreground": "text-muted-foreground")}>{opt.label}</span>
                                                                </Label>
                                                            </FormControl>
                                                        ))}
                                                    </RadioGroup>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </React.Fragment>
                           ))}
                        </div>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Pregunta Abierta</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                   control={form.control}
                                   name="openFeedback"
                                   render={({ field }) => (
                                       <FormItem>
                                           <FormLabel className="font-semibold">¿Qué debería mejorar tu jefe para apoyar mejor al equipo?</FormLabel>
                                           <FormControl>
                                               <Textarea placeholder="Tus comentarios son valiosos..." {...field} />
                                           </FormControl>
                                       </FormItem>
                                   )}
                               />
                            </CardContent>
                        </Card>
                        
                         <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Enviando...' : 'Enviar Evaluación'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const getStatusBadge = (status: PerformanceEvaluation['observerStatus'], hasObserver: boolean) => {
    if (!hasObserver) {
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" /> Completa</Badge>;
    }

    switch (status) {
        case 'approved':
            return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" /> Completa</Badge>;
        case 'pending':
            return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" /> Pendiente de Observador</Badge>;
        case 'review_requested':
             return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" /> Revisión Solicitada</Badge>;
        default:
            // If status is undefined but there is an observer, it's pending.
            return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" /> Pendiente de Observador</Badge>;
    }
};

export default function MyEvaluationStatusPage() {
  const { user: authUser, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [evaluationToTrigger180, setEvaluationToTrigger180] = useState<PerformanceEvaluationWithManager | null>(null);

  const { data: allWorkers, isLoading: workersLoading } = useCollection<UserProfile>(
    useMemo(() => (firestore ? collection(firestore, 'users') : null), [firestore])
  );
  
  const { data: managerEvaluations, isLoading: managerEvaluationsLoading } = useCollection<ManagerEvaluation>(
      useMemo(() => firestore ? collection(firestore, 'managerEvaluations') : null, [firestore])
  );

  const currentUserProfile = useMemo(() => {
    if (!authUser || !allWorkers) return null;
    return allWorkers.find(w => w.email?.toLowerCase() === authUser.email?.toLowerCase());
  }, [authUser, allWorkers]);

  const evaluationsQuery = useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    return query(collection(firestore, 'performanceEvaluations'), where("workerId", "==", currentUserProfile.id));
  }, [firestore, currentUserProfile]);

  const { data: evaluations, isLoading: evaluationsLoading } = useCollection<PerformanceEvaluation>(evaluationsQuery);

  const evaluationsWithDetails = useMemo(() => {
    if (!evaluations || !allWorkers) return [];
    return evaluations.map(ev => {
      const evaluator = allWorkers.find(w => w.id === ev.evaluatorId);
      const hasBeen180Evaluated = managerEvaluations?.some(me => me.performanceEvaluationId === ev.id);
      return {
        ...ev,
        evaluatorName: evaluator ? `${evaluator.nombres} ${evaluator.apellidos}` : 'Desconocido',
        manager: evaluator,
        hasBeen180Evaluated
      };
    }).sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime());
  }, [evaluations, allWorkers, managerEvaluations]);
  
  const handleEvaluationComplete = () => {
    // This is a dummy function to force a re-render or could trigger a re-fetch if needed
    // Since useCollection provides real-time updates, we just close the dialog.
    setEvaluationToTrigger180(null);
  }

  const isLoading = authLoading || workersLoading || evaluationsLoading || managerEvaluationsLoading;
  
  return (
    <div className="space-y-6">
       {evaluationToTrigger180 && currentUserProfile && evaluationToTrigger180.manager && (
          <ManagerEvaluationDialog
              open={!!evaluationToTrigger180}
              onOpenChange={() => setEvaluationToTrigger180(null)}
              performanceEval={evaluationToTrigger180}
              manager={evaluationToTrigger180.manager}
              employee={currentUserProfile}
              onEvaluationComplete={handleEvaluationComplete}
          />
       )}
      <div>
        <h1 className="text-lg font-semibold md:text-2xl">Mi Estado de Evaluación</h1>
        <p className="text-sm text-muted-foreground">
          Aquí puedes ver el historial y estado de tus evaluaciones de desempeño y dar tu feedback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Evaluaciones</CardTitle>
          <CardDescription>
            Mostrando todas tus evaluaciones de desempeño registradas en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha de Evaluación</TableHead>
                <TableHead>Evaluador</TableHead>
                <TableHead className="w-[30%]">Mensaje del Evaluador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Feedback 180°</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                      Cargando tu historial...
                    </div>
                  </TableCell>
                </TableRow>
              ) : evaluationsWithDetails.length > 0 ? (
                evaluationsWithDetails.map(ev => {
                  const canEvaluateManager = ev.observerStatus === 'approved';
                  return (
                      <TableRow key={ev.id}>
                        <TableCell>{format(new Date(ev.evaluationDate), 'dd/MM/yyyy', { locale: es })}</TableCell>
                        <TableCell className="font-medium">{ev.evaluatorName}</TableCell>
                         <TableCell>
                            {ev.messageForWorker ? (
                                <p className="text-sm text-muted-foreground italic">"{ev.messageForWorker}"</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">-</p>
                            )}
                        </TableCell>
                        <TableCell>{getStatusBadge(ev.observerStatus, !!currentUserProfile?.observerEmail)}</TableCell>
                        <TableCell className="text-center">
                          {canEvaluateManager ? (
                            ev.hasBeen180Evaluated ? (
                                <div className="flex items-center justify-center gap-2 text-green-600">
                                    <ThumbsUp className="h-4 w-4" />
                                    <span className="font-medium text-sm">Feedback Enviado</span>
                                </div>
                            ) : (
                                <Button size="sm" onClick={() => setEvaluationToTrigger180(ev)}>
                                    <Award className="mr-2 h-4 w-4" />
                                    Evaluar a mi Líder
                                </Button>
                            )
                          ) : (
                            <Badge variant="outline">No disponible</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    Aún no tienes evaluaciones de desempeño registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
