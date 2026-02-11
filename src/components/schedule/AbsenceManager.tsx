
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
import { CalendarIcon, Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react';
import type { Collaborator, Absence } from '@/lib/types';
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
import { Textarea } from '../ui/textarea';

const absenceTypes: Absence['type'][] = ['PM', 'LIC', 'SUS', 'RET', 'FI'];
const absenceTypeDescriptions: Record<Absence['type'], string> = {
    PM: 'Permiso Médico',
    LIC: 'Licencia',
    SUS: 'Suspensión',
    RET: 'Retiro',
    FI: 'Falta Injustificada',
};

interface AbsenceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absences: Absence[];
  onAbsencesChange: (absences: Absence[]) => void;
  collaborators: Collaborator[];
}

export function AbsenceManager({ open, onOpenChange, absences, onAbsencesChange, collaborators }: AbsenceManagerProps) {
  const { toast } = useToast();
  
  const [selectedJobTitle, setSelectedJobTitle] = React.useState<string>('todos');
  const [isJobTitlePopoverOpen, setIsJobTitlePopoverOpen] = React.useState(false);
  
  const [collaboratorId, setCollaboratorId] = React.useState<string | undefined>();
  const [absenceType, setAbsenceType] = React.useState<Absence['type'] | undefined>();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: new Date(), to: new Date() });
  const [description, setDescription] = React.useState('');
  const [isCollaboratorPopoverOpen, setIsCollaboratorPopoverOpen] = React.useState(false);

  const filteredCollaboratorsForForm = React.useMemo(() => {
    if (!collaborators) {
      return [];
    }
    return collaborators.filter(c => {
      const jobTitleMatch = selectedJobTitle === 'todos' || c.jobTitle === selectedJobTitle;
      return jobTitleMatch;
    });
  }, [selectedJobTitle, collaborators]);


  const selectedCollaborator = React.useMemo(() => {
    return collaborators.find(c => c.id === collaboratorId);
  }, [collaboratorId, collaborators]);

  const handleAddAbsence = () => {
    if (!collaboratorId || !absenceType || !dateRange?.from) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, complete el colaborador, tipo y fecha de inicio.',
      });
      return;
    }

    const newAbsence: Absence = {
      id: Date.now().toString(),
      collaboratorId,
      type: absenceType,
      startDate: startOfDay(dateRange.from),
      endDate: endOfDay(dateRange.to || dateRange.from),
      description: description || absenceTypeDescriptions[absenceType],
    };

    onAbsencesChange([...absences, newAbsence]);
    
    setCollaboratorId(undefined);
    setAbsenceType(undefined);
    setDateRange({ from: new Date(), to: new Date() });
    setDescription('');
    setSelectedJobTitle('todos');


    toast({
      title: 'Solicitud Registrada',
      description: 'La ausencia ha sido programada y se reflejará en el cronograma.',
    });
  };

  const handleDeleteAbsence = (id: string) => {
    onAbsencesChange(absences.filter(a => a.id !== id));
    toast({
      title: 'Solicitud Eliminada',
      description: 'El registro de ausencia ha sido eliminado.',
    });
  };
  
  const handleJobTitleSelect = (jobTitle: string) => {
    setSelectedJobTitle(jobTitle);
    setCollaboratorId(undefined);
    setIsJobTitlePopoverOpen(false);
  };
  
  const handleShowAll = () => {
    setSelectedJobTitle('todos');
  };

  const filteredAbsences = React.useMemo(() => {
    return absences.filter(absence => {
        const collaborator = collaborators.find(c => c.id === absence.collaboratorId);
        if (!collaborator) return false;
        
        const jobTitleMatch = selectedJobTitle === 'todos' || collaborator.jobTitle === selectedJobTitle;
        return jobTitleMatch;
    }).sort((a,b) => a.startDate.getTime() - b.startDate.getTime());
  }, [absences, selectedJobTitle, collaborators]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gestor de Solicitudes y Ausencias</DialogTitle>
          <DialogDescription>
            Registra permisos médicos, licencias, suspensiones y otras ausencias.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 py-4 flex-grow min-h-0">
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2 overflow-y-auto">
                <div className="flex-grow space-y-4">
                    <h3 className="font-semibold text-lg">Registrar Nueva Solicitud</h3>
                    
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
                                  {collaborators.map(c => c.jobTitle).filter((v, i, a) => a.indexOf(v) === i).sort().map((title) => (
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
                                        setCollaboratorId(c.id);
                                        setIsCollaboratorPopoverOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", collaboratorId === c.id ? "opacity-100" : "opacity-0")} />
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
                        <Label>Tipo de Solicitud</Label>
                        <Select value={absenceType} onValueChange={(v) => setAbsenceType(v as Absence['type'])}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {absenceTypes.map(type => (
                                    <SelectItem key={type} value={type}>{absenceTypeDescriptions[type]} ({type})</SelectItem>
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
                                    className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                        {format(dateRange.from, "d MMM, y", {locale: es})} - {format(dateRange.to, "d MMM, y", {locale: es})}
                                        </>
                                    ) : (
                                        format(dateRange.from, "d MMM, y", {locale: es})
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
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={1}
                                    locale={es}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div>
                        <Label>Descripción (Opcional)</Label>
                        <Textarea 
                            placeholder="Detalles adicionales..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter className="pt-4 mt-auto border-t">
                    <Button onClick={handleAddAbsence} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Solicitud
                    </Button>
                </DialogFooter>
            </div>
            
            <div className="border rounded-lg p-4 flex flex-col md:w-1/2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Solicitudes Registradas</h3>
                  <Button variant="link" size="sm" onClick={handleShowAll} className="text-xs">Ver todos los registros</Button>
                </div>
                <div className="flex-grow min-h-0">
                    <ScrollArea className="h-full">
                        <Table className="text-sm">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Ubicación</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Período</TableHead>
                                    <TableHead>Días</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAbsences.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No hay solicitudes registradas para los filtros seleccionados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAbsences.map(absence => {
                                      const collaborator = collaborators.find(c => c.id === absence.collaboratorId);
                                      const totalDays = differenceInDays(absence.endDate, absence.startDate) + 1;
                                      
                                      return (
                                        <TableRow key={absence.id}>
                                            <TableCell className="font-medium">{collaborator?.name || 'Desconocido'}</TableCell>
                                            <TableCell>{collaborator?.location || 'N/A'}</TableCell>
                                            <TableCell className="font-semibold">{absence.type}</TableCell>
                                            <TableCell>{format(absence.startDate, 'dd/MM/yy')} - {format(absence.endDate, 'dd/MM/yy')}</TableCell>
                                            <TableCell className="text-center">{totalDays}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteAbsence(absence.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                    <span className="sr-only">Eliminar solicitud</span>
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
