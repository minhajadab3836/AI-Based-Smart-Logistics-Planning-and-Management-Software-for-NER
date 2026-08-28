import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GPSPosition, HazardZone } from '../types';

interface DriverMapProps {
  currentPos: GPSPosition;
  hazardZones: HazardZone[];
  primaryWaypoints: { lat: number; lng: number }[];
  alternateWaypoints: { lat: number; lng: number }[] | null;
  mode: string;
  isAlternateActive: boolean;
  showBothRoutes?: boolean;
}

export const DriverMap: React.FC<DriverMapProps> = ({
  currentPos,
  hazardZones,
  primaryWaypoints,
  alternateWaypoints,
  mode,
  isAlternateActive,
  showBothRoutes
}) => {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  const createGreenCityIcon = (label: string, emoji: string) => {
    return L.divIcon({
      className: 'green-city-marker',
      html: `
        <div style="
          background: #22c55e;
          color: #000;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 11px;
          box-shadow: 0 0 14px #22c55e;
          border: 2px solid #ffffff;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span>${emoji}</span>
          <span>${label}</span>
        </div>
      `,
      iconSize: [160, 34],
      iconAnchor: [80, 17]
    });
  };

  const getTruckIcon = () => {
    const isOffline = mode === 'OFFLINE_SMS';
    const color = isOffline ? '#ff6b35' : '#00d4ff';
    return L.divIcon({
      className: 'driver-truck-icon',
      html: `
        <div style="
          width: 42px;
          height: 42px;
          background: rgba(15, 23, 42, 0.95);
          border: 2px solid ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 0 20px ${color};
        ">🚛</div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });
  };

  const primaryPolyline = primaryWaypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
  const alternatePolyline = alternateWaypoints ? alternateWaypoints.map(wp => [wp.lat, wp.lng] as [number, number]) : null;

  const COOCHBEHAR_START = { lat: 26.3452, lng: 89.4482 };
  const SILCHAR_DESTINATION = { lat: 24.8333, lng: 92.7789 };

  return (
    <MapContainer
      center={[currentPos.lat, currentPos.lng]}
      zoom={8}
      style={{ width: '100%', height: '100%', borderRadius: 12 }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 1. STARTING CITY MARKER: COOCH BEHAR (GREEN BADGE) */}
      <Marker
        position={[COOCHBEHAR_START.lat, COOCHBEHAR_START.lng]}
        icon={createGreenCityIcon('START: Cooch Behar', '🟢 🏁')}
      />

      {/* 2. DESTINATION CITY MARKER: SILCHAR (GREEN BADGE) */}
      <Marker
        position={[SILCHAR_DESTINATION.lat, SILCHAR_DESTINATION.lng]}
        icon={createGreenCityIcon('DESTINATION: Silchar', '🟢 🎯')}
      />

      {/* 3. OLD PRIMARY ROUTE */}
      {(showBothRoutes || !isAlternateActive) && primaryPolyline.length > 1 && (
        <Polyline
          positions={primaryPolyline}
          pathOptions={{
            color: isAlternateActive ? '#ef4444' : '#ff6b35',
            weight: isAlternateActive ? 3 : 5,
            opacity: isAlternateActive ? 0.6 : 0.9,
            dashArray: '10, 8'
          }}
        />
      )}

      {/* 4. NEW ALTERNATE BYPASS ROUTE */}
      {(isAlternateActive || showBothRoutes) && alternatePolyline && alternatePolyline.length > 1 && (
        <Polyline
          positions={alternatePolyline}
          pathOptions={{
            color: '#00d4ff',
            weight: 6,
            opacity: 0.95
          }}
        />
      )}

      {/* 5. HAZARD ZONES (RED CIRCLES WITH EXPLICIT LANDSLIDE BADGES) */}
      {hazardZones.map(h => {
        if (h.lat === SILCHAR_DESTINATION.lat && h.lng === SILCHAR_DESTINATION.lng) return null;

        const isBlocked = h.status === 'BLOCKED' || (isAlternateActive && h.id === 'hz9');
        const iconEmoji = h.type === 'landslide' ? '⛰️' : h.type === 'flood' ? '🌊' : '⚠️';
        return (
          <React.Fragment key={h.id}>
            <Circle
              center={[h.lat, h.lng]}
              radius={h.radius_km * 1000}
              pathOptions={{
                color: isBlocked ? '#ef4444' : '#ff6b35',
                fillColor: isBlocked ? '#ef4444' : '#ff6b35',
                fillOpacity: isBlocked ? 0.45 : 0.2,
                weight: isBlocked ? 3 : 2
              }}
            />

            {/* EXPLICIT LANDSLIDE BADGE MARKER ON RED CIRCLE */}
            <Marker
              position={[h.lat, h.lng]}
              icon={L.divIcon({
                className: 'hazard-label-marker',
                html: `
                  <div style="
                    background: ${isBlocked ? '#ef4444' : '#ff6b35'};
                    color: #ffffff;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-weight: 800;
                    font-size: 10px;
                    box-shadow: 0 0 12px ${isBlocked ? '#ef4444' : '#ff6b35'};
                    border: 1.5px solid #ffffff;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                  ">
                    <span>${iconEmoji}</span>
                    <span>${h.name.toUpperCase()} ${isBlocked ? '(ROAD BLOCKED)' : ''}</span>
                  </div>
                `,
                iconSize: [210, 26],
                iconAnchor: [105, 13]
              })}
            />
          </React.Fragment>
        );
      })}

      {/* 6. CURRENT TRUCK LOCATION */}
      <Marker position={[currentPos.lat, currentPos.lng]} icon={getTruckIcon()}>
        <Popup>
          <div style={{ padding: 4 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: 14, color: '#00d4ff' }}>🚛 TRUCK-NER-01</h4>
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
