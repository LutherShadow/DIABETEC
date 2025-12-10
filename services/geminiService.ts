import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { UserProfile, Meal, ExerciseRoutine, Medication } from "../types";

// Helper to get API key safely
const getAIClient = () => {
  let apiKey: string | undefined;

  // 1. Try Vite standard (import.meta.env)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) {
      // @ts-ignore
      apiKey = import.meta.env.VITE_API_KEY;
    }
  } catch (e) {}

  // 2. Try process.env (Node/Webpack/Polyfill)
  if (!apiKey) {
    try {
      if (typeof process !== 'undefined' && process.env?.API_KEY) {
        apiKey = process.env.API_KEY;
      }
    } catch (e) {}
  }

  if (!apiKey) {
    throw new Error("API Key is missing. Por favor configura VITE_API_KEY en tus variables de entorno (Vercel/env).");
  }
  return new GoogleGenAI({ apiKey });
};

// Retry helper for 429 errors
const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 4000): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota'))) {
            console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
            await new Promise(res => setTimeout(res, delay));
            return retry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
};

// Helper to clean JSON string
const cleanJSON = (text: string) => {
  if (!text) return "[]";
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  const start = (firstBracket > -1 && firstBrace > -1) ? Math.min(firstBracket, firstBrace) : (firstBracket > -1 ? firstBracket : firstBrace);
  const lastBracket = cleaned.lastIndexOf(']');
  const lastBrace = cleaned.lastIndexOf('}');
  const end = Math.max(lastBracket, lastBrace);
  if (start > -1 && end > -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned;
};

// --- IMAGE COMPRESSION HELPER ---
// Converts massive PNG base64 from Gemini to optimized JPEG base64
const compressBase64Image = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            // Handle both raw base64 and data URI
            const src = base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`;
            img.src = src;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Resize to max 800px width to save massive space
                const MAX_WIDTH = 800;
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
                    // Compress to JPEG 0.7 quality
                    const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(optimizedBase64);
                } else {
                    resolve(src); // Fallback to original
                }
            };
            img.onerror = () => resolve(src); // Fallback
        } catch (e) {
            resolve(base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`);
        }
    });
};

export const analyzePrescription = async (input: string, isImage: boolean): Promise<any[]> => {
  try {
    const ai = getAIClient();
    const prompt = `
        Actúa como un asistente médico experto en lectura de recetas (OCR).
        Tu tarea es extraer la lista de medicamentos y ESTRUCTURAR SUS HORARIOS DE TOMA.
        
        REGLAS:
        - Si dice "CADA 24 HORAS" o "1 VEZ AL DÍA": scheduleType="fixed", suggestedTimes=["08:00"].
        - Si dice "CADA 12 HORAS": scheduleType="fixed", suggestedTimes=["08:00", "20:00"].
        - Si dice "CADA 8 HORAS": scheduleType="fixed", suggestedTimes=["08:00", "16:00", "23:00"].
        - Si menciona comidas: scheduleType="meal_relative".
        - Devuelve JSON válido.
    `;

    let contents: any;
    if (isImage) {
        const mimeTypeMatch = input.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
        const base64Data = input.includes('base64,') ? input.split('base64,')[1] : input;
        contents = {
            parts: [{ inlineData: { mimeType: mimeType, data: base64Data } }, { text: prompt }]
        };
    } else {
        contents = { parts: [{ text: `Analiza este texto de receta médica: "${input}". ${prompt}` }] };
    }

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              dosage: { type: Type.STRING },
              frequency: { type: Type.STRING },
              instructions: { type: Type.STRING },
              scheduleType: { type: Type.STRING, enum: ["fixed", "meal_relative"] },
              suggestedTimes: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedMeals: { type: Type.ARRAY, items: { type: Type.STRING } },
              timing: { type: Type.STRING, enum: ["before", "after"] }
            }
          }
        }
      }
    }));
    return JSON.parse(cleanJSON(response.text || "[]"));
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw error; 
  }
};

export const generateDailyMealPlan = async (profile: UserProfile): Promise<Meal[]> => {
  try {
    const ai = getAIClient();
    const prompt = `
        Crea un plan de alimentación de 1 día (Desayuno, Almuerzo, Cena, Snack) para:
        - Diagnósticos: ${profile.diagnoses.join(', ')}
        - Alimentos Prohibidos: ${profile.forbiddenFoods.join(', ')}
        - Alimentos Permitidos: ${profile.allowedFoods.join(', ')}
        - Objetivo: ${profile.goals}
        - Idioma: ESPAÑOL.
        Devuelve JSON Array.
    `;

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              calories: { type: Type.NUMBER },
              glycemicIndex: { type: Type.STRING, enum: ["Bajo", "Medio", "Alto"] },
              suitableFor: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      }
    }));
    return JSON.parse(cleanJSON(response.text || "[]"));
  } catch (error) {
    console.error("Meal generation failed:", error);
    return [];
  }
};

export const generateMealImage = async (mealDescription: string): Promise<string | null> => {
  try {
      const ai = getAIClient();
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: {
            parts: [{ text: `Professional food photography, delicious, healthy: ${mealDescription}` }]
        },
        config: {}
      }));
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
              // COMPRESS: Optimize image before returning to save Storage Quota
              const rawBase64 = part.inlineData.data;
              const optimizedImage = await compressBase64Image(rawBase64);
              return optimizedImage;
          }
      }
      return null;
  } catch (error) {
      console.warn("Image gen failed (Quota/Error). Using placeholder.", error);
      const text = mealDescription.split(' ')[0] || 'Comida';
      return `https://placehold.co/600x400/e2e8f0/475569?text=${encodeURIComponent(text)}`;
  }
};

export const generateExerciseRoutine = async (profile: UserProfile): Promise<ExerciseRoutine | null> => {
  try {
    const ai = getAIClient();
    const prompt = `
        Crea una rutina de ejercicios de 20-30 minutos en ESPAÑOL para:
        - Edad: ${profile.age}
        - Diagnóstico: ${profile.diagnoses.join(', ')}
        - Nivel: ${profile.activityLevel}
        Devuelve JSON válido.
    `;

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER },
            intensity: { type: Type.STRING, enum: ["Baja", "Media", "Alta"] },
            description: { type: Type.STRING },
            medicalTip: { type: Type.STRING },
            safetyNotes: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    reps: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    tips: { type: Type.STRING },
                    visualDescription: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    }));
    return JSON.parse(cleanJSON(response.text || "null"));
  } catch (e) {
      console.error("Exercise gen failed", e);
      return null;
  }
};