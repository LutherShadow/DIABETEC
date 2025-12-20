
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

  // --- SISTEMA DE ALERTAS GLOBALES ---
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
                    const diff = scheduledTotalMinutes - currentTotalMinutes;

                    // Alerta de Preparación: Exactamente 10 minutos antes
                    if (diff === 10) {
                        const preKey = `pre-${med.id}-${timeStr}-${todayStr}`;
                        if (!sentNotifications.current.has(preKey)) {
                            triggerAlert(`Preparación: ${med.name}`, `En 10 minutos debes tomar tu dosis (${med.dosage}).`, 'info');
                            sentNotifications.current.add(preKey);
                        }
                    }

                    // Alerta Crítica: Hora exacta (ventana de 2 min para asegurar detección)
                    if (diff <= 0 && diff >= -2) {
                        const notifKey = `now-${med.id}-${timeStr}-${todayStr}`;
                        if (!sentNotifications.current.has(notifKey)) {
                            triggerAlert(`🚨 HORA DE: ${med.name}`, `Es momento de tomar tus ${med.dosage}.`, 'alert');
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-teal-600 font-black italic uppercase tracking-widest">Iniciando VidaSalud AI...</div>;

  if (!hasKey) {
      return (
          <div className="min-h-screen bg-teal-900 flex items-center justify-center p-6 text-center">
              <div className="max-w-md bg-white p-8 rounded-[3rem] shadow-2xl">
                  <div className="text-5xl mb-4">🔑</div>
                  <h1 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Configuración Requerida</h1>
                  <p className="text-gray-500 mb-6 text-sm font-medium">Para acceder a las funciones de IA personalizada, selecciona tu API Key de Google AI Studio.</p>
                  <button onClick={handleSelectKey} className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-teal-700 transition shadow-xl">Seleccionar Clave</button>
                  <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Requiere proyecto con facturación activa</p>
              </div>
          </div>
      );
  }

  if (view === 'login') return <Login onSuccess={() => { setProfile(getProfile()); setView('dashboard'); }} onBack={() => setView('onboarding')} />;
  if (!profile || !profile.onboardingComplete) return <Onboarding onComplete={() => { setProfile(getProfile()); setView('dashboard'); }} onLoginClick={() => setView('login')} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
      {toast && (
          <div className={`fixed top-6 right-6 z-[100] p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-slide-in max-w-sm border-2 ${toast.type === 'alert' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-teal-700 border-teal-500 text-white'}`}>
              <div className="text-3xl">{toast.type === 'alert' ? '🚨' : '⏰'}</div>
              <div className="flex-1 text-xs font-black uppercase tracking-widest">{toast.message}</div>
              <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100 text-xl font-bold">✕</button>
          </div>
      )}

      <aside className="hidden md:flex flex-col w-72 bg-white border-r h-screen sticky top-0 shadow-sm">
        <div className="p-8 border-b font-black text-teal-700 text-2xl uppercase tracking-tighter">🩺 VidaSalud AI</div>
        <nav className="flex-1 p-6 space-y-3">
          <NavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" label="Inicio" />
          <NavBtn active={view === 'medications'} onClick={() => setView('medications')} icon="💊" label="Medicinas" />
          <NavBtn active={view === 'meals'} onClick={() => setView('meals')} icon="🥗" label="Nutrición" />
          <NavBtn active={view === 'exercise'} onClick={() => setView('exercise')} icon="🏃‍♂️" label="Actividad" />
        </nav>
        <div className="p-6">
            <button onClick={handleLogout} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition border border-red-100">Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 max-w-5xl mx-auto w-full pb-28 md:pb-12 md:pt-12 px-4">
        {view === 'dashboard' && <Dashboard profile={profile} onChangeView={setView} onUpdate={handleProfileUpdate} />}
        {view === 'medications' && <MedicationManager profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'meals' && <MealPlanner profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'exercise' && <ExerciseCoach profile={profile} onUpdate={handleProfileUpdate} />}
      </main>

      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-white/80 backdrop-blur-xl border border-white/20 rounded-[2.5rem] flex justify-around p-4 z-50 shadow-2xl">
          <button onClick={() => setView('dashboard')} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${view==='dashboard'?'bg-teal-600 text-white shadow-lg':'text-gray-400'}`}>🏠</button>
          <button onClick={() => setView('medications')} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${view==='medications'?'bg-teal-600 text-white shadow-lg':'text-gray-400'}`}>💊</button>
          <button onClick={() => setView('meals')} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${view==='meals'?'bg-teal-600 text-white shadow-lg':'text-gray-400'}`}>🥗</button>
          <button onClick={() => setView('exercise')} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${view==='exercise'?'bg-teal-600 text-white shadow-lg':'text-gray-400'}`}>🏃‍♂️</button>
      </div>
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${active ? 'bg-teal-600 text-white font-black shadow-xl scale-105' : 'text-gray-500 hover:bg-gray-50 font-bold'}`}>
    <span className="text-xl">{icon}</span> 
    <span className="text-xs uppercase tracking-widest">{label}</span>
  </button>
);

export default App;
