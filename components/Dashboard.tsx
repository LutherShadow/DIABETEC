import React, { useEffect, useState } from 'react';
import { UserProfile, ViewState, MealTime } from '../types';
import { getProfile } from '../services/storageService';

interface Props {
  profile: UserProfile;
  onChangeView: (view: ViewState) => void;
}

const Dashboard: React.FC<Props> = ({ profile, onChangeView }) => {
  const pendingMeds = profile.medications.filter(m => !m.takenToday).length;
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

  // Helper to handle manual request
  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
        new Notification('🔔 Notificaciones Activadas', { body: 'Te avisaremos cuando sea hora de tus medicinas.' });
    }
  };

  const handleLogMeal = (meal: MealTime) => {
      // 1. Check for "Before" meds (Immediate Alert)
      const beforeMeds = profile.medications.filter(m => 
          !m.takenToday && 
          m.scheduleType === 'meal_relative' && 
          m.mealTriggers?.some(t => t.meal === meal && t.timing === 'before')
      );

      if (beforeMeds.length > 0) {
          const names = beforeMeds.map(m => m.name).join(', ');
          
          if (notificationPermission === 'granted') {
             new Notification(`🍽️ Medicamento Antes de ${meal}`, {
                 body: `Toma ahora: ${names}`,
                 requireInteraction: true // Persistent
             });
          }
          alert(`⚠️ ¡ATENCIÓN! Tienes medicamentos para tomar ANTES del ${meal === 'breakfast' ? 'desayuno' : meal === 'lunch' ? 'almuerzo' : 'cena'}:\n\n${names}\n\nTómalos ahora.`);
      }

      // 2. Schedule "After" meds 
      const afterMeds = profile.medications.filter(m => 
        !m.takenToday && 
        m.scheduleType === 'meal_relative' && 
        m.mealTriggers?.some(t => t.meal === meal && t.timing === 'after')
      );

      if (afterMeds.length > 0) {
          const names = afterMeds.map(m => m.name).join(', ');
          
          if (notificationPermission === 'granted') {
              // Simulate delayed check
              setTimeout(() => {
                  new Notification('💊 Medicamento Post-Comida', {
                      body: `Han pasado 15 minutos de tu ${meal}. Es hora de tomar: ${names}`,
                      requireInteraction: true
                  });
              }, 15 * 60 * 1000); // 15 mins
              
              alert(`✅ Comida registrada. Te enviaremos una alerta en 15 minutos para tomar: ${names}`);
          } else {
              alert(`✅ Comida registrada. RECUERDA en 15 minutos tomar: ${names}`);
          }
      } else {
          if (beforeMeds.length === 0) alert(`✅ ${meal === 'breakfast' ? 'Desayuno' : meal === 'lunch' ? 'Almuerzo' : 'Cena'} registrado.`);
      }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-gray-800">Hola, {profile.name.split(' ')[0]} 👋</h1>
        <p className="text-gray-600">¡Vas por buen camino! Mantén tu salud bajo control hoy.</p>
      </header>

      {/* Permission Banner - Critical for Mobile/PWA */}
      {notificationPermission !== 'granted' && (
          <div className="bg-blue-600 text-white p-4 rounded-xl shadow-md flex justify-between items-center animate-pulse">
              <div>
                  <h3 className="font-bold">🔔 Activar Alertas</h3>
                  <p className="text-sm text-blue-100">Necesitamos permiso para avisarte de tus medicinas.</p>
              </div>
              <button 
                onClick={requestPermission}
                className="bg-white text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition"
              >
                  Activar
              </button>
          </div>
      )}

      {/* Meal Logging Action Bar */}
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
            className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white shadow-lg cursor-pointer hover:scale-105 transition-transform relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">💊</div>
          <div className="flex justify-between items-start mb-4 relative z-10">
             <span className="text-3xl">💊</span>
             {pendingMeds > 0 && <span className="text-xs bg-white/20 px-2 py-1 rounded">Pendientes</span>}
          </div>
          <h3 className="text-lg font-semibold mb-1 relative z-10">Medicamentos</h3>
          {pendingMeds > 0 ? (
             <p className="text-2xl font-bold relative z-10">{pendingMeds} por tomar</p>
          ) : (
             <p className="text-2xl font-bold relative z-10">¡Todo al día!</p>
          )}
          <p className="text-sm opacity-90 mt-2 relative z-10">Gestionar tomas &rarr;</p>
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
          <p className="text-sm text-gray-500 mb-2">Plan: {profile.diagnoses[0] ? 'Adaptado' : 'General'}</p>
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
          <p className="text-sm text-gray-500 mb-2">Nivel: {profile.activityLevel}</p>
          <div className="text-orange-600 font-medium text-sm">Iniciar rutina &rarr;</div>
        </div>
      </div>

      {/* Quick Stats / Motivation */}
      <div className="bg-teal-50 rounded-xl p-6 border border-teal-100 flex flex-col md:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded-full shadow-sm text-2xl">
              🌟
          </div>
          <div>
              <h3 className="font-bold text-teal-800">Consejo del Día</h3>
              <p className="text-teal-700 text-sm">
                  {profile.diagnoses.some(d => d.toLowerCase().includes('diabetes')) 
                   ? "La hidratación es fundamental. Bebe agua regularmente para ayudar a tus riñones a filtrar el exceso de glucosa."
                   : "La constancia es clave. Pequeños cambios diarios generan grandes resultados a largo plazo."}
              </p>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;