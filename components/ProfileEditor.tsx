
import React, { useState } from 'react';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

const ProfileEditor: React.FC<Props> = ({ profile, onUpdate }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    alert("Perfil actualizado correctamente.");
  };

  const handleDiagnosisToggle = (val: string) => {
      const current = formData.diagnoses || [];
      const updated = current.includes(val) 
        ? current.filter(d => d !== val) 
        : [...current, val];
      setFormData({ ...formData, diagnoses: updated });
  };

  const commonDiagnoses = ["Diabetes Tipo 1", "Diabetes Tipo 2", "Hipertensión", "Obesidad", "Asma", "Artritis"];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <header className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-black text-teal-800 tracking-tighter uppercase">Configuración de Salud</h2>
            <p className="text-gray-500 text-sm font-medium">Estos datos controlan cómo la IA adapta tus planes.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8 md:p-12 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Nombre Completo</label>
                  <input 
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 focus:border-teal-400 outline-none transition-all font-bold"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Edad</label>
                    <input 
                        type="number"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 focus:border-teal-400 outline-none transition-all font-bold"
                        value={formData.age}
                        onChange={e => setFormData({ ...formData, age: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Peso (kg)</label>
                    <input 
                        type="number"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 focus:border-teal-400 outline-none transition-all font-bold"
                        value={formData.weight}
                        onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                    />
                  </div>
              </div>
          </div>

          <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Nivel de Actividad Diaria</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(['sedentary', 'light', 'moderate', 'active', 'athlete'] as const).map(level => (
                      <button 
                        key={level}
                        type="button"
                        onClick={() => setFormData({ ...formData, activityLevel: level })}
                        className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${formData.activityLevel === level ? 'bg-orange-600 border-orange-400 text-white shadow-lg scale-105' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-orange-200'}`}
                      >
                          {level === 'sedentary' ? 'Sedentario' : 
                           level === 'light' ? 'Ligero' :
                           level === 'moderate' ? 'Moderado' :
                           level === 'active' ? 'Activo' : 'Atleta'}
                      </button>
                  ))}
              </div>
              <p className="mt-3 text-[10px] text-gray-400 italic">Cambiar esto afectará el volumen de series y repeticiones de tus rutinas.</p>
          </div>

          <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Diagnósticos Médicos</label>
              <div className="flex flex-wrap gap-2">
                  {commonDiagnoses.map(d => (
                      <button 
                        key={d}
                        type="button"
                        onClick={() => handleDiagnosisToggle(d)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${formData.diagnoses.includes(d) ? 'bg-teal-700 border-teal-500 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-teal-100'}`}
                      >
                          {formData.diagnoses.includes(d) && <span className="mr-2">✓</span>}
                          {d}
                      </button>
                  ))}
              </div>
          </div>

          <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Metas de Salud</label>
              <textarea 
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] p-6 focus:border-teal-400 outline-none transition-all font-medium resize-none"
                rows={3}
                placeholder="Ej: Bajar niveles de glucosa, mejorar resistencia cardiovascular..."
                value={formData.goals}
                onChange={e => setFormData({ ...formData, goals: e.target.value })}
              />
          </div>

          <button 
            type="submit"
            className="w-full bg-teal-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-sm shadow-xl hover:bg-teal-700 transition-all active:scale-95"
          >
            Guardar Cambios y Actualizar IA
          </button>

      </form>
    </div>
  );
};

export default ProfileEditor;
