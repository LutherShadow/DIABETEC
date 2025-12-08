
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
  frequency: string; // Text description e.g. "Cada 12 horas"
  instructions: string; 
  takenToday: boolean;
  requiresFood?: boolean;
  
  // New Scheduling Fields
  scheduleType: ScheduleType;
  fixedTimes?: string[]; // Array of "HH:MM" for fixed schedules
  mealTriggers?: MealTrigger[]; // For meal-relative schedules
}

export interface MedicationLog {
  id: string;
  medName: string;
  timestamp: string; // ISO Date string
  formattedDate: string; // Displayable string
  context?: string; // e.g. "Scheduled: 08:00" or "Before Lunch"
  status: 'taken' | 'skipped';
}

export interface Meal {
  name: string;
  description: string;
  ingredients: string[];
  calories: number;
  glycemicIndex: 'Low' | 'Medium' | 'High';
  suitableFor: string[]; // e.g., "Breakfast", "Lunch"
  imageUrl?: string;
}

export interface ExerciseRoutine {
  title: string;
  durationMinutes: number;
  intensity: 'Low' | 'Medium' | 'High';
  description: string;
  medicalTip?: string; // New: Specific medical advice (e.g., walking for diabetes)
  exercises: { 
    name: string; 
    reps: string; 
    duration?: string;
    visualDescription?: string; // New: For generating placeholder images/gifs
    tips?: string; // New: Technique tips
  }[];
  safetyNotes: string;
}

export interface UserProfile {
  id?: string; // Add ID field to track email/user-id
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // cm
  weight: number; // kg
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  diagnoses: string[]; // e.g., "Diabetes Type 2"
  allowedFoods: string[];
  forbiddenFoods: string[];
  allergies: string[];
  goals: string;
  medications: Medication[];
  history: MedicationLog[]; 
  onboardingComplete: boolean;
  
  // Persisted Generated Content
  mealPlan?: Meal[];
  exerciseRoutine?: ExerciseRoutine | null;
}

export type ViewState = 'login' | 'onboarding' | 'dashboard' | 'meals' | 'medications' | 'exercise';
