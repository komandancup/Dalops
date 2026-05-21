/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, MapPin, CheckCircle, Clock, AlertTriangle, LogOut, 
  User, Shield, Clipboard, Wifi, Battery, Radio, 
  HelpCircle, Compass, Check, ArrowLeft, Send, Cloud
} from 'lucide-react';
import { Employee, Attendance, Task, JobDeskItem, EmployeeRole } from '../types';

interface AndroidSimulatorProps {
  employees: Employee[];
  attendances: Attendance[];
  tasks: Task[];
  jobDeskItems: JobDeskItem[];
  onAddAttendance: (attendance: Attendance) => void;
  onUpdateAttendance: (attendance: Attendance) => void;
  onAddTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  googleUser?: any;
  googleToken?: string | null;
}

export default function AndroidSimulator({
  employees,
  attendances,
  tasks,
  jobDeskItems,
  onAddAttendance,
  onUpdateAttendance,
  onAddTask,
  onUpdateTask,
  googleUser,
  googleToken
}: AndroidSimulatorProps) {
  // Simulator Navigation & Authentication
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [activeScreen, setActiveScreen] = useState<string>('home'); // home, checkin, task-report, my-tasks, jobdesk
  
  // App States
  const [selectedLocation, setSelectedLocation] = useState<string>('Kantor Cabang BPJS Ketenagakerjaan');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [selfiePhoto, setSelfiePhoto] = useState<string>('');
  const [gpsSimulated, setGpsSimulated] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successAnimation, setSuccessAnimation] = useState<string | null>(null);

  // Task Report form state
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [customTaskTitle, setCustomTaskTitle] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskProofPhoto, setTaskProofPhoto] = useState<string>('');
  
  // Real camera reference
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clock in/out status for current user
  const todayStr = '2026-05-21'; // matching system clock in metadata
  const userTodayAttendance = attendances.find(
    a => a.employeeId === currentUser?.id && a.date === todayStr
  );
  
  // Tasks for current user today
  const userTasksToday = tasks.filter(
    t => t.employeeId === currentUser?.id && t.date === todayStr
  );

  // Close camera on screen switch
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [activeScreen]);

  // Activate device camera (if allowed) or fallback
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable, using fallback', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = (type: 'attendance' | 'task') => {
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, 300, 300);
          const dataUrl = canvas.toDataURL('image/jpeg');
          if (type === 'attendance') {
            setSelfiePhoto(dataUrl);
          } else {
            setTaskProofPhoto(dataUrl);
          }
        }
        stopCamera();
      } catch (err) {
        useFallbackPhoto(type);
      }
    } else {
      useFallbackPhoto(type);
    }
  };

  const useFallbackPhoto = (type: 'attendance' | 'task') => {
    // Generate lovely colored profile avatar/proof simulation
    const fallbacks = {
      attendance: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300',
      task: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=300'
    };
    
    if (type === 'attendance') {
      setSelfiePhoto(fallbacks.attendance);
    } else {
      setTaskProofPhoto(fallbacks.task);
    }
    setCameraActive(false);
  };

  // Handle Log In Check
  const handlePinSubmit = (emp: Employee) => {
    if (pinInput === emp.pin) {
      setCurrentUser(emp);
      setPinInput('');
      setPinError('');
      setActiveScreen('home');
    } else {
      setPinError('PIN salah! Silakan coba lagi.');
      setPinInput('');
    }
  };

  // Perform daily clock-in / clock-out
  const handleAttendanceSubmit = (type: 'IN' | 'OUT') => {
    if (!currentUser) return;
    setIsSubmitting(true);
    
    setTimeout(() => {
      const formatTime = () => {
        const d = new Date();
        const mins = d.getMinutes().toString().padStart(2, '0');
        const hrs = d.getHours().toString().padStart(2, '0');
        return `${hrs}:${mins}`;
      };

      const currentTime = formatTime();

      if (type === 'IN') {
        const newAtt: Attendance = {
          id: `att-${Date.now()}`,
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          employeeRole: currentUser.role,
          date: todayStr,
          checkInTime: currentTime,
          locationNameIn: selectedLocation,
          photoIn: selfiePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
          latIn: -6.2008 + (Math.random() - 0.5) * 0.001,
          lngIn: 106.8456 + (Math.random() - 0.5) * 0.001,
          device: 'Sony Xperia XZ3 (Android 14)'
        };
        onAddAttendance(newAtt);
        setSuccessAnimation('Berasil Melakukan Absen Masuk!');
      } else {
        if (userTodayAttendance) {
          const updatedAtt: Attendance = {
            ...userTodayAttendance,
            checkOutTime: currentTime,
            locationNameOut: selectedLocation,
            photoOut: selfiePhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
            latOut: -6.2008 + (Math.random() - 0.5) * 0.001,
            lngOut: 106.8456 + (Math.random() - 0.5) * 0.001,
          };
          onUpdateAttendance(updatedAtt);
          setSuccessAnimation('Berhasil Melakukan Absen Keluar!');
        }
      }
      
      setIsSubmitting(false);
      setSelfiePhoto('');
      
      setTimeout(() => {
        setSuccessAnimation(null);
        setActiveScreen('home');
      }, 2000);
    }, 1500);
  };

  // Submit Task report
  const handleTaskReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSubmitting(true);
    
    setTimeout(() => {
      const finalTitle = taskTitle === 'Lainnya' ? customTaskTitle : taskTitle;
      const formatTime = () => {
        const d = new Date();
        const mins = d.getMinutes().toString().padStart(2, '0');
        const hrs = d.getHours().toString().padStart(2, '0');
        return `${hrs}:${mins}`;
      };

      const newTask: Task = {
        id: `task-${Date.now()}`,
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        employeeRole: currentUser.role,
        title: finalTitle || 'Tugas Umum Outsource',
        description: taskDescription,
        status: 'Menunggu Verifikasi',
        timestamp: formatTime(),
        date: todayStr,
        proofPhoto: taskProofPhoto || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400'
      };

      onAddTask(newTask);
      setIsSubmitting(false);
      setSuccessAnimation('Selesai! Laporan dikirim ke Admin.');
      
      // reset forms
      setTaskTitle('');
      setCustomTaskTitle('');
      setTaskDescription('');
      setTaskProofPhoto('');

      setTimeout(() => {
        setSuccessAnimation(null);
        setActiveScreen('home');
      }, 2200);
    }, 1500);
  };

  // Pre-selected task titles matching roles
  const getTaskTitlesForRole = (role: EmployeeRole) => {
    switch (role) {
      case 'Office Boy':
        return ['Kebersihan Ruang Kantor', 'Fasilitas Ruang Rapat', 'Pembersihan Kaca Lobby', 'Pantry Support', 'Lainnya'];
      case 'Security':
        return ['Patroli Keliling', 'Pemeriksaan CCTV & Pos Jaga', 'Pencegahan Kebakaran / Safety Check', 'Pencatatan Tamu VIP', 'Lainnya'];
      case 'Driver':
        return ['Pengantaran Kepala Cabang', 'Servis Rutin Ambulans / Mobil Dinas', 'Pengambilan Perlengkapan Kantor', 'Pemeliharaan Mobil Operasional', 'Lainnya'];
      default:
        return ['Tugas Operasional', 'Tugas Pendukung', 'Lainnya'];
    }
  };

  return (
    <div id="android-device" className="relative mx-auto w-[375px] h-[780px] bg-[#030304] rounded-[52px] border-[11px] border-[#16171d]/90 shadow-[0_25px_70px_-12px_rgba(0,0,0,0.95)] overflow-hidden font-sans flex flex-col">
      {/* Top Notch Camera */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-32 h-[20px] bg-black rounded-full z-55 flex items-center justify-between px-5">
        <div className="w-2 h-2 rounded-full bg-[#111] border border-slate-905"></div>
        <div className="w-10 h-1 bg-[#151515] rounded"></div>
        <div className="w-2 h-2 rounded-full bg-[#0a0a0f] border border-slate-900"></div>
      </div>

      {/* Top Android Status Bar */}
      <div className="px-6 pt-6 pb-2.5 bg-[#090b11] text-slate-300 flex justify-between items-center text-[10px] font-bold select-none z-40 shrink-0 border-b border-white/[0.02]">
        <span className="font-mono text-[10px] font-bold tracking-tight text-slate-300">21:05</span>
        <div className="flex items-center gap-1.55">
          {googleUser && (
            <Cloud className="w-3.5 h-3.5 text-indigo-400 animate-pulse filter drop-shadow-[0_0_2px_rgba(129,140,248,0.5)]" />
          )}
          <Wifi className="w-3.5 h-3.5 text-slate-400" />
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <Battery className="w-4 h-4 text-slate-400" />
          <span className="text-[9px] font-mono leading-none text-slate-405">95%</span>
        </div>
      </div>

      {/* Canvas for image capture hidden */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main App Canvas */}
      <div className="flex-1 bg-[#07080c] overflow-y-auto flex flex-col relative text-slate-100">
        <AnimatePresence mode="wait">
          {/* Splash Backdrop Success Modal */}
          {successAnimation && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#061e16]/98 z-55 flex flex-col items-center justify-center text-white p-6 text-center backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10 }}
                className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg mb-4"
              >
                <Check className="w-8 h-8 text-emerald-400 stroke-[3]" />
              </motion.div>
              <h3 className="text-sm font-bold mb-1 font-display">Transaksi Sukses</h3>
              <p className="text-[10px] text-emerald-250 font-medium px-2">{successAnimation}</p>
            </motion.div>
          )}

          {/* SCREEN 1: LOGIN SELECTOR */}
          {!currentUser ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col p-6 bg-gradient-to-b from-[#0e1017] via-[#08090e] to-[#020204] text-white justify-between"
            >
              <div className="text-center mt-6">
                <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl mx-auto flex items-center justify-center shadow-md mb-3">
                  <span className="text-xl font-bold text-indigo-400 tracking-tighter">SOP</span>
                </div>
                <h1 className="text-sm font-bold tracking-tight text-white font-display">SiOps Mobile</h1>
                <p className="text-[9px] text-indigo-400 mt-0.5 uppercase tracking-widest font-bold">BPJS KETENAGAKERJAAN</p>
                <p className="text-[10px] text-slate-400 mt-1">SOP Operasional & Absensi Lapangan</p>
              </div>

              <div className="my-auto space-y-3 max-h-[360px] overflow-y-auto pr-1">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest text-center mb-2.5">Masuk sebagai Personil:</p>
                
                {employees.map(emp => (
                  <div key={emp.id} className="relative">
                    <button
                      onClick={() => {
                        setCurrentUser(emp);
                        setPinInput(emp.pin); // dev auto login fill for super fluid onboarding
                        setPinError('');
                      }}
                      className="w-full flex items-center bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.1] rounded-xl p-3 border border-white/[0.04] transition-all text-left group cursor-pointer"
                    >
                      <img src={emp.avatar} alt={emp.name} className="w-9 h-9 rounded-lg object-cover border border-white/[0.08] mr-3 shrink-0" referrerPolicy="no-referrer" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">{emp.name}</h4>
                        <p className="text-[9px] text-indigo-400 bg-indigo-500/10 inline-block px-1.5 py-0.2 rounded mt-1 font-semibold uppercase">{emp.role}</p>
                      </div>
                      <div className="ml-2 px-2 py-1 bg-indigo-550/10 border border-indigo-500/20 rounded-md text-[8px] text-indigo-300 font-mono tracking-wider font-semibold uppercase">
                        PIN: {emp.pin}
                      </div>
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-[9px] text-center text-slate-500 leading-normal pt-2">
                Pilih Akun Staff Outsource untuk mensimulasikan check-in GPS & pengiriman laporan kerja dinas.
              </p>
            </motion.div>
          ) : (
            /* AUTHENTICATED OR ROOT SCREENS */
            <motion.div
              key="authenticated-views"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col bg-[#07080c] text-slate-100"
            >
              {/* Internal Smart App Header */}
              <div className="bg-[#0f1118]/85 px-4 pt-3.5 pb-4 text-white rounded-b-2xl border-b border-white/[0.03] shadow-md select-none shrink-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-8.5 h-8.5 rounded-lg object-cover border border-white/[0.08]" referrerPolicy="no-referrer" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 truncate max-w-[155px] font-sans">{currentUser.name}</h4>
                      <p className="text-[9px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block font-semibold uppercase tracking-wider">{currentUser.role}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setCurrentUser(null)}
                    title="Switch user"
                    className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-450 hover:bg-rose-550/10 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* SCREEN CONTENT AREA */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                
                {/* 1. HOME SCREEN */}
                {activeScreen === 'home' && (
                  <motion.div key="home-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    
                    {/* Attendance Indicator Card */}
                    <div className="bg-[#0f1118]/85 rounded-xl p-4 border border-white/[0.04] shadow-md space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest">Status Absensi</p>
                          <h3 className="text-xs font-bold text-slate-200 mt-1">Kamis, 21 Mei 2026</h3>
                        </div>
                        <span className={`text-[8px] uppercase tracking-wide font-black px-2 py-0.5 rounded-md border ${userTodayAttendance?.checkInTime ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {userTodayAttendance?.checkInTime ? 'Hadir' : 'Absen'}
                        </span>
                      </div>

                      {/* Check-In Specs */}
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#1b1c24] text-center">
                        <div className="p-2 bg-[#050609] border border-white/[0.02] rounded-lg">
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Jam Masuk</span>
                          <span className="text-[11px] font-mono font-bold mt-1 block">
                            {userTodayAttendance?.checkInTime ? (
                              <span className="text-emerald-400 flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3" /> {userTodayAttendance.checkInTime}
                              </span>
                            ) : (
                              <span className="text-slate-600">--:--</span>
                            )}
                          </span>
                        </div>
                        <div className="p-2 bg-[#050609] border border-white/[0.02] rounded-lg">
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Jam Keluar</span>
                          <span className="text-[11px] font-mono font-bold mt-1 block">
                            {userTodayAttendance?.checkOutTime ? (
                              <span className="text-blue-400 flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3" /> {userTodayAttendance.checkOutTime}
                              </span>
                            ) : (
                              <span className="text-slate-600">--:--</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Absen action button */}
                      <button
                        onClick={() => {
                          setActiveScreen('checkin');
                          setSelfiePhoto('');
                        }}
                        disabled={userTodayAttendance?.checkInTime && userTodayAttendance?.checkOutTime}
                        className={`w-full mt-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                          userTodayAttendance?.checkInTime && userTodayAttendance?.checkOutTime
                            ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                            : userTodayAttendance?.checkInTime
                            ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-slate-100'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {userTodayAttendance?.checkInTime && userTodayAttendance?.checkOutTime
                          ? 'Absensi Hari Ini Lengkap'
                          : userTodayAttendance?.checkInTime
                          ? 'Absen Keluar (Clock-out)'
                          : 'Absen Masuk (Clock-in)'}
                      </button>
                    </div>

                    {/* Task Progress Tracker Card */}
                    <div className="bg-[#0f1118]/85 rounded-xl p-4 border border-white/[0.04] shadow-md space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest">Laporan Tugas Hari Ini</p>
                          <p className="text-xs font-bold text-slate-200 mt-1">Summary Progres</p>
                        </div>
                        <span className="bg-[#121625] text-indigo-400 border border-indigo-500/15 text-[8px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                          {userTasksToday.length} tugas
                        </span>
                      </div>

                      <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto pr-1">
                        {userTasksToday.map(tsk => (
                          <div key={tsk.id} className="flex justify-between items-center text-[10px] p-2.5 bg-slate-950/50 border border-slate-900 rounded-lg">
                            <span className="font-semibold text-slate-300 truncate max-w-[160px]">{tsk.title}</span>
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 px-1.5 py-0.5 rounded shrink-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                tsk.status === 'Selesai' ? 'bg-emerald-500' : tsk.status === 'Menunggu Verifikasi' ? 'bg-amber-500' : 'bg-indigo-550'
                              }`} />
                              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{tsk.status === 'Menunggu Verifikasi' ? 'PROSES' : tsk.status}</span>
                            </div>
                          </div>
                        ))}
                        {userTasksToday.length === 0 && (
                          <div className="text-center py-6">
                            <p className="text-[10px] text-slate-500">Belum ada tugas dilaporkan hari ini.</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setActiveScreen('task-report')}
                        className="w-full mt-3 py-2 bg-[#050609] border border-white/[0.04] hover:bg-slate-900 text-slate-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                        Buat Laporan Tugas Baru
                      </button>
                    </div>

                    {/* Quick Menu Buttons Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setActiveScreen('my-tasks')}
                        className="p-3 bg-[#0f1118]/85 hover:bg-slate-900/60 border border-white/[0.03] rounded-xl text-left transition-colors flex flex-col justify-between h-24 cursor-pointer"
                      >
                        <div className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-lg w-fit">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">Riwayat Tugas</h4>
                          <p className="text-[8px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Cek Verifikasi</p>
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveScreen('jobdesk')}
                        className="p-3 bg-[#0f1118]/85 hover:bg-slate-900/60 border border-white/[0.03] rounded-xl text-left transition-colors flex flex-col justify-between h-24 cursor-pointer"
                      >
                        <div className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-lg w-fit">
                          <Shield className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">Job Desk & SOP</h4>
                          <p className="text-[8px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Master SOP</p>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 2. ABSENSI (CHECK-IN / OUT) SCREEN */}
                {activeScreen === 'checkin' && (
                  <motion.div key="checkin-content" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-200">
                      <button onClick={() => setActiveScreen('home')} className="p-1 hover:bg-slate-900 text-slate-400 rounded-lg cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                      <h3 className="text-xs font-bold uppercase tracking-wider">Kirim Absensi Harian</h3>
                    </div>

                    {/* Location Simulated Info */}
                    <div className="bg-[#0f1118]/85 rounded-xl p-4 border border-white/[0.04] space-y-3">
                      <div className="flex items-center gap-2 text-indigo-450">
                        <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="text-[9px] uppercase tracking-wider font-bold">Lokasi GPS Terdeteksi</span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Pilih Area Lokasi Tugas</label>
                        <select 
                          value={selectedLocation} 
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="Kantor Cabang BPJS Ketenagakerjaan">Kantor Cabang BPJS Ketenagakerjaan</option>
                          <option value="Pos Keamanan Pintu Masuk">Pos Jaga Pintu Masuk Utama</option>
                          <option value="Lobby Utama Gedung BPJS">Lobby Utama Gedung</option>
                          <option value="BPJS Ketenagakerjaan Depot Motor Dinas">Tempat Parkir / Pool Kendaraan</option>
                        </select>
                      </div>

                      {/* Mock Radius details */}
                      <div className="flex items-center justify-between text-[9px] p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-lg">
                        <span className="font-semibold flex items-center gap-1"><Compass className="w-3.5 h-3.5" /> Jarak ke Kantor: 12 meter</span>
                        <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[8px] uppercase tracking-wide font-black">RADIUS SAFE</span>
                      </div>
                    </div>

                    {/* Camera Photo Module */}
                    <div className="bg-[#0f1118]/85 rounded-xl p-4 border border-white/[0.04] space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Foto Selfie Mandiri</label>
                        {selfiePhoto && (
                          <button onClick={() => setSelfiePhoto('')} className="text-[9px] text-rose-455 font-bold hover:underline cursor-pointer">Hapus Foto</button>
                        )}
                      </div>

                      {cameraActive ? (
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
                          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
                          
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-30">
                            <button
                              onClick={() => capturePhoto('attendance')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-100 border border-white/10 rounded-full font-bold text-[10px] cursor-pointer"
                            >
                              Ambil Foto
                            </button>
                            <button
                              onClick={stopCamera}
                              className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-full text-[10px] cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : selfiePhoto ? (
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-950 border border-slate-900">
                          <img src={selfiePhoto} alt="Selfie Verification" className="w-[305px] h-[305px] object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute top-2 right-2 bg-emerald-600 text-white p-1 rounded-full">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-square w-full rounded-lg bg-slate-950/60 border border-dashed border-slate-900 flex flex-col items-center justify-center p-6 text-center">
                          <Camera className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                          <p className="text-xs font-bold text-slate-300 mt-2">Ambil Foto Selfie</p>
                          <p className="text-[9px] text-slate-500 mt-1 px-2">Gunakan kamera depan atau simulasi bypass jika browser memblokir kamera</p>
                          <div className="flex gap-2 mt-4 w-full">
                            <button 
                              onClick={startCamera} 
                              className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-bold cursor-pointer"
                            >
                              Kamera
                            </button>
                             <button 
                              onClick={() => useFallbackPhoto('attendance')} 
                              className="flex-1 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-350 rounded-lg text-[9px] font-bold cursor-pointer"
                            >
                              Simulasi
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit Bar */}
                    <button
                      onClick={() => handleAttendanceSubmit(userTodayAttendance?.checkInTime ? 'OUT' : 'IN')}
                      disabled={isSubmitting || (!selfiePhoto && !videoRef.current)}
                      className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                        isSubmitting
                          ? 'bg-emerald-850 text-white cursor-wait'
                          : !selfiePhoto
                          ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                          : userTodayAttendance?.checkInTime
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/15'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-slate-100 shadow-emerald-950/15'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Memproses Data GPS...
                        </>
                      ) : userTodayAttendance?.checkInTime ? (
                        'Kirim Absen Keluar'
                      ) : (
                        'Kirim Absen Masuk'
                      )}
                    </button>
                  </motion.div>
                )}

                {/* 3. REPORT TUGAS SCREEN */}
                {activeScreen === 'task-report' && (
                  <motion.div key="task-report-content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-200">
                      <button onClick={() => setActiveScreen('home')} className="p-1 hover:bg-slate-900 text-slate-400 rounded-lg cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                      <h3 className="text-xs font-bold uppercase tracking-wider">Lapor Kegiatan Tugas</h3>
                    </div>

                    <form onSubmit={handleTaskReportSubmit} className="space-y-4">
                      
                      <div className="bg-[#0f1118]/85 rounded-xl p-4 border border-white/[0.04] space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Pilih Jenis Tugas</label>
                          <select 
                            value={taskTitle}
                            onChange={(e) => {
                              setTaskTitle(e.target.value);
                              if (e.target.value !== 'Lainnya') setCustomTaskTitle('');
                            }}
                            required
                            className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                          >
                            <option value="" className="bg-[#090b11]">-- Pilih Tugas --</option>
                            {getTaskTitlesForRole(currentUser.role).map((title, i) => (
                              <option key={i} value={title} className="bg-[#090b11]">{title}</option>
                            ))}
                          </select>
                        </div>

                        {taskTitle === 'Lainnya' && (
                          <div className="space-y-1.5">
                            <label className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Judul Tugas Kustom</label>
                            <input 
                              type="text" 
                              value={customTaskTitle}
                              onChange={(e) => setCustomTaskTitle(e.target.value)}
                              placeholder="Ketik judul kegiatan..."
                              required
                              className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Uraian / Deskripsi Laporan SOP</label>
                          <textarea
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                            placeholder="Tulis detail pekerjaan yang diselesaikan, kendala di lapangan, dll..."
                            required
                            rows={3}
                            className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      </div>

                      {/* Photo proof module */}
                      <div className="bg-[#0f1118]/85 rounded-xl p-4 border border-white/[0.04] space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Foto Bukti Kerja (Opsional)</label>
                          {taskProofPhoto && (
                            <button type="button" onClick={() => setTaskProofPhoto('')} className="text-[9px] text-rose-450 font-bold hover:underline cursor-pointer">Hapus Foto</button>
                          )}
                        </div>

                        {cameraActive ? (
                          <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
                            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 z-30">
                              <button
                                type="button"
                                onClick={() => capturePhoto('task')}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 border border-white/10 rounded-full font-bold text-[10px] cursor-pointer"
                              >
                                Foto
                              </button>
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-full text-[10px] cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : taskProofPhoto ? (
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-900">
                            <img src={taskProofPhoto} alt="Task proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute top-2 right-2 bg-emerald-600 text-white p-1 rounded-full">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-24 rounded-lg bg-[#07080c] border border-dashed border-slate-850 flex flex-col items-center justify-center p-3 text-center">
                            <Camera className="w-6 h-6 text-slate-600 stroke-[1.5]" />
                            <p className="text-[10px] font-bold text-slate-400 mt-1.5">Unggah Foto Hasil Kerja</p>
                            <div className="flex gap-2 mt-2.5 w-full max-w-[200px]">
                              <button 
                                type="button"
                                onClick={startCamera} 
                                className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-550 text-white rounded text-[9px] font-bold cursor-pointer"
                              >
                                Kamera
                              </button>
                              <button 
                                type="button"
                                onClick={() => useFallbackPhoto('task')} 
                                className="flex-1 py-1 bg-slate-900 border border-slate-800 text-slate-350 rounded text-[9px] font-bold cursor-pointer"
                              >
                                Simulasi
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !taskTitle}
                        className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                          isSubmitting || !taskTitle
                            ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-slate-100 shadow-emerald-950/15'
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Mengirim Laporan...
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 text-emerald-100" />
                            Kirim ke Super Admin (Verifikasi)
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* 4. MY TASKS FEED SCREEN */}
                {activeScreen === 'my-tasks' && (
                  <motion.div key="my-tasks-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-200">
                      <button onClick={() => setActiveScreen('home')} className="p-1 hover:bg-slate-900 text-slate-400 rounded-lg cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                      <h3 className="text-xs font-bold uppercase tracking-wider">Status Verifikasi Tugas</h3>
                    </div>

                    <div className="space-y-3">
                      {userTasksToday.map((tsk) => (
                        <div key={tsk.id} className="bg-[#0f1118]/85 rounded-xl p-3.5 border border-white/[0.04] shadow-md space-y-2.5">
                          <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-bold text-slate-200 max-w-[195px] truncate">{tsk.title}</h4>
                            <span className="text-[8px] font-mono text-slate-500 font-semibold uppercase">{tsk.timestamp}</span>
                          </div>

                          <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-900">{tsk.description}</p>
                          
                          {tsk.proofPhoto && (
                            <img src={tsk.proofPhoto} alt="Proof" className="w-full h-24 rounded-lg object-cover border border-slate-900" placeholder="proof" referrerPolicy="no-referrer" />
                          )}

                          <div className="flex items-center justify-between pt-1 text-[9px] font-bold uppercase tracking-wide">
                            <span className="text-slate-550">Status</span>
                            <span className={`px-2 py-0.5 rounded-md border ${
                              tsk.status === 'Selesai' 
                                ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/15' 
                                : tsk.status === 'Menunggu Verifikasi' 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/15' 
                                : 'bg-slate-900 text-slate-400 border-slate-850'
                            }`}>
                              {tsk.status === 'Menunggu Verifikasi' ? 'PROSES VERIFIKASI' : tsk.status}
                            </span>
                          </div>

                          {tsk.adminFeedback && (
                            <div className="mt-2 text-[9px] bg-indigo-505/10 border-l-2 border-indigo-500 text-indigo-300 p-2.5 rounded-r-lg border-y border-r border-indigo-500/10">
                              <span className="font-bold flex items-center gap-1 uppercase tracking-wider text-[8px]"><Shield className="w-3.5 h-3.5 text-indigo-400" /> Catatan Admin:</span>
                              <p className="mt-1 italic leading-normal">"{tsk.adminFeedback}"</p>
                            </div>
                          )}
                        </div>
                      ))}

                      {userTasksToday.length === 0 && (
                        <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-dashed border-slate-900">
                          <Clipboard className="w-6 h-6 mx-auto text-slate-600" />
                          <p className="text-xs font-bold text-slate-400 mt-2">Daftar Tugas Kosong</p>
                          <p className="text-[9px] text-slate-550 mt-1">Anda belum mengirim laporan tugas hari ini.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 5. JOB DESK / OPERATIONAL STANDARD (SOP) */}
                {activeScreen === 'jobdesk' && (
                  <motion.div key="jobdesk-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-200">
                      <button onClick={() => setActiveScreen('home')} className="p-1 hover:bg-slate-900 text-slate-400 rounded-lg cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                      <h3 className="text-xs font-bold uppercase tracking-wider">Job Desk & Panduan SOP</h3>
                    </div>

                    <div className="space-y-3">
                      {jobDeskItems.filter(jd => jd.role === currentUser.role).map((jd) => (
                        <div key={jd.id} className="bg-[#0f1118]/85 rounded-xl p-3.5 border-l-4 border-l-[#4ea8de] border-y border-r border-white/[0.03] shadow-md space-y-1.5">
                          <h4 className="text-[10px] font-bold text-slate-200 uppercase tracking-wide leading-snug">{jd.taskTitle}</h4>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">{jd.description}</p>
                          <div className="flex items-center gap-1 text-[9px] text-amber-450 bg-amber-500/10 border border-amber-500/15 w-fit px-2 py-0.5 rounded font-mono font-bold mt-2 uppercase tracking-wider">
                            <Clock className="w-3 h-3" /> {jd.schedule}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

              </div>

              {/* Bottom Android Soft Navigation Bar */}
              <div className="bg-[#090b11] p-2 text-slate-300 flex justify-around items-center select-none shrink-0 border-t border-white/[0.03]">
                <button 
                  onClick={() => {
                    if (activeScreen !== 'home') setActiveScreen('home');
                  }}
                  className={`flex flex-col items-center gap-1 py-1 cursor-pointer transition-colors ${activeScreen === 'home' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-400'}`}
                >
                  <User className="w-4 h-4" />
                  <span className="text-[8px] font-bold uppercase tracking-wider">Beranda</span>
                </button>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-500 cursor-pointer hover:border-white active:bg-slate-800 transition-colors" onClick={() => setActiveScreen('home')} title="Home button"></div>
                <div className="w-3 h-3 border-2 border-slate-500 flex items-center justify-center cursor-pointer hover:border-white select-none rotate-45" onClick={() => {
                  if (activeScreen !== 'home') setActiveScreen('home');
                }} title="Back button"></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
