
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
import type { Collaborator, Vacation } from '@/lib/types';
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

interface VacationManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vacations: Vacation[];
  onVacationsChange: (vacations: Vacation[]) => void;
  collaborators: Collaborator[];
}

export function VacationManager({ open, onOpenChange, vacations, onVacationsChange, collaborators }: VacationManagerProps) {

  const [selectedLocation, setSelectedLocation] = React.useState<string>('todos');
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = React.useState(false);
  const [selectedJobTitle, setSelectedJobTitle] = React.useState<string>('todos');
  const [isJobTitlePopoverOpen, setIsJobTitlePopoverOpen] = React.useState(false);
  
  const [newVacationCollaboratorId, setNewVacationCollaboratorId] = React.useState<string | undefined>();
  const [newVacationDateRange, setNewVacationDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 6),
  });
  const [isCollaboratorPopoverOpen, setIsCollaboratorPopoverOpen] = React.useState(false);

  const { toast } = useToast();

  const allLocations = [...new Set(collaborators.map(c => c.location))];
  const allJobTitles = [...new Set(collaborators.map(c => c.jobTitle))];

  const filteredCollaboratorsForForm = React.useMemo(() => {
    if (!collaborators) {
      return [];
    }
    return collaborators.filter(c => {
      const locationMatch = selectedLocation === 'todos' || c.location === selectedLocation;
      const jobTitleMatch = selectedJobTitle === 'todos' || c.jobTitle === selectedJobTitle;
      return locationMatch && jobTitleMatch;
    });
  }, [selectedLocation, selectedJobTitle, collaborators]);


  const selectedCollaborator = React.useMemo(() => {
    if (!collaborators) return undefined;
    return collaborators.find(c => c.id === newVacationCollaboratorId);
  }, [newVacationCollaboratorId, collaborators]);

  const handleAddVacation = () => {
    if (!newVacationCollaboratorId || !newVacationDateRange?.from || !newVacationDateRange?.to) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, complete todos los campos para agregar las vacaciones.',
      });
      return;
    }

    const newVacation: Vacation = {
      id: Date.now().toString(),
      collaboratorId: newVacationCollaboratorId,
      startDate: startOfDay(newVacationDateRange.from),
      endDate: endOfDay(newVacationDateRange.to),
      status: 'approved',
    };

    onVacationsChange([...vacations, newVacation]);
    
    setNewVacationCollaboratorId(undefined);
    setNewVacationDateRange({ from: new Date(), to: addDays(new Date(), 6) });
    
    setSelectedJobTitle('todos');
    setSelectedLocation('todas');
    

    toast({
        title: 'Vacaciones Agregadas',
        description: 'El período de vacaciones ha sido programado exitosamente.',
    });
  };

  const handleDeleteVacation = (id: string) => {
    onVacationsChange(vacations.filter(t => t.id !== id));
    toast({
        title: 'Vacaciones Eliminadas',
        description: 'El período de vacaciones ha sido cancelado.',
    });
  };
  
  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location);
    setSelectedJobTitle('todos');
    setNewVacationCollaboratorId(undefined);
    setIsLocationPopoverOpen(false);
  };

  const handleJobTitleSelect = (jobTitle: string) => {
    setSelectedJobTitle(jobTitle);
    setNewVacationCollaboratorId(undefined);
    setIsJobTitlePopoverOpen(false);
  };

  const handleShowAll = () => {
    setSelectedLocation('todas');
    setSelectedJobTitle('todos');
  };
  
  const filteredVacations = React.useMemo(() => {
    return vacations.filter(vacation => {
        const collaborator = collaborators.find(c => c.id === vacation.collaboratorId);
        if (!collaborator) return false;
        
        const locationMatch = selectedLocation === 'todos' || collaborator.location === selectedLocation;
        const jobTitleMatch = selectedJobTitle === 'todos' || collaborator.jobTitle === selectedJobTitle;
        return locationMatch && jobTitleMatch;
    }).sort((a,b) => a.startDate.getTime() - b.startDate.getTime());
  }, [vacations, selectedLocation, selectedJobTitle, collaborators]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gestor de Vacaciones</DialogTitle>
          <DialogDescription>
            Programa los períodos de vacaciones de los colaboradores.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 py-4 flex-grow min-h-0">
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <h3 className="font-semibold mb-4 text-lg">Añadir Vacaciones</h3>
                <div className="grid gap-4">
                    <div>
                        <Label>Ubicación</Label>
                        <Popover open={isLocationPopoverOpen} onOpenChange={setIsLocationPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isLocationPopoverOpen}
                              className="w-full justify-between"
                            >
                              {selectedLocation === 'todos'
                                ? "Todas las ubicaciones"
                                : selectedLocation}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar ubicación..." />
                              <CommandList>
                                <CommandEmpty>No se encontró la ubicación.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="todos"
                                    onSelect={() => handleLocationSelect('todos')}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedLocation === 'todos' ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    Todas las ubicaciones
                                  </CommandItem>
                                  {allLocations.map((location) => (
                                    <CommandItem
                                      key={location}
                                      value={location}
                                      onSelect={() => handleLocationSelect(location)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedLocation === location ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {location}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                    </div>

                    <div>
                        <Label>Cargo</Label>
                        <Popover open={isJobTitlePopoverOpen} onOpenChange={setIsJobTitlePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isJobTitlePopoverOpen}
                              className="w-full justify-between"
                            >
                              {selectedJobTitle === 'todos'
                                ? "Todos los cargos"
                                : selectedJobTitle}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar cargo..." />
                              <CommandList>
                                <CommandEmpty>No se encontró el cargo.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="todos"
                                    onSelect={() => handleJobTitleSelect('todos')}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedJobTitle === 'todos' ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    Todos los cargos
                                  </CommandItem>
                                  {allJobTitles.map((title) => (
                                    <CommandItem
                                      key={title}
                                      value={title}
                                      onSelect={() => handleJobTitleSelect(title)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedJobTitle === title ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {title}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                    </div>

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
                                  {filteredCollaboratorsForForm.sort((a,b) => a.name.localeCompare(b.name)).map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.name}
                                      onSelect={() => {
                                        setNewVacationCollaboratorId(c.id);
                                        setIsCollaboratorPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          newVacationCollaboratorId === c.id ? "opacity-100" : "opacity-0"
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

                    <div>
                        <Label>Rango de Fechas</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !newVacationDateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newVacationDateRange?.from ? (
                                    newVacationDateRange.to ? (
                                        <>
                                        {format(newVacationDateRange.from, "d MMM, y", {locale: es})} -{" "}
                                        {format(newVacationDateRange.to, "d MMM, y", {locale: es})}
                                        </>
                                    ) : (
                                        format(newVacationDateRange.from, "d MMM, y", {locale: es})
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
                                    defaultMonth={newVacationDateRange?.from}
                                    selected={newVacationDateRange}
                                    onSelect={setNewVacationDateRange}
                                    numberOfMonths={2}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter className="pt-4 mt-auto border-t">
                    <Button onClick={handleAddVacation} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Programar Vacaciones
                    </Button>
                </DialogFooter>
            </div>
            
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Vacaciones Programadas</h3>
                  <Button variant="link" size="sm" onClick={handleShowAll} className="text-xs">Ver todos los registros</Button>
                </div>
                <div className="flex-grow min-h-0">
                    <ScrollArea className="h-full">
                        <Table className="text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Ubicación</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead className="text-center">Total Días</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVacations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No hay vacaciones programadas para los filtros seleccionados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredVacations.map(v => {
                                      const collaborator = collaborators.find(c => c.id === v.collaboratorId);
                                      const totalDays = differenceInDays(v.endDate, v.startDate) + 1;
                                      
                                      return (
                                        <TableRow key={v.id}>
                                            <TableCell className="font-medium">{collaborator?.name || 'Desconocido'}</TableCell>
                                            <TableCell>{collaborator?.jobTitle || 'N/A'}</TableCell>
                                            <TableCell>{collaborator?.location || 'N/A'}</TableCell>
                                            <TableCell>{format(v.startDate, 'dd/MM/yy')} - {format(v.endDate, 'dd/MM/yy')}</TableCell>
                                            <TableCell className="text-center">{totalDays}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteVacation(v.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                    <span className="sr-only">Eliminar vacaciones</span>
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
