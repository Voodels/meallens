import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Map as MapIcon } from 'lucide-react';
import api from '../api';

// Creating a stark, black-and-white custom pin to match our Hinge aesthetic
const customIcon = new L.DivIcon({
    className: 'custom-icon',
    html: `<div style="background-color: black; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const MapPage = () => {
    const [meals, setMeals] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMeals = async () => {
            try {
                const response = await api.get('/places');
                setMeals(response.data);
            } catch (error) {
                console.error("Failed to fetch meals for map", error);
            }
        };
        fetchMeals();
    }, []);

    return (
        <div className="relative h-screen w-full bg-zinc-50">
            
            {/* The Map Engine */}
            <MapContainer 
                center={[18.5590, 73.7868]} // Centered on Baner, Pune
                zoom={14} 
                className="h-full w-full z-0"
                zoomControl={false}
            >
                {/* A clean, muted map tile layer (CartoDB Positron) to let our black pins pop */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                />

                {/* Plotting the data from Spring Boot */}
                {meals.map((meal) => (
                    meal.latitude && meal.longitude && (
                        <Marker 
                            key={meal.id} 
                            position={[meal.latitude, meal.longitude]} 
                            icon={customIcon}
                        >
                            {/* The Pop-up Card when a pin is clicked */}
                            <Popup className="rounded-2xl shadow-xl border-0">
                                <div className="p-1 min-w-[150px]">
                                    <h3 className="font-serif font-bold text-lg leading-tight m-0 text-black">
                                        {meal.name}
                                    </h3>
                                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1 mb-2">
                                        {meal.context} • {meal.rating}★
                                    </p>
                                    {meal.note && (
                                        <p className="italic text-zinc-600 m-0">"{meal.note}"</p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}
            </MapContainer>

            {/* The Floating UI Toggle (Map vs. Grid) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white p-1 rounded-full shadow-2xl border border-zinc-100 flex gap-1">
                <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm text-zinc-400 hover:text-black transition-colors"
                >
                    <LayoutGrid size={18} />
                    Grid
                </button>
                <button 
                    className="flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm bg-black text-white shadow-md"
                >
                    <MapIcon size={18} />
                    Map
                </button>
            </div>

        </div>
    );
};

export default MapPage;