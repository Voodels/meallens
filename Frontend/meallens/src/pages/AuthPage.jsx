import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Utensils } from 'lucide-react';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(name, email, password);
            }
            // If successful, the Bouncer lets us through to the Journal
            navigate('/');
        } catch (err) {
            setError('Something went wrong. Check your credentials.');
        }
    };

    return (
        // A clean, off-white background to make the white card pop
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
            
            {/* The Main Hinge-style Card */}
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-xl p-8 border border-zinc-100">
                
                {/* The Brand Header */}
                <div className="flex flex-col items-center mb-10">
                    <div className="bg-black text-white p-4 rounded-full mb-4">
                        <Utensils size={32} strokeWidth={1.5} />
                    </div>
                    {/* Notice the serif font and tight tracking for that editorial feel */}
                    <h1 className="text-4xl font-serif font-bold tracking-tight text-zinc-900">
                        Meal Lens
                    </h1>
                    <p className="text-zinc-500 mt-2 font-medium">
                        {isLogin ? 'Welcome back to your table.' : 'Start your culinary journal.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <input
                            type="text"
                            placeholder="How should we call you?"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-zinc-50 border-2 border-transparent focus:bg-white focus:border-black rounded-2xl p-4 text-lg outline-none transition-all duration-200"
                            required
                        />
                    )}
                    <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-zinc-50 border-2 border-transparent focus:bg-white focus:border-black rounded-2xl p-4 text-lg outline-none transition-all duration-200"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-50 border-2 border-transparent focus:bg-white focus:border-black rounded-2xl p-4 text-lg outline-none transition-all duration-200"
                        required
                    />

                    {/* Big, bold, pill-shaped primary action button */}
                    <button
                        type="submit"
                        className="w-full bg-black text-white rounded-full py-4 text-lg font-bold hover:bg-zinc-800 transition-colors mt-2"
                    >
                        {isLogin ? 'Enter' : 'Create Account'}
                    </button>
                </form>

                {/* The subtle toggle at the bottom */}
                <div className="mt-8 text-center">
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-zinc-500 font-medium hover:text-black transition-colors"
                    >
                        {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;