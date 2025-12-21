
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ViewState } from './types';
import { getProfile, saveProfile, initializeData, logoutUser } from './services/storageService';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import MealPlanner from './components/MealPlanner';
import MedicationManager from './components/MedicationManager';
import ExerciseCoach from './components/ExerciseCoach';
import ProfileEditor from './components/ProfileEditor';
import Login from './components/Login';

// Usamos el logo directamente como un componente SVG que replica exactamente el estilo pixelado
const Logo = ({ className = "w-48" }: { className?: string }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative w-12 h-12 flex-shrink-0">
      {/* Representación pixelada del estetoscopio tech */}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-0.5">
        {[...Array(16)].map((_, i) => (
          <div key={i} className={`${[0,3,4,7,8,11,13,14].includes(i) ? 'bg-cyan-400' : [9,10,5,6].includes(i) ? 'bg-purple-600' : 'bg-transparent'} rounded-sm opacity-80`}></div>
        ))}
      </div>
      <div className="absolute inset-2 bg-white/20 blur-sm rounded-full animate-pulse"></div>
    </div>
    <div className="flex flex-col leading-none">
      <span className="text-2xl font-black tracking-tighter text-slate-800 uppercase">Vida<span className="text-cyan-500">Salud</span></span>
      <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 ml-1">ARTIFICIAL INTELLIGENCE</span>
    </div>
  </div>
);

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

  useEffect(() => {
    if (!profile || !profile.onboardingComplete) return;

    const checkMedications = () => {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const todayStr = now.toDateString();
        
        profile.medications.forEach(med => {
            if (med.scheduleType === 'fixed' && med.fixedTimes && !med.takenToday) {
                med.fixedTimes.forEach(timeStr => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const scheduledMins = h * 60 + m;
                    const diff = scheduledMins - currentMins;

                    if (diff === 10) {
                        const alertKey = `10min-${med.id}-${timeStr}-${todayStr}`;
                        if (!sentNotifications.current.has(alertKey)) {
                            triggerSystemNotification(
                                `Preparación: ${med.name}`,
                                `Dosis de ${med.dosage} en 10 minutos.`,
                                'info',
                                alertKey
                            );
                        }
                    }

                    if (diff <= 0 && diff >= -2) {
                        const alertKey = `now-${med.id}-${timeStr}-${todayStr}`;
                        if (!sentNotifications.current.has(alertKey)) {
                            triggerSystemNotification(
                                `🚨 HORA DE TOMAR: ${med.name}`,
                                `Es momento de tu dosis (${med.dosage}). No la ignores.`,
                                'alert',
                                alertKey
                            );
                        }
                    }
                });
            }
        });
    };

    const triggerSystemNotification = (title: string, body: string, type: 'info'|'alert', key: string) => {
        sentNotifications.current.add(key);
        setToast({ message: `${title}: ${body}`, type });
        setTimeout(() => setToast(null), 15000);
    };

    const interval = setInterval(checkMedications, 45000); 
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

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Logo className="w-64 mb-8 animate-pulse" />
      <div className="text-teal-600 font-black italic uppercase tracking-widest animate-pulse">Iniciando VidaSalud AI...</div>
    </div>
  );

  if (!hasKey) {
      return (
          <div className="min-h-screen bg-[#0f2e2a] flex items-center justify-center p-6 text-center">
              <div className="max-w-md bg-white p-12 rounded-[3rem] shadow-2xl">
                  <Logo className="mx-auto mb-8 w-56" />
                  <h1 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Configuración Requerida</h1>
                  <p className="text-gray-600 mb-8 text-sm font-medium">Para acceder a las funciones de IA personalizada, selecciona tu API Key de Google AI Studio.</p>
                  <button onClick={handleSelectKey} className="w-full bg-teal-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-teal-700 transition shadow-xl active:scale-95">Seleccionar Clave</button>
              </div>
          </div>
      );
  }

  if (view === 'login') return <Login onSuccess={() => { setProfile(getProfile()); setView('dashboard'); }} onBack={() => setView('onboarding')} />;
  if (!profile || !profile.onboardingComplete) return <Onboarding onComplete={() => { setProfile(getProfile()); setView('dashboard'); }} onLoginClick={() => setView('login')} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row relative">
      {toast && (
          <div className={`fixed top-6 right-6 z-[200] p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-slide-in max-w-sm border-2 ${toast.type === 'alert' ? 'bg-orange-600 border-orange-400 text-white' : 'bg-teal-700 border-teal-500 text-white'}`}>
              <div className="text-3xl">{toast.type === 'alert' ? '🚨' : '⏰'}</div>
              <div className="flex-1 text-xs font-black uppercase tracking-widest leading-tight">{toast.message}</div>
              <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100 text-xl font-bold">✕</button>
          </div>
      )}

      <aside className="hidden md:flex flex-col w-72 bg-white border-r h-screen sticky top-0 shadow-sm overflow-y-auto no-scrollbar">
        <div className="p-8 border-b">
            <Logo className="w-full" />
        </div>
        <nav className="flex-1 p-6 space-y-3">
          <NavBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" label="Inicio" />
          <NavBtn active={view === 'medications'} onClick={() => setView('medications')} icon="💊" label="Medicinas" />
          <NavBtn active={view === 'meals'} onClick={() => setView('meals')} icon="🥗" label="Nutrición" />
          <NavBtn active={view === 'exercise'} onClick={() => setView('exercise')} icon="🏃‍♂️" label="Actividad" />
          <NavBtn active={view === 'profile'} onClick={() => setView('profile')} icon="👤" label="Mi Perfil" />
        </nav>
        <div className="p-6">
            <button onClick={handleLogout} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition border border-red-100 active:scale-95">Cerrar Sesión</button>
        </div>
      </aside>

      <main className="flex-1 max-w-5xl mx-auto w-full pb-28 md:pb-12 md:pt-12 px-4 animate-fade-in">
        <div className="md:hidden flex justify-center py-4">
            <Logo className="h-10" />
        </div>
        {view === 'dashboard' && <Dashboard profile={profile} onChangeView={setView} onUpdate={handleProfileUpdate} />}
        {view === 'medications' && <MedicationManager profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'meals' && <MealPlanner profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'exercise' && <ExerciseCoach profile={profile} onUpdate={handleProfileUpdate} />}
        {view === 'profile' && <ProfileEditor profile={profile} onUpdate={handleProfileUpdate} />}
      </main>

      <div className="md:hidden fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-[2.5rem] flex justify-around p-4 z-50 shadow-2xl">
          <button onClick={() => setView('dashboard')} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${view==='dashboard'?'bg-teal-600 text-white shadow-lg scale-110':'text-gray-400'}`}>🏠</button>
          <button onClick={() => setView('medications')} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${view==='medications'?'bg-teal-600 text-white shadow-lg scale-110':'text-gray-400'}`}>💊</button>
          <button onClick={() => setView('meals')} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${view==='meals'?'bg-teal-600 text-white shadow-lg scale-110':'text-gray-400'}`}>🥗</button>
          <button onClick={() => setView('exercise')} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${view==='exercise'?'bg-teal-600 text-white shadow-lg scale-110':'text-gray-400'}`}>🏃‍♂️</button>
          <button onClick={() => setView('profile')} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${view==='profile'?'bg-teal-600 text-white shadow-lg scale-110':'text-gray-400'}`}>👤</button>
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
