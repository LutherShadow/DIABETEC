
import React, { useState, useEffect } from 'react';
import { UserProfile, Meal } from '../types';
import { generateDailyMealPlan, generateMealImage } from '../services/geminiService';

interface Props {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

const MealPlanner: React.FC<Props> = ({ profile, onUpdate }) => {
  // Siempre usamos el estado del perfil como fuente de verdad
  const [loading, setLoading] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  
  // Obtenemos los platos actuales del perfil (asegurando que sea un array)
  const currentMeals = Array.isArray(profile.mealPlan) ? profile.mealPlan : [];

  const handleGenerate = async () => {
    if (currentMeals.length > 0 && !window.confirm("¿Quieres generar un nuevo menú? Se perderá el actual.")) return;
    
    setLoading(true);
    try {
        const plan = await generateDailyMealPlan(profile);
        const validPlan = Array.isArray(plan) ? plan : [];
        
        // Actualizamos el perfil global
        const updatedProfile = { ...profile, mealPlan: validPlan };
        onUpdate(updatedProfile);
        
    } catch (error) {
        console.error("Error generating meals", error);
        alert("Error al generar el menú. Intenta de nuevo.");
    } finally {
        setLoading(false);
    }
  };

  const handleLoadImage = async (mealName: string, description: string, index: number) => {
      setGeneratingImageFor(mealName);
      try {
          const imageUrl = await generateMealImage(`${mealName}: ${description}`);
          if (imageUrl) {
              const newMeals = [...currentMeals];
              newMeals[index] = { ...newMeals[index], imageUrl };
              
              // Persistir el cambio de la imagen en el perfil global
              const updatedProfile = { ...profile, mealPlan: newMeals };
              onUpdate(updatedProfile);
          }
      } catch (e) {
          console.error("Error loading image", e);
      } finally {
          setGeneratingImageFor(null);
      }
  };

  const clearMenu = () => {
    if (window.confirm("¿Eliminar el menú actual?")) {
        const updatedProfile = { ...profile, mealPlan: [] };
        onUpdate(updatedProfile);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-xl shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-teal-800 flex items-center gap-2">
            <span>🥗</span> Plan Nutricional
            </h2>
            <p className="text-gray-500 text-sm">Menú personalizado basado en tu perfil médico.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            {currentMeals.length > 0 && (
                <button 
                    onClick={clearMenu}
                    className="flex-1 md:flex-none border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                    Limpiar
                </button>
            )}
            <button 
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 md:flex-none bg-teal-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 shadow-sm transition-all"
            >
                {loading ? 'Consultando IA...' : (currentMeals.length > 0 ? '🔄 Nuevo Menú' : '✨ Generar Menú')}
            </button>
        </div>
      </div>

      {loading && (
        <div className="py-20 text-center animate-fade-in">
           <div className="inline-block animate-spin text-4xl mb-4">🍳</div>
           <p className="text-teal-600 font-medium animate-pulse">Analizando tus necesidades nutricionales...</p>
        </div>
      )}

      {!loading && currentMeals.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="text-5xl mb-4">🍽️</div>
              <h3 className="text-lg font-bold text-gray-700">Aún no hay un plan activo</h3>
              <p className="text-gray-500 max-w-xs mx-auto text-sm mt-2">Presiona el botón para que nuestra IA diseñe una dieta segura para tu condición.</p>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {currentMeals.map((meal, idx) => (
          <div key={idx} className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 bg-white flex flex-col border-b-4 border-b-teal-500">
            <div className="bg-teal-50/50 p-4 border-b border-teal-100 flex justify-between items-start">
               <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-800 leading-tight">{meal.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Array.isArray(meal.suitableFor) && meal.suitableFor.map((tag, i) => (
                        <span key={i} className="text-[9px] uppercase font-bold tracking-tighter text-teal-700 bg-white px-1.5 py-0.5 rounded border border-teal-200">
                            {tag}
                        </span>
                    ))}
                  </div>
               </div>
               <div className="text-right shrink-0 ml-2">
                 <div className="text-xs font-black px-2 py-0.5 rounded bg-teal-600 text-white inline-block mb-1">
                    IG: {meal.glycemicIndex || 'Bajo'}
                 </div>
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{meal.calories} kcal</div>
               </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
                <div className="relative group mb-4">
                    {meal.imageUrl ? (
                        <img 
                            src={meal.imageUrl} 
                            alt={meal.name} 
                            className="w-full h-44 object-cover rounded-xl shadow-inner border border-gray-100" 
                        />
                    ) : (
                        <button 
                            onClick={() => handleLoadImage(meal.name, meal.description, idx)}
                            disabled={generatingImageFor === meal.name}
                            className="w-full h-44 bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-teal-50 hover:text-teal-600 transition-all border-2 border-dashed border-gray-200 group-hover:border-teal-300"
                        >
                           {generatingImageFor === meal.name ? (
                               <div className="flex flex-col items-center">
                                   <span className="animate-bounce text-2xl mb-2">📸</span>
                                   <span className="text-xs font-bold">Generando foto...</span>
                               </div>
                           ) : (
                               <>
                                   <span className="text-3xl mb-1 group-hover:scale-125 transition-transform">📷</span>
                                   <span className="text-[10px] font-bold uppercase tracking-widest">Ver platillo</span>
                               </>
                           )}
                        </button>
                    )}
                </div>

                <div className="flex-1">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Descripción</h4>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-3">"{meal.description}"</p>
                    
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ingredientes Clave</h4>
                    <div className="flex flex-wrap gap-1">
                        {(Array.isArray(meal.ingredients) ? meal.ingredients : []).map((ing, i) => (
                            <span key={i} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-200">{ing}</span>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        ))}
      </div>
      
      {currentMeals.length > 0 && (
          <div className="mt-8 p-4 bg-teal-50 rounded-xl border border-teal-100 text-center">
              <p className="text-xs text-teal-700">💡 <b>Tip de Salud:</b> Este menú ha sido guardado automáticamente en tu perfil y en la nube.</p>
          </div>
      )}
    </div>
  );
};

export default MealPlanner;
