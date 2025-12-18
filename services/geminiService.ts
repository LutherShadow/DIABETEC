
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { UserProfile, Meal, ExerciseRoutine, Medication } from "../types";

// Inicialización con la API KEY del entorno
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// Helper para reintentos en caso de cuota excedida
const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 4000): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.message?.includes('429'))) {
            await new Promise(res => setTimeout(res, delay));
            return retry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
};

// Comprime las imágenes Base64 para no saturar el almacenamiento local/DB
const compressBase64Image = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            const src = base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`;
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = height * (MAX_WIDTH / width);
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                } else resolve(src);
            };
            img.onerror = () => resolve(src);
        } catch (e) { resolve(base64Str); }
    });
};

export const analyzePrescription = async (input: string, isImage: boolean): Promise<any[]> => {
    const prompt = `Analiza la receta médica. Extrae medicamentos. Si es cada 8h usa ["08:00", "16:00", "23:00"]. Devuelve JSON Array.`;
    let contents = isImage 
        ? { parts: [{ inlineData: { mimeType: 'image/png', data: input.split(',')[1] } }, { text: prompt }] } 
        : { parts: [{ text: `${input}. ${prompt}` }] };
    
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: { 
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      name: { type: Type.STRING },
                      dosage: { type: Type.STRING },
                      frequency: { type: Type.STRING },
                      scheduleType: { type: Type.STRING },
                      suggestedTimes: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
              }
          }
      }
    }));
    return JSON.parse(response.text || "[]");
};

export const generateDailyMealPlan = async (profile: UserProfile): Promise<Meal[]> => {
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Genera un plan de comidas (Desayuno, Almuerzo, Cena, Snack) para un paciente con: ${profile.diagnoses.join(', ')}. Evitar: ${profile.forbiddenFoods.join(', ')}. Objetivo: ${profile.goals}.`,
      config: { 
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                      calories: { type: Type.NUMBER },
                      glycemicIndex: { type: Type.STRING },
                      suitableFor: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
              }
          }
      }
    }));
    const data = JSON.parse(response.text || "[]");
    return Array.isArray(data) ? data : [];
};

export const generateMealImage = async (mealDescription: string): Promise<string | null> => {
  try {
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: `High quality food photography: ${mealDescription}` }] }
      }));
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData ? await compressBase64Image(part.inlineData.data) : null;
  } catch (error) {
      return `https://placehold.co/600x400/e2e8f0/475569?text=Comida`;
  }
};

export const generateExerciseImage = async (exerciseName: string): Promise<string | null> => {
  try {
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: `Person doing exercise: ${exerciseName}, clean fitness environment, illustrative style.` }] }
      }));
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData ? await compressBase64Image(part.inlineData.data) : null;
  } catch (error) {
      return `https://placehold.co/400x400/f8fafc/ea580c?text=${encodeURIComponent(exerciseName)}`;
  }
};

export const generateExerciseRoutine = async (profile: UserProfile): Promise<ExerciseRoutine | null> => {
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rutina de ejercicios para ${profile.age} años con ${profile.diagnoses.join(', ')}. Nivel: ${profile.activityLevel}.`,
      config: { 
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  durationMinutes: { type: Type.NUMBER },
                  intensity: { type: Type.STRING },
                  exercises: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              name: { type: Type.STRING },
                              reps: { type: Type.STRING },
                              tips: { type: Type.STRING }
                          }
                      }
                  },
                  safetyNotes: { type: Type.STRING }
              }
          }
      }
    }));
    return JSON.parse(response.text || "null");
};
