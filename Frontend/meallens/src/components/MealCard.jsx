import React from 'react';
import { Star, MapPin } from 'lucide-react';

const MealCard = ({ meal }) => {
    return (
        // The main container: highly rounded, subtle border, smooth hover lift
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-zinc-100 flex flex-col gap-6 transition-transform hover:-translate-y-1">
            
            {/* Header: Bold Serif Name + Subtle Location */}
            <div>
                <h2 className="text-3xl font-serif font-bold text-zinc-900 tracking-tight leading-tight">
                    {meal.name}
                </h2>
                <div className="flex items-center gap-1 text-zinc-500 mt-2 font-medium text-sm">
                    <MapPin size={16} />
                    <span>{meal.area}</span>
                </div>
            </div>

            {/* The "Prompts" Section */}
            <div className="space-y-3">
                <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100/50">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                        The Vibe...
                    </p>
                    <p className="text-zinc-900 font-medium">
                        {meal.context} • {meal.mealType}
                    </p>
                </div>
                
                {meal.note && (
                    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100/50">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                            My thoughts exactly...
                        </p>
                        <p className="text-zinc-900 text-lg leading-relaxed font-serif italic">
                            "{meal.note}"
                        </p>
                    </div>
                )}
            </div>

            {/* Footer: Rating and Date */}
            <div className="flex justify-between items-end mt-auto pt-4 border-t border-zinc-100">
                <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                        <Star 
                            key={i} 
                            size={18} 
                            // Solid black stars for rating, light gray for empty
                            className={i < meal.rating ? "fill-black text-black" : "text-zinc-200 fill-zinc-50"} 
                        />
                    ))}
                </div>
                <span className="text-zinc-400 font-medium text-sm">
                    {meal.visitedOn}
                </span>
            </div>
        </div>
    );
};

export default MealCard;