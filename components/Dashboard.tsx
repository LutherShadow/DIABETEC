
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

  // Reloj de alta precisión para el Dashboard
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000); // Cada 10 segundos
    return () => clearInterval(timer);
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  };

  // Lógica de detección de dosis próxima para UI
  const upcomingDose = useMemo(() => {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    let closest: { med: Medication; time: string; diff: number } | null = null;

    profile.medications.forEach(med => {
      if (med.scheduleType === 'fixed' && med.fixedTimes && !med.takenToday) {
        med.fixedTimes.forEach(time => {
          const [h, m] = time.split(':').map(Number);
          const targetMins = h * 60 + m;
          const diff = targetMins - currentMins;
          
          // Consideramos dosis desde 30 mins en el futuro hasta 5 mins después de la hora
          if (diff > -5 && diff <= 30 && (closest === null || diff < closest.diff)) {
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
      }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hola, {profile.name.split(' ')[0]} 👋</h1>
            <p className="text-gray-600 text-sm font-medium">Asistente VidaSalud activo.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100 text-xs font-black text-gray-500 uppercase tracking-widest">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* Widget de Próxima Toma (Refactorizado con lógica de 10 min) */}
      {upcomingDose && (
          <div className={`p-6 rounded-[2.5rem] border-4 transition-all duration-700 shadow-2xl relative overflow-hidden ${
              upcomingDose.diff <= 10 && upcomingDose.diff > 0 
              ? 'bg-orange-600 border-orange-400 text-white animate-pulse' 
              : upcomingDose.diff <= 0 
              ? 'bg-red-700 border-red-500 text-white'
              : 'bg-white border-teal-100 text-gray-900'
          }`}>
              <div className="flex justify-between items-start relative z-10">
                  <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner ${upcomingDose.diff <= 10 ? 'bg-white/20' : 'bg-teal-50 text-teal-600'}`}>
                          {upcomingDose.diff <= 10 ? '🚨' : '⏰'}
                      </div>
                      <div>
                          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${upcomingDose.diff <= 10 ? 'text-orange-100' : 'text-teal-600'}`}>
                              {upcomingDose.diff <= 0 ? 'Hacerlo ahora' : upcomingDose.diff <= 10 ? 'Alerta: 10 Minutos' : 'Próxima Medicina'}
                          </p>
                          <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">{upcomingDose.med.name}</h3>
                          <p className={`text-xs mt-1 font-bold ${upcomingDose.diff <= 10 ? 'text-white/80' : 'text-gray-500'}`}>{upcomingDose.med.dosage}</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className="text-3xl font-black tracking-tighter">{upcomingDose.time}</p>
                      <p className="text-[10px] opacity-70 uppercase font-black tracking-widest">
                          {upcomingDose.diff <= 0 ? '¡RETRASO!' : `EN ${upcomingDose.diff} MIN`}
                      </p>
                  </div>
              </div>
              
              <div className="mt-6 flex gap-3 relative z-10">
                  <button 
                    onClick={() => handleTakeQuickly(upcomingDose!.med.id)}
                    className={`flex-1 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                        upcomingDose.diff <= 10 
                        ? 'bg-white text-orange-600 hover:bg-orange-50' 
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                      Registrar Toma
                  </button>
                  <button 
                    onClick={() => onChangeView('medications')}
                    className={`px-6 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${
                        upcomingDose.diff <= 10 ? 'bg-orange-800/50 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                      Ver Detalle
                  </button>
              </div>
          </div>
      )}

      {/* Aviso de Permisos de Notificación */}
      {notificationPermission !== 'granted' && (
          <div className="bg-blue-600 text-white p-5 rounded-[2rem] shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                  <span className="text-3xl bg-white/20 p-2 rounded-xl">🔔</span>
                  <div className="leading-tight">
                      <h4 className="font-black uppercase text-sm tracking-tight">Alertas de Sistema Desactivadas</h4>
                      <p className="text-[10px] font-medium text-blue-100">Para avisarte aunque estés viendo YouTube o en otra pestaña, necesitamos tu permiso.</p>
                  </div>
              </div>
              <button onClick={requestPermission} className="w-full md:w-auto bg-white text-blue-700 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform active:scale-95">Permitir Ahora</button>
          </div>
      )}

      {/* Registro de Nutrición */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🥗</span>
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Sincronización de Comidas</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
              <button onClick={() => handleLogMeal('breakfast')} className="flex-1 bg-orange-50 text-orange-800 py-4 rounded-2xl hover:bg-orange-100 font-black text-xs uppercase transition-all border border-orange-200">Desayuno</button>
              <button onClick={() => handleLogMeal('lunch')} className="flex-1 bg-green-50 text-green-800 py-4 rounded-2xl hover:bg-green-100 font-black text-xs uppercase transition-all border border-green-200">Almuerzo</button>
              <button onClick={() => handleLogMeal('dinner')} className="flex-1 bg-blue-50 text-blue-800 py-4 rounded-2xl hover:bg-blue-100 font-black text-xs uppercase transition-all border border-blue-200">Cena</button>
          </div>
          <p className="mt-4 text-[9px] text-gray-400 text-center font-bold uppercase tracking-widest">Esto activa las alertas de medicamentos "Con Comidas"</p>
      </div>

      {/* Grid de Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div onClick={() => onChangeView('medications')} className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-[2.5rem] p-10 text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group">
          <div className="absolute -top-6 -right-6 p-4 opacity-10 text-9xl group-hover:rotate-12 transition-transform">💊</div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-2 opacity-80">Tratamiento</h3>
          <p className="text-4xl font-black tracking-tighter leading-none">{pendingMedsCount > 0 ? `${pendingMedsCount} Pendientes` : 'Al Día'}</p>
          <div className="mt-6 text-[10px] font-black bg-white/20 inline-block px-4 py-1.5 rounded-full backdrop-blur-md uppercase tracking-widest">Gestionar Medicinas &rarr;</div>
        </div>

        <div onClick={() => onChangeView('meals')} className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition group">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🥗</div>
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] mb-2">Nutrición IA</h3>
          <p className="text-sm text-gray-500 font-bold leading-tight">Dieta optimizada para {profile.diagnoses[0] || 'tu perfil'}</p>
          <div className="mt-6 text-teal-600 font-black text-[10px] uppercase tracking-widest border-b-2 border-teal-100 inline-block">Ver mi menú hoy</div>
        </div>

        <div onClick={() => onChangeView('exercise')} className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition group">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🏃‍♂️</div>
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] mb-2">Actividad Física</h3>
          <p className="text-sm text-gray-500 font-bold leading-tight">Nivel: {profile.activityLevel === 'sedentary' ? 'Bajo' : profile.activityLevel}</p>
          <div className="mt-6 text-orange-600 font-black text-[10px] uppercase tracking-widest border-b-2 border-orange-100 inline-block">Ver Rutina AI</div>
        </div>
      </div>

      <div className="bg-teal-900 text-white rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="text-5xl shrink-0">💡</div>
          <div>
              <h3 className="font-black text-teal-200 uppercase text-xs tracking-[0.3em] mb-2">Recomendación Saludable</h3>
              <p className="text-teal-50 text-lg font-bold tracking-tight italic">
                  {profile.diagnoses.some(d => d.toLowerCase().includes('diabetes')) 
                   ? "Un paseo de 15 min después de almorzar puede reducir tu pico de glucosa hasta un 22%. ¡Inténtalo!"
                   : "Recuerda hidratarte con al menos 2 vasos de agua al tomar tus medicamentos orales."}
              </p>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
