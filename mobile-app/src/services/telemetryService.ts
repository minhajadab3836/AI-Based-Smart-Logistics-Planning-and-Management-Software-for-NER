import { GPSPosition, OfflineGpsTick, NetworkMode } from '../types';

export class TelemetryService {
  private vehicleId: string;
  private backendUrl: string;
  private offlineQueue: OfflineGpsTick[] = [];
  private onQueueChange?: (queue: OfflineGpsTick[]) => void;

  constructor(vehicleId: string = 'TRUCK-NER-01', backendUrl: string = 'http://localhost:3000') {
    this.vehicleId = vehicleId;
    this.backendUrl = backendUrl;
  }

  setQueueChangeListener(listener: (queue: OfflineGpsTick[]) => void) {
    this.onQueueChange = listener;
  }

  getQueue(): OfflineGpsTick[] {
    return [...this.offlineQueue];
  }

  clearQueue() {
    this.offlineQueue = [];
    if (this.onQueueChange) this.onQueueChange(this.getQueue());
  }

  createSmsPayload(pos: GPSPosition, status: string = 'active'): string {
    // Format: vehicleId|lat|lng|timestamp|status
    return `${this.vehicleId}|${pos.lat.toFixed(4)}|${pos.lng.toFixed(4)}|${pos.timestamp}|${status}`;
  }

  async sendTelemetry(pos: GPSPosition, mode: NetworkMode, status: string = 'active'): Promise<boolean> {
    const smsPayload = this.createSmsPayload(pos, status);

    if (mode === '4G') {
      try {
        // Publish telemetry via REST to Node.js backend
        const res = await fetch(`${this.backendUrl}/api/sms-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            From: '+917002001001',
            Body: smsPayload
          })
        });
        if (res.ok) {
          // If we had queued offline items, flush them
          if (this.offlineQueue.length > 0) {
            this.flushOfflineQueue();
          }
          return true;
        }
      } catch (err) {
        console.warn('Network send failed, switching to offline queue', err);
      }
    }

    // Offline / SMS Failsafe Mode: Queue locally
    const tick: OfflineGpsTick = {
      id: Math.random().toString(36).substring(2, 9),
      vehicleId: this.vehicleId,
      position: pos,
      status,
      smsPayload,
      createdAt: new Date().toLocaleTimeString()
    };

    this.offlineQueue.unshift(tick);
    if (this.offlineQueue.length > 50) this.offlineQueue.pop();

    if (this.onQueueChange) this.onQueueChange(this.getQueue());

    // Trigger SMS payload transmission simulation to backend webhook
    if (mode === 'OFFLINE_SMS') {
      this.sendSmsPayload(smsPayload);
    }

    return false;
  }

  async sendSmsPayload(payload: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/api/sms-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: '+917002001001',
          Body: payload
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async flushOfflineQueue() {
    const queue = [...this.offlineQueue];
    for (const tick of queue) {
      await this.sendSmsPayload(tick.smsPayload);
    }
    this.clearQueue();
  }
}
