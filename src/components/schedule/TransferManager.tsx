
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
import type { Collaborator, TemporaryTransfer } from '@/lib/types';
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

interface TransferManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfers: TemporaryTransfer[];
  onTransfersChange: (transfers: TemporaryTransfer[]) => void;
  collaborators: Collaborator[];
  locations: string[];
}

export function TransferManager({ open, onOpenChange, transfers, onTransfersChange, collaborators, locations }: TransferManagerProps) {
  
  const [selectedJobTitle, setSelectedJobTitle] = React.useState<string>('todos');
  const [isJobTitlePopoverOpen, setIsJobTitlePopoverOpen] = React.useState(false);
  
  const [newTransferCollaboratorId, setNewTransferCollaboratorId] = React.useState<string | undefined>();
  const [newTransferLocation, setNewTransferLocation] = React.useState<string | undefined>();
  const [newTransferDateRange, setNewTransferDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 6),
  });
  const [isCollaboratorPopoverOpen, setIsCollaboratorPopoverOpen] = React.useState(false);

  const { toast } = useToast();

  const allJobTitles = [...new Set(collaborators.map(c => c.jobTitle))];

  const filteredCollaborators = React.useMemo(() => {
    if (selectedJobTitle === 'todos' || !collaborators) {
      return collaborators || [];
    }
    return collaborators.filter(c => c.jobTitle === selectedJobTitle);
  }, [selectedJobTitle, collaborators]);


  const selectedCollaborator = React.useMemo(() => {
    if (!collaborators) return undefined;
    return collaborators.find(c => c.id === newTransferCollaboratorId);
  }, [newTransferCollaboratorId, collaborators]);

  const handleAddTransfer = () => {
    if (!newTransferCollaboratorId || !newTransferLocation || !newTransferDateRange?.from || !newTransferDateRange?.to) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, complete todos los campos para agregar un traslado.',
      });
      return;
    }
    
    if (newTransferLocation === selectedCollaborator?.location) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'La ubicación de destino no puede ser la misma que la de origen.',
        });
        return;
    }

    const newTransfer: TemporaryTransfer = {
      id: Date.now().toString(),
      collaboratorId: newTransferCollaboratorId,
      newLocation: newTransferLocation,
      startDate: startOfDay(newTransferDateRange.from),
      endDate: endOfDay(newTransferDateRange.to),
    };

    onTransfersChange([...transfers, newTransfer]);
    
    setNewTransferCollaboratorId(undefined);
    setNewTransferLocation(undefined);
    setNewTransferDateRange({ from: new Date(), to: addDays(new Date(), 6) });
    setSelectedJobTitle('todos');


    toast({
        title: 'Traslado Agregado',
        description: 'El traslado temporal ha sido programado exitosamente.',
    });
  };

  const handleDeleteTransfer = (id: string) => {
    onTransfersChange(transfers.filter(t => t.id !== id));
    toast({
        title: 'Traslado Eliminado',
        description: 'El traslado ha sido cancelado.',
    });
  };

  const availableLocations = locations.filter(l => l !== selectedCollaborator?.location);
  
  const handleJobTitleSelect = (jobTitle: string) => {
    setSelectedJobTitle(jobTitle);
    setNewTransferCollaboratorId(undefined);
    setIsJobTitlePopoverOpen(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gestor de Traslados Temporales</DialogTitle>
          <DialogDescription>
            Gestiona los traslados de colaboradores a otras ubicaciones por necesidades emergentes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 py-4 flex-grow min-h-0">
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <h3 className="font-semibold mb-4 text-lg">Añadir Nuevo Traslado</h3>
                <div className="grid gap-4">
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
                                  {filteredCollaborators.sort((a,b) => a.name.localeCompare(b.name)).map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.name}
                                      onSelect={() => {
                                        setNewTransferCollaboratorId(c.id);
                                        setIsCollaboratorPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          newTransferCollaboratorId === c.id ? "opacity-100" : "opacity-0"
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
                        <div className="p-2 bg-muted rounded-md text-sm">
                            <span className="font-semibold">Ubicación de Origen:</span> {selectedCollaborator.location}
                        </div>
                    )}

                    <div>
                        <Label>Ubicación de Destino</Label>
                        <Select value={newTransferLocation} onValueChange={setNewTransferLocation} disabled={!selectedCollaborator}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar destino..." />
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
                                    !newTransferDateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newTransferDateRange?.from ? (
                                    newTransferDateRange.to ? (
                                        <>
                                        {format(newTransferDateRange.from, "d MMM, y", {locale: es})} -{" "}
                                        {format(newTransferDateRange.to, "d MMM, y", {locale: es})}
                                        </>
                                    ) : (
                                        format(newTransferDateRange.from, "d MMM, y", {locale: es})
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
                                    defaultMonth={newTransferDateRange?.from}
                                    selected={newTransferDateRange}
                                    onSelect={setNewTransferDateRange}
                                    numberOfMonths={2}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter className="pt-4 mt-auto border-t">
                    <Button onClick={handleAddTransfer} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Traslado
                    </Button>
                </DialogFooter>
            </div>
            
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <h3 className="font-semibold mb-4 text-lg">Traslados Activos</h3>
                <div className="flex-grow min-h-0">
                    <ScrollArea className="h-full">
                        <Table className="text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Origen</TableHead>
                                    <TableHead>Destino</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead className="text-center">Total Días</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transfers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No hay traslados programados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    transfers.map(t => {
                                      const collaborator = collaborators.find(c => c.id === t.collaboratorId);
                                      const totalDays = differenceInDays(t.endDate, t.startDate) + 1;
                                      
                                      return (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium">{collaborator?.name || 'Desconocido'}</TableCell>
                                            <TableCell>{collaborator?.jobTitle || 'N/A'}</TableCell>
                                            <TableCell>{collaborator?.location || 'N/A'}</TableCell>
                                            <TableCell>{t.newLocation}</TableCell>
                                            <TableCell>{format(t.startDate, 'dd/MM/yy')} - {format(t.endDate, 'dd/MM/yy')}</TableCell>
                                            <TableCell className="text-center">{totalDays}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteTransfer(t.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                    <span className="sr-only">Eliminar traslado</span>
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
