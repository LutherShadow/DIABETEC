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
  const uid = getUserId(); 
  
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
  // 1. Sync Cloud (Background) - We do this regardless of local storage success
  pushToSupabase(profile).catch(err => console.error("Cloud sync failed silently", err));

  // 2. Save Local (Instant)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e: any) {
    // Handle Quota Exceeded (usually due to base64 images)
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      console.warn("LocalStorage limit exceeded. Stripping images to save critical data.");
      
      // Create a shallow copy and strip heavy fields (images in mealPlan)
      const lightProfile = { ...profile };
      if (lightProfile.mealPlan && lightProfile.mealPlan.length > 0) {
        lightProfile.mealPlan = lightProfile.mealPlan.map(meal => ({
          ...meal,
          imageUrl: undefined // Remove base64 string
        }));
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lightProfile));
        console.log("Profile saved locally without images.");
      } catch (retryError) {
        console.error('Error saving light profile', retryError);
      }
    } else {
      console.error('Error saving profile locally', e);
    }
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
        saveProfile(cloudProfile); 
        
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Error de conexión.' };
    }
};

// --- Logout Logic ---
export const logoutUser = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_ID_KEY);
};

// --- Initialization Logic ---
export const initializeData = async (): Promise<UserProfile> => {
  // 1. Get Local Data (Fast)
  const localProfile = getProfile();
  
  // 2. Check if user is logged in (has ID) and try to fetch latest from Cloud
  // This is critical if local storage had to strip images due to Quota limits.
  const uid = localStorage.getItem(USER_ID_KEY);
  
  if (uid && uid.includes('@')) { // Basic check for valid ID
      try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();
            
          if (data && !error) {
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
                
                // If cloud has a meal plan with images and local doesn't, cloud wins
                if (localProfile.mealPlan && cloudProfile.mealPlan && cloudProfile.mealPlan.length > 0) {
                     // Simple merge: prefer Cloud
                     return cloudProfile;
                }
                
                // Update local storage with fresh cloud data
                saveProfile(cloudProfile);
                return cloudProfile;
          }
      } catch (err) {
          console.warn("Could not hydrate from cloud on init, using local.", err);
      }
  }

  return localProfile;
};

// Helper to determine target doses
const getTargetDoses = (med: Medication): number => {
    if (med.scheduleType === 'fixed' && med.fixedTimes) {
        return med.fixedTimes.length || 1;
    }
    if (med.scheduleType === 'meal_relative' && med.mealTriggers) {
        return med.mealTriggers.length || 1;
    }
    return 1; // Default
};

// Helper to count today's doses
const getTodayDoseCount = (history: MedicationLog[], medId: string): number => {
    const todayStr = new Date().toDateString();
    return history.filter(h => 
        h.medName === medId || 
        (h.medName === getProfile().medications.find(m => m.id === medId)?.name && new Date(h.timestamp).toDateString() === todayStr)
    ).length;
};

export const recordMedicationDose = (medId: string, context: string = 'Manual'): UserProfile => {
  const profile = getProfile();
  let newHistory = [...(profile.history || [])];
  
  const medIndex = profile.medications.findIndex(m => m.id === medId);
  if (medIndex === -1) return profile;

  const med = profile.medications[medIndex];
  
  // 1. Add Log Entry
  const logEntry: MedicationLog = {
      id: Date.now().toString(),
      medName: med.name, 
      timestamp: new Date().toISOString(),
      formattedDate: new Date().toLocaleString('es-ES', { 
        weekday: 'short', hour: '2-digit', minute: '2-digit' 
      }),
      status: 'taken',
      context: context
  };
  newHistory.unshift(logEntry);

  // 2. Check if daily goal is met
  const todayStr = new Date().toDateString();
  const takenCount = newHistory.filter(h => 
      h.medName === med.name && 
      new Date(h.timestamp).toDateString() === todayStr
  ).length;

  const target = getTargetDoses(med);
  const isFullyCompleted = takenCount >= target;

  const updatedMeds = [...profile.medications];
  updatedMeds[medIndex] = { ...med, takenToday: isFullyCompleted };

  const newProfile = { ...profile, medications: updatedMeds, history: newHistory };
  saveProfile(newProfile);
  return newProfile;
};

export const removeLastMedicationDose = (medId: string): UserProfile => {
    const profile = getProfile();
    const medIndex = profile.medications.findIndex(m => m.id === medId);
    if (medIndex === -1) return profile;
    const med = profile.medications[medIndex];

    const todayStr = new Date().toDateString();
    const history = [...(profile.history || [])];
    
    // Find the index of the most recent log for this med today
    const logIndexToRemove = history.findIndex(h => 
        h.medName === med.name && 
        new Date(h.timestamp).toDateString() === todayStr
    );

    if (logIndexToRemove !== -1) {
        history.splice(logIndexToRemove, 1);
    }

    // Re-evaluate completion status
    const takenCount = history.filter(h => 
        h.medName === med.name && 
        new Date(h.timestamp).toDateString() === todayStr
    ).length;
    
    const target = getTargetDoses(med);
    
    const updatedMeds = [...profile.medications];
    updatedMeds[medIndex] = { ...med, takenToday: takenCount >= target };

    const newProfile = { ...profile, medications: updatedMeds, history: history };
    saveProfile(newProfile);
    return newProfile;
};

export const deleteMedication = (medId: string): UserProfile => {
    const profile = getProfile();
    const updatedMeds = profile.medications.filter(m => m.id !== medId);
    const newProfile = { ...profile, medications: updatedMeds };
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