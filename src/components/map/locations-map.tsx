'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React, { useEffect } from 'react';
import type { WorkLocation } from '@/lib/types';

const customIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface MapControllerProps {
    center: [number, number];
    zoom: number;
}

function MapController({ center, zoom }: MapControllerProps) {
    const map = useMap();
    useEffect(() => {
        if (center && zoom) {
            map.setView(center, zoom);
        }
    }, [center, zoom, map]);
    return null;
}

function MapEvents({ onDoubleClick }: { onDoubleClick: (latlng: { lat: number; lng: number }) => void }) {
    useMapEvents({
        dblclick(e) {
            onDoubleClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        },
    });
    return null;
}

interface LocationsMapProps {
    locations: WorkLocation[];
    center: [number, number];
    zoom: number;
    onMapDoubleClick: (latlng: { lat: number, lng: number }) => void;
    onMarkerClick: (locationId: string) => void;
    selectedLocationId: string | null;
}

export default function LocationsMap({ locations, center, zoom, onMapDoubleClick, onMarkerClick, selectedLocationId }: LocationsMapProps) {
    const validLocations = locations
        .map(l => ({
            ...l,
            latitude: Number(l.latitude),
            longitude: Number(l.longitude),
            radius: Number(l.radius),
        }))
        .filter(l =>
            l.latitude != null && !isNaN(l.latitude) && isFinite(l.latitude) &&
            l.longitude != null && !isNaN(l.longitude) && isFinite(l.longitude) &&
            l.radius != null && !isNaN(l.radius) && isFinite(l.radius)
        );

    return (
        <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} doubleClickZoom={false}>
            <MapController center={center} zoom={zoom} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {validLocations.map(location => {
                const isSelected = location.id === selectedLocationId;
                return (
                <React.Fragment key={location.id}>
                    <Marker 
                        icon={customIcon}
                        position={[location.latitude, location.longitude]}
                        eventHandlers={{
                            click: () => {
                                onMarkerClick(location.id);
                            },
                        }}
                    >
                        <Popup>
                            {location.name} <br /> Lat: {location.latitude.toFixed(4)}, Lon: {location.longitude.toFixed(4)}
                        </Popup>
                    </Marker>
                     <Circle
                        center={[location.latitude, location.longitude]}
                        pathOptions={{ 
                            color: isSelected ? 'hsl(var(--ring))' : 'hsl(var(--primary))', 
                            fillColor: isSelected ? 'hsl(var(--ring))' : 'hsl(var(--primary))', 
                            fillOpacity: 0.2 
                        }}
                        radius={location.radius || 0}
                    />
                </React.Fragment>
            )})}
            <MapEvents onDoubleClick={onMapDoubleClick} />
        </MapContainer>
    );
}
