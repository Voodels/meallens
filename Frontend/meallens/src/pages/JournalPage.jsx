import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import MealCard from '../components/MealCard';
import AddMealForm from '../components/AddMealForm';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, LayoutGrid, Map as MapIcon } from 'lucide-react';

const JournalPage = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [meals, setMeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchMeals = async () => {
        try {
            const response = await api.get('/places');
            setMeals(response.data);
        } catch (error) {
            console.error("Failed to fetch meals", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeals();
    }, []); // The empty array means this only runs once when the page loads

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <span className="text-zinc-400 font-serif text-2xl animate-pulse">Unlocking vault...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 pb-20">
            {/* The Sticky Navigation Bar */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-100 px-6 py-4 flex justify-between items-center">
                <h1 className="text-2xl font-serif font-bold text-zinc-900 tracking-tight">Meal Lens</h1>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center justify-center p-3 bg-black text-white rounded-full hover:bg-zinc-800 transition-colors shadow-md"
                    >
                        <Plus size={20} strokeWidth={2.5} />
                    </button>
                    <button 
                        onClick={logout} 
                        className="p-3 text-zinc-400 hover:text-black transition-colors"
                        title="Lock Vault"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            {/* The Content Grid */}
            <main className="max-w-6xl mx-auto p-6 mt-4">
                {meals.length === 0 ? (
                    <div className="text-center mt-32">
                        <h3 className="text-3xl font-serif text-zinc-900 mb-3 tracking-tight">It's a bit quiet here.</h3>
                        <p className="text-zinc-500 font-medium text-lg">Time to log your first culinary experience.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {meals.map(meal => (
                            <MealCard key={meal.id} meal={meal} />
                        ))}
                    </div>
                )}
            </main>

            {showAddForm && (
                <AddMealForm
                    onClose={() => setShowAddForm(false)}
                    onSuccess={fetchMeals}
                />
            )}

            {/* The Floating UI Toggle (Map vs. Grid) */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[50] bg-white p-1 rounded-full shadow-2xl border border-zinc-100 flex gap-1">
                <button className="flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm bg-black text-white shadow-md">
                    <LayoutGrid size={18} />
                    Grid
                </button>
                <button
                    onClick={() => navigate('/map')}
                    className="flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm text-zinc-400 hover:text-black transition-colors"
                >
                    <MapIcon size={18} />
                    Map
                </button>
            </div>
        </div>
    );
};

export default JournalPage;