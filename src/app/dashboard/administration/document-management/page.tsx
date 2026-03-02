
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, addDoc, writeBatch, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
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
    FileText, 
    PlusCircle, 
    Search, 
    Trash2, 
    Send, 
    LoaderCircle, 
    CheckCircle, 
    History,
    Users,
    Filter,
    ShieldCheck,
    FileSignature
} from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { Checkbox } from '@/components/ui/checkbox';
import type { UserProfile, Memorandum, MemorandumCausal, MemorandumType } from '@/lib/types';
import { normalizeText } from '@/lib/utils';

const memorandumTypes: { value: MemorandumType; label: string }[] = [
    { value: "Informativo", label: "🔵 Memorando Informativo" },
    { value: "Llamado de atención", label: "🟡 Llamado de Atención (Falta Leve)" },
    { value: "Amonestación escrita", label: "🟠 Amonestación Escrita" },
    { value: "Sanción", label: "🔴 Memorando de Sanción" },
    { value: "Inicio de proceso disciplinario", label: "⚖️ Inicio de Proceso Disciplinario" },
    { value: "Reconocimiento", label: "🟢 Memorando de Reconocimiento" },
];

const templates: Record<MemorandumType, string> = {
    "Informativo": "Por medio del presente se comunica al colaborador {NOMBRE}, quien desempeña el cargo de {CARGO}, que se recuerda el cumplimiento obligatorio del procedimiento relacionado con {CAUSAL}, conforme lo establece el Reglamento Interno de la empresa.\n\nEsta comunicación tiene carácter informativo y preventivo, con la finalidad de garantizar la correcta prestación del servicio y el cumplimiento de los estándares operativos establecidos.",
    "Llamado de atención": "Se deja constancia que se ha evidenciado la siguiente novedad: {CAUSAL}.\n\nEsta conducta constituye una falta leve conforme al Reglamento Interno, por lo que se emite el presente llamado de atención, exhortándole a corregir inmediatamente dicha situación y evitar reincidencias.\n\nSe advierte que la repetición de este tipo de conducta podrá derivar en una amonestación escrita o sanción disciplinaria.",
    "Amonestación escrita": "Habiéndose verificado que el colaborador {NOMBRE} incurrió nuevamente en {CAUSAL}, se procede a emitir la presente amonestación escrita.\n\nEsta medida se adopta debido a la reincidencia registrada en el historial disciplinario del colaborador o por la gravedad de los hechos.\n\nSe le previene que futuras faltas podrán derivar en sanciones mayores conforme la normativa interna vigente.",
    "Sanción": "En virtud de la falta catalogada como {SEVERIDAD}, consistente en {CAUSAL}, se ha resuelto aplicar una sanción disciplinaria de acuerdo con el Reglamento Interno.\n\nEsta decisión se fundamenta en la obligación contractual de cumplir con las funciones asignadas y las normas de conducta institucional.\n\nSe deja constancia para los fines administrativos y legales correspondientes.",
    "Inicio de proceso disciplinario": "Mediante el presente se notifica al colaborador {NOMBRE} el inicio de un proceso disciplinario derivado de los hechos relacionados con {CAUSAL}.\n\nSe concede el derecho a presentar su descargo escrito dentro del plazo establecido por la normativa interna, a fin de garantizar el debido proceso.",
    "Reconocimiento": "La empresa reconoce el desempeño destacado del colaborador {NOMBRE}, quien ha demostrado un cumplimiento ejemplar en {CAUSAL}.\n\nEste reconocimiento forma parte del sistema de gestión de talento humano y será registrado con orgullo en su expediente digital."
};

export default function DocumentManagementPage() {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    
    // State for Creation
    const [selectedType, setSelectedType] = useState<MemorandumType | "">("");
    const [selectedCausalId, setSelectedCausalId] = useState("");
    const [selectedUserIds, setSelectedWorkers] = useState<string[]>([]);
    const [content, setContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // State for Lists/Filtering
    const [activeTab, setActiveTab] = useState("create");
    const [memoFilter, setMemorandumFilter] = useState("");
    const [memoToDelete, setMemorandumToDelete] = useState<Memorandum | null>(null);

    // Data Hooks
    const { data: workers, isLoading: workersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: causals, isLoading: causalsLoading } = useCollection<MemorandumCausal>(useMemo(() => firestore ? collection(firestore, 'memorandumCausals') : null, [firestore]));
    const { data: memorandums, isLoading: memosLoading } = useCollection<Memorandum>(useMemo(() => firestore ? query(collection(firestore, 'memorandums'), orderBy('createdAt', 'desc'), limit(100)) : null, [firestore]));

    const currentUserProfile = useMemo(() => {
        if (!authUser || !workers) return null;
        return workers.find(w => w.email?.toLowerCase() === authUser.email?.toLowerCase());
    }, [authUser, workers]);

    const selectedCausal = useMemo(() => {
        if (!selectedCausalId || !causals) return null;
        return causals.find(c => c.id === selectedCausalId);
    }, [selectedCausalId, causals]);

    // Handle template update
    useEffect(() => {
        if (selectedType && selectedCausal) {
            let text = templates[selectedType as MemorandumType];
            const workerNames = selectedUserIds.length === 1 
                ? `${workers?.find(w => w.id === selectedUserIds[0])?.nombres} ${workers?.find(w => w.id === selectedUserIds[0])?.apellidos}`
                : "los colaboradores seleccionados";
            
            const workerCargo = selectedUserIds.length === 1 
                ? workers?.find(w => w.id === selectedUserIds[0])?.cargo
                : "personal operativo";

            text = text.replace(/{NOMBRE}/g, workerNames || "");
            text = text.replace(/{CARGO}/g, workerCargo || "");
            text = text.replace(/{CAUSAL}/g, selectedCausal.title);
            text = text.replace(/{SEVERIDAD}/g, selectedCausal.severity);
            
            setContent(text);
        }
    }, [selectedType, selectedCausal, selectedUserIds, workers]);

    const handleIssueMemorandums = async () => {
        if (!firestore || !currentUserProfile || !selectedType || !selectedCausal || selectedUserIds.length === 0 || !content.trim()) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor complete todos los campos requeridos.' });
            return;
        }

        setIsSaving(true);
        const batch = writeBatch(firestore);
        const memoRef = collection(firestore, 'memorandums');
        const now = Date.now();
        const year = new Date().getFullYear();
        
        // Simple sequential numbering (ideally would be handled by a counter in Firestore)
        const nextId = (memorandums?.length || 0) + 1;

        selectedUserIds.forEach((workerId, index) => {
            const worker = workers?.find(w => w.id === workerId);
            if (!worker) return;

            const code = `MEM-${worker.empresa?.slice(0,3).toUpperCase() || 'SEG'}-${year}-${String(nextId + index).padStart(4, '0')}`;
            const newDoc = doc(memoRef);
            
            const memoData: Omit<Memorandum, 'id'> = {
                code,
                type: selectedType as MemorandumType,
                causalId: selectedCausal.id,
                causalTitle: selectedCausal.title,
                targetUserId: worker.id,
                targetUserName: `${worker.nombres} ${worker.apellidos}`,
                targetUserCargo: worker.cargo,
                issuerId: currentUserProfile.id,
                issuerName: `${currentUserProfile.nombres} ${currentUserProfile.apellidos}`,
                issuerCargo: currentUserProfile.cargo,
                content: content,
                status: "issued",
                createdAt: now,
                severity: selectedCausal.severity,
            };
            batch.set(newDoc, memoData);
        });

        try {
            await batch.commit();
            toast({ title: 'Memorandos Emitidos', description: `Se han generado y notificado ${selectedUserIds.length} documentos.` });
            setSelectedType("");
            setSelectedCausalId("");
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
            m.causalTitle.toLowerCase().includes(lower)
        );
    }, [memorandums, memoFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gestión Documental</h1>
                    <p className="text-muted-foreground">Emisión y control de memorandos, actas y comunicaciones oficiales.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-xl">
                    <TabsTrigger value="create">Crear Memorando</TabsTrigger>
                    <TabsTrigger value="history">Historial de Emisiones</TabsTrigger>
                    <TabsTrigger value="causals">Causales y Reglamento</TabsTrigger>
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
                                    <Select value={selectedType} onValueChange={(v) => setSelectedType(v as MemorandumType)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione el tipo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {memorandumTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Causal / Razón (Reglamento)</Label>
                                    <Combobox 
                                        options={causals?.map(c => ({ label: `${c.category}: ${c.title}`, value: c.id })) || []}
                                        value={selectedCausalId}
                                        onChange={setSelectedCausalId}
                                        placeholder="Seleccione la causal..."
                                    />
                                    {selectedCausal && (
                                        <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
                                            <p><strong>Severidad:</strong> {selectedCausal.severity}</p>
                                            <p><strong>Base Legal:</strong> {selectedCausal.legalBasis}</p>
                                        </div>
                                    )}
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
                                            value={selectedType ? `Memorando ${selectedType}: ${selectedCausal?.title || ''}` : ''} 
                                            readOnly 
                                            className="bg-muted font-semibold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">Cuerpo del Documento:</Label>
                                        <Textarea 
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            placeholder="El contenido se generará automáticamente al seleccionar el tipo y causal, pero puedes editarlo aquí..."
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
                                    disabled={isSaving || !selectedType || !selectedCausal || selectedUserIds.length === 0}
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
                                        <TableHead>Causal</TableHead>
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
                                                        memo.type === 'Sanción' ? 'border-red-500 text-red-700' :
                                                        memo.type === 'Reconocimiento' ? 'border-green-500 text-green-700' : ''
                                                    )}>
                                                        {memo.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{memo.targetUserName}</span>
                                                        <span className="text-xs text-muted-foreground">{memo.targetUserCargo}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate">{memo.causalTitle}</TableCell>
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

                <TabsContent value="causals" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Catálogo de Causales Disciplinarias</CardTitle>
                            <CardDescription>Causales tipificadas según el Reglamento Interno para estandarizar la gestión operativa.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Categoría</TableHead>
                                        <TableHead>Descripción / Título</TableHead>
                                        <TableHead>Base Legal</TableHead>
                                        <TableHead>Severidad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {causals?.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-semibold">{c.category}</TableCell>
                                            <TableCell>{c.title}</TableCell>
                                            <TableCell className="text-xs font-mono">{c.legalBasis}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    c.severity === 'Muy Grave' ? 'destructive' :
                                                    c.severity === 'Grave' ? 'default' :
                                                    c.severity === 'Leve' ? 'secondary' : 'outline'
                                                }>
                                                    {c.severity}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
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
