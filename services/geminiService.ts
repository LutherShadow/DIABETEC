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
const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
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

// Helper to clean JSON string (remove markdown blocks and find valid JSON bounds)
const cleanJSON = (text: string) => {
  if (!text) return "[]";
  
  // 1. Remove markdown code blocks
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // 2. Extract content between first [ or { and last ] or }
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');
  const start = (firstBracket > -1 && firstBrace > -1) 
    ? Math.min(firstBracket, firstBrace) 
    : (firstBracket > -1 ? firstBracket : firstBrace);
    
  const lastBracket = cleaned.lastIndexOf(']');
  const lastBrace = cleaned.lastIndexOf('}');
  const end = Math.max(lastBracket, lastBrace);

  if (start > -1 && end > -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
  }

  return cleaned;
};

/**
 * Analyzes a prescription image or text to extract medication details.
 */
export const analyzePrescription = async (input: string, isImage: boolean): Promise<any[]> => {
  try {
    const ai = getAIClient();
    
    // Improved prompt specifically for medical receipts like the one provided
    const prompt = `
        Actúa como un asistente médico experto en lectura de recetas (OCR).
        Tu tarea es extraer la lista de medicamentos y ESTRUCTURAR SUS HORARIOS DE TOMA.

        ESTRATEGIA DE LECTURA:
        1. Busca medicamentos en secciones "TRATAMIENTO" o listas numeradas.
        2. ANALIZA LA FRECUENCIA DETALLADAMENTE para llenar los campos de horario.

        REGLAS PARA "scheduleType" y HORARIOS:
        - Si dice "CADA 24 HORAS" o "1 VEZ AL DÍA": scheduleType="fixed", suggestedTimes=["08:00"].
        - Si dice "CADA 12 HORAS": scheduleType="fixed", suggestedTimes=["08:00", "20:00"].
        - Si dice "CADA 8 HORAS": scheduleType="fixed", suggestedTimes=["08:00", "16:00", "23:00"].
        - Si menciona comidas ("Desayuno", "Comida", "Almuerzo", "Cena"): 
            - scheduleType="meal_relative".
            - Llenar "suggestedMeals" con las comidas mencionadas (breakfast, lunch, dinner).
            - Si dice "Desayuno, Comida y Cena", incluir las 3.

        REGLAS DE EXTRACCIÓN:
        - name: Nombre del medicamento.
        - dosage: Concentración (ej: 500 mg).
        - frequency: Texto original (ej: "Cada 12 horas").
        - timing: "before" (antes) o "after" (después/con alimentos). Por defecto "after".
        
        CRÍTICO:
        - Asegúrate de que la cantidad de horarios en 'suggestedTimes' coincida con la frecuencia (ej: 12h = 2 items).
        - Devuelve JSON válido.
    `;

    let contents: any;

    if (isImage) {
        // Critical Fix: Detect real mime type from Data URL (e.g. image/jpeg) instead of forcing png
        const mimeTypeMatch = input.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
        
        const base64Data = input.includes('base64,') ? input.split('base64,')[1] : input;
        
        contents = {
            parts: [
                { inlineData: { mimeType: mimeType, data: base64Data } },
                { text: prompt }
            ]
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
              suggestedTimes: { type: Type.ARRAY, items: { type: Type.STRING } }, // Array ["08:00", "20:00"]
              suggestedMeals: { type: Type.ARRAY, items: { type: Type.STRING } }, // Array ["breakfast", "dinner"]
              timing: { type: Type.STRING, enum: ["before", "after"] }
            }
          }
        }
      }
    }));
    
    const cleanedText = cleanJSON(response.text || "[]");
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw error; 
  }
};

/**
 * Generates a meal plan based on user profile.
 */
export const generateDailyMealPlan = async (profile: UserProfile): Promise<Meal[]> => {
  try {
    const ai = getAIClient();
    const prompt = `
        Crea un plan de alimentación de 1 día (Desayuno, Almuerzo, Cena, Snack) para:
        - Diagnósticos: ${profile.diagnoses.join(', ')}
        - Alimentos Prohibidos: ${profile.forbiddenFoods.join(', ')}
        - Alimentos Permitidos: ${profile.allowedFoods.join(', ')}
        - Objetivo: ${profile.goals}
        
        REGLAS:
        - Idioma: ESPAÑOL.
        - Excluye estrictamente alimentos prohibidos.
        - Adapta la dieta a la condición médica (ej: Diabetes -> Bajo índice glucémico).
        - Mantén las descripciones concisas.
        
        Devuelve JSON Array.
    `;

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192, // Increased to prevent truncation
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

    const cleanedText = cleanJSON(response.text || "[]");
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Meal generation failed:", error);
    return [];
  }
};

/**
 * Generates an image of a meal.
 */
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
              return `data:image/png;base64,${part.inlineData.data}`;
          }
      }
      return null;
  } catch (error) {
      console.error("Image gen failed", error);
      // We don't throw here to let the UI continue without image
      return null;
  }
};

/**
 * Generates an exercise routine.
 */
export const generateExerciseRoutine = async (profile: UserProfile): Promise<ExerciseRoutine | null> => {
  try {
    const ai = getAIClient();
    const prompt = `
        Crea una rutina de ejercicios de 20-30 minutos en ESPAÑOL para:
        - Edad: ${profile.age}
        - Diagnóstico: ${profile.diagnoses.join(', ')}
        - Nivel: ${profile.activityLevel}
        
        REGLAS MÉDICAS:
        - Si tiene DIABETES, incluye obligatoriamente caminar después de las comidas o ejercicios para estabilizar glucosa.
        - Proporciona "tips" BREVES de técnica.
        - Describe visualmente el ejercicio en "visualDescription" (MÁXIMO 10-15 PALABRAS) para buscar una imagen.
        
        Devuelve JSON válido.
    `;

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192, // Increased to prevent truncation (Fix for error at position 6262)
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
    
    const cleanedText = cleanJSON(response.text || "null");
    return JSON.parse(cleanedText);
  } catch (e) {
      console.error("Exercise gen failed", e);
      return null;
  }
};