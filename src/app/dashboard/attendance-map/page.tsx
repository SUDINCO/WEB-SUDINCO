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
import type { WorkLocation, AttendanceRecord, LocationReport } from '@/lib/types';

const AttendanceMap = dynamic(() => import('@/components/map/attendance-map'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin" /> <p className="ml-2">Cargando mapa...</p></div>
});

export default function AttendanceMapPage() {
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [viewType, setViewType] = useState<'attendance' | 'reports'>('attendance');
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

  const isLoading = locationsLoading || attendanceLoading || reportsLoading;

  return (
    <div className="space-y-6">
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
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
