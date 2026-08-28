import React, { useState, useEffect, useRef } from 'react';
import { GPSPosition, NetworkMode, OfflineGpsTick, HazardAlert } from './src/types';
import { TelemetryService } from './src/services/telemetryService';
import { checkHazardProximity, NER_HAZARD_ZONES } from './src/services/hazardEngine';
import { NavigationHUD } from './src/components/NavigationHUD';
import { DriverMap } from './src/components/DriverMap';
import { HazardAlertModal } from './src/components/HazardAlertModal';
import { OfflineSmsPanel } from './src/components/OfflineSmsPanel';

// PRIMARY ROUTE: Guwahati -> Shillong -> Jowai -> Haflong (Landslide Area 25.18, 93.01) -> Silchar Destination
const PRIMARY_GUWAHATI_SILCHAR = [
  { lat: 26.1445, lng: 91.7362 }, // Guwahati Depot
  { lat: 25.5783, lng: 91.8933 }, // Shillong
  { lat: 25.4530, lng: 92.0640 }, // Jowai
  { lat: 25.1800, lng: 93.0100 }, // Haflong (LANDSLIDE AREA)
  { lat: 24.8333, lng: 92.7789 }, // Silchar Destination
];

export function App() {
  const [routeWaypoints, setRouteWaypoints] = useState(PRIMARY_GUWAHATI_SILCHAR);
  const [routeIndex, setRouteIndex] = useState(0);
  const [currentPos, setCurrentPos] = useState<GPSPosition>({
    lat: PRIMARY_GUWAHATI_SILCHAR[0].lat,
    lng: PRIMARY_GUWAHATI_SILCHAR[0].lng,
    speed: 48,
    heading: 135,
    timestamp: new Date().toISOString()
  });

  const [mode, setMode] = useState<NetworkMode>('4G');
  const [offlineQueue, setOfflineQueue] = useState<OfflineGpsTick[]>([]);
  const [activeAlert, setActiveAlert] = useState<HazardAlert | null>(null);
  const [isDriving, setIsDriving] = useState(true);
  const [isAlternateActive, setIsAlternateActive] = useState(false);
  const [routeMessage, setRouteMessage] = useState<string>('PRIMARY ROUTE ACTIVE: Guwahati → Shillong → Jowai → Haflong → Silchar Destination');

  const telemetryServiceRef = useRef<TelemetryService | null>(null);

  if (!telemetryServiceRef.current) {
    const service = new TelemetryService('TRUCK-NER-01', 'http://localhost:3000');
    service.setQueueChangeListener(queue => setOfflineQueue(queue));
    telemetryServiceRef.current = service;
  }

  // Simulated GPS Movement & Telemetry Loop
  useEffect(() => {
    if (!isDriving) return;

    const interval = setInterval(() => {
      setRouteIndex(prev => {
        const next = (prev + 1) % routeWaypoints.length;
        const target = routeWaypoints[next];
        const updatedPos: GPSPosition = {
          lat: target.lat,
          lng: target.lng,
          speed: Math.floor(40 + Math.random() * 20),
          heading: Math.floor(130 + Math.random() * 30),
          timestamp: new Date().toISOString()
        };

        setCurrentPos(updatedPos);

        const alert = checkHazardProximity(updatedPos);
        if (alert) {
          setActiveAlert(alert);
        }

        if (telemetryServiceRef.current) {
          telemetryServiceRef.current.sendTelemetry(updatedPos, mode);
        }

        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isDriving, mode, routeWaypoints]);

  // Request Alternate Route Bypassing Haflong Landslide Area to Silchar
  const handleRequestAlternateRoute = async () => {
    setRouteMessage('⚠️ Reporting Haflong Landslide & Requesting Alternate Safe Detour to Silchar...');
    try {
      // 1. Log incident report to server & manager dashboard
      await fetch('http://localhost:3000/api/report-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: 'TRUCK-NER-01',
          hazardName: 'Haflong Landslide Zone',
          type: 'landslide',
          lat: 25.18,
          lng: 93.01,
          details: 'Landslide blocking highway at Haflong! Requesting alternate bypass to Silchar.'
        })
      });

      // 2. Request alternate route avoiding Haflong from Python VRP solver
      const res = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot: { id: 'Guwahati', lat: 26.1445, lng: 91.7362, demand: 0 },
          customers: [
            { id: 'Silchar', lat: 24.8333, lng: 92.7789, demand: 50 }
          ],
          request_type: 'alternate',
          avoid_hazards: ['Haflong']
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.waypoints && data.waypoints[0]) {
          setRouteWaypoints(data.waypoints[0]);
          setRouteIndex(0);
          setIsAlternateActive(true);
          setRouteMessage(`🔀 ALTERNATE ROUTE ACTIVE: Bypassing Haflong Landslide via Nagaon-Hojai safe corridor → Silchar Destination (${data.total_distance_km} km total).`);
        }
      }
    } catch {
      setRouteMessage('⚠️ Alternate route request queued via offline buffer.');
    }
  };

  const handleSos = async () => {
    if (telemetryServiceRef.current) {
      await telemetryServiceRef.current.sendTelemetry(currentPos, mode, 'EMERGENCY_SOS');
      alert('🚨 EMERGENCY SOS DISPATCHED TO NER COMMAND CENTER!');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0a0e17',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: 12,
      boxSizing: 'border-box',
      gap: 12
    }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f172a',
        padding: '10px 16px',
        borderRadius: 12,
        border: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🚛</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#00d4ff' }}>
              NER TRUCK DRIVER MOBILE APP
            </h1>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Route: Guwahati Depot ➔ Silchar Destination | Cargo: Medicines
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsDriving(!isDriving)}
          style={{
            backgroundColor: isDriving ? '#ef4444' : '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {isDriving ? '⏸️ Pause Drive' : '▶️ Resume Drive'}
        </button>
      </div>

      {/* Route Status Banner */}
      <div style={{
        backgroundColor: isAlternateActive ? '#ff6b35' : '#0284c7',
        color: isAlternateActive ? '#000' : '#fff',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 800,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>{routeMessage}</span>
        {isAlternateActive && (
          <span style={{ backgroundColor: '#000', color: '#ff6b35', fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>
            HAFLONG BYPASSED
          </span>
        )}
      </div>

      {/* Main App Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '380px 1fr',
        flex: 1,
        gap: 12,
        overflow: 'hidden'
      }}>
        {/* Left Column: Navigation HUD & SMS Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <NavigationHUD
            currentPos={currentPos}
            mode={mode}
            onModeChange={setMode}
            onReroute={handleRequestAlternateRoute}
            onSos={handleSos}
          />

          <OfflineSmsPanel
            queue={offlineQueue}
            currentPos={currentPos}
            onSendSms={(payload) => telemetryServiceRef.current?.sendSmsPayload(payload) ?? Promise.resolve(false)}
            onClearQueue={() => telemetryServiceRef.current?.clearQueue()}
          />
        </div>

        {/* Right Column: Driver Map HUD */}
        <div style={{ height: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid #1e293b' }}>
          <DriverMap
            currentPos={currentPos}
            hazardZones={NER_HAZARD_ZONES}
            routeWaypoints={routeWaypoints}
            mode={mode}
          />
        </div>
      </div>

      {/* Hazard Proximity Popup */}
      <HazardAlertModal
        alert={activeAlert}
        onDismiss={() => setActiveAlert(null)}
        onRerouteRequest={() => {
          setActiveAlert(null);
          handleRequestAlternateRoute();
        }}
      />
    </div>
  );
}

export default App;
