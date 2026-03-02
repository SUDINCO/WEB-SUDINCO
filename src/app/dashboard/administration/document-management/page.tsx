
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch, query, orderBy, limit, deleteDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { 
    Search, 
    Trash2, 
    Send, 
    LoaderCircle, 
    CheckCircle, 
    Filter,
    Save,
    Edit3,
    Sparkles,
    Users,
    UserMinus,
    Eraser,
    Lock,
    Unlock,
    Eye,
    FileDown,
    XCircle,
    MessageSquare,
    FileText,
    ShieldCheck,
    Paperclip,
    FileUp,
    Camera
} from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import type { UserProfile, Memorandum, MemorandumType, SavedSchedule } from '@/lib/types';
import { cn } from '@/lib/utils';

const LOGO_URL = 'https://i.postimg.cc/B6HGbmCz/LOGO-CADENVILL.png';

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
        "Recordatorio de procedureimiento",
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

const DEFAULT_TEMPLATES: Record<string, string> = {
    "Recordatorio de procedureimiento": "Por medio del presente se comunica al colaborador que debe cumplir estrictamente el procedureimiento operativo de control de accesos y registro en bitácora conforme lo establece la normativa interna vigente.\n\nLa presente comunicación tiene carácter informativo y preventivo.",
    "Nueva disposición interna": "Se informa la implementación de una nueva disposición interna relacionada con los protocolos de seguridad y registros obligatorios. El cumplimiento de esta disposición es de carácter inmediato y obligatorio para todo el personal asignado.",
    "Convocatoria a capacitación": "Se convoca al colaborador a la sesión de capacitación obligatoria sobre protocolos de seguridad y actualización de procedureimientos. La asistencia es fundamental para garantizar los estándares de calidad del servicio.",
    "Atraso injustificado": "Se deja constancia que el colaborador registró un atraso injustificado el día {FECHA_EVENTO} durante el turno {TURNO}.\n\nEsta conducta constituye un incumplimiento a las obligaciones laborales establecidas en el Reglamento Interno de la empresa.\n\nSe emite el presente llamado de atención con la finalidad de prevenir futuras reincidencias y exhortar al cumplimiento estricto del horario asignado.",
    "Inasistencia injustificada": "Se deja constancia que el colaborador no asistió a su jornada laboral sin presentar la debida justificación previa, afectando la continuidad operativa del servicio.",
    "Abandono de puesto": "Se evidenció que el colaborador abandonó su puesto de servicio durante el turno asignado sin la debida autorización del supervisor, lo cual constituye una falta grave a la seguridad del cliente.",
    "Incumplimiento de funciones": "Se verificó el incumplimiento de las funciones asignadas relacionadas con la vigilancia, control de accesos y protección de activos, según lo estipulado en su manual de funciones.",
    "No uso de uniforme o EPP": "Se constató que el colaborador no portaba correctamente el uniforme institucional o el equipo de protección personal durante su jornada laboral, incumpliendo los estándares de imagen y seguridad.",
    "Uso indebido de celular": "Se observó el uso indebido de teléfono celular para fines personales durante el turno operativo, distrayendo la atención de las responsabilidades de vigilancia asignadas.",
    "Falta de respeto": "Se registró una conducta inadecuada relacionada con falta de respeto hacia compañeros, superiores o usuarios, afectando el entorno laboral y la imagen institucional.",
    "Desobediencia a instrucciones": "Se constató el incumplimiento de instrucciones directas e impartidas por el supervisor o jefe de área en relación a las operaciones de seguridad.",
    "Incumplimiento de procedureimiento operativo": "Se evidenció el no cumplimiento del procedureimiento establecido para rondas, registros en bitácora y comunicación de novedades.",
    "Entrega tardía de reporte": "Se verificó la entrega tardía del reporte diario o reporte de novedades correspondiente al turno asignado, dificultando la gestión administrativa del puesto.",
    "Conducta inadecuada": "Se deja constancia de una conducta inapropiada que contraviene los principios institucionales y los valores de la empresa de seguridad.",
    "Otro (requiere detalle adicional)": "Se deja constancia de una novedad disciplinaria u operativa detectada en el ejercicio de sus funciones, la cual se detalla a continuación.",
    "Cumplimiento destacado": "La empresa reconoce el desempeño destacado del colaborador en el cumplimiento de sus funciones, demostrando compromiso y excelencia en sus responsabilidades asignadas.",
    "Buen desempeño operativo": "Se reconoce el compromiso y responsabilidad demostrados en el puesto asignado, destacando su profesionalismo en la ejecución de los protocolos de seguridad.",
    "Actuación en emergencia": "Se reconoce la actuación oportuna, valiente y responsable del colaborador ante un evento de emergencia, garantizando la integridad de las personas y activos bajo su custodia.",
    "Excelente trato al usuario": "Se reconoce la actitud profesional y el excelente trato brindado a los usuarios del servicio, reflejando positivamente los valores de servicio de nuestra institución."
};

export default function DocumentManagementPage() {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    
    const [selectedType, setSelectedType] = useState<MemorandumType | "">("");
    const [selectedReason, setSelectedReason] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [isGeneralSelection, setIsGeneralSelection] = useState(false);
    const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [eventShift, setEventShift] = useState("");
    const [editableContent, setEditableContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
    const [attachmentType, setAttachmentType] = useState<'image' | 'pdf' | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isLocked, setIsLocked] = useState(false);

    const [activeTab, setActiveTab] = useState("create");
    const [memoFilter, setMemorandumFilter] = useState("");
    const [memoToDelete, setMemorandumToDelete] = useState<Memorandum | null>(null);
    const [selectedMemoForView, setSelectedMemoForView] = useState<Memorandum | null>(null);

    const { data: workers } = useCollection<UserProfile>(useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: memorandums, isLoading: memosLoading } = useCollection<Memorandum>(useMemo(() => firestore ? query(collection(firestore, 'memorandums'), orderBy('createdAt', 'desc'), limit(100)) : null, [firestore]));
    const { data: savedSchedules } = useCollection<SavedSchedule>(useMemo(() => firestore ? collection(firestore, 'savedSchedules') : null, [firestore]));
    const { data: customTemplates } = useCollection<{ id: string; content: string }>(useMemo(() => firestore ? collection(firestore, 'memorandumTemplates') : null, [firestore]));

    const currentUserProfile = useMemo(() => {
        if (!authUser || !workers) return null;
        return workers.find(w => w.email?.toLowerCase() === authUser.email?.toLowerCase());
    }, [authUser, workers]);

    const showTurnoLine = selectedType === "Memorando de Llamado de Atención";

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'El límite es de 2MB.' });
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const result = event.target?.result as string;
            
            if (file.type.startsWith('image/')) {
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.7);
                    setAttachmentUrl(compressed);
                    setAttachmentType('image');
                    setIsUploading(false);
                };
                img.src = result;
            } else if (file.type === 'application/pdf') {
                setAttachmentUrl(result);
                setAttachmentType('pdf');
                setIsUploading(false);
            } else {
                toast({ variant: 'destructive', title: 'Tipo no soportado', description: 'Solo se admiten imágenes o PDFs.' });
                setIsUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const getCoordinates = (e: any) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: any) => {
        if (isLocked) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#000';
            setIsDrawing(true);
        }
    };

    const draw = (e: any) => {
        if (!isDrawing || isLocked || !canvasRef.current) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    useEffect(() => {
        if (selectedReason) {
            const custom = customTemplates?.find(t => t.id === selectedReason);
            setEditableContent(custom?.content || DEFAULT_TEMPLATES[selectedReason] || "");
            setIsEditing(false);
        } else {
            setEditableContent("");
        }
    }, [selectedReason, customTemplates]);

    useEffect(() => {
        if (selectedType === "Memorando de Llamado de Atención" && selectedUserId && eventDate && savedSchedules && workers) {
            const worker = workers.find(w => w.id === selectedUserId);
            if (!worker) return;

            try {
                const dateObj = parseISO(eventDate);
                const periodDate = dateObj.getDate() < 21 ? dateObj : addMonths(dateObj, 1);
                const periodIdentifier = format(periodDate, 'yyyy-MM');
                const periodSchedules = savedSchedules.filter(s => s.id.startsWith(periodIdentifier));
                let foundShift = "";
                let foundInSchedules = false;

                for (const scheduleDoc of periodSchedules) {
                    if (scheduleDoc.schedule[worker.id]) {
                        const shift = scheduleDoc.schedule[worker.id][eventDate];
                        foundShift = shift || "LIBRE";
                        foundInSchedules = true;
                        break;
                    }
                }
                setEventShift(foundInSchedules ? foundShift : "");
            } catch (e) {
                console.error("Error lookup shift", e);
                setEventShift("");
            }
        } else if (selectedType !== "Memorando de Llamado de Atención") {
            setEventShift("");
        }
    }, [selectedType, selectedUserId, eventDate, savedSchedules, workers]);

    const handleSaveTemplate = async () => {
        if (!firestore || !selectedReason || !editableContent.trim()) return;
        setIsSavingTemplate(true);
        try {
            await setDoc(doc(firestore, 'memorandumTemplates', selectedReason), {
                content: editableContent
            });
            toast({ title: 'Plantilla Guardada' });
            setIsEditing(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleIssueMemorandums = async () => {
        if (!firestore || !currentUserProfile || !selectedType || !selectedReason || !isLocked) {
            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Por favor complete todos los campos y certifique su firma.' });
            return;
        }

        setIsSaving(true);
        const issuerSignature = canvasRef.current!.toDataURL('image/png');
        const batch = writeBatch(firestore);
        const memoRef = collection(firestore, 'memorandums');
        const now = Date.now();
        const currentYear = new Date().getFullYear();
        
        let targetWorkers: UserProfile[] = [];
        if (isGeneralSelection) {
            targetWorkers = workers?.filter(w => w.Status === 'active') || [];
        } else {
            const singleWorker = workers?.find(w => w.id === selectedUserId);
            if (singleWorker) targetWorkers = [singleWorker];
        }

        if (targetWorkers.length === 0) {
            setIsSaving(false);
            return;
        }

        targetWorkers.forEach((worker, index) => {
            const empresaAbbr = worker.empresa?.slice(0,3).toUpperCase() || 'SEG';
            const code = `MEM-${empresaAbbr}-${currentYear}-${String((memorandums?.length || 0) + index + 1).padStart(4, '0')}`;
            const newDoc = doc(memoRef);
            
            const memoData: Omit<Memorandum, 'id'> = {
                code,
                type: selectedType as MemorandumType,
                reason: selectedReason,
                targetUserId: worker.id,
                targetUserName: `${worker.nombres} ${worker.apellidos}`,
                targetUserCargo: worker.cargo,
                targetUserEmpresa: worker.empresa,
                eventDate: eventDate,
                eventShift: eventShift,
                issuerId: currentUserProfile.id,
                issuerName: `${currentUserProfile.nombres} ${currentUserProfile.apellidos}`,
                issuerCargo: currentUserProfile.cargo,
                issuerSignature: issuerSignature,
                content: editableContent,
                status: "issued",
                createdAt: now,
                attachmentUrl: attachmentUrl,
                attachmentType: attachmentType
            };
            batch.set(newDoc, memoData);
        });

        try {
            await batch.commit();
            toast({ title: 'Documentos Emitidos', description: `Se han generado ${targetWorkers.length} documentos.` });
            setSelectedType("");
            setSelectedReason("");
            setSelectedUserId("");
            setIsGeneralSelection(false);
            setEventShift("");
            setEditableContent("");
            setAttachmentUrl(null);
            setAttachmentType(null);
            setIsLocked(false);
            clearCanvas();
            setActiveTab("history");
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error' });
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
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setMemorandumToDelete(null);
        }
    };

    const handleDownloadPdf = async (memo: Memorandum) => {
        setIsGeneratingPdf(true);
        try {
            const { generateMemorandumPDF } = await import('@/lib/pdf-generator');
            await generateMemorandumPDF(memo);
            toast({ title: 'PDF Generado' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error al generar PDF' });
        } finally {
            setIsGeneratingPdf(false);
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

    const selectedWorkerData = useMemo(() => {
        return workers?.find(w => w.id === selectedUserId);
    }, [workers, selectedUserId]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestión Documental</h1>
                    <p className="text-muted-foreground">Emisión y control de memorandos institucionales certificados.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-sm">
                    <TabsTrigger value="create">Crear Memorando</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-1 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Filter className="h-4 w-4" /> Configuración de Envío
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Tipo de Memorando</Label>
                                    <Select value={selectedType} onValueChange={(v) => { setSelectedType(v as MemorandumType); setSelectedReason(""); setIsGeneralSelection(false); }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione el tipo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {memorandumTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className={cn("space-y-2 transition-all", !selectedType && "opacity-50 pointer-events-none")}>
                                    <Label>Motivo Específico</Label>
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
                                    <div className="flex items-center justify-between">
                                        <Label>Destinatario(s)</Label>
                                        {selectedType === "Memorando Informativo" && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className={cn("h-6 text-[10px] gap-1", isGeneralSelection ? "text-destructive" : "text-primary")}
                                                onClick={() => {
                                                    setIsGeneralSelection(!isGeneralSelection);
                                                    if (!isGeneralSelection) setSelectedUserId("");
                                                }}
                                            >
                                                {isGeneralSelection ? <UserMinus className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                                                {isGeneralSelection ? "Individual" : "Todo el Personal"}
                                            </Button>
                                        )}
                                    </div>
                                    {isGeneralSelection ? (
                                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm font-medium text-primary flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4" />
                                            Todo el personal activo
                                        </div>
                                    ) : (
                                        <Combobox 
                                            options={workers?.filter(w => w.Status === 'active').map(w => ({ label: `${w.apellidos} ${w.nombres} (${w.ubicacion || 'Sin puesto'})`, value: w.id })) || []}
                                            value={selectedUserId}
                                            onChange={setSelectedUserId}
                                            placeholder="Seleccionar trabajador..."
                                            searchPlaceholder="Buscar por nombre..."
                                            className="w-full"
                                        />
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>Fecha Evento</Label>
                                        <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                                    </div>
                                    <div className={cn("space-y-2 transition-all", !showTurnoLine && "opacity-30 pointer-events-none")}>
                                        <Label className="flex items-center gap-1.5">
                                            Turno
                                            {showTurnoLine && selectedUserId && eventShift && (
                                                <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-blue-100 text-blue-700 border-none">
                                                    <Sparkles className="h-2 w-2 mr-0.5" /> Detectado
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

                                <div className="space-y-2 pt-2">
                                    <Label className="flex items-center gap-2">
                                        <Paperclip className="h-4 w-4" /> Adjunto (Opcional)
                                    </Label>
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="outline" 
                                            className={cn("w-full h-9 text-[10px] uppercase font-black tracking-widest", attachmentUrl && "border-primary text-primary")}
                                            onClick={() => attachmentInputRef.current?.click()}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? <LoaderCircle className="animate-spin mr-2 h-3 w-3" /> : <FileUp className="mr-2 h-3 w-3" />}
                                            {attachmentUrl ? "Cambiar Adjunto" : "Subir Foto / PDF"}
                                        </Button>
                                        <input 
                                            type="file" 
                                            ref={attachmentInputRef} 
                                            className="hidden" 
                                            accept="image/*,application/pdf"
                                            onChange={handleFileChange}
                                        />
                                        {attachmentUrl && (
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => { setAttachmentUrl(null); setAttachmentType(null); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {attachmentUrl && (
                                        <div className="p-2 border rounded-md bg-slate-50 flex items-center gap-2">
                                            {attachmentType === 'image' ? <Camera className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-red-500" />}
                                            <span className="text-[10px] font-bold uppercase truncate flex-1">Archivo cargado exitosamente</span>
                                            <CheckCircle className="h-3 w-3 text-green-600" />
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                <div className="space-y-3 pt-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="font-bold text-xs uppercase text-slate-700">Mi Firma Digital *</Label>
                                        {isLocked && <Badge className="bg-emerald-600 h-4 text-[9px] uppercase font-black">Certificada</Badge>}
                                    </div>
                                    <div className={cn(
                                        "border-2 rounded-lg bg-white relative overflow-hidden transition-all",
                                        isLocked ? "border-emerald-500/30 bg-slate-50" : "border-dashed border-slate-300 shadow-inner"
                                    )}>
                                        <canvas 
                                            ref={canvasRef}
                                            width={400}
                                            height={150}
                                            className={cn(
                                                "w-full h-[100px] cursor-crosshair touch-none",
                                                isLocked && "pointer-events-none opacity-50 grayscale"
                                            )}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={() => setIsDrawing(false)}
                                            onMouseOut={() => setIsDrawing(false)}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={() => setIsDrawing(false)}
                                        />
                                        {!isLocked && (
                                            <Button variant="ghost" size="icon" className="absolute bottom-1 right-1 h-6 w-6" onClick={clearCanvas}>
                                                <Eraser className="h-3 w-3 text-slate-400" />
                                            </Button>
                                        )}
                                    </div>
                                    <Button 
                                        variant={isLocked ? "outline" : "default"} 
                                        className={cn("w-full h-9 text-[10px] uppercase font-black tracking-widest", !isLocked && "bg-slate-900")} 
                                        onClick={() => setIsLocked(!isLocked)}
                                    >
                                        {isLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                                        {isLocked ? "Modificar Firma" : "Bloquear y Certificar Firma"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 shadow-2xl overflow-hidden bg-slate-100 border-none flex flex-col">
                            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                                <div className="bg-white shadow-lg mx-auto max-w-2xl min-h-full border border-slate-200 relative flex flex-col">
                                    <div className="w-full relative h-[120px] border-b overflow-hidden bg-white">
                                        <Image 
                                            src={LOGO_URL} 
                                            alt="Header Cadenvill Security" 
                                            fill
                                            className="object-fill object-center"
                                            unoptimized
                                        />
                                    </div>

                                    <div className="px-10 py-8 space-y-8 flex-1 font-serif text-slate-800">
                                        <div className="text-center space-y-1">
                                            <h2 className="text-xl font-black tracking-tight text-slate-900 border-b-2 border-primary inline-block px-4 pb-1 uppercase italic">
                                                Memorando Institucional - {isGeneralSelection ? 'GENERAL' : (selectedWorkerData?.empresa || '__________')}
                                            </h2>
                                            <p className="text-[9px] font-bold text-slate-500 tracking-[0.2em] uppercase">Control de Gestión Documental Interna</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Código del Documento</p>
                                                <p className="font-bold text-slate-800">MEM-{isGeneralSelection ? 'GEN' : (selectedWorkerData?.empresa?.slice(0,3).toUpperCase() || 'XXX')}-{new Date().getFullYear()}-XXXX</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Fecha de Emisión</p>
                                                <p className="font-bold text-slate-800">{format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Destinatario (PARA)</p>
                                                <p className="font-bold text-slate-800">{isGeneralSelection ? 'TODO EL PERSONAL' : (selectedWorkerData ? `${selectedWorkerData.apellidos} ${selectedWorkerData.nombres}` : '____________________')}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Cargo / Función</p>
                                                <p className="font-bold text-slate-800">{isGeneralSelection ? 'OPERATIVO / ADMINISTRATIVO' : (selectedWorkerData ? selectedWorkerData.cargo : '____________________')}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Ubicación / Puesto</p>
                                                <p className="font-bold text-slate-800">{isGeneralSelection ? 'MULTIPLE' : (selectedWorkerData ? selectedWorkerData.ubicacion : '____________________')}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Fecha del Evento</p>
                                                <p className="font-bold text-slate-800">{format(parseISO(eventDate), "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                                            </div>
                                            {showTurnoLine && (
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Turno del Evento</p>
                                                    <p className="font-bold text-emerald-700">{eventShift || '____________________'}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-y py-3 flex justify-between items-center">
                                            <p className="font-black text-sm uppercase tracking-tight">ASUNTO: {selectedType ? `${selectedType} – ${selectedReason || '__________'}` : '____________________'}</p>
                                            {selectedReason && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-7 text-[10px] font-black uppercase tracking-widest text-primary"
                                                    onClick={() => setIsEditing(!isEditing)}
                                                >
                                                    {isEditing ? <CheckCircle className="mr-1 h-3 w-3" /> : <Edit3 className="mr-1 h-3 w-3" />}
                                                    {isEditing ? 'Listo' : 'Editar'}
                                                </Button>
                                            )}
                                        </div>

                                        <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[200px] px-2">
                                            {selectedReason ? (
                                                isEditing ? (
                                                    <div className="space-y-4">
                                                        <Textarea 
                                                            value={editableContent}
                                                            onChange={(e) => setEditableContent(e.target.value)}
                                                            className="min-h-[250px] font-serif text-sm leading-relaxed border-primary/20"
                                                        />
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-primary text-[10px] font-black uppercase tracking-widest" 
                                                            onClick={handleSaveTemplate}
                                                            disabled={isSavingTemplate}
                                                        >
                                                            {isSavingTemplate ? <LoaderCircle className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                                                            Actualizar Plantilla Base
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    editableContent
                                                )
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic py-20 opacity-40">
                                                    <FileText className="h-12 w-12 mb-2" />
                                                    <p>Seleccione configuración para redactar el documento.</p>
                                                </div>
                                            )}
                                        </div>

                                        {attachmentUrl && (
                                            <div className="mt-8 border-t pt-6 space-y-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Anexo / Evidencia Adjunta</p>
                                                {attachmentType === 'image' ? (
                                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border shadow-sm group">
                                                        <Image src={attachmentUrl} alt="Evidencia" fill className="object-contain" unoptimized />
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-slate-50 border rounded-lg flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-red-100 rounded text-red-600"><FileText className="h-6 w-6" /></div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700">Documento PDF Adjunto</p>
                                                                <p className="text-[10px] text-slate-500 uppercase">Este archivo se incluirá en el expediente</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className="text-[8px] font-black uppercase">Cargado</Badge>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-12 grid grid-cols-2 gap-16">
                                            <div className="flex flex-col items-center space-y-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-1 w-full text-center">Firma del Emisor</p>
                                                <div className="w-full h-24 flex flex-col items-center justify-center relative">
                                                    {isLocked ? (
                                                        <div className="text-center mb-2">
                                                            <img src={canvasRef.current?.toDataURL()} alt="Firma Emisor" className="h-12 object-contain opacity-90 mx-auto" />
                                                            <p className="font-black text-[11px] text-slate-900 leading-tight uppercase">{currentUserProfile?.nombres} {currentUserProfile?.apellidos}</p>
                                                            <p className="text-[9px] text-primary font-bold uppercase leading-tight">{currentUserProfile?.cargo}</p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-muted-foreground italic">Pendiente de certificación</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center space-y-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-1 w-full text-center">Firma del Colaborador</p>
                                                <div className="w-full h-24 flex items-center justify-center">
                                                    {selectedType === "Memorando de Llamado de Atención" ? (
                                                        <p className="text-[10px] text-muted-foreground italic uppercase font-bold opacity-50">Espacio para Firma</p>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[8px] font-black uppercase opacity-40">No requiere firma</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-12 border-t border-slate-100 pb-4">
                                            <p className="text-[8px] text-slate-400 leading-tight text-center italic">
                                                Documento oficial generado por la plataforma Performa para Cadenvill Security. 
                                                Este registro electrónico constituye prueba auditable de comunicación institucional.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900 p-4 border-t border-slate-800 flex justify-end">
                                <Button 
                                    className="min-w-[250px] font-black uppercase tracking-widest text-xs h-11" 
                                    onClick={handleIssueMemorandums}
                                    disabled={isSaving || isEditing || !selectedType || !selectedReason || (!selectedUserId && !isGeneralSelection) || !isLocked}
                                >
                                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    {isGeneralSelection ? `Emitir a Todo el Personal` : 'Emitir y Notificar'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <Card className="shadow-md">
                        <CardHeader>
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <CardTitle>Archivo de Documentos</CardTitle>
                                    <CardDescription>Expediente histórico de memorandos emitidos y su estado legal.</CardDescription>
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
                                    <TableRow className="bg-slate-50">
                                        <TableHead className="font-black uppercase text-[10px]">Código</TableHead>
                                        <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                                        <TableHead className="font-black uppercase text-[10px]">Tipo</TableHead>
                                        <TableHead className="font-black uppercase text-[10px]">Colaborador</TableHead>
                                        <TableHead className="font-black uppercase text-[10px]">Motivo</TableHead>
                                        <TableHead className="font-black uppercase text-[10px]">Estado</TableHead>
                                        <TableHead className="text-right font-black uppercase text-[10px]">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {memosLoading ? (
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="animate-spin inline-block mr-2" /> Cargando historial...</TableCell></TableRow>
                                    ) : filteredMemos.length > 0 ? (
                                        filteredMemos.map(memo => (
                                            <TableRow key={memo.id} className="hover:bg-slate-50 transition-colors">
                                                <TableCell className="font-mono text-xs font-bold text-primary">{memo.code}</TableCell>
                                                <TableCell className="text-xs">{format(memo.createdAt, 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[9px] uppercase font-bold">
                                                        {memo.type?.split(' ').pop()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs uppercase">{memo.targetUserName}</span>
                                                        <span className="text-[9px] text-muted-foreground uppercase">{memo.targetUserCargo}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[150px] truncate text-xs italic">"{memo.reason}"</TableCell>
                                                <TableCell>
                                                    {memo.status === 'signed' ? (
                                                        <Badge className="bg-emerald-600 text-[9px] font-black uppercase gap-1"><CheckCircle className="h-3 w-3" /> Firmado</Badge>
                                                    ) : memo.status === 'rejected' ? (
                                                        <Badge variant="destructive" className="text-[9px] font-black uppercase gap-1"><XCircle className="h-3 w-3" /> Rechazado</Badge>
                                                    ) : memo.status === 'read' ? (
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[9px] font-black uppercase">Leído</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] font-black uppercase animate-pulse">Emitido</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary hover:text-white" onClick={() => setSelectedMemoForView(memo)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 text-destructive" onClick={() => setMemorandumToDelete(memo)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic">No se han emitido documentos aún.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!selectedMemoForView} onOpenChange={(open) => !open && setSelectedMemoForView(null)}>
                <DialogContent className="max-w-5xl max-h-[95vh] p-0 flex flex-col overflow-hidden bg-slate-100 border-none">
                    {selectedMemoForView && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 md:p-10">
                                <div className="bg-white shadow-2xl mx-auto max-w-2xl min-h-full border border-slate-200 relative flex flex-col">
                                    <div className="w-full relative h-[140px] border-b overflow-hidden bg-white">
                                        <Image 
                                            src={LOGO_URL} 
                                            alt="Header Cadenvill Security" 
                                            fill
                                            className="object-fill object-center"
                                            unoptimized
                                        />
                                    </div>

                                    <div className="px-10 py-8 space-y-8 flex-1 font-serif text-slate-800">
                                        <div className="text-center space-y-1">
                                            <h2 className="text-xl font-black tracking-tight text-slate-900 border-b-2 border-primary inline-block px-4 pb-1 uppercase italic">
                                                Memorando Institucional - {selectedMemoForView.targetUserEmpresa || 'GENERAL'}
                                            </h2>
                                            <p className="text-[9px] font-bold text-slate-500 tracking-[0.2em] uppercase">Control de Auditoría #{selectedMemoForView.id.slice(-8).toUpperCase()}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Código</p>
                                                <p className="font-bold text-slate-800">{selectedMemoForView.code}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Fecha Emisión</p>
                                                <p className="font-bold text-slate-800">{format(selectedMemoForView.createdAt, "d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">PARA:</p>
                                                <p className="font-bold text-slate-800 uppercase">{selectedMemoForView.targetUserName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">CARGO:</p>
                                                <p className="font-bold text-slate-800 uppercase">{selectedMemoForView.targetUserCargo}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">Fecha del Evento</p>
                                                <p className="font-bold text-slate-800">{selectedMemoForView.eventDate ? format(parseISO(selectedMemoForView.eventDate), "d 'de' MMMM 'de' yyyy", { locale: es }) : 'N/A'}</p>
                                            </div>
                                            {selectedMemoForView.eventShift && (
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Turno</p>
                                                    <p className="font-bold text-emerald-700">{selectedMemoForView.eventShift}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-y py-3">
                                            <p className="font-black text-sm uppercase tracking-tight">ASUNTO: {selectedMemoForView.type} – {selectedMemoForView.reason}</p>
                                        </div>

                                        <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[200px] px-2 text-slate-700">
                                            {selectedMemoForView.content}
                                        </div>

                                        {selectedMemoForView.attachmentUrl && (
                                            <div className="mt-8 border-t pt-6 space-y-4">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Anexo Adjunto</p>
                                                {selectedMemoForView.attachmentType === 'image' ? (
                                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border shadow-sm">
                                                        <Image src={selectedMemoForView.attachmentUrl} alt="Anexo" fill className="object-contain" unoptimized />
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-slate-50 border rounded-lg flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-red-100 rounded text-red-600"><FileText className="h-6 w-6" /></div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700">Documento PDF Adjunto</p>
                                                                <p className="text-[10px] text-slate-500 uppercase">Disponible en la carpeta digital del trabajador</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase" onClick={() => window.open(selectedMemoForView.attachmentUrl!, '_blank')}>Abrir PDF</Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {selectedMemoForView.status === 'rejected' && selectedMemoForView.defense && (
                                            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md">
                                                <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span className="text-[10px] uppercase tracking-widest font-black">Respuesta / Descargo del Colaborador:</span>
                                                </div>
                                                <p className="text-sm italic text-red-900 leading-relaxed font-serif">
                                                    "{selectedMemoForView.defense}"
                                                </p>
                                            </div>
                                        )}

                                        <div className="pt-12 grid grid-cols-2 gap-16">
                                            <div className="flex flex-col items-center space-y-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-1 w-full text-center">Firma del Emisor</p>
                                                <div className="w-full h-24 flex flex-col items-center justify-center text-center">
                                                    {selectedMemoForView.issuerSignature && (
                                                        <div className="mb-2">
                                                            <img src={selectedMemoForView.issuerSignature} alt="Firma Emisor" className="h-12 object-contain opacity-90 mx-auto" />
                                                            <p className="font-black text-[11px] text-slate-900 leading-tight uppercase">{selectedMemoForView.issuerName}</p>
                                                            <p className="text-[9px] text-primary font-bold uppercase leading-tight">{selectedMemoForView.issuerCargo}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center space-y-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-1 w-full text-center">Firma del Colaborador</p>
                                                <div className="w-full h-24 flex flex-center items-center justify-center text-center">
                                                    {selectedMemoForView.signature ? (
                                                        <div className="mb-2">
                                                            <img src={selectedMemoForView.signature} alt="Firma Colaborador" className="h-12 object-contain opacity-90 mx-auto" />
                                                            <p className="font-black text-[11px] text-slate-900 leading-tight uppercase">{selectedMemoForView.targetUserName}</p>
                                                            <p className="text-[9px] text-emerald-700 font-bold uppercase leading-tight">{selectedMemoForView.targetUserCargo}</p>
                                                        </div>
                                                    ) : (
                                                        selectedMemoForView.status === 'rejected' ? (
                                                            <div className="flex flex-col items-center gap-1 border-2 border-red-500 p-2 rounded rotate-[-5deg]">
                                                                <span className="text-[12px] font-black text-red-600">RECHAZADO</span>
                                                                <span className="text-[8px] font-bold text-red-400">{format(selectedMemoForView.createdAt, 'dd/MM/yyyy')}</span>
                                                            </div>
                                                        ) : selectedMemoForView.type === "Memorando de Llamado de Atención" ? (
                                                            <p className="text-[10px] text-muted-foreground italic font-medium">Pendiente de firma</p>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[8px] font-black uppercase opacity-40">No requiere firma</Badge>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-12 border-t border-slate-100 pb-4">
                                            <p className="text-[8px] text-slate-400 leading-tight text-center italic">
                                                Copia digital auténtica para el expediente laboral. 
                                                Este documento tiene validez probatoria institucional.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 p-4 flex justify-between items-center px-10 border-t border-slate-800">
                                <Button variant="ghost" onClick={() => setSelectedMemoForView(null)} className="text-white hover:bg-white/10 font-bold uppercase text-[10px]">Cerrar Vista</Button>
                                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-black uppercase text-[10px] tracking-widest px-8" onClick={() => handleDownloadPdf(selectedMemoForView)} disabled={isGeneratingPdf}>
                                    {isGeneratingPdf ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Descargar PDF Oficial
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!memoToDelete} onOpenChange={() => setMemorandumToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar documento oficial?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción es irreversible y removerá el memorando de los registros históricos del trabajador.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMemorandum} className="bg-destructive text-destructive-foreground font-bold">Eliminar permanentemente</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
