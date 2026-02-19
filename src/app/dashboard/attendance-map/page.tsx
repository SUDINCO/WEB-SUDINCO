
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
import { Calendar as CalendarIcon, LoaderCircle } from 'lucide-react';
import type { WorkLocation, AttendanceRecord, LocationReport, UserProfile } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const AttendanceMap = dynamic(() => import('../../../components/map/attendance-map'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin" /> <p className="ml-2">Cargando mapa...</p></div>
});

export default function AttendanceMapPage() {
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [viewType, setViewType] = useState<'attendance' | 'reports'>('attendance');
  const [sheetData, setSheetData] = useState<{ title: string; description: string; records: any[] } | null>(null);
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

  const filteredData = useMemo(() => {
    const selectedDateStr = format(date, 'yyyy-MM-dd');
    
    if (viewType === 'attendance') {
      return allAttendance?.filter(record => {
        const recordDate = (record.date as any)?.toDate ? (record.date as any).toDate() : new Date(record.date);
        return format(recordDate, 'yyyy-MM-dd') === selectedDateStr;
      }) || [];
    } else {
      return allReports?.filter(report => {
        const reportDate = new Date(report.timestamp);
        return format(reportDate, 'yyyy-MM-dd') === selectedDateStr;
      }) || [];
    }
  }, [date, viewType, allAttendance, allReports]);

  const handleLocationClick = (locationId: string) => {
    if (!allAttendance || !allUsers) return;

    const location = workLocations?.find(l => l.id === locationId);
    if (location) {
        const recordsForLocation = allAttendance
            .filter(record => {
                const recordDate = (record.date as any)?.toDate ? (record.date as any).toDate() : new Date(record.date);
                return format(recordDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && record.entryWorkLocationName === location.name;
            })
            .map(record => {
                const user = allUsers.find(u => u.id === record.collaboratorId);
                const userName = user ? `${user.nombres} ${user.apellidos}` : record.userName || 'Desconocido';
                return {
                    ...record,
                    userName,
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
        userName: user ? `${user.nombres} ${user.apellidos}` : record.userName || 'Desconocido',
        entryTime: record.entryTime && (record.entryTime as any)?.toDate ? (record.entryTime as any).toDate() : null,
        exitTime: record.exitTime && (record.exitTime as any)?.toDate ? (record.exitTime as any).toDate() : null,
    };
    
    setSheetData({
        title: `Detalle de Timbre Fuera de Zona`,
        description: `Registro de ${enrichedRecord.userName} el día ${format(date, 'dd MMMM, yyyy', { locale: es })}.`,
        records: [enrichedRecord]
    });
  };

  const isLoading = locationsLoading || attendanceLoading || reportsLoading || usersLoading;

  return (
    <div className="space-y-6">
      <Sheet open={!!sheetData} onOpenChange={(isOpen) => !isOpen && setSheetData(null)}>
        <SheetContent className="sm:max-w-lg">
            <SheetHeader>
                <SheetTitle>{sheetData?.title}</SheetTitle>
                <SheetDescription>{sheetData?.description}</SheetDescription>
            </SheetHeader>
            <div className="py-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Persona</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>Salida</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sheetData?.records && sheetData.records.length > 0 ? (
                            sheetData.records.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell>{record.userName}</TableCell>
                                    <TableCell>{record.entryTime ? format(record.entryTime, 'HH:mm:ss') : '-'}</TableCell>
                                    <TableCell>{record.exitTime ? format(record.exitTime, 'HH:mm:ss') : '-'}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24">
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
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
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
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
