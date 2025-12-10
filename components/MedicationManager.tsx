import React, { useState } from 'react';
import { Medication, UserProfile, ScheduleType, MealTrigger, MealTime, MealTiming } from '../types';
import { analyzePrescription } from '../services/geminiService';
import { saveProfile, recordMedicationDose, removeLastMedicationDose, resetDailyTracking, deleteMedication } from '../services/storageService';

interface Props {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

const MedicationManager: React.FC<Props> = ({ profile, onUpdate }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  
  // State for manual form (New Medication)
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

  // State for Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Medication | null>(null);

  // Helper to calculate progress for a specific med
  const getDoseProgress = (med: Medication) => {
    const todayStr = new Date().toDateString();
    const takenCount = profile.history.filter(h => 
        h.medName === med.name && 
        new Date(h.timestamp).toDateString() === todayStr
    ).length;

    let targetCount = 1;
    if (med.scheduleType === 'fixed' && med.fixedTimes) {
        targetCount = med.fixedTimes.length || 1;
    } else if (med.scheduleType === 'meal_relative' && med.mealTriggers) {
        targetCount = med.mealTriggers.length || 1;
    }

    return { taken: takenCount, total: targetCount };
  };

  // --- Handlers for New Medication Form ---
  const addFixedTime = () => {
      setNewMed(prev => ({ ...prev, fixedTimes: [...prev.fixedTimes, '08:00'] }));
  };
  
  const setFrequencyPattern = (hours: number) => {
      if (hours === 24) setNewMed(prev => ({ ...prev, scheduleType: 'fixed', fixedTimes: ['08:00'] }));
      if (hours === 12) setNewMed(prev => ({ ...prev, scheduleType: 'fixed', fixedTimes: ['08:00', '20:00'] }));
      if (hours === 8) setNewMed(prev => ({ ...prev, scheduleType: 'fixed', fixedTimes: ['08:00', '16:00', '23:00'] }));
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

  // --- Handlers for EDIT Medication Form ---
  const startEditing = (med: Medication) => {
      setEditingId(med.id);
      // Create a deep copy for the form to avoid mutating state directly
      setEditForm({
          ...med,
          fixedTimes: med.fixedTimes ? [...med.fixedTimes] : ['08:00'],
          mealTriggers: med.mealTriggers ? [...med.mealTriggers] : []
      });
  };

  const cancelEditing = () => {
      setEditingId(null);
      setEditForm(null);
  };

  const saveEdit = () => {
      if (!editForm) return;

      // Update frequency text based on new settings
      let freqText = editForm.frequency;
      if (editForm.scheduleType === 'fixed' && editForm.fixedTimes) {
          freqText = `Horas fijas: ${editForm.fixedTimes.join(', ')}`;
      } else if (editForm.scheduleType === 'meal_relative' && editForm.mealTriggers) {
          freqText = `Con comidas: ${editForm.mealTriggers.length} dosis`;
      }

      const finalMed = { ...editForm, frequency: freqText };

      const updatedMeds = profile.medications.map(m => m.id === editingId ? finalMed : m);
      const updatedProfile = { ...profile, medications: updatedMeds };
      
      saveProfile(updatedProfile);
      onUpdate(updatedProfile);
      
      setEditingId(null);
      setEditForm(null);
  };

  const addEditFixedTime = () => {
      if (!editForm) return;
      setEditForm({ ...editForm, fixedTimes: [...(editForm.fixedTimes || []), '08:00'] });
  };

  const updateEditFixedTime = (index: number, val: string) => {
      if (!editForm || !editForm.fixedTimes) return;
      const updated = [...editForm.fixedTimes];
      updated[index] = val;
      setEditForm({ ...editForm, fixedTimes: updated });
  };

  const removeEditFixedTime = (index: number) => {
      if (!editForm || !editForm.fixedTimes) return;
      const updated = editForm.fixedTimes.filter((_, i) => i !== index);
      setEditForm({ ...editForm, fixedTimes: updated });
  };

  const toggleEditMealTrigger = (meal: MealTime, timing: MealTiming) => {
      if (!editForm) return;
      const triggers = editForm.mealTriggers || [];
      const exists = triggers.find(t => t.meal === meal && t.timing === timing);
      let updated;
      if (exists) {
          updated = triggers.filter(t => !(t.meal === meal && t.timing === timing));
      } else {
          updated = [...triggers, { meal, timing }];
      }
      setEditForm({ ...editForm, mealTriggers: updated });
  };

  // --- Main Logic & Analysis ---

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
            alert("⚠️ No se detectaron medicamentos.\nIntenta con una imagen más clara.");
        } else {
            addMedsToProfile(meds);
            alert(`✅ Éxito: Se detectaron ${meds.length} medicamentos.`);
        }
      } catch (error) {
        console.error("Error analyzing:", error);
        alert("❌ Ocurrió un error al procesar la imagen.");
      } finally {
        setAnalyzing(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTextAnalyze = async () => {
    if (!manualInput) return;
    setAnalyzing(true);
    try {
        const meds = await analyzePrescription(manualInput, false);
        if (meds.length > 0) addMedsToProfile(meds);
        else alert("No se pudo extraer información.");
    } catch (error) {
        console.error(error);
        alert("Error al analizar el texto.");
    } finally {
        setAnalyzing(false);
        setManualInput('');
    }
  };

  const handleManualAdd = () => {
    if (!newMed.name) return;
    
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
      requiresFood: newMed.scheduleType === 'meal_relative', 
      takenToday: false,
      scheduleType: newMed.scheduleType,
      fixedTimes: newMed.scheduleType === 'fixed' ? newMed.fixedTimes : undefined,
      mealTriggers: newMed.scheduleType === 'meal_relative' ? newMed.mealTriggers : undefined
    };

    const updatedProfile = { ...profile, medications: [...profile.medications, med] };
    saveProfile(updatedProfile);
    onUpdate(updatedProfile);
    
    setNewMed({ 
        name: '', dosage: '', instructions: '', 
        scheduleType: 'fixed', fixedTimes: ['08:00'], mealTriggers: [] 
    });
  };

  const addMedsToProfile = (newMeds: any[]) => {
    const validMeds: Medication[] = newMeds.map(m => {
        let scheduleType: ScheduleType = 'fixed';
        let fixedTimes: string[] = ['08:00'];
        let mealTriggers: MealTrigger[] = [];
        let requiresFood = false;

        if (m.scheduleType === 'meal_relative' && m.suggestedMeals && m.suggestedMeals.length > 0) {
            scheduleType = 'meal_relative';
            const timing = (m.timing === 'before') ? 'before' : 'after';
            mealTriggers = m.suggestedMeals.map((mealName: string) => ({
                meal: mealName as MealTime, 
                timing: timing
            }));
            requiresFood = true;
        } else {
            scheduleType = 'fixed';
            if (m.suggestedTimes && m.suggestedTimes.length > 0) {
                fixedTimes = m.suggestedTimes;
            }
        }

        return {
            id: Math.random().toString(36).substr(2, 9),
            name: m.name || 'Desconocido',
            dosage: m.dosage || 'Según receta',
            frequency: m.frequency || (scheduleType === 'fixed' ? `Horas: ${fixedTimes.join(', ')}` : 'Con comidas'),
            instructions: m.instructions || '',
            requiresFood: requiresFood,
            takenToday: false,
            scheduleType: scheduleType,
            fixedTimes: scheduleType === 'fixed' ? fixedTimes : undefined,
            mealTriggers: scheduleType === 'meal_relative' ? mealTriggers : undefined
        };
    });

    const updatedProfile = { ...profile, medications: [...profile.medications, ...validMeds] };
    saveProfile(updatedProfile);
    onUpdate(updatedProfile);
  };

  const handleTakeDose = (id: string) => {
    const updatedProfile = recordMedicationDose(id);
    onUpdate(updatedProfile);
  };

  const handleUndoDose = (id: string) => {
    const updatedProfile = removeLastMedicationDose(id);
    onUpdate(updatedProfile);
  };

  const removeMed = (id: string) => {
    if(!window.confirm("¿Estás seguro de que quieres eliminar este medicamento del tratamiento?")) return;
    const updatedProfile = deleteMedication(id);
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
            <button 
                onClick={handleNewDay}
                className="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition font-medium flex items-center gap-2"
            >
                🔄 Iniciar Nuevo Día
            </button>
        </div>
      </div>

      {/* Manual Add Form */}
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
                        <div className="flex gap-2">
                             <span className="text-xs text-gray-400 self-center hidden md:inline">Rápido:</span>
                             <button onClick={() => setFrequencyPattern(12)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">Cada 12h</button>
                             <button onClick={() => setFrequencyPattern(8)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">Cada 8h</button>
                             <button onClick={addFixedTime} className="text-teal-600 text-xs font-bold ml-2">+ Manual</button>
                        </div>
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

      {/* AI Add Section */}
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
          profile.medications.map(med => {
            
            // --- EDIT MODE VIEW ---
            if (editingId === med.id && editForm) {
                return (
                    <div key={med.id} className="bg-teal-50 border-2 border-teal-300 p-5 rounded-xl shadow-md">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-teal-800">✏️ Editando: {med.name}</h4>
                            <div className="flex gap-2">
                                <button onClick={saveEdit} className="bg-teal-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-teal-700">Guardar</button>
                                <button onClick={cancelEditing} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400">Cancelar</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500">Nombre</label>
                                <input className="w-full border rounded p-2" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Dosis</label>
                                <input className="w-full border rounded p-2" value={editForm.dosage} onChange={e => setEditForm({...editForm, dosage: e.target.value})} />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-xs font-bold text-gray-500 block mb-2">Tipo de Horario</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={editForm.scheduleType === 'fixed'} onChange={() => setEditForm({...editForm, scheduleType: 'fixed', fixedTimes: editForm.fixedTimes || ['08:00']})} />
                                    <span className="text-sm">⏰ Hora Fija</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={editForm.scheduleType === 'meal_relative'} onChange={() => setEditForm({...editForm, scheduleType: 'meal_relative', mealTriggers: editForm.mealTriggers || []})} />
                                    <span className="text-sm">🍽️ Comidas</span>
                                </label>
                            </div>
                        </div>

                        {editForm.scheduleType === 'fixed' ? (
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-500">Horarios:</label>
                                    <button onClick={addEditFixedTime} className="text-xs text-teal-600 font-bold">+ Agregar Hora</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {editForm.fixedTimes?.map((t, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                            <input type="time" className="border rounded p-1 text-sm" value={t} onChange={e => updateEditFixedTime(i, e.target.value)} />
                                            <button onClick={() => removeEditFixedTime(i)} className="text-red-500 font-bold px-1">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                             <div>
                                <label className="text-xs font-bold text-gray-500 block mb-2">Disparadores:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['breakfast', 'lunch', 'dinner'].map((meal) => (
                                        <div key={meal} className="border bg-white rounded p-2 text-center">
                                            <div className="text-xs font-bold capitalize mb-1">{meal === 'breakfast' ? 'Desayuno' : meal === 'lunch' ? 'Almuerzo' : 'Cena'}</div>
                                            <div className="flex justify-center gap-1">
                                                <button 
                                                    onClick={() => toggleEditMealTrigger(meal as MealTime, 'before')}
                                                    className={`text-[10px] px-1 py-0.5 rounded ${editForm.mealTriggers?.find(t => t.meal === meal && t.timing === 'before') ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
                                                >
                                                    Antes
                                                </button>
                                                <button 
                                                    onClick={() => toggleEditMealTrigger(meal as MealTime, 'after')}
                                                    className={`text-[10px] px-1 py-0.5 rounded ${editForm.mealTriggers?.find(t => t.meal === meal && t.timing === 'after') ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
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
                );
            }

            // --- STANDARD VIEW ---
            const { taken, total } = getDoseProgress(med);
            const isCompleted = taken >= total;

            return (
            <div key={med.id} className={`relative overflow-hidden group transition-all duration-300 ${isCompleted ? 'opacity-70' : ''}`}>
              <div className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-xl border shadow-sm ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-teal-200 hover:shadow-md'}`}>
                
                <div className="flex-1 mb-4 md:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-bold text-xl ${isCompleted ? 'text-green-800 line-through' : 'text-gray-800'}`}>{med.name}</h4>
                    {/* Schedule Badge */}
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${med.scheduleType === 'fixed' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                        {med.scheduleType === 'fixed' ? '⏰ Fijo' : '🍽️ Comidas'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">{med.dosage}</p>
                  
                  {/* Progress Indicator */}
                  <div className="mt-3 flex items-center gap-3">
                      <div className="flex gap-1">
                          {Array.from({ length: total }).map((_, i) => (
                              <div key={i} className={`w-3 h-3 rounded-full border ${i < taken ? 'bg-green-500 border-green-600' : 'bg-gray-100 border-gray-300'}`}></div>
                          ))}
                      </div>
                      <span className="text-xs font-bold text-gray-500">{taken}/{total} Dosis</span>
                  </div>

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
                
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => handleTakeDose(med.id)}
                        disabled={isCompleted}
                        className={`flex-1 md:flex-none px-4 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 justify-center min-w-[140px] ${
                            isCompleted
                            ? 'bg-green-100 text-green-700 ring-2 ring-green-200 cursor-default' 
                            : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md hover:shadow-lg active:scale-95'
                        }`}
                    >
                        {isCompleted ? (
                            <><span>✔️</span> Completado</>
                        ) : (
                            <><span>💊</span> Tomar ({taken + 1}/{total})</>
                        )}
                    </button>
                    {/* Edit Button */}
                    <button onClick={() => startEditing(med)} className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar Medicamento">✏️</button>
                    {/* Delete Button */}
                    <button onClick={() => removeMed(med.id)} className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Eliminar Medicamento">🗑️</button>
                  </div>
                  
                  {taken > 0 && (
                      <button 
                        onClick={() => handleUndoDose(med.id)}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline px-2"
                      >
                          ↩ Deshacer última toma
                      </button>
                  )}
                </div>
              </div>
            </div>
            );
          })
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