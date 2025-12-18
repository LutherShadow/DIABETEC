
export type ScheduleType = 'fixed' | 'meal_relative';
export type MealTime = 'breakfast' | 'lunch' | 'dinner';
export type MealTiming = 'before' | 'after';

export interface MealTrigger {
  meal: MealTime;
  timing: MealTiming;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string; 
  instructions: string; 
  takenToday: boolean;
  requiresFood?: boolean;
  scheduleType: ScheduleType;
  fixedTimes?: string[]; 
  mealTriggers?: MealTrigger[]; 
}

export interface MedicationLog {
  id: string;
  medName: string;
  timestamp: string; 
  formattedDate: string; 
  context?: string; 
  status: 'taken' | 'skipped';
}

export interface Meal {
  name: string;
  description: string;
  ingredients: string[];
  calories: number;
  glycemicIndex: 'Low' | 'Medium' | 'High';
  suitableFor: string[]; 
  imageUrl?: string;
}

export interface ExerciseRoutine {
  title: string;
  durationMinutes: number;
  intensity: 'Low' | 'Medium' | 'High';
  description: string;
  medicalTip?: string; 
  exercises: { 
    name: string; 
    reps: string; 
    duration?: string;
    visualDescription?: string; 
    tips?: string; 
    imageUrl?: string; // Nuevo campo para persistencia de imagen
  }[];
  safetyNotes: string;
}

export interface UserProfile {
  id?: string; 
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; 
  weight: number; 
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  diagnoses: string[]; 
  allowedFoods: string[];
  forbiddenFoods: string[];
  allergies: string[];
  goals: string;
  medications: Medication[];
  history: MedicationLog[]; 
  onboardingComplete: boolean;
  mealPlan?: Meal[];
  exerciseRoutine?: ExerciseRoutine | null;
}

export type ViewState = 'login' | 'onboarding' | 'dashboard' | 'meals' | 'medications' | 'exercise';
