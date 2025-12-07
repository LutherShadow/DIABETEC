import React from 'react';
import { UserProfile, ViewState, MealTime } from '../types';
import { getProfile } from '../services/storageService'; // Needed for checking status inside timeouts

interface Props {
  profile: UserProfile;
  onChangeView: (view: ViewState) => void;
}

const Dashboard: React.FC<Props> = ({ profile, onChangeView }) => {
  const pendingMeds = profile.medications.filter(m => !m.takenToday).length;

  const handleLogMeal = (meal: MealTime) => {
      // 1. Check for "Before" meds (Immediate Alert)
      const beforeMeds = profile.medications.filter(m => 
          !m.takenToday && 
          m.scheduleType === 'meal_relative' && 
          m.mealTriggers?.some(t => t.meal === meal && t.timing === 'before')
      );

      if (beforeMeds.length > 0) {
          const names = beforeMeds.map(m => m.name).join(', ');
          
          if ('Notification' in window && Notification.permission === 'granted') {
             new Notification(`🍽️ Medicamento Antes de ${meal}`, {
                 body: `Toma ahora: ${names}`,
                 requireInteraction: true // Persistent
             });
             
             // Schedule URGENT reminder if not taken in 30 mins
             beforeMeds.forEach(med => {
                 setTimeout(() => {
                     const freshProfile = getProfile();
                     const currentMed = freshProfile.medications.find(m => m.id === med.id);
                     if (currentMed && !currentMed.takenToday) {
                         new Notification(`⚠️ URGENTE: ${med.name}`, {
                             body: `Han pasado 30 min desde tu comida. ¡Tómalo ya!`,
                             requireInteraction: true,
                             renotify: true
                         } as any);
                     }
                 }, 30 * 60 * 1000); // 30 mins
             });
          }
          
          alert(`⚠️ ¡ATENCIÓN! Tienes medicamentos para tomar ANTES del ${meal === 'breakfast' ? 'desayuno' : meal === 'lunch' ? 'almuerzo' : 'cena'}:\n\n${names}\n\nTómalos ahora.`);
      }

      // 2. Schedule "After" meds (Simulated via Notification)
      const afterMeds = profile.medications.filter(m => 
        !m.takenToday && 
        m.scheduleType === 'meal_relative' && 
        m.mealTriggers?.some(t => t.meal === meal && t.timing === 'after')
      );

      if (afterMeds.length > 0) {
          const names = afterMeds.map(m => m.name).join(', ');
          
          if ('Notification' in window && Notification.permission === 'granted') {
              
              // Simulate a delayed notification (e.g. 15 mins later)
              // For demo purposes, we fire a "Scheduled" confirmation, then set the actual timeout
              setTimeout(() => {
                  new Notification('💊 Medicamento Post-Comida', {
                      body: `Ya han pasado 15 minutos de tu ${meal}. Es hora de tomar: ${names}`,
                      requireInteraction: true
                  });
              }, 15 * 60 * 1000); // 15 mins standard

              // URGENT Reminder (15 min standard + 30 min delay = 45 mins after meal)
              afterMeds.forEach(med => {
                 setTimeout(() => {
                     const freshProfile = getProfile();
                     const currentMed = freshProfile.medications.find(m => m.id === med.id);
                     if (currentMed && !currentMed.takenToday) {
                         new Notification(`⚠️ URGENTE: ${med.name}`, {
                             body: `Han pasado 45 min desde tu comida y no has marcado la toma.`,
                             requireInteraction: true,
                             renotify: true
                         } as any);
                     }
                 }, 45 * 60 * 1000);
             });

              alert(`✅ Comida registrada. Te recordaremos tomar ${names} en 15 minutos.`);
          } else {
              alert(`✅ Comida registrada. Recuerda tomar en 15 minutos: ${names}`);
          }
      } else {
          if (beforeMeds.length === 0) alert(`✅ ${meal === 'breakfast' ? 'Desayuno' : meal === 'lunch' ? 'Almuerzo' : 'Cena'} registrado.`);
      }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Hola, {profile.name.split(' ')[0]} 👋</h1>
        <p className="text-gray-600">¡Vas por buen camino! Mantén tu salud bajo control hoy.</p>
      </header>

      {/* Meal Logging Action Bar - New Feature for Contextual Notifications */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">🍽️ Registrar Comida (Activa Recordatorios)</h3>
          <div className="flex gap-2">
              <button onClick={() => handleLogMeal('breakfast')} className="flex-1 bg-orange-50 text-orange-700 py-2 rounded-lg hover:bg-orange-100 font-medium transition border border-orange-200">
                  ☕ Desayuno
              </button>
              <button onClick={() => handleLogMeal('lunch')} className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg hover:bg-green-100 font-medium transition border border-green-200">
                  🥗 Almuerzo
              </button>
              <button onClick={() => handleLogMeal('dinner')} className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg hover:bg-blue-100 font-medium transition border border-blue-200">
                  🌙 Cena
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Widget 1: Medications */}
        <div 
            onClick={() => onChangeView('medications')}
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="flex justify-between items-start mb-4">
             <span className="text-3xl">💊</span>
             <span className="text-xs bg-white/20 px-2 py-1 rounded">Prioritario</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">Medicamentos</h3>
          {pendingMeds > 0 ? (
             <p className="text-2xl font-bold">{pendingMeds} pendientes</p>
          ) : (
             <p className="text-2xl font-bold">¡Todo listo!</p>
          )}
          <p className="text-sm opacity-90 mt-2">Próxima toma: Seguir horario</p>
        </div>

        {/* Widget 2: Diet */}
        <div 
             onClick={() => onChangeView('meals')}
             className="bg-white rounded-xl p-6 shadow-md border border-gray-100 cursor-pointer hover:border-teal-400 transition"
        >
           <div className="flex justify-between items-start mb-4">
             <span className="text-3xl">🥗</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Alimentación</h3>
          <p className="text-sm text-gray-500 mb-2">Basado en {profile.diagnoses[0] || 'tu perfil'}</p>
          <div className="text-teal-600 font-medium text-sm">Ver sugerencia del día &rarr;</div>
        </div>

        {/* Widget 3: Exercise */}
        <div 
            onClick={() => onChangeView('exercise')}
            className="bg-white rounded-xl p-6 shadow-md border border-gray-100 cursor-pointer hover:border-orange-400 transition"
        >
           <div className="flex justify-between items-start mb-4">
             <span className="text-3xl">🏃‍♂️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Actividad Física</h3>
          <p className="text-sm text-gray-500 mb-2">Meta: {profile.activityLevel}</p>
          <div className="text-orange-600 font-medium text-sm">Iniciar rutina segura &rarr;</div>
        </div>
      </div>

      {/* Quick Stats / Motivation */}
      <div className="bg-teal-50 rounded-xl p-6 border border-teal-100 flex flex-col md:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded-full shadow-sm">
              🌟
          </div>
          <div>
              <h3 className="font-bold text-teal-800">Consejo del Día</h3>
              <p className="text-teal-700 text-sm">
                  {profile.diagnoses.includes("Diabetes") 
                   ? "Recuerda caminar 10 minutos después de comer para ayudar a reducir el pico de glucosa."
                   : "La constancia es clave. Pequeños cambios diarios generan grandes resultados a largo plazo."}
              </p>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;