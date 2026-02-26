
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Label } from '@/components/ui/label';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useCollection, useFirestore, useAuth, useUser } from '@/firebase';
import { collection, doc, addDoc, updateDoc, setDoc, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Search, Edit, UserPlus, LoaderCircle, Check, FileUp, FileDown, Users, Trash2, KeyRound, MoreHorizontal, UserRound, CheckCircle, X, Camera, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { normalizeText } from '@/lib/utils';
import { resetUserPasswordAction } from '@/app/actions/auth';
import { UserProfile, GenericOption, ConsultantGroup } from '@/lib/types';

const userSchema = z.object({
  photoUrl: z.string().optional(),
  codigo: z.string().min(1, "El código es obligatorio."),
  cedula: z.string().min(10, "La cédula debe tener al menos 10 caracteres."),
  apellidos: z.string().min(1, "Los apellidos son obligatorios."),
  nombres: z.string().min(1, "Los nombres son obligatorios."),
  fechaIngreso: z.string().min(1, "La fecha de ingreso es obligatoria."),
  fechaNacimiento: z.string().min(1, "La fecha de nacimiento es obligatoria."),
  email: z.string().email("Debe ser un correo electrónico válido."),
  empresa: z.string().min(1, "La empresa es obligatoria."),
  cargo: z.string().min(1, "El cargo es obligatorio."),
  departamento: z.string().min(1, "El departamento es obligatorio."),
  tipoContrato: z.enum(['INDEFINIDO', 'EMERGENTE'], { required_error: 'El tipo de contrato es obligatorio.' }),
  Status: z.enum(['active', 'inactive']),
  rol: z.string().min(1, "El rol es obligatorio."),
  ubicacion: z.string().optional(),
  centroCosto: z.string().optional(),
  liderArea: z.string().email({ message: "Debe ser un email válido." }).optional().or(z.literal('')),
  consultor: z.string().optional(),
  isLeader: z.boolean().default(false),
  observerEmail: z.string().optional().or(z.literal('')),
});

type UserFormData = z.infer<typeof userSchema>;

const formatDateForInput = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        return format(utcDate, 'yyyy-MM-dd');
    } catch {
        return '';
    }
};

const normalizeEmail = (email: string | undefined | null): string => {
    if (!email) return '';
    return email
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .trim();
};

export default function StaffPage() {
  const [filter, setFilter] = useState('');
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isGroupDialogOpen, setGroupDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resetError, setResetError] = useState<string>('');

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const firestore = useFirestore();
  const auth = useAuth();
  const { user: currentUser } = useUser();
  const usersCollectionRef = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const rolesCollectionRef = useMemo(() => firestore ? collection(firestore, 'roles') : null, [firestore]);
  const leaderRulesCollectionRef = useMemo(() => firestore ? collection(firestore, 'leaderAssignmentRules') : null, [firestore]);
  const consultantGroupsCollectionRef = useMemo(() => firestore ? collection(firestore, 'consultantGroups') : null, [firestore]);

  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersCollectionRef);
  const { data: roles, isLoading: rolesLoading } = useCollection<any>(rolesCollectionRef);
  const { data: leaderRules, isLoading: rulesLoading } = useCollection<any>(leaderRulesCollectionRef);
  const { data: consultantGroups, isLoading: consultantGroupsLoading } = useCollection<ConsultantGroup>(consultantGroupsCollectionRef);

  const { data: empresas, isLoading: empresasLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'empresas') : null, [firestore]));
  const { data: cargos, isLoading: cargosLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'cargos') : null, [firestore]));
  const { data: ubicaciones, isLoading: ubicacionesLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'ubicaciones') : null, [firestore]));
  const { data: areas, isLoading: areasLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'areas') : null, [firestore]));
  const { data: centrosCosto, isLoading: centrosCostoLoading } = useCollection<GenericOption>(useMemo(() => firestore ? collection(firestore, 'centrosCosto') : null, [firestore]));

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId || !consultantGroups) return null;
    return consultantGroups.find(g => g.id === selectedGroupId) || null;
  }, [selectedGroupId, consultantGroups]);

  const groupMembers = useMemo(() => {
    if (!selectedGroup || !users) return [];
    return users.filter(user => selectedGroup.members.includes(user.id));
  }, [selectedGroup, users]);

  const availableForGroup = useMemo(() => {
    if (!users || !selectedGroup) return [];
    const memberIds = new Set(selectedGroup.members);
    const filteredUsers = users.filter(user => !memberIds.has(user.id) && user.Status === 'active');
    if (!memberSearch) return filteredUsers;
    const lowercasedSearch = memberSearch.toLowerCase();
    return filteredUsers.filter(user => 
        `${user.nombres} ${user.apellidos}`.toLowerCase().includes(lowercasedSearch) ||
        user.cargo.toLowerCase().includes(lowercasedSearch)
    );
  }, [users, selectedGroup, memberSearch]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const { watch, setValue } = form;
  const watchedFields = watch(['empresa', 'cargo', 'ubicacion', 'departamento', 'centroCosto']);
  
  const toOptions = (data: GenericOption[] | null | undefined) => {
    if (!data) return [];
    return data.map(item => ({ label: item.name, value: item.name }));
  }

  useEffect(() => {
    if (!editingUser && leaderRules && !rulesLoading) {
      const [empresa, cargo, ubicacion, departamento, centroCosto] = watchedFields;
      if (departamento) { 
          const matchingRule = leaderRules.find(rule => 
              normalizeText(rule.conditions.empresa) === normalizeText(empresa) &&
              normalizeText(rule.conditions.cargo) === normalizeText(cargo) &&
              normalizeText(rule.conditions.ubicacion) === normalizeText(ubicacion) &&
              normalizeText(rule.conditions.departamento) === normalizeText(departamento) &&
              normalizeText(rule.conditions.centroCosto) === normalizeText(centroCosto)
          );
          if (matchingRule) {
              setValue('liderArea', matchingRule.leaderEmail, { shouldValidate: true });
          }
      }
    }
  }, [watchedFields, leaderRules, setValue, editingUser, rulesLoading]);
  
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!filter) return users;
    
    const normalizeForSearch = (text: string | undefined | null): string => {
        if (!text) return '';
        return text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
    };

    const searchTerms = normalizeForSearch(filter).replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) return users;

    return users.filter(user => {
      const userString = normalizeForSearch(`${user.nombres || ''} ${user.apellidos || ''} ${user.cedula || ''} ${user.email || ''} ${user.cargo || ''}`);
      return searchTerms.every(term => userString.includes(term));
    });
  }, [users, filter]);

  const handleOpenForm = (user: UserProfile | null) => {
    setEditingUser(user);
    if (user) {
      form.reset({
        ...user,
        fechaIngreso: formatDateForInput(user.fechaIngreso),
        fechaNacimiento: formatDateForInput(user.fechaNacimiento),
        liderArea: user.liderArea || '',
        observerEmail: user.observerEmail || '',
      });
      setImagePreview(user.photoUrl || null);
    } else {
      form.reset({
        photoUrl: '',
        codigo: '', cedula: '', apellidos: '', nombres: '', fechaIngreso: '', fechaNacimiento: '', email: '',
        empresa: '', cargo: '', departamento: '', Status: 'active', rol: '',
        ubicacion: '', centroCosto: '', liderArea: '', consultor: '',
        isLeader: false, tipoContrato: 'INDEFINIDO', observerEmail: ''
      });
      setImagePreview(null);
    }
    setFormOpen(true);
  };
  
  const onSubmit = async (data: UserFormData) => {
    if (!usersCollectionRef || !firestore) return;

    const optionsBatch = writeBatch(firestore);
    const optionsToCreate = [
        { collectionName: 'empresas', data: empresas, value: data.empresa },
        { collectionName: 'cargos', data: cargos, value: data.cargo },
        { collectionName: 'ubicaciones', data: ubicaciones, value: data.ubicacion },
        { collectionName: 'areas', data: areas, value: data.departamento },
        { collectionName: 'centrosCosto', data: centrosCosto, value: data.centroCosto },
    ];

    let newOptionsAdded = false;
    optionsToCreate.forEach(opt => {
        if (opt.value) {
            const normalizedValue = normalizeText(opt.value);
            if (!opt.data?.some(item => normalizeText(item.name) === normalizedValue)) {
                const newDocRef = doc(collection(firestore, opt.collectionName));
                optionsBatch.set(newDocRef, { name: normalizedValue });
                newOptionsAdded = true;
            }
        }
    });

    if (newOptionsAdded) {
        try { await optionsBatch.commit(); } catch (e) { console.error(e); }
    }

    const dataToSave: any = { ...data };
    dataToSave.email = normalizeEmail(data.email);
    dataToSave.liderArea = normalizeEmail(data.liderArea);
    dataToSave.observerEmail = normalizeEmail(data.observerEmail);

    if (!editingUser) {
        if (users?.some(user => normalizeEmail(user.email) === dataToSave.email)) {
            toast({ variant: "destructive", title: "Correo Duplicado", description: "Ya existe un usuario con este correo." });
            return;
        }
        dataToSave.requiresPasswordChange = true;
        let tempApp;
        try {
            tempApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
            const tempAuth = getAuth(tempApp);
            const userCredential = await createUserWithEmailAndPassword(tempAuth, dataToSave.email, data.cedula);
            await setDoc(doc(firestore, 'users', userCredential.user.uid), dataToSave);
            toast({ title: 'Usuario Registrado', description: `La cuenta ha sido creada con éxito.` });
            setFormOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error al Crear Usuario', description: error.message });
        } finally { if (tempApp) await deleteApp(tempApp); }
    } else {
        try {
            await updateDoc(doc(firestore, 'users', editingUser.id), dataToSave);
            toast({ title: 'Usuario Actualizado' });
            setFormOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al actualizar' });
        }
    }
  };

  const handleStatusChange = async (user: UserProfile, newStatus: boolean) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', user.id), { Status: newStatus ? 'active' : 'inactive' });
      toast({ title: 'Estado actualizado' });
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }
  };

  const handleIsLeaderChange = async (user: UserProfile, newIsLeader: boolean) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', user.id), { isLeader: newIsLeader });
      toast({ title: 'Rol de líder actualizado' });
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }
  };

  const handlePasswordReset = async () => {
    if (!userToReset || !firestore) {
        setUserToReset(null);
        return;
    }

    setIsResetting(true);
    setResetStatus('idle');
    setResetError('');

    try {
        // EJECUCIÓN DE LA ACCIÓN DE SERVIDOR (ADMIN SDK)
        const result = await resetUserPasswordAction(userToReset.id, userToReset.cedula);
        
        if (!result.success) {
            throw new Error(result.error);
        }

        // Marcamos el perfil en Firestore para cambio obligatorio
        const userDocRef = doc(firestore, 'users', userToReset.id);
        await updateDoc(userDocRef, { requiresPasswordChange: true });
        
        setResetStatus('success');
        toast({ title: 'Reseteo Automático Exitoso', description: 'La contraseña ahora es el número de cédula.' });
    } catch (error: any) {
        console.error("Error en proceso de reseteo:", error);
        setResetError(error.message || 'Ocurrió un error inesperado al automatizar el reseteo.');
        setResetStatus('error');
    } finally {
        setIsResetting(false);
    }
  };

  const handleDeleteSelectedUsers = async () => {
    if (!firestore || selectedUsers.length === 0) return;
    const batch = writeBatch(firestore);
    selectedUsers.forEach(id => batch.delete(doc(firestore, 'users', id)));
    try {
        await batch.commit();
        toast({ title: 'Perfiles Eliminados' });
        setSelectedUsers([]);
    } catch (e) { toast({ variant: 'destructive', title: 'Error' }); }
    setIsDeleteDialogOpen(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !consultantGroupsCollectionRef) return;
    try {
        const docRef = await addDoc(consultantGroupsCollectionRef, { name: normalizeText(newGroupName), members: [] });
        setNewGroupName('');
        setSelectedGroupId(docRef.id);
        toast({ title: 'Grupo Creado' });
    } catch (e) { console.error(e); }
  };

  const handleToggleMember = async (userId: string) => {
    if (!selectedGroup || !firestore) return;
    const isMember = selectedGroup.members.includes(userId);
    const newMembers = isMember ? selectedGroup.members.filter(id => id !== userId) : [...selectedGroup.members, userId];
    try { await updateDoc(doc(firestore, 'consultantGroups', selectedGroup.id), { members: newMembers }); }
    catch (e) { console.error(e); }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 512;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } }
            else { if (height > MAX) { width *= MAX / height; height = MAX; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setImagePreview(dataUrl);
            form.setValue('photoUrl', dataUrl, { shouldValidate: true });
        };
        img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isLoading = usersLoading || rolesLoading || consultantGroupsLoading || empresasLoading || cargosLoading || ubicacionesLoading || areasLoading || centrosCostoLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Nómina</h1>
            <p className="text-muted-foreground">Gestiona el personal de la empresa.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setGroupDialogOpen(true)}><Users className="mr-2 h-4 w-4" /> Grupos</Button>
            <Button onClick={() => handleOpenForm(null)}><UserPlus className="mr-2 h-4 w-4" /> Nuevo Empleado</Button>
        </div>
      </div>

      <Dialog open={isGroupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Gestión de Grupos de Consultores</DialogTitle>
                <DialogDescription>Agrupa empleados para procesos de observación y consultoría.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
                <div className="md:w-1/3 border-r pr-4 space-y-4">
                    <div className="flex gap-2">
                        <Input placeholder="Nuevo grupo..." value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                        <Button size="icon" onClick={handleCreateGroup} disabled={!newGroupName.trim()}><PlusCircle className="h-4 w-4" /></Button>
                    </div>
                    <ScrollArea className="h-[50vh]">
                        <div className="space-y-1">
                            {consultantGroups?.map(g => (
                                <Button key={g.id} variant={selectedGroupId === g.id ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setSelectedGroupId(g.id)}>{g.name}</Button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                    {selectedGroup ? (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold">{selectedGroup.name} ({selectedGroup.members.length} miembros)</h3>
                                <Button variant="ghost" size="icon" onClick={async () => { if(confirm('¿Eliminar grupo?')) { await deleteDoc(doc(firestore!, 'consultantGroups', selectedGroup.id)); setSelectedGroupId(null); } }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                            <Tabs defaultValue="members" className="flex-1 flex flex-col min-h-0">
                                <TabsList><TabsTrigger value="members">Miembros</TabsTrigger><TabsTrigger value="add">Añadir</TabsTrigger></TabsList>
                                <TabsContent value="members" className="flex-1 min-h-0"><ScrollArea className="h-full border rounded-md p-2">
                                    {groupMembers.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                                            <div className="text-sm"><p className="font-medium">{m.nombres} {m.apellidos}</p><p className="text-xs text-muted-foreground">{m.cargo}</p></div>
                                            <Button variant="ghost" size="icon" onClick={() => handleToggleMember(m.id)}><X className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                </ScrollArea></TabsContent>
                                <TabsContent value="add" className="flex-1 min-h-0 space-y-4">
                                    <Input placeholder="Buscar por nombre..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                                    <ScrollArea className="flex-1 h-[40vh] border rounded-md p-2">
                                        {availableForGroup.map(m => (
                                            <div key={m.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                                                <div className="text-sm"><p className="font-medium">{m.nombres} {m.apellidos}</p><p className="text-xs text-muted-foreground">{m.cargo}</p></div>
                                                <Button variant="ghost" size="icon" onClick={() => handleToggleMember(m.id)}><PlusCircle className="h-4 w-4" /></Button>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </>
                    ) : <div className="flex-1 flex items-center justify-center text-muted-foreground">Seleccione un grupo para gestionar miembros.</div>}
                </div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingUser ? 'Editar Perfil' : 'Nuevo Empleado'}</DialogTitle></DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                    <div className="flex items-center gap-6 pb-4 border-b">
                        <div className="relative group">
                            <Avatar className="h-24 w-24 border-2">
                                <AvatarImage src={imagePreview || undefined} />
                                <AvatarFallback><UserRound className="h-12 w-12 text-muted-foreground" /></AvatarFallback>
                            </Avatar>
                            <Label htmlFor="photo-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"><Camera className="h-6 w-6" /></Label>
                            <Input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-lg">Información Personal</h3>
                            <p className="text-sm text-muted-foreground">Datos básicos y de contacto del trabajador.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="codigo" render={({ field }) => (<FormItem><FormLabel>Código</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="cedula" render={({ field }) => (<FormItem><FormLabel>Cédula</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="apellidos" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="nombres" render={({ field }) => (<FormItem><FormLabel>Nombres</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="fechaNacimiento" render={({ field }) => (<FormItem><FormLabel>F. Nacimiento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <Separator />
                    <div className="space-y-1"><h3 className="font-bold text-lg">Información Laboral</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="empresa" render={({ field }) => (<FormItem><FormLabel>Empresa</FormLabel><Combobox options={toOptions(empresas)} placeholder="Seleccionar..." {...field} allowCreate /></FormItem>)} />
                        <FormField control={form.control} name="cargo" render={({ field }) => (<FormItem><FormLabel>Cargo</FormLabel><Combobox options={toOptions(cargos)} placeholder="Seleccionar..." {...field} allowCreate /></FormItem>)} />
                        <FormField control={form.control} name="departamento" render={({ field }) => (<FormItem><FormLabel>Departamento</FormLabel><Combobox options={toOptions(areas)} placeholder="Seleccionar..." {...field} allowCreate /></FormItem>)} />
                        <FormField control={form.control} name="ubicacion" render={({ field }) => (<FormItem><FormLabel>Ubicación</FormLabel><Combobox options={toOptions(ubicaciones)} placeholder="Seleccionar..." {...field} allowCreate /></FormItem>)} />
                        <FormField control={form.control} name="centroCosto" render={({ field }) => (<FormItem><FormLabel>Centro de Costo</FormLabel><Combobox options={toOptions(centrosCosto)} placeholder="Seleccionar..." {...field} allowCreate /></FormItem>)} />
                        <FormField control={form.control} name="fechaIngreso" render={({ field }) => (<FormItem><FormLabel>F. Ingreso</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="tipoContrato" render={({ field }) => (<FormItem><FormLabel>Tipo Contrato</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="INDEFINIDO">Indefinido</SelectItem><SelectItem value="EMERGENTE">Emergente</SelectItem></SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="rol" render={({ field }) => (<FormItem><FormLabel>Rol Sistema</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{roles?.map((r: any) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}</SelectContent></Select></FormItem>)} />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="liderArea" render={({ field }) => (<FormItem><FormLabel>Líder Asignado (Email)</FormLabel><FormControl><Input type="email" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="observerEmail" render={({ field }) => (<FormItem><FormLabel>Observador / Consultor (Email)</FormLabel><FormControl><Input type="email" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="isLeader" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Es Líder de Área</FormLabel><FormDescription>Habilita la capacidad de evaluar otros.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="Status" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Estado Activo</FormLabel></div><FormControl><Switch checked={field.value === 'active'} onCheckedChange={(v) => field.onChange(v ? 'active' : 'inactive')} /></FormControl></FormItem>)} />
                    </div>
                    <DialogFooter><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <LoaderCircle className="animate-spin mr-2" /> : <Check className="mr-2" />}{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</Button></DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToReset} onOpenChange={(open) => { if(!open && !isResetting) setUserToReset(null); if(!open) { setResetStatus('idle'); setResetError(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{resetStatus === 'success' ? 'Reseteo Completo' : resetStatus === 'error' ? 'Error' : 'Resetear Contraseña'}</DialogTitle>
            {resetStatus === 'idle' && (
              <DialogDescription>
                  Se establecerá automáticamente el número de cédula como contraseña temporal para <strong>{userToReset?.nombres} {userToReset?.apellidos}</strong>.
                  <br/><br/>
                  El trabajador deberá actualizar su clave al ingresar.
              </DialogDescription>
            )}
          </DialogHeader>
          {resetStatus === 'idle' && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex gap-3 text-blue-800">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <div className="text-xs space-y-1"><p className="font-bold">PROCESO AUTOMATIZADO:</p><p>El sistema cambiará la clave en Autenticación y marcará el perfil para cambio obligatorio.</p></div>
              </div>
          )}
          {resetStatus === 'success' && (
              <div className="py-4 text-center space-y-2"><CheckCircle className="h-16 w-16 text-green-500 mx-auto" /><p className="font-semibold">¡Éxito!</p><p className="text-xs text-muted-foreground">La clave ahora es: <strong>{userToReset?.cedula}</strong></p></div>
          )}
          {resetStatus === 'error' && (
              <div className="py-4 text-center space-y-2 text-destructive"><AlertTriangle className="h-16 w-16 mx-auto" /><p className="font-semibold">No se pudo automatizar</p><p className="text-xs">{resetError}</p></div>
          )}
          <DialogFooter>
            {resetStatus === 'idle' ? (
                <><Button variant="ghost" onClick={() => setUserToReset(null)} disabled={isResetting}>Cancelar</Button><Button onClick={handlePasswordReset} disabled={isResetting}>{isResetting ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}Confirmar</Button></>
            ) : <Button onClick={() => setUserToReset(null)}>Cerrar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className='relative w-full max-w-sm'>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nombre, cédula, cargo..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-10" />
                </div>
                <div className="flex gap-2">
                    {selectedUsers.length > 0 && <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar ({selectedUsers.length})</Button>}
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12"><Checkbox checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length} onCheckedChange={(checked) => setSelectedUsers(checked ? filteredUsers.map(u => u.id) : [])} /></TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Cargo / Empresa</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Líder</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={6}><div className="h-10 bg-muted animate-pulse rounded" /></TableCell></TableRow>)) :
                    filteredUsers.map(u => (
                        <TableRow key={u.id}>
                            <TableCell><Checkbox checked={selectedUsers.includes(u.id)} onCheckedChange={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} /></TableCell>
                            <TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={u.photoUrl} /><AvatarFallback>{u.nombres[0]}</AvatarFallback></Avatar><div><p className="font-medium">{u.nombres} {u.apellidos}</p><p className="text-xs text-muted-foreground">{u.email}</p></div></div></TableCell>
                            <TableCell><p className="text-sm">{u.cargo}</p><p className="text-xs text-muted-foreground">{u.empresa}</p></TableCell>
                            <TableCell><Switch checked={u.Status === 'active'} onCheckedChange={(v) => handleStatusChange(u, v)} /></TableCell>
                            <TableCell><Switch checked={!!u.isLeader} onCheckedChange={(v) => handleIsLeaderChange(u, v)} /></TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenForm(u)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setUserToReset(u)} className="text-primary"><KeyRound className="mr-2 h-4 w-4" /> Resetear Contraseña</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle><AlertDialogDescription>Se borrarán {selectedUsers.length} perfiles permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={handleDeleteSelectedUsers}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
