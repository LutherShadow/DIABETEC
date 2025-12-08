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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">👋</div>
          <h2 className="text-2xl font-bold text-teal-800">Bienvenido de nuevo</h2>
          <p className="text-gray-500">Ingresa tu correo para recuperar tu historial.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition disabled:opacity-50"
          >
            {loading ? 'Buscando perfil...' : 'Acceder'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={onBack} className="text-teal-600 text-sm font-medium hover:underline">
            ← Soy nuevo, quiero registrarme
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;