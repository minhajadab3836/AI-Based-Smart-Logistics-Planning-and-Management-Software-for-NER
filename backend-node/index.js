const express = require('express');
const cors = require('cors');
const aedes = require('aedes')();
const net = require('net');
const http = require('http');

const PORT = 3000;
const MQTT_PORT = 1883;

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-Memory Data Stores
const vehiclePositions = new Map();
const gpsLogs = [];
const reportedIncidents = [];
const sseClients = new Set();
let activeAvoidHazards = [];

const hazardZones = [
  { id: 'hz9', name: 'Haflong Landslide Zone', lat: 25.18, lng: 93.01, radius_km: 15, risk: 0.88, type: 'landslide', status: 'active' },
  { id: 'hz1', name: 'Jaintia Hills Landslide Zone', lat: 25.35, lng: 92.20, radius_km: 15, risk: 0.85, type: 'landslide', status: 'active' },
  { id: 'hz2', name: 'Kaziranga Flood Zone', lat: 26.58, lng: 93.17, radius_km: 20, risk: 0.90, type: 'flood', status: 'active' },
  { id: 'hz3', name: 'Barak Valley Flood Zone', lat: 24.82, lng: 92.78, radius_km: 18, risk: 0.75, type: 'flood', status: 'active' },
  { id: 'hz4', name: 'Naga Hills Landslide Zone', lat: 25.67, lng: 94.12, radius_km: 12, risk: 0.80, type: 'landslide', status: 'active' },
  { id: 'hz5', name: 'Arunachal Avalanche Zone', lat: 27.10, lng: 93.62, radius_km: 25, risk: 0.70, type: 'avalanche', status: 'active' },
  { id: 'hz6', name: 'Manipur Landslide Zone', lat: 24.80, lng: 93.95, radius_km: 14, risk: 0.82, type: 'landslide', status: 'active' },
  { id: 'hz7', name: 'Mizoram Flood Zone', lat: 23.16, lng: 92.94, radius_km: 16, risk: 0.65, type: 'flood', status: 'active' },
  { id: 'hz8', name: 'Sikkim Landslide Zone', lat: 27.53, lng: 88.51, radius_km: 20, risk: 0.88, type: 'landslide', status: 'active' }
];

const vehicles = [
  { id: 'TRUCK-NER-01', name: 'Medical Supply Truck', cargo: 'Medicines', capacity: 100, status: 'active' },
  { id: 'TRUCK-NER-02', name: 'Food Relief Truck', cargo: 'Food Supplies', capacity: 150, status: 'active' },
  { id: 'TRUCK-NER-03', name: 'Construction Materials', cargo: 'Building Materials', capacity: 200, status: 'active' }
];

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

// MQTT Broker Setup
const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(MQTT_PORT, () => {
  console.log(`[MQTT] Aedes broker running on port ${MQTT_PORT}`);
});

aedes.on('publish', function (packet, client) {
  if (!client) return;
  const topic = packet.topic;
  if (topic.startsWith('gps/')) {
    const vehicleId = topic.split('/')[1];
    if (vehicleId) {
      try {
        const payload = JSON.parse(packet.payload.toString());
        const { lat, lng, speed, heading, timestamp } = payload;
        const posData = { lat, lng, speed, heading, timestamp: timestamp || Date.now() };
        vehiclePositions.set(vehicleId, posData);
        gpsLogs.push({ vehicleId, ...posData });
        broadcastSSE('gps_update', { vehicleId, ...posData });
      } catch (err) {
        console.error(`[MQTT] Error parsing payload:`, err);
      }
    }
  }
});

// Calculate Route Proxy Endpoint
app.post('/api/route', (req, res) => {
  const payload = {
    ...req.body,
    avoid_hazards: req.body.avoid_hazards || activeAvoidHazards,
    request_type: req.body.request_type || (activeAvoidHazards.length > 0 ? "alternate" : "primary")
  };

  const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/calculate_route',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', (chunk) => { data += chunk; });
    proxyRes.on('end', () => {
      try {
        res.status(proxyRes.statusCode).json(JSON.parse(data));
      } catch (e) {
        res.status(proxyRes.statusCode).send(data);
      }
    });
  });

  proxyReq.on('error', (e) => {
    res.status(500).json({ error: e.message });
  });

  proxyReq.write(JSON.stringify(payload));
  proxyReq.end();
});

// Explicit Incident Reporting Endpoint
app.post('/api/report-incident', (req, res) => {
  const { vehicleId, hazardName, type, lat, lng, details } = req.body;
  const incident = {
    id: 'inc-' + Date.now(),
    vehicleId: vehicleId || 'TRUCK-NER-01',
    hazardName: hazardName || 'Haflong Landslide Zone',
    type: type || 'landslide',
    lat: lat || 25.18,
    lng: lng || 93.01,
    details: details || 'Severe Landslide at Haflong blocking Guwahati -> Silchar corridor!',
    timestamp: new Date().toISOString()
  };

  reportedIncidents.unshift(incident);

  // Mark Haflong as BLOCKED (100% Risk)
  const zone = hazardZones.find(h => h.id === 'hz9' || h.name.toLowerCase().includes('haflong'));
  if (zone) {
    zone.risk = 1.0;
    zone.status = 'BLOCKED';
  }

  if (!activeAvoidHazards.includes('Haflong')) {
    activeAvoidHazards.push('Haflong');
  }

  broadcastSSE('incident_reported', incident);
  broadcastSSE('hazard_update', hazardZones);

  console.log(`[INCIDENT REPORTED] ${incident.hazardName} by ${incident.vehicleId}`);

  return res.json({
    status: 'success',
    message: `Landslide incident logged at Haflong. Road segment marked BLOCKED.`,
    incident,
    avoid_hazards: activeAvoidHazards
  });
});

app.post('/api/sms-webhook', (req, res) => {
  const { From, Body } = req.body;
  if (!Body) return res.status(400).json({ error: 'Missing Body' });

  const parts = Body.split('|');
  if (parts.length >= 4) {
    const vehicleId = parts[0];
    const lat = parseFloat(parts[1]);
    const lng = parseFloat(parts[2]);
    const timestamp = parts[3] || new Date().toISOString();
    const status = parts[4] || 'active';

    const posData = { lat, lng, timestamp, status, source: 'sms' };
    vehiclePositions.set(vehicleId, posData);
    gpsLogs.push({ vehicleId, ...posData });

    if (status.includes('hazard') || status.includes('landslide')) {
      const incident = {
        id: 'inc-' + Date.now(),
        vehicleId,
        hazardName: 'Haflong Landslide Zone',
        type: 'landslide',
        lat: 25.18,
        lng: 93.01,
        details: `SMS Failsafe Incident Report: Landslide at Haflong (${status})`,
        timestamp
      };

      reportedIncidents.unshift(incident);

      const zone = hazardZones.find(h => h.id === 'hz9' || h.name.toLowerCase().includes('haflong'));
      if (zone) {
        zone.risk = 1.0;
        zone.status = 'BLOCKED';
      }

      if (!activeAvoidHazards.includes('Haflong')) {
        activeAvoidHazards.push('Haflong');
      }

      broadcastSSE('incident_reported', incident);
      broadcastSSE('hazard_update', hazardZones);
    } else {
      broadcastSSE('sms_update', { vehicleId, ...posData });
    }

    return res.json({ status: 'received', parsed: { vehicleId, ...posData } });
  } else {
    return res.status(400).json({ error: 'Invalid Body format' });
  }
});

app.get('/api/vehicles', (req, res) => {
  const mergedVehicles = vehicles.map(v => {
    const position = vehiclePositions.get(v.id) || null;
    return { ...v, position };
  });
  res.json(mergedVehicles);
});

app.get('/api/hazard-zones', (req, res) => {
  res.json(hazardZones);
});

app.get('/api/incidents', (req, res) => {
  res.json(reportedIncidents);
});

app.get('/api/stats', (req, res) => {
  const now = Date.now();
  let activeVehicles = 0;
  for (const pos of vehiclePositions.values()) {
    const posTime = typeof pos.timestamp === 'string' ? new Date(pos.timestamp).getTime() : pos.timestamp;
    if (now - posTime < 60000) activeVehicles++;
  }

  res.json({
    totalVehicles: vehicles.length,
    activeVehicles,
    hazardZones: hazardZones.length,
    totalGpsLogs: gpsLogs.length,
    reportedIncidents: reportedIncidents.length,
    blockedRoads: activeAvoidHazards.length,
    uptime: process.uptime()
  });
});

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const mergedVehicles = vehicles.map(v => {
    const position = vehiclePositions.get(v.id) || null;
    return { ...v, position };
  });
  res.write(`event: init\ndata: ${JSON.stringify(mergedVehicles)}\n\n`);

  if (reportedIncidents.length > 0) {
    res.write(`event: incident_reported\ndata: ${JSON.stringify(reportedIncidents[0])}\n\n`);
  }

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

setInterval(() => {
  for (const client of sseClients) {
    client.write(`event: ping\ndata: {"time":${Date.now()}}\n\n`);
  }
}, 15000);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'node-backend',
    mqtt: 'running',
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`[Express] Node.js backend listening on port ${PORT}`);
});
