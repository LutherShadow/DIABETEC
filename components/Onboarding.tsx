
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
  
  const [allowedInput, setAllowedInput] = useState('');
  const [forbiddenInput, setForbiddenInput] = useState('');
  const [email, setEmail] = useState('');

  const handleNext = () => setStep(p => p + 1);
  const handleBack = () => setStep(p => p - 1);

  const handleComplete = () => {
    if (!email.includes('@')) {
        alert("Por favor ingresa un email válido para guardar tu progreso.");
        setStep(1);
        return;
    }

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
        if (!currentList.includes(trimmed)) {
            setFormData({ ...formData, [field]: [...currentList, trimmed] });
        }
        setInput('');
      }
    } else if (e.key === 'Backspace' && !inputValue) {
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

  const isDiabetic = formData.diagnoses?.some(d => d.toLowerCase().includes('diabetes'));
  const hasSugarInAllowed = formData.allowedFoods?.some(f => f.toLowerCase().includes('azúcar') || f.toLowerCase().includes('azucar') || f.toLowerCase().includes('dulce'));

  return (
    <div className="max-w-2xl mx-auto p-10 bg-white rounded-[2.5rem] shadow-2xl mt-10 text-slate-800 border border-slate-100 animate-fade-in mb-10">
      <div className="mb-10 text-center">
        <img src="/logo.png" alt="VidaSalud AI" className="w-48 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Perfil de Salud</h2>
        <p className="text-slate-500 font-medium text-sm">Paso {step} de 3</p>
        <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
          <div className="bg-teal-600 h-2 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${(step / 3) * 100}%` }}></div>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Datos Básicos</h3>
                <div className="flex gap-4 items-center">
                    <button onClick={loadDemoData} className="text-xs text-teal-600 font-black uppercase tracking-widest hover:underline">Demo</button>
                    <button onClick={onLoginClick} className="text-[10px] font-black uppercase tracking-widest bg-teal-50 text-teal-700 px-4 py-2 rounded-xl border border-teal-200 hover:bg-teal-100">Login</button>
                </div>
            </div>
          
          <div>
             <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Correo Electrónico (Tu ID)</label>
             <input 
              type="email" placeholder="ejemplo@correo.com" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
              value={email} onChange={e => setEmail(e.target.value)}
             />
             <p className="text-[10px] text-slate-400 mt-2 italic">Usaremos esto para sincronizar tus planes en la nube.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Nombre</label>
                <input 
                type="text" placeholder="Tu nombre" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
                value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Edad</label>
                <input 
                type="number" placeholder="Ej: 30" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
                value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})}
                />
            </div>
             <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Altura (cm)</label>
                    <input 
                    type="number" placeholder="170" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
                    value={formData.height || ''} onChange={e => setFormData({...formData, height: Number(e.target.value)})}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Peso (kg)</label>
                    <input 
                    type="number" placeholder="70" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
                    value={formData.weight || ''} onChange={e => setFormData({...formData, weight: Number(e.target.value)})}
                    />
                </div>
             </div>
             <div>
                 <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Género</label>
                <select 
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
                    value={formData.gender || 'other'} 
                    onChange={(e: any) => setFormData({...formData, gender: e.target.value})}
                >
                    <option value="male">Hombre</option>
                    <option value="female">Mujer</option>
                    <option value="other">Otro</option>
                </select>
             </div>
          </div>
          <div>
             <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Objetivo Principal</label>
             <input 
              type="text" placeholder="Ej: Controlar glucosa, Perder 5kg..." className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
              value={formData.goals || ''} onChange={e => setFormData({...formData, goals: e.target.value})}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-fade-in">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Condición Médica</h3>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Diagnósticos</label>
            <input 
              type="text" placeholder="Ej: Diabetes Tipo 2, Hipertensión (separar por comas)" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
              value={formData.diagnoses?.join(', ') || ''} 
              onChange={e => setFormData({...formData, diagnoses: e.target.value.split(',').map(s => s.trim())})}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Alergias</label>
            <input 
              type="text" placeholder="Ej: Nueces, Penicilina..." className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
              value={formData.allergies?.join(', ') || ''} 
              onChange={e => setFormData({...formData, allergies: e.target.value.split(',').map(s => s.trim())})}
            />
          </div>
          <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-teal-700 mb-2">Nivel de Actividad</label>
               <select 
                className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold text-slate-900"
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
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nutrición</h3>
            <span className="text-[10px] text-slate-400 italic">Enter para agregar</span>
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">✅ Permitidos / Favoritos</label>
            <div className={`flex flex-wrap items-center gap-2 p-4 border-2 rounded-2xl bg-slate-50 min-h-[100px] transition-all ${isDiabetic && hasSugarInAllowed ? 'border-red-300 ring-4 ring-red-50 bg-red-50/20' : 'border-slate-100 focus-within:border-emerald-400 focus-within:bg-white'}`}>
                {formData.allowedFoods?.map((food, idx) => (
                    <span key={idx} className="bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-200">
                        {food}
                        <button onClick={() => removeTag('allowedFoods', idx)} className="hover:text-emerald-950 font-bold">×</button>
                    </span>
                ))}
                <input 
                    type="text" 
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-slate-900 placeholder-slate-400 p-1 font-bold"
                    placeholder="Ej: Pollo, Espinaca..."
                    value={allowedInput}
                    onChange={(e) => setAllowedInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'allowedFoods', allowedInput, setAllowedInput)}
                />
            </div>
            {isDiabetic && hasSugarInAllowed && (
                <p className="text-[10px] text-red-600 mt-2 font-black uppercase tracking-widest animate-pulse flex items-center gap-2">
                    ⚠️ Advertencia: Diabético + Azúcares detectados
                </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-red-700 mb-2">🚫 Prohibidos / Evitar</label>
            <div className="flex flex-wrap items-center gap-2 p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 min-h-[100px] focus-within:border-red-400 focus-within:bg-white transition-all">
                {formData.forbiddenFoods?.map((food, idx) => (
                    <span key={idx} className="bg-red-100 text-red-800 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 border border-red-200">
                        {food}
                        <button onClick={() => removeTag('forbiddenFoods', idx)} className="hover:text-red-950 font-bold">×</button>
                    </span>
                ))}
                <input 
                    type="text" 
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-slate-900 placeholder-slate-400 p-1 font-bold"
                    placeholder="Ej: Azúcar, Harina..."
                    value={forbiddenInput}
                    onChange={(e) => setForbiddenInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'forbiddenFoods', forbiddenInput, setForbiddenInput)}
                />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic font-medium">La IA filtrará estos ingredientes de tus recetas.</p>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-10 border-t border-slate-100 pt-8">
        {step > 1 ? (
          <button onClick={handleBack} className="px-8 py-4 rounded-2xl border-2 border-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition active:scale-95">
            Atrás
          </button>
        ) : <div></div>}
        
        {step < 3 ? (
          <button onClick={handleNext} className="px-10 py-4 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 font-black uppercase tracking-widest text-xs transition shadow-xl active:scale-95 shadow-teal-100">
            Siguiente
          </button>
        ) : (
          <button onClick={handleComplete} disabled={!email} className="px-10 py-4 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 font-black uppercase tracking-widest text-xs shadow-xl transition transform active:scale-95 disabled:opacity-50 shadow-teal-100">
            Crear Mi Perfil IA
          </button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
