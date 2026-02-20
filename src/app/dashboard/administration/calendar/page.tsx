
"use client";

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { addMonths, subMonths, format, getYear, getMonth, setYear, setMonth, startOfMonth, endOfMonth, isWithinInterval, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { useCollection, useFirestore } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

interface Holiday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>();
  const [holidayName, setHolidayName] = React.useState('');
  
  const firestore = useFirestore();
  const holidaysCollectionRef = React.useMemo(() => firestore ? collection(firestore, 'holidays') : null, [firestore]);
  const { data: holidays, isLoading: holidaysLoading } = useCollection<Holiday>(holidaysCollectionRef);

  const years = React.useMemo(() => {
    const currentYear = getYear(new Date());
    return Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
  }, []);

  const months = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: format(new Date(2000, i), 'MMMM', { locale: es }),
    }));
  }, []);
  
  const handleYearChange = (year: string) => {
    setCurrentDate(prev => setYear(prev, parseInt(year, 10)));
  };

  const handleMonthChange = (month: string) => {
    setCurrentDate(prev => setMonth(prev, parseInt(month, 10)));
  };

  const handleAddHoliday = async () => {
    if (!selectedRange?.from || !holidayName.trim() || !holidaysCollectionRef) {
      toast({
        variant: "destructive",
        title: "Datos incompletos",
        description: "Por favor, selecciona un rango de fechas y asigna un nombre al feriado.",
      });
      return;
    }
    const newHoliday = {
      name: holidayName,
      startDate: format(selectedRange.from, 'yyyy-MM-dd'),
      endDate: format(selectedRange.to || selectedRange.from, 'yyyy-MM-dd'),
    };
    try {
      await addDoc(holidaysCollectionRef, newHoliday);
      toast({ title: "Feriado añadido", description: "El nuevo feriado ha sido registrado." });
      setSelectedRange(undefined);
      setHolidayName('');
    } catch (error) {
      console.error("Error adding holiday: ", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el feriado." });
    }
  };
  
  const handleDeleteHoliday = async (id: string) => {
    if (!holidaysCollectionRef) return;
    try {
      await deleteDoc(doc(holidaysCollectionRef, id));
      toast({ title: "Feriado eliminado" });
    } catch (error) {
      console.error("Error deleting holiday: ", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el feriado." });
    }
  };

  const holidaysForMonth = React.useMemo(() => {
    if (!holidays) return [];
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return holidays.filter(h => 
      isWithinInterval(new Date(h.startDate + 'T00:00:00'), { start, end }) ||
      isWithinInterval(new Date(h.endDate + 'T00:00:00'), { start, end })
    ).sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [holidays, currentDate]);

  const holidayDates = React.useMemo(() => {
    if (!holidays) return [];
    const dates: Date[] = [];
    holidays.forEach(h => {
        let current = parseISO(h.startDate);
        const end = parseISO(h.endDate);
        while(current <= end) {
            dates.push(current);
            current = addDays(current, 1);
        }
    });
    return dates;
  }, [holidays]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-muted-foreground">
          Seleccione un día o un rango de días en el calendario para marcarlos como feriados.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Gestor de Feriados</CardTitle>
            <CardDescription>
              Haga clic en una fecha de inicio y una de fin para registrar un nuevo feriado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
                <div>
                    <Label>Año</Label>
                    <Select value={String(getYear(currentDate))} onValueChange={handleYearChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Mes</Label>
                     <Select value={String(getMonth(currentDate))} onValueChange={handleMonthChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {months.map(month => <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="border rounded-md p-2 flex justify-center">
                 <Calendar
                    mode="range"
                    selected={selectedRange}
                    onSelect={setSelectedRange}
                    month={currentDate}
                    onMonthChange={setCurrentDate}
                    locale={es}
                    modifiers={{ holiday: holidayDates }}
                    modifiersClassNames={{ holiday: 'bg-destructive/20 text-destructive-foreground' }}
                />
            </div>
             {selectedRange && (
                <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="holiday-name">Nombre del Feriado</Label>
                    <div className="flex gap-2">
                        <Input
                            id="holiday-name"
                            placeholder="Ej: Carnaval, Batalla de Pichincha"
                            value={holidayName}
                            onChange={(e) => setHolidayName(e.target.value)}
                        />
                        <Button onClick={handleAddHoliday} disabled={!holidayName.trim()}>Guardar</Button>
                    </div>
                </div>
             )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Feriados Registrados en <span className="text-primary capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</span></CardTitle>
            <CardDescription>
              Esta es la lista de los feriados para el período seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {holidaysLoading ? (
                <p>Cargando feriados...</p>
             ) : holidaysForMonth.length > 0 ? (
                <ul className="space-y-2">
                    {holidaysForMonth.map(holiday => (
                        <li key={holiday.id} className="flex justify-between items-center p-3 rounded-md bg-muted/50">
                            <div>
                                <p className="font-semibold">{holiday.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {format(parseISO(holiday.startDate), 'd MMM', { locale: es })} - {format(parseISO(holiday.endDate), 'd MMM yyyy', { locale: es })}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(holiday.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </li>
                    ))}
                </ul>
             ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No hay feriados registrados para este mes.</p>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
