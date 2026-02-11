
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
import { PlusCircle, Search, Edit, UserPlus, LoaderCircle, Check, FileUp, FileDown, ArrowRight, Users, Trash2, KeyRound, MoreHorizontal, Info, UserRound } from 'lucide-react';
import { format, parse } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import Image from 'next/image';


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

type ChangeDetail = {
    field: string;
    oldValue: any;
    newValue: any;
};

type ImportAnalysis = {
    user: Partial<UserProfile>;
    status: 'new' | 'update';
    changes: ChangeDetail[];
}[];


const formatDateForInput = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        // Adjust for timezone issues by creating date in UTC
        const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        return format(utcDate, 'yyyy-MM-dd');
    } catch {
        return '';
    }
};

const normalizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
      .normalize('NFD') 
      .replace(/[\u0300-\u036f]/g, '') 
      .toUpperCase() 
      .replace(/\s+/g, ' ') 
      .trim();
};

const normalizeEmail = (email: string | undefined | null): string => {
    if (!email) return '';
    return email
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .toLowerCase() // convert to lowercase
      .replace(/\s+/g, '') // remove all whitespace
      .trim();
};

export default function StaffPage() {
  const [filter, setFilter] = useState('');
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dataToImport, setDataToImport] = useState<any[]>([]);
  const [importAnalysis, setImportAnalysis] = useState<ImportAnalysis | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
  const [isGroupDialogOpen, setGroupDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const migrationCompleted = useRef(false);

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const firestore = useFirestore();
  const auth = useAuth();
  const { user: currentUser } = useUser();
  const usersCollectionRef = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const rolesCollectionRef = useMemo(() => firestore ? collection(firestore, 'roles') : null, [firestore]);
  const rulesCollectionRef = useMemo(() => firestore ? collection(firestore, 'leaderAssignmentRules') : null, [firestore]);
  const consultantGroupsCollectionRef = useMemo(() => firestore ? collection(firestore, 'consultantGroups') : null, [firestore]);

  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersCollectionRef);
  const { data: roles, isLoading: rolesLoading } = useCollection(rolesCollectionRef);
  const { data: leaderRules, isLoading: rulesLoading } = useCollection(rulesCollectionRef);
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
  const watchedEmpresa = watch('empresa');
  const watchedUbicacion = watch('ubicacion');

  const toOptions = (data: GenericOption[] | null | undefined) => {
    if (!data) return [];
    return data.map(item => ({ label: item.name, value: item.name }));
  }

  const cascadedUbicacionOptions = useMemo(() => {
    if (!watchedEmpresa || !users) return toOptions(ubicaciones);
    const relevantUbicaciones = new Set(
        users
            .filter(u => normalizeText(u.empresa) === normalizeText(watchedEmpresa))
            .map(u => u.ubicacion)
            .filter(Boolean) as string[]
    );
    return Array.from(relevantUbicaciones).sort().map(name => ({ label: name, value: name }));
  }, [watchedEmpresa, users, ubicaciones]);


  const cascadedCargoOptions = useMemo(() => {
    if (!watchedEmpresa || !users) return toOptions(cargos);
    
    let filteredUsers = users;
    if (watchedEmpresa) {
        filteredUsers = users.filter(u => normalizeText(u.empresa) === normalizeText(watchedEmpresa));
    }

    if (watchedUbicacion) {
        filteredUsers = filteredUsers.filter(u => normalizeText(u.ubicacion) === normalizeText(watchedUbicacion));
    }
    
    const relevantCargos = new Set(
        filteredUsers
            .map(u => u.cargo)
            .filter(Boolean) as string[]
    );
    return Array.from(relevantCargos).sort().map(name => ({ label: name, value: name }));
  }, [watchedEmpresa, watchedUbicacion, users, cargos]);

  useEffect(() => {
    if (migrationCompleted.current || !firestore || !users || users.length === 0) return;

    const usersToUpdate = users.filter(u => !u.fechaNacimiento);
    if (usersToUpdate.length > 0) {
      migrationCompleted.current = true; // Prevent re-running
      console.log(`Found ${usersToUpdate.length} users missing date of birth. Updating...`);
      const batch = writeBatch(firestore);
      usersToUpdate.forEach(user => {
        const userDocRef = doc(firestore, 'users', user.id);
        // Generate a random birth date between 20 and 60 years ago
        const birthYear = new Date().getFullYear() - (20 + Math.floor(Math.random() * 40));
        const birthMonth = Math.floor(Math.random() * 12);
        const birthDay = Math.floor(Math.random() * 28) + 1; // Avoid issues with month lengths
        const birthDate = new Date(birthYear, birthMonth, birthDay);
        batch.update(userDocRef, { fechaNacimiento: format(birthDate, 'yyyy-MM-dd') });
      });

      batch.commit().then(() => {
        toast({
          title: 'Datos de Usuario Completados',
          description: `Se ha añadido una fecha de nacimiento ficticia a ${usersToUpdate.length} usuarios.`,
        });
      }).catch(error => {
        console.error("Error auto-filling birth dates:", error);
        toast({
            variant: "destructive",
            title: "Error al autocompletar datos",
            description: "No se pudieron añadir las fechas de nacimiento.",
        });
      });
    }
  }, [firestore, users]);

  useEffect(() => {
    if (users && users.some(u => !u.tipoContrato)) {
      const batch = writeBatch(firestore);
      let updatedCount = 0;
      users.forEach(user => {
        if (!user.tipoContrato) {
          const userDocRef = doc(firestore, 'users', user.id);
          const randomContract = Math.random() < 0.5 ? 'INDEFINIDO' : 'EMERGENTE';
          batch.update(userDocRef, { tipoContrato: randomContract });
          updatedCount++;
        }
      });
      if (updatedCount > 0) {
        batch.commit().then(() => {
          toast({ title: 'Datos Actualizados', description: `${updatedCount} usuarios han sido actualizados con un tipo de contrato aleatorio.`});
        }).catch(err => {
          console.error("Error updating random contracts:", err);
        });
      }
    }
  }, [users, firestore]);

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

    // --- Start: New logic to save new options ---
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
            toast({ title: 'Nuevas Opciones Guardadas', description: 'Se han añadido nuevas opciones a los desplegables.' });
        } catch (error) {
            console.error("Error guardando nuevas opciones:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar las nuevas opciones." });
            return; // Detener si no se pueden guardar las opciones
        }
    }
    // --- End: New logic ---

    const dataToSave: { [key: string]: any } = { ...data };
    
    Object.keys(dataToSave).forEach(rawKey => {
        const key = rawKey as keyof UserFormData;
        if (dataToSave[key] === undefined) {
            dataToSave[key] = ''; 
        }
        // This is the important part: don't normalize the 'Status' field.
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
        if (users?.some(user => user.cedula === data.cedula)) {
            toast({ variant: "destructive", title: "Cédula Duplicada", description: "Ya existe un usuario con esta cédula." });
            return;
        }
        
        dataToSave.requiresPasswordChange = true;

        let tempApp;
        try {
            tempApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
            const tempAuth = getAuth(tempApp);
            const userCredential = await createUserWithEmailAndPassword(tempAuth, dataToSave.email, data.cedula);
            await deleteApp(tempApp);
            tempApp = undefined;
            const userUid = userCredential.user.uid;
            const userDocRef = doc(firestore, 'users', userUid);
            await setDoc(userDocRef, dataToSave);
            
            toast({ title: 'Usuario Registrado', description: `La cuenta para ${data.nombres} ha sido creada.` });
            setFormOpen(false);
        } catch (error: any) {
            console.error("Error creating user:", error);
            let description = 'Ocurrió un error inesperado al crear el usuario.';
            if (error.code === 'auth/email-already-in-use') {
                description = 'Este correo electrónico ya está registrado en el sistema de autenticación.';
            } else if (error.code === 'auth/weak-password') {
                description = 'La contraseña (número de cédula) es demasiado débil (mínimo 6 caracteres).';
            }
            toast({ variant: 'destructive', title: 'Error al Crear Usuario', description, duration: 8000 });
        } finally {
             if (tempApp) await deleteApp(tempApp);
        }
    } else { // Logic for editing an existing user
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
    if (!userToReset || !auth) {
        setUserToReset(null);
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, userToReset.email, userToReset.cedula);
        toast({
            title: 'Cuenta de Acceso Creada/Restablecida',
            description: `Se ha creado una cuenta para ${userToReset.email} con su número de cédula como contraseña.`,
        });
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            toast({
                variant: 'destructive',
                title: 'La Cuenta ya Existe',
                description: 'La cuenta de autenticación para este correo electrónico ya existe. Para restablecerla, debe eliminarla primero desde la Consola de Firebase.',
                duration: 10000,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Error al Crear Cuenta',
                description: `Ocurrió un error: ${error.message}`,
            });
        }
    } finally {
        setUserToReset(null);
    }
  };

  const handleDeleteSelectedUsers = async () => {
    if (!firestore || selectedUsers.length === 0) return;

    const masterUser = users?.find(u => u.email === 'master@sudinco.com');
    const usersToDelete = selectedUsers.filter(id => id !== currentUser?.uid && id !== masterUser?.id);
    const skippedCount = selectedUsers.length - usersToDelete.length;

    if (usersToDelete.length === 0) {
        toast({
            variant: 'destructive',
            title: 'Eliminación Omitida',
            description: 'No se puede eliminar al usuario maestro o a ti mismo.',
        });
        setIsDeleteDialogOpen(false);
        return;
    }

    const batch = writeBatch(firestore);
    usersToDelete.forEach(userId => {
        const userDocRef = doc(firestore, 'users', userId);
        batch.delete(userDocRef);
    });

    try {
        await batch.commit();
        toast({
            title: 'Perfiles Eliminados',
            description: `Se han eliminado ${usersToDelete.length} perfiles de usuario de Firestore.`,
        });
        if (skippedCount > 0) {
            toast({
                variant: 'default',
                title: 'Eliminación Omitida',
                description: `Se omitió la eliminación de ${skippedCount} usuario(s) protegidos.`,
            });
        }
        toast({
            variant: 'destructive',
            title: 'Acción Requerida',
            description: 'Recuerda eliminar las cuentas de autenticación manualmente desde la Consola de Firebase.',
            duration: 10000,
        });
        setSelectedUsers([]);
    } catch (error) {
        console.error("Error deleting users:", error);
        toast({
            variant: 'destructive',
            title: 'Error al eliminar',
            description: 'No se pudieron eliminar los perfiles de usuario.',
        });
    } finally {
        setIsDeleteDialogOpen(false);
    }
  };


    const handleExport = (format: 'csv' | 'xlsx') => {
        if (!users) {
            toast({ variant: 'destructive', title: 'Error', description: 'No hay datos de usuarios para exportar.' });
            return;
        }

        const dataToExport = users.map(user => ({
            codigo: user.codigo,
            cedula: user.cedula,
            apellidos: user.apellidos,
            nombres: user.nombres,
            fecha_ingreso: user.fechaIngreso,
            fecha_nacimiento: user.fechaNacimiento,
            email: user.email,
            empresa: user.empresa,
            cargo: user.cargo,
            tipo_contrato: user.tipoContrato,
            ubicacion: user.ubicacion,
            departamento: user.departamento,
            centro_costo: user.centroCosto,
            lider_area: user.liderArea,
            consultor: user.consultor,
            rol: user.rol,
            estado: user.Status,
        }));

        if (format === 'csv') {
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
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Nómina');
            XLSX.writeFile(workbook, 'nomina_export.xlsx');
        }
    };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const excelSerialToDate = (serial: number) => {
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;                                        
    const date_info = new Date(utc_value * 1000);

    const fractional_day = serial - Math.floor(serial) + 0.0000001;

    let total_seconds = Math.floor(86400 * fractional_day);

    const seconds = total_seconds % 60;
    total_seconds -= seconds;

    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;

    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !users) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const requiredHeaders = ['cedula', 'codigo', 'apellidos', 'nombres', 'email', 'rol', 'empresa', 'cargo', 'departamento'];
        if (jsonData.length > 0 && requiredHeaders.every(h => h in jsonData[0])) {
            setDataToImport(jsonData);
            analyzeImportData(jsonData);
        } else {
            toast({
                variant: "destructive",
                title: "Archivo no válido",
                description: `El archivo debe contener al menos las columnas: ${requiredHeaders.join(', ')}.`
            });
        }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const analyzeImportData = (importedData: any[]) => {
    if (!users) return;

    const usersByCedula = new Map(users.map(u => [u.cedula, u]));
    const analysisResult: ImportAnalysis = [];

    importedData.forEach(row => {
        const cedula = String(row.cedula || '');
        const existingUser = usersByCedula.get(cedula);

        let fechaIngreso = row.fecha_ingreso;
        if (typeof fechaIngreso === 'number') {
            fechaIngreso = format(excelSerialToDate(fechaIngreso), 'yyyy-MM-dd');
        } else if (typeof fechaIngreso === 'string' && fechaIngreso.includes('/')) {
            try {
                fechaIngreso = format(parse(fechaIngreso, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd');
            } catch { fechaIngreso = ''; }
        }
        
        let fechaNacimiento = row.fecha_nacimiento;
        if (typeof fechaNacimiento === 'number') {
            fechaNacimiento = format(excelSerialToDate(fechaNacimiento), 'yyyy-MM-dd');
        } else if (typeof fechaNacimiento === 'string' && fechaNacimiento.includes('/')) {
            try {
                fechaNacimiento = format(parse(fechaNacimiento, 'dd/MM/yyyy', new Date()), 'yyyy-MM-dd');
            } catch { fechaNacimiento = ''; }
        }

        const importUser: Omit<UserProfile, 'id' | 'isLeader' | 'photoUrl'> = {
            codigo: String(row.codigo || ''),
            cedula: cedula,
            apellidos: normalizeText(row.apellidos),
            nombres: normalizeText(row.nombres),
            fechaIngreso: fechaIngreso,
            fechaNacimiento: fechaNacimiento,
            email: normalizeEmail(row.email),
            empresa: normalizeText(row.empresa),
            cargo: normalizeText(row.cargo),
            ubicacion: normalizeText(row.ubicacion),
            departamento: normalizeText(row.departamento),
            centroCosto: normalizeText(row.centro_costo),
            liderArea: normalizeEmail(row.lider_area),
            consultor: row.consultor || '',
            rol: (row.rol || '').toUpperCase(),
            tipoContrato: normalizeText(row.tipo_contrato) === 'EMERGENTE' ? 'EMERGENTE' : 'INDEFINIDO',
            Status: (String(row.estado || '').toLowerCase() === 'active' || String(row.estado || '').toLowerCase() === 'activo') ? 'active' : 'inactive',
        };

        if (existingUser) {
            const changes: ChangeDetail[] = [];
            Object.keys(importUser).forEach(key => {
                const fieldKey = key as keyof typeof importUser;
                const newValue = importUser[fieldKey];
                const oldValue = existingUser[fieldKey as keyof UserProfile];
                if (normalizeText(String(newValue || '')) !== normalizeText(String(oldValue || ''))) {
                    changes.push({ field: fieldKey, oldValue, newValue });
                }
            });

            if (changes.length > 0) {
                analysisResult.push({ user: { ...importUser, id: existingUser.id }, status: 'update', changes });
            }
        } else {
            analysisResult.push({ user: importUser, status: 'new', changes: [] });
        }
    });

    setImportAnalysis(analysisResult);
    setIsImportDialogOpen(true);
};


  const confirmImport = async () => {
    if (!importAnalysis || !firestore || !usersCollectionRef || !auth) return;

    const batch = writeBatch(firestore);
    const newUsersForAuth: {email: string, cedula: string}[] = [];

    importAnalysis.forEach(item => {
        if (item.status === 'new' && item.user.email && item.user.cedula) {
            const newDocRef = doc(usersCollectionRef);
            batch.set(newDocRef, item.user);
            newUsersForAuth.push({email: item.user.email, cedula: item.user.cedula});
        } else if (item.status === 'update' && item.user.id) {
            const userDocRef = doc(firestore, 'users', item.user.id);
            const updateData: { [key: string]: any } = {};
            item.changes.forEach(change => {
                updateData[change.field] = change.newValue;
            });
            batch.update(userDocRef, updateData);
        }
    });

    try {
        await batch.commit();
        const createdCount = importAnalysis.filter(i => i.status === 'new').length;
        const updatedCount = importAnalysis.filter(i => i.status === 'update').length;
        toast({
            title: "Importación de Perfiles Completada",
            description: `${createdCount} usuarios creados y ${updatedCount} actualizados en la base de datos.`
        });

        if (newUsersForAuth.length > 0) {
             toast({
                title: 'Creando Cuentas de Acceso...',
                description: `Se crearán ${newUsersForAuth.length} nuevas cuentas. Esto puede tardar un momento.`
            });
            
            for (const newUser of newUsersForAuth) {
                try {
                    await createUserWithEmailAndPassword(auth, newUser.email, newUser.cedula);
                } catch (authError: any) {
                    console.error(`Failed to create auth account for ${newUser.email}:`, authError.message);
                    toast({
                        variant: 'destructive',
                        title: `Error al crear cuenta para ${newUser.email}`,
                        description: `Motivo: ${authError.message}`,
                        duration: 7000
                    });
                }
            }
             toast({
                title: 'Proceso de Cuentas Finalizado',
                description: `Se ha intentado crear todas las cuentas de acceso. Revise si hay notificaciones de error.`
            });
        }

    } catch (error) {
         console.error("Error importing users:", error);
         toast({
             variant: "destructive",
             title: "Error en la importación",
             description: "Ocurrió un error al guardar los datos."
         });
    }

    setIsImportDialogOpen(false);
    setImportAnalysis(null);
    setDataToImport([]);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !consultantGroupsCollectionRef) return;
    const normalizedNewGroupName = normalizeText(newGroupName);
    if (consultantGroups?.some(g => normalizeText(g.name) === normalizedNewGroupName)) {
        toast({ variant: 'destructive', title: 'Error', description: 'Ya existe un grupo con ese nombre.'});
        return;
    }
    try {
        const newGroup = { name: normalizedNewGroupName, members: [] };
        const docRef = await addDoc(consultantGroupsCollectionRef, newGroup);
        setNewGroupName('');
        setSelectedGroupId(docRef.id);
        toast({ title: 'Grupo Creado', description: `El grupo "${normalizedNewGroupName}" ha sido creado.` });
    } catch (error) {
        console.error("Error creating group:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el grupo.'});
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId || !firestore) return;
    try {
        await deleteDoc(doc(firestore, 'consultantGroups', selectedGroupId));
        toast({ title: 'Grupo Eliminado', description: `El grupo ha sido eliminado.` });
        setSelectedGroupId(null);
    } catch (error) {
        console.error("Error deleting group:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el grupo.'});
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
        toast({ title: 'Miembros actualizados', description: `Se ha actualizado la lista de miembros del grupo.` });
    } catch (error) {
        console.error("Error updating members:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el grupo.'});
    }
  };

  const displayDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        if(isNaN(date.getTime())) return dateStr;
        const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(adjustedDate);
    } catch {
        return dateStr;
    }
  }

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({
                variant: 'destructive',
                title: 'Archivo no válido',
                description: 'Por favor, selecciona un archivo de imagen.',
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 512;
                const MAX_HEIGHT = 512;
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
            <p className="text-muted-foreground">Gestiona a los empleados de la empresa. Hay {filteredUsers.length} empleados visibles.</p>
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
                <AlertDialogDescription>
                    Esta acción es irreversible. Se eliminarán los perfiles de {selectedUsers.length} usuario(s) de la base de datos de Firestore.
                    <br/><br/>
                    <span className="font-bold text-destructive">Importante:</span> Las cuentas de autenticación de estos usuarios NO se eliminarán automáticamente. Deberás eliminarlas manualmente desde la Consola de Firebase para completar el proceso.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={handleDeleteSelectedUsers}
                >
                    Sí, eliminar perfiles
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToReset} onOpenChange={() => setUserToReset(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Restablecer Contraseña</AlertDialogTitle>
                <AlertDialogDescription>
                    {`¿Estás seguro de que quieres restablecer la contraseña para ${userToReset?.nombres} ${userToReset?.apellidos}?`}
                    <br/><br/>
                    Esto intentará crear una nueva cuenta de autenticación con la contraseña establecida a su número de cédula. Si la cuenta ya existe, esta acción no tendrá efecto.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handlePasswordReset}>Sí, Restablecer</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <Dialog open={isGroupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gestión de Grupos de Consultores</DialogTitle>
            <DialogDescription>
              Crea nuevos grupos, añade o elimina miembros de grupos existentes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className='space-y-2'>
                <Label htmlFor="new-group-name">Crear Nuevo Grupo</Label>
                <div className="flex gap-2">
                    <Input id="new-group-name" placeholder="Nombre del nuevo grupo" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                    <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}><PlusCircle className="mr-2 h-4 w-4" /> Crear</Button>
                </div>
              </div>
              <div className='space-y-2'>
                <Label>Gestionar Grupo Existente</Label>
                 <div className="flex items-center gap-2">
                    <Select onValueChange={setSelectedGroupId} value={selectedGroupId || ''}>
                        <SelectTrigger><SelectValue placeholder="Selecciona un grupo..." /></SelectTrigger>
                        <SelectContent>
                            {consultantGroups?.map(group => (
                                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="destructive" size="icon" onClick={handleDeleteGroup} disabled={!selectedGroupId}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              </div>
               <div>
                    <h3 className="font-semibold text-lg mb-2">Miembros Actuales</h3>
                     <Card className="h-64 overflow-y-auto">
                        <CardContent className="p-2">
                             {groupMembers.length > 0 ? (
                                <ul className="space-y-1">
                                    {groupMembers.map(member => (
                                        <li key={member.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted">
                                            <span className="text-sm">{member.nombres} {member.apellidos}</span>
                                            <Button variant="ghost" size="sm" onClick={() => handleToggleMember(member.id)}>Quitar</Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground p-4 text-center">Este grupo no tiene miembros.</p>
                            )}
                        </CardContent>
                     </Card>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold text-lg">Añadir Miembros al Grupo "{selectedGroup?.name || '...'}"</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar empleado por nombre, cargo, etc..." className="pl-10" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} disabled={!selectedGroup} />
                </div>
                <Card className="h-96 overflow-y-auto">
                    <CardContent className="p-2">
                        {selectedGroup ? (
                            availableForGroup.length > 0 ? (
                                <Table>
                                    <TableBody>
                                        {availableForGroup.map(user => (
                                            <TableRow key={user.id}>
                                                <TableCell className="w-10">
                                                    <Checkbox onCheckedChange={() => handleToggleMember(user.id)} />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{user.nombres} {user.apellidos}</div>
                                                    <div className="text-xs text-muted-foreground">{user.cargo}</div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground p-4 text-center">No se encontraron empleados para añadir.</p>
                            )
                        ) : (
                           <p className="text-sm text-muted-foreground p-4 text-center">Selecciona o crea un grupo para empezar a añadir miembros.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Resumen de la Importación</DialogTitle>
                    <DialogDescription>
                        Revisa los cambios antes de confirmar. Se crearán {importAnalysis?.filter(i => i.status === 'new').length || 0} usuarios y se actualizarán {importAnalysis?.filter(i => i.status === 'update').length || 0}.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Cédula</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Detalle de Cambios</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {importAnalysis?.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{item.user.nombres} {item.user.apellidos}</TableCell>
                                    <TableCell>{item.user.cedula}</TableCell>
                                    <TableCell>
                                        {item.status === 'new' ? (
                                            <Badge className="bg-green-100 text-green-800">NUEVO</Badge>
                                        ) : (
                                            <Badge className="bg-blue-100 text-blue-800">ACTUALIZACIÓN</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {item.status === 'update' ? (
                                            <ul className="list-disc pl-4 space-y-1">
                                                {item.changes.map(change => (
                                                    <li key={change.field}>
                                                        <span className="font-semibold">{change.field}:</span>{' '}
                                                        <span className="text-red-600 line-through">{String(change.oldValue || 'Vacío')}</span>{' '}
                                                        <ArrowRight className="inline-block h-3 w-3" />{' '}
                                                        <span className="text-green-700">{String(change.newValue || 'Vacío')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : 'Se creará un nuevo registro.'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsImportDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={confirmImport}>Confirmar Importación</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>{editingUser ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}</DialogTitle>
                <DialogDescription>
                    {editingUser ? 'Actualiza la información del usuario.' : 'Completa los campos para añadir un nuevo usuario a la nómina.'}
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-4">
                    <FormField
                        control={form.control}
                        name="photoUrl"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Foto del Usuario (Opcional)</FormLabel>
                                <div className="flex items-center gap-4">
                                    <div className="w-20 text-center">
                                      <Label htmlFor="photo-upload" className="cursor-pointer flex flex-col items-center">
                                        <span className="text-xs text-muted-foreground mb-1">Vista previa</span>
                                        {imagePreview ? (
                                            <Image
                                                src={imagePreview}
                                                alt="Vista previa"
                                                width={80}
                                                height={80}
                                                className="rounded-full aspect-square object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                                                <UserRound className="w-10 h-10 text-muted-foreground" />
                                            </div>
                                        )}
                                      </Label>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <FormControl>
                                            <Input
                                                id="photo-upload"
                                                type="file"
                                                className="hidden"
                                                accept="image/png, image/jpeg"
                                                onChange={handleImageChange}
                                            />
                                        </FormControl>
                                        <Button type="button" variant="outline" onClick={() => document.getElementById('photo-upload')?.click()}>
                                            Seleccionar archivo
                                        </Button>
                                        <FormDescription>
                                            La imagen se redimensionará y comprimirá.
                                        </FormDescription>
                                    </div>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="codigo" render={({ field }) => (
                          <FormItem><FormLabel>Código</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="cedula" render={({ field }) => (
                          <FormItem><FormLabel>Cédula</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="fechaIngreso" render={({ field }) => (
                          <FormItem><FormLabel>Fecha Ingreso</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="apellidos" render={({ field }) => (
                            <FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="nombres" render={({ field }) => (
                            <FormItem><FormLabel>Nombres</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="fechaNacimiento" render={({ field }) => (
                            <FormItem><FormLabel>Fecha Nacimiento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2">
                                    <FormLabel>Email</FormLabel>
                                    {editingUser && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button type="button" tabIndex={-1}><Info className="h-4 w-4 text-muted-foreground cursor-help" /></button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="max-w-xs">Para cambiar el email de acceso, se debe eliminar este perfil y crearlo de nuevo con el correo correcto.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                                <FormControl>
                                    <Input
                                        type="email"
                                        {...field}
                                        disabled={!!editingUser}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField
                            control={form.control}
                            name="rol"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rol</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar rol..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {roles?.map(role => <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <FormField control={form.control} name="empresa" render={({ field }) => (
                            <FormItem><FormLabel>Empresa</FormLabel>
                                <Combobox options={toOptions(empresas)} placeholder="Seleccionar empresa" {...field} allowCreate />
                                <FormMessage />
                            </FormItem>
                         )} />
                          <FormField control={form.control} name="ubicacion" render={({ field }) => (
                            <FormItem><FormLabel>Ubicación</FormLabel>
                                <Combobox options={cascadedUbicacionOptions} placeholder="Seleccionar ubicación" {...field} allowCreate />
                                <FormMessage />
                            </FormItem>
                         )} />
                         <FormField control={form.control} name="cargo" render={({ field }) => (
                            <FormItem><FormLabel>Cargo</FormLabel>
                                <Combobox options={cascadedCargoOptions} placeholder="Seleccionar cargo" {...field} allowCreate />
                                <FormMessage />
                            </FormItem>
                         )} />
                         <FormField control={form.control} name="departamento" render={({ field }) => (
                            <FormItem><FormLabel>Departamento</FormLabel>
                               <Combobox options={toOptions(areas)} placeholder="Seleccionar departamento" {...field} allowCreate />
                                <FormMessage />
                            </FormItem>
                         )} />
                         <FormField control={form.control} name="centroCosto" render={({ field }) => (
                            <FormItem><FormLabel>Centro de Costo</FormLabel>
                                <Combobox options={toOptions(centrosCosto)} placeholder="Seleccionar centro de costo" {...field} allowCreate />
                                <FormMessage />
                            </FormItem>
                         )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="liderArea"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Líder de Área</FormLabel>
                              <Combobox
                                options={leaders.map(l => ({ value: l.email, label: `${l.nombres} ${l.apellidos}`, keywords: l.cargo }))}
                                placeholder="Seleccionar líder..."
                                searchPlaceholder="Buscar líder por nombre o cargo..."
                                notFoundMessage="No se encontraron líderes."
                                {...field}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={form.control}
                          name="consultor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Grupo de Consultoría</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                      <SelectTrigger>
                                          <SelectValue placeholder="Seleccionar grupo..." />
                                      </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      {consultantGroups?.map(group => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField control={form.control} name="tipoContrato" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Contrato</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
                                        <SelectItem value="EMERGENTE">Emergente</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Status" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Estado</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar estado..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="active">Activo</SelectItem>
                                        <SelectItem value="inactive">Inactivo</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="isLeader"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">Es Líder de Área</FormLabel>
                                    <DialogDescription>
                                        Marque esta opción si el usuario tiene un rol de liderazgo.
                                    </DialogDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? (
                                <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
                            ) : (
                                <><Check className="mr-2 h-4 w-4" /> Guardar</>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
       <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Resumen de la Importación</DialogTitle>
                    <DialogDescription>
                        Revisa los cambios antes de confirmar. Se crearán {importAnalysis?.filter(i => i.status === 'new').length || 0} usuarios y se actualizarán {importAnalysis?.filter(i => i.status === 'update').length || 0}.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Cédula</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Detalle de Cambios</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {importAnalysis?.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{item.user.nombres} {item.user.apellidos}</TableCell>
                                    <TableCell>{item.user.cedula}</TableCell>
                                    <TableCell>
                                        {item.status === 'new' ? (
                                            <Badge className="bg-green-100 text-green-800">NUEVO</Badge>
                                        ) : (
                                            <Badge className="bg-blue-100 text-blue-800">ACTUALIZACIÓN</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {item.status === 'update' ? (
                                            <ul className="list-disc pl-4 space-y-1">
                                                {item.changes.map(change => (
                                                    <li key={change.field}>
                                                        <span className="font-semibold">{change.field}:</span>{' '}
                                                        <span className="text-red-600 line-through">{String(change.oldValue || 'Vacío')}</span>{' '}
                                                        <ArrowRight className="inline-block h-3 w-3" />{' '}
                                                        <span className="text-green-700">{String(change.newValue || 'Vacío')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : 'Se creará un nuevo registro.'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsImportDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={confirmImport}>Confirmar Importación</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


      <Card>
        <CardHeader>
            <CardTitle>Lista de Empleados</CardTitle>
            <CardDescription>
                Navega y gestiona la información de todos los empleados.
            </CardDescription>
            <div className="flex items-center pt-4 justify-between">
                <div className='relative w-full max-w-sm'>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, cédula, cargo..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2">
                    {selectedUsers.length > 0 && (
                        <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar ({selectedUsers.length})
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <FileDown className="mr-2 h-4 w-4" />
                                Exportar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleExport('csv')}>Exportar a CSV</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('xlsx')}>Exportar a Excel (XLSX)</DropdownMenuItem>
                        </DropdownMenuContent>
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
                            <Checkbox 
                                checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                                onCheckedChange={(checked) => {
                                    if(checked) {
                                        setSelectedUsers(filteredUsers.map(u => u.id))
                                    } else {
                                        setSelectedUsers([])
                                    }
                                }}
                            />
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
                    {isLoading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={`skel-${i}`}>
                            <TableCell colSpan={8} className="p-4"><div className="h-10 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        </TableRow>
                        ))
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                        <TableRow key={user.id} data-state={selectedUsers.includes(user.id) && "selected"}>
                            <TableCell>
                                <Checkbox
                                    checked={selectedUsers.includes(user.id)}
                                    onCheckedChange={() => {
                                        setSelectedUsers(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id])
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={user.photoUrl || `https://i.pravatar.cc/150?u=${user.email}`} />
                                        <AvatarFallback>{user.nombres?.[0]}{user.apellidos?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">{user.nombres} {user.apellidos}</div>
                                        <div className="text-sm text-muted-foreground">{user.email}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>{user.cargo}</TableCell>
                            <TableCell><Badge variant="outline">{user.rol}</Badge></TableCell>
                             <TableCell>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                    id={`status-switch-${user.id}`}
                                    checked={user.Status === 'active'}
                                    onCheckedChange={(newStatus) => handleStatusChange(user, newStatus)}
                                    aria-label={`Estado de ${user.nombres}`}
                                    />
                                </div>
                            </TableCell>
                            <TableCell>
                                <Switch
                                    id={`leader-switch-${user.id}`}
                                    checked={!!user.isLeader}
                                    onCheckedChange={(newIsLeader) => handleIsLeaderChange(user, newIsLeader)}
                                    aria-label={`Es líder ${user.nombres}`}
                                    />
                            </TableCell>
                            <TableCell>{displayDate(user.fechaIngreso)}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => handleOpenForm(user)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            <span>Editar</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setUserToReset(user)} disabled={currentUser?.email !== 'master@sudinco.com'}>
                                            <KeyRound className="mr-2 h-4 w-4" />
                                            <span>Restablecer Contraseña</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                            No se encontraron usuarios.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".xlsx, .xls, .csv" />
    </>
  );
}
