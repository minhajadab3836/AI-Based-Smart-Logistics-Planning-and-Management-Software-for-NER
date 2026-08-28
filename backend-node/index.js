const express = require('express');
const { Aedes } = require('aedes');
const aedes = new Aedes();
const server = require('net').createServer(aedes.handle);
const redis = require('redis');
const { Client } = require('pg');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis Setup
const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
redisClient.connect().then(() => console.log('Redis connected')).catch(console.error);

// Postgres Setup
const pgClient = new Client({ connectionString: 'postgresql://admin:password@localhost:5432/logistics' });
pgClient.connect().then(() => console.log('Postgres connected')).catch(console.error);

// --- APIs ---

// 1. Forward to Python PyVRP
app.post('/api/route', async (req, res) => {
    try {
        const response = await fetch('http://localhost:8000/calculate_route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Python service down', details: e.message });
    }
});

// 2. Zero-Network SMS Webhook (Twilio)
app.post('/api/twilio/sms', async (req, res) => {
    // Mock payload: "TRUCK_123,LAT:26.1,LNG:91.7,HAZARD:LANDSLIDE"
    console.log('Zero-Network SMS Received:', req.body);
    
    const body = req.body.Body || req.body.body || '';
    const parts = body.split(',');
    
    if (parts.length >= 4) {
        const truckId = parts[0];
        const lat = parseFloat(parts[1].split(':')[1]);
        const lng = parseFloat(parts[2].split(':')[1]);
        const hazard = parts[3].split(':')[1];
        
        // Publish to dashboard via Redis PubSub
        await redisClient.publish('dashboard-events', JSON.stringify({
            type: 'ZERO_NETWORK_HAZARD',
            truckId, lat, lng, hazard,
            timestamp: Date.now()
        }));
    }
    
    // Twilio expects XML response
    res.set('Content-Type', 'text/xml');
    res.status(200).send('<Response></Response>'); 
});

// --- Live 4G MQTT Tracking ---
aedes.on('publish', async (packet, client) => {
    if (client) {
        const msg = packet.payload.toString();
        console.log(`4G MQTT Tick [${client.id}]:`, msg);
        try {
            await redisClient.set(`truck:${client.id}`, msg);
            await redisClient.publish('dashboard-events', JSON.stringify({
                type: 'LIVE_LOCATION',
                truckId: client.id,
                data: JSON.parse(msg)
            }));
        } catch (e) {
            console.error('MQTT parsing error:', e.message);
        }
    }
});

const HTTP_PORT = 3000;
const MQTT_PORT = 1883;

app.listen(HTTP_PORT, () => console.log(`Node Express API on port ${HTTP_PORT}`));
server.listen(MQTT_PORT, () => console.log(`MQTT Broker on port ${MQTT_PORT}`));
