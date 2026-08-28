import React, { useState } from 'react';
import { OfflineGpsTick, GPSPosition } from '../types';

interface OfflineSmsPanelProps {
  queue: OfflineGpsTick[];
  currentPos: GPSPosition;
  onSendSms: (payload: string) => Promise<boolean>;
  onClearQueue: () => void;
}

export const OfflineSmsPanel: React.FC<OfflineSmsPanelProps> = ({
  queue,
  currentPos,
  onSendSms,
  onClearQueue
}) => {
  const [reportType, setReportType] = useState<'landslide' | 'flood' | 'accident' | 'road_blocked'>('landslide');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleReportHazard = async () => {
    setSending(true);
    setStatusMsg(null);

    // Format: vehicleId|lat|lng|timestamp|status
    const payload = `TRUCK-NER-01|${currentPos.lat.toFixed(4)}|${currentPos.lng.toFixed(4)}|${new Date().toISOString()}|hazard_${reportType}`;
    const success = await onSendSms(payload);

    setSending(false);
    if (success) {
      setStatusMsg(`✅ SMS payload transmitted to server for ${reportType.toUpperCase()}`);
    } else {
      setStatusMsg(`📡 Queued in local store-and-forward buffer`);
    }
  };

  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 12,
      padding: 16,
      color: '#f8fafc'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>📱</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ff6b35' }}>
            Zero-Network SMS Failsafe
          </h3>
        </div>
        <span style={{
          backgroundColor: queue.length > 0 ? '#ff6b35' : '#1e293b',
          color: queue.length > 0 ? '#000' : '#94a3b8',
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 12
        }}>
          {queue.length} Queued
        </span>
      </div>

      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
        When cellular internet is unavailable in NER dead zones, GPS logs are compressed into 160-char SMS payloads and sent via cellular network.
      </p>

      {/* Manual Hazard Reporting */}
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12
      }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 6 }}>
          REPORT FIELD INCIDENT VIA SMS FAILSAFE
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['landslide', 'flood', 'accident', 'road_blocked'] as const).map(t => (
            <button
              key={t}
              onClick={() => setReportType(t)}
              style={{
                backgroundColor: reportType === t ? '#ff6b35' : '#0f172a',
                color: reportType === t ? '#000' : '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          onClick={handleReportHazard}
          disabled={sending}
          style={{
            width: '100%',
            backgroundColor: '#ff6b35',
            color: '#000',
            border: 'none',
            borderRadius: 6,
            padding: '10px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {sending ? 'Sending SMS...' : `📤 Send SMS Incident Report (${reportType.toUpperCase()})`}
        </button>

        {statusMsg && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#22c55e', fontWeight: 600 }}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* SMS Queue Items */}
      {queue.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>RECENT STORED PAYLOADS</span>
            <button
              onClick={onClearQueue}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
            >
              Clear Buffer
            </button>
          </div>

          <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue.slice(0, 5).map(item => (
              <div key={item.id} style={{
                backgroundColor: '#1e293b',
                padding: '6px 8px',
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 10,
                color: '#ff6b35',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>{item.smsPayload}</span>
                <span style={{ color: '#64748b' }}>{item.createdAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
