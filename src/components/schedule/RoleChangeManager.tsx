
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '../ui/button';
import { CalendarIcon, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import type { Collaborator, RoleChange } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { addDays, format, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import type { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Calendar } from '@/components/ui/calendar';


interface RoleChangeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleChanges: RoleChange[];
  onRoleChangesChange: (roleChanges: RoleChange[]) => void;
  collaborators: Collaborator[];
  jobTitles: string[];
  locations: string[];
}

export function RoleChangeManager({ open, onOpenChange, roleChanges, onRoleChangesChange, collaborators, jobTitles, locations }: RoleChangeManagerProps) {
  
  const [newChangeCollaboratorId, setNewChangeCollaboratorId] = React.useState<string | undefined>();
  const [newJobTitle, setNewJobTitle] = React.useState<string | undefined>();
  const [newLocation, setNewLocation] = React.useState<string | undefined>();
  const [newChangeDateRange, setNewChangeDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 6),
  });
  const [isCollaboratorPopoverOpen, setIsCollaboratorPopoverOpen] = React.useState(false);

  const { toast } = useToast();

  const selectedCollaborator = React.useMemo(() => {
    if (!collaborators) return undefined;
    return collaborators.find(c => c.id === newChangeCollaboratorId);
  }, [newChangeCollaboratorId, collaborators]);

  const handleAddChange = () => {
    if (!newChangeCollaboratorId || !newJobTitle || !newLocation || !newChangeDateRange?.from || !newChangeDateRange?.to) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, complete todos los campos para agregar un apoyo a cargo.',
      });
      return;
    }
    
    if (newJobTitle === selectedCollaborator?.jobTitle && newLocation === selectedCollaborator?.location) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'El cargo y la ubicación de apoyo no pueden ser los mismos que los originales.',
        });
        return;
    }

    const newChange: RoleChange = {
      id: Date.now().toString(),
      collaboratorId: newChangeCollaboratorId,
      newJobTitle: newJobTitle,
      newLocation: newLocation,
      startDate: startOfDay(newChangeDateRange.from),
      endDate: endOfDay(newChangeDateRange.to),
    };

    onRoleChangesChange([...roleChanges, newChange]);
    
    setNewChangeCollaboratorId(undefined);
    setNewJobTitle(undefined);
    setNewLocation(undefined);
    setNewChangeDateRange({ from: new Date(), to: addDays(new Date(), 6) });

    toast({
        title: 'Apoyo a Cargo Agregado',
        description: 'El cambio de rol temporal ha sido programado exitosamente.',
    });
  };

  const handleDeleteChange = (id: string) => {
    onRoleChangesChange(roleChanges.filter(t => t.id !== id));
    toast({
        title: 'Apoyo a Cargo Eliminado',
        description: 'El cambio de rol ha sido cancelado.',
    });
  };

  const availableJobTitles = jobTitles; 
  const availableLocations = locations;

  React.useEffect(() => {
    if(selectedCollaborator) {
        setNewLocation(selectedCollaborator.location);
        setNewJobTitle(selectedCollaborator.jobTitle);
    } else {
        setNewLocation(undefined);
        setNewJobTitle(undefined);
    }
  }, [selectedCollaborator]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gestor de Apoyo a Cargos</DialogTitle>
          <DialogDescription>
            Gestiona los cambios de rol y/o ubicación temporales de colaboradores para cubrir necesidades operativas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 py-4 flex-grow min-h-0">
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <h3 className="font-semibold mb-4 text-lg">Añadir Nuevo Apoyo</h3>
                <div className="grid gap-3">
                    
                    <div>
                        <Label>Colaborador</Label>
                        <Popover open={isCollaboratorPopoverOpen} onOpenChange={setIsCollaboratorPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isCollaboratorPopoverOpen}
                              className="w-full justify-between"
                            >
                              {selectedCollaborator
                                ? selectedCollaborator.name
                                : "Seleccionar colaborador..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar colaborador..." />
                              <CommandList>
                                <CommandEmpty>No se encontró el colaborador.</CommandEmpty>
                                <CommandGroup>
                                  {collaborators.sort((a,b) => a.name.localeCompare(b.name)).map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.name}
                                      onSelect={() => {
                                        setNewChangeCollaboratorId(c.id);
                                        setIsCollaboratorPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          newChangeCollaboratorId === c.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {c.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                    </div>

                    {selectedCollaborator && (
                        <div className="p-2 bg-muted rounded-md text-sm space-y-1">
                            <p><span className="font-semibold">Original:</span> {selectedCollaborator.jobTitle}</p>
                            <p><span className="font-semibold">Ubicación:</span> {selectedCollaborator.location}</p>
                        </div>
                    )}

                    <div>
                        <Label>Cargo de Apoyo</Label>
                        <Select value={newJobTitle} onValueChange={setNewJobTitle} disabled={!selectedCollaborator}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar cargo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableJobTitles.map(l => (
                                    <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label>Ubicación de Apoyo</Label>
                        <Select value={newLocation} onValueChange={setNewLocation} disabled={!selectedCollaborator}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar ubicación..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLocations.map(l => (
                                    <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Rango de Fechas</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !newChangeDateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newChangeDateRange?.from ? (
                                    newChangeDateRange.to ? (
                                        <>
                                        {format(newChangeDateRange.from, "d MMM, y", {locale: es})} -{" "}
                                        {format(newChangeDateRange.to, "d MMM, y", {locale: es})}
                                        </>
                                    ) : (
                                        format(newChangeDateRange.from, "d MMM, y", {locale: es})
                                    )
                                    ) : (
                                    <span>Seleccione un rango</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={newChangeDateRange?.from}
                                    selected={newChangeDateRange}
                                    onSelect={setNewChangeDateRange}
                                    numberOfMonths={2}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter className="pt-4 mt-auto border-t">
                    <Button onClick={handleAddChange} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Apoyo
                    </Button>
                </DialogFooter>
            </div>
            
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <h3 className="font-semibold mb-4 text-lg">Apoyos Activos</h3>
                <div className="flex-grow min-h-0">
                    <ScrollArea className="h-full">
                        <Table className="text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Cargo Original</TableHead>
                                    <TableHead>Ubicación Original</TableHead>
                                    <TableHead>Cargo/Ubicación de Apoyo</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead className="text-center">Días</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roleChanges.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No hay apoyos a cargos programados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    roleChanges.sort((a,b) => a.startDate.getTime() - b.startDate.getTime()).map(t => {
                                      const collaborator = collaborators.find(c => c.id === t.collaboratorId);
                                      const totalDays = differenceInDays(t.endDate, t.startDate) + 1;
                                      
                                      return (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium">{collaborator?.name || 'Desconocido'}</TableCell>
                                            <TableCell>{collaborator?.jobTitle || 'N/A'}</TableCell>
                                            <TableCell>{collaborator?.location || 'N/A'}</TableCell>
                                            <TableCell>
                                                <div>{t.newJobTitle}</div>
                                                <div className="text-muted-foreground text-xs">{t.newLocation}</div>
                                            </TableCell>
                                            <TableCell>{format(t.startDate, 'dd/MM/yy')} - {format(t.endDate, 'dd/MM/yy')}</TableCell>
                                            <TableCell className="text-center">{totalDays}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteChange(t.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                    <span className="sr-only">Eliminar apoyo</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                      );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
