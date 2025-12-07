import React, { useState, useEffect } from 'react';
import { Medication, UserProfile, ScheduleType, MealTrigger, MealTime, MealTiming } from '../types';
import { analyzePrescription } from '../services/geminiService';
import { saveProfile, toggleMedicationTaken, resetDailyTracking } from '../services/storageService';

interface Props {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

const MedicationManager: React.FC<Props> = ({ profile, onUpdate }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // State for manual form
  const [newMed, setNewMed] = useState<{
    name: string;
    dosage: string;
    instructions: string;
    scheduleType: ScheduleType;
    fixedTimes: string[];
    mealTriggers: MealTrigger[];
  }>({
    name: '',
    dosage: '',
    instructions: '',
    scheduleType: 'fixed',
    fixedTimes: ['08:00'],
    mealTriggers: []
  });

  // Helper to convert "HH:MM" to minutes from midnight
  const getMinutesFromMidnight = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Polling for Fixed Time Notifications & Urgent Reminders
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkSchedules = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      profile.medications.forEach(med => {
        // Only check fixed schedules that haven't been taken today
        if (med.scheduleType === 'fixed' && med.fixedTimes && !med.takenToday) {
          
          med.fixedTimes.forEach(timeStr => {
            const scheduledMinutes = getMinutesFromMidnight(timeStr);
            const diff = currentMinutes - scheduledMinutes;

            // 1. Primary Alert (Exact Time or within 1 min)
            if (diff === 0) {
               new Notification(`💊 Hora de tu medicamento: ${med.name}`, {
                 body: `Toma tu dosis de ${med.dosage} ahora.`,
                 icon: '/pills-icon.png', // Optional: requires asset
                 requireInteraction: true, // PERSISTENT: Won't close until user clicks
                 tag: `med_primary_${med.id}_${timeStr}` // Prevent duplicate stacking
               });
            }

            // 2. Urgent Reminder (30 minutes late)
            if (diff === 30) {
               new Notification(`⚠️ URGENTE: Olvidaste ${med.name}`, {
                 body: `Han pasado 30 minutos. Registra tu toma de ${med.dosage} para mantener tu tratamiento.`,
                 requireInteraction: true, // PERSISTENT
                 renotify: true, // Vibrate/Sound again even if notification is open
                 tag: `med_urgent_${med.id}_${timeStr}`, // Replaces the primary notification
               } as any);
            }
          });
        }
      });
    };

    // Check every 30 seconds to ensure we don't miss the minute window
    const interval = setInterval(checkSchedules, 30000); 
    return () => clearInterval(interval);
  }, [profile.medications, notificationsEnabled]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      new Notification('VidaSalud AI', { body: 'Notificaciones activadas correctamente.' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    const reader = new FileReader();
    
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const meds = await analyzePrescription(base64, true);
        
        if (meds.length === 0) {
            alert("⚠️ No se detectaron medicamentos.\nIntenta con una imagen más clara, asegúrate que el texto sea legible o ingresa los datos manualmente.");
        } else {
            addMedsToProfile(meds);
            alert(`✅ Éxito: Se detectaron ${meds.length} medicamentos.\nRevisa la lista y ajusta los horarios si es necesario.`);
        }
      } catch (error) {
        console.error("Error analyzing prescription:", error);
        alert("❌ Ocurrió un error al procesar la imagen.\nPor favor verifica tu conexión a internet o intenta ingresarlo manualmente.");
      } finally {
        setAnalyzing(false);
        // Clear input allows re-selecting the same file if needed
        e.target.value = '';
      }
    };
    
    reader.onerror = () => {
        alert("❌ Error al leer el archivo de imagen.");
        setAnalyzing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleTextAnalyze = async () => {
    if (!manualInput) return;
    setAnalyzing(true);
    try {
        const meds = await analyzePrescription(manualInput, false);
        if (meds.length > 0) {
            addMedsToProfile(meds);
        } else {
            alert("No se pudo extraer información del texto ingresado.");
        }
    } catch (error) {
        console.error(error);
        alert("Error al analizar el texto.");
    } finally {
        setAnalyzing(false);
        setManualInput('');
    }
  };

  // Logic to add a time slot
  const addFixedTime = () => {
      setNewMed(prev => ({ ...prev, fixedTimes: [...prev.fixedTimes, '08:00'] }));
  };

  const updateFixedTime = (index: number, val: string) => {
      const updated = [...newMed.fixedTimes];
      updated[index] = val;
      setNewMed(prev => ({ ...prev, fixedTimes: updated }));
  };

  const removeFixedTime = (index: number) => {
      const updated = newMed.fixedTimes.filter((_, i) => i !== index);
      setNewMed(prev => ({ ...prev, fixedTimes: updated }));
  };

  const toggleMealTrigger = (meal: MealTime, timing: MealTiming) => {
      const exists = newMed.mealTriggers.find(t => t.meal === meal && t.timing === timing);
      let updated;
      if (exists) {
          updated = newMed.mealTriggers.filter(t => !(t.meal === meal && t.timing === timing));
      } else {
          updated = [...newMed.mealTriggers, { meal, timing }];
      }
      setNewMed(prev => ({ ...prev, mealTriggers: updated }));
  };

  const handleManualAdd = () => {
    if (!newMed.name) return;
    
    // Generate Frequency Text
    let freqText = "";
    if (newMed.scheduleType === 'fixed') {
        freqText = `Horas fijas: ${newMed.fixedTimes.join(', ')}`;
    } else {
        freqText = `Con comidas: ${newMed.mealTriggers.map(t => `${t.timing === 'before' ? 'Antes' : 'Después'} ${t.meal === 'breakfast' ? 'Desayuno' : t.meal === 'lunch' ? 'Almuerzo' : 'Cena'}`).join(', ')}`;
    }

    const med: Medication = {
      id: Math.random().toString(36).substr(2, 9),
      name: newMed.name,
      dosage: newMed.dosage || 'Según indicación',
      frequency: freqText,
      instructions: newMed.instructions || '',
      requiresFood: newMed.scheduleType === 'meal_relative', // Implicit
      takenToday: false,
      scheduleType: newMed.scheduleType,
      fixedTimes: newMed.scheduleType === 'fixed' ? newMed.fixedTimes : undefined,
      mealTriggers: newMed.scheduleType === 'meal_relative' ? newMed.mealTriggers : undefined
    };

    const updatedProfile = { ...profile, medications: [...profile.medications, med] };
    saveProfile(updatedProfile);
    onUpdate(updatedProfile);
    
    // Reset form
    setNewMed({ 
        name: '', dosage: '', instructions: '', 
        scheduleType: 'fixed', fixedTimes: ['08:00'], mealTriggers: [] 
    });

    if (notificationsEnabled) {
      new Notification('Recordatorio Configurado', { body: `Te recordaremos tomar ${med.name} según el horario configurado.` });
    }
  };

  const addMedsToProfile = (newMeds: Partial<Medication>[]) => {
    // Simplified adder for AI results - defaults to fixed 8am for safety, user can edit
    const validMeds: Medication[] = newMeds.map(m => ({
      id: Math.random().toString(36).substr(2, 9),
      name: m.name || 'Desconocido',
      dosage: m.dosage || 'Según receta',
      frequency: m.frequency || 'Diario',
      instructions: m.instructions || '',
      requiresFood: m.requiresFood || false,
      takenToday: false,
      scheduleType: 'fixed',
      fixedTimes: ['08:00']
    }));

    const updatedProfile = { ...profile, medications: [...profile.medications, ...validMeds] };
    saveProfile(updatedProfile);
    onUpdate(updatedProfile);
  };

  const handleToggleTaken = (id: string) => {
    const updatedProfile = toggleMedicationTaken(id);
    onUpdate(updatedProfile);
  };

  const removeMed = (id: string) => {
    if(!window.confirm("¿Estás seguro de que quieres eliminar este medicamento?")) return;
    const updatedMeds = profile.medications.filter(m => m.id !== id);
    const updatedProfile = { ...profile, medications: updatedMeds };
    saveProfile(updatedProfile);
    onUpdate(updatedProfile);
  };

  const handleNewDay = () => {
    if(window.confirm("¿Iniciar un nuevo día? Esto desmarcará todos los medicamentos tomados hoy.")) {
        const updatedProfile = resetDailyTracking();
        onUpdate(updatedProfile);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-xl shadow-sm space-y-8">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-teal-800 flex items-center gap-2">
          <span>💊</span> Mis Medicamentos
        </h2>
        <div className="flex gap-2">
            {!notificationsEnabled && (
            <button 
                onClick={requestNotificationPermission}
                className="text-xs bg-teal-100 text-teal-700 px-3 py-2 rounded-full hover:bg-teal-200 transition"
            >
                🔔 Activar Alertas
            </button>
            )}
            <button 
                onClick={handleNewDay}
                className="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition font-medium flex items-center gap-2"
            >
                🔄 Iniciar Nuevo Día
            </button>
        </div>
      </div>

      {/* Manual Add Form - UPDATED */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8">
        <h3 className="font-semibold text-gray-800 mb-4">📝 Registrar Nuevo Medicamento</h3>
        
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
             <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nombre</label>
             <input type="text" placeholder="Ej: Metformina" className="w-full border rounded-lg p-3" value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} />
          </div>
          <div>
             <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Dosis</label>
             <input type="text" placeholder="Ej: 500 mg" className="w-full border rounded-lg p-3" value={newMed.dosage} onChange={e => setNewMed({...newMed, dosage: e.target.value})} />
          </div>
        </div>

        {/* Schedule Type Toggle */}
        <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Tipo de Horario</label>
            <div className="flex gap-4">
                <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${newMed.scheduleType === 'fixed' ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500' : 'bg-white'}`}>
                    <input type="radio" name="scheduleType" className="hidden" checked={newMed.scheduleType === 'fixed'} onChange={() => setNewMed({...newMed, scheduleType: 'fixed'})} />
                    <span className="text-xl">⏰</span>
                    <span className="font-medium text-sm">Hora Fija</span>
                </label>
                <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${newMed.scheduleType === 'meal_relative' ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500' : 'bg-white'}`}>
                    <input type="radio" name="scheduleType" className="hidden" checked={newMed.scheduleType === 'meal_relative'} onChange={() => setNewMed({...newMed, scheduleType: 'meal_relative'})} />
                    <span className="text-xl">🍽️</span>
                    <span className="font-medium text-sm">Por Comidas</span>
                </label>
            </div>
        </div>

        {/* Schedule Config */}
        <div className="bg-white p-4 rounded-lg border mb-4">
            {newMed.scheduleType === 'fixed' ? (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-gray-600">Horas de Toma:</label>
                        <button onClick={addFixedTime} className="text-teal-600 text-xs font-bold">+ Agregar hora</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {newMed.fixedTimes.map((time, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                                <input 
                                    type="time" 
                                    className="border rounded p-2 text-sm"
                                    value={time}
                                    onChange={(e) => updateFixedTime(idx, e.target.value)}
                                />
                                {newMed.fixedTimes.length > 1 && (
                                    <button onClick={() => removeFixedTime(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">×</button>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Ej: Para "Cada 12 horas", agrega 08:00 y 20:00.</p>
                </div>
            ) : (
                <div>
                    <label className="text-sm font-bold text-gray-600 block mb-2">¿Cuándo se debe tomar?</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {['breakfast', 'lunch', 'dinner'].map((meal) => (
                            <div key={meal} className="border rounded-lg p-2">
                                <div className="text-center font-bold text-gray-700 capitalize mb-2">
                                    {meal === 'breakfast' ? 'Desayuno' : meal === 'lunch' ? 'Almuerzo' : 'Cena'}
                                </div>
                                <div className="flex justify-center gap-2">
                                    <button 
                                        onClick={() => toggleMealTrigger(meal as MealTime, 'before')}
                                        className={`text-xs px-2 py-1 rounded ${newMed.mealTriggers.find(t => t.meal === meal && t.timing === 'before') ? 'bg-orange-100 text-orange-700 font-bold border border-orange-300' : 'bg-gray-100 text-gray-500'}`}
                                    >
                                        Antes
                                    </button>
                                    <button 
                                        onClick={() => toggleMealTrigger(meal as MealTime, 'after')}
                                        className={`text-xs px-2 py-1 rounded ${newMed.mealTriggers.find(t => t.meal === meal && t.timing === 'after') ? 'bg-blue-100 text-blue-700 font-bold border border-blue-300' : 'bg-gray-100 text-gray-500'}`}
                                    >
                                        Después
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <button 
          onClick={handleManualAdd}
          disabled={!newMed.name}
          className="w-full bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          Guardar Medicamento
        </button>
      </div>

      {/* AI Add Section (Collapsed) */}
      <details className="bg-blue-50 rounded-xl border border-blue-100 shadow-sm overflow-hidden">
        <summary className="p-4 font-semibold text-blue-900 cursor-pointer hover:bg-blue-100 transition list-none flex justify-between">
            <span>📷 O escanear receta con IA...</span>
            <span>⬇️</span>
        </summary>
        <div className="p-6 pt-0">
            <p className="text-sm text-blue-700 mb-4 mt-2">Sube una foto y la IA intentará extraer los horarios automáticamente.</p>
            <div className="flex flex-col md:flex-row gap-4">
            <label className="flex-1 cursor-pointer bg-white border-2 border-dashed border-blue-300 rounded-xl p-6 text-center hover:bg-blue-50 hover:border-blue-500 transition group">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                <span className="text-blue-600 font-bold block">Subir foto</span>
            </label>
            <div className="flex-1 flex flex-col gap-2">
                <textarea 
                placeholder="O escribe texto..." 
                className="flex-1 border border-blue-200 rounded-xl p-3 text-sm resize-none"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                />
                <button 
                onClick={handleTextAnalyze}
                className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium transition shadow-sm"
                disabled={!manualInput}
                >
                ✨ Analizar
                </button>
            </div>
            </div>
            {analyzing && <div className="mt-4 text-blue-700 animate-pulse">🌀 Procesando...</div>}
        </div>
      </details>

      {/* List Section */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-800 text-lg border-b pb-2">Tratamiento Actual</h3>
        {profile.medications.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
             <div className="text-4xl mb-2">💊</div>
             <p className="text-gray-500">No tienes medicamentos registrados.</p>
          </div>
        ) : (
          profile.medications.map(med => (
            <div key={med.id} className={`relative overflow-hidden group transition-all duration-300 ${med.takenToday ? 'opacity-70 grayscale-[0.5]' : ''}`}>
              <div className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-xl border shadow-sm ${med.takenToday ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-teal-200 hover:shadow-md'}`}>
                
                <div className="flex-1 mb-4 md:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-bold text-xl ${med.takenToday ? 'text-green-800 line-through' : 'text-gray-800'}`}>{med.name}</h4>
                    {/* Schedule Badge */}
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${med.scheduleType === 'fixed' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                        {med.scheduleType === 'fixed' ? '⏰ Fijo' : '🍽️ Comidas'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">{med.dosage}</p>
                  
                  {/* Visual Schedule Details */}
                  <div className="mt-2 flex flex-wrap gap-2">
                      {med.scheduleType === 'fixed' && med.fixedTimes?.map(t => (
                          <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono border">
                              {t}
                          </span>
                      ))}
                      {med.scheduleType === 'meal_relative' && med.mealTriggers?.map((t, i) => (
                          <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100">
                              {t.timing === 'before' ? 'Antes' : 'Después'} de {t.meal === 'breakfast' ? 'Desayuno' : t.meal === 'lunch' ? 'Alm.' : 'Cena'}
                          </span>
                      ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleToggleTaken(med.id)}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 justify-center ${
                        med.takenToday 
                        ? 'bg-green-100 text-green-700 ring-2 ring-green-200' 
                        : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md hover:shadow-lg active:scale-95'
                    }`}
                  >
                    {med.takenToday ? (
                        <><span>✔️</span> Completado</>
                    ) : (
                        <><span>⭕</span> Tomado</>
                    )}
                  </button>
                  <button onClick={() => removeMed(med.id)} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Eliminar">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* History Section */}
      <div className="mt-12 border-t pt-8">
          <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
              📜 Historial de Tomas
          </h3>
          <div className="bg-gray-50 rounded-xl border border-gray-200 max-h-60 overflow-y-auto">
              {!profile.history || profile.history.length === 0 ? (
                  <p className="p-6 text-gray-500 text-center text-sm">Aún no hay registros de medicamentos tomados.</p>
              ) : (
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-100 text-gray-600 uppercase text-xs sticky top-0">
                          <tr>
                              <th className="px-6 py-3">Medicamento</th>
                              <th className="px-6 py-3">Fecha y Hora</th>
                              <th className="px-6 py-3">Contexto</th>
                          </tr>
                      </thead>
                      <tbody>
                          {profile.history.map((log) => (
                              <tr key={log.id} className="border-b last:border-0 hover:bg-white transition">
                                  <td className="px-6 py-3 font-medium text-gray-800">{log.medName}</td>
                                  <td className="px-6 py-3 text-gray-600">{log.formattedDate}</td>
                                  <td className="px-6 py-3 text-gray-500 text-xs">
                                      {log.context || 'Manual'}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </div>
      </div>

    </div>
  );
};

export default MedicationManager;