const mqtt = require('mqtt');

// NER waypoints for 3 truck routes
const ROUTES = {
  'TRUCK-NER-01': {
    name: 'Medical Supply Truck (Guwahati → Shillong → Jowai)',
    waypoints: [
      { lat: 26.1445, lng: 91.7362 }, // Guwahati
      { lat: 26.1200, lng: 91.7800 },
      { lat: 26.0800, lng: 91.8200 },
      { lat: 26.0300, lng: 91.8600 },
      { lat: 25.9800, lng: 91.8800 },
      { lat: 25.9400, lng: 91.8900 },
      { lat: 25.8900, lng: 91.8950 },
      { lat: 25.8400, lng: 91.8900 },
      { lat: 25.7800, lng: 91.8800 },
      { lat: 25.7200, lng: 91.8850 },
      { lat: 25.6800, lng: 91.8900 },
      { lat: 25.6200, lng: 91.8950 },
      { lat: 25.5783, lng: 91.8933 }, // Shillong
      { lat: 25.5200, lng: 91.9100 },
      { lat: 25.4700, lng: 91.9400 },
      { lat: 25.4500, lng: 92.0200 },
      { lat: 25.4530, lng: 92.0640 }, // Jowai
    ]
  },
  'TRUCK-NER-02': {
    name: 'Food Relief Truck (Guwahati → Tezpur → Itanagar)',
    waypoints: [
      { lat: 26.1445, lng: 91.7362 }, // Guwahati
      { lat: 26.1800, lng: 91.8000 },
      { lat: 26.2500, lng: 91.9000 },
      { lat: 26.3200, lng: 92.0000 },
      { lat: 26.4000, lng: 92.1500 },
      { lat: 26.5000, lng: 92.3000 },
      { lat: 26.5800, lng: 92.4500 },
      { lat: 26.6300, lng: 92.5500 },
      { lat: 26.6500, lng: 92.7000 }, // Tezpur
      { lat: 26.7200, lng: 92.8000 },
      { lat: 26.8000, lng: 92.9000 },
      { lat: 26.8800, lng: 93.0000 },
      { lat: 26.9500, lng: 93.1000 },
      { lat: 27.0000, lng: 93.2000 },
      { lat: 27.0500, lng: 93.3500 },
      { lat: 27.0844, lng: 93.6100 }, // Itanagar
    ]
  },
  'TRUCK-NER-03': {
    name: 'Construction Materials (Guwahati → Nagaon → Dimapur)',
    waypoints: [
      { lat: 26.1445, lng: 91.7362 }, // Guwahati
      { lat: 26.1600, lng: 91.8500 },
      { lat: 26.1800, lng: 91.9800 },
      { lat: 26.2000, lng: 92.1000 },
      { lat: 26.2200, lng: 92.2500 },
      { lat: 26.2800, lng: 92.4000 },
      { lat: 26.3400, lng: 92.5500 },
      { lat: 26.3500, lng: 92.6800 }, // Nagaon
      { lat: 26.3200, lng: 92.8000 },
      { lat: 26.2800, lng: 92.9500 },
      { lat: 26.2200, lng: 93.1000 },
      { lat: 26.1500, lng: 93.2500 },
      { lat: 26.0500, lng: 93.4000 },
      { lat: 25.9500, lng: 93.5500 },
      { lat: 25.8800, lng: 93.6500 },
      { lat: 25.8200, lng: 93.7200 },
      { lat: 25.7600, lng: 93.7300 },
      { lat: 25.7100, lng: 93.7400 }, // Dimapur
    ]
  }
};

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function interpolate(p1, p2, t) {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * t,
    lng: p1.lng + (p2.lng - p1.lng) * t
  };
}

function calculateSpeed(p1, p2, intervalSec) {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const d = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (d / intervalSec) * 3600; // km/h
}

function calculateHeading(p1, p2) {
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const lat1 = p1.lat * Math.PI / 180;
  const lat2 = p2.lat * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

async function testRouteAPI() {
  console.log('\n' + '='.repeat(60));
  console.log('  [1/3] TESTING AI ROUTE OPTIMIZATION (Node → Python PyVRP)');
  console.log('='.repeat(60));

  try {
    const res = await fetch('http://localhost:3000/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depot: { id: 'Guwahati', lat: 26.1445, lng: 91.7362, demand: 0 },
        customers: [
          { id: 'Shillong', lat: 25.5783, lng: 91.8933, demand: 20 },
          { id: 'Dimapur', lat: 25.7100, lng: 93.7400, demand: 30 },
          { id: 'Itanagar', lat: 27.0844, lng: 93.6100, demand: 15 },
          { id: 'Tezpur', lat: 26.6500, lng: 92.7000, demand: 25 },
          { id: 'Silchar', lat: 24.8333, lng: 92.7789, demand: 20 }
        ],
        truck_capacity: 100
      })
    });
    const data = await res.json();
    console.log('✅ Route calculated successfully!');
    console.log('   Routes:', JSON.stringify(data.routes));
    console.log('   Total Distance:', data.total_distance_km?.toFixed(1), 'km');
    return data;
  } catch (e) {
    console.log('❌ Route API failed:', e.message);
    console.log('   (Make sure Python backend is running on port 8000)');
    return null;
  }
}

async function testSMSWebhook() {
  console.log('\n' + '='.repeat(60));
  console.log('  [2/3] TESTING ZERO-NETWORK SMS FAILSAFE');
  console.log('='.repeat(60));

  const smsPayloads = [
    { From: '+917002001001', Body: 'TRUCK-NER-01|25.35|92.20|' + new Date().toISOString() + '|emergency_reroute' },
    { From: '+917002001002', Body: 'TRUCK-NER-02|26.58|93.17|' + new Date().toISOString() + '|in_dead_zone' },
  ];

  for (const payload of smsPayloads) {
    try {
      const res = await fetch('http://localhost:3000/api/sms-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log(`✅ SMS received from ${payload.From}:`, data.parsed?.vehicleId, '→', data.parsed?.status);
    } catch (e) {
      console.log('❌ SMS webhook failed:', e.message);
    }
  }
}

async function simulateGPSTracking() {
  console.log('\n' + '='.repeat(60));
  console.log('  [3/3] SIMULATING LIVE GPS TRACKING VIA MQTT');
  console.log('='.repeat(60));

  const client = mqtt.connect('mqtt://localhost:1883');

  return new Promise((resolve, reject) => {
    client.on('connect', async () => {
      console.log('✅ Connected to MQTT broker on port 1883');
      console.log('   Simulating 3 trucks moving across NER...\n');

      const STEPS_PER_SEGMENT = 3; // interpolation steps between waypoints
      const INTERVAL_MS = 2000;    // 2 seconds between updates

      const truckIds = Object.keys(ROUTES);
      const maxWaypoints = Math.max(...truckIds.map(id => ROUTES[id].waypoints.length));
      const totalSteps = (maxWaypoints - 1) * STEPS_PER_SEGMENT;

      for (let step = 0; step < totalSteps; step++) {
        for (const vehicleId of truckIds) {
          const route = ROUTES[vehicleId];
          const waypointIndex = Math.floor(step / STEPS_PER_SEGMENT);
          const subStep = (step % STEPS_PER_SEGMENT) / STEPS_PER_SEGMENT;

          if (waypointIndex >= route.waypoints.length - 1) continue;

          const p1 = route.waypoints[waypointIndex];
          const p2 = route.waypoints[waypointIndex + 1];
          const pos = interpolate(p1, p2, subStep);
          const speed = calculateSpeed(p1, p2, INTERVAL_MS / 1000) + (Math.random() * 10 - 5);
          const heading = calculateHeading(p1, p2);

          const payload = JSON.stringify({
            lat: parseFloat(pos.lat.toFixed(6)),
            lng: parseFloat(pos.lng.toFixed(6)),
            speed: parseFloat(Math.max(0, speed).toFixed(1)),
            heading: parseFloat(heading.toFixed(1)),
            timestamp: new Date().toISOString()
          });

          client.publish(`gps/${vehicleId}`, payload);

          const progress = Math.min(100, ((step / totalSteps) * 100)).toFixed(0);
          process.stdout.write(`\r   🚛 Step ${step + 1}/${totalSteps} (${progress}%) | ${vehicleId.slice(-2)}: (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}) @ ${Math.max(0, speed).toFixed(0)} km/h`);
        }

        await delay(INTERVAL_MS);
      }

      console.log('\n\n✅ GPS simulation complete!');
      client.end();
      resolve();
    });

    client.on('error', (err) => {
      console.log('❌ MQTT connection failed:', err.message);
      console.log('   (Make sure Node.js backend is running on port 3000)');
      reject(err);
    });

    setTimeout(() => {
      console.log('\n⏱️  Simulation timeout reached');
      client.end();
      resolve();
    }, 180000); // 3 minute timeout
  });
}

async function main() {
  console.log('\n' + '🌟'.repeat(30));
  console.log('  AI-BASED SMART LOGISTICS PLATFORM — NER SIMULATION');
  console.log('🌟'.repeat(30));

  // Step 1: Test Route API
  await testRouteAPI();
  await delay(1000);

  // Step 2: Test SMS Failsafe
  await testSMSWebhook();
  await delay(1000);

  // Step 3: Simulate GPS
  try {
    await simulateGPSTracking();
  } catch (e) {
    console.log('GPS simulation stopped:', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  SIMULATION COMPLETE');
  console.log('  Open http://localhost:3001 to see the dashboard');
  console.log('='.repeat(60) + '\n');

  process.exit(0);
}

main().catch(console.error);
