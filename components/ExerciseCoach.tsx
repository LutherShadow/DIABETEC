
import React, { useState, useEffect } from 'react';
import { UserProfile, ExerciseRoutine } from '../types';
import { generateExerciseRoutine, generateExerciseImage } from '../services/geminiService';

interface Props {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

const ExerciseCoach: React.FC<Props> = ({ profile, onUpdate }) => {
  const currentRoutine = profile.exerciseRoutine || null;
  const [loading, setLoading] = useState(false);
  const [generatingImg, setGeneratingImg] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
        let result = await generateExerciseRoutine(profile);
        if (result) {
            const updatedProfile = { ...profile, exerciseRoutine: result };
            onUpdate(updatedProfile);
        }
    } catch (e) {
        console.error("Error generating routine", e);
    } finally {
        setLoading(false);
    }
  };

  const handleLoadImage = async (exerciseName: string, index: number) => {
    if (!currentRoutine) return;
    setGeneratingImg(exerciseName);
    try {
        const imageUrl = await generateExerciseImage(exerciseName);
        if (imageUrl) {
            const newExercises = [...currentRoutine.exercises];
            newExercises[index] = { ...newExercises[index], imageUrl };
            const newRoutine = { ...currentRoutine, exercises: newExercises };
            onUpdate({ ...profile, exerciseRoutine: newRoutine });
        }
    } finally {
        setGeneratingImg(null);
    }
  };

  useEffect(() => {
    let interval: any;
    if (timerActive) interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-orange-700 flex items-center gap-2">
          <span>🏃‍♂️</span> Entrenador AI
        </h2>
        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="bg-orange-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition shadow-sm"
        >
          {loading ? 'Preparando...' : (currentRoutine ? 'Nueva Rutina' : 'Generar Rutina')}
        </button>
      </div>

      {currentRoutine && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-orange-50 p-6 rounded-xl border border-orange-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-orange-900">{currentRoutine.title}</h3>
              <p className="text-orange-800 text-sm mt-1">{currentRoutine.description}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border text-center min-w-[120px]">
               <div className="text-3xl font-mono font-bold text-gray-800">{formatTime(timer)}</div>
               <button onClick={() => setTimerActive(!timerActive)} className="text-xs font-bold text-orange-600 uppercase mt-2 hover:underline">
                 {timerActive ? 'Pausar' : 'Iniciar'}
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentRoutine.exercises.map((ex, i) => (
              <div key={i} className="flex p-4 border rounded-xl bg-white hover:shadow-md transition gap-4 border-b-4 border-orange-200">
                 <div className="w-24 h-24 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border">
                    {ex.imageUrl ? (
                        <img src={ex.imageUrl} className="w-full h-full object-cover" alt={ex.name} />
                    ) : (
                        <button 
                            onClick={() => handleLoadImage(ex.name, i)}
                            disabled={generatingImg === ex.name}
                            className="text-[10px] font-bold text-gray-400 p-2 text-center hover:text-orange-600"
                        >
                            {generatingImg === ex.name ? '...' : '📸 Generar Guía'}
                        </button>
                    )}
                 </div>
                 <div className="flex-1">
                    <h5 className="font-bold text-gray-800 leading-tight mb-1">{ex.name}</h5>
                    <div className="text-orange-600 font-bold text-lg">{ex.reps}</div>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1 italic">{ex.tips}</p>
                 </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border text-xs text-gray-500 italic">
              <b>Nota de Seguridad:</b> {currentRoutine.safetyNotes}
          </div>
        </div>
      )}

      {!currentRoutine && !loading && (
          <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="text-6xl mb-4 grayscale opacity-50">🤸‍♀️</div>
              <h3 className="font-bold text-gray-700 text-lg">Tu rutina personalizada</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">Basada en tu perfil médico y objetivos físicos. ¡Presiona generar para comenzar!</p>
          </div>
      )}
    </div>
  );
};

export default ExerciseCoach;
