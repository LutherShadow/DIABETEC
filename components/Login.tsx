
import React, { useState } from 'react';
import { loginUser } from '../services/storageService';

const Logo = () => (
  <div className="flex items-center justify-center gap-3 mb-8">
    <div className="relative w-12 h-12 flex-shrink-0">
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0.5">
        {[...Array(16)].map((_, i) => (
          <div key={i} className={`${[0,3,4,7,8,11,13,14].includes(i) ? 'bg-cyan-400' : [9,10,5,6].includes(i) ? 'bg-purple-600' : 'bg-transparent'} rounded-sm`}></div>
        ))}
      </div>
    </div>
    <div className="flex flex-col leading-none text-left">
      <span className="text-3xl font-black tracking-tighter text-slate-800 uppercase">Vida<span className="text-cyan-500">Salud</span></span>
      <span className="text-[10px] font-black tracking-[0.4em] text-slate-400">ARTIFICIAL INTELLIGENCE</span>
    </div>
  </div>
);

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
      <div className="max-w-md w-full bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-100">
        <div className="text-center mb-8">
          <Logo />
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
