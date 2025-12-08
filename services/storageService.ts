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

// --- ID Management ---
export const setUserId = (id: string) => {
    localStorage.setItem(USER_ID_KEY, id);
};

const getUserId = (): string => {
  let uid = localStorage.getItem(USER_ID_KEY);
  if (!uid) {
    // If no ID, we return a temp one, but Onboarding/Login should set this properly now
    uid = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, uid);
  }
  return uid;
};

// --- Synchronous Local Access (Speed) ---
export const getProfile = (): UserProfile => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PROFILE;
    
    const parsed = JSON.parse(stored);
    if (!parsed.history) parsed.history = [];
    return parsed;
  } catch (e) {
    console.error('Error reading profile', e);
    return DEFAULT_PROFILE;
  }
};

// --- Async Cloud Sync ---
const pushToSupabase = async (profile: UserProfile) => {
  const uid = getUserId(); // Use the ID from local storage (which is now the email)
  
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
      // Store complex arrays as JSONB
      diagnoses: profile.diagnoses,
      allowed_foods: profile.allowedFoods,
      forbidden_foods: profile.forbiddenFoods,
      allergies: profile.allergies,
      medications: profile.medications,
      history: profile.history,
      // New Persisted Fields
      meal_plan: profile.mealPlan,
      exercise_routine: profile.exerciseRoutine
    });

  if (error) {
    console.error('Error syncing to Supabase:', error);
  }
};

export const saveProfile = (profile: UserProfile): void => {
  try {
    // 1. Save Local (Instant)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    
    // 2. Sync Cloud (Background)
    pushToSupabase(profile);
  } catch (e) {
    console.error('Error saving profile', e);
  }
};

// --- Login / Recovery Logic ---
export const loginUser = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const cleanEmail = email.trim().toLowerCase();
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', cleanEmail)
            .single();

        if (error || !data) {
            return { success: false, message: 'Usuario no encontrado. Por favor regístrate.' };
        }

        // Map database columns to UserProfile object
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

        // Update Local Storage
        setUserId(cleanEmail);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudProfile));
        
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Error de conexión.' };
    }
};

// --- Logout Logic ---
export const logoutUser = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_ID_KEY);
    // Optional: supabase.auth.signOut() if using Supabase Auth in the future
};

// --- Initialization Logic ---
export const initializeData = async (): Promise<UserProfile> => {
  // Just return local data if it exists. 
  // We rely on "Login" explicitly to fetch from cloud to avoid overwriting.
  const localProfile = getProfile();
  return localProfile;
};

export const toggleMedicationTaken = (medId: string, context: string = 'Manual'): UserProfile => {
  const profile = getProfile();
  let newHistory = [...(profile.history || [])];

  const updatedMeds = profile.medications.map(med => {
    if (med.id === medId) {
      const isNowTaken = !med.takenToday;
      
      if (isNowTaken) {
        const logEntry: MedicationLog = {
          id: Date.now().toString(),
          medName: med.name,
          timestamp: new Date().toISOString(),
          formattedDate: new Date().toLocaleString('es-ES', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          status: 'taken',
          context: context
        };
        newHistory.unshift(logEntry);
      }

      return { ...med, takenToday: isNowTaken };
    }
    return med;
  });

  const newProfile = { ...profile, medications: updatedMeds, history: newHistory };
  saveProfile(newProfile);
  return newProfile;
};

export const resetDailyTracking = (): UserProfile => {
    const profile = getProfile();
    const updatedMeds = profile.medications.map(med => ({
        ...med,
        takenToday: false
    }));
    
    const newProfile = { ...profile, medications: updatedMeds };
    saveProfile(newProfile);
    return newProfile;
};