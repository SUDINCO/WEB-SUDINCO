
'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { WorkLocation, AttendanceRecord, LocationReport } from '@/lib/types';
import { format } from 'date-fns';

// This component adjusts the map's view to fit the provided bounds.
function BoundsFitter({ bounds }: { bounds: L.LatLngBounds | null }) {
    const map = useMap();
    React.useEffect(() => {
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
}

// Component to handle flying to a selected coordinate from external action
function SelectionManager({ point }: { point: { lat: number; lng: number; label: string } | null }) {
    const map = useMap();
    React.useEffect(() => {
        if (point) {
            map.flyTo([point.lat, point.lng], 18, {
                duration: 1.5
            });
        }
    }, [point, map]);
    return null;
}

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

export type RecordWithUser = (AttendanceRecord | LocationReport) & {
    userName?: string;
    userCargo?: string;
    userPhotoUrl?: string;
    initials?: string;
};

interface AttendanceMapProps {
  workLocations: WorkLocation[];
  records: RecordWithUser[];
  viewType: 'attendance' | 'reports';
  onLocationClick?: (locationId: string) => void;
  onOutOfBoundsRecordClick?: (record: AttendanceRecord) => void;
  highlightedPoint?: { lat: number; lng: number; label: string } | null;
}

// Type guard to check if a record is an AttendanceRecord
function isAttendanceRecord(record: RecordWithUser): record is AttendanceRecord & { userName?: string; userCargo?: string; userPhotoUrl?: string; initials?: string; } {
    return 'entryLatitude' in record;
}

// Type guard to check if a record is a LocationReport
function isLocationReport(record: RecordWithUser): record is LocationReport & { userName?: string; userCargo?: string; userPhotoUrl?: string; initials?: string; } {
    return 'timestamp' in record && 'photoUrl' in record;
}

export default function AttendanceMap({ workLocations, records, viewType, onLocationClick, onOutOfBoundsRecordClick, highlightedPoint = null }: AttendanceMapProps) {
    const defaultCenter: [number, number] = [-2.14, -79.9]; // Guayaquil

    const locationIcon = React.useMemo(() => new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }), []);
    
    const createAvatarIcon = React.useCallback((photoUrl: string | undefined, initials: string, borderColor: string = 'red') => {
      const avatarHtml = photoUrl
        ? `<img src="${photoUrl}" alt="${initials}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`
        : `<div style="width: 100%; height: 100%; border-radius: 50%; background-color: #cbd5e1; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: #475569;">${initials}</div>`;
    
      return new L.DivIcon({
        html: `<div style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid ${borderColor}; background-color: white; padding: 2px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${avatarHtml}</div>`,
        className: '', 
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
      });
    }, []);
    
    // Process records for attendance view
    const { locationCounts, outOfBoundsRecords } = React.useMemo(() => {
        if (viewType !== 'attendance') return { locationCounts: new Map(), outOfBoundsRecords: [] };

        const counts = new Map<string, number>();
        const outOfBounds: RecordWithUser[] = [];
        
        records.forEach(record => {
            if (isAttendanceRecord(record) && record.entryLatitude && record.entryLongitude) {
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
            }
        });

        return { locationCounts: counts, outOfBoundsRecords: outOfBounds };
    }, [records, workLocations, viewType]);

    const bounds = React.useMemo(() => {
        if (highlightedPoint) return null;

        const points: L.LatLngTuple[] = [];

        records.forEach(rec => {
            if (isAttendanceRecord(rec) && rec.entryLatitude && rec.entryLongitude) {
                points.push([rec.entryLatitude, rec.entryLongitude]);
            } else if (isLocationReport(rec) && rec.latitude && rec.longitude) {
                points.push([rec.latitude, rec.longitude]);
            }
        });

        if (viewType === 'attendance') {
            workLocations.forEach(loc => {
                if (loc.latitude && loc.longitude) {
                    points.push([loc.latitude, loc.longitude]);
                }
            });
        }
        
        if (points.length === 0) {
            return null;
        }

        return L.latLngBounds(points);
    }, [records, workLocations, viewType, highlightedPoint]);
    
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
            
            <SelectionManager point={highlightedPoint} />
            {bounds && <BoundsFitter bounds={bounds} />}
            
            {highlightedPoint && (
                <Marker position={[highlightedPoint.lat, highlightedPoint.lng]} icon={locationIcon}>
                    <Popup>{highlightedPoint.label}</Popup>
                </Marker>
            )}
            
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
                                direction="top"
                                offset={[0, -10]}
                                className="leaflet-tooltip-label"
                                opacity={0.9}
                            >
                                {location.name} ({count})
                            </Tooltip>
                        </Marker>
                        <Circle
                            center={[location.latitude, location.longitude]}
                            radius={location.radius}
                            pathOptions={{ color: 'hsl(var(--primary))', fillColor: 'hsl(var(--primary))', fillOpacity: 0.2, weight: 2 }}
                        />
                    </React.Fragment>
                );
            })}

            {viewType === 'attendance' && outOfBoundsRecords.map(record => {
                if (!isAttendanceRecord(record)) return null;

                const userPhoto = record.userPhotoUrl;
                const userInitials = record.initials || 'U';
                const icon = createAvatarIcon(userPhoto, userInitials, 'red');

                return (
                    <Marker 
                        key={record.id} 
                        position={[record.entryLatitude!, record.entryLongitude!]} 
                        icon={icon}
                        eventHandlers={{
                            click: () => {
                                if (onOutOfBoundsRecordClick) onOutOfBoundsRecordClick(record);
                            },
                        }}
                    >
                        <Popup>
                            <div className="p-1">
                                <strong className="text-red-600">Fuera de Zona</strong><br />
                                <strong>Empleado:</strong> {record.userName}<br />
                                <strong>Cargo:</strong> {record.userCargo || 'N/A'}<br/>
                                <strong>Hora:</strong> {safelyFormatDate(record.entryTime)}<br/>
                                <strong>Ubicación Registrada:</strong> {record.entryWorkLocationName}
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            {viewType === 'reports' && records.map(report => {
                if (!isLocationReport(report)) return null;

                const userPhoto = report.userPhotoUrl;
                const userInitials = report.initials || 'U';
                const icon = createAvatarIcon(userPhoto, userInitials, 'hsl(var(--primary))');
                 return (
                     <Marker 
                        key={report.id} 
                        position={[report.latitude, report.longitude]} 
                        icon={icon}
                    >
                        <Popup>
                            <strong>Reporte de Ubicación</strong><br />
                            <strong>Empleado:</strong> {report.userName}<br />
                            <strong>Cargo:</strong> {report.userCargo || 'N/A'}<br/>
                            <strong>Hora:</strong> {format(new Date(report.timestamp), 'HH:mm:ss')}<br/>
                            {report.notes && <span>{report.notes}</span>}<br/>
                            {report.photoUrl && <img src={report.photoUrl} alt="Evidencia" style={{ width: '150px', marginTop: '5px' }} />}
                        </Popup>
                    </Marker>
                )
            })}
        </MapContainer>
    );
}
