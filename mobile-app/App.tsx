import React, { useState, useEffect, useRef } from 'react';
import { GPSPosition, NetworkMode, OfflineGpsTick, HazardAlert } from './src/types';
import { TelemetryService } from './src/services/telemetryService';
import { checkHazardProximity, NER_HAZARD_ZONES } from './src/services/hazardEngine';
import { NavigationHUD } from './src/components/NavigationHUD';
import { DriverMap } from './src/components/DriverMap';
import { HazardAlertModal } from './src/components/HazardAlertModal';
import { OfflineSmsPanel } from './src/components/OfflineSmsPanel';

// 1. PRIMARY ROUTE (Cooch Behar -> Bongaigaon -> Guwahati Junction -> Shillong -> Jowai -> Haflong Landslide -> Silchar)
const PRIMARY_COOCHBEHAR_SILCHAR = [
  { lat: 26.3452, lng: 89.4482 }, // Cooch Behar Start (Green)
  { lat: 26.4712, lng: 90.5583 }, // Bongaigaon
  { lat: 26.1445, lng: 91.7362 }, // Guwahati Junction (WARNING TRIGGER AT GUWAHATI!)
  { lat: 25.5783, lng: 91.8933 }, // Shillong
  { lat: 25.4530, lng: 92.0640 }, // Jowai
  { lat: 25.1800, lng: 93.0100 }, // Haflong (BLOCKED LANDSLIDE)
  { lat: 24.8333, lng: 92.7789 }, // Silchar Destination (Green)
];

// 2. ALTERNATE BYPASS ROUTE (Guwahati -> Jagiroad -> Nagaon -> Hojai -> Kalain -> Silchar Destination)
const ALTERNATE_GUWAHATI_SILCHAR = [
  { lat: 26.1445, lng: 91.7362 }, // Guwahati Junction
  { lat: 26.2500, lng: 92.1500 }, // Jagiroad Safe Highway
  { lat: 26.3500, lng: 92.6800 }, // Nagaon Junction
  { lat: 25.8800, lng: 92.9500 }, // Hojai / Lanka Safe Corridor
  { lat: 24.9800, lng: 92.5800 }, // Kalain Entry
  { lat: 24.8333, lng: 92.7789 }, // Silchar Destination (Green)
];

export function App() {
  const [activeWaypoints, setActiveWaypoints] = useState(PRIMARY_COOCHBEHAR_SILCHAR);
  const [routeIndex, setRouteIndex] = useState(0);
  const [currentPos, setCurrentPos] = useState<GPSPosition>({
    lat: PRIMARY_COOCHBEHAR_SILCHAR[0].lat,
    lng: PRIMARY_COOCHBEHAR_SILCHAR[0].lng,
    speed: 0,
    heading: 90,
    timestamp: new Date().toISOString()
  });

  const [mode, setMode] = useState<NetworkMode>('4G');
  const [offlineQueue, setOfflineQueue] = useState<OfflineGpsTick[]>([]);
  const [activeAlert, setActiveAlert] = useState<HazardAlert | null>(null);
  const [tripStarted, setTripStarted] = useState(false);
  const [isDriving, setIsDriving] = useState(false);
  const [isAlternateActive, setIsAlternateActive] = useState(false);
  const [showBothRoutes, setShowBothRoutes] = useState(false);
  const [hasWarnedAtGuwahati, setHasWarnedAtGuwahati] = useState(false);
  const [routeMessage, setRouteMessage] = useState<string>('Click "START TRIP" to begin navigation from Cooch Behar to Silchar.');

  const telemetryServiceRef = useRef<TelemetryService | null>(null);

  if (!telemetryServiceRef.current) {
    const service = new TelemetryService('TRUCK-NER-01', 'http://localhost:3000');
    service.setQueueChangeListener(queue => setOfflineQueue(queue));
    telemetryServiceRef.current = service;
  }

  // Handle Start Trip Button
  const handleStartTrip = () => {
    setTripStarted(true);
    setIsDriving(true);
    setIsAlternateActive(false);
    setShowBothRoutes(false);
    setHasWarnedAtGuwahati(false);
    setActiveWaypoints(PRIMARY_COOCHBEHAR_SILCHAR);
    setRouteIndex(0);
    setCurrentPos({
      lat: PRIMARY_COOCHBEHAR_SILCHAR[0].lat,
      lng: PRIMARY_COOCHBEHAR_SILCHAR[0].lng,
      speed: 50,
      heading: 90,
      timestamp: new Date().toISOString()
    });
    setRouteMessage('▶️ TRIP STARTED: Truck driving from Cooch Behar on Primary Route...');
  };

  // Simulated GPS Movement & Warning Trigger Loop
  useEffect(() => {
    if (!isDriving || !tripStarted) return;

    const interval = setInterval(() => {
      setRouteIndex(prev => {
        const next = prev + 1;

        // Check if destination Silchar is reached -> Restart process automatically!
        if (next >= activeWaypoints.length) {
          setIsDriving(false);
          setRouteMessage('🎉 DESTINATION REACHED: Silchar Hub! Automatically restarting trip from Cooch Behar...');
          setTimeout(() => {
            handleStartTrip();
          }, 3000);
          return 0;
        }

        const target = activeWaypoints[next];
        const updatedPos: GPSPosition = {
          lat: target.lat,
          lng: target.lng,
          speed: Math.floor(45 + Math.random() * 15),
          heading: Math.floor(110 + Math.random() * 20),
          timestamp: new Date().toISOString()
        };

        setCurrentPos(updatedPos);

        // Check WARNING TRIGGER UPON REACHING GUWAHATI (Lat 26.1445, Lng 91.7362)
        if (!isAlternateActive && !hasWarnedAtGuwahati && target.lat === 26.1445 && target.lng === 91.7362) {
          setHasWarnedAtGuwahati(true);
          setIsDriving(false); // Pause drive at Guwahati for decision
          setActiveAlert({
            zone: {
              id: 'hz9',
              name: 'Haflong Landslide Zone (Road Blocked Ahead)',
              lat: 25.18,
              lng: 93.01,
              radius_km: 15,
              risk: 0.95,
              type: 'landslide'
            },
            distanceKm: 120.5,
            level: 'critical'
          });
          setRouteMessage('🚨 GUWAHATI REACHED: Landslide warning ahead at Haflong! Request alternate bypass route.');
        }

        if (telemetryServiceRef.current) {
          telemetryServiceRef.current.sendTelemetry(updatedPos, mode);
        }

        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isDriving, tripStarted, mode, activeWaypoints, isAlternateActive, hasWarnedAtGuwahati]);

  // Request & Switch to Alternate Bypass Route
  const handleRequestAlternateRoute = async () => {
    setRouteMessage('⚠️ Reporting Haflong Landslide & Switching to Alternate Bypass Route to Silchar...');
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
          details: 'Landslide at Haflong reported at Guwahati junction! Bypassing via Nagaon-Hojai safe corridor to Silchar.'
        })
      });

      // 2. Request alternate route from Python VRP solver
      const res = await fetch('http://localhost:3000/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot: { id: 'Cooch Behar Depot', lat: 26.3452, lng: 89.4482, demand: 0 },
          customers: [
            { id: 'Silchar Hub', lat: 24.8333, lng: 92.7789, demand: 50 }
          ],
          request_type: 'alternate',
          avoid_hazards: ['Haflong']
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveAlert(null);
        setIsAlternateActive(true);
        setShowBothRoutes(true); // Show BOTH Old Red & New Cyan Routes on map!
        setActiveWaypoints(ALTERNATE_GUWAHATI_SILCHAR);
        setRouteIndex(0);
        setIsDriving(true); // Resume truck driving on new route!
        setRouteMessage(`🔀 ALTERNATE BYPASS ACTIVE: Showing both routes. Truck driving on Cyan route to Silchar (${data.total_distance_km} km total).`);
      }
    } catch {
      setActiveAlert(null);
      setIsAlternateActive(true);
      setShowBothRoutes(true);
      setActiveWaypoints(ALTERNATE_GUWAHATI_SILCHAR);
      setRouteIndex(0);
      setIsDriving(true);
      setRouteMessage('🔀 Alternate safe route active (Bypassing Haflong to Silchar).');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🚛</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#00d4ff' }}>
              NER TRUCK DRIVER MOBILE APP
            </h1>
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>
              🟢 START: Cooch Behar ➔ 🟢 DESTINATION: Silchar Hub
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {!tripStarted ? (
            <button
              onClick={handleStartTrip}
              style={{
                backgroundColor: '#22c55e',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(34, 197, 94, 0.4)'
              }}
            >
              ▶️ START TRIP
            </button>
          ) : (
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
          )}
        </div>
      </div>

      {/* Route Status Banner */}
      <div style={{
        backgroundColor: isAlternateActive ? '#ff6b35' : tripStarted ? '#0284c7' : '#1e293b',
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
          <span style={{ backgroundColor: '#000', color: '#00d4ff', fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 900 }}>
            SHOWING BOTH ROUTES
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
            primaryWaypoints={PRIMARY_COOCHBEHAR_SILCHAR}
            alternateWaypoints={ALTERNATE_GUWAHATI_SILCHAR}
            mode={mode}
            isAlternateActive={isAlternateActive}
            showBothRoutes={showBothRoutes}
          />
        </div>
      </div>

      {/* Hazard Proximity & Guwahati Warning Popup */}
      <HazardAlertModal
        alert={activeAlert}
        onDismiss={() => {
          setActiveAlert(null);
          setIsDriving(true);
        }}
        onRerouteRequest={() => {
          handleRequestAlternateRoute();
        }}
      />
    </div>
  );
}

export default App;
