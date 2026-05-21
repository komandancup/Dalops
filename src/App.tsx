import React, { useState, useEffect } from 'react';
import { 
  INITIAL_EMPLOYEES, 
  INITIAL_ATTENDANCE, 
  INITIAL_TASKS, 
  INITIAL_JOBDESC 
} from './initialData';
import { Employee, Attendance, Task, JobDeskItem } from './types';
import AdminDashboard from './components/AdminDashboard';
import AndroidSimulator from './components/AndroidSimulator';
import { LayoutGrid, Smartphone, Columns, Info, Database } from 'lucide-react';
import { 
  db, 
  initAuth, 
  googleSignIn, 
  logout, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  getDocs, 
  deleteDoc 
} from 'firebase/firestore';
import { appendAttendanceToSheet, appendTaskToSheet } from './workspace';

export default function App() {
  // Shared States (persisted locally or in Firestore)
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [attendances, setAttendances] = useState<Attendance[]>(INITIAL_ATTENDANCE);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [jobDeskItems, setJobDeskItems] = useState<JobDeskItem[]>(INITIAL_JOBDESC);

  // Layout View Switcher: 'split' | 'desktop' | 'mobile'
  const [viewMode, setViewMode] = useState<'split' | 'desktop' | 'mobile'>('split');
  const [showGuide, setShowGuide] = useState<boolean>(true);

  // Google Integrated Auth Status
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isLoadingSync, setIsLoadingSync] = useState(false);

  // Authenticate state on load
  useEffect(() => {
    const unsubAuth = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubAuth();
  }, []);

  // Sync with Firestore when logged in
  useEffect(() => {
    if (!googleUser) {
      // Fallback: load state from local initialData if offline/signed out
      setEmployees(INITIAL_EMPLOYEES);
      setAttendances(INITIAL_ATTENDANCE);
      setTasks(INITIAL_TASKS);
      setJobDeskItems(INITIAL_JOBDESC);
      return;
    }

    setIsLoadingSync(true);

    const seedDatabaseIfEmpty = async () => {
      try {
        const empSnap = await getDocs(collection(db, 'employees'));
        if (empSnap.empty) {
          console.log('Seeding initial employees to Cloud Firestore...');
          for (const e of INITIAL_EMPLOYEES) {
            await setDoc(doc(db, 'employees', e.id), e);
          }
          for (const a of INITIAL_ATTENDANCE) {
            await setDoc(doc(db, 'attendances', a.id), a);
          }
          for (const t of INITIAL_TASKS) {
            await setDoc(doc(db, 'tasks', t.id), t);
          }
          for (const j of INITIAL_JOBDESC) {
            await setDoc(doc(db, 'jobDeskItems', j.id), j);
          }
          console.log('Seeding completed successfully!');
        }
      } catch (err) {
        console.error('Error seeding database:', err);
      }
    };

    seedDatabaseIfEmpty().then(() => {
      // Real-time listener for employees
      const unsubEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
        const list: Employee[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data() } as Employee);
        });
        if (list.length > 0) {
          setEmployees(list);
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'employees'));

      // Real-time listener for attendances
      const unsubAtt = onSnapshot(collection(db, 'attendances'), (snapshot) => {
        const list: Attendance[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data() } as Attendance);
        });
        list.sort((a, b) => b.date.localeCompare(a.date) || (b.checkInTime || '').localeCompare(a.checkInTime || ''));
        setAttendances(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendances'));

      // Real-time listener for tasks
      const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
        const list: Task[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data() } as Task);
        });
        list.sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp));
        setTasks(list);
        setIsLoadingSync(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

      // Real-time listener for SOP guidelines
      const unsubJobDesk = onSnapshot(collection(db, 'jobDeskItems'), (snapshot) => {
        const list: JobDeskItem[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data() } as JobDeskItem);
        });
        setJobDeskItems(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'jobDeskItems'));

      return () => {
        unsubEmp();
        unsubAtt();
        unsubTasks();
        unsubJobDesk();
      };
    }).catch(err => {
      console.error('Failed to register subscription:', err);
      setIsLoadingSync(false);
    });
  }, [googleUser]);

  // Handle Google Auth
  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err: any) {
      alert("Gagal masuk dengan Google: " + err.message);
    }
  };

  const handleGoogleLogout = async () => {
    if (window.confirm("Keluar dari sinkronisasi Google Cloud?")) {
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
    }
  };

  // State Management Event Handlers
  const handleAddEmployee = async (emp: Employee) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'employees', emp.id), emp);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `employees/${emp.id}`);
      }
    } else {
      setEmployees(prev => [...prev, emp]);
    }
  };

  const handleUpdateEmployee = async (emp: Employee) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'employees', emp.id), emp);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${emp.id}`);
      }
    } else {
      setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (googleUser) {
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
      }
    } else {
      setEmployees(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleAddAttendance = async (att: Attendance) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'attendances', att.id), att);
        
        // Auto Sync to Google Sheet if linked
        const syncSheetId = localStorage.getItem('siops_sync_sheet_id');
        if (syncSheetId && googleToken) {
          appendAttendanceToSheet(googleToken, syncSheetId, att);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `attendances/${att.id}`);
      }
    } else {
      setAttendances(prev => [att, ...prev]);
    }
  };

  const handleUpdateAttendance = async (att: Attendance) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'attendances', att.id), att);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `attendances/${att.id}`);
      }
    } else {
      setAttendances(prev => prev.map(a => a.id === att.id ? att : a));
    }
  };

  const handleAddTask = async (task: Task) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'tasks', task.id), task);

        // Auto Sync to Google Sheet if linked
        const syncSheetId = localStorage.getItem('siops_sync_sheet_id');
        if (syncSheetId && googleToken) {
          appendTaskToSheet(googleToken, syncSheetId, task);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks/${task.id}`);
      }
    } else {
      setTasks(prev => [task, ...prev]);
    }
  };

  const handleUpdateTask = async (task: Task) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'tasks', task.id), task);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
      }
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  };

  const handleAddJobDeskItem = async (item: JobDeskItem) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'jobDeskItems', item.id), item);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `jobDeskItems/${item.id}`);
      }
    } else {
      setJobDeskItems(prev => [...prev, item]);
    }
  };

  const handleUpdateJobDeskItem = async (item: JobDeskItem) => {
    if (googleUser) {
      try {
        await setDoc(doc(db, 'jobDeskItems', item.id), item);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `jobDeskItems/${item.id}`);
      }
    } else {
      setJobDeskItems(prev => prev.map(j => j.id === item.id ? item : j));
    }
  };

  return (
    <div className="min-h-screen bg-[#07080b] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* GLOBAL WORKSPACE HEADER NAV */}
      <header className="bg-slate-950/90 backdrop-blur-md border-b border-zinc-900/80 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-black text-white text-xs tracking-tight shadow-md shadow-indigo-500/20">
            SiOps
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white font-display">SiOps Work Sandbox</h1>
              <span className="bg-indigo-500/10 text-indigo-400 text-[9px] px-2.5 py-0.5 rounded-md font-bold border border-indigo-500/20 tracking-wide uppercase">
                BPJS Ketenagakerjaan
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Sistem Absensi GPS Selfie & Manajemen Tenaga Outsource dengan Cloud Firestore, Sheets & Drive</p>
          </div>
        </div>

        {/* CLOUD CONNECTIVITY BAR & VIEWMODE CONTROL */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Cloud Sync Status Indicator */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-zinc-900/40 border border-zinc-850 rounded-xl">
            {googleUser ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] tracking-wider uppercase font-black text-emerald-400">FIRESTORE SYNC ACTIVE</span>
                </div>
                <div className="h-4 w-[1px] bg-zinc-800"></div>
                <div className="flex items-center gap-2">
                  <img src={googleUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"} alt="User profile" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                  <span className="text-[9px] font-bold text-slate-300 hidden sm:inline truncate max-w-[120px]">{googleUser.email}</span>
                </div>
                <button 
                  onClick={handleGoogleLogout} 
                  className="text-[9px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-400 cursor-pointer"
                >
                  Keluar
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  <span className="text-[9px] tracking-wider uppercase font-black text-amber-550">OFFLINE DEMO MODE</span>
                </div>
                <div className="h-4 w-[1px] bg-zinc-800"></div>
                <button
                  onClick={handleGoogleSignIn}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-950 rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-3 h-3">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>Mulai Google Sync</span>
                </button>
              </>
            )}
          </div>

          {/* WORKSPACE VIEW MODE SWITCHER */}
          <div className="flex items-center bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all duration-300 ${
                viewMode === 'split' 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/40 border border-indigo-505/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span className="hidden sm:inline">Layar Ganda</span>
            </button>
            <button 
              onClick={() => setViewMode('desktop')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all duration-300 ${
                viewMode === 'desktop' 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/40 border border-indigo-505/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden sm:inline font-bold">Backoffice Admin</span>
            </button>
            <button 
              onClick={() => setViewMode('mobile')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all duration-300 ${
                viewMode === 'mobile' 
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/40 border border-indigo-505/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              <span className="hidden sm:inline font-bold">HP Android Outsource</span>
            </button>
          </div>
        </div>
      </header>

      {/* QUICK SIMULATION USER GUIDE */}
      {showGuide && (
        <div className="bg-indigo-950/40 border-b border-indigo-500/10 px-6 py-2.5 text-[11px] text-indigo-200 flex items-start justify-between gap-4 select-text">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-semibold">
              {!googleUser ? (
                <span>⚡ <strong className="text-white">Database Lokal & Cloud:</strong> Untuk mensimulasikan database, klik <strong className="text-white">"Mulai Google Sync"</strong> di atas. Ini akan menguji sign-in Google Workspace, memicu Cloud Firestore Database yang tersinkronisasi di HP Android & Dashboard Admin secara instan, serta membuka fungsi ekspor Google Drive & Sheets!</span>
              ) : (
                <span>🎉 <strong className="text-white">Cloud Sync Aktif:</strong> Semua data saat ini tersimpan di Google Cloud Firestore secara real-time. Anda juga dapat membuat laporan, menyematkan auto-sync Google Sheets, serta mengirim cadangan foto ke Google Drive melalui Backoffice Admin sebelah kanan!</span>
              )}
            </p>
          </div>
          <button 
            onClick={() => setShowGuide(false)}
            className="text-indigo-400 hover:text-white font-bold ml-2 shrink-0 transition-colors cursor-pointer"
          >
            Sembunyikan
          </button>
        </div>
      )}

      {/* VIEWPORT CONTROLLER CONTAINER */}
      <div className="flex-1 overflow-hidden relative flex">
        {isLoadingSync && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
            <Database className="w-8 h-8 text-indigo-400 animate-bounce" />
            <p className="text-xs font-bold text-slate-300 tracking-wider uppercase font-mono">Sinkronisasi Cloud Firestore...</p>
          </div>
        )}

        {viewMode === 'split' && (
          <div className="flex-1 flex flex-col xl:flex-row overflow-hidden bg-[#07080b]">
            {/* Left Box: Android Simulator frame centering */}
            <div className="xl:w-[480px] bg-slate-950/40 border-r border-[#1a1c23] p-6 flex items-center justify-center overflow-y-auto shrink-0 select-none">
              <div className="scale-[0.92] origin-center py-4">
                <AndroidSimulator 
                  employees={employees}
                  attendances={attendances}
                  tasks={tasks}
                  jobDeskItems={jobDeskItems}
                  onAddAttendance={handleAddAttendance}
                  onUpdateAttendance={handleUpdateAttendance}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  googleUser={googleUser}
                  googleToken={googleToken}
                />
              </div>
            </div>

            {/* Right Box: Large Backoffice Dashboard */}
            <div className="flex-1 overflow-y-auto bg-[#07080b] border-t border-zinc-900 xl:border-t-0">
              <AdminDashboard 
                employees={employees}
                attendances={attendances}
                tasks={tasks}
                jobDeskItems={jobDeskItems}
                onAddEmployee={handleAddEmployee}
                onUpdateEmployee={handleUpdateEmployee}
                onDeleteEmployee={handleDeleteEmployee}
                onAddAttendance={handleAddAttendance}
                onUpdateAttendance={handleUpdateAttendance}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onAddJobDeskItem={handleAddJobDeskItem}
                onUpdateJobDeskItem={handleUpdateJobDeskItem}
                googleUser={googleUser}
                googleToken={googleToken}
              />
            </div>
          </div>
        )}

        {viewMode === 'desktop' && (
          <div className="flex-1 overflow-y-auto bg-[#07080b]">
            <AdminDashboard 
              employees={employees}
              attendances={attendances}
              tasks={tasks}
              jobDeskItems={jobDeskItems}
              onAddEmployee={handleAddEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onAddAttendance={handleAddAttendance}
              onUpdateAttendance={handleUpdateAttendance}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onAddJobDeskItem={handleAddJobDeskItem}
              onUpdateJobDeskItem={handleUpdateJobDeskItem}
              googleUser={googleUser}
              googleToken={googleToken}
            />
          </div>
        )}

        {viewMode === 'mobile' && (
          <div className="flex-1 bg-slate-950 flex items-center justify-center p-6 overflow-y-auto select-none">
            <AndroidSimulator 
              employees={employees}
              attendances={attendances}
              tasks={tasks}
              jobDeskItems={jobDeskItems}
              onAddAttendance={handleAddAttendance}
              onUpdateAttendance={handleUpdateAttendance}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              googleUser={googleUser}
              googleToken={googleToken}
            />
          </div>
        )}
      </div>

    </div>
  );
}
