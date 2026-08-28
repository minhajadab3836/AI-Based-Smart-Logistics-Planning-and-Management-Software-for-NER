# AI Logistics Platform - Prototype Implementation Plan

## 1. Tech Stack
*   **Databases:** PostgreSQL (with PostGIS) & Redis (Local Docker).
*   **Main Backend (Node.js):** Express.js + Aedes (Embedded MQTT broker). Handles mobile API, Twilio SMS webhooks, and live tracking.
*   **Routing Service (Python):** FastAPI + PyVRP. Handles heavy VRP route optimization requests from the Node.js backend.
*   **Web Dashboard (Frontend):** React/Next.js + Mapbox GL JS. Visualizes live trucks, hazard zones, and dynamically calculated routes.
*   **Mobile App (Mock):** React Native. Simulates live GPS MQTT ticks (4G mode) and offline SMS failsafe payloads (Zero-Network mode).

## 2. Architecture & Data Flow
1.  **Pre-Dispatch:** Node.js API sends initial Route + static map to the mobile app.
2.  **Active 4G Mode:** Mobile app publishes GPS to Node.js Aedes MQTT broker every 5s -> Saved to Redis -> Dashboard reads via WebSocket/SSE.
3.  **Zero-Network (Blackout):** Mobile app loses network -> Logs GPS and hazard to local storage (SQLite). Driver inputs hazard -> App calculates a detour locally -> Compresses to SMS payload.
4.  **Recovery Phase:** 
    *   **2G Found:** App fires simulated HTTP POST to Twilio webhook on Node.js backend.
    *   **4G Found:** App fires bulk sync to `/api/sync`.

## 3. Execution Steps
1.  **Phase 1: DB & Docker Setup** - Setup `docker-compose.yml` with `postgis/postgis` and `redis`.
2.  **Phase 2: Python Routing Service** - Init FastAPI, install `pyvrp`, expose `/calculate_route`.
3.  **Phase 3: Node.js Backend** - Init Express, setup Aedes MQTT, connect to Redis/Postgres. Wrap PyVRP calls.
4.  **Phase 4: Web Dashboard** - Init Next.js, connect Mapbox, subscribe to Redis for live location.
5.  **Phase 5: Mobile App Mock** - Init React Native (Expo), build simple UI to toggle 4G/Offline and simulate Twilio webhook.
