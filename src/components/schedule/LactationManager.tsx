
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
import type { Collaborator, Lactation } from '@/lib/types';
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

interface LactationManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lactations: Lactation[];
  onLactationsChange: (lactations: Lactation[]) => void;
  collaborators: Collaborator[];
}

export function LactationManager({ open, onOpenChange, lactations, onLactationsChange, collaborators }: LactationManagerProps) {
  const [selectedLocation, setSelectedLocation] = React.useState<string>('todos');
  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = React.useState(false);
  const [selectedJobTitle, setSelectedJobTitle] = React.useState<string>('todos');
  const [isJobTitlePopoverOpen, setIsJobTitlePopoverOpen] = React.useState(false);
  
  const [newPeriodCollaboratorId, setNewPeriodCollaboratorId] = React.useState<string | undefined>();
  const [newPeriodDateRange, setNewPeriodDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 89), // Default to approx 3 months
  });
  const [isCollaboratorPopoverOpen, setIsCollaboratorPopoverOpen] = React.useState(false);

  const { toast } = useToast();

  const allLocations = [...new Set(collaborators.map(c => c.location))];
  const allJobTitles = [...new Set(collaborators.map(c => c.jobTitle))];

  const filteredCollaborators = React.useMemo(() => {
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
    return collaborators.find(c => c.id === newPeriodCollaboratorId);
  }, [newPeriodCollaboratorId, collaborators]);

  const handleAddPeriod = () => {
    if (!newPeriodCollaboratorId || !newPeriodDateRange?.from || !newPeriodDateRange?.to) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, complete todos los campos para agregar el período de lactancia.',
      });
      return;
    }

    const newLactation: Lactation = {
      id: Date.now().toString(),
      collaboratorId: newPeriodCollaboratorId,
      startDate: startOfDay(newPeriodDateRange.from),
      endDate: endOfDay(newPeriodDateRange.to),
    };

    onLactationsChange([...lactations, newLactation]);
    
    setNewPeriodCollaboratorId(undefined);
    setNewPeriodDateRange({ from: new Date(), to: addDays(new Date(), 89) });
    setSelectedJobTitle('todos');
    setSelectedLocation('todas');

    toast({
        title: 'Período de Lactancia Agregado',
        description: 'El período ha sido programado exitosamente.',
    });
  };

  const handleDeletePeriod = (id: string) => {
    onLactationsChange(lactations.filter(t => t.id !== id));
    toast({
        title: 'Período de Lactancia Eliminado',
        description: 'El período ha sido cancelado.',
    });
  };
  
  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location);
    setSelectedJobTitle('todos');
    setNewPeriodCollaboratorId(undefined);
    setIsLocationPopoverOpen(false);
  };

  const handleJobTitleSelect = (jobTitle: string) => {
    setSelectedJobTitle(jobTitle);
    setNewPeriodCollaboratorId(undefined);
    setIsJobTitlePopoverOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gestor de Períodos de Lactancia</DialogTitle>
          <DialogDescription>
            Programa los períodos de lactancia de las colaboradoras.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 py-4 flex-grow min-h-0">
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <h3 className="font-semibold mb-4 text-lg">Añadir Período</h3>
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
                        <Label>Colaboradora</Label>
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
                                : "Seleccionar colaboradora..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Buscar colaboradora..." />
                              <CommandList>
                                <CommandEmpty>No se encontró la colaboradora.</CommandEmpty>
                                <CommandGroup>
                                  {filteredCollaborators.sort((a,b) => a.name.localeCompare(b.name)).map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.name}
                                      onSelect={() => {
                                        setNewPeriodCollaboratorId(c.id);
                                        setIsCollaboratorPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          newPeriodCollaboratorId === c.id ? "opacity-100" : "opacity-0"
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
                                    !newPeriodDateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newPeriodDateRange?.from ? (
                                    newPeriodDateRange.to ? (
                                        <>
                                        {format(newPeriodDateRange.from, "d MMM, y", {locale: es})} -{" "}
                                        {format(newPeriodDateRange.to, "d MMM, y", {locale: es})}
                                        </>
                                    ) : (
                                        format(newPeriodDateRange.from, "d MMM, y", {locale: es})
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
                                    defaultMonth={newPeriodDateRange?.from}
                                    selected={newPeriodDateRange}
                                    onSelect={setNewPeriodDateRange}
                                    numberOfMonths={2}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter className="pt-4 mt-auto border-t">
                    <Button onClick={handleAddPeriod} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Programar Período
                    </Button>
                </DialogFooter>
            </div>
            
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <h3 className="font-semibold mb-4 text-lg">Períodos Activos</h3>
                <div className="flex-grow min-h-0">
                    <ScrollArea className="h-full">
                        <Table className="text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaboradora</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Ubicación</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead className="text-center">Total Días</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lactations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No hay períodos de lactancia programados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    lactations.sort((a,b) => a.startDate.getTime() - b.startDate.getTime()).map(l => {
                                      const collaborator = collaborators.find(c => c.id === l.collaboratorId);
                                      const totalDays = differenceInDays(l.endDate, l.startDate) + 1;
                                      
                                      return (
                                        <TableRow key={l.id}>
                                            <TableCell className="font-medium">{collaborator?.name || 'Desconocido'}</TableCell>
                                            <TableCell>{collaborator?.jobTitle || 'N/A'}</TableCell>
                                            <TableCell>{collaborator?.location || 'N/A'}</TableCell>
                                            <TableCell>{format(l.startDate, 'dd/MM/yy')} - {format(l.endDate, 'dd/MM/yy')}</TableCell>
                                            <TableCell className="text-center">{totalDays}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeletePeriod(l.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                    <span className="sr-only">Eliminar período</span>
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
