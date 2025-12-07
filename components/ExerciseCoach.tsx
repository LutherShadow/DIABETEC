import React, { useState, useEffect } from 'react';
import { UserProfile, ExerciseRoutine } from '../types';
import { generateExerciseRoutine } from '../services/geminiService';

interface Props {
  profile: UserProfile;
}

const ExerciseCoach: React.FC<Props> = ({ profile }) => {
  const [routine, setRoutine] = useState<ExerciseRoutine | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    let result = await generateExerciseRoutine(profile);
    
    // Medical Logic Injection: Force walking for Diabetics if AI missed it
    if (result && profile.diagnoses.some(d => d.toLowerCase().includes('diabetes'))) {
       if (!result.exercises.some(e => e.name.toLowerCase().includes('camin'))) {
           result.exercises.unshift({
               name: "Caminata Post-Comida",
               reps: "10-15 min",
               duration: "15 min",
               tips: "Camina a paso ligero después de comer para bajar la glucosa.",
               visualDescription: "Walking outdoors or treadmill"
           });
           result.medicalTip = "💡 Tu médico recomienda caminar después de las comidas para mejorar tu control glucémico.";
       }
    }

    setRoutine(result);
    setLoading(false);
  };

  useEffect(() => {
    let interval: any;
    if (timerActive) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-xl shadow-sm print:shadow-none print:p-0">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h2 className="text-2xl font-bold text-orange-700 flex items-center gap-2">
          <span>🏃‍♂️</span> Entrenador Personal
        </h2>
        <div className="flex gap-2">
            {routine && (
                <button 
                  onClick={handlePrint}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  🖨️ PDF
                </button>
            )}
            <button 
              onClick={handleGenerate}
              disabled={loading}
              className="bg-orange-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 shadow-md transition"
            >
              {loading ? 'Diseñando rutina...' : '✨ Nueva Rutina IA'}
            </button>
        </div>
      </div>

      {routine && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Main Info Card */}
          <div className="bg-orange-50 p-6 rounded-xl border border-orange-200 print:border-none print:p-0">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <h3 className="text-3xl font-bold text-orange-900">{routine.title}</h3>
                <p className="text-orange-800 mt-2">{routine.description}</p>
                
                {routine.medicalTip && (
                    <div className="mt-3 bg-white p-3 rounded-lg border border-orange-200 shadow-sm inline-block">
                        <strong className="text-teal-600">Recomendación Médica:</strong> {routine.medicalTip}
                    </div>
                )}

                <div className="flex gap-3 mt-4 print:hidden">
                   <span className="text-xs font-bold bg-white text-orange-800 px-3 py-1 rounded-full border border-orange-200 shadow-sm">⏱ {routine.durationMinutes} min</span>
                   <span className="text-xs font-bold bg-white text-orange-800 px-3 py-1 rounded-full border border-orange-200 shadow-sm">⚡ Intensidad: {routine.intensity}</span>
                </div>
              </div>
              
              <div className="text-center bg-white p-4 rounded-xl shadow-md border border-gray-100 w-full md:w-auto print:hidden">
                 <div className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">Tiempo de Sesión</div>
                 <div className="text-4xl font-mono font-bold text-gray-800 mb-2">{formatTime(timer)}</div>
                 <button 
                   onClick={() => setTimerActive(!timerActive)}
                   className={`w-full text-sm font-bold px-4 py-2 rounded-lg transition ${timerActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                 >
                   {timerActive ? '⏸ Pausar' : '▶️ Iniciar'}
                 </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-xl text-gray-800 border-b pb-2">Circuito de Ejercicios</h4>
            <div className="grid grid-cols-1 gap-4">
            {routine.exercises.map((ex, i) => (
              <div key={i} className="flex flex-col md:flex-row p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition print:border print:shadow-none">
                 {/* Visual Placeholder */}
                 <div className="w-full md:w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center text-4xl mb-4 md:mb-0 md:mr-6 shrink-0 relative overflow-hidden group">
                    <img 
                        src={`https://placehold.co/150x150/orange/white?text=${ex.name.substring(0,3).toUpperCase()}`} 
                        alt={ex.name} 
                        className="w-full h-full object-cover" 
                    />
                    <button 
                        onClick={() => setShowDemoModal(ex.name)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold opacity-0 group-hover:opacity-100 transition print:hidden"
                    >
                        ▶ Ver Demo
                    </button>
                 </div>

                 <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <span className="bg-orange-100 text-orange-800 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">{i + 1}</span>
                            <h5 className="font-bold text-lg text-gray-900">{ex.name}</h5>
                        </div>
                        <div className="text-right">
                             <div className="font-bold text-2xl text-teal-600">{ex.reps}</div>
                             {ex.duration && <div className="text-xs text-gray-500">{ex.duration}</div>}
                        </div>
                    </div>
                    
                    {ex.tips && (
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-4 border-teal-400">
                            <strong>💡 Técnica:</strong> {ex.tips}
                        </p>
                    )}
                 </div>
              </div>
            ))}
            </div>
          </div>

          {routine.safetyNotes && (
             <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                    <strong className="block mb-1">Precaución de Seguridad:</strong> 
                    {routine.safetyNotes}
                </div>
             </div>
          )}
        </div>
      )}
      
      {!routine && !loading && (
          <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <div className="text-6xl mb-4">🤸‍♀️</div>
              <h3 className="text-xl font-bold text-gray-700">Tu Entrenador Personal AI</h3>
              <p className="text-gray-500 max-w-md mx-auto mt-2">
                  Genera una rutina segura adaptada a tu {profile.diagnoses[0] || 'perfil'}, con temporizadores y guías visuales.
              </p>
              <button onClick={handleGenerate} className="mt-6 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 shadow-lg transition">
                  Comenzar Entrenamiento
              </button>
          </div>
      )}

      {/* Demo Modal Simulation */}
      {showDemoModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowDemoModal(null)}>
              <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setShowDemoModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl">✕</button>
                  <h3 className="text-2xl font-bold mb-4">{showDemoModal}</h3>
                  <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                      <div className="text-center">
                          <p className="text-4xl mb-2">🎬</p>
                          <p className="text-gray-500">Video demostrativo simulado</p>
                      </div>
                  </div>
                  <p className="text-center text-gray-600">Aquí se reproduciría un video de 15s mostrando la técnica correcta.</p>
                  <button onClick={() => setShowDemoModal(null)} className="w-full mt-6 bg-teal-600 text-white py-3 rounded-xl font-bold">Entendido</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExerciseCoach;