'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading manager map...</div>,
});

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

interface IncidentReport {
  id: string;
  vehicleId: string;
  hazardName: string;
  type: string;
  lat: number;
  lng: number;
  details: string;
  timestamp: string;
}

interface Stats {
  totalVehicles: number;
  activeVehicles: number;
  hazardZones: number;
  totalGpsLogs: number;
  reportedIncidents?: number;
  blockedRoads?: number;
}

const API_BASE = 'http://localhost:3000';

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hazardZones, setHazardZones] = useState<HazardZone[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [latestIncident, setLatestIncident] = useState<IncidentReport | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalVehicles: 0,
    activeVehicles: 0,
    hazardZones: 0,
    totalGpsLogs: 0,
    reportedIncidents: 0,
    blockedRoads: 0
  });

  const [connected, setConnected] = useState(false);
  const [route, setRoute] = useState<{ lat: number; lng: number }[][] | null>(null);
  const [isAlternateRoute, setIsAlternateRoute] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const calculateRoute = useCallback(async (requestType: 'primary' | 'alternate' = 'primary') => {
    setRouteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot: { id: 'Cooch Behar Depot', lat: 26.3452, lng: 89.4482, demand: 0 },
          customers: [
            { id: 'Silchar Hub', lat: 24.8333, lng: 92.7789, demand: 50 }
          ],
          request_type: requestType,
          avoid_hazards: requestType === 'alternate' ? ['Haflong'] : []
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.waypoints && data.waypoints.length > 0) {
          setRoute(data.waypoints.map((wp: { lat: number; lng: number }[]) =>
            wp.map((p) => ({ lat: p.lat, lng: p.lng }))
          ));
          setRouteDistance(data.total_distance_km);
          setIsAlternateRoute(!!data.is_alternate);
          setRouteMessage(data.message);
        }
      }
    } catch (e) {
      console.error('Failed to calculate route', e);
    }
    setRouteLoading(false);
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [vehRes, hazRes, incRes] = await Promise.all([
          fetch(`${API_BASE}/api/vehicles`),
          fetch(`${API_BASE}/api/hazard-zones`),
          fetch(`${API_BASE}/api/incidents`)
        ]);
        if (vehRes.ok) setVehicles(await vehRes.json());
        if (hazRes.ok) setHazardZones(await hazRes.json());
        if (incRes.ok) setIncidents(await incRes.json());
        fetchStats();
        calculateRoute('primary');
      } catch {
        setTimeout(fetchInitialData, 3000);
      }
    };

    fetchInitialData();
    const statsInterval = setInterval(fetchStats, 5000);

    let eventSource: EventSource | null = null;
    const connectSSE = () => {
      eventSource = new EventSource(`${API_BASE}/api/stream`);

      eventSource.onopen = () => setConnected(true);

      eventSource.addEventListener('init', (e) => {
        try {
          setVehicles(JSON.parse(e.data));
        } catch { /* ignore */ }
      });

      eventSource.addEventListener('gps_update', (e) => {
        const data = JSON.parse(e.data);
        setVehicles((prev) =>
          prev.map((v) =>
            v.id === data.vehicleId
              ? {
                  ...v,
                  position: {
                    lat: data.lat,
                    lng: data.lng,
                    speed: data.speed,
                    heading: data.heading,
                    timestamp: data.timestamp,
                  },
                }
              : v
          )
        );
      });

      eventSource.addEventListener('incident_reported', (e) => {
        const incident: IncidentReport = JSON.parse(e.data);
        setLatestIncident(incident);
        setIncidents((prev) => [incident, ...prev]);
        calculateRoute('alternate');
      });

      eventSource.addEventListener('hazard_update', (e) => {
        const updatedZones: HazardZone[] = JSON.parse(e.data);
        setHazardZones(updatedZones);
      });

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      clearInterval(statsInterval);
      eventSource?.close();
    };
  }, [fetchStats, calculateRoute]);

  const isVehicleActive = (v: Vehicle) => {
    if (!v.position?.timestamp) return false;
    return Date.now() - new Date(v.position.timestamp).getTime() < 60000;
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <span className="header-icon">🛰️</span>
          <h1>NER Logistics Command Center — Manager Dashboard</h1>
        </div>
        <div className="status-indicator">
          <span
            className="pulse"
            style={{ backgroundColor: connected ? '#22c55e' : '#ef4444' }}
          ></span>
          {connected ? 'Live Connected' : 'Reconnecting...'}
        </div>
      </header>

      {/* Corridor Banner */}
      <div style={{
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 13,
        fontWeight: 700
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#22c55e' }}>🟢 STARTING CITY: <strong>Cooch Behar Depot</strong></span>
          <span style={{ color: '#64748b' }}>➔</span>
          <span style={{ color: '#0284c7' }}>📍 WARNING POINT: <strong>Guwahati Junction</strong></span>
          <span style={{ color: '#64748b' }}>➔</span>
          <span style={{ color: '#22c55e' }}>🟢 DESTINATION CITY: <strong>Silchar Hub</strong></span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ color: isAlternateRoute ? '#ff6b35' : '#00d4ff' }}>
            {isAlternateRoute ? '🔀 Alternate Route via Nagaon-Hojai (Both Routes Displayed)' : '⚠️ Primary Route via Haflong'}
          </span>
        </div>
      </div>

      {/* Incident Alert Banner */}
      {latestIncident && (
        <div style={{
          backgroundColor: '#1e0c0c',
          borderBottom: '2px solid #ef4444',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'pulse-anim 2s infinite alternate'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <span style={{ color: '#ef4444', fontWeight: 800, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                FIELD LANDSLIDE INCIDENT REPORTED AT GUWAHATI
              </span>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 700 }}>
                {latestIncident.hazardName} — Reported by {latestIncident.vehicleId}
              </h3>
              <span style={{ color: '#cbd5e1', fontSize: 12 }}>
                {latestIncident.details} ({new Date(latestIncident.timestamp).toLocaleTimeString()})
              </span>
            </div>
          </div>

          <button
            onClick={() => calculateRoute('alternate')}
            style={{
              backgroundColor: '#ff6b35',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            🔀 Dispatch Alternate Bypass Route to Silchar
          </button>
        </div>
      )}

      <main className="dashboard">
        <aside className="sidebar">
          {/* Stats Overview */}
          <div className="glass-panel">
            <h2 className="section-title">📊 Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon">🚛</span>
                <span className="stat-value">{stats.totalVehicles}</span>
                <span className="stat-label">Vehicles</span>
              </div>
              <div className="stat-card accent">
                <span className="stat-icon">📡</span>
                <span className="stat-value">{stats.activeVehicles}</span>
                <span className="stat-label">Active</span>
              </div>
              <div className="stat-card warning">
                <span className="stat-icon">⚠️</span>
                <span className="stat-value">{stats.hazardZones}</span>
                <span className="stat-label">Hazards</span>
              </div>
              <div className="stat-card danger">
                <span className="stat-icon">🚨</span>
                <span className="stat-value">{incidents.length}</span>
                <span className="stat-label">Incidents</span>
              </div>
            </div>
          </div>

          {/* Route Dispatch Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn-primary"
              onClick={() => calculateRoute('primary')}
              disabled={routeLoading}
              style={{ opacity: !isAlternateRoute ? 1 : 0.7 }}
            >
              {routeLoading ? '⏳ Calculating...' : '⚠️ Show Primary Route (via Haflong)'}
            </button>

            <button
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #ff6b35, #ef4444)',
                boxShadow: isAlternateRoute ? '0 0 16px rgba(255, 107, 53, 0.4)' : 'none'
              }}
              onClick={() => calculateRoute('alternate')}
              disabled={routeLoading}
            >
              🔀 Request Alternate Route (Bypass Haflong Landslide)
            </button>
          </div>

          {routeDistance !== null && (
            <div className="route-info" style={{ backgroundColor: isAlternateRoute ? 'rgba(255, 107, 53, 0.15)' : 'rgba(34, 197, 94, 0.15)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 800, color: isAlternateRoute ? '#ff6b35' : '#22c55e' }}>
                {isAlternateRoute ? '🔀 ALTERNATE BYPASS ROUTE ACTIVE' : '🚚 PRIMARY DIRECT ROUTE ACTIVE'}
              </div>
              <div style={{ fontSize: 12, color: '#f1f5f9', marginTop: 2 }}>
                Distance: {routeDistance.toFixed(1)} km (Cooch Behar ➔ Silchar)
              </div>
              {routeMessage && (
                <div style={{ fontSize: 11, color: isAlternateRoute ? '#ff6b35' : '#94a3b8', marginTop: 4 }}>
                  {routeMessage}
                </div>
              )}
            </div>
          )}

          {/* Fleet Status */}
          <div className="glass-panel">
            <h2 className="section-title">🚛 Active Fleet</h2>
            <div className="vehicle-list">
              {vehicles.map((v) => (
                <div key={v.id} className="vehicle-item">
                  <div className="vehicle-info">
                    <span className="vehicle-name">{v.name}</span>
                    <span className="vehicle-desc">
                      {v.cargo}
                      {v.position ? (
                        <>
                          {' • '}
                          {Math.round(v.position.speed || 0)} km/h
                        </>
                      ) : (
                        ' • Awaiting GPS'
                      )}
                    </span>
                  </div>
                  <div className={`status-dot ${isVehicleActive(v) ? 'active' : 'inactive'}`}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Hazard Zones Panel */}
          <div className="glass-panel">
            <h2 className="section-title">⚠️ Hazard & Blockage Status</h2>
            <div className="hazard-list">
              {hazardZones.map((h) => {
                if (h.lat === 24.8333 && h.lng === 92.7789) return null; // No landslide at Silchar!
                return (
                  <div key={h.id} className="hazard-item" style={{
                    borderLeft: h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? '4px solid #ef4444' : 'none',
                    backgroundColor: h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? 'rgba(239, 68, 68, 0.15)' : undefined
                  }}>
                    <div className="hazard-info">
                      <span className="hazard-name" style={{ color: h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? '#ef4444' : '#fff', fontWeight: h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? 800 : 500 }}>
                        {h.name} {h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? '🚫 (ROAD BLOCKED)' : ''}
                      </span>
                      <div className="risk-bar-container">
                        <div
                          className="risk-bar"
                          style={{
                            width: `${(h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? 1.0 : h.risk) * 100}%`,
                            backgroundColor: h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? '#ef4444' : h.risk >= 0.8 ? '#ef4444' : '#ff6b35'
                          }}
                        ></div>
                      </div>
                    </div>
                    <span className={`hazard-badge ${h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') || h.risk >= 0.8 ? 'high' : 'medium'}`}>
                      {h.status === 'BLOCKED' || (isAlternateRoute && h.id === 'hz9') ? 'BLOCKED' : h.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="map-container">
          <MapView vehicles={vehicles} hazardZones={hazardZones} route={route} isAlternate={isAlternateRoute} />
        </div>
      </main>
    </div>
  );
}
