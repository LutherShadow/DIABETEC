import React, { useState, useEffect } from 'react';
import { UserProfile, ViewState } from './types';
import { getProfile, saveProfile } from './services/storageService';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import MealPlanner from './components/MealPlanner';
import MedicationManager from './components/MedicationManager';
import ExerciseCoach from './components/ExerciseCoach';

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ViewState>('onboarding');

  useEffect(() => {
    const loadedProfile = getProfile();
    setProfile(loadedProfile);
    if (loadedProfile.onboardingComplete) {
      setView('dashboard');
    }
  }, []);

  const handleProfileUpdate = (newProfile: UserProfile) => {
    setProfile(newProfile);
    saveProfile(newProfile); // Redundant if child components save, but safe
  };

  const handleOnboardingComplete = () => {
    const p = getProfile();
    setProfile(p);
    setView('dashboard');
  };

  if (!profile) return null; // Or loading spinner

  if (!profile.onboardingComplete) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <Onboarding onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  // Sidebar / Nav Layout
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Nav */}
      <div className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50">
        <span className="font-bold text-teal-700 text-xl">VidaSalud AI</span>
        <button onClick={() => setView('dashboard')} className="p-2 bg-gray-100 rounded">🏠</button>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0">
        <div className="p-6 border-b">
           <h1 className="text-2xl font-bold text-teal-700 flex items-center gap-2">
             <span>🩺</span> VidaSalud
           </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" label="Inicio" />
          <NavButton active={view === 'medications'} onClick={() => setView('medications')} icon="💊" label="Medicamentos" />
          <NavButton active={view === 'meals'} onClick={() => setView('meals')} icon="🥗" label="Alimentación" />
          <NavButton active={view === 'exercise'} onClick={() => setView('exercise')} icon="🏃‍♂️" label="Ejercicios" />
        </nav>
        <div className="p-4 border-t text-xs text-gray-400">
           Datos guardados localmente.
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full pb-20 md:pb-0">
        {view === 'dashboard' && <Dashboard profile={profile} onChangeView={setView} />}
        {view === 'medications' && <MedicationManager profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'meals' && <MealPlanner profile={profile} />}
        {view === 'exercise' && <ExerciseCoach profile={profile} />}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <MobileNavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" />
          <MobileNavBtn active={view === 'medications'} onClick={() => setView('medications')} icon="💊" />
          <MobileNavBtn active={view === 'meals'} onClick={() => setView('meals')} icon="🥗" />
          <MobileNavBtn active={view === 'exercise'} onClick={() => setView('exercise')} icon="🏃‍♂️" />
      </div>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    <span>{icon}</span> {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon }: any) => (
  <button 
    onClick={onClick}
    className={`p-2 rounded-xl text-xl ${active ? 'bg-teal-100 text-teal-700' : 'text-gray-400'}`}
  >
    {icon}
  </button>
);

export default App;