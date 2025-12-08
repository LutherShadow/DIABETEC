import React, { useState } from 'react';
import { UserProfile } from '../types';
import { saveProfile, setUserId } from '../services/storageService';

interface OnboardingProps {
  onComplete: () => void;
  onLoginClick: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onLoginClick }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    diagnoses: [],
    allowedFoods: [],
    forbiddenFoods: [],
    allergies: [],
    medications: []
  });
  
  // Local state for the inputs in Step 3
  const [allowedInput, setAllowedInput] = useState('');
  const [forbiddenInput, setForbiddenInput] = useState('');
  
  // Step 1: Identification
  const [email, setEmail] = useState('');

  const handleNext = () => setStep(p => p + 1);
  const handleBack = () => setStep(p => p - 1);

  const handleComplete = () => {
    if (!email.includes('@')) {
        alert("Por favor ingresa un email válido para guardar tu progreso.");
        setStep(1);
        return;
    }

    // Set the User ID to the email for Supabase keying
    setUserId(email.trim().toLowerCase());

    const finalProfile = {
      ...formData,
      id: email.trim().toLowerCase(),
      onboardingComplete: true
    } as UserProfile;
    
    saveProfile(finalProfile);
    onComplete();
  };

  const loadDemoData = () => {
    setFormData({
      name: "Juan Pérez",
      age: 22,
      gender: "male",
      height: 178,
      weight: 80,
      activityLevel: "moderate",
      diagnoses: ["Diabetes Tipo 2"],
      allowedFoods: ["Fresas", "Manzana verde", "Pollo", "Pescado", "Huevo", "Aguacate"],
      forbiddenFoods: ["Azúcar", "Pan", "Arroz", "Lácteos enteros", "Refrescos", "Jugos"],
      allergies: [],
      goals: "Controlar glucosa y mantener peso",
      medications: []
    });
    setEmail("demo@vidasalud.ai");
  };

  // Helper for Chip/Tag Input Logic
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>, 
    field: 'allowedFoods' | 'forbiddenFoods', 
    inputValue: string, 
    setInput: (v: string) => void
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = inputValue.trim().replace(/,/g, '');
      if (trimmed) {
        const currentList = formData[field] || [];
        // Prevent duplicates
        if (!currentList.includes(trimmed)) {
            setFormData({ ...formData, [field]: [...currentList, trimmed] });
        }
        setInput('');
      }
    } else if (e.key === 'Backspace' && !inputValue) {
       // Remove last item if input is empty
       const currentList = formData[field] || [];
       if (currentList.length > 0) {
           const newList = [...currentList];
           newList.pop();
           setFormData({ ...formData, [field]: newList });
       }
    }
  };

  const removeTag = (field: 'allowedFoods' | 'forbiddenFoods', index: number) => {
      const currentList = formData[field] || [];
      const newList = currentList.filter((_, i) => i !== index);
      setFormData({ ...formData, [field]: newList });
  };

  // Validation Logic for UI Feedback
  const isDiabetic = formData.diagnoses?.some(d => d.toLowerCase().includes('diabetes'));
  const hasSugarInAllowed = formData.allowedFoods?.some(f => f.toLowerCase().includes('azúcar') || f.toLowerCase().includes('azucar') || f.toLowerCase().includes('dulce'));

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10 text-gray-800">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-teal-700">Perfil de Salud</h2>
        <p className="text-gray-500">Paso {step} de 3</p>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-2">
          <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Datos Básicos</h3>
                <div className="flex gap-4 items-center">
                    <button onClick={loadDemoData} className="text-xs text-teal-600 underline font-medium">Demo</button>
                    <button onClick={onLoginClick} className="text-sm bg-teal-50 text-teal-700 px-3 py-1 rounded-lg border border-teal-200 hover:bg-teal-100">¿Ya tienes cuenta?</button>
                </div>
            </div>
          
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico (Tu ID)</label>
             <input 
              type="email" placeholder="ejemplo@correo.com" className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
              value={email} onChange={e => setEmail(e.target.value)}
             />
             <p className="text-xs text-gray-400 mt-1">Usaremos esto para guardar tu progreso en la nube.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                type="text" placeholder="Tu nombre" className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Edad</label>
                <input 
                type="number" placeholder="Ej: 30" className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                />
            </div>
             <div className="flex gap-2">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
                    <input 
                    type="number" placeholder="170" className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.height || ''} onChange={e => setFormData({...formData, height: Number(e.target.value)})}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                    <input 
                    type="number" placeholder="70" className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.weight || ''} onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
                    />
                </div>
             </div>
             <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                <select 
                    className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.gender || 'other'} 
                    onChange={(e: any) => setFormData({...formData, gender: e.target.value})}
                >
                    <option value="male">Hombre</option>
                    <option value="female">Mujer</option>
                    <option value="other">Otro</option>
                </select>
             </div>
          </div>
          <div className="mt-4">
             <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo Principal</label>
             <input 
              type="text" placeholder="Ej: Controlar glucosa, Perder 5kg..." className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
              value={formData.goals || ''} onChange={e => setFormData({...formData, goals: e.target.value})}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-xl font-semibold text-gray-800">Condición Médica</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Diagnósticos</label>
            <input 
              type="text" placeholder="Ej: Diabetes Tipo 2, Hipertensión (separar por comas)" className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
              value={formData.diagnoses?.join(', ') || ''} 
              onChange={e => setFormData({...formData, diagnoses: e.target.value.split(',').map(s => s.trim())})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alergias</label>
            <input 
              type="text" placeholder="Ej: Nueces, Penicilina..." className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
              value={formData.allergies?.join(', ') || ''} 
              onChange={e => setFormData({...formData, allergies: e.target.value.split(',').map(s => s.trim())})}
            />
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de Actividad</label>
               <select 
                className="p-3 border border-gray-300 rounded-lg w-full bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                value={formData.activityLevel || 'sedentary'} 
                onChange={(e: any) => setFormData({...formData, activityLevel: e.target.value})}
             >
                 <option value="sedentary">Sedentario (Poco o nada)</option>
                 <option value="light">Ligero (1-3 días/semana)</option>
                 <option value="moderate">Moderado (3-5 días/semana)</option>
                 <option value="active">Activo (6-7 días/semana)</option>
             </select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-end">
            <h3 className="text-xl font-semibold text-gray-800">Nutrición</h3>
            <span className="text-xs text-gray-500 italic">Escribe y presiona Enter</span>
          </div>
          
          {/* Allowed Foods Input */}
          <div>
            <label className="block text-sm font-bold text-green-800 mb-2">✅ Alimentos Permitidos / Favoritos</label>
            <div className={`flex flex-wrap items-center gap-2 p-3 border rounded-xl bg-white focus-within:ring-2 focus-within:ring-green-400 min-h-[80px] ${isDiabetic && hasSugarInAllowed ? 'border-red-300 ring-2 ring-red-100' : 'border-green-200'}`}>
                {formData.allowedFoods?.map((food, idx) => (
                    <span key={idx} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 border border-green-200">
                        {food}
                        <button onClick={() => removeTag('allowedFoods', idx)} className="hover:text-green-950 ml-1 font-bold">×</button>
                    </span>
                ))}
                <input 
                    type="text" 
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-gray-900 placeholder-gray-400 p-1"
                    placeholder="Ej: Pollo, Espinaca, Atún..."
                    value={allowedInput}
                    onChange={(e) => setAllowedInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'allowedFoods', allowedInput, setAllowedInput)}
                />
            </div>
            {isDiabetic && hasSugarInAllowed && (
                <p className="text-xs text-red-600 mt-1 font-bold flex items-center gap-1">
                    ⚠️ Advertencia: Tienes diabetes y has añadido azúcar/dulces a permitidos.
                </p>
            )}
            <p className="text-xs text-gray-500 mt-1">Presiona <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> para agregar.</p>
          </div>

          {/* Forbidden Foods Input */}
          <div>
            <label className="block text-sm font-bold text-red-800 mb-2">🚫 Alimentos Prohibidos / A Evitar</label>
            <div className="flex flex-wrap items-center gap-2 p-3 border border-red-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-red-400 min-h-[80px]">
                {formData.forbiddenFoods?.map((food, idx) => (
                    <span key={idx} className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 border border-red-200">
                        {food}
                        <button onClick={() => removeTag('forbiddenFoods', idx)} className="hover:text-red-950 ml-1 font-bold">×</button>
                    </span>
                ))}
                <input 
                    type="text" 
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-gray-900 placeholder-gray-400 p-1"
                    placeholder="Ej: Azúcar, Harina, Refrescos..."
                    value={forbiddenInput}
                    onChange={(e) => setForbiddenInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'forbiddenFoods', forbiddenInput, setForbiddenInput)}
                />
            </div>
            <p className="text-xs text-gray-500 mt-1">La IA filtrará recetas que contengan estos ingredientes.</p>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-8 border-t pt-6">
        {step > 1 ? (
          <button onClick={handleBack} className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition">
            Atrás
          </button>
        ) : <div></div>}
        
        {step < 3 ? (
          <button onClick={handleNext} className="px-6 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 font-medium transition shadow-sm">
            Siguiente
          </button>
        ) : (
          <button onClick={handleComplete} disabled={!email} className="px-6 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 font-bold shadow-md transition transform hover:scale-105 disabled:opacity-50">
            Finalizar Perfil
          </button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;