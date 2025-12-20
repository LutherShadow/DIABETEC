
import React, { useState } from 'react';
import { loginUser } from '../services/storageService';

interface LoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await loginUser(email);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.message || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="VidaSalud AI Logo" className="w-48 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Bienvenido de nuevo</h2>
          <p className="text-slate-500 text-sm font-medium">Ingresa tu correo para recuperar tu historial.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Correo Electrónico</label>
            <input 
              type="email" 
              required
              className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-xs font-bold rounded-2xl border border-red-100 animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-teal-700 transition shadow-xl disabled:opacity-50 active:scale-95 shadow-teal-100"
          >
            {loading ? 'Buscando perfil...' : 'Acceder al Tratamiento'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={onBack} className="text-teal-600 text-xs font-black uppercase tracking-widest hover:text-teal-700 transition">
            ← Soy nuevo, quiero registrarme
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
