import math
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

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

class HazardRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float = 50.0

HAZARD_ZONES = [
    {"name": "Jaintia Hills landslide zone", "lat": 25.35, "lng": 92.20, "risk_score": 0.85, "type": "landslide"},
    {"name": "Kaziranga flood zone", "lat": 26.58, "lng": 93.17, "risk_score": 0.90, "type": "flood"},
    {"name": "Barak Valley flood zone", "lat": 24.82, "lng": 92.78, "risk_score": 0.75, "type": "flood"},
    {"name": "Naga Hills landslide zone", "lat": 25.67, "lng": 94.12, "risk_score": 0.80, "type": "landslide"},
    {"name": "Arunachal avalanche zone", "lat": 27.10, "lng": 93.62, "risk_score": 0.70, "type": "avalanche"},
    {"name": "Manipur landslide zone", "lat": 24.80, "lng": 93.95, "risk_score": 0.82, "type": "landslide"},
    {"name": "Mizoram flood zone", "lat": 23.16, "lng": 92.94, "risk_score": 0.65, "type": "flood"},
    {"name": "Sikkim landslide zone", "lat": 27.53, "lng": 88.51, "risk_score": 0.88, "type": "landslide"},
]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in kilometers
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

def solve_vrp(locations: List[Location], truck_capacity: int):
    num_locations = len(locations)
    
    distance_matrix = []
    for i in range(num_locations):
        row = []
        for j in range(num_locations):
            if i == j:
                row.append(0)
            else:
                dist = haversine(locations[i].lat, locations[i].lng, locations[j].lat, locations[j].lng)
                row.append(int(dist * 1000))
        distance_matrix.append(row)
        
    demands = [loc.demand for loc in locations]
    total_demand = sum(demands)
    num_vehicles = max(1, (total_demand + truck_capacity - 1) // truck_capacity)
    
    if num_vehicles > 20:
        num_vehicles = 20 # sanity limit
        
    manager = pywrapcp.RoutingIndexManager(num_locations, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)
    
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]
        
    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  
        [truck_capacity] * num_vehicles,
        True,
        'Capacity')
        
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.seconds = 2
    
    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        return None
        
    routes = []
    total_distance_km = 0.0
    waypoints = []
    
    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        if routing.IsEnd(solution.Value(routing.NextVar(index))):
            continue
            
        route_ids = []
        route_wp = []
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            if node_index != 0:
                route_ids.append(locations[node_index].id)
            route_wp.append({"lat": locations[node_index].lat, "lng": locations[node_index].lng})
            index = solution.Value(routing.NextVar(index))
            
        node_index = manager.IndexToNode(index)
        route_wp.append({"lat": locations[node_index].lat, "lng": locations[node_index].lng})
        
        # calc actual distance
        route_dist = 0.0
        for i in range(len(route_wp)-1):
            route_dist += haversine(route_wp[i]["lat"], route_wp[i]["lng"], route_wp[i+1]["lat"], route_wp[i+1]["lng"])
            
        total_distance_km += route_dist
        if route_ids:
            routes.append(route_ids)
            waypoints.append(route_wp)
            
    return routes, total_distance_km, waypoints

@app.post("/calculate_route")
def calculate_route(req: RouteRequest):
    if len(req.customers) == 0:
        return {"routes": [], "total_distance_km": 0.0, "waypoints": []}
        
    locations = [req.depot] + req.customers
    
    # Try VRP
    if len(req.customers) > 1:
        try:
            res = solve_vrp(locations, req.truck_capacity)
            if res:
                return {
                    "routes": res[0],
                    "total_distance_km": round(res[1], 2),
                    "waypoints": res[2]
                }
        except Exception:
            pass
            
    # Nearest neighbor fallback (or for 1 customer)
    unvisited = req.customers.copy()
    current = req.depot
    
    routes = []
    waypoints = []
    total_dist = 0.0
    
    current_capacity = req.truck_capacity
    current_ids = []
    current_wp = [{"lat": current.lat, "lng": current.lng}]
    
    while unvisited:
        nearest = None
        min_dist = float('inf')
        
        for cust in unvisited:
            if cust.demand <= current_capacity:
                dist = haversine(current.lat, current.lng, cust.lat, cust.lng)
                if dist < min_dist:
                    min_dist = dist
                    nearest = cust
                    
        if nearest:
            current_capacity -= nearest.demand
            total_dist += min_dist
            current = nearest
            unvisited.remove(nearest)
            current_ids.append(nearest.id)
            current_wp.append({"lat": nearest.lat, "lng": nearest.lng})
        else:
            dist_to_depot = haversine(current.lat, current.lng, req.depot.lat, req.depot.lng)
            total_dist += dist_to_depot
            current_wp.append({"lat": req.depot.lat, "lng": req.depot.lng})
            routes.append(current_ids)
            waypoints.append(current_wp)
            
            current = req.depot
            current_capacity = req.truck_capacity
            current_ids = []
            current_wp = [{"lat": current.lat, "lng": current.lng}]
            
    if current_ids:
        dist_to_depot = haversine(current.lat, current.lng, req.depot.lat, req.depot.lng)
        total_dist += dist_to_depot
        current_wp.append({"lat": req.depot.lat, "lng": req.depot.lng})
        routes.append(current_ids)
        waypoints.append(current_wp)
        
    return {
        "routes": routes,
        "total_distance_km": round(total_dist, 2),
        "waypoints": waypoints
    }
