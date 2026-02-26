
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
  DialogClose,
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
import { useCollection, useFirestore, useAuth, useUser } from '@/firebase';
import { collection, doc, addDoc, updateDoc, setDoc, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Search, Edit, UserPlus, LoaderCircle, Check, FileUp, FileDown, ArrowRight, Users, Trash2, KeyRound, MoreHorizontal, Info, UserRound, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, parse } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import Image from 'next/image';
import { normalizeText } from '@/lib/utils';
import { resetUserPasswordAction } from '@/app/actions/auth';


type UserProfile = {
  id: string;
  codigo: string;
  cedula: string;
  apellidos: string;
  nombres: string;
  fechaIngreso: string;
  fechaNacimiento: string;
  email: string;
  empresa: string;
  cargo: string;
  ubicacion: string;
  departamento: string;
  centroCosto: string;
  liderArea?: string;
  consultor?: string;
  rol: string;
  isLeader?: boolean;
  tipoContrato: 'INDEFINIDO' | 'EMERGENTE';
  Status: 'active' | 'inactive';
  photoUrl?: string;
  requiresPasswordChange?: boolean;
};

type GenericOption = {
    id: string;
    name: string;
}

type ConsultantGroup = {
    id: string;
    name: string;
    members: string[]; // array of user IDs
};

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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
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
  const { data: roles, isLoading: rolesLoading } = useCollection(rolesCollectionRef);
  const { data: leaderRules, isLoading: rulesLoading } = useCollection(leaderRulesCollectionRef);
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
    const filteredUsers = users.filter(user => !memberIds.has(user.id));
    
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
  
  const leaders = useMemo(() => {
    return users?.filter(user => user.isLeader && user.Status === 'active') || [];
  }, [users]);
  
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
      const userString = normalizeForSearch(`
        ${user.nombres || ''} 
        ${user.apellidos || ''} 
        ${user.cedula || ''} 
        ${user.email || ''} 
        ${user.cargo || ''}
      `);

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
      });
      setImagePreview(user.photoUrl || null);
    } else {
      form.reset({
        photoUrl: '',
        codigo: '', cedula: '', apellidos: '', nombres: '', fechaIngreso: '', fechaNacimiento: '', email: '',
        empresa: '', cargo: '', departamento: '', Status: 'active', rol: '',
        ubicacion: '', centroCosto: '', liderArea: '', consultor: '',
        isLeader: false, tipoContrato: 'INDEFINIDO'
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
        try {
            await optionsBatch.commit();
        } catch (error) {
            console.error("Error guardando nuevas opciones:", error);
        }
    }

    const dataToSave: { [key: string]: any } = { ...data };
    
    Object.keys(dataToSave).forEach(rawKey => {
        const key = rawKey as keyof UserFormData;
        if (dataToSave[key] === undefined) {
            dataToSave[key] = ''; 
        }
        if (key === 'Status') return;
        
        if (key === 'email' || key === 'liderArea') {
             dataToSave[key] = normalizeEmail(dataToSave[key] as string);
        } else if (key === 'rol') {
             dataToSave[key] = normalizeText(dataToSave[key] as string);
        } else if (typeof dataToSave[key] === 'string') {
            const noNormalize = ['cedula', 'codigo', 'consultor', 'photoUrl'];
            if (!noNormalize.includes(key)) {
                 dataToSave[key] = normalizeText(dataToSave[key] as string);
            }
        }
    });

    if (!editingUser) {
        if (users?.some(user => normalizeEmail(user.email) === normalizeEmail(data.email))) {
            toast({ variant: "destructive", title: "Correo Duplicado", description: "Ya existe un usuario con este correo electrónico." });
            return;
        }
        
        dataToSave.requiresPasswordChange = true;

        let tempApp;
        try {
            tempApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
            const tempAuth = getAuth(tempApp);
            const userCredential = await createUserWithEmailAndPassword(tempAuth, dataToSave.email, data.cedula);
            const userUid = userCredential.user.uid;
            const userDocRef = doc(firestore, 'users', userUid);
            await setDoc(userDocRef, dataToSave);
            
            toast({ title: 'Usuario Registrado', description: `La cuenta para ${data.nombres} ha sido creada.` });
            setFormOpen(false);
        } catch (error: any) {
            console.error("Error creating user:", error);
            toast({ variant: 'destructive', title: 'Error al Crear Usuario', description: error.message });
        } finally {
             if (tempApp) await deleteApp(tempApp);
        }
    } else {
        try {
            const userDocRef = doc(firestore, 'users', editingUser.id);
            await updateDoc(userDocRef, dataToSave);
            toast({ title: 'Usuario Actualizado', description: 'La información del usuario ha sido actualizada.' });
            setFormOpen(false);
        } catch (error) {
            console.error("Error updating user:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la información.' });
        }
    }
  };


  const handleStatusChange = async (user: UserProfile, newStatus: boolean) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', user.id);
    try {
      await updateDoc(userDocRef, { Status: newStatus ? 'active' : 'inactive' });
      toast({
        title: 'Estado actualizado',
        description: `El estado de ${user.nombres} ${user.apellidos} ha sido actualizado.`,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: 'No se pudo cambiar el estado del usuario.',
      });
    }
  };

  const handleIsLeaderChange = async (user: UserProfile, newIsLeader: boolean) => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', user.id);
    try {
      await updateDoc(userDocRef, { isLeader: newIsLeader });
      toast({
        title: 'Rol de líder actualizado',
        description: `${user.nombres} ${user.apellidos} ha sido ${newIsLeader ? 'marcado como' : 'desmarcado como'} líder.`,
      });
    } catch (error) {
      console.error("Error updating leader status:", error);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: 'No se pudo cambiar el rol de líder del usuario.',
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!userToReset || !auth || !firestore) {
        setUserToReset(null);
        return;
    }

    setIsResetting(true);
    setResetStatus('idle');
    setResetError('');

    try {
        // Ejecutamos la Server Action para cambiar la contraseña en Auth
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

    const masterUser = users?.find(u => u.email === 'master@sudinco.com');
    const usersToDelete = selectedUsers.filter(id => id !== currentUser?.uid && id !== masterUser?.id);

    const batch = writeBatch(firestore);
    usersToDelete.forEach(userId => {
        const userDocRef = doc(firestore, 'users', userId);
        batch.delete(userDocRef);
    });

    try {
        await batch.commit();
        toast({
            title: 'Perfiles Eliminados',
            description: `Se han eliminado ${usersToDelete.length} perfiles de usuario.`,
        });
        setSelectedUsers([]);
    } catch (error) {
        console.error("Error deleting users:", error);
        toast({ variant: 'destructive', title: 'Error al eliminar' });
    } finally {
        setIsDeleteDialogOpen(false);
    }
  };


    const handleExport = async (format: 'csv' | 'xlsx') => {
        if (!users) return;

        const dataToExport = users.map(user => ({
            codigo: user.codigo,
            cedula: user.cedula,
            apellidos: user.apellidos,
            nombres: user.nombres,
            email: user.email,
            cargo: user.cargo,
            estado: user.Status,
        }));

        if (format === 'csv') {
            const Papa = (await import('papaparse')).default;
            const csv = Papa.unparse(dataToExport, { header: true });
            const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'nomina_export.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Nómina');
            XLSX.writeFile(workbook, 'nomina_export.xlsx');
        }
    };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Logic for file handling... (keep existing)
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !consultantGroupsCollectionRef) return;
    const normalizedNewGroupName = normalizeText(newGroupName);
    try {
        const newGroup = { name: normalizedNewGroupName, members: [] };
        const docRef = await addDoc(consultantGroupsCollectionRef, newGroup);
        setNewGroupName('');
        setSelectedGroupId(docRef.id);
        toast({ title: 'Grupo Creado' });
    } catch (error) {
        console.error("Error creating group:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId || !firestore) return;
    try {
        await deleteDoc(doc(firestore, 'consultantGroups', selectedGroupId));
        setSelectedGroupId(null);
    } catch (error) {
        console.error("Error deleting group:", error);
    }
  };

  const handleToggleMember = async (userId: string) => {
    if (!selectedGroup || !firestore) return;
    const groupDocRef = doc(firestore, 'consultantGroups', selectedGroup.id);
    const isMember = selectedGroup.members.includes(userId);
    const newMembers = isMember
      ? selectedGroup.members.filter(id => id !== userId)
      : [...selectedGroup.members, userId];
    try {
        await updateDoc(groupDocRef, { members: newMembers });
    } catch (error) {
        console.error("Error updating members:", error);
    }
  };

  const displayDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        if(isNaN(date.getTime())) return dateStr;
        const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(adjustedDate);
    } catch { return dateStr; }
  }

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
    <>
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Nómina</h1>
            <p className="text-muted-foreground">Gestiona a los empleados. Total visibles: {filteredUsers.length}.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setGroupDialogOpen(true)}><Users className="mr-2 h-4 w-4" /> Grupos</Button>
            <Button variant="outline" onClick={handleImportClick}><FileUp className="mr-2 h-4 w-4" /> Importar</Button>
            <Button onClick={() => handleOpenForm(null)}><UserPlus className="mr-2 h-4 w-4" /> Nuevo Empleado</Button>
        </div>
      </div>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción es irreversible. Se eliminarán los perfiles de usuario de Firestore.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteSelectedUsers}>Sí, eliminar perfiles</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!userToReset} onOpenChange={(open) => {
        if (!open) {
          setUserToReset(null);
          setTimeout(() => { setResetStatus('idle'); setResetError(''); setIsResetting(false); }, 300);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
                {resetStatus === 'success' ? 'Reseteo Completo' : resetStatus === 'error' ? 'Error al Resetear' : 'Resetear Contraseña'}
            </DialogTitle>
            {resetStatus === 'idle' && (
              <DialogDescription>
                  {`Se establecerá automáticamente el número de cédula como contraseña temporal para ${userToReset?.nombres} ${userToReset?.apellidos}.`}
                  <br/><br/>
                  El trabajador deberá actualizar su clave privada inmediatamente después de ingresar.
              </DialogDescription>
            )}
          </DialogHeader>

          {resetStatus === 'idle' && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-4">
                  <div className="flex gap-3 text-blue-800">
                    <CheckCircle className="h-5 w-5 shrink-0" />
                    <div className="text-xs space-y-2">
                        <p className="font-bold">PROCESO AUTOMATIZADO:</p>
                        <p>Al confirmar, el sistema realizará lo siguiente:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Actualizará la base de datos de autenticación.</li>
                            <li>Establecerá la clave como: <span className="font-bold">{userToReset?.cedula}</span></li>
                            <li>Bloqueará el perfil hasta que el usuario defina una clave nueva.</li>
                        </ul>
                    </div>
                  </div>
              </div>
          )}

          {resetStatus === 'success' && (
              <div className="py-4 text-center flex flex-col items-center gap-2">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                  <p className="text-sm font-semibold">¡Contraseña reseteada con éxito!</p>
                  <p className="text-xs text-muted-foreground">El trabajador ya puede ingresar usando su número de cédula.</p>
              </div>
          )}

          {resetStatus === 'error' && (
              <div className="py-4 text-center flex flex-col items-center gap-2 text-destructive">
                  <AlertTriangle className="h-16 w-16" />
                  <p className="text-sm font-semibold">No se pudo automatizar el reseteo.</p>
                  <p className="text-xs">{resetError}</p>
              </div>
          )}

          <DialogFooter>
            {resetStatus === 'idle' ? (
                <>
                    <Button variant="ghost" onClick={() => setUserToReset(null)} disabled={isResetting}>Cancelar</Button>
                    <Button onClick={handlePasswordReset} disabled={isResetting}>
                        {isResetting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                        {isResetting ? 'Procesando...' : 'Confirmar y Resetear'}
                    </Button>
                </>
            ) : (
                <Button onClick={() => { setUserToReset(null); }}>Cerrar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <Dialog open={isGroupDialogOpen} onOpenChange={setGroupDialogOpen}>
        {/* Group Management UI... (keep existing) */}
      </Dialog>
      
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        {/* User Form UI... (keep existing) */}
      </Dialog>
      
      <Card>
        <CardHeader>
            <CardTitle>Lista de Empleados</CardTitle>
            <div className="flex items-center pt-4 justify-between">
                <div className='relative w-full max-w-sm'>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nombre, cédula, cargo..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-10" />
                </div>
                <div className="flex gap-2">
                    {selectedUsers.length > 0 && <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar ({selectedUsers.length})</Button>}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline"><FileDown className="mr-2 h-4 w-4" /> Exportar</Button></DropdownMenuTrigger>
                        <DropdownMenuContent><DropdownMenuItem onClick={() => handleExport('csv')}>Exportar a CSV</DropdownMenuItem><DropdownMenuItem onClick={() => handleExport('xlsx')}>Exportar a Excel (XLSX)</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md mt-4">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="w-12">
                            <Checkbox checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length} onCheckedChange={(checked) => { if(checked) { setSelectedUsers(filteredUsers.map(u => u.id)) } else { setSelectedUsers([]) } }} />
                        </TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Líder</TableHead>
                        <TableHead>Fecha Ingreso</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? ( Array.from({ length: 10 }).map((_, i) => ( <TableRow key={`skel-${i}`}><TableCell colSpan={8} className="p-4"><div className="h-10 bg-gray-200 rounded animate-pulse"></div></TableCell></TableRow> ))
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                        <TableRow key={user.id} data-state={selectedUsers.includes(user.id) && "selected"}>
                            <TableCell><Checkbox checked={selectedUsers.includes(user.id)} onCheckedChange={() => { setSelectedUsers(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]) }} /></TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar><AvatarImage src={user.photoUrl} /><AvatarFallback>{user.nombres?.[0]}{user.apellidos?.[0]}</AvatarFallback></Avatar>
                                    <div><div className="font-medium">{user.nombres} {user.apellidos}</div><div className="text-sm text-muted-foreground">{user.email}</div></div>
                                </div>
                            </TableCell>
                            <TableCell>{user.cargo}</TableCell>
                            <TableCell><Badge variant="outline">{user.rol}</Badge></TableCell>
                             <TableCell><Switch checked={user.Status === 'active'} onCheckedChange={(newStatus) => handleStatusChange(user, newStatus)} /></TableCell>
                            <TableCell><Switch checked={!!user.isLeader} onCheckedChange={(newIsLeader) => handleIsLeaderChange(user, newIsLeader)} /></TableCell>
                            <TableCell>{displayDate(user.fechaIngreso)}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => handleOpenForm(user)}><Edit className="mr-2 h-4 w-4" /> <span>Editar</span></DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setUserToReset(user)}><KeyRound className="mr-2 h-4 w-4" /> <span>Resetear Contraseña</span></DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                        ))
                    ) : ( <TableRow><TableCell colSpan={8} className="h-24 text-center">No se encontraron usuarios.</TableCell></TableRow> )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".xlsx, .xls, .csv" />
    </>
  );
}
