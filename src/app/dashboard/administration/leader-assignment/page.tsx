

"use client";

import React, { useState, useMemo, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2, Users, ArrowRight, FileUp, FileDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Combobox } from '@/components/ui/combobox';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, addDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';

interface UserProfile {
  id: string;
  nombres: string;
  apellidos: string;
  isLeader?: boolean;
  empresa: string;
  ubicacion?: string;
  departamento: string;
  cargo: string;
  centroCosto?: string;
  Status: 'active' | 'inactive';
  email: string;
}

interface GenericOption {
    id: string;
    name: string;
}

interface LeaderAssignmentRule {
  id: string;
  name: string;
  conditions: {
    empresa: string;
    ubicacion: string;
    departamento: string;
    cargo: string;
    centroCosto: string;
  };
  leaderId: string;
  leaderName: string;
  leaderEmail: string;
}

const ruleSchema = z.object({
  empresa: z.string().min(1, 'La empresa es obligatoria.'),
  cargo: z.string().min(1, 'El cargo es obligatorio.'),
  ubicacion: z.string().min(1, 'La ubicación es obligatoria.'),
  departamento: z.string().min(1, 'El departamento es obligatorio.'),
  centroCosto: z.string().min(1, 'El centro de costo es obligatorio.'),
  leaderId: z.string().min(1, 'Debe seleccionar un líder.'),
});

type RuleFormData = z.infer<typeof ruleSchema>;

const normalizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
      .normalize('NFD') 
      .replace(/[\u0300-\u036f]/g, '') 
      .toUpperCase() 
      .replace(/\s+/g, ' ') 
      .trim();
};

export default function LeaderAssignmentPage() {
  const [isRuleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<LeaderAssignmentRule | null>(null);
  const [rulesToImport, setRulesToImport] = useState<any[]>([]);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const usersCollectionRef = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const rulesCollectionRef = useMemo(() => firestore ? collection(firestore, 'leaderAssignmentRules') : null, [firestore]);
  
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersCollectionRef);
  const { data: rules, isLoading: rulesLoading } = useCollection<LeaderAssignmentRule>(rulesCollectionRef);
  const { data: empresas, isLoading: empresasLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'empresas') : null, [firestore]));
  const { data: cargos, isLoading: cargosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
  const { data: ubicaciones, isLoading: ubicacionesLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'ubicaciones') : null, [firestore]));
  const { data: departamentos, isLoading: departamentosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'areas') : null, [firestore]));
  const { data: centrosCosto, isLoading: centrosCostoLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'centrosCosto') : null, [firestore]));

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
        empresa: '',
        cargo: '',
        ubicacion: '',
        departamento: '',
        centroCosto: '',
        leaderId: '',
    },
  });

  const leaders = useMemo(() => users?.filter(u => u.isLeader && u.Status === 'active') || [], [users]);

 const toOptions = (data: GenericOption[] | null | undefined) => {
      if (!data) return [];
      return data.map(item => ({ label: item.name, value: item.name }));
  }


  const onSubmit = async (data: RuleFormData) => {
    if (!rulesCollectionRef) return;
    
    const leader = leaders.find(l => l.id === data.leaderId);
    if (!leader) {
        toast({ variant: 'destructive', title: 'Error', description: 'Líder no encontrado.' });
        return;
    }

    const newRule = {
        name: `Regla: ${normalizeText(data.empresa)} - ${normalizeText(data.cargo)}`,
        conditions: {
            empresa: normalizeText(data.empresa),
            cargo: normalizeText(data.cargo),
            ubicacion: normalizeText(data.ubicacion),
            departamento: normalizeText(data.departamento),
            centroCosto: normalizeText(data.centroCosto),
        },
        leaderId: data.leaderId,
        leaderName: `${leader.nombres} ${leader.apellidos}`,
        leaderEmail: leader.email,
    };

    try {
        await addDoc(rulesCollectionRef, newRule);
        toast({ title: 'Regla Creada', description: 'La regla de asignación ha sido creada con éxito.' });
        setRuleDialogOpen(false);
        form.reset();
    } catch (error) {
        console.error("Error creating rule:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear la regla.' });
    }
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete || !rulesCollectionRef) return;
    try {
        await deleteDoc(doc(rulesCollectionRef, ruleToDelete.id));
        toast({ title: 'Regla Eliminada', description: `La regla "${ruleToDelete.name}" ha sido eliminada.` });
    } catch(error) {
        console.error("Error deleting rule:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la regla.' });
    } finally {
        setRuleToDelete(null);
    }
  };
  
  const handleExportTemplate = () => {
    const templateHeaders = ['empresa', 'cargo', 'ubicacion', 'departamento', 'centroCosto', 'leaderEmail'];
    const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reglas');
    XLSX.writeFile(workbook, 'plantilla_reglas_lider.xlsx');
  }

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const requiredHeaders = ['empresa', 'cargo', 'ubicacion', 'departamento', 'centroCosto', 'leaderEmail'];
        if (json.length > 0 && requiredHeaders.every(h => h in json[0])) {
            setRulesToImport(json);
            setIsImportAlertOpen(true);
        } else {
            toast({
                variant: "destructive",
                title: "Archivo no válido",
                description: `El archivo debe contener las columnas: ${requiredHeaders.join(', ')}.`
            });
        }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmImport = async () => {
      if (!rulesToImport.length || !firestore || !rulesCollectionRef || !users) return;

      const batch = writeBatch(firestore);
      const leadersByEmail = new Map(leaders.map(l => [l.email.toLowerCase(), l]));

      rulesToImport.forEach((row, index) => {
          const leaderEmail = row.leaderEmail?.toLowerCase();
          const leader = leadersByEmail.get(leaderEmail);
          
          if(leader) {
              const empresa = normalizeText(row.empresa);
              const cargo = normalizeText(row.cargo);
              const ruleName = `Regla: ${empresa || ''} - ${cargo || ''}`;
              const newRule = {
                  name: ruleName,
                  conditions: {
                      empresa: empresa,
                      cargo: cargo,
                      ubicacion: normalizeText(row.ubicacion),
                      departamento: normalizeText(row.departamento),
                      centroCosto: normalizeText(row.centroCosto),
                  },
                  leaderId: leader.id,
                  leaderName: `${leader.nombres} ${leader.apellidos}`,
                  leaderEmail: leader.email,
              };
              const newDocRef = doc(rulesCollectionRef);
              batch.set(newDocRef, newRule);
          } else {
              console.warn(`Líder con email ${row.leaderEmail} no encontrado en la fila ${index + 2} del Excel. La regla no será importada.`);
          }
      });
      
      try {
        await batch.commit();
        toast({
            title: "Importación completada",
            description: "Las reglas de asignación han sido importadas. Es posible que algunas filas fueran omitidas si no se encontró el líder especificado."
        });
      } catch (error) {
         console.error("Error importing rules:", error);
         toast({ variant: "destructive", title: "Error en la importación", description: "Ocurrió un error al guardar las reglas." });
      }

      setIsImportAlertOpen(false);
      setRulesToImport([]);
  };


  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".xlsx, .xls" />
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-lg font-semibold md:text-2xl">Asignación Automática de Líderes</h1>
        <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportTemplate}>
              <FileDown className="mr-2 h-4 w-4" />
              Plantilla
            </Button>
            <Button variant="outline" onClick={handleImportClick}>
              <FileUp className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button onClick={() => setRuleDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear Regla Manual
            </Button>
        </div>
      </div>

      <Dialog open={isRuleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Crear Nueva Regla de Asignación</DialogTitle>
                <DialogDescription>
                    Define las condiciones para asignar un líder automáticamente a un usuario.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="empresa" render={({ field }) => (
                            <FormItem><FormLabel>Empresa</FormLabel>
                                <Combobox options={toOptions(empresas)} placeholder="Seleccionar empresa" {...field} />
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="cargo" render={({ field }) => (
                            <FormItem><FormLabel>Cargo</FormLabel>
                                <Combobox options={toOptions(cargos)} placeholder="Seleccionar cargo" {...field} />
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="ubicacion" render={({ field }) => (
                            <FormItem><FormLabel>Ubicación</FormLabel>
                                <Combobox options={toOptions(ubicaciones)} placeholder="Seleccionar ubicación" {...field} />
                            <FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="departamento" render={({ field }) => (
                            <FormItem><FormLabel>Departamento</FormLabel>
                                <Combobox options={toOptions(departamentos)} placeholder="Seleccionar depto." {...field} />
                            <FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="centroCosto" render={({ field }) => (
                            <FormItem><FormLabel>Centro de Costo</FormLabel>
                                <Combobox options={toOptions(centrosCosto)} placeholder="Seleccionar centro costo" {...field} />
                            <FormMessage /></FormItem>
                        )} />
                    </div>
                     <FormField control={form.control} name="leaderId" render={({ field }) => (
                        <FormItem><FormLabel>Líder a Asignar</FormLabel>
                            <Combobox options={leaders.map(l => ({label: `${l.nombres} ${l.apellidos}`, value: l.id}))} placeholder="Seleccionar líder" searchPlaceholder="Buscar líder..." notFoundMessage="No se encontraron líderes." {...field} />
                        <FormMessage /></FormItem>
                    )} />
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setRuleDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? 'Creando...' : 'Crear Regla'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!ruleToDelete} onOpenChange={() => setRuleToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente la regla de asignación.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRule} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Importación</AlertDialogTitle>
                <AlertDialogDescription>
                    Se encontraron {rulesToImport.length} reglas para importar. Las reglas existentes no se modificarán.
                    Se omitirán las filas donde no se encuentre un líder con el email especificado. ¿Deseas continuar?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmImport}>Confirmar Importación</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de Asignación Existentes</CardTitle>
          <CardDescription>
            Lista de todas las reglas configuradas para la asignación automática de líderes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Condiciones</TableHead>
                <TableHead>Líder Asignado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell colSpan={4} className="p-4"><div className="h-8 bg-gray-200 rounded animate-pulse"></div></TableCell>
                  </TableRow>
                ))
              ) : rules && rules.length > 0 ? (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span><span className="font-semibold">Empresa:</span> {rule.conditions.empresa}</span>
                        <span><span className="font-semibold">Cargo:</span> {rule.conditions.cargo}</span>
                        <span><span className="font-semibold">Ubicación:</span> {rule.conditions.ubicacion}</span>
                        <span><span className="font-semibold">Depto:</span> {rule.conditions.departamento}</span>
                        <span><span className="font-semibold">C. Costo:</span> {rule.conditions.centroCosto}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                           <Users className="h-4 w-4 text-muted-foreground" />
                           {rule.leaderName}
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setRuleToDelete(rule)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No se han creado reglas de asignación.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

    

    