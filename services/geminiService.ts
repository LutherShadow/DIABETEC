import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, Meal, ExerciseRoutine, Medication } from "../types";

// Helper to get API key safely
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
  }
  return new GoogleGenAI({ apiKey });
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
export const analyzePrescription = async (input: string, isImage: boolean): Promise<Partial<Medication>[]> => {
  try {
    const ai = getAIClient();
    
    // Improved prompt specifically for medical receipts like the one provided
    const prompt = `
        Actúa como un asistente médico experto en lectura de recetas (OCR).
        Tu tarea es extraer la lista de medicamentos de esta imagen.

        ESTRATEGIA DE LECTURA:
        1. Busca la sección titulada "TRATAMIENTO" o listas numeradas (1.-, 2.-, etc.).
        2. Los medicamentos suelen estar en MAYÚSCULAS (ej: GLIBENCLAMIDA, METFORMINA).
        3. Ignora encabezados administrativos, códigos de barras o pies de página.
        
        REGLAS DE EXTRACCIÓN PARA CADA MEDICAMENTO:
        - name: Nombre del principio activo (ej: Metformina).
        - dosage: Concentración (ej: 850 mg, 5 mg).
        - frequency: Frecuencia de toma (ej: "Cada 12 horas", "Antes de cada comida"). Traduce frecuencias numéricas a texto claro.
        - instructions: Instrucciones completas (ej: "Tomar una tableta con el desayuno").
        - requiresFood: true si menciona "comida", "alimentos", "desayuno", "cena" o "almuerzo". false si es en ayunas o indiferente.
        
        CRÍTICO:
        - Devuelve JSON válido.
        - Escapa correctamente las comillas dobles dentro de los textos.
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192, // Increased significantly to prevent truncation of long receipts
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              dosage: { type: Type.STRING },
              frequency: { type: Type.STRING },
              instructions: { type: Type.STRING },
              requiresFood: { type: Type.BOOLEAN }
            }
          }
        }
      }
    });
    
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

    const response = await ai.models.generateContent({
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
    });

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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: {
            parts: [{ text: `Professional food photography, delicious, healthy: ${mealDescription}` }]
        },
        config: {}
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
          }
      }
      return null;
  } catch (error) {
      console.error("Image gen failed", error);
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

    const response = await ai.models.generateContent({
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
    });
    
    const cleanedText = cleanJSON(response.text || "null");
    return JSON.parse(cleanedText);
  } catch (e) {
      console.error("Exercise gen failed", e);
      return null;
  }
};