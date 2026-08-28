'use client';

import { useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function Dashboard() {
    const [trucks, setTrucks] = useState<{ [id: string]: { lat: number, lng: number } }>({});
    const [hazards, setHazards] = useState<any[]>([]);

    useEffect(() => {
        const eventSource = new EventSource('/api/events');
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'LIVE_LOCATION') {
                setTrucks(prev => ({ ...prev, [data.truckId]: data.data }));
            } else if (data.type === 'ZERO_NETWORK_HAZARD') {
                setHazards(prev => [...prev, data]);
            }
        };

        return () => eventSource.close();
    }, []);

    const triggerReroute = async () => {
        // Mock call to PyVRP Node API
        alert('Route optimization triggered! (Calls Python PyVRP service)');
    };

    return (
        <main className="h-screen w-full flex flex-col">
            <header className="bg-slate-900 text-white p-4">
                <h1 className="text-xl font-bold">NER Smart Logistics Command Center</h1>
            </header>
            
            <div className="flex-1 relative">
                {/* Note: Requires real mapbox token to render map tiles */}
                <Map
                    initialViewState={{
                        longitude: 91.7362, // Guwahati
                        latitude: 26.1445,
                        zoom: 6
                    }}
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    mapboxAccessToken="pk.eyJ1IjoiZHVtbXkiLCJhIjoiY2x4eXh4eXh4eXh4eXh4eXh4eXh4eXh4In0.dummy"
                >
                    {Object.entries(trucks).map(([id, pos]) => (
                        <Marker key={id} longitude={pos.lng} latitude={pos.lat}>
                            <div className="bg-green-500 w-4 h-4 rounded-full border-2 border-white shadow-lg animate-pulse" />
                        </Marker>
                    ))}
                    
                    {hazards.map((h, i) => (
                        <Marker key={i} longitude={h.lng} latitude={h.lat}>
                            <div className="bg-red-500 w-6 h-6 flex items-center justify-center rounded-sm font-bold text-white text-xs shadow-red-500/50 shadow-lg">
                                !
                            </div>
                        </Marker>
                    ))}
                </Map>
                
                {hazards.length > 0 && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-xl max-w-sm border-2 border-red-400">
                        <h3 className="font-bold">⚠️ OFFLINE HAZARD REPORTED</h3>
                        <p className="text-sm mt-1">{hazards[hazards.length - 1].hazard} reported via zero-network SMS from Truck {hazards[hazards.length - 1].truckId}.</p>
                        <button onClick={triggerReroute} className="mt-3 bg-white text-red-600 px-3 py-2 rounded text-sm font-bold w-full hover:bg-gray-100">
                            Trigger AI Reroute
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
