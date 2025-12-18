
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { UserProfile, Meal, ExerciseRoutine, Medication } from "../types";

// Always initialize with process.env.API_KEY using a named parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// Helper to handle retries with exponential backoff for rate limiting
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

// Compresses base64 images to optimize storage and API payload size
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

// Fixes Error in file services/geminiService.ts on line 76: Property 'text' does not exist on type 'unknown'.
export const analyzePrescription = async (input: string, isImage: boolean): Promise<any[]> => {
    const prompt = `Analiza la receta médica. Reglas: Si es cada 8h: ["08:00", "16:00", "23:00"]. Devuelve JSON válido.`;
    let contents = isImage 
        ? { parts: [{ inlineData: { mimeType: 'image/png', data: input.split(',')[1] } }, { text: prompt }] } 
        : { parts: [{ text: `${input}. ${prompt}` }] };
    
    // Explicitly typing response to GenerateContentResponse to fix 'unknown' error
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(response.text || "[]");
};

// Fixes Error in file services/geminiService.ts on line 86: Property 'text' does not exist on type 'unknown'.
export const generateDailyMealPlan = async (profile: UserProfile): Promise<Meal[]> => {
    // Explicitly typing response to GenerateContentResponse to fix 'unknown' error
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Plan de 1 día para: ${profile.diagnoses.join(', ')}. Evitar: ${profile.forbiddenFoods.join(', ')}. JSON format.`,
      config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(response.text || "[]");
};

// Fixes Error in file services/geminiService.ts on line 96: Property 'candidates' does not exist on type 'unknown'.
export const generateMealImage = async (mealDescription: string): Promise<string | null> => {
  try {
      // Explicitly typing response to GenerateContentResponse and using correct model for image generation
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: `Healthy food photo: ${mealDescription}` }] }
      }));
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData ? await compressBase64Image(part.inlineData.data) : null;
  } catch (error) {
      console.error("Meal image generation error:", error);
      return `https://placehold.co/600x400/e2e8f0/475569?text=Comida`;
  }
};

// Fixes Error in file services/geminiService.ts on line 110: Property 'candidates' does not exist on type 'unknown'.
export const generateExerciseImage = async (exerciseName: string): Promise<string | null> => {
  try {
      // Explicitly typing response to GenerateContentResponse and using correct model for image generation
      const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [{ text: `Action photo of a person performing ${exerciseName}, white background, professional fitness photography.` }] }
      }));
      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      return part?.inlineData ? await compressBase64Image(part.inlineData.data) : null;
  } catch (error) {
      console.error("Exercise image generation error:", error);
      return `https://placehold.co/400x400/f8fafc/ea580c?text=${encodeURIComponent(exerciseName)}`;
  }
};

// Fixes Error in file services/geminiService.ts on line 124: Property 'text' does not exist on type 'unknown'.
export const generateExerciseRoutine = async (profile: UserProfile): Promise<ExerciseRoutine | null> => {
    // Explicitly typing response to GenerateContentResponse to fix 'unknown' error
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Rutina para ${profile.age} años con ${profile.diagnoses.join(', ')}. Nivel: ${profile.activityLevel}. JSON format.`,
      config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(response.text || "null");
};
