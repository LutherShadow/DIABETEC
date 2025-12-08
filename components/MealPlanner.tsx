import React, { useState, useEffect } from 'react';
import { UserProfile, Meal } from '../types';
import { generateDailyMealPlan, generateMealImage } from '../services/geminiService';
import { saveProfile } from '../services/storageService';

interface Props {
  profile: UserProfile;
}

const MealPlanner: React.FC<Props> = ({ profile }) => {
  // Initialize with persisted data if available
  const [meals, setMeals] = useState<Meal[]>(profile.mealPlan || []);
  const [loading, setLoading] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    // Clear old state visually
    setMeals([]); 
    
    try {
        const plan = await generateDailyMealPlan(profile);
        setMeals(plan);
        
        // PERSISTENCE: Save to Supabase via Profile
        const updatedProfile = { ...profile, mealPlan: plan };
        saveProfile(updatedProfile);
        
    } catch (error) {
        console.error("Error generating meals", error);
        alert("Hubo un error al generar el plan. Intenta de nuevo.");
    } finally {
        setLoading(false);
    }
  };

  const handleLoadImage = async (mealName: string, description: string, index: number) => {
      setGeneratingImageFor(mealName);
      const imageUrl = await generateMealImage(`${mealName}. ${description}`);
      if (imageUrl) {
          const newMeals = [...meals];
          newMeals[index].imageUrl = imageUrl;
          setMeals(newMeals);
          
          // PERSISTENCE: Save image URL updates
          const updatedProfile = { ...profile, mealPlan: newMeals };
          saveProfile(updatedProfile);
      }
      setGeneratingImageFor(null);
  };

  return (
    <div className="p-4 md:p-6 bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-teal-800 flex items-center gap-2">
          <span>🥗</span> Plan Nutricional
        </h2>
        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="bg-teal-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          {loading ? 'Consultando IA...' : (meals.length > 0 ? 'Regenerar Menú' : 'Generar Menú')}
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center text-teal-600">
           <p className="animate-bounce text-xl">👩‍⚕️</p>
           <p>Analizando restricciones y buscando recetas...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {meals.map((meal, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-start">
               <div>
                  <h3 className="font-bold text-lg text-gray-800">{meal.name}</h3>
                  <span className="text-xs uppercase font-bold tracking-wider text-teal-600 bg-teal-50 px-2 py-1 rounded mt-1 inline-block">
                    {meal.suitableFor.join(', ')}
                  </span>
               </div>
               <div className="text-right">
                 <span className={`text-xs font-bold px-2 py-1 rounded ${meal.glycemicIndex === 'Low' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    IG: {meal.glycemicIndex}
                 </span>
                 <div className="text-sm text-gray-500 mt-1">{meal.calories} kcal</div>
               </div>
            </div>
            
            <div className="p-4">
                <p className="text-gray-600 mb-4 text-sm italic">"{meal.description}"</p>
                
                {meal.imageUrl ? (
                    <img src={meal.imageUrl} alt={meal.name} className="w-full h-48 object-cover rounded-lg mb-4" />
                ) : (
                    <button 
                        onClick={() => handleLoadImage(meal.name, meal.description, idx)}
                        disabled={generatingImageFor === meal.name}
                        className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-200 transition mb-4 border-dashed border-2 border-gray-300"
                    >
                       {generatingImageFor === meal.name ? 'Generando imagen...' : '📸 Ver plato (Generar Imagen)'}
                    </button>
                )}

                <h4 className="font-semibold text-sm text-gray-700 mb-2">Ingredientes clave:</h4>
                <div className="flex flex-wrap gap-2">
                    {meal.ingredients.map((ing, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{ing}</span>
                    ))}
                </div>
            </div>
          </div>
        ))}
      </div>
      
      {!loading && meals.length === 0 && (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
           Presiona "Generar Menú" para obtener un plan basado en tu perfil médico.
           <br/>
           <span className="text-sm">Se guardará automáticamente en tu perfil.</span>
        </div>
      )}
    </div>
  );
};

export default MealPlanner;