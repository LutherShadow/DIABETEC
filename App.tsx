
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ViewState } from './types';
import { getProfile, saveProfile, initializeData, logoutUser } from './services/storageService';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import MealPlanner from './components/MealPlanner';
import MedicationManager from './components/MedicationManager';
import ExerciseCoach from './components/ExerciseCoach';
import Login from './components/Login';

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<ViewState>('onboarding');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'info'|'alert'} | null>(null);
  const sentNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
        const loadedProfile = await initializeData();
        setProfile(loadedProfile);
        if (loadedProfile.onboardingComplete) setView('dashboard');
        setLoading(false);
    };
    init();
  }, []);

  // --- GLOBAL ALERT SYSTEM (Fixed Time Alerts) ---
  useEffect(() => {
    if (!profile || !profile.onboardingComplete) return;

    const checkMedications = () => {
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        
        profile.medications.forEach(med => {
            if (med.scheduleType === 'fixed' && med.fixedTimes && !med.takenToday) {
                med.fixedTimes.forEach(timeStr => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const scheduledTotalMinutes = h * 60 + m;
                    const diff = currentTotalMinutes - scheduledTotalMinutes;

                    // 1. PRE-REMINDER (10 minutes before)
                    if (diff >= -11 && diff <= -9) {
                        const preKey = `pre-${med.id}-${timeStr}-${now.getDate()}`;
                        if (!sentNotifications.current.has(preKey)) {
                            triggerAlert(`准备: ${med.name}`, `En 10 minutos debes tomar tu dosis (${med.dosage}).`, 'info');
                            sentNotifications.current.add(preKey);
                        }
                    }

                    // 2. ACTUAL REMINDER (On time)
                    if (diff >= 0 && diff <= 2) {
                        const notifKey = `${med.id}-${timeStr}-${now.getDate()}`;
                        if (!sentNotifications.current.has(notifKey)) {
                            triggerAlert(`🚨 Hora de: ${med.name}`, `Es momento de tomar tus ${med.dosage}.`, 'alert');
                            sentNotifications.current.add(notifKey);
                        }
                    }
                });
            }
        });
    };

    const triggerAlert = (title: string, body: string, type: 'info'|'alert') => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, requireInteraction: true });
        }
        setToast({ message: `${title}: ${body}`, type });
        setTimeout(() => setToast(null), 12000);
    };

    const interval = setInterval(checkMedications, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  const handleProfileUpdate = (newProfile: UserProfile) => {
    setProfile(newProfile);
    saveProfile(newProfile);
  };

  const handleLogout = () => {
      logoutUser();
      setProfile(null);
      setView('login');
      sentNotifications.current.clear();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (view === 'login') return <Login onSuccess={() => { setProfile(getProfile()); setView('dashboard'); }} onBack={() => setView('onboarding')} />;
  if (!profile || !profile.onboardingComplete) return <Onboarding onComplete={() => { setProfile(getProfile()); setView('dashboard'); }} onLoginClick={() => setView('login')} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
      {toast && (
          <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl shadow-2xl flex items-start gap-3 animate-slide-in max-w-sm ${toast.type === 'alert' ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>
              <div className="text-2xl">⏰</div>
              <div className="flex-1 text-sm font-medium">{toast.message}</div>
              <button onClick={() => setToast(null)} className="font-bold px-2">✕</button>
          </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0">
        <div className="p-6 border-b font-bold text-teal-700 text-2xl">🩺 VidaSalud</div>
        <nav className="flex-1 p-4 space-y-2">
          <NavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" label="Inicio" />
          <NavBtn active={view === 'medications'} onClick={() => setView('medications')} icon="💊" label="Medicinas" />
          <NavBtn active={view === 'meals'} onClick={() => setView('meals')} icon="🥗" label="Dieta" />
          <NavBtn active={view === 'exercise'} onClick={() => setView('exercise')} icon="🏃‍♂️" label="Ejercicio" />
        </nav>
        <button onClick={handleLogout} className="m-4 p-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold">🚪 Cerrar Sesión</button>
      </aside>

      <main className="flex-1 max-w-5xl mx-auto w-full pb-24 md:pb-0">
        {view === 'dashboard' && <Dashboard profile={profile} onChangeView={setView} />}
        {view === 'medications' && <MedicationManager profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'meals' && <MealPlanner profile={profile} />}
        {view === 'exercise' && <ExerciseCoach profile={profile} />}
      </main>

      {/* Bottom Nav Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50">
          <button onClick={() => setView('dashboard')} className={`p-2 ${view==='dashboard'?'text-teal-600':'text-gray-400'}`}>🏠</button>
          <button onClick={() => setView('medications')} className={`p-2 ${view==='medications'?'text-teal-600':'text-gray-400'}`}>💊</button>
          <button onClick={() => setView('meals')} className={`p-2 ${view==='meals'?'text-teal-600':'text-gray-400'}`}>🥗</button>
          <button onClick={() => setView('exercise')} className={`p-2 ${view==='exercise'?'text-teal-600':'text-gray-400'}`}>🏃‍♂️</button>
      </div>
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex gap-3 px-4 py-3 rounded-lg ${active ? 'bg-teal-50 text-teal-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
    <span>{icon}</span> {label}
  </button>
);

export default App;
