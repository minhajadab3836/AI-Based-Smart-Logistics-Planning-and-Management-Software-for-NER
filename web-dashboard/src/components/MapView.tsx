'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
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
  status?: string;
}

interface MapViewProps {
  vehicles: Vehicle[];
  hazardZones: HazardZone[];
  route: { lat: number; lng: number }[][] | null;
  isAlternate?: boolean;
}

export default function MapView({ vehicles, hazardZones, route, isAlternate }: MapViewProps) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const createVehicleIcon = (isActive: boolean, source?: string) => {
    const color = source === 'sms' ? '#ff6b35' : isActive ? '#22c55e' : '#64748b';
    return L.divIcon({
      className: 'vehicle-marker',
      html: `<div style="
        font-size: 26px;
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

  const COOCHBEHAR_START = { lat: 26.3452, lng: 89.4482 };
  const GUWAHATI_JUNCTION = { lat: 26.1445, lng: 91.7362 };
  const SILCHAR_DESTINATION = { lat: 24.8333, lng: 92.7789 };

  const PRIMARY_POLYLINE: [number, number][] = [
    [26.3452, 89.4482], // Cooch Behar (Green Start)
    [26.4712, 90.5583], // Bongaigaon
    [26.1445, 91.7362], // Guwahati (Warning Trigger)
    [25.5783, 91.8933], // Shillong
    [25.4530, 92.0640], // Jowai
    [25.1800, 93.0100], // Haflong (Blocked Landslide)
    [24.8333, 92.7789], // Silchar (Green Destination)
  ];

  const ALTERNATE_POLYLINE: [number, number][] = [
    [26.1445, 91.7362], // Guwahati Junction
    [26.2500, 92.1500], // Jagiroad
    [26.3500, 92.6800], // Nagaon
    [25.8800, 92.9500], // Hojai / Lanka
    [24.9800, 92.5800], // Kalain
    [24.8333, 92.7789], // Silchar Destination (Green Destination)
  ];

  return (
    <MapContainer
      center={[25.8, 91.2]}
      zoom={8}
      style={{ height: '100%', width: '100%', zIndex: 1 }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 1. STARTING CITY MARKER: COOCH BEHAR (GREEN) */}
      <Marker
        position={[COOCHBEHAR_START.lat, COOCHBEHAR_START.lng]}
        icon={createGreenCityIcon('START: Cooch Behar', '🟢 🏁')}
      >
        <Popup>
          <div style={{ padding: 4 }}>
            <h4 style={{ margin: 0, color: '#22c55e' }}>🟢 STARTING CITY: Cooch Behar Depot</h4>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>Coordinates: 26.3452° N, 89.4482° E</p>
          </div>
        </Popup>
      </Marker>

      {/* 2. WARNING TRIGGER JUNCTION: GUWAHATI */}
      <Marker
        position={[GUWAHATI_JUNCTION.lat, GUWAHATI_JUNCTION.lng]}
        icon={L.divIcon({
          className: 'junction-marker',
          html: `
            <div style="
              background: #0284c7;
              color: #fff;
              padding: 4px 10px;
              border-radius: 6px;
              font-weight: 800;
              font-size: 11px;
              box-shadow: 0 0 12px #0284c7;
              border: 1px solid #ffffff;
              white-space: nowrap;
            ">
              📍 Warning Point: Guwahati
            </div>
          `,
          iconSize: [150, 28],
          iconAnchor: [75, 14]
        })}
      />

      {/* 3. DESTINATION CITY MARKER: SILCHAR (GREEN - NO LANDSLIDE!) */}
      <Marker
        position={[SILCHAR_DESTINATION.lat, SILCHAR_DESTINATION.lng]}
        icon={createGreenCityIcon('DESTINATION: Silchar', '🟢 🎯')}
      >
        <Popup>
          <div style={{ padding: 4 }}>
            <h4 style={{ margin: 0, color: '#22c55e' }}>🟢 DESTINATION CITY: Silchar Hub</h4>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>Coordinates: 24.8333° N, 92.7789° E</p>
          </div>
        </Popup>
      </Marker>

      {/* 4. PRIMARY ROUTE */}
      <Polyline
        positions={PRIMARY_POLYLINE}
        pathOptions={{
          color: isAlternate ? '#ef4444' : '#ff6b35',
          weight: isAlternate ? 3 : 5,
          opacity: isAlternate ? 0.6 : 0.9,
          dashArray: '10, 8'
        }}
      />

      {/* 5. NEW ALTERNATE ROUTE */}
      {isAlternate && (
        <Polyline
          positions={ALTERNATE_POLYLINE}
          pathOptions={{
            color: '#00d4ff',
            weight: 6,
            opacity: 0.95
          }}
        />
      )}

      {/* 6. HAZARD ZONES (RED CIRCLES WITH EXPLICIT LANDSLIDE BADGES) */}
      {hazardZones.map((h) => {
        if (h.lat === SILCHAR_DESTINATION.lat && h.lng === SILCHAR_DESTINATION.lng) return null;

        const isBlocked = h.status === 'BLOCKED' || (isAlternate && h.id === 'hz9');
        const iconEmoji = h.type === 'landslide' ? '⛰️' : h.type === 'flood' ? '🌊' : '⚠️';
        return (
          <React.Fragment key={h.id}>
            <Circle
              center={[h.lat, h.lng]}
              radius={h.radius_km * 1000}
              pathOptions={{
                color: isBlocked ? '#ef4444' : h.risk >= 0.8 ? '#ef4444' : '#ff6b35',
                fillColor: isBlocked ? '#ef4444' : h.risk >= 0.8 ? '#ef4444' : '#ff6b35',
                fillOpacity: isBlocked ? 0.45 : 0.2,
                weight: isBlocked ? 3 : 2,
                dashArray: isBlocked ? 'none' : '5, 8',
              }}
            >
              <Popup>
                <div style={{ padding: '4px', minWidth: '160px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: isBlocked ? '#ef4444' : '#fff' }}>
                    {iconEmoji} {h.name} {isBlocked ? '🚫 (ROAD BLOCKED)' : ''}
                  </h3>
                  <p style={{ margin: '2px 0', fontSize: '12px' }}>Type: {h.type.toUpperCase()}</p>
                  <p style={{ margin: '2px 0', fontSize: '12px' }}>
                    Status: <strong style={{ color: isBlocked ? '#ef4444' : '#22c55e' }}>
                      {isBlocked ? 'BLOCKED LANDSLIDE AREA' : 'Active Warning'}
                    </strong>
                  </p>
                </div>
              </Popup>
            </Circle>

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

      {/* 7. VEHICLE MARKERS */}
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
                <p style={{ margin: '2px 0', fontSize: '10px', color: '#94a3b8' }}>
                  📍 ({pos.lat.toFixed(4)}, {pos.lng.toFixed(4)})
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
