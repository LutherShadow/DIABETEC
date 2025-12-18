
import { UserProfile, Medication, MedicationLog } from '../types';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'vidasalud_profile_v1';
const USER_ID_KEY = 'vidasalud_user_id';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: 0,
  gender: 'other',
  height: 0,
  weight: 0,
  activityLevel: 'sedentary',
  diagnoses: [],
  allowedFoods: [],
  forbiddenFoods: [],
  allergies: [],
  goals: '',
  medications: [],
  history: [], 
  onboardingComplete: false,
  mealPlan: [],
  exerciseRoutine: null
};

export const setUserId = (id: string) => {
    localStorage.setItem(USER_ID_KEY, id);
};

const getUserId = (): string => {
  return localStorage.getItem(USER_ID_KEY) || 'guest';
};

export const getProfile = (): UserProfile => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PROFILE;
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch (e) {
    return DEFAULT_PROFILE;
  }
};

const pushToSupabase = async (profile: UserProfile) => {
  const uid = getUserId();
  if (!uid || uid === 'guest') return;

  try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: uid,
          updated_at: new Date().toISOString(),
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          height: profile.height,
          weight: profile.weight,
          activity_level: profile.activityLevel,
          goals: profile.goals,
          onboarding_complete: profile.onboardingComplete,
          diagnoses: profile.diagnoses,
          allowed_foods: profile.allowedFoods,
          forbidden_foods: profile.forbiddenFoods,
          allergies: profile.allergies,
          medications: profile.medications,
          history: profile.history,
          meal_plan: profile.mealPlan,
          exercise_routine: profile.exerciseRoutine
        });
      if (error) console.error('Cloud Sync Error:', error);
  } catch (err) {
      console.error('Critical sync failure:', err);
  }
};

export const saveProfile = (profile: UserProfile): void => {
  // Siempre intentamos sincronizar con la nube primero para asegurar que no se pierdan imágenes
  pushToSupabase(profile);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e: any) {
    // Si falla el local storage por tamaño (base64 de las fotos), guardamos versión ligera
    if (e.name === 'QuotaExceededError') {
      const lightProfile = { ...profile };
      if (lightProfile.mealPlan) {
          lightProfile.mealPlan = lightProfile.mealPlan.map(m => ({ ...m, imageUrl: undefined }));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightProfile));
      console.warn("Local storage lleno. Imágenes solo guardadas en la nube.");
    }
  }
};

export const loginUser = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const cleanEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.from('profiles').select('*').eq('id', cleanEmail).single();

        if (error || !data) return { success: false, message: 'Usuario no encontrado.' };

        const cloudProfile: UserProfile = {
            id: data.id,
            name: data.name,
            age: data.age,
            gender: data.gender,
            height: data.height,
            weight: data.weight,
            activityLevel: data.activity_level,
            goals: data.goals,
            diagnoses: data.diagnoses || [],
            allowedFoods: data.allowed_foods || [],
            forbiddenFoods: data.forbidden_foods || [],
            allergies: data.allergies || [],
            medications: data.medications || [],
            history: data.history || [],
            onboardingComplete: data.onboarding_complete,
            mealPlan: data.meal_plan || [],
            exerciseRoutine: data.exercise_routine || null
        };

        setUserId(cleanEmail);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudProfile));
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Error de conexión.' };
    }
};

export const logoutUser = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_ID_KEY);
};

export const initializeData = async (): Promise<UserProfile> => {
  const local = getProfile();
  const uid = localStorage.getItem(USER_ID_KEY);
  
  if (uid && uid !== 'guest') {
      try {
          const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
          if (data) {
              const cloud: UserProfile = {
                id: data.id,
                name: data.name,
                age: data.age,
                gender: data.gender,
                height: data.height,
                weight: data.weight,
                activityLevel: data.activity_level,
                goals: data.goals,
                diagnoses: data.diagnoses || [],
                allowedFoods: data.allowed_foods || [],
                forbiddenFoods: data.forbidden_foods || [],
                allergies: data.allergies || [],
                medications: data.medications || [],
                history: data.history || [],
                onboardingComplete: data.onboarding_complete,
                mealPlan: data.meal_plan || [],
                exerciseRoutine: data.exercise_routine || null
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
              return cloud;
          }
      } catch (e) {}
  }
  return local;
};

export const recordMedicationDose = (medId: string): UserProfile => {
  const profile = getProfile();
  const medIndex = profile.medications.findIndex(m => m.id === medId);
  if (medIndex === -1) return profile;

  const med = profile.medications[medIndex];
  const log: MedicationLog = {
      id: Date.now().toString(),
      medName: med.name, 
      timestamp: new Date().toISOString(),
      formattedDate: new Date().toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
      status: 'taken'
  };

  const newHistory = [log, ...(profile.history || [])];
  const newMeds = [...profile.medications];
  newMeds[medIndex] = { ...med, takenToday: true };

  const newProfile = { ...profile, medications: newMeds, history: newHistory };
  saveProfile(newProfile);
  return newProfile;
};

export const removeLastMedicationDose = (medId: string): UserProfile => {
    const profile = getProfile();
    const med = profile.medications.find(m => m.id === medId);
    if (!med) return profile;

    const newHistory = (profile.history || []).filter(h => h.medName !== med.name);
    const newMeds = profile.medications.map(m => m.id === medId ? { ...m, takenToday: false } : m);
    
    const newProfile = { ...profile, medications: newMeds, history: newHistory };
    saveProfile(newProfile);
    return newProfile;
};

export const deleteMedication = (medId: string): UserProfile => {
    const profile = getProfile();
    const newProfile = { ...profile, medications: profile.medications.filter(m => m.id !== medId) };
    saveProfile(newProfile);
    return newProfile;
};

export const resetDailyTracking = (): UserProfile => {
    const profile = getProfile();
    const newProfile = { ...profile, medications: profile.medications.map(m => ({ ...m, takenToday: false })) };
    saveProfile(newProfile);
    return newProfile;
};
