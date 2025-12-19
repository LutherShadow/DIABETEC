
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

export interface Exercise {
  id: string;
  name: string; 
  reps: string; 
  sets?: number;
  repsPerSet?: string;
  duration?: string;
  visualDescription?: string; 
  tips?: string; 
  benefits?: string;
  medicalReasoning?: string; // Por qué este ejercicio es bueno para TU diagnóstico
  medicalCaution?: string;
  imageUrl?: string;
  completed?: boolean;
  scheduledDay?: number; // 0-6
  isAdapted?: boolean; // Indica si la IA lo modificó para el usuario
}

export interface ExerciseRoutine {
  title: string;
  durationMinutes: number;
  intensity: 'Low' | 'Medium' | 'High';
  description: string;
  medicalTip?: string; 
  exercises: Exercise[];
  safetyNotes: string;
  originalMethod?: string; // Ej: "One Punch Man", "Darebee Main Character"
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
