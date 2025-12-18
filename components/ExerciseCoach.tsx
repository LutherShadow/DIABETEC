
import React, { useState, useEffect } from 'react';
import { UserProfile, ExerciseRoutine } from '../types';
import { generateExerciseRoutine, generateExerciseImage } from '../services/geminiService';
import { saveProfile } from '../services/storageService';

interface Props {
  profile: UserProfile;
}

const ExerciseCoach: React.FC<Props> = ({ profile }) => {
  const [routine, setRoutine] = useState<ExerciseRoutine | null>(profile.exerciseRoutine || null);
  const [loading, setLoading] = useState(false);
  const [generatingImg, setGeneratingImg] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    let result = await generateExerciseRoutine(profile);
    if (result) {
        const updatedProfile = { ...profile, exerciseRoutine: result };
        setRoutine(result);
        saveProfile(updatedProfile);
    }
    setLoading(false);
  };

  const handleLoadImage = async (exerciseName: string, index: number) => {
    if (!routine) return;
    setGeneratingImg(exerciseName);
    try {
        const imageUrl = await generateExerciseImage(exerciseName);
        if (imageUrl) {
            const newExercises = [...routine.exercises];
            newExercises[index].imageUrl = imageUrl;
            const newRoutine = { ...routine, exercises: newExercises };
            setRoutine(newRoutine);
            saveProfile({ ...profile, exerciseRoutine: newRoutine });
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
          className="bg-orange-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? 'Preparando...' : (routine ? 'Nueva Rutina' : 'Generar Rutina')}
        </button>
      </div>

      {routine && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-orange-50 p-6 rounded-xl border border-orange-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-orange-900">{routine.title}</h3>
              <p className="text-orange-800 text-sm">{routine.description}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border text-center min-w-[120px]">
               <div className="text-3xl font-mono font-bold">{formatTime(timer)}</div>
               <button onClick={() => setTimerActive(!timerActive)} className="text-xs font-bold text-orange-600 uppercase mt-1">
                 {timerActive ? 'Pausar' : 'Iniciar'}
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routine.exercises.map((ex, i) => (
              <div key={i} className="flex p-4 border rounded-xl bg-white hover:shadow-md transition gap-4">
                 <div className="w-24 h-24 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border">
                    {ex.imageUrl ? (
                        <img src={ex.imageUrl} className="w-full h-full object-cover" alt={ex.name} />
                    ) : (
                        <button 
                            onClick={() => handleLoadImage(ex.name, i)}
                            disabled={generatingImg === ex.name}
                            className="text-[10px] font-bold text-gray-400 p-2 text-center"
                        >
                            {generatingImg === ex.name ? '...' : '📸 Generar Guía'}
                        </button>
                    )}
                 </div>
                 <div className="flex-1">
                    <h5 className="font-bold text-gray-800">{ex.name}</h5>
                    <div className="text-teal-600 font-bold text-lg">{ex.reps}</div>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{ex.tips}</p>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!routine && !loading && (
          <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed">
              <div className="text-6xl mb-4">🤸‍♀️</div>
              <h3 className="font-bold">Tu rutina personalizada</h3>
              <p className="text-sm text-gray-500">Basada en tu perfil médico.</p>
          </div>
      )}
    </div>
  );
};

export default ExerciseCoach;
