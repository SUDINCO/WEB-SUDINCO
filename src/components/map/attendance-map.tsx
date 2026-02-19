'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { WorkLocation, AttendanceRecord, LocationReport } from '@/lib/types';
import { format } from 'date-fns';

// Fix for default icon not showing in Next.js
const defaultIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const outOfBoundsIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const locationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Utility function to calculate distance between two lat-lon points in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// This component will adjust the map's view to fit the provided bounds.
function BoundsFitter({ bounds }: { bounds: L.LatLngBounds | null }) {
    const map = useMap();
    React.useEffect(() => {
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
}

interface AttendanceMapProps {
  workLocations: WorkLocation[];
  records: (AttendanceRecord | LocationReport)[];
  viewType: 'attendance' | 'reports';
  onLocationClick?: (locationId: string) => void;
  onOutOfBoundsRecordClick?: (record: AttendanceRecord) => void;
}

export default function AttendanceMap({ workLocations, records, viewType, onLocationClick, onOutOfBoundsRecordClick }: AttendanceMapProps) {
    const defaultCenter: [number, number] = [-2.14, -79.9]; // Guayaquil
    
    // Process records for attendance view
    const { locationCounts, outOfBoundsRecords } = React.useMemo(() => {
        if (viewType !== 'attendance') return { locationCounts: new Map(), outOfBoundsRecords: [] };

        const counts = new Map<string, number>();
        const outOfBounds: AttendanceRecord[] = [];
        const attendanceRecords = records as AttendanceRecord[];

        attendanceRecords.forEach(record => {
            if (!record.entryLatitude || !record.entryLongitude) return;

            let isInside = false;
            for (const location of workLocations) {
                const distance = getDistance(record.entryLatitude, record.entryLongitude, location.latitude, location.longitude);
                if (distance <= location.radius) {
                    counts.set(location.id, (counts.get(location.id) || 0) + 1);
                    isInside = true;
                    break;
                }
            }

            if (!isInside) {
                outOfBounds.push(record);
            }
        });

        return { locationCounts: counts, outOfBoundsRecords: outOfBounds };
    }, [records, workLocations, viewType]);

    const bounds = React.useMemo(() => {
        const points: L.LatLngTuple[] = [];

        if (viewType === 'attendance') {
            const attendanceRecords = records as AttendanceRecord[];
            workLocations.forEach(loc => {
                if (loc.latitude && loc.longitude) {
                    points.push([loc.latitude, loc.longitude]);
                }
            });
            attendanceRecords.forEach(rec => {
                if (rec.entryLatitude && rec.entryLongitude) {
                    points.push([rec.entryLatitude, rec.entryLongitude]);
                }
            });
        } else { // 'reports'
            const locationReports = records as LocationReport[];
            locationReports.forEach(rep => {
                if (rep.latitude && rep.longitude) {
                    points.push([rep.latitude, rep.longitude]);
                }
            });
        }

        if (points.length === 0) {
            return null;
        }

        return L.latLngBounds(points);
    }, [records, workLocations, viewType]);
    
    const safelyFormatDate = (date: any) => {
        try {
            const dateObj = date?.toDate ? date.toDate() : new Date(date);
            if (isNaN(dateObj.getTime())) {
                return 'Hora inválida';
            }
            return format(dateObj, 'HH:mm:ss');
        } catch {
            return 'Hora inválida';
        }
    };
    
    return (
        <MapContainer center={defaultCenter} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {bounds && <BoundsFitter bounds={bounds} />}
            
            {/* Render geofences and markers for attendance view */}
            {viewType === 'attendance' && workLocations.map(location => {
                const count = locationCounts.get(location.id) || 0;
                
                return (
                    <React.Fragment key={location.id}>
                         <Marker
                            position={[location.latitude, location.longitude]}
                            icon={locationIcon}
                            eventHandlers={{
                                click: () => {
                                    if (onLocationClick) onLocationClick(location.id);
                                },
                            }}
                        >
                            <Tooltip
                                permanent
                                direction="bottom"
                                offset={[0, 10]}
                                className="leaflet-tooltip-label"
                            >
                                {location.name} ({count})
                            </Tooltip>
                        </Marker>
                        {/* Geofence Circle */}
                        <Circle
                            center={[location.latitude, location.longitude]}
                            radius={location.radius}
                            pathOptions={{ color: 'hsl(var(--primary))', fillColor: 'hsl(var(--primary))', fillOpacity: 0.2, weight: 2 }}
                        />
                    </React.Fragment>
                );
            })}

            {/* Render out-of-bounds records for attendance view */}
            {viewType === 'attendance' && outOfBoundsRecords.map(record => (
                <Marker 
                    key={record.id} 
                    position={[record.entryLatitude!, record.entryLongitude!]} 
                    icon={outOfBoundsIcon}
                    eventHandlers={{
                        click: () => {
                            if (onOutOfBoundsRecordClick) onOutOfBoundsRecordClick(record as AttendanceRecord);
                        },
                    }}
                >
                    <Popup>
                        <strong>Fuera de Zona</strong><br />
                        <strong>Empleado:</strong> {record.userName}<br />
                        <strong>Hora:</strong> {safelyFormatDate(record.entryTime)}<br/>
                        <strong>Ubicación Registrada:</strong> {record.entryWorkLocationName}
                    </Popup>
                </Marker>
            ))}

            {/* Render location reports */}
            {viewType === 'reports' && (records as LocationReport[]).map(report => (
                 <Marker 
                    key={report.id} 
                    position={[report.latitude, report.longitude]} 
                    icon={defaultIcon}
                >
                    <Popup>
                        <strong>Reporte de Ubicación</strong><br />
                        <strong>Empleado:</strong> {report.userName}<br />
                        <strong>Hora:</strong> {format(new Date(report.timestamp), 'HH:mm:ss')}<br/>
                        {report.notes && `<strong>Notas:</strong> ${report.notes}`}<br/>
                        {report.photoUrl && <img src={report.photoUrl} alt="Evidencia" style={{ width: '150px', marginTop: '5px' }} />}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
