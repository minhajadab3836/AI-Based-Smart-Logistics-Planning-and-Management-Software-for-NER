import React from 'react';
import { GPSPosition, NetworkMode } from '../types';

interface NavigationHUDProps {
  currentPos: GPSPosition;
  mode: NetworkMode;
  onModeChange: (mode: NetworkMode) => void;
  onReroute: () => void;
  onSos: () => void;
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  currentPos,
  mode,
  onModeChange,
  onReroute,
  onSos
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      backgroundColor: '#0f172a',
      padding: 16,
      borderRadius: 16,
      border: '1px solid #1e293b'
    }}>
      {/* Top Header & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
            DISPATCHED VEHICLE
          </span>
          <h2 style={{ margin: '2px 0 0', fontSize: 18, color: '#f8fafc', fontWeight: 800 }}>
            🚛 TRUCK-NER-01
          </h2>
        </div>

        {/* Network Mode Switcher Badges */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['4G', 'OFFLINE_SMS', 'DISCONNECTED'] as const).map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              style={{
                backgroundColor: mode === m
                  ? (m === '4G' ? '#22c55e' : m === 'OFFLINE_SMS' ? '#ff6b35' : '#ef4444')
                  : '#1e293b',
                color: mode === m ? '#000' : '#94a3b8',
                border: 'none',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {m === '4G' ? '⚡ 4G/3G' : m === 'OFFLINE_SMS' ? '📱 SMS FAILSAFE' : '❌ OFFLINE'}
            </button>
          ))}
        </div>
      </div>

      {/* Speedometer & Live Gauges */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10
      }}>
        {/* Speedometer */}
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: '1px solid #334155'
        }}>
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>SPEED</span>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#00d4ff', lineHeight: 1.2 }}>
            {Math.round(currentPos.speed)}
          </span>
          <span style={{ fontSize: 10, color: '#64748b' }}>KM/H</span>
        </div>

        {/* Heading */}
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: '1px solid #334155'
        }}>
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>HEADING</span>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#a855f7', lineHeight: 1.2 }}>
            {Math.round(currentPos.heading)}°
          </span>
          <span style={{ fontSize: 10, color: '#64748b' }}>COMPASS</span>
        </div>

        {/* Coordinates */}
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #334155'
        }}>
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>GPS LOCATION</span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#22c55e', fontWeight: 700, marginTop: 4 }}>
            {currentPos.lat.toFixed(4)} N
          </span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#22c55e', fontWeight: 700 }}>
            {currentPos.lng.toFixed(4)} E
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button
          onClick={onReroute}
          style={{
            backgroundColor: '#00d4ff',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '12px',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          🔄 Request AI Reroute
        </button>

        <button
          onClick={onSos}
          style={{
            backgroundColor: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          🚨 SOS Emergency Alert
        </button>
      </div>
    </div>
  );
};
