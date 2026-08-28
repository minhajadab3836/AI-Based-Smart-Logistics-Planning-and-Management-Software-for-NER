const mqtt = require('mqtt');

async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function runTests() {
    console.log("=== STARTING SIMULATION ===");

    // Case 1: Pre-Dispatch Route Calculation
    console.log("\n[1] Testing AI Route Calculation (Node -> Python PyVRP)...");
    try {
        const routeRes = await fetch('http://localhost:3000/api/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                depot: { id: "D1", lat: 26.1, lng: 91.7, demand: 0 },
                customers: [{ id: "C1", lat: 26.2, lng: 91.8, demand: 10 }],
                truck_capacity: 100
            })
        });
        const routeData = await routeRes.json();
        console.log("Route Result:", routeData);
    } catch (e) {
        console.log("Route Test Failed:", e.message);
    }

    // Case 2: 4G Live Tracking (MQTT)
    console.log("\n[2] Testing 4G Live Tracking (MQTT to Node.js)...");
    const client = mqtt.connect('mqtt://localhost:1883', { clientId: 'TRUCK_101' });
    
    client.on('connect', async () => {
        console.log("Truck MQTT Connected.");
        for(let i=0; i<3; i++) {
            const payload = JSON.stringify({ lat: 26.1 + (i*0.01), lng: 91.7 + (i*0.01) });
            client.publish('truck/location', payload);
            console.log("Published GPS:", payload);
            await delay(1000);
        }
        client.end();
    });

    await delay(4000); 

    // Case 3: Zero-Network Offline Failsafe (Twilio SMS)
    console.log("\n[3] Testing Zero-Network SMS Failsafe (Twilio Webhook)...");
    try {
        const smsRes = await fetch('http://localhost:3000/api/twilio/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: "Body=TRUCK_101,LAT:26.15,LNG:91.75,HAZARD:LANDSLIDE_BLOCKED_ROAD"
        });
        const smsText = await smsRes.text();
        console.log("SMS Webhook Response:", smsText);
    } catch (e) {
        console.log("SMS Test Failed:", e.message);
    }

    console.log("\n=== SIMULATION COMPLETE ===");
}

runTests();
