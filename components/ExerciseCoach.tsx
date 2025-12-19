
import React, { useState, useEffect } from 'react';
import { UserProfile, ExerciseRoutine, Exercise } from '../types';
import { generateExerciseRoutine, generateExerciseImage, analyzeAndAdaptRoutine } from '../services/geminiService';

interface Props {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

const ExerciseCoach: React.FC<Props> = ({ profile, onUpdate }) => {
  const currentRoutine = profile.exerciseRoutine || null;
  const [loading, setLoading] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [importing, setImporting] = useState(false);
  const [shouldCombine, setShouldCombine] = useState(false);
  const [importText, setImportText] = useState('');
  const [currentDay, setCurrentDay] = useState(new Date().getDay());

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const handleGenerate = async () => {
    setLoading(true);
    try {
        let result = await generateExerciseRoutine(profile);
        if (result) onUpdate({ ...profile, exerciseRoutine: result });
    } finally {
        setLoading(false);
    }
  };

  const clearRoutine = () => {
      if (window.confirm("¿Estás seguro de que quieres borrar toda tu rutina actual? Esta acción no se puede deshacer.")) {
          onUpdate({ ...profile, exerciseRoutine: null });
      }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setImporting(false);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result as string;
        const context = shouldCombine ? currentRoutine : null;
        const result = await analyzeAndAdaptRoutine(base64, profile, true, context);
        if (result) onUpdate({ ...profile, exerciseRoutine: result });
        setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleTextImport = async () => {
    if (!importText) return;
    setLoading(true);
    setImporting(false);
    try {
        const context = shouldCombine ? currentRoutine : null;
        const result = await analyzeAndAdaptRoutine(importText, profile, false, context);
        if (result) onUpdate({ ...profile, exerciseRoutine: result });
    } finally {
        setLoading(false);
        setImportText('');
    }
  };

  const toggleComplete = (exerciseId: string) => {
    if (!currentRoutine) return;
    const newExercises = currentRoutine.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex
    );
    onUpdate({ ...profile, exerciseRoutine: { ...currentRoutine, exercises: newExercises } });
  };

  const moveExerciseToTomorrow = (exerciseId: string) => {
    if (!currentRoutine) return;
    const nextDay = (currentDay + 1) % 7;
    const newExercises = currentRoutine.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, scheduledDay: nextDay, completed: false } : ex
    );
    onUpdate({ ...profile, exerciseRoutine: { ...currentRoutine, exercises: newExercises } });
    alert("Ejercicio postergado para mañana 🗓️. La IA mantendrá el balance semanal.");
  };

  const getDayExercises = (dayIdx: number) => {
    return currentRoutine?.exercises.filter(ex => ex.scheduledDay === dayIdx) || [];
  };

  const openDetails = async (ex: Exercise) => {
    setSelectedExercise(ex);
    if (!ex.imageUrl) {
        const img = await generateExerciseImage(ex.name);
        if (img && currentRoutine) {
            const newExercises = currentRoutine.exercises.map(e => 
                e.id === ex.id ? { ...e, imageUrl: img } : e
            );
            const updatedEx = { ...ex, imageUrl: img };
            setSelectedExercise(updatedEx);
            onUpdate({ ...profile, exerciseRoutine: { ...currentRoutine, exercises: newExercises } });
        }
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-xl shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-orange-700 flex items-center gap-2">
            <span>🏃‍♂️</span> Entrenador AI
            </h2>
            <p className="text-gray-500 text-sm">Adaptación y fraccionamiento inteligente de ejercicios.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            {currentRoutine && (
                <button 
                    onClick={clearRoutine}
                    className="flex-1 md:flex-none border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                    Limpiar
                </button>
            )}
            <button 
                onClick={() => setImporting(true)}
                className="flex-1 md:flex-none border border-orange-200 text-orange-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50"
            >
                📥 Importar
            </button>
            <button 
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 md:flex-none bg-orange-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 shadow-md transition-all active:scale-95"
            >
                {loading ? 'Analizando...' : '✨ Nueva IA'}
            </button>
        </div>
      </div>

      {/* Selector de Día */}
      <div className="flex justify-between bg-gray-50 p-2 rounded-2xl border overflow-x-auto no-scrollbar shadow-inner">
        {days.map((day, idx) => {
            const hasExercises = getDayExercises(idx).length > 0;
            return (
                <button 
                    key={day}
                    onClick={() => setCurrentDay(idx)}
                    className={`flex-1 min-w-[50px] py-3 px-1 rounded-xl transition-all flex flex-col items-center relative ${currentDay === idx ? 'bg-orange-600 text-white shadow-lg font-bold scale-105 z-10' : 'text-gray-400 hover:bg-orange-50'}`}
                >
                    <span className="text-[10px] uppercase tracking-widest mb-0.5">{day}</span>
                    <span className="text-sm font-black">{new Date().getDate() + (idx - new Date().getDay())}</span>
                    {hasExercises && (
                        <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${currentDay === idx ? 'bg-white' : 'bg-orange-500'}`}></div>
                    )}
                </button>
            )
        })}
      </div>

      {loading && (
          <div className="py-24 text-center">
              <div className="text-6xl mb-4 animate-bounce">🦾</div>
              <p className="text-orange-600 font-black italic text-xl animate-pulse uppercase tracking-widest">Personalizando tu carga de trabajo...</p>
          </div>
      )}

      {!loading && currentRoutine && (
          <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-50 to-white p-5 rounded-2xl border-l-8 border-orange-500 flex flex-col md:flex-row justify-between items-center gap-3">
                  <div className="text-center md:text-left">
                      <h3 className="font-black text-orange-900 leading-tight uppercase tracking-tighter text-xl">{currentRoutine.title}</h3>
                      <p className="text-xs text-orange-700 font-medium">Original: {currentRoutine.originalMethod || "Método Saludable"}</p>
                  </div>
                  <div className="text-[10px] bg-white text-orange-600 px-4 py-1 rounded-full font-black border-2 border-orange-200 shadow-sm uppercase tracking-widest">
                      Nivel: {currentRoutine.intensity}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getDayExercises(currentDay).length === 0 ? (
                      <div className="col-span-full py-16 text-center bg-gray-50 rounded-3xl border-4 border-dashed border-gray-100">
                          <div className="text-4xl mb-2 opacity-30">🛌</div>
                          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Día de Recuperación</p>
                      </div>
                  ) : (
                      getDayExercises(currentDay).map((ex) => (
                          <div key={ex.id} className={`group border-2 rounded-3xl p-5 transition-all flex items-center gap-4 ${ex.completed ? 'bg-green-50 border-green-200 opacity-60' : 'bg-white hover:border-orange-400 shadow-md'}`}>
                              <button 
                                onClick={() => toggleComplete(ex.id)}
                                className={`w-14 h-14 rounded-2xl border-4 flex items-center justify-center shrink-0 transition-all ${ex.completed ? 'bg-green-500 border-green-600 text-white' : 'bg-gray-50 border-gray-100 hover:border-orange-400 text-transparent hover:text-orange-200'}`}
                              >
                                  <span className="text-2xl">✓</span>
                              </button>
                              <div className="flex-1 cursor-pointer" onClick={() => openDetails(ex)}>
                                  <h4 className={`font-black uppercase tracking-tight leading-tight ${ex.completed ? 'text-green-800 line-through' : 'text-gray-800'}`}>
                                      {ex.name}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1.5">
                                      {ex.sets ? (
                                          <div className="flex items-center gap-1">
                                              <span className="text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded-md font-black italic">
                                                  {ex.sets} SETS
                                              </span>
                                              <span className="text-[10px] text-orange-700 font-bold uppercase">x {ex.repsPerSet}</span>
                                          </div>
                                      ) : (
                                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-black italic uppercase">
                                              {ex.reps}
                                          </span>
                                      )}
                                  </div>
                              </div>
                              <button onClick={() => moveExerciseToTomorrow(ex.id)} title="Postergar" className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition opacity-0 group-hover:opacity-100">
                                  🗓️
                              </button>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* Modal Importar */}
      {importing && (
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-scale-in border border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">📥 Importar Rutina</h3>
                      <button onClick={() => setImporting(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="bg-orange-50 p-4 rounded-2xl border-2 border-orange-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <span className="text-2xl">🔄</span>
                              <div className="leading-none">
                                  <p className="text-xs font-black text-orange-900 uppercase">Modo Combinar</p>
                                  <p className="text-[10px] text-orange-700 font-medium">No sobreescribir la actual</p>
                              </div>
                          </div>
                          <button 
                            onClick={() => setShouldCombine(!shouldCombine)}
                            className={`w-14 h-8 rounded-full transition-all relative ${shouldCombine ? 'bg-orange-600' : 'bg-gray-300'}`}
                          >
                              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${shouldCombine ? 'left-7' : 'left-1'}`}></div>
                          </button>
                      </div>

                      <label className="block border-4 border-dashed border-gray-100 rounded-[2rem] p-12 text-center cursor-pointer hover:bg-gray-50 hover:border-orange-300 transition-all group">
                          <input type="file" accept="image/*" onChange={handleImport} className="hidden" />
                          <span className="text-5xl block mb-3 group-hover:rotate-6 transition-transform">📄</span>
                          <span className="font-black text-gray-700 uppercase tracking-widest text-[10px]">Escanear PDF o Captura</span>
                      </label>

                      <div className="relative">
                          <textarea 
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="Pega el texto aquí..."
                            className="w-full h-32 border-4 border-gray-50 rounded-2xl p-4 text-sm focus:ring-0 focus:border-orange-200 outline-none transition-all resize-none font-medium"
                          />
                          <button 
                            onClick={handleTextImport}
                            disabled={!importText || loading}
                            className="w-full mt-4 bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-700 transition shadow-xl disabled:opacity-50 active:scale-95"
                          >
                            Procesar y Fraccionar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Detalle */}
      {selectedExercise && (
          <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="relative h-72 shrink-0 bg-gray-950">
                      {selectedExercise.imageUrl ? (
                          <img src={selectedExercise.imageUrl} className="w-full h-full object-cover opacity-80" alt={selectedExercise.name} />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 animate-pulse">
                              <span className="text-4xl">🏃</span>
                          </div>
                      )}
                      <button onClick={() => setSelectedExercise(null)} className="absolute top-8 right-8 bg-white/10 hover:bg-white/30 text-white w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center text-xl transition">✕</button>
                      <div className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black via-black/40 to-transparent text-white">
                          <h3 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">{selectedExercise.name}</h3>
                          <div className="flex gap-2">
                              <span className="bg-orange-600 text-[10px] px-4 py-1.5 rounded-full font-black uppercase italic tracking-widest">
                                  {selectedExercise.sets ? `${selectedExercise.sets} SETS x ${selectedExercise.repsPerSet}` : selectedExercise.reps}
                              </span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-10 space-y-8 overflow-y-auto no-scrollbar">
                      <div className="bg-blue-50 p-6 rounded-[2rem] border-2 border-blue-100">
                          <div className="flex items-center gap-2 mb-3">
                              <span className="text-xl">🩺</span>
                              <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Beneficio Clínico</h5>
                          </div>
                          <p className="text-xs text-blue-900 leading-relaxed font-bold italic">
                              "{selectedExercise.medicalReasoning || "Ejercicio adaptado para mejorar tu capacidad cardiovascular de forma segura."}"
                          </p>
                      </div>

                      <div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4">Instrucciones</h4>
                          <p className="text-gray-700 text-sm leading-relaxed font-medium bg-gray-50 p-5 rounded-2xl">
                              {selectedExercise.tips}
                          </p>
                      </div>

                      <div className="flex gap-4">
                          <div className="flex-1 bg-green-50 p-5 rounded-2xl border border-green-100">
                              <h5 className="text-[9px] font-black uppercase text-green-700 mb-2">Objetivo</h5>
                              <p className="text-[11px] text-green-800 font-bold">{selectedExercise.benefits}</p>
                          </div>
                          <div className="flex-1 bg-red-50 p-5 rounded-2xl border border-red-100">
                              <h5 className="text-[9px] font-black uppercase text-red-700 mb-2">Alerta</h5>
                              <p className="text-[11px] text-red-800 font-bold">{selectedExercise.medicalCaution}</p>
                          </div>
                      </div>

                      <button 
                        onClick={() => { toggleComplete(selectedExercise.id); setSelectedExercise(null); }}
                        className={`w-full py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-sm transition-all shadow-2xl hover:scale-[1.03] active:scale-95 ${selectedExercise.completed ? 'bg-gray-100 text-gray-400' : 'bg-orange-600 text-white'}`}
                      >
                          {selectedExercise.completed ? 'Pendiente' : 'Completado'}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default ExerciseCoach;
