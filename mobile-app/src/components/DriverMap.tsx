import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GPSPosition, HazardZone } from '../types';

interface DriverMapProps {
  currentPos: GPSPosition;
  hazardZones: HazardZone[];
  routeWaypoints: { lat: number; lng: number }[];
  mode: string;
}

export const DriverMap: React.FC<DriverMapProps> = ({
  currentPos,
  hazardZones,
  routeWaypoints,
  mode
}) => {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  const getTruckIcon = () => {
    const isOffline = mode === 'OFFLINE_SMS';
    const color = isOffline ? '#ff6b35' : '#00d4ff';
    return L.divIcon({
      className: 'driver-truck-icon',
      html: `
        <div style="
          width: 40px;
          height: 40px;
          background: rgba(15, 23, 42, 0.9);
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 0 16px ${color};
        ">🚛</div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  };

  const polylinePositions = routeWaypoints.map(wp => [wp.lat, wp.lng] as [number, number]);

  return (
    <MapContainer
      center={[currentPos.lat, currentPos.lng]}
      zoom={9}
      style={{ width: '100%', height: '100%', borderRadius: 12 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Route Line */}
      {polylinePositions.length > 1 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{ color: '#00d4ff', weight: 5, opacity: 0.8 }}
        />
      )}

      {/* Hazard Zones */}
      {hazardZones.map(h => (
        <Circle
          key={h.id}
          center={[h.lat, h.lng]}
          radius={h.radius_km * 1000}
          pathOptions={{
            color: h.risk >= 0.8 ? '#ef4444' : '#ff6b35',
            fillColor: h.risk >= 0.8 ? '#ef4444' : '#ff6b35',
            fillOpacity: 0.25,
            weight: 2
          }}
        >
          <Tooltip permanent direction="top" opacity={0.85}>
            <span style={{ fontSize: 10, fontWeight: 700 }}>⚠️ {h.name}</span>
          </Tooltip>
        </Circle>
      ))}

      {/* Current Truck Location */}
      <Marker position={[currentPos.lat, currentPos.lng]} icon={getTruckIcon()}>
        <Popup>
          <div style={{ padding: 4 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: 14, color: '#00d4ff' }}>TRUCK-NER-01</h4>
            <p style={{ margin: 0, fontSize: 12 }}>Speed: {Math.round(currentPos.speed)} km/h</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#94a3b8' }}>
              ({currentPos.lat.toFixed(4)}, {currentPos.lng.toFixed(4)})
            </p>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
};
