import React, { useState, useEffect } from 'react';
import { X, Star, Search, MapPin, Loader2 } from 'lucide-react';
import api from '../api';

const AddMealForm = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        area: '',
        mealType: 'RESTAURANT',
        context: 'FRIENDS',
        visitedOn: new Date().toISOString().split('T')[0],
        note: '',
        rating: 5,
        latitude: null,
        longitude: null,
    });

    // Effect to handle the search logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.length > 2) {
                performSearch();
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const performSearch = async () => {
        setIsSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&addressdetails=1&limit=5`);
            const data = await res.json();
            setSearchResults(data);
        } catch (err) {
            console.error("Location search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectLocation = (result) => {
        const address = result.address;
        // Nominatim gives very specific data; we try to find the best 'Neighborhood' name
        const neighborhood = address.suburb || address.neighbourhood || address.city_district || address.city || "Unknown Area";
        
        setFormData({
            ...formData,
            name: result.display_name.split(',')[0], // Take just the place name
            area: neighborhood,
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon)
        });
        setSearchQuery(result.display_name);
        setSearchResults([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.latitude) return alert("Please select a valid location from the search.");
        setLoading(true);
        try {
            await api.post('/places', formData);
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to save meal", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 max-h-[90vh] overflow-y-auto relative border border-zinc-100">
                <button onClick={onClose} className="absolute top-8 right-8 p-2 bg-zinc-100 rounded-full text-zinc-500 hover:text-black transition-colors">
                    <X size={20} />
                </button>

                <h2 className="text-3xl font-serif font-bold text-zinc-900 mb-8">New Entry</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Location Search Input */}
                    <div className="relative">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2 block ml-1">Search Place</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                            <input
                                type="text"
                                placeholder="Find a cafe, restaurant, or bar..."
                                className="w-full bg-zinc-50 border-2 border-transparent focus:bg-white focus:border-black rounded-2xl p-4 pl-12 text-lg outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-zinc-400" size={20} />}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden">
                                {searchResults.map((result) => (
                                    <button
                                        key={result.place_id}
                                        type="button"
                                        onClick={() => handleSelectLocation(result)}
                                        className="w-full text-left p-4 hover:bg-zinc-50 flex items-start gap-3 border-b border-zinc-50 last:border-0"
                                    >
                                        <MapPin className="text-zinc-400 shrink-0 mt-1" size={18} />
                                        <div>
                                            <p className="font-bold text-zinc-900 leading-tight">{result.display_name.split(',')[0]}</p>
                                            <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{result.display_name}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Neighborhood and Date (Auto-filled but editable) */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block ml-1">Neighborhood</label>
                            <input
                                type="text"
                                className="w-full bg-zinc-50 rounded-2xl p-4 text-zinc-900 font-medium"
                                value={formData.area}
                                readOnly
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block ml-1">Date</label>
                            <input
                                type="date"
                                className="w-full bg-zinc-50 rounded-2xl p-4 text-zinc-500 font-medium"
                                value={formData.visitedOn}
                                onChange={(e) => setFormData({...formData, visitedOn: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Vibe and Context */}
                    <div className="space-y-3">
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {['CAFE', 'RESTAURANT', 'BAR', 'STREET_FOOD'].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFormData({...formData, mealType: type})}
                                    className={`px-4 py-2 rounded-full text-xs font-black tracking-widest border-2 transition-all ${formData.mealType === type ? 'bg-black border-black text-white' : 'bg-white border-zinc-100 text-zinc-400'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <textarea
                        placeholder="My thoughts exactly..."
                        className="w-full bg-zinc-50 rounded-2xl p-6 outline-none min-h-[120px] font-serif italic text-xl border-2 border-transparent focus:bg-white focus:border-black transition-all"
                        value={formData.note}
                        onChange={(e) => setFormData({...formData, note: e.target.value})}
                    />

                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Rating</span>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button key={star} type="button" onClick={() => setFormData({...formData, rating: star})}>
                                    <Star size={24} className={star <= formData.rating ? "fill-black text-black" : "text-zinc-200 fill-zinc-50"} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !formData.latitude}
                        className="w-full bg-black text-white rounded-full py-5 text-xl font-bold hover:bg-zinc-800 transition-all disabled:bg-zinc-100 disabled:text-zinc-300 shadow-xl"
                    >
                        {loading ? 'Locking in...' : 'Log Experience'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddMealForm;