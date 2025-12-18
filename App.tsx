
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
  const [hasKey, setHasKey] = useState<boolean>(true);

  useEffect(() => {
    const init = async () => {
        // Verificar si se requiere selección de llave para modelos avanzados de imagen
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const keySelected = await window.aistudio.hasSelectedApiKey();
            setHasKey(keySelected);
        }

        const loadedProfile = await initializeData();
        setProfile(loadedProfile);
        if (loadedProfile.onboardingComplete) setView('dashboard');
        setLoading(false);
    };
    init();
  }, []);

  const handleSelectKey = async () => {
      if (window.aistudio && window.aistudio.openSelectKey) {
          await window.aistudio.openSelectKey();
          setHasKey(true);
      }
  };

  // --- GLOBAL ALERT SYSTEM ---
  useEffect(() => {
    if (!profile || !profile.onboardingComplete) return;

    const checkMedications = () => {
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        const todayStr = now.toDateString();
        
        profile.medications.forEach(med => {
            if (med.scheduleType === 'fixed' && med.fixedTimes && !med.takenToday) {
                med.fixedTimes.forEach(timeStr => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const scheduledTotalMinutes = h * 60 + m;
                    const diff = currentTotalMinutes - scheduledTotalMinutes;

                    if (diff >= -11 && diff <= -9) {
                        const preKey = `pre-${med.id}-${timeStr}-${todayStr}`;
                        if (!sentNotifications.current.has(preKey)) {
                            triggerAlert(`Preparación: ${med.name}`, `En 10 minutos debes tomar tu dosis (${med.dosage}).`, 'info');
                            sentNotifications.current.add(preKey);
                        }
                    }

                    if (diff >= 0 && diff <= 2) {
                        const notifKey = `${med.id}-${timeStr}-${todayStr}`;
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
            new Notification(title, { body, icon: '/favicon.ico' });
        }
        setToast({ message: `${title}: ${body}`, type });
        setTimeout(() => setToast(null), 10000);
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-teal-600 font-bold italic">Iniciando VidaSalud AI...</div>;

  // Pantalla de selección de llave si es requerida
  if (!hasKey) {
      return (
          <div className="min-h-screen bg-teal-900 flex items-center justify-center p-6 text-center">
              <div className="max-w-md bg-white p-8 rounded-2xl shadow-2xl">
                  <div className="text-5xl mb-4">🔑</div>
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">Configuración Necesaria</h1>
                  <p className="text-gray-600 mb-6 text-sm">Para generar imágenes y planes de salud avanzados, debes seleccionar tu propia clave de API.</p>
                  <button onClick={handleSelectKey} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition shadow-lg">Seleccionar API Key</button>
                  <p className="mt-4 text-xs text-gray-400">Consulta la <a href="https://ai.google.dev/gemini-api/docs/billing" className="underline" target="_blank">documentación de facturación</a> si tienes dudas.</p>
              </div>
          </div>
      );
  }

  if (view === 'login') return <Login onSuccess={() => { setProfile(getProfile()); setView('dashboard'); }} onBack={() => setView('onboarding')} />;
  if (!profile || !profile.onboardingComplete) return <Onboarding onComplete={() => { setProfile(getProfile()); setView('dashboard'); }} onLoginClick={() => setView('login')} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
      {toast && (
          <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl shadow-2xl flex items-start gap-3 animate-slide-in max-w-sm border ${toast.type === 'alert' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-teal-700 border-teal-500 text-white'}`}>
              <div className="text-2xl">{toast.type === 'alert' ? '🚨' : '⏰'}</div>
              <div className="flex-1 text-sm font-medium">{toast.message}</div>
              <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">✕</button>
          </div>
      )}

      <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0 shadow-sm">
        <div className="p-6 border-b font-bold text-teal-700 text-2xl tracking-tight">🩺 VidaSalud AI</div>
        <nav className="flex-1 p-4 space-y-2">
          <NavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" label="Inicio" />
          <NavBtn active={view === 'medications'} onClick={() => setView('medications')} icon="💊" label="Medicinas" />
          <NavBtn active={view === 'meals'} onClick={() => setView('meals')} icon="🥗" label="Dieta" />
          <NavBtn active={view === 'exercise'} onClick={() => setView('exercise')} icon="🏃‍♂️" label="Ejercicio" />
        </nav>
        <button onClick={handleLogout} className="m-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition">🚪 Cerrar Sesión</button>
      </aside>

      <main className="flex-1 max-w-5xl mx-auto w-full pb-24 md:pb-8 md:pt-8 px-4">
        {view === 'dashboard' && <Dashboard profile={profile} onChangeView={setView} />}
        {view === 'medications' && <MedicationManager profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'meals' && <MealPlanner profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'exercise' && <ExerciseCoach profile={profile} onUpdate={handleProfileUpdate} />}
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50 shadow-lg">
          <button onClick={() => setView('dashboard')} className={`p-2 rounded-lg ${view==='dashboard'?'bg-teal-50 text-teal-600':'text-gray-400'}`}>🏠</button>
          <button onClick={() => setView('medications')} className={`p-2 rounded-lg ${view==='medications'?'bg-teal-50 text-teal-600':'text-gray-400'}`}>💊</button>
          <button onClick={() => setView('meals')} className={`p-2 rounded-lg ${view==='meals'?'bg-teal-50 text-teal-600':'text-gray-400'}`}>🥗</button>
          <button onClick={() => setView('exercise')} className={`p-2 rounded-lg ${view==='exercise'?'bg-teal-50 text-teal-600':'text-gray-400'}`}>🏃‍♂️</button>
      </div>
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex gap-3 px-4 py-3 rounded-xl transition ${active ? 'bg-teal-600 text-white font-bold shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
    <span>{icon}</span> {label}
  </button>
);

export default App;
