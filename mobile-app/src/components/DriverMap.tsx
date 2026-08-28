import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Tooltip } from 'react-leaflet';
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

  // GREEN MARKER ICON FOR STARTING CITY AND DESTINATION CITY
  const createGreenCityIcon = (label: string, emoji: string) => {
    return L.divIcon({
      className: 'green-city-marker',
      html: `
        <div style="
          background: #22c55e;
          color: #000;
          padding: 5px 10px;
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
      iconSize: [140, 32],
      iconAnchor: [70, 16]
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

  const GUWAHATI_DEPOT = { lat: 26.1445, lng: 91.7362 };
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

      {/* 1. STARTING CITY MARKER: GUWAHATI (GREEN) */}
      <Marker
        position={[GUWAHATI_DEPOT.lat, GUWAHATI_DEPOT.lng]}
        icon={createGreenCityIcon('START: Guwahati', '🟢 🏁')}
      >
        <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.95}>
          <strong style={{ color: '#22c55e' }}>🟢 START: Guwahati Depot</strong>
        </Tooltip>
      </Marker>

      {/* 2. DESTINATION CITY MARKER: SILCHAR (GREEN) */}
      <Marker
        position={[SILCHAR_DESTINATION.lat, SILCHAR_DESTINATION.lng]}
        icon={createGreenCityIcon('DESTINATION: Silchar', '🟢 🎯')}
      >
        <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.95}>
          <strong style={{ color: '#22c55e' }}>🟢 DESTINATION: Silchar Hub</strong>
        </Tooltip>
      </Marker>

      {/* 3. OLD PRIMARY ROUTE (Dashed Red/Orange Line if blocked/alternate, or Orange if active) */}
      {(showBothRoutes || !isAlternateActive) && primaryPolyline.length > 1 && (
        <React.Fragment>
          <Polyline
            positions={primaryPolyline}
            pathOptions={{
              color: isAlternateActive ? '#ef4444' : '#ff6b35',
              weight: isAlternateActive ? 3 : 5,
              opacity: isAlternateActive ? 0.6 : 0.9,
              dashArray: '10, 8'
            }}
          />
          <Marker
            position={primaryPolyline[Math.floor(primaryPolyline.length / 2)]}
            icon={L.divIcon({
              className: 'old-route-label',
              html: `
                <div style="
                  background: #ef4444;
                  color: #fff;
                  padding: 3px 8px;
                  border-radius: 4px;
                  font-size: 10px;
                  font-weight: 800;
                  box-shadow: 0 0 10px #ef4444;
                  white-space: nowrap;
                ">
                  ❌ Old Primary Route (Blocked at Haflong Landslide)
                </div>
              `,
              iconSize: [260, 24],
              iconAnchor: [130, 12]
            })}
          />
        </React.Fragment>
      )}

      {/* 4. NEW ALTERNATE BYPASS ROUTE (Solid Cyan Line when active or showing both) */}
      {(isAlternateActive || showBothRoutes) && alternatePolyline && alternatePolyline.length > 1 && (
        <React.Fragment>
          <Polyline
            positions={alternatePolyline}
            pathOptions={{
              color: '#00d4ff',
              weight: 6,
              opacity: 0.95
            }}
          />
          <Marker
            position={alternatePolyline[Math.floor(alternatePolyline.length / 2)]}
            icon={L.divIcon({
              className: 'new-route-label',
              html: `
                <div style="
                  background: #00d4ff;
                  color: #000;
                  padding: 4px 10px;
                  border-radius: 6px;
                  font-size: 10px;
                  font-weight: 900;
                  box-shadow: 0 0 16px #00d4ff;
                  white-space: nowrap;
                ">
                  🔀 New Alternate Bypass Route (via Nagaon-Hojai) ➔ Silchar
                </div>
              `,
              iconSize: [280, 24],
              iconAnchor: [140, 12]
            })}
          />
        </React.Fragment>
      )}

      {/* 5. HAZARDS & CALAMITIES (Red/Orange Circles & Warning tooltips) */}
      {hazardZones.map(h => {
        const isBlocked = h.status === 'BLOCKED' || (isAlternateActive && h.id === 'hz9');
        return (
          <Circle
            key={h.id}
            center={[h.lat, h.lng]}
            radius={h.radius_km * 1000}
            pathOptions={{
              color: isBlocked ? '#ef4444' : '#ff6b35',
              fillColor: isBlocked ? '#ef4444' : '#ff6b35',
              fillOpacity: isBlocked ? 0.4 : 0.2,
              weight: isBlocked ? 3 : 2
            }}
          >
            <Tooltip permanent direction="top" opacity={0.9}>
              <span style={{ fontSize: 11, fontWeight: 800, color: isBlocked ? '#ef4444' : '#ff6b35' }}>
                {isBlocked ? `🚨 LANDSLIDE BLOCKED: ${h.name}` : `⚠️ ${h.name}`}
              </span>
            </Tooltip>
          </Circle>
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
