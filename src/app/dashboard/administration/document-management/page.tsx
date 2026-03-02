
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, addMonths } from 'date-fns';
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
    FileText,
    CalendarIcon,
    Clock,
    Sparkles
} from 'lucide-react';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import type { UserProfile, Memorandum, MemorandumType, SavedSchedule } from '@/lib/types';
import { cn, normalizeText } from '@/lib/utils';

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
        "Uso indebido de celular",
        "Falta de respeto",
        "Desobediencia a instrucciones",
        "Incumplimiento de procedimiento operativo",
        "Entrega tardía de reporte",
        "Conducta inadecuada",
        "Otro (requiere detalle adicional)"
    ],
    "Memorando Informativo": [
        "Recordatorio de procedimiento",
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

const templates: Record<string, string> = {
    // Informativos
    "Recordatorio de procedimiento": "Por medio del presente se comunica al colaborador que debe cumplir estrictamente el procedimiento operativo de control de accesos y registro en bitácora conforme lo establece la normativa interna vigente.\n\nLa presente comunicación tiene carácter informativo y preventivo.",
    "Nueva disposición interna": "Se informa la implementación de una nueva disposición interna relacionada con los protocolos de seguridad y registros obligatorios. El cumplimiento de esta disposición es de carácter inmediato y obligatorio para todo el personal asignado.",
    "Convocatoria a capacitación": "Se convoca al colaborador a la sesión de capacitación obligatoria sobre protocolos de seguridad y actualización de procedimientos. La asistencia es fundamental para garantizar los estándares de calidad del servicio.",
    
    // Llamados de atención
    "Atraso injustificado": "Se deja constancia que el colaborador registró un atraso injustificado en el turno asignado. Se exhorta al cumplimiento estricto del horario laboral conforme lo establece el Reglamento Interno.",
    "Inasistencia injustificada": "Se deja constancia que el colaborador no asistió a su jornada laboral sin presentar la debida justificación previa, afectando la continuidad operativa del servicio.",
    "Abandono de puesto": "Se evidenció que el colaborador abandonó su puesto de servicio durante el turno asignado sin la debida autorización del supervisor, lo cual constituye una falta grave a la seguridad del cliente.",
    "Incumplimiento de funciones": "Se verificó el incumplimiento de las funciones asignadas relacionadas con la vigilancia, control de accesos y protección de activos, según lo estipulado en su manual de funciones.",
    "No uso de uniforme o EPP": "Se constató que el colaborador no portaba correctamente el uniforme institucional o el equipo de protección personal durante su jornada laboral, incumpliendo los estándares de imagen y seguridad.",
    "Uso indebido de celular": "Se observó el uso indebido de teléfono celular para fines personales durante el turno operativo, distrayendo la atención de las responsabilidades de vigilancia asignadas.",
    "Falta de respeto": "Se registró una conducta inadecuada relacionada con falta de respeto hacia compañeros, superiores o usuarios, afectando el entorno laboral y la imagen institucional.",
    "Desobediencia a instrucciones": "Se constató el incumplimiento de instrucciones directas e impartidas por el supervisor o jefe de área en relación a las operaciones de seguridad.",
    "Incumplimiento de procedimiento operativo": "Se evidenció el no cumplimiento del procedimiento establecido para rondas, registros en bitácora y comunicación de novedades.",
    "Entrega tardía de reporte": "Se verificó la entrega tardía del reporte diario o reporte de novedades correspondiente al turno asignado, dificultando la gestión administrativa del puesto.",
    "Conducta inadecuada": "Se deja constancia de una conducta inapropiada que contraviene los principios institucionales y los valores de la empresa de seguridad.",
    "Otro (requiere detalle adicional)": "Se deja constancia de una novedad disciplinaria u operativa detectada en el ejercicio de sus funciones, la cual se detalla a continuación.",

    // Reconocimientos
    "Cumplimiento destacado": "La empresa reconoce el desempeño destacado del colaborador en el cumplimiento de sus funciones, demostrando compromiso y excelencia en sus responsabilidades asignadas.",
    "Buen desempeño operativo": "Se reconoce el compromiso y responsabilidad demostrados en el puesto asignado, destacando su profesionalismo en la ejecución de los protocolos de seguridad.",
    "Actuación en emergencia": "Se reconoce la actuación oportuna, valiente y responsable del colaborador ante un evento de emergencia, garantizando la integridad de las personas y activos bajo su custodia.",
    "Excelente trato al usuario": "Se reconoce la actitud profesional y el excelente trato brindado a los usuarios del servicio, reflejando positivamente los valores de servicio de nuestra institución."
};

export default function DocumentManagementPage() {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    
    // State for Creation
    const [selectedType, setSelectedType] = useState<MemorandumType | "">("");
    const [selectedReason, setSelectedReason] = useState("");
    const [selectedUserIds, setSelectedWorkers] = useState<string[]>([]);
    const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [eventShift, setEventShift] = useState("");
    const [additionalDetail, setAdditionalDetail] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // State for Lists/Filtering
    const [activeTab, setActiveTab] = useState("create");
    const [memoFilter, setMemorandumFilter] = useState("");
    const [memoToDelete, setMemorandumToDelete] = useState<Memorandum | null>(null);

    // Data Hooks
    const { data: workers, isLoading: workersLoading } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: memorandums, isLoading: memosLoading } = useCollection<Memorandum>(useMemo(() => firestore ? query(collection(firestore, 'memorandums'), orderBy('createdAt', 'desc'), limit(100)) : null, [firestore]));
    const { data: savedSchedules } = useCollection<SavedSchedule>(useMemo(() => firestore ? collection(firestore, 'savedSchedules') : null, [firestore]));

    const currentUserProfile = useMemo(() => {
        if (!authUser || !workers) return null;
        return workers.find(w => w.email?.toLowerCase() === authUser.email?.toLowerCase());
    }, [authUser, workers]);

    const showTurnoLine = selectedType === "Memorando de Llamado de Atención";

    // Intelligent Shift Lookup
    useEffect(() => {
        if (selectedType === "Memorando de Llamado de Atención" && selectedUserIds.length === 1 && eventDate && savedSchedules && workers) {
            const worker = workers.find(w => w.id === selectedUserIds[0]);
            if (!worker) return;

            const dateObj = parseISO(eventDate);
            const periodDate = dateObj.getDate() < 21 ? dateObj : addMonths(dateObj, 1);
            const periodId = format(periodDate, 'yyyy-MM');
            const docId = `${periodId}_${worker.ubicacion}_${worker.cargo}`;
            
            const schedule = savedSchedules.find(s => s.id === docId);
            if (schedule && schedule.schedule[worker.id]) {
                const shift = schedule.schedule[worker.id][eventDate];
                if (shift) {
                    setEventShift(shift);
                } else {
                    setEventShift("");
                }
            } else {
                setEventShift("");
            }
        } else if (selectedType !== "Memorando de Llamado de Atención") {
            setEventShift("");
        }
    }, [selectedType, selectedUserIds, eventDate, savedSchedules, workers]);

    const generatedPreview = useMemo(() => {
        if (!selectedReason) return "";
        let text = templates[selectedReason] || "";
        if (additionalDetail.trim()) {
            text += `\n\nDetalles adicionales: ${additionalDetail}`;
        }
        return text;
    }, [selectedReason, additionalDetail]);

    const handleIssueMemorandums = async () => {
        if (!firestore || !currentUserProfile || !selectedType || !selectedReason || selectedUserIds.length === 0) {
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

            const empresaAbbr = worker.empresa?.slice(0,3).toUpperCase() || 'SEG';
            const code = `MEM-${empresaAbbr}-${year}-${String(nextId + index).padStart(4, '0')}`;
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
                content: generatedPreview,
                status: "issued",
                createdAt: now,
            };
            batch.set(newDoc, memoData);
        });

        try {
            await batch.commit();
            toast({ title: 'Documentos Emitidos', description: `Se han generado ${selectedUserIds.length} memorandos oficialmente.` });
            setSelectedType("");
            setSelectedReason("");
            setSelectedWorkers([]);
            setAdditionalDetail("");
            setEventShift("");
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
                    <p className="text-muted-foreground">Emisión y control de memorandos institucionales.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-sm">
                    <TabsTrigger value="create">Crear Memorando</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
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
                                        options={workers?.filter(w => w.Status === 'active').map(w => ({ label: `${w.apellidos} ${w.nombres} (${w.ubicacion || 'Sin puesto'})`, value: w.id })) || []}
                                        selected={selectedUserIds}
                                        onChange={setSelectedWorkers}
                                        placeholder="Seleccionar personal..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Fecha Evento</Label>
                                        <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                                    </div>
                                    <div className={cn("space-y-2 transition-all", !showTurnoLine && "opacity-30 pointer-events-none")}>
                                        <Label className="flex items-center gap-1.5">
                                            Turno
                                            {showTurnoLine && selectedUserIds.length === 1 && eventShift && (
                                                <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 border-none animate-in fade-in zoom-in duration-300">
                                                    <Sparkles className="h-2 w-2 mr-0.5" /> Auto-detectado
                                                </Badge>
                                            )}
                                        </Label>
                                        <Input 
                                            placeholder={showTurnoLine ? "Ej: D12" : "No aplica"} 
                                            value={eventShift} 
                                            onChange={(e) => setEventShift(e.target.value.toUpperCase())} 
                                            disabled={!showTurnoLine}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Detalle Adicional (Opcional)</Label>
                                    <Textarea 
                                        placeholder="Contexto adicional que se agregará al texto base..."
                                        value={additionalDetail}
                                        onChange={(e) => setAdditionalDetail(e.target.value)}
                                        className="h-24"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2">
                            <CardHeader className="bg-slate-50 border-b">
                                <div className="text-center space-y-1">
                                    <h3 className="font-black text-slate-900 uppercase">
                                        EMPRESA DE SEGURIDAD {selectedUserIds.length > 0 ? (workers?.find(w => w.id === selectedUserIds[0])?.empresa || 'XXXXX') : 'XXXXX'}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Sistema de Gestión Documental – Performa</p>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="space-y-6 max-w-2xl mx-auto font-serif text-slate-800">
                                    <div className="flex justify-between text-sm">
                                        <div className="space-y-1">
                                            <p><span className="font-bold">Código:</span> MEM-2025-XXXX</p>
                                            <p><span className="font-bold">Fecha:</span> {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-sm">
                                        <p><span className="font-bold">PARA:</span> {selectedUserIds.length === 1 ? `${workers?.find(w => w.id === selectedUserIds[0])?.nombres} ${workers?.find(w => w.id === selectedUserIds[0])?.apellidos}` : (selectedUserIds.length > 1 ? 'PERSONAL SELECCIONADO' : '____________________')}</p>
                                        <p><span className="font-bold">CARGO:</span> {selectedUserIds.length === 1 ? workers?.find(w => w.id === selectedUserIds[0])?.cargo : (selectedUserIds.length > 1 ? 'PERSONAL OPERATIVO' : '____________________')}</p>
                                        <p><span className="font-bold">PUESTO:</span> {selectedUserIds.length === 1 ? workers?.find(w => w.id === selectedUserIds[0])?.ubicacion : '____________________'}</p>
                                        {showTurnoLine && <p><span className="font-bold">TURNO:</span> {eventShift || '____________________'}</p>}
                                    </div>

                                    <div className="border-y py-2">
                                        <p className="font-bold text-sm">ASUNTO: {selectedType ? `${selectedType} – ${selectedReason || '__________'}` : '____________________'}</p>
                                    </div>

                                    <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[200px]">
                                        {selectedReason ? (
                                            generatedPreview
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-muted-foreground italic">
                                                Seleccione un tipo y motivo para generar el contenido del documento.
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-10 grid grid-cols-2 gap-12">
                                        <div className="text-center border-t pt-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Firma del Emisor</p>
                                            <p className="font-bold text-xs mt-4">{currentUserProfile?.nombres} {currentUserProfile?.apellidos}</p>
                                            <p className="text-[10px] text-muted-foreground">{currentUserProfile?.cargo}</p>
                                        </div>
                                        <div className="text-center border-t pt-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Firma del Colaborador</p>
                                            <p className="text-[10px] text-muted-foreground italic mt-4">Pendiente de firma</p>
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
                                    <CardDescription>Visualiza y gestiona todos los memorandos emitidos.</CardDescription>
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
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="animate-spin inline-block mr-2" /> Cargando...</TableCell></TableRow>
                                    ) : filteredMemos.length > 0 ? (
                                        filteredMemos.map(memo => (
                                            <TableRow key={memo.id}>
                                                <TableCell className="font-bold">{memo.code}</TableCell>
                                                <TableCell>{format(memo.createdAt, 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">
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
                                                    <Button variant="ghost" size="icon" onClick={() => setMemorandumToDelete(memo)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
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
                        <AlertDialogTitle>¿Eliminar este memorando?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción es permanente y eliminará el documento oficial del historial.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMemorandum} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
