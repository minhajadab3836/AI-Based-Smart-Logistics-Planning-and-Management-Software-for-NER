import { GPSPosition, HazardZone, HazardAlert } from '../types';

export const NER_HAZARD_ZONES: HazardZone[] = [
  { id: 'hz1', name: 'Jaintia Hills Landslide Zone', lat: 25.35, lng: 92.20, radius_km: 15, risk: 0.85, type: 'landslide' },
  { id: 'hz2', name: 'Kaziranga Flood Zone', lat: 26.58, lng: 93.17, radius_km: 20, risk: 0.90, type: 'flood' },
  { id: 'hz4', name: 'Naga Hills Landslide Zone', lat: 25.67, lng: 94.12, radius_km: 12, risk: 0.80, type: 'landslide' },
  { id: 'hz5', name: 'Arunachal Avalanche Zone', lat: 27.10, lng: 93.62, radius_km: 25, risk: 0.70, type: 'avalanche' },
  { id: 'hz6', name: 'Manipur Landslide Zone', lat: 24.80, lng: 93.95, radius_km: 14, risk: 0.82, type: 'landslide' },
  { id: 'hz7', name: 'Mizoram Flood Zone', lat: 23.16, lng: 92.94, radius_km: 16, risk: 0.65, type: 'flood' },
  { id: 'hz8', name: 'Sikkim Landslide Zone', lat: 27.53, lng: 88.51, radius_km: 20, risk: 0.88, type: 'landslide' }
];

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function checkHazardProximity(pos: GPSPosition): HazardAlert | null {
  for (const zone of NER_HAZARD_ZONES) {
    const distKm = haversineDistance(pos.lat, pos.lng, zone.lat, zone.lng);
    if (distKm <= zone.radius_km) {
      const level: 'warning' | 'critical' = distKm <= (zone.radius_km * 0.5) || zone.risk >= 0.85 ? 'critical' : 'warning';
      return {
        zone,
        distanceKm: Math.round(distKm * 10) / 10,
        level
      };
    }
  }
  return null;
}
