import React from 'react';
import { useParams, Link } from 'react-router-dom';

const GuestPassPage = () => {
	const { id } = useParams();

	return (
		<div className="min-h-screen bg-canvas flex items-center justify-center p-6">
			<div className="bg-white w-full max-w-lg rounded-[2rem] shadow-xl p-8 border border-zinc-100 text-center">
				<h1 className="text-3xl font-serif font-bold text-zinc-900">Guest Pass</h1>
				<p className="text-zinc-500 mt-3 font-medium">
					Share ID: <span className="text-zinc-900">{id}</span>
				</p>
				<p className="text-zinc-400 mt-4 text-sm">
					This page is a placeholder. Wire the share view when the API is ready.
				</p>
				<Link
					to="/"
					className="inline-block mt-6 px-6 py-3 rounded-full bg-black text-white text-sm font-bold hover:bg-zinc-800 transition-colors"
				>
					Back to Journal
				</Link>
			</div>
		</div>
	);
};

export default GuestPassPage;
