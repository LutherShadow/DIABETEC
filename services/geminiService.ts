
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { UserProfile, Meal, ExerciseRoutine, Exercise } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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

const safeJsonParse = (text: string | undefined) => {
    if (!text) return null;
    try {
        // Limpiar posibles bloques de código markdown que el modelo pueda incluir
        const cleanText = text.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Error al parsear JSON de Gemini:", e);
        // Intentar rescatar lo que sea posible si está truncado (opcional, aquí devolvemos null para seguridad)
        return null;
    }
};

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

export const analyzeAndAdaptRoutine = async (
    content: string, 
    profile: UserProfile, 
    isImage: boolean, 
    existingRoutine?: ExerciseRoutine | null
): Promise<ExerciseRoutine | null> => {
    const ai = getAI();
    let systemPrompt = `Eres un Médico Fisioterapeuta y Entrenador de Élite. 
    TAREA: Analiza la nueva rutina adjunta (ej: Darebee, One Punch Man, etc.).
    PERFIL MÉDICO: El usuario tiene ${profile.diagnoses.join(', ')}.
    
    REGLAS CRÍTICAS:
    1. FRACCIONAMIENTO: Si detectas volúmenes altos (ej: 100 flexiones), DIVIDELOS en series manejables (ej: 5 series de 20) con descanso.
    2. SEGURIDAD: Adapta ejercicios de alto impacto a versiones seguras para sus patologías.
    3. CALENDARIO: Distribuye en 0-6 (Dom-Sab).
    4. REZONAMIENTO: Explica en 'medicalReasoning' el beneficio para su condición específica.`;

    if (existingRoutine) {
        systemPrompt += `
        MODO COMBINAR: El usuario YA TIENE una rutina: "${existingRoutine.title}". 
        INTEGRA los nuevos ejercicios con los existentes de forma equilibrada. 
        - Si hay ejercicios similares, ajusta el volumen total. 
        - NO dupliques esfuerzos idénticos.
        - Asegúrate de que el tiempo total diario no exceda los 60 minutos.`;
    }

    let parts: any[] = [{ text: systemPrompt }];
    if (isImage) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: content.split(',')[1] } });
    } else {
        parts.push({ text: `Nueva rutina a procesar: ${content}` });
    }

    if (existingRoutine) {
        parts.push({ text: `Rutina actual para combinar: ${JSON.stringify(existingRoutine)}` });
    }

    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: { 
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  intensity: { type: Type.STRING },
                  originalMethod: { type: Type.STRING },
                  exercises: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              id: { type: Type.STRING },
                              name: { type: Type.STRING },
                              sets: { type: Type.NUMBER },
                              repsPerSet: { type: Type.STRING },
                              reps: { type: Type.STRING },
                              tips: { type: Type.STRING },
                              benefits: { type: Type.STRING },
                              medicalReasoning: { type: Type.STRING },
                              medicalCaution: { type: Type.STRING },
                              scheduledDay: { type: Type.NUMBER }
                          }
                      }
                  },
                  safetyNotes: { type: Type.STRING }
              }
          }
      }
    }));
    return safeJsonParse(response.text);
};

export const generateDailyMealPlan = async (profile: UserProfile): Promise<Meal[]> => {
    const ai = getAI();
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Plan de comidas para: ${profile.diagnoses.join(', ')}. Objetivo: ${profile.goals}.`,
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
    return safeJsonParse(response.text) || [];
};

export const generateMealImage = async (mealDescription: string): Promise<string | null> => {
  const ai = getAI();
  try {
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: `High quality food photography: ${mealDescription}` }] }
      }));
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData ? await compressBase64Image(part.inlineData.data) : null;
  } catch (error) { return null; }
};

export const generateExerciseImage = async (exerciseName: string): Promise<string | null> => {
  const ai = getAI();
  try {
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: `Fitness demonstration: ${exerciseName}, professional, clear background.` }] }
      }));
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData ? await compressBase64Image(part.inlineData.data) : null;
  } catch (error) { return null; }
};

export const analyzePrescription = async (input: string, isImage: boolean): Promise<any[]> => {
    const ai = getAI();
    const prompt = `Extrae medicamentos de la receta. JSON Array.`;
    let contents = isImage 
        ? { parts: [{ inlineData: { mimeType: 'image/png', data: input.split(',')[1] } }, { text: prompt }] } 
        : { parts: [{ text: `${input}. ${prompt}` }] };
    
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: { responseMimeType: "application/json" }
    }));
    return safeJsonParse(response.text) || [];
};

export const generateExerciseRoutine = async (profile: UserProfile): Promise<ExerciseRoutine | null> => {
    const ai = getAI();
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rutina semanal adaptada para: ${profile.diagnoses.join(', ')}. Distribuye en 0-6.`,
      config: { 
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  intensity: { type: Type.STRING },
                  exercises: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              id: { type: Type.STRING },
                              name: { type: Type.STRING },
                              sets: { type: Type.NUMBER },
                              repsPerSet: { type: Type.STRING },
                              reps: { type: Type.STRING },
                              tips: { type: Type.STRING },
                              benefits: { type: Type.STRING },
                              medicalReasoning: { type: Type.STRING },
                              medicalCaution: { type: Type.STRING },
                              scheduledDay: { type: Type.NUMBER }
                          }
                      }
                  },
                  safetyNotes: { type: Type.STRING }
              }
          }
      }
    }));
    return safeJsonParse(response.text);
};
