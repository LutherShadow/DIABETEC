
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  
  // Ahora guardamos la fecha completa seleccionada, no solo el índice 0-6
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const daysLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthsLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Generar 14 días a partir del inicio de la semana actual
  const calendarDays = useMemo(() => {
    const dates = [];
    const today = new Date();
    // Empezamos desde el domingo de la semana actual
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, []);

  // Determinar si la rutina actual necesita adaptación
  const isRoutineAdapted = useMemo(() => {
    if (!currentRoutine) return true;
    return currentRoutine.exercises.every(ex => ex.isAdapted);
  }, [currentRoutine]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
        let result = await generateExerciseRoutine(profile);
        if (result) onUpdate({ ...profile, exerciseRoutine: result });
    } finally {
        setLoading(false);
    }
  };

  const handleReadapt = async () => {
      if (!currentRoutine) return;
      setLoading(true);
      try {
          const result = await analyzeAndAdaptRoutine("RE-ADAPTAR ESTA RUTINA AL PERFIL ACTUAL", profile, false, currentRoutine);
          if (result) {
              onUpdate({ ...profile, exerciseRoutine: result });
              alert("Rutina optimizada con éxito ✅. Ahora cada ejercicio respeta tu nivel de actividad y diagnóstico.");
          }
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
    // Mover al día siguiente en el ciclo de 7 días
    const currentRoutineDay = selectedDate.getDay();
    const nextRoutineDay = (currentRoutineDay + 1) % 7;
    const newExercises = currentRoutine.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, scheduledDay: nextRoutineDay, completed: false } : ex
    );
    onUpdate({ ...profile, exerciseRoutine: { ...currentRoutine, exercises: newExercises } });
    alert("Ejercicio postergado para el siguiente día del ciclo 🗓️.");
  };

  const getDayExercises = (date: Date) => {
    const routineDay = date.getDay(); // 0-6
    return currentRoutine?.exercises.filter(ex => ex.scheduledDay === routineDay) || [];
  };

  const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
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
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {currentRoutine && (
                <>
                    <button 
                        onClick={handleReadapt}
                        disabled={loading}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest border transition shadow-sm ${!isRoutineAdapted ? 'bg-orange-600 border-orange-500 text-white animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                    >
                        {isRoutineAdapted ? '🔄 Re-adaptar' : '⚡ Adaptar Ahora'}
                    </button>
                    <button 
                        onClick={clearRoutine}
                        className="flex-1 md:flex-none border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
                    >
                        Limpiar
                    </button>
                </>
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
                {loading ? 'Procesando...' : '✨ Nueva IA'}
            </button>
        </div>
      </div>

      {/* Banner de Advertencia si no está adaptada */}
      {!isRoutineAdapted && currentRoutine && (
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl flex items-center gap-4">
              <span className="text-3xl animate-bounce">⚠️</span>
              <div>
                  <h4 className="text-sm font-black text-orange-900 uppercase">Rutina no optimizada</h4>
                  <p className="text-xs text-orange-700">Esta rutina no ha sido filtrada por la IA para tus diagnósticos. Podría ser de alto impacto. <b>Usa el botón "Adaptar Ahora"</b>.</p>
              </div>
          </div>
      )}

      {/* Profile Context Banner */}
      <div className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
              <span className="text-xl">📊</span>
              <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Contexto de Salud</p>
                  <p className="text-xs font-bold text-gray-700">
                    Nivel: <span className="text-orange-600 uppercase">{profile.activityLevel}</span> | 
                    Diagnósticos: <span className="text-teal-700">{profile.diagnoses.join(', ') || 'General'}</span>
                  </p>
              </div>
          </div>
          <p className="text-[9px] text-gray-400 italic text-right max-w-[150px] leading-tight">La IA ajusta reps y descanso según estos datos.</p>
      </div>

      {/* Selector de Calendario Extendido (14 Días) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {monthsLabels[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </span>
            <span className="text-[9px] text-gray-400 font-bold uppercase">Ciclo de 7 días adaptado</span>
        </div>
        <div 
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-1 snap-x shadow-inner rounded-2xl bg-gray-50/50 border border-gray-100"
        >
            {calendarDays.map((date, idx) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());
                const exercises = getDayExercises(date);
                const hasExercises = exercises.length > 0;
                
                return (
                    <button 
                        key={idx}
                        onClick={() => setSelectedDate(date)}
                        className={`flex-shrink-0 w-16 py-4 rounded-2xl transition-all flex flex-col items-center snap-center relative border-2 ${
                            isSelected 
                            ? 'bg-orange-600 border-orange-400 text-white shadow-xl scale-110 z-10' 
                            : 'bg-white border-transparent text-gray-400 hover:border-orange-100 hover:bg-orange-50/30'
                        }`}
                    >
                        <span className={`text-[9px] uppercase font-black tracking-tighter mb-1 ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>
                            {daysLabels[date.getDay()]}
                        </span>
                        <span className="text-lg font-black leading-none">{date.getDate()}</span>
                        
                        {isToday && !isSelected && (
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                        )}
                        
                        {hasExercises && (
                            <div className={`w-1 h-1 rounded-full absolute bottom-2 ${isSelected ? 'bg-white' : 'bg-orange-300'}`}></div>
                        )}
                    </button>
                )
            })}
        </div>
      </div>

      {loading && (
          <div className="py-24 text-center">
              <div className="text-6xl mb-4 animate-bounce">🦾</div>
              <p className="text-orange-600 font-black italic text-xl animate-pulse uppercase tracking-widest">Personalizando rutina...</p>
          </div>
      )}

      {!loading && currentRoutine && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-orange-50 to-white p-5 rounded-2xl border-l-8 border-orange-500 flex flex-col md:flex-row justify-between items-center gap-3">
                  <div className="text-center md:text-left">
                      <h3 className="font-black text-orange-900 leading-tight uppercase tracking-tighter text-xl">{currentRoutine.title}</h3>
                      <p className="text-xs text-orange-700 font-medium">Ciclo: {currentRoutine.originalMethod || "VidaSalud AI Custom"}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                      <div className={`text-[10px] px-4 py-1 rounded-full font-black border-2 shadow-sm uppercase tracking-widest ${isRoutineAdapted ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                          {isRoutineAdapted ? '✅ IA Optimizada' : '⚠️ Pendiente'}
                      </div>
                      <div className="text-[10px] bg-white text-orange-600 px-4 py-1 rounded-full font-black border-2 border-orange-200 shadow-sm uppercase tracking-widest">
                          {currentRoutine.intensity}
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getDayExercises(selectedDate).length === 0 ? (
                      <div className="col-span-full py-20 text-center bg-gray-50 rounded-[2.5rem] border-4 border-dashed border-gray-100 flex flex-col items-center">
                          <div className="text-5xl mb-3 opacity-30 grayscale">🛌</div>
                          <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Descanso y Recuperación</p>
                          <p className="text-[10px] text-gray-300 mt-1">Tu cuerpo necesita tiempo para reparar fibras musculares.</p>
                      </div>
                  ) : (
                      getDayExercises(selectedDate).map((ex) => (
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
                                      {!ex.isAdapted && (
                                          <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-black border border-red-100 animate-pulse">REVISAR</span>
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
                      <h3 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">📥 Importar y Adaptar</h3>
                      <button onClick={() => setImporting(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="bg-orange-50 p-4 rounded-2xl border-2 border-orange-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <span className="text-2xl">🔄</span>
                              <div className="leading-none">
                                  <p className="text-xs font-black text-orange-900 uppercase">Combinar con actual</p>
                                  <p className="text-[10px] text-orange-700 font-medium">No reemplaza, suma</p>
                              </div>
                          </div>
                          <button 
                            onClick={() => setShouldCombine(!shouldCombine)}
                            className={`w-14 h-8 rounded-full transition-all relative ${shouldCombine ? 'bg-orange-600' : 'bg-gray-300'}`}
                          >
                              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${shouldCombine ? 'left-7' : 'left-1'}`}></div>
                          </button>
                      </div>

                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                          <span className="text-xl">🩺</span>
                          <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                              Al importar, la IA ajustará automáticamente el número de series y el tipo de movimiento según tu nivel <b>{profile.activityLevel}</b> y diagnóstico <b>{profile.diagnoses.join(', ') || 'general'}</b>.
                          </p>
                      </div>

                      <label className="block border-4 border-dashed border-gray-100 rounded-[2rem] p-12 text-center cursor-pointer hover:bg-gray-50 hover:border-orange-300 transition-all group">
                          <input type="file" accept="image/*" onChange={handleImport} className="hidden" />
                          <span className="text-5xl block mb-3 group-hover:rotate-6 transition-transform">📄</span>
                          <span className="font-black text-gray-700 uppercase tracking-widest text-[10px]">Analizar PDF o Captura</span>
                      </label>

                      <div className="relative">
                          <textarea 
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder="Pega el texto de la rutina aquí..."
                            className="w-full h-32 border-4 border-gray-50 rounded-2xl p-4 text-sm focus:ring-0 focus:border-orange-200 outline-none transition-all resize-none font-medium text-gray-900"
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
                              <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Por qué es seguro para ti</h5>
                          </div>
                          <p className="text-xs text-blue-900 leading-relaxed font-bold italic">
                              "{selectedExercise.medicalReasoning || "Este ejercicio ha sido adaptado para tu nivel y condición médica."}"
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
