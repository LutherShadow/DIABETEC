
import React, { useState } from 'react';
import { UserProfile, Meal } from '../types';
import { generateDailyMealPlan, generateMealImage } from '../services/geminiService';
import { saveProfile } from '../services/storageService';

interface Props {
  profile: UserProfile;
}

const MealPlanner: React.FC<Props> = ({ profile }) => {
  const [meals, setMeals] = useState<Meal[]>(Array.isArray(profile.mealPlan) ? profile.mealPlan : []);
  const [loading, setLoading] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setMeals([]); 
    try {
        const plan = await generateDailyMealPlan(profile);
        const validPlan = Array.isArray(plan) ? plan : [];
        setMeals(validPlan);
        saveProfile({ ...profile, mealPlan: validPlan });
    } catch (error) {
        console.error("Error generating meals", error);
    } finally {
        setLoading(false);
    }
  };

  const handleLoadImage = async (mealName: string, description: string, index: number) => {
      setGeneratingImageFor(mealName);
      try {
          const imageUrl = await generateMealImage(`${mealName}: ${description}`);
          if (imageUrl) {
              const newMeals = [...meals];
              newMeals[index].imageUrl = imageUrl;
              setMeals(newMeals);
              saveProfile({ ...profile, mealPlan: newMeals });
          }
      } finally {
          setGeneratingImageFor(null);
      }
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
          className="bg-teal-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Consultando IA...' : (meals.length > 0 ? 'Regenerar Menú' : 'Generar Menú')}
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center text-teal-600 animate-pulse">
           <p className="text-xl">🍳 Preparando tu plan personalizado...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Array.isArray(meals) ? meals : []).map((meal, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition bg-white flex flex-col">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-start">
               <div>
                  <h3 className="font-bold text-lg text-gray-800">{meal.name}</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-teal-600 bg-teal-50 px-2 py-1 rounded mt-1 inline-block">
                    {Array.isArray(meal.suitableFor) ? meal.suitableFor.join(', ') : 'General'}
                  </span>
               </div>
               <div className="text-right">
                 <span className="text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-700">
                    {meal.glycemicIndex || 'Bajo'}
                 </span>
                 <div className="text-xs text-gray-500 mt-1">{meal.calories} kcal</div>
               </div>
            </div>
            
            <div className="p-4 flex-1">
                {meal.imageUrl ? (
                    <img src={meal.imageUrl} alt={meal.name} className="w-full h-40 object-cover rounded-lg mb-3 shadow-inner" />
                ) : (
                    <button 
                        onClick={() => handleLoadImage(meal.name, meal.description, idx)}
                        disabled={generatingImageFor === meal.name}
                        className="w-full h-32 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition mb-3 border-2 border-dashed border-gray-200"
                    >
                       {generatingImageFor === meal.name ? '...' : '📸 Generar Imagen'}
                    </button>
                )}
                <p className="text-sm text-gray-600 mb-3 italic">"{meal.description}"</p>
                <div className="flex flex-wrap gap-1">
                    {(Array.isArray(meal.ingredients) ? meal.ingredients : []).map((ing, i) => (
                        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ing}</span>
                    ))}
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MealPlanner;
