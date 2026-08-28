'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

interface VehiclePosition {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  status?: string;
  source?: string;
}

interface Vehicle {
  id: string;
  name: string;
  cargo: string;
  capacity: number;
  status: string;
  position: VehiclePosition | null;
}

interface HazardZone {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  radius_km: number;
  risk: number;
}

interface MapViewProps {
  vehicles: Vehicle[];
  hazardZones: HazardZone[];
  route: { lat: number; lng: number }[][] | null;
}

const ROUTE_COLORS = ['#00d4ff', '#a855f7', '#22c55e', '#f59e0b', '#ec4899'];

export default function MapView({ vehicles, hazardZones, route }: MapViewProps) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  const createVehicleIcon = (isActive: boolean, source?: string) => {
    const color = source === 'sms' ? '#ff6b35' : isActive ? '#22c55e' : '#64748b';
    return L.divIcon({
      className: 'vehicle-marker',
      html: `<div style="
        font-size: 24px;
        filter: drop-shadow(0 0 6px ${color});
        text-align: center;
        line-height: 1;
      ">🚛</div>
      <div style="
        width: 8px; height: 8px;
        background: ${color};
        border-radius: 50%;
        margin: -2px auto 0;
        box-shadow: 0 0 8px ${color};
      "></div>`,
      iconSize: [30, 36],
      iconAnchor: [15, 36],
    });
  };

  const vehiclesWithPos = vehicles.filter((v) => v.position !== null);

  return (
    <MapContainer
      center={[26.2, 92.9]}
      zoom={7}
      style={{ height: '100%', width: '100%', zIndex: 1 }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Hazard Zones */}
      {hazardZones.map((h) => (
        <Circle
          key={h.id}
          center={[h.lat, h.lng]}
          radius={h.radius_km * 1000}
          pathOptions={{
            color: h.risk >= 0.8 ? '#ef4444' : h.risk >= 0.7 ? '#ff6b35' : '#facc15',
            fillColor: h.risk >= 0.8 ? '#ef4444' : h.risk >= 0.7 ? '#ff6b35' : '#facc15',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 8',
          }}
        >
          <Popup>
            <div style={{ padding: '4px', minWidth: '150px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600 }}>
                ⚠️ {h.name}
              </h3>
              <p style={{ margin: '2px 0', fontSize: '12px' }}>Type: {h.type}</p>
              <p style={{ margin: '2px 0', fontSize: '12px' }}>
                Risk: <strong style={{ color: h.risk >= 0.8 ? '#ef4444' : '#ff6b35' }}>
                  {(h.risk * 100).toFixed(0)}%
                </strong>
              </p>
              <p style={{ margin: '2px 0', fontSize: '12px' }}>Radius: {h.radius_km} km</p>
            </div>
          </Popup>
          <Tooltip direction="center" permanent opacity={0.7}>
            <span style={{ fontSize: '10px' }}>{h.type === 'flood' ? '🌊' : h.type === 'landslide' ? '⛰️' : '❄️'}</span>
          </Tooltip>
        </Circle>
      ))}

      {/* Route Lines */}
      {route &&
        route.map((line, i) => (
          <Polyline
            key={`route-${i}`}
            positions={line.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: ROUTE_COLORS[i % ROUTE_COLORS.length],
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 6',
            }}
          />
        ))}

      {/* Vehicle Markers */}
      {vehiclesWithPos.map((v) => {
        const pos = v.position!;
        const isActive = Date.now() - new Date(pos.timestamp).getTime() < 60000;
        return (
          <Marker
            key={v.id}
            position={[pos.lat, pos.lng]}
            icon={createVehicleIcon(isActive, pos.source)}
          >
            <Popup>
              <div style={{ padding: '4px', minWidth: '180px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600 }}>
                  🚛 {v.name}
                </h3>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  📦 Cargo: {v.cargo}
                </p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  ⚡ Speed: {Math.round(pos.speed || 0)} km/h
                </p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  🧭 Heading: {Math.round(pos.heading || 0)}°
                </p>
                <p style={{ margin: '2px 0', fontSize: '10px', color: '#94a3b8' }}>
                  📍 ({pos.lat.toFixed(4)}, {pos.lng.toFixed(4)})
                </p>
                <p style={{ margin: '2px 0', fontSize: '10px', color: '#94a3b8' }}>
                  🕐 {new Date(pos.timestamp).toLocaleTimeString()}
                  {pos.source === 'sms' && (
                    <span style={{ marginLeft: '4px', color: '#ff6b35', fontWeight: 600 }}>
                      [SMS FAILSAFE]
                    </span>
                  )}
                </p>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
              <span style={{ fontSize: '11px', fontWeight: 500 }}>{v.id}</span>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
