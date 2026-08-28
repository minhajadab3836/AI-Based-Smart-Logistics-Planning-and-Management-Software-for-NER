export interface GPSPosition {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface HazardZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_km: number;
  risk: number;
  type: string;
}

export interface HazardAlert {
  zone: HazardZone;
  distanceKm: number;
  level: 'warning' | 'critical';
}

export interface OfflineGpsTick {
  id: string;
  vehicleId: string;
  position: GPSPosition;
  status: string;
  smsPayload: string;
  createdAt: string;
}

export interface VehicleRoute {
  id: string;
  name: string;
  depotName: string;
  destinationName: string;
  totalDistanceKm: number;
  waypoints: { lat: number; lng: number }[];
}

export type NetworkMode = '4G' | 'OFFLINE_SMS' | 'DISCONNECTED';
