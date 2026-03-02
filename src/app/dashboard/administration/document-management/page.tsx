
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
    Search, 
    Trash2, 
    Send, 
    LoaderCircle, 
    CheckCircle, 
    Filter,
} from 'lucide-react';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import type { UserProfile, Memorandum, MemorandumType } from '@/lib/types';
import { cn } from '@/lib/utils';

const memorandumTypes: { value: MemorandumType; label: string }[] = [
    { value: "Memorando Informativo", label: "🔵 Memorando Informativo" },
    { value: "Memorando de Llamado de Atención", label: "🟡 Memorando de Llamado de Atención" },
    { value: "Memorando de Reconocimiento", label: "🟢 Memorando de Reconocimiento" },
];

const reasonsByType: Record<MemorandumType, string[]> = {
    "Memorando de Llamado de Atención": [
        "Atraso injustificado",
        "Inasistencia injustificada",
        "Abandono de puesto",
        "Incumplimiento de funciones",
        "No uso de uniforme o EPP",
        "Uso indebido de celular en turno",
        "Falta de respeto",
        "Desobediencia a instrucciones",
        "Incumplimiento de procedimiento operativo",
        "Entrega tardía de reporte",
        "Conducta inadecuada",
        "Otro (requiere detalle adicional)"
    ],
    "Memorando Informativo": [
        "Recordatorio de procedimiento",
        "Cambio de turno",
        "Cambio de puesto",
        "Nueva disposición interna",
        "Convocatoria a capacitación"
    ],
    "Memorando de Reconocimiento": [
        "Cumplimiento destacado",
        "Buen desempeño operativo",
        "Actuación en emergencia",
        "Excelente trato al usuario"
    ]
};

const templates: Record<MemorandumType, string> = {
    "Memorando Informativo": "Por medio del presente se comunica al colaborador {NOMBRE}, quien desempeña el cargo de {CARGO}, que se recuerda el cumplimiento obligatorio de la disposición relacionada con {MOTIVO}, conforme lo establecen los lineamientos internos de la empresa.\n\nEsta comunicación tiene carácter informativo y preventivo, con la finalidad de garantizar la correcta prestación del servicio y el flujo de comunicación institucional.",
    "Memorando de Llamado de Atención": "Se deja constancia que se ha evidenciado la siguiente novedad: {MOTIVO}.\n\nEsta conducta constituye un incumplimiento a los protocolos operativos vigentes, por lo que se emite el presente llamado de atención, exhortándole a corregir inmediatamente dicha situación y evitar reincidencias.\n\nSe advierte que la repetición de este tipo de conducta podrá derivar en medidas administrativas mayores conforme la normativa interna vigente.",
    "Memorando de Reconocimiento": "La empresa reconoce y felicita al colaborador {NOMBRE}, quien ha demostrado un desempeño sobresaliente en {MOTIVO}.\n\nEste reconocimiento forma parte del sistema de gestión de talento humano y será registrado con orgullo en su expediente digital como muestra de su compromiso con la excelencia operativa."
};

export default function DocumentManagementPage() {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    
    // State for Creation
    const [selectedType, setSelectedType] = useState<MemorandumType | "">("");
    const [selectedReason, setSelectedReason] = useState("");
    const [selectedUserIds, setSelectedWorkers] = useState<string[]>([]);
    const [content, setContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // State for Lists/Filtering
    const [activeTab, setActiveTab] = useState("create");
    const [memoFilter, setMemorandumFilter] = useState("");
    const [memoToDelete, setMemorandumToDelete] = useState<Memorandum | null>(null);

    // Data Hooks
    const { data: workers, isLoading: workersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: memorandums, isLoading: memosLoading } = useCollection<Memorandum>(useMemo(() => firestore ? query(collection(firestore, 'memorandums'), orderBy('createdAt', 'desc'), limit(100)) : null, [firestore]));

    const currentUserProfile = useMemo(() => {
        if (!authUser || !workers) return null;
        return workers.find(w => w.email?.toLowerCase() === authUser.email?.toLowerCase());
    }, [authUser, workers]);

    // Handle template update
    useEffect(() => {
        if (selectedType && selectedReason) {
            let text = templates[selectedType as MemorandumType];
            const workerNames = selectedUserIds.length === 1 
                ? `${workers?.find(w => w.id === selectedUserIds[0])?.nombres} ${workers?.find(w => w.id === selectedUserIds[0])?.apellidos}`
                : "los colaboradores seleccionados";
            
            const workerCargo = selectedUserIds.length === 1 
                ? workers?.find(w => w.id === selectedUserIds[0])?.cargo
                : "personal operativo";

            text = text.replace(/{NOMBRE}/g, workerNames || "");
            text = text.replace(/{CARGO}/g, workerCargo || "");
            text = text.replace(/{MOTIVO}/g, selectedReason);
            
            setContent(text);
        }
    }, [selectedType, selectedReason, selectedUserIds, workers]);

    const handleIssueMemorandums = async () => {
        if (!firestore || !currentUserProfile || !selectedType || !selectedReason || selectedUserIds.length === 0 || !content.trim()) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor complete todos los campos requeridos.' });
            return;
        }

        setIsSaving(true);
        const batch = writeBatch(firestore);
        const memoRef = collection(firestore, 'memorandums');
        const now = Date.now();
        const year = new Date().getFullYear();
        
        const nextId = (memorandums?.length || 0) + 1;

        selectedUserIds.forEach((workerId, index) => {
            const worker = workers?.find(w => w.id === workerId);
            if (!worker) return;

            const code = `MEM-${worker.empresa?.slice(0,3).toUpperCase() || 'SEG'}-${year}-${String(nextId + index).padStart(4, '0')}`;
            const newDoc = doc(memoRef);
            
            const memoData: Omit<Memorandum, 'id'> = {
                code,
                type: selectedType as MemorandumType,
                reason: selectedReason,
                targetUserId: worker.id,
                targetUserName: `${worker.nombres} ${worker.apellidos}`,
                targetUserCargo: worker.cargo,
                issuerId: currentUserProfile.id,
                issuerName: `${currentUserProfile.nombres} ${currentUserProfile.apellidos}`,
                issuerCargo: currentUserProfile.cargo,
                content: content,
                status: "issued",
                createdAt: now,
            };
            batch.set(newDoc, memoData);
        });

        try {
            await batch.commit();
            toast({ title: 'Memorandos Emitidos', description: `Se han generado y notificado ${selectedUserIds.length} documentos.` });
            setSelectedType("");
            setSelectedReason("");
            setSelectedWorkers([]);
            setContent("");
            setActiveTab("history");
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron emitir los documentos.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteMemorandum = async () => {
        if (!memoToDelete || !firestore) return;
        try {
            await deleteDoc(doc(firestore, 'memorandums', memoToDelete.id));
            toast({ title: 'Documento eliminado' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error al eliminar' });
        } finally {
            setMemorandumToDelete(null);
        }
    };

    const filteredMemos = useMemo(() => {
        if (!memorandums) return [];
        if (!memoFilter) return memorandums;
        const lower = memoFilter.toLowerCase();
        return memorandums.filter(m => 
            m.targetUserName.toLowerCase().includes(lower) || 
            m.code.toLowerCase().includes(lower) ||
            m.reason.toLowerCase().includes(lower)
        );
    }, [memorandums, memoFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gestión Documental</h1>
                    <p className="text-muted-foreground">Emisión y control de memorandos y comunicaciones oficiales.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-sm">
                    <TabsTrigger value="create">Crear Memorando</TabsTrigger>
                    <TabsTrigger value="history">Historial de Emisiones</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Filter className="h-4 w-4" /> Configuración
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Memorando</Label>
                                    <Select value={selectedType} onValueChange={(v) => { setSelectedType(v as MemorandumType); setSelectedReason(""); }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione el tipo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {memorandumTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className={cn("space-y-2 transition-all", !selectedType && "opacity-50 pointer-events-none")}>
                                    <Label>Motivo</Label>
                                    <Select value={selectedReason} onValueChange={setSelectedReason}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione el motivo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedType && reasonsByType[selectedType as MemorandumType]?.map(r => (
                                                <SelectItem key={r} value={r}>{r}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Destinatario(s)</Label>
                                    <MultiSelectCombobox 
                                        options={workers?.filter(w => w.Status === 'active').map(w => ({ label: `${w.apellidos} ${w.nombres} (${w.ubicacion})`, value: w.id })) || []}
                                        selected={selectedUserIds}
                                        onChange={setSelectedWorkers}
                                        placeholder="Seleccionar personal..."
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">Puedes seleccionar varios para comunicados masivos.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2">
                            <CardHeader className="bg-slate-50 border-b">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg">Redacción del Documento</CardTitle>
                                    <Badge variant="outline">MEM-2025-XXXX</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <Label className="font-bold">Asunto:</Label>
                                        <Input 
                                            value={selectedType ? `${selectedType}: ${selectedReason}` : ''} 
                                            readOnly 
                                            className="bg-muted font-semibold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">Cuerpo del Documento:</Label>
                                        <Textarea 
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            placeholder="El contenido se generará automáticamente al seleccionar el tipo y motivo, pero puedes editarlo aquí..."
                                            className="min-h-[300px] text-base leading-relaxed"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-8 pt-6 border-t italic text-sm text-muted-foreground">
                                        <div>
                                            <p className="font-bold border-b pb-1 mb-2">Emisor:</p>
                                            <p>{currentUserProfile?.nombres} {currentUserProfile?.apellidos}</p>
                                            <p>{currentUserProfile?.cargo}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold border-b pb-1 mb-2">Receptor:</p>
                                            <p>{selectedUserIds.length === 1 ? workers?.find(w => w.id === selectedUserIds[0])?.nombres + ' ' + workers?.find(w => w.id === selectedUserIds[0])?.apellidos : 'Selección Múltiple'}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-slate-50 border-t py-4">
                                <Button 
                                    className="ml-auto min-w-[200px]" 
                                    onClick={handleIssueMemorandums}
                                    disabled={isSaving || !selectedType || !selectedReason || selectedUserIds.length === 0}
                                >
                                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Emitir y Notificar
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <CardTitle>Historial de Documentos</CardTitle>
                                    <CardDescription>Visualiza y gestiona todos los memorandos emitidos por la administración.</CardDescription>
                                </div>
                                <div className="relative w-full md:max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Buscar por código o trabajador..." 
                                        value={memoFilter}
                                        onChange={(e) => setMemorandumFilter(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Trabajador</TableHead>
                                        <TableHead>Motivo</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {memosLoading ? (
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="animate-spin inline-block mr-2" /> Cargando historial...</TableCell></TableRow>
                                    ) : filteredMemos.length > 0 ? (
                                        filteredMemos.map(memo => (
                                            <TableRow key={memo.id}>
                                                <TableCell className="font-bold">{memo.code}</TableCell>
                                                <TableCell>{format(memo.createdAt, 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn(
                                                        memo.type === 'Memorando de Llamado de Atención' ? 'border-amber-500 text-amber-700' :
                                                        memo.type === 'Memorando de Reconocimiento' ? 'border-green-500 text-green-700' : ''
                                                    )}>
                                                        {memo.type?.split(' ').pop()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{memo.targetUserName}</span>
                                                        <span className="text-xs text-muted-foreground">{memo.targetUserCargo}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate">{memo.reason}</TableCell>
                                                <TableCell>
                                                    {memo.status === 'signed' ? (
                                                        <Badge className="bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Firmado</Badge>
                                                    ) : memo.status === 'read' ? (
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">Leído</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Emitido</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => setMemorandumToDelete(memo)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No se encontraron documentos.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!memoToDelete} onOpenChange={() => setMemorandumToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de eliminar este memorando?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción es permanente y eliminará el documento del historial oficial y del expediente del trabajador.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMemorandum} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar Definitivamente</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
