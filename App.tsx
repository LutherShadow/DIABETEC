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
  
  // Track notifications sent in this session to avoid spam
  const sentNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
        const loadedProfile = await initializeData();
        setProfile(loadedProfile);
        if (loadedProfile.onboardingComplete) {
            setView('dashboard');
        }
        setLoading(false);
    };
    init();
  }, []);

  // --- GLOBAL ALERT SYSTEM ---
  // Runs regardless of which view is active
  useEffect(() => {
    if (!profile || !profile.onboardingComplete) return;

    const checkMedications = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        // Helper: Convert HH:MM to minutes
        const getMinutes = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        profile.medications.forEach(med => {
            if (med.scheduleType === 'fixed' && med.fixedTimes && !med.takenToday) {
                med.fixedTimes.forEach(timeStr => {
                    const scheduledMinutes = getMinutes(timeStr);
                    const diff = currentMinutes - scheduledMinutes;
                    const notifKey = `${med.id}-${timeStr}-${now.getDate()}`; // Unique key per day

                    // Trigger window: Exact time or up to 2 minutes late (in case timer skips)
                    if (diff >= 0 && diff <= 2) {
                        if (!sentNotifications.current.has(notifKey)) {
                            const title = `💊 Hora de tu medicamento`;
                            const body = `Es hora de tomar: ${med.name} (${med.dosage})`;
                            
                            // Send Alert via Browser Notification
                            if ('Notification' in window && Notification.permission === 'granted') {
                                new Notification(title, {
                                    body: body,
                                    icon: '/pills.png',
                                    requireInteraction: true
                                });
                            } else {
                                // Fallback: In-App Toast
                                setToast({ message: `${title}: ${body}`, type: 'alert' });
                                // Auto hide toast after 10s
                                setTimeout(() => setToast(null), 10000);
                            }
                            sentNotifications.current.add(notifKey);
                        }
                    }
                });
            }
        });
    };

    // Check every 30 seconds
    const interval = setInterval(checkMedications, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  const handleProfileUpdate = (newProfile: UserProfile) => {
    setProfile(newProfile);
    saveProfile(newProfile);
  };

  const handleOnboardingComplete = () => {
    const p = getProfile(); 
    setProfile(p);
    setView('dashboard');
  };

  const handleLoginSuccess = () => {
      const p = getProfile();
      setProfile(p);
      setView('dashboard');
  };

  const handleLogout = () => {
      // Removed window.confirm to ensure the action is always triggered on click
      logoutUser();
      setProfile(null);
      setView('login');
      sentNotifications.current.clear();
  };

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                  <div className="text-4xl animate-bounce mb-4">🩺</div>
                  <h2 className="text-xl font-bold text-teal-700">VidaSalud AI</h2>
                  <p className="text-gray-500 text-sm mt-2">Cargando perfil...</p>
              </div>
          </div>
      );
  }

  // Route: Login
  if (view === 'login') {
      return <Login onSuccess={handleLoginSuccess} onBack={() => setView('onboarding')} />;
  }

  // Route: Onboarding (if no profile or incomplete)
  if (!profile || !profile.onboardingComplete) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <Onboarding 
            onComplete={handleOnboardingComplete} 
            onLoginClick={() => setView('login')}
        />
      </div>
    );
  }

  // Main Application Layout
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
      
      {/* Toast Notification */}
      {toast && (
          <div className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[100] p-4 rounded-xl shadow-2xl flex items-start gap-3 transition-all transform translate-y-0 animate-slide-in ${toast.type === 'alert' ? 'bg-orange-600 text-white' : 'bg-teal-600 text-white'}`}>
              <div className="text-2xl">{toast.type === 'alert' ? '⏰' : 'ℹ️'}</div>
              <div className="flex-1 text-sm font-medium pt-1">{toast.message}</div>
              <button onClick={() => setToast(null)} className="text-white/80 hover:text-white font-bold px-2">✕</button>
          </div>
      )}

      {/* Mobile Nav */}
      <div className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50">
        <span className="font-bold text-teal-700 text-xl">VidaSalud AI</span>
        <div className="flex gap-2">
            <button onClick={() => setView('dashboard')} className="p-2 bg-gray-100 rounded hover:bg-gray-200" title="Inicio">🏠</button>
            <button onClick={handleLogout} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Cerrar Sesión">🚪</button>
        </div>
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
        
        <div className="p-4 border-t space-y-4">
           <div>
                <div className="text-xs text-gray-500 mb-1">Usuario:</div>
                <div className="text-xs font-bold text-gray-700 truncate" title={profile.id}>{profile.id || 'Invitado'}</div>
                <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Sincronizado
                </div>
           </div>
           
           <button 
             onClick={handleLogout}
             className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium"
           >
             🚪 Cerrar Sesión
           </button>
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