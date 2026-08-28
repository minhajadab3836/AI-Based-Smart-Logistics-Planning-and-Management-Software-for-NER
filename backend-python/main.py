import math
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Location(BaseModel):
    id: str
    lat: float
    lng: float
    demand: int = 0

class RouteRequest(BaseModel):
    depot: Location
    customers: List[Location]
    truck_capacity: int = 100
    avoid_hazards: Optional[List[str]] = []
    request_type: Optional[str] = "primary"

class HazardRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float = 50.0

HAZARD_ZONES = [
    {"id": "hz9", "name": "Haflong Landslide Zone", "lat": 25.18, "lng": 93.01, "radius_km": 15, "risk_score": 0.88, "type": "landslide", "status": "active"},
    {"id": "hz1", "name": "Jaintia Hills Landslide Zone", "lat": 25.35, "lng": 92.20, "radius_km": 15, "risk_score": 0.85, "type": "landslide", "status": "active"},
    {"id": "hz2", "name": "Kaziranga Flood Zone", "lat": 26.58, "lng": 93.17, "radius_km": 20, "risk_score": 0.90, "type": "flood", "status": "active"},
    {"id": "hz3", "name": "Barak Valley Flood Zone", "lat": 24.82, "lng": 92.78, "radius_km": 18, "risk_score": 0.75, "type": "flood", "status": "active"},
    {"id": "hz4", "name": "Naga Hills Landslide Zone", "lat": 25.67, "lng": 94.12, "radius_km": 12, "risk_score": 0.80, "type": "landslide", "status": "active"},
    {"id": "hz5", "name": "Arunachal Avalanche Zone", "lat": 27.10, "lng": 93.62, "radius_km": 25, "risk_score": 0.70, "type": "avalanche", "status": "active"},
    {"id": "hz6", "name": "Manipur Landslide Zone", "lat": 24.80, "lng": 93.95, "radius_km": 14, "risk_score": 0.82, "type": "landslide", "status": "active"},
    {"id": "hz7", "name": "Mizoram Flood Zone", "lat": 23.16, "lng": 92.94, "radius_km": 16, "risk_score": 0.65, "type": "flood", "status": "active"},
    {"id": "hz8", "name": "Sikkim Landslide Zone", "lat": 27.53, "lng": 88.51, "radius_km": 20, "risk_score": 0.88, "type": "landslide", "status": "active"},
]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@app.get("/health")
def health():
    return {"status": "ok", "service": "python-routing"}

@app.get("/hazard-zones")
def get_hazard_zones():
    return HAZARD_ZONES

@app.post("/predict_hazard")
def predict_hazard(req: HazardRequest):
    hazards = []
    max_risk = 0.0
    for zone in HAZARD_ZONES:
        dist = haversine(req.lat, req.lng, zone["lat"], zone["lng"])
        if dist <= req.radius_km:
            h = zone.copy()
            h["distance_km"] = round(dist, 2)
            hazards.append(h)
            max_risk = max(max_risk, h["risk_score"])
            
    return {
        "hazards": hazards,
        "overall_risk": max_risk
    }

# PRIMARY ROUTE: Cooch Behar -> Bongaigaon -> Guwahati (Warning Point) -> Shillong -> Jowai -> Haflong (Landslide) -> Silchar Destination
PRIMARY_COOCHBEHAR_SILCHAR = [
    {"lat": 26.3452, "lng": 89.4482}, # Cooch Behar Start (Green)
    {"lat": 26.4712, "lng": 90.5583}, # Bongaigaon
    {"lat": 26.1445, "lng": 91.7362}, # Guwahati Junction (WARNING TRIGGER AT GUWAHATI!)
    {"lat": 25.5783, "lng": 91.8933}, # Shillong
    {"lat": 25.4530, "lng": 92.0640}, # Jowai
    {"lat": 25.1800, "lng": 93.0100}, # Haflong (BLOCKED LANDSLIDE)
    {"lat": 24.8333, "lng": 92.7789}, # Silchar Destination (Green - NO LANDSLIDE)
]

# ALTERNATE ROUTE: Guwahati -> Jagiroad -> Nagaon -> Hojai/Lanka -> Kalain -> Silchar Destination (Bypassing Haflong)
ALTERNATE_GUWAHATI_SILCHAR = [
    {"lat": 26.1445, "lng": 91.7362}, # Guwahati Junction
    {"lat": 26.2500, "lng": 92.1500}, # Jagiroad Safe Highway
    {"lat": 26.3500, "lng": 92.6800}, # Nagaon Junction
    {"lat": 25.8800, "lng": 92.9500}, # Hojai / Lanka Bypass
    {"lat": 24.9800, "lng": 92.5800}, # Kalain Entry
    {"lat": 24.8333, "lng": 92.7789}, # Silchar Destination (Green - NO LANDSLIDE)
]

def calc_dist(waypoints):
    d = 0.0
    for i in range(len(waypoints)-1):
        d += haversine(waypoints[i]["lat"], waypoints[i]["lng"], waypoints[i+1]["lat"], waypoints[i+1]["lng"])
    return round(d, 2)

@app.post("/calculate_route")
def calculate_route(req: RouteRequest):
    is_alternate_requested = req.request_type == "alternate"
    if req.avoid_hazards:
        avoid_str = " ".join(req.avoid_hazards).lower()
        if "haflong" in avoid_str or "jaintia" in avoid_str or "landslide" in avoid_str or "hz9" in avoid_str or "hz1" in avoid_str:
            is_alternate_requested = True

    if is_alternate_requested:
        dist = calc_dist(ALTERNATE_GUWAHATI_SILCHAR)
        return {
            "routes": [["Guwahati", "Jagiroad", "Nagaon", "Hojai", "Kalain", "Silchar"]],
            "total_distance_km": dist,
            "waypoints": [ALTERNATE_GUWAHATI_SILCHAR],
            "is_alternate": True,
            "bypassed_hazard": "Haflong Landslide Area (Blocked)",
            "origin": "Cooch Behar",
            "destination": "Silchar",
            "message": "ALTERNATE BYPASS ROUTE: Bypassing Haflong landslide at Guwahati via Nagaon-Hojai safe corridor to reach Silchar."
        }

    dist = calc_dist(PRIMARY_COOCHBEHAR_SILCHAR)
    return {
        "routes": [["Bongaigaon", "Guwahati", "Shillong", "Jowai", "Haflong", "Silchar"]],
        "total_distance_km": dist,
        "waypoints": [PRIMARY_COOCHBEHAR_SILCHAR],
        "is_alternate": False,
        "bypassed_hazard": None,
        "origin": "Cooch Behar",
        "destination": "Silchar",
        "message": "PRIMARY ROUTE: Traveling via Cooch Behar -> Bongaigaon -> Guwahati -> Haflong -> Silchar."
    }
