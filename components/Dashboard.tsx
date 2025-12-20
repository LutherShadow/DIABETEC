
import React, { useEffect, useState, useMemo } from 'react';
import { UserProfile, ViewState, MealTime, Medication } from '../types';
import { recordMedicationDose } from '../services/storageService';

interface Props {
  profile: UserProfile;
  onChangeView: (view: ViewState) => void;
  onUpdate: (profile: UserProfile) => void;
}

const Dashboard: React.FC<Props> = ({ profile, onChangeView, onUpdate }) => {
  const pendingMedsCount = profile.medications.filter(m => !m.takenToday).length;
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [now, setNow] = useState(new Date());

  // Actualizar el reloj interno cada minuto para la lógica de "10 min"
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  };

  // Encontrar la toma más cercana en el futuro para hoy
  const upcomingDose = useMemo(() => {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    let closest: { med: Medication; time: string; diff: number } | null = null;

    profile.medications.forEach(med => {
      if (med.scheduleType === 'fixed' && med.fixedTimes && !med.takenToday) {
        med.fixedTimes.forEach(time => {
          const [h, m] = time.split(':').map(Number);
          const targetMins = h * 60 + m;
          const diff = targetMins - currentMins;
          
          // Buscamos la dosis más cercana que aún no ha pasado o está por pasar
          if (diff > -5 && (closest === null || diff < closest.diff)) {
             closest = { med, time, diff };
          }
        });
      }
    });
    return closest;
  }, [profile.medications, now]);

  const handleTakeQuickly = (id: string) => {
      const updated = recordMedicationDose(id);
      onUpdate(updated);
  };

  const handleLogMeal = (meal: MealTime) => {
      const beforeMeds = profile.medications.filter(m => 
          !m.takenToday && 
          m.scheduleType === 'meal_relative' && 
          m.mealTriggers?.some(t => t.meal === meal && t.timing === 'before')
      );

      if (beforeMeds.length > 0) {
          const names = beforeMeds.map(m => m.name).join(', ');
          alert(`⚠️ MEDICAMENTOS ANTES DE COMER:\nDebes tomar: ${names} antes de iniciar tu ${meal}.`);
      }

      const afterMeds = profile.medications.filter(m => 
        !m.takenToday && 
        m.scheduleType === 'meal_relative' && 
        m.mealTriggers?.some(t => t.meal === meal && t.timing === 'after')
      );

      if (afterMeds.length > 0) {
          const names = afterMeds.map(m => m.name).join(', ');
          alert(`✅ Comida registrada. En 15-20 minutos te avisaremos para tomar: ${names}`);
          // Lógica de timeout para notificación browser si se desea aquí
      }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Hola, {profile.name.split(' ')[0]} 👋</h1>
            <p className="text-gray-500 text-sm">Tu asistente de salud está activo.</p>
        </div>
        <div className="bg-white p-2 rounded-xl shadow-sm border text-xs font-bold text-gray-400">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* Widget de Próxima Toma (Lógica de 10 minutos) */}
      {upcomingDose && (
          <div className={`p-5 rounded-[2rem] border-2 transition-all duration-500 shadow-xl ${
              upcomingDose.diff <= 10 && upcomingDose.diff > 0 
              ? 'bg-orange-600 border-orange-400 text-white animate-pulse' 
              : 'bg-white border-teal-100 text-gray-800'
          }`}>
              <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                      <span className="text-3xl">{upcomingDose.diff <= 10 ? '🚨' : '⏰'}</span>
                      <div>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${upcomingDose.diff <= 10 ? 'text-orange-100' : 'text-teal-600'}`}>
                              {upcomingDose.diff <= 10 ? 'Preparación Inmediata' : 'Próxima Medicina'}
                          </p>
                          <h3 className="text-xl font-black uppercase tracking-tighter">{upcomingDose.med.name}</h3>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className="text-2xl font-black">{upcomingDose.time}</p>
                      <p className="text-[10px] opacity-70 uppercase font-bold">
                          {upcomingDose.diff <= 0 ? '¡Ya es hora!' : `En ${upcomingDose.diff} min`}
                      </p>
                  </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => handleTakeQuickly(upcomingDose!.med.id)}
                    className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                        upcomingDose.diff <= 10 
                        ? 'bg-white text-orange-600 hover:bg-orange-50' 
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                      Marcar como Tomada
                  </button>
                  <button 
                    onClick={() => onChangeView('medications')}
                    className={`px-4 py-3 rounded-2xl font-black text-xs uppercase transition-all ${
                        upcomingDose.diff <= 10 ? 'bg-orange-700 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                      Ver Plan
                  </button>
              </div>
          </div>
      )}

      {/* Permission Banner */}
      {notificationPermission !== 'granted' && (
          <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <span className="text-2xl">🔔</span>
                  <p className="text-xs font-medium leading-tight">Activa notificaciones para recibir avisos 10 min antes de tus dosis.</p>
              </div>
              <button onClick={requestPermission} className="bg-white text-blue-700 px-4 py-2 rounded-xl text-xs font-black uppercase">Activar</button>
          </div>
      )}

      {/* Meal Logging */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Registro de Nutrición</h3>
          <div className="flex gap-2">
              <button onClick={() => handleLogMeal('breakfast')} className="flex-1 bg-orange-50 text-orange-700 py-3 rounded-2xl hover:bg-orange-100 font-black text-xs uppercase transition-all border border-orange-100">Desayuno</button>
              <button onClick={() => handleLogMeal('lunch')} className="flex-1 bg-green-50 text-green-700 py-3 rounded-2xl hover:bg-green-100 font-black text-xs uppercase transition-all border border-green-100">Almuerzo</button>
              <button onClick={() => handleLogMeal('dinner')} className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-2xl hover:bg-blue-100 font-black text-xs uppercase transition-all border border-blue-100">Cena</button>
          </div>
      </div>

      {/* Grid Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div onClick={() => onChangeView('medications')} className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-[2rem] p-8 text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden group">
          <div className="absolute -top-4 -right-4 p-4 opacity-10 text-9xl group-hover:rotate-12 transition-transform">💊</div>
          <h3 className="text-sm font-black uppercase tracking-widest mb-1 opacity-80">Tratamiento</h3>
          <p className="text-3xl font-black tracking-tighter">{pendingMedsCount > 0 ? `${pendingMedsCount} Pendientes` : 'Al Día'}</p>
          <div className="mt-4 text-xs font-bold bg-white/20 inline-block px-3 py-1 rounded-full backdrop-blur-md">Gestionar &rarr;</div>
        </div>

        <div onClick={() => onChangeView('meals')} className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition group">
          <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">🥗</div>
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1">Dieta IA</h3>
          <p className="text-xs text-gray-500 font-medium">Plan basado en {profile.diagnoses[0] || 'Perfil General'}</p>
          <div className="mt-4 text-teal-600 font-black text-[10px] uppercase tracking-widest">Ver Menú &rarr;</div>
        </div>

        <div onClick={() => onChangeView('exercise')} className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition group">
          <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">🏃‍♂️</div>
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1">Actividad</h3>
          <p className="text-xs text-gray-500 font-medium">Nivel: {profile.activityLevel}</p>
          <div className="mt-4 text-orange-600 font-black text-[10px] uppercase tracking-widest">Entrenamiento &rarr;</div>
        </div>
      </div>

      <div className="bg-teal-50 rounded-[2rem] p-8 border border-teal-100 flex items-center gap-6">
          <div className="text-4xl">💡</div>
          <div>
              <h3 className="font-black text-teal-900 uppercase text-xs tracking-widest mb-1">Sabías que...</h3>
              <p className="text-teal-700 text-sm font-medium italic">
                  {profile.diagnoses.some(d => d.toLowerCase().includes('diabetes')) 
                   ? "Caminar 10 minutos después de cada comida ayuda a estabilizar tus niveles de glucosa de forma natural."
                   : "La hidratación adecuada mejora la absorción de la mayoría de los medicamentos orales."}
              </p>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
