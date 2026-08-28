'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading map...</div>,
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
}

interface Stats {
  totalVehicles: number;
  activeVehicles: number;
  hazardZones: number;
  totalGpsLogs: number;
  uptime?: number;
}

interface SmsLog {
  vehicleId: string;
  lat: number;
  lng: number;
  status: string;
  timestamp: string;
}

const API_BASE = 'http://localhost:3000';

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hazardZones, setHazardZones] = useState<HazardZone[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalVehicles: 0,
    activeVehicles: 0,
    hazardZones: 0,
    totalGpsLogs: 0,
  });
  const [connected, setConnected] = useState(false);
  const [route, setRoute] = useState<{ lat: number; lng: number }[][] | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      /* server may not be up yet */
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [vehRes, hazRes] = await Promise.all([
          fetch(`${API_BASE}/api/vehicles`),
          fetch(`${API_BASE}/api/hazard-zones`),
        ]);
        if (vehRes.ok) setVehicles(await vehRes.json());
        if (hazRes.ok) setHazardZones(await hazRes.json());
        fetchStats();
      } catch {
        console.log('Backend not reachable yet, retrying...');
        setTimeout(fetchInitialData, 3000);
      }
    };

    fetchInitialData();
    const statsInterval = setInterval(fetchStats, 5000);

    let eventSource: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connectSSE = () => {
      eventSource = new EventSource(`${API_BASE}/api/stream`);

      eventSource.onopen = () => setConnected(true);

      eventSource.addEventListener('init', (e) => {
        try {
          const data = JSON.parse(e.data);
          setVehicles(data);
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

      eventSource.addEventListener('sms_update', (e) => {
        const data = JSON.parse(e.data);
        setSmsLogs((prev) =>
          [
            {
              vehicleId: data.vehicleId,
              lat: data.lat,
              lng: data.lng,
              status: data.status || 'offline',
              timestamp: data.timestamp,
            },
            ...prev,
          ].slice(0, 20)
        );

        setVehicles((prev) =>
          prev.map((v) =>
            v.id === data.vehicleId
              ? {
                  ...v,
                  position: {
                    lat: data.lat,
                    lng: data.lng,
                    timestamp: data.timestamp,
                    status: data.status,
                    source: 'sms',
                  },
                }
              : v
          )
        );
      });

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        retryTimeout = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      clearInterval(statsInterval);
      clearTimeout(retryTimeout);
      eventSource?.close();
    };
  }, [fetchStats]);

  const calculateRoute = async () => {
    setRouteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depot: { id: 'Guwahati', lat: 26.1445, lng: 91.7362, demand: 0 },
          customers: [
            { id: 'Shillong', lat: 25.5783, lng: 91.8933, demand: 20 },
            { id: 'Tezpur', lat: 26.6500, lng: 92.7000, demand: 25 },
            { id: 'Dimapur', lat: 25.7100, lng: 93.7400, demand: 30 },
            { id: 'Itanagar', lat: 27.0844, lng: 93.6100, demand: 15 },
            { id: 'Silchar', lat: 24.8333, lng: 92.7789, demand: 20 },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.waypoints && data.waypoints.length > 0) {
          setRoute(data.waypoints.map((wp: { lat: number; lng: number }[]) =>
            wp.map((p) => ({ lat: p.lat, lng: p.lng }))
          ));
          setRouteDistance(data.total_distance_km);
        }
      }
    } catch (e) {
      console.error('Failed to calculate route', e);
    }
    setRouteLoading(false);
  };

  const isVehicleActive = (v: Vehicle) => {
    if (!v.position?.timestamp) return false;
    return Date.now() - new Date(v.position.timestamp).getTime() < 60000;
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return '--';
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <span className="header-icon">🛰️</span>
          <h1>NER Logistics Command Center</h1>
        </div>
        <div className="status-indicator">
          <span
            className="pulse"
            style={{
              backgroundColor: connected ? '#22c55e' : '#ef4444',
            }}
          ></span>
          {connected ? 'Live Connected' : 'Reconnecting...'}
        </div>
      </header>

      <main className="dashboard">
        <aside className="sidebar">
          {/* Stats Grid */}
          <div className="glass-panel">
            <h2 className="section-title">📊 Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon">🚛</span>
                <span className="stat-value">{stats.totalVehicles}</span>
                <span className="stat-label">Total Vehicles</span>
              </div>
              <div className="stat-card accent">
                <span className="stat-icon">📡</span>
                <span className="stat-value">{stats.activeVehicles}</span>
                <span className="stat-label">Active Now</span>
              </div>
              <div className="stat-card warning">
                <span className="stat-icon">⚠️</span>
                <span className="stat-value">{stats.hazardZones}</span>
                <span className="stat-label">Hazard Zones</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">📍</span>
                <span className="stat-value">{stats.totalGpsLogs}</span>
                <span className="stat-label">GPS Logs</span>
              </div>
            </div>
          </div>

          {/* Route Button */}
          <button
            className="btn-primary"
            onClick={calculateRoute}
            disabled={routeLoading}
          >
            {routeLoading ? '⏳ Calculating...' : '🗺️ Calculate Optimal Routes'}
          </button>
          {routeDistance !== null && (
            <div className="route-info">
              ✅ Route: {routeDistance.toFixed(1)} km total
            </div>
          )}

          {/* Fleet List */}
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
                          {v.position.source === 'sms' && (
                            <span className="sms-badge">SMS</span>
                          )}
                        </>
                      ) : (
                        ' • Awaiting GPS'
                      )}
                    </span>
                    {v.position && (
                      <span className="vehicle-coords">
                        ({v.position.lat.toFixed(4)}, {v.position.lng.toFixed(4)})
                        {' · '}
                        {formatTime(v.position.timestamp)}
                      </span>
                    )}
                  </div>
                  <div
                    className={`status-dot ${isVehicleActive(v) ? 'active' : 'inactive'}`}
                  ></div>
                </div>
              ))}
            </div>
          </div>

          {/* Hazard Alerts */}
          <div className="glass-panel">
            <h2 className="section-title">⚠️ Hazard Alerts</h2>
            <div className="hazard-list">
              {hazardZones.map((h) => (
                <div key={h.id} className="hazard-item">
                  <div className="hazard-info">
                    <span className="hazard-name">{h.name}</span>
                    <div className="risk-bar-container">
                      <div
                        className="risk-bar"
                        style={{
                          width: `${h.risk * 100}%`,
                          backgroundColor:
                            h.risk >= 0.8
                              ? '#ef4444'
                              : h.risk >= 0.7
                              ? '#ff6b35'
                              : '#facc15',
                        }}
                      ></div>
                    </div>
                  </div>
                  <span
                    className={`hazard-badge ${
                      h.risk >= 0.8
                        ? 'high'
                        : h.risk >= 0.7
                        ? 'medium'
                        : 'low'
                    }`}
                  >
                    {h.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SMS Failsafe Logs */}
          {smsLogs.length > 0 && (
            <div className="glass-panel">
              <h2 className="section-title">📱 SMS Failsafe Log</h2>
              <div className="sms-log-list">
                {smsLogs.map((log, i) => (
                  <div key={i} className="sms-log-item">
                    <span className="sms-vehicle">{log.vehicleId}</span>
                    <span className="sms-status">{log.status}</span>
                    <span className="sms-time">{formatTime(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className="map-container">
          <MapView vehicles={vehicles} hazardZones={hazardZones} route={route} />
        </div>
      </main>
    </div>
  );
}
