import React from 'react';
import { HazardAlert } from '../types';

interface HazardAlertModalProps {
  alert: HazardAlert | null;
  onDismiss: () => void;
  onRerouteRequest: () => void;
}

export const HazardAlertModal: React.FC<HazardAlertModalProps> = ({
  alert,
  onDismiss,
  onRerouteRequest
}) => {
  if (!alert) return null;

  const isCritical = alert.level === 'critical';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        backgroundColor: isCritical ? '#1e1010' : '#1e1710',
        border: `2px solid ${isCritical ? '#ef4444' : '#ff6b35'}`,
        borderRadius: 16,
        padding: 24,
        maxWidth: 400,
        width: '100%',
        boxShadow: `0 0 40px ${isCritical ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 107, 53, 0.4)'}`,
        animation: 'alert-pulse 1s infinite alternate'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 36 }}>{alert.zone.type === 'flood' ? '🌊' : alert.zone.type === 'landslide' ? '⛰️' : '❄️'}</span>
          <div>
            <span style={{
              display: 'inline-block',
              backgroundColor: isCritical ? '#ef4444' : '#ff6b35',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: 1
            }}>
              {isCritical ? 'CRITICAL HAZARD WARNING' : 'HAZARD PROXIMITY ALERT'}
            </span>
            <h2 style={{ color: '#fff', margin: '4px 0 0', fontSize: 20, fontWeight: 700 }}>
              {alert.zone.name}
            </h2>
          </div>
        </div>

        <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
          You are <strong style={{ color: isCritical ? '#ef4444' : '#ff6b35' }}>{alert.distanceKm} km</strong> away from a known high-risk <strong>{alert.zone.type}</strong> zone (Risk score: {Math.round(alert.zone.risk * 100)}%).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onRerouteRequest}
            style={{
              backgroundColor: '#00d4ff',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔄 Request AI Dynamic Reroute
          </button>

          <button
            onClick={onDismiss}
            style={{
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Dismiss & Proceed Carefully
          </button>
        </div>
      </div>
    </div>
  );
};
