

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, addDoc, deleteDoc, updateDoc, DocumentData, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface Role extends DocumentData {
  id: string;
  name: string;
  permissions: {
    [key: string]: boolean;
  };
}

const permissionsMap = [
  {
    menu: 'Recursos Humanos',
    groups: [
        {
            title: "Evaluaciones de Desempeño",
            tabs: [
                { id: 'my-evaluations', name: 'Personal a Evaluar' },
                { id: 'observed-evaluations', name: 'Evaluaciones Observadas' },
                { id: 'my-status', name: 'Mi Estado de Evaluación' },
            ]
        },
        {
            title: "Aprobación de Contrataciones",
            tabs: [
                { id: 'profile-evaluation', name: 'Evaluación de Perfil' },
                { id: 'approvals', name: 'Aprobaciones' },
            ]
        },
        {
            title: "Nómina",
            tabs: [
                { id: 'staff', name: 'Nómina' },
                { id: 'attendance-summary', name: 'Resumen de Asistencia' },
            ]
        },
        {
            title: "Solicitudes",
            tabs: [
                { id: 'vacation-requests', name: 'Solicitud de Vacaciones y Permisos' },
            ]
        },
        {
            title: "Asistencia",
            tabs: [
                { id: 'attendance', name: 'Mi Registro' },
                { id: 'schedule', name: 'Cronograma' },
            ]
        },
    ]
  },
  {
    menu: 'Comunicación',
    tabs: [
      { id: 'publications', name: 'Publicaciones' },
    ],
  },
  {
    menu: 'Asignaciones',
    tabs: [
        { id: 'work-schedules', name: 'Horarios de Trabajo' },
        { id: 'work-locations', name: 'Ubicaciones de Trabajo' },
    ]
  },
  {
    menu: 'Administración',
    tabs: [
      { id: 'performance-evaluation', name: 'Evaluación de Desempeño' },
      { id: 'roles', name: 'Roles y Permisos' },
      { id: 'leader-assignment', name: 'Asignación de Líderes' },
      { id: 'schedule-settings', name: 'Configuración de Patrones de Turno' },
    ],
  },
];

const allPermissionIds = permissionsMap.flatMap(p => 
    p.tabs ? p.tabs.map(t => t.id) : (p.groups ? p.groups.flatMap(g => g.tabs.map(t => t.id)) : [])
);

const normalizeText = (text: string | undefined | null): string => {
    if (!text) return '';
    return text
      .normalize('NFD') 
      .replace(/[\u0300-\u036f]/g, '') 
      .toUpperCase() 
      .replace(/\s+/g, ' ') 
      .trim();
};

export default function RolesAndPermissionsPage() {
  const firestore = useFirestore();
  const rolesCollectionRef = useMemo(() => firestore ? collection(firestore, 'roles') : null, [firestore]);
  const { data: rolesData, isLoading: rolesLoading } = useCollection<Role>(rolesCollectionRef);

  const [newRoleName, setNewRoleName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const sortedRoles = useMemo(() => {
    if (!rolesData) return [];
    return [...rolesData].sort((a, b) => {
      const nameA = normalizeText(a.name);
      const nameB = normalizeText(b.name);
      if (nameA === 'MASTER') return -1;
      if (nameB === 'MASTER') return 1;
      return nameA.localeCompare(nameB);
    });
  }, [rolesData]);
  
  useEffect(() => {
    if (!selectedRoleId && sortedRoles.length > 0) {
        setSelectedRoleId(sortedRoles[0].id);
    }
  }, [sortedRoles, selectedRoleId]);

  const selectedRole = useMemo(() => {
    if (!selectedRoleId || !rolesData) return null;
    return rolesData.find(r => r.id === selectedRoleId) || null;
  }, [selectedRoleId, rolesData]);

  const handleAddRole = async () => {
    if (!newRoleName.trim() || !rolesCollectionRef || !firestore) return;
    
    const normalizedName = normalizeText(newRoleName.trim());

    const roleExists = rolesData?.some(role => normalizeText(role.name) === normalizedName);
    if (roleExists) {
        toast({ variant: "destructive", title: "Error", description: `El rol "${normalizedName}" ya existe.`});
        return;
    }

    const newRolePermissions = allPermissionIds.reduce((acc, permissionId) => {
        acc[permissionId] = false;
        return acc;
    }, {} as { [key: string]: boolean });

    const newRole = {
      name: normalizedName,
      permissions: newRolePermissions,
    };
    
    const docRef = doc(firestore, 'roles', normalizedName);

    try {
        await setDoc(docRef, newRole);
        setNewRoleName('');
        setSelectedRoleId(normalizedName);
        toast({ title: "Rol Añadido", description: `El rol "${normalizedName}" ha sido creado.`});
    } catch (error) {
        console.error("Error adding role: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo añadir el rol."});
    }
  };
  
  const handleTogglePermission = useCallback(async (permissionId: string) => {
    if (!firestore || !selectedRole) return;

    const roleDocRef = doc(firestore, 'roles', selectedRole.id);
    const currentPermissionState = selectedRole.permissions?.[permissionId] ?? false;
    const updatedPermissions = {
      ...selectedRole.permissions,
      [permissionId]: !currentPermissionState,
    };
    
    try {
        await updateDoc(roleDocRef, { permissions: updatedPermissions });
        toast({
            title: `Permiso ${!currentPermissionState ? 'otorgado' : 'revocado'}`,
            description: `Se actualizó el permiso para el rol "${selectedRole.name}".`,
        });
    } catch (error) {
        console.error("Error toggling permission: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el permiso."});
    }
  }, [firestore, selectedRole]);

  const handleDeleteRole = async () => {
     if (!firestore || !selectedRole || normalizeText(selectedRole.name) === 'MASTER') {
        toast({ variant: "destructive", title: "Error", description: `El rol "MASTER" no se puede eliminar.`});
        return;
     };
     const roleDocRef = doc(firestore, 'roles', selectedRole.id);
     try {
        await deleteDoc(roleDocRef);
        toast({ title: "Rol Eliminado", description: `El rol "${selectedRole.name}" ha sido eliminado.`});
        setSelectedRoleId(null); // Reset selection
     } catch (error) {
        console.error("Error deleting role: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el rol."});
     }
  }

  const renderCheckbox = (tab: { id: string, name: string }) => {
    if (!selectedRole) return null;
    const isMasterRole = normalizeText(selectedRole.name) === 'MASTER';
    const isChecked = isMasterRole || (selectedRole.permissions?.[tab.id] ?? false);
    const isDisabled = isMasterRole;
    
    return (
        <div key={tab.id} className="flex items-center space-x-3">
            <Checkbox
                id={`${selectedRole.id}-${tab.id}`}
                checked={isChecked}
                onCheckedChange={() => handleTogglePermission(tab.id)}
                disabled={isDisabled}
            />
            <label
                htmlFor={`${selectedRole.id}-${tab.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
                {tab.name}
            </label>
        </div>
    )
  };


  return (
    <>
      <h1 className="text-lg font-semibold md:text-2xl">Roles y Permisos</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Gestionar Roles</CardTitle>
                    <CardDescription>
                        Añade nuevos roles o selecciona uno existente para editar sus permisos.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-md font-semibold mb-3">Añadir Nuevo Rol</h3>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Ej: SUPERVISOR"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value.toUpperCase())}
                            />
                            <Button onClick={handleAddRole} disabled={!newRoleName.trim()}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Añadir
                            </Button>
                        </div>
                    </div>
                    <div>
                         <h3 className="text-md font-semibold mb-3">Editar Rol Existente</h3>
                         {rolesLoading ? (
                             <p>Cargando roles...</p>
                         ) : (
                            <div className="flex gap-2 items-center">
                                <Select onValueChange={setSelectedRoleId} value={selectedRoleId || ''}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un rol..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sortedRoles.map(role => (
                                            <SelectItem key={role.id} value={role.id}>
                                                {normalizeText(role.name)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedRole && normalizeText(selectedRole.name) !== 'MASTER' && (
                                    <Button variant="destructive" size="icon" onClick={handleDeleteRole}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                         )}
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Permisos para el Rol: {selectedRole ? normalizeText(selectedRole.name) : '...'}</CardTitle>
                    <CardDescription>
                        Selecciona las pestañas a las que este rol tendrá acceso en el menú de navegación.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedRole ? (
                        <Accordion type="multiple" className="w-full" defaultValue={permissionsMap.map(p => p.menu)}>
                            {permissionsMap.map((permissionGroup) => (
                                <AccordionItem value={permissionGroup.menu} key={permissionGroup.menu}>
                                    <AccordionTrigger className="text-lg font-medium">{permissionGroup.menu}</AccordionTrigger>
                                    <AccordionContent>
                                        {permissionGroup.groups ? (
                                            permissionGroup.groups.map(group => (
                                                <div key={group.title} className="mb-4 pl-4">
                                                  <h4 className="font-semibold mb-2 text-base">{group.title}</h4>
                                                  <div className="space-y-4 pl-4 pt-2 border-l">
                                                      {group.tabs.map(renderCheckbox)}
                                                  </div>
                                                </div>
                                            ))
                                        ) : permissionGroup.tabs ? (
                                            <div className="space-y-4 pl-4 pt-2">
                                                {permissionGroup.tabs.map(renderCheckbox)}
                                            </div>
                                        ) : null}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">
                            {rolesLoading ? "Cargando permisos..." : "Selecciona un rol para ver sus permisos."}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
    
