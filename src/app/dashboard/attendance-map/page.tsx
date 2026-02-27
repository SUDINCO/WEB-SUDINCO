
"use client";
import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, LoaderCircle, Search, MapPin } from 'lucide-react';
import type { WorkLocation, AttendanceRecord, LocationReport, UserProfile } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';

const AttendanceMap = dynamic(() => import('../../../components/map/attendance-map'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin" /> <p className="ml-2">Cargando mapa...</p></div>
});

export default function AttendanceMapPage() {
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [viewType, setViewType] = useState<'attendance' | 'reports'>('attendance');
  const [sheetData, setSheetData] = useState<{ title: string; description: string; records: any[] } | null>(null);
  const [sheetFilter, setSheetFilter] = useState('');
  const [cargoFilter, setCargoFilter] = useState('todos');
  const [colaboradorFilter, setColaboradorFilter] = useState('todos');
  
  // Estado para centrar el mapa en un punto específico seleccionado desde la tabla
  const [highlightedPoint, setHighlightedPoint] = useState<{ lat: number; lng: number; label: string } | null>(null);

  const firestore = useFirestore();

  const { data: workLocations, isLoading: locationsLoading } = useCollection<WorkLocation>(
    useMemo(() => firestore ? collection(firestore, 'workLocations') : null, [firestore])
  );

  const { data: allAttendance, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(
    useMemo(() => firestore ? collection(firestore, 'attendance') : null, [firestore])
  );

  const { data: allReports, isLoading: reportsLoading } = useCollection<LocationReport>(
    useMemo(() => firestore ? collection(firestore, 'locationReports') : null, [firestore])
  );

  const { data: allUsers, isLoading: usersLoading } = useCollection<UserProfile>(
    useMemo(() => (firestore ? collection(firestore, 'users') : null), [firestore])
  );
  
  const { cargoOptions, colaboradorOptions } = useMemo(() => {
    if (!allUsers) return { cargoOptions: [], colaboradorOptions: [] };

    const uniqueCargos = [...new Set(allUsers.map(u => u.cargo).filter(Boolean))].sort();
    const cargos = [{ label: 'Todos los Cargos', value: 'todos' }, ...uniqueCargos.map(c => ({ label: c, value: c }))];

    let filteredUsers = allUsers;
    if (cargoFilter !== 'todos') {
        filteredUsers = filteredUsers.filter(u => u.cargo === cargoFilter);
    }
    const colaboradores = [{ label: 'Todos los Colaboradores', value: 'todos' }, ...filteredUsers.map(u => ({ label: `${u.nombres} ${u.apellidos}`, value: u.id }))];
    
    return { cargoOptions: cargos, colaboradorOptions: colaboradores };
  }, [allUsers, cargoFilter]);

  const filteredData = useMemo(() => {
    const selectedDateStr = format(date, 'yyyy-MM-dd');
    if (!allUsers) return [];

    if (viewType === 'attendance') {
        const attendanceForDay = allAttendance?.filter(record => {
            const recordDate = (record.date as any)?.toDate ? (record.date as any).toDate() : new Date(record.date);
            return format(recordDate, 'yyyy-MM-dd') === selectedDateStr;
        }) || [];

        return attendanceForDay.map(rec => {
            const user = allUsers.find(u => u.id === rec.collaboratorId);
            return {
                ...rec,
                userCargo: user?.cargo || 'N/A',
                userName: user ? `${user.nombres} ${user.apellidos}` : ('userName' in rec ? rec.userName : 'Desconocido'),
                userPhotoUrl: user?.photoUrl,
                initials: user ? `${user.nombres?.[0] || ''}${user.apellidos?.[0] || ''}` : 'U'
            };
        }).filter(rec => {
            const cargoMatch = cargoFilter === 'todos' || rec.userCargo === cargoFilter;
            const colaboradorMatch = colaboradorFilter === 'todos' || rec.collaboratorId === colaboradorFilter;
            return cargoMatch && colaboradorMatch;
        });

    } else { // 'reports'
        const reportsForDay = allReports?.filter(report => {
            const reportDate = new Date(report.timestamp);
            return format(reportDate, 'yyyy-MM-dd') === selectedDateStr;
        }) || [];

        return reportsForDay.map(rec => {
            const user = allUsers.find(u => u.id === rec.userId);
            return {
                ...rec,
                userCargo: user?.cargo || 'N/A',
                userName: user ? `${user.nombres} ${user.apellidos}` : rec.userName,
                userPhotoUrl: user?.photoUrl,
                initials: user ? `${user.nombres?.[0] || ''}${user.apellidos?.[0] || ''}` : 'U'
            };
        }).filter(rec => {
            const cargoMatch = cargoFilter === 'todos' || rec.userCargo === cargoFilter;
            const colaboradorMatch = colaboradorFilter === 'todos' || rec.userId === colaboradorFilter;
            return cargoMatch && colaboradorMatch;
        });
    }
}, [date, viewType, allAttendance, allReports, allUsers, cargoFilter, colaboradorFilter]);

  const handleLocationClick = (locationId: string) => {
    if (!allAttendance || !allUsers) return;

    const location = workLocations?.find(l => l.id === locationId);
    if (location) {
        setSheetFilter(''); // Reset filter on new sheet open
        const recordsForLocation = allAttendance
            .filter(record => {
                const recordDate = (record.date as any)?.toDate ? (record.date as any).toDate() : new Date(record.date);
                return format(recordDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && record.entryWorkLocationName === location.name;
            })
            .map(record => {
                const user = allUsers.find(u => u.id === record.collaboratorId);
                const userName = user ? `${user.nombres} ${user.apellidos}` : (record as any).userName || 'Desconocido';
                const userCargo = user ? user.cargo : 'N/A';
                return {
                    ...record,
                    userName,
                    userCargo,
                    entryTime: record.entryTime && (record.entryTime as any)?.toDate ? (record.entryTime as any).toDate() : null,
                    exitTime: record.exitTime && (record.exitTime as any)?.toDate ? (record.exitTime as any).toDate() : null,
                };
            })
            .sort((a,b) => (a.entryTime?.getTime() || 0) - (b.entryTime?.getTime() || 0));

        setSheetData({
            title: `Historial de Timbres: ${location.name}`,
            description: `Registros del día ${format(date, 'dd MMMM, yyyy', { locale: es })}.`,
            records: recordsForLocation || []
        });
    }
  };

  const handleOutOfBoundsRecordClick = (record: AttendanceRecord) => {
    if (!allUsers) return;
    const user = allUsers.find(u => u.id === record.collaboratorId);
    const enrichedRecord = {
        ...record,
        userName: user ? `${user.nombres} ${user.apellidos}` : (record as any).userName || 'Desconocido',
        userCargo: user ? user.cargo : 'N/A',
        entryTime: record.entryTime && (record.entryTime as any)?.toDate ? (record.entryTime as any).toDate() : null,
        exitTime: record.exitTime && (record.exitTime as any)?.toDate ? (record.exitTime as any).toDate() : null,
    };
    
    setSheetFilter(''); // Reset filter
    setSheetData({
        title: `Detalle de Timbre Fuera de Zona`,
        description: `Registro de ${enrichedRecord.userName} el día ${format(date, 'dd MMMM, yyyy', { locale: es })}.`,
        records: [enrichedRecord]
    });
  };
  
  const handleShowOnMap = (lat: number | undefined, lng: number | undefined, label: string) => {
    if (lat && lng) {
        setHighlightedPoint({ lat, lng, label });
        setSheetData(null); // Cerrar el panel para mostrar el mapa
    }
  };

  const filteredSheetRecords = useMemo(() => {
    if (!sheetData?.records) return [];
    if (!sheetFilter) return sheetData.records;

    const lowercasedFilter = sheetFilter.toLowerCase();
    return sheetData.records.filter(record =>
        record.userName?.toLowerCase().includes(lowercasedFilter) ||
        record.userCargo?.toLowerCase().includes(lowercasedFilter)
    );
  }, [sheetData, sheetFilter]);

  const isLoading = locationsLoading || attendanceLoading || reportsLoading || usersLoading;

  return (
    <div className="space-y-6">
      <Sheet open={!!sheetData} onOpenChange={(isOpen) => !isOpen && setSheetData(null)}>
        <SheetContent className="sm:max-w-3xl">
            <SheetHeader>
                <SheetTitle>{sheetData?.title}</SheetTitle>
                <SheetDescription>{sheetData?.description}</SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o cargo..."
                        value={sheetFilter}
                        onChange={(e) => setSheetFilter(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Persona</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>Ubicación Entrada</TableHead>
                            <TableHead>Salida</TableHead>
                            <TableHead>Ubicación Salida</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSheetRecords && filteredSheetRecords.length > 0 ? (
                            filteredSheetRecords.map(record => {
                                const isEntryOff = record.entryWorkLocationName === "Fuera de Zona";
                                const isExitOff = record.exitWorkLocationName === "Fuera de Zona";

                                return (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">{record.userName}</TableCell>
                                        <TableCell className="text-xs">{record.userCargo}</TableCell>
                                        <TableCell className="text-xs">{record.entryTime ? format(record.entryTime, 'HH:mm:ss') : '-'}</TableCell>
                                        <TableCell className="text-xs">
                                            {isEntryOff ? (
                                                <button 
                                                    onClick={() => handleShowOnMap(record.entryLatitude, record.entryLongitude, `Entrada: ${record.userName}`)}
                                                    className="text-blue-600 hover:underline flex items-center gap-1 text-left"
                                                >
                                                    <MapPin className="h-3 w-3" />
                                                    Ubicación no registrada
                                                </button>
                                            ) : (
                                                <span className="text-muted-foreground">{record.entryWorkLocationName || '-'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">{record.exitTime ? format(record.exitTime, 'HH:mm:ss') : '-'}</TableCell>
                                        <TableCell className="text-xs">
                                            {isExitOff && record.exitTime ? (
                                                <button 
                                                    onClick={() => handleShowOnMap(record.exitLatitude, record.exitLongitude, `Salida: ${record.userName}`)}
                                                    className="text-blue-600 hover:underline flex items-center gap-1 text-left"
                                                >
                                                    <MapPin className="h-3 w-3" />
                                                    Ubicación no registrada
                                                </button>
                                            ) : (
                                                <span className="text-muted-foreground">{record.exitWorkLocationName || '-'}</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    No hay registros para esta selección.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <CardTitle>Mapa de Asistencia</CardTitle>
          <CardDescription>Visualiza los registros de asistencia y reportes de ubicación en el mapa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={(d) => setDate(d || new Date())} initialFocus />
                    </PopoverContent>
                </Popover>
                <Tabs value={viewType} onValueChange={(value) => setViewType(value as 'attendance' | 'reports')} className="w-full sm:w-auto">
                    <TabsList>
                    <TabsTrigger value="attendance">Registros de Asistencia</TabsTrigger>
                    <TabsTrigger value="reports">Reportes de Ubicación</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Combobox options={cargoOptions} value={cargoFilter} onChange={setCargoFilter} placeholder="Filtrar por cargo..." />
                <Combobox options={colaboradorOptions} value={colaboradorFilter} onChange={setColaboradorFilter} placeholder="Filtrar por colaborador..." />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="h-[600px] w-full p-0">
          {isLoading ? (
            <div className="h-full w-full bg-muted flex items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin" /> <p className="ml-2">Cargando datos...</p></div>
          ) : (
            <AttendanceMap
              workLocations={workLocations || []}
              records={filteredData}
              viewType={viewType}
              onLocationClick={handleLocationClick}
              onOutOfBoundsRecordClick={handleOutOfBoundsRecordClick}
              highlightedPoint={highlightedPoint}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
