import { UserProfile, Medication, MedicationLog } from '../types';

const STORAGE_KEY = 'vidasalud_profile_v1';

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
  history: [], // Initialize empty history
  onboardingComplete: false,
};

export const getProfile = (): UserProfile => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PROFILE;
    
    const parsed = JSON.parse(stored);
    // Migration helper: ensure history exists if loading old profile
    if (!parsed.history) parsed.history = [];
    return parsed;
  } catch (e) {
    console.error('Error reading profile', e);
    return DEFAULT_PROFILE;
  }
};

export const saveProfile = (profile: UserProfile): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile', e);
  }
};

export const toggleMedicationTaken = (medId: string, context: string = 'Manual'): UserProfile => {
  const profile = getProfile();
  let newHistory = [...(profile.history || [])];

  const updatedMeds = profile.medications.map(med => {
    if (med.id === medId) {
      const isNowTaken = !med.takenToday;
      
      // If marking as taken, add to history
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
        // Add to beginning of array
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