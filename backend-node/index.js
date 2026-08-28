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
const vehiclePositions = new Map(); // vehicleId -> {lat, lng, speed, heading, timestamp}
const gpsLogs = [];                 // array of all GPS log entries
const sseClients = new Set();       // active SSE connections
const hazardZones = [               // NER hazard zones
  { id: 'hz1', name: 'Jaintia Hills Landslide Zone', lat: 25.35, lng: 92.20, radius_km: 15, risk: 0.85, type: 'landslide' },
  { id: 'hz2', name: 'Kaziranga Flood Zone', lat: 26.58, lng: 93.17, radius_km: 20, risk: 0.90, type: 'flood' },
  { id: 'hz3', name: 'Barak Valley Flood Zone', lat: 24.82, lng: 92.78, radius_km: 18, risk: 0.75, type: 'flood' },
  { id: 'hz4', name: 'Naga Hills Landslide Zone', lat: 25.67, lng: 94.12, radius_km: 12, risk: 0.80, type: 'landslide' },
  { id: 'hz5', name: 'Arunachal Avalanche Zone', lat: 27.10, lng: 93.62, radius_km: 25, risk: 0.70, type: 'avalanche' },
  { id: 'hz6', name: 'Manipur Landslide Zone', lat: 24.80, lng: 93.95, radius_km: 14, risk: 0.82, type: 'landslide' },
  { id: 'hz7', name: 'Mizoram Flood Zone', lat: 23.16, lng: 92.94, radius_km: 16, risk: 0.65, type: 'flood' },
  { id: 'hz8', name: 'Sikkim Landslide Zone', lat: 27.53, lng: 88.51, radius_km: 20, risk: 0.88, type: 'landslide' }
];

const vehicles = [
  { id: 'TRUCK-NER-01', name: 'Medical Supply Truck', cargo: 'Medicines', capacity: 100, status: 'active' },
  { id: 'TRUCK-NER-02', name: 'Food Relief Truck', cargo: 'Food Supplies', capacity: 150, status: 'active' },
  { id: 'TRUCK-NER-03', name: 'Construction Materials', cargo: 'Building Materials', capacity: 200, status: 'active' }
];

// Helper to broadcast to SSE clients
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
  if (!client) return; // internal messages

  const topic = packet.topic;
  if (topic.startsWith('gps/')) {
    const vehicleId = topic.split('/')[1];
    if (vehicleId) {
      try {
        const payload = JSON.parse(packet.payload.toString());
        const { lat, lng, speed, heading, timestamp } = payload;
        
        const posData = { lat, lng, speed, heading, timestamp: timestamp || Date.now() };
        vehiclePositions.set(vehicleId, posData);
        
        const logEntry = { vehicleId, ...posData };
        gpsLogs.push(logEntry);
        
        broadcastSSE('gps_update', logEntry);
        
        console.log(`[MQTT] Vehicle ${vehicleId} at (${lat}, ${lng})`);
      } catch (err) {
        console.error(`[MQTT] Failed to parse payload for ${vehicleId}:`, err);
      }
    }
  }
});

// Express Endpoints
app.post('/api/route', (req, res) => {
  const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/calculate_route',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
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
    console.error(`Problem with request: ${e.message}`);
    res.status(500).json({ error: e.message });
  });

  proxyReq.write(JSON.stringify(req.body));
  proxyReq.end();
});

app.post('/api/sms-webhook', (req, res) => {
  const { From, Body } = req.body;
  if (!Body) {
    return res.status(400).json({ error: 'Missing Body' });
  }

  // Body format: vehicleId|lat|lng|timestamp|status
  const parts = Body.split('|');
  if (parts.length >= 4) {
    const vehicleId = parts[0];
    const lat = parseFloat(parts[1]);
    const lng = parseFloat(parts[2]);
    const timestamp = parts[3] || new Date().toISOString();
    const status = parts[4] || 'active';

    const posData = { lat, lng, timestamp, status, source: 'sms' };
    vehiclePositions.set(vehicleId, posData);
    
    const logEntry = { vehicleId, ...posData };
    gpsLogs.push(logEntry);
    
    broadcastSSE('sms_update', logEntry);
    
    console.log(`[SMS] Webhook received for ${vehicleId} at (${lat}, ${lng})`);
    return res.json({ status: 'received', parsed: logEntry });
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

app.get('/api/gps-logs', (req, res) => {
  // last 100 entries, newest first
  const latestLogs = gpsLogs.slice(-100).reverse();
  res.json(latestLogs);
});

app.get('/api/stats', (req, res) => {
  const now = Date.now();
  let activeVehicles = 0;
  for (const pos of vehiclePositions.values()) {
    // Check if position was updated in the last 60 seconds
    const posTime = typeof pos.timestamp === 'string' ? new Date(pos.timestamp).getTime() : pos.timestamp;
    if (now - posTime < 60000) {
      activeVehicles++;
    }
  }

  res.json({
    totalVehicles: vehicles.length,
    activeVehicles,
    hazardZones: hazardZones.length,
    totalGpsLogs: gpsLogs.length,
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

  // Send initial data
  const mergedVehicles = vehicles.map(v => {
    const position = vehiclePositions.get(v.id) || null;
    return { ...v, position };
  });
  res.write(`event: init\ndata: ${JSON.stringify(mergedVehicles)}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Keepalive ping for SSE
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
