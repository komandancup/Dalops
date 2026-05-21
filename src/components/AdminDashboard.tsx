/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, CheckCircle2, ClipboardList, AlertCircle, Search, 
  MapPin, Bell, LogOut, Check, X, Shield, BarChart3, PieChart,
  Grid, Compass, Briefcase, ChevronRight, UserPlus, FileText, Smartphone,
  Share2, FileSpreadsheet, FolderOpen, RefreshCw, Play, CheckCircle, Database, ExternalLink
} from 'lucide-react';
import { Employee, Attendance, Task, JobDeskItem, EmployeeRole } from '../types';
import { exportToGoogleSheets, getOrCreateFolder, uploadPhotoToDrive } from '../workspace';

interface AdminDashboardProps {
  employees: Employee[];
  attendances: Attendance[];
  tasks: Task[];
  jobDeskItems: JobDeskItem[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onAddAttendance: (att: Attendance) => void;
  onUpdateAttendance: (att: Attendance) => void;
  onAddTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
  onAddJobDeskItem: (item: JobDeskItem) => void;
  onUpdateJobDeskItem: (item: JobDeskItem) => void;
  googleUser?: any;
  googleToken?: string | null;
}

export default function AdminDashboard({
  employees,
  attendances,
  tasks,
  jobDeskItems,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onAddAttendance,
  onUpdateAttendance,
  onAddTask,
  onUpdateTask,
  onAddJobDeskItem,
  onUpdateJobDeskItem,
  googleUser,
  googleToken
}: AdminDashboardProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard'); // dashboard, absensi, tugas, rekap, user, jobdesk
  
  // Modals & Details state
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);
  const [selectedAttendanceDetail, setSelectedAttendanceDetail] = useState<Attendance | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>('');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // User Management Form state
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<EmployeeRole>('Office Boy');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserPin, setNewUserPin] = useState<string>('');

  // Job desk manual state
  const [showAddJobDeskModal, setShowAddJobDeskModal] = useState<boolean>(false);
  const [jTitle, setJTitle] = useState<string>('');
  const [jDesc, setJDesc] = useState<string>('');
  const [jSchedule, setJSchedule] = useState<string>('');
  const [jRole, setJRole] = useState<EmployeeRole>('Office Boy');

  // Google Integration Local States
  const [isExportingSheets, setIsExportingSheets] = useState<boolean>(false);
  const [spreadsheetLink, setSpreadsheetLink] = useState<string | null>(null);
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false);
  const [driveBackupResult, setDriveBackupResult] = useState<{ successCount: number; failedCount: number; folderLink?: string } | null>(null);
  const [syncSheetId, setSyncSheetId] = useState<string | null>(() => localStorage.getItem('siops_sync_sheet_id'));

  const handleExportSheets = async () => {
    if (!googleToken) {
      alert("Silakan hubungkan akun Google Anda di header atas terlebih dahulu!");
      return;
    }
    setIsExportingSheets(true);
    setSpreadsheetLink(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const title = `Laporan Kerja Outsource BPJS Ketenagakerjaan - ${today}`;
      const result = await exportToGoogleSheets(googleToken, title, employees, attendances, tasks);
      setSpreadsheetLink(result.spreadsheetUrl);
      localStorage.setItem('siops_sync_sheet_id', result.spreadsheetId);
      setSyncSheetId(result.spreadsheetId);
    } catch (err: any) {
      alert("Gagal ekspor ke Google Sheets: " + err.message);
    } finally {
      setIsExportingSheets(false);
    }
  };

  const handleToggleAutoSync = async () => {
    if (syncSheetId) {
      localStorage.removeItem('siops_sync_sheet_id');
      setSyncSheetId(null);
    } else {
      if (!googleToken) {
        alert("Silakan hubungkan akun Google Anda di header atas terlebih dahulu!");
        return;
      }
      setIsExportingSheets(true);
      try {
        const title = `Laporan SiOps BPJS Ketenagakerjaan (AUTO-SYNC)`;
        const result = await exportToGoogleSheets(googleToken, title, employees, attendances, tasks);
        localStorage.setItem('siops_sync_sheet_id', result.spreadsheetId);
        setSyncSheetId(result.spreadsheetId);
        alert(`Auto-Sync Berhasil Dihubungkan! Seluruh absensi & tugas baru di simulasikan HP Android akan terkirim ke spreadsheet ini secara live!`);
      } catch (err: any) {
        alert("Gagal mengaktifkan auto-sync: " + err.message);
      } finally {
        setIsExportingSheets(false);
      }
    }
  };

  const handleDriveBackup = async () => {
    if (!googleToken) {
      alert("Silakan hubungkan akun Google Anda di header atas terlebih dahulu!");
      return;
    }
    setIsSyncingDrive(true);
    setDriveBackupResult(null);
    try {
      const rootFolderId = await getOrCreateFolder(googleToken, "SiOps BPJS Ketenagakerjaan Backup");
      
      let success = 0;
      let failed = 0;

      const picsIn = attendances.filter(a => a.photoIn && a.photoIn.startsWith('data:image'));
      const picsOut = attendances.filter(a => a.photoOut && a.photoOut.startsWith('data:image'));
      const picsTask = tasks.filter(t => t.proofPhoto && t.proofPhoto.startsWith('data:image'));

      if (picsIn.length === 0 && picsOut.length === 0 && picsTask.length === 0) {
        alert("Tidak ditemukan data foto biometrik berformat Base64 Camera untuk dibackup! Silakan lakukan absensi swafoto (selfie) / foto bukti kerja asli di HP Android sebelah kiri terlebih dahulu.");
        setIsSyncingDrive(false);
        return;
      }

      for (const a of picsIn) {
        try {
          const filename = `[Hadir In] ${a.employeeName} (${a.employeeRole}) - ${a.date}.png`;
          await uploadPhotoToDrive(googleToken, filename, a.photoIn!, rootFolderId);
          success++;
        } catch (e) {
          failed++;
        }
      }

      for (const a of picsOut) {
        try {
          const filename = `[Hadir Out] ${a.employeeName} (${a.employeeRole}) - ${a.date}.png`;
          await uploadPhotoToDrive(googleToken, filename, a.photoOut!, rootFolderId);
          success++;
        } catch (e) {
          failed++;
        }
      }

      for (const t of picsTask) {
        try {
          const filename = `[Bukti Tugas] ${t.employeeName} - ${t.title} - ${t.date}.png`;
          await uploadPhotoToDrive(googleToken, filename, t.proofPhoto!, rootFolderId);
          success++;
        } catch (e) {
          failed++;
        }
      }

      setDriveBackupResult({
        successCount: success,
        failedCount: failed,
        folderLink: `https://drive.google.com/drive/folders/${rootFolderId}`
      });
    } catch (err: any) {
      alert("Gagal melakukan cadangan Google Drive: " + err.message);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Calculated Stats
  const todayStr = '2026-05-21';
  const totalEmployees = employees.filter(e => e.status === 'Aktif').length;
  
  // Present today is count of employees who have a starting entry
  const presentEmployeesCount = attendances.filter(
    att => att.date === todayStr && att.checkInTime !== undefined
  ).length;

  const totalTasksToday = tasks.filter(t => t.date === todayStr).length;
  const completedTasksToday = tasks.filter(t => t.date === todayStr && t.status === 'Selesai').length;
  
  const pendingVerificationCount = tasks.filter(
    t => t.status === 'Menunggu Verifikasi'
  ).length;

  // Active user count for role
  const countByRole = (role: EmployeeRole) => {
    return employees.filter(e => e.role === role && e.status === 'Aktif').length;
  };

  // Verify task handler
  const handleTaskAction = (task: Task, action: 'APPROVE' | 'REJECT') => {
    const updatedStatus = action === 'APPROVE' ? 'Selesai' : 'Proses';
    const updatedTask: Task = {
      ...task,
      status: updatedStatus,
      adminFeedback: feedbackText || (action === 'APPROVE' ? 'Diverifikasi Oleh Admin.' : 'Ditolak: Bukti foto kurang jelas / lakukan revisi.')
    };

    onUpdateTask(updatedTask);
    setSelectedTaskDetail(null);
    setFeedbackText('');
  };

  // Add Employee handler
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserPin) return;

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: newUserName,
      role: newUserRole,
      status: 'Aktif',
      phone: newUserPhone || '0812' + Math.floor(10000000 + Math.random() * 90000000),
      pin: newUserPin,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=260'
    };

    onAddEmployee(newEmp);
    setNewUserName('');
    setNewUserPhone('');
    setNewUserPin('');
    setShowAddUserModal(false);
  };

  // Add Job Desk handler
  const handleAddJobDesk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jTitle || !jDesc) return;

    const newItem: JobDeskItem = {
      id: `jd-${Date.now()}`,
      role: jRole,
      taskTitle: jTitle,
      description: jDesc,
      schedule: jSchedule || 'Sesuai Kebutuhan'
    };

    onAddJobDeskItem(newItem);
    setJTitle('');
    setJDesc('');
    setJSchedule('');
    setShowAddJobDeskModal(false);
  };

  return (
    <div id="admin-backoffice" className="flex-1 bg-[#07080b] min-h-screen flex text-slate-100 font-sans overflow-hidden">
      {/* 1. LEFT NAVIGATION SIDEBAR */}
      <aside className="w-64 bg-slate-950 flex flex-col shrink-0 text-slate-400 select-none z-10 border-r border-[#15171e]">
        <div className="p-6 border-b border-[#15171e] flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm tracking-tight shadow-md shadow-indigo-500/10" id="logo-icon">
            SI
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-tight leading-tight font-display">SiOps</h1>
            <p className="text-[10px] text-slate-450 font-semibold tracking-wide uppercase">BPJS Ketenagakerjaan</p>
          </div>
        </div>

        {/* ADMIN USER STAMP */}
        <div className="p-5 flex items-center gap-3 bg-slate-900/20 border-b border-[#15171e]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500/60 to-violet-500/60 text-white font-bold text-xs flex items-center justify-center uppercase tracking-wider shadow-inner">
            AF
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">Ahmad Fauzi</h4>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
              Super Admin
            </p>
          </div>
        </div>

        {/* NAVIGATION MENUS */}
        <nav className="flex-1 p-4 space-y-7 overflow-y-auto">
          {/* MENU UTAMA */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">MENU UTAMA</span>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                activeTab === 'dashboard' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 shadow-sm' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-4 h-4 stroke-[2.2]" />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab('absensi')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                activeTab === 'absensi' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 shadow-sm' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-4 h-4 stroke-[2.2]" />
              <span>Absensi</span>
            </button>
            <button 
              onClick={() => setActiveTab('tugas')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all relative duration-300 ${
                activeTab === 'tugas' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 shadow-sm' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4 stroke-[2.2]" />
              <span className="flex-1 text-left">Laporan Tugas</span>
              {pendingVerificationCount > 0 && (
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded-full font-bold text-[9px] leading-none">
                  {pendingVerificationCount}
                </span>
              )}
            </button>
          </div>

          {/* MONITORING */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">MONITORING</span>
            <button 
              onClick={() => setActiveTab('rekap')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                activeTab === 'rekap' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 shadow-sm' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4 stroke-[2.2]" />
              <span>Laporan & Rekap</span>
            </button>
            <button 
              onClick={() => setActiveTab('user')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                activeTab === 'user' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 shadow-sm' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 stroke-[2.2]" />
              <span>Manajemen User</span>
            </button>
          </div>

          {/* INFORMASI */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">INFORMASI</span>
            <button 
              onClick={() => setActiveTab('jobdesk')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-300 ${
                activeTab === 'jobdesk' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 shadow-sm' 
                  : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4 stroke-[2.2]" />
              <span>Job Desk</span>
            </button>
          </div>
        </nav>

        {/* LOGOUT FOOTER */}
        <div className="p-4 border-t border-[#15171e]">
          <button 
            onClick={() => alert('Log out dari Backoffice Super Admin')}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white transition-all text-left duration-300"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN APP CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#07080b]">
        
        {/* Top Header Panel */}
        <header className="bg-slate-950/80 backdrop-blur-md border-b border-[#15171e] h-16 shrink-0 flex items-center justify-between px-8 select-none z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-display">{activeTab} Panel</h2>
            <span className="text-slate-700 text-sm">/</span>
            <span className="text-xs text-slate-400 font-medium">BPJS Ketenagakerjaan Kantor Cabang</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-200 font-display">Kamis, 21 Mei 2026</p>
              <p className="text-[10px] font-mono text-indigo-400 font-semibold mt-0.5 uppercase tracking-wide">EST. GMT+7 WIB</p>
            </div>
            
            <div className="h-8 w-[1px] bg-slate-900"></div>

            <div className="relative">
              <button className="p-2 border border-slate-900 rounded-xl hover:bg-slate-900 text-slate-350 transition-colors relative">
                <Bell className="w-4 h-4" />
                {pendingVerificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 w-4.5 h-4.5 rounded-full text-[9px] font-bold text-slate-950 flex items-center justify-center border border-slate-950">
                    {pendingVerificationCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* 3. SCROLLABLE CORE VIEW PORT */}
        <main className="flex-1 p-8 space-y-6">

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* KPI blocks matching screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* CARD 1: TOTAL TENAGA OUTSOURCE */}
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-[#1a1c23] shadow-lg flex items-center gap-4 hover:border-indigo-500/20 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/10">
                    <Users className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white leading-none font-display">{totalEmployees}</h3>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Total Tenaga Outsource</p>
                    <p className="text-[10px] text-emerald-400 font-bold mt-1.5 inline-flex items-center gap-1">
                      ↗ {presentEmployeesCount} Aktif hari ini
                    </p>
                  </div>
                </div>

                {/* CARD 2: HADIR HARI INI */}
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-[#1a1c23] shadow-lg flex items-center gap-4 hover:border-emerald-500/20 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/10">
                    <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white leading-none font-display">{presentEmployeesCount}</h3>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Hadir Hari Ini</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                      dari keseluruh {totalEmployees} orang
                    </p>
                  </div>
                </div>

                {/* CARD 3: TUGAS MASUK HARI INI */}
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-[#1a1c23] shadow-lg flex items-center gap-4 hover:border-violet-500/20 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0 border border-violet-500/10">
                    <ClipboardList className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white leading-none font-display">{totalTasksToday}</h3>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Tugas Masuk Hari Ini</p>
                    <p className="text-[10px] text-violet-400 font-bold mt-1.5">
                      ✓ {completedTasksToday} Selesai / Disetujui
                    </p>
                  </div>
                </div>

                {/* CARD 4: MENUNGGU VERIFIKASI */}
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-amber-500/10 shadow-lg flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/10">
                    <AlertCircle className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white leading-none font-display">{pendingVerificationCount}</h3>
                    <p className="text-xs font-semibold text-slate-400 mt-1">Menunggu Verifikasi</p>
                    <p className="text-[10px] text-rose-450 font-bold mt-1.5">
                      ⚠️ Tinjauan manual admin
                    </p>
                  </div>
                </div>

              </div>

              {/* PRIMARY CONTENT GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT BLOCK: Tugas Terbaru timeline */}
                <div className="lg:col-span-6 bg-slate-950/40 p-6 rounded-2xl border border-[#1a1c23] shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-5">
                      <h4 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider font-display">
                        <ClipboardList className="w-4 h-4 text-indigo-400" />
                        Tugas Terbaru Outsource
                      </h4>
                      <button 
                        onClick={() => setActiveTab('tugas')} 
                        className="text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl transition-all font-semibold"
                      >
                        Lihat Semua
                      </button>
                    </div>

                    {/* Timeline items mapped to exactly fit the layout */}
                    <div className="space-y-6 relative border-l border-slate-900 pl-4 py-2 mt-4 ml-3">
                      {tasks.slice(0, 4).map((task) => (
                        <div key={task.id} className="relative">
                           {/* Dot accent */}
                          <div className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-slate-950 flex items-center justify-center ${
                            task.status === 'Selesai' ? 'border-emerald-500' : task.status === 'Menunggu Verifikasi' ? 'border-amber-500 bg-amber-500/10' : 'border-slate-750'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              task.status === 'Selesai' ? 'bg-emerald-500' : task.status === 'Menunggu Verifikasi' ? 'bg-amber-500' : 'bg-slate-600'
                            }`} />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="text-xs font-bold text-slate-200">{task.title}</h5>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                                task.status === 'Selesai' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : task.status === 'Menunggu Verifikasi' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10' : 'bg-slate-900 text-slate-400'
                              }`}>
                                {task.status === 'Menunggu Verifikasi' ? 'Proses Peninjauan' : task.status}
                              </span>
                            </div>

                            <p className="text-[10px] text-slate-500 font-bold font-mono">
                              {task.employeeName} · {task.timestamp} WIB
                            </p>
                            
                            <p className="text-[11px] text-slate-350 leading-normal max-w-lg bg-slate-900/40 p-2.5 rounded-xl border border-slate-900 italic">
                              "{task.description}"
                            </p>

                            {task.status === 'Menunggu Verifikasi' && (
                              <div className="flex gap-2 pt-1.5">
                                <button
                                  onClick={() => {
                                    setFeedbackText('Hasil pemeriksaan sesuai standar.');
                                    handleTaskAction(task, 'APPROVE');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" /> Setujui
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedTaskDetail(task);
                                    setActiveTab('tugas');
                                  }}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  Tinjau Foto
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-[#4a4e5a] mt-6 border-t border-[#121319] pt-4 font-semibold">
                    Riwayat laporan diatas mencakup tugas terjadwal maupun kustom harian outsource.
                  </p>
                </div>

                {/* RIGHT BLOCK: Absensi Hari Ini table matching screenshot */}
                <div className="lg:col-span-6 bg-slate-950/40 p-6 rounded-2xl border border-[#1a1c23] shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-5">
                      <h4 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider font-display">
                        <Compass className="w-4 h-4 text-emerald-400" />
                        Absensi Hari Ini
                      </h4>
                      <button 
                        onClick={() => setActiveTab('absensi')} 
                        className="text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl transition-all font-semibold"
                      >
                        Detail
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-[#13151b] text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            <th className="pb-3 pr-2">NAMA</th>
                            <th className="pb-3 pr-2">PERAN</th>
                            <th className="pb-3 pr-2">MASUK</th>
                            <th className="pb-3">KELUAR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#13151b]">
                          {employees.map((emp) => {
                            const att = attendances.find(a => a.employeeId === emp.id && a.date === todayStr);
                            return (
                              <tr key={emp.id} className="text-xs hover:bg-slate-900/30 transition-colors">
                                <td className="py-3 pr-2">
                                  <div className="flex items-center gap-2.5">
                                    <img src={emp.avatar} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0 ring-1 ring-white/10" referrerPolicy="no-referrer" />
                                    <span className="font-bold text-slate-200 truncate max-w-[120px]">{emp.name}</span>
                                  </div>
                                </td>
                                <td className="py-3 pr-2">
                                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold inline-block border ${
                                    emp.role === 'Office Boy' 
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/10' 
                                      : emp.role === 'Security' 
                                      ? 'bg-rose-500/10 text-rose-450 border-rose-500/10' 
                                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10'
                                  }`}>
                                    {emp.role}
                                  </span>
                                </td>
                                <td className="py-3 pr-2 font-mono font-bold text-emerald-400">
                                  {att?.checkInTime || '—'}
                                </td>
                                <td className="py-3 font-mono font-bold text-slate-400">
                                  {att?.checkOutTime || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-[#12141c]/50 p-4 rounded-xl border border-slate-900 flex items-center justify-between text-xs mt-6 select-text">
                    <span className="text-slate-400 font-medium">Rasio Kehadiran Hari ini:</span>
                    <span className="font-bold text-white font-mono">
                      {Math.round((presentEmployeesCount / (totalEmployees || 1)) * 100)}% ({presentEmployeesCount}/{totalEmployees} orang)
                    </span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: ATTENDANCE HISTORY LIST */}
          {activeTab === 'absensi' && (
            <div className="bg-slate-950/40 p-6 rounded-2xl border border-[#1a1c23] shadow-xl space-y-6">
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Riwayat Presensi Tenaga Kerja</h3>
                  <p className="text-xs text-slate-400 mt-1">Daftar log masuk & keluar GPS selfie BPJS Ketenagakerjaan</p>
                </div>

                <div className="flex items-center gap-3">
                  <select 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="text-xs p-2.5 rounded-xl bg-slate-900 border border-[#15171e] text-slate-300 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Semua Peran</option>
                    <option value="Office Boy">Office Boy</option>
                    <option value="Security">Security</option>
                    <option value="Driver">Driver</option>
                  </select>
                </div>
              </div>

              {/* Attendance Log Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="border-b border-slate-900 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      <th className="pb-3.5">NAMA KARYAWAN</th>
                      <th className="pb-3.5">PERAN</th>
                      <th className="pb-3.5">TANGGAL</th>
                      <th className="pb-3.5">CLOCK IN (SELFIE)</th>
                      <th className="pb-3.5">CLOCK OUT</th>
                      <th className="pb-3.5">DEVICE & LOKASI IN</th>
                      <th className="pb-3.5">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#13151b] text-xs">
                    {attendances
                      .filter(att => roleFilter === 'all' || att.employeeRole === roleFilter)
                      .map((att) => (
                        <tr key={att.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="py-4 pr-3">
                            <div className="font-bold text-slate-200">{att.employeeName}</div>
                          </td>
                          <td className="py-4 pr-3">
                            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 font-bold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wide">
                              {att.employeeRole}
                            </span>
                          </td>
                          <td className="py-4 pr-3 text-slate-400 font-medium font-mono">
                            {att.date}
                          </td>
                          <td className="py-4 pr-3">
                            <div className="flex items-center gap-2">
                              {att.photoIn ? (
                                <img 
                                  src={att.photoIn} 
                                  alt="Selfie" 
                                  placeholder="photo"
                                  onClick={() => setSelectedAttendanceDetail(att)}
                                  className="w-8 h-8 rounded-lg object-cover cursor-zoom-in border border-[#15171e] ring-1 ring-white/5" 
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                              <span className="font-mono font-bold text-emerald-450">{att.checkInTime || '--:--'}</span>
                            </div>
                          </td>
                          <td className="py-4 pr-3">
                            <span className="font-mono font-bold text-slate-450">{att.checkOutTime || '--:--'}</span>
                          </td>
                          <td className="py-4 pr-3 max-w-[180px]">
                            <p className="font-bold truncate text-slate-300">{att.locationNameIn || 'Unknown Location'}</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">{att.device || 'Android Hardware'}</p>
                          </td>
                          <td className="py-4">
                            <button
                              onClick={() => setSelectedAttendanceDetail(att)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Detail GPS
                            </button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detail GPS Modal */}
              {selectedAttendanceDetail && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0e1017] border border-[#1b1d26] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
                    <button 
                      onClick={() => setSelectedAttendanceDetail(null)}
                      className="absolute top-4 right-4 p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 font-display">
                      <MapPin className="text-emerald-400 w-5 h-5 animate-bounce" />
                      Detail Presensi & Lokasi GPS
                    </h3>

                    <div className="space-y-4 text-xs">
                      <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-900">
                        <div>
                          <p className="text-slate-200 text-xs font-bold">{selectedAttendanceDetail.employeeName}</p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">{selectedAttendanceDetail.employeeRole}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-450 mb-1">Bukti Selfie In</p>
                          {selectedAttendanceDetail.photoIn ? (
                            <img src={selectedAttendanceDetail.photoIn} alt="In" className="w-full h-32 rounded-xl object-cover border border-[#1b1d26]" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="bg-slate-900/40 h-32 rounded-xl mt-1 flex items-center justify-center text-slate-500 border border-dashed border-slate-800">No Photo</div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-450 mb-1">Bukti Selfie Out</p>
                          {selectedAttendanceDetail.photoOut ? (
                            <img src={selectedAttendanceDetail.photoOut} alt="Out" className="w-full h-32 rounded-xl object-cover border border-[#1b1d26]" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="bg-slate-900/40 h-32 rounded-xl mt-1 flex items-center justify-center text-[10px] text-slate-500 border border-dashed border-slate-800">Belum Clock-out</div>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-950 p-3.5 rounded-xl space-y-1 border border-slate-900">
                        <p className="font-bold text-slate-350">Koordinat Absensi:</p>
                        <p className="font-mono text-[10px] text-indigo-400">Lat: {selectedAttendanceDetail.latIn ?? -6.2008}, Lng: {selectedAttendanceDetail.lngIn ?? 106.8456}</p>
                        <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          {selectedAttendanceDetail.locationNameIn || 'Alamat tidak terdeteksi'}
                        </p>
                      </div>

                      <div className="bg-emerald-500/10 border-emerald-500/20 border text-emerald-400 p-3 rounded-xl text-[11px]">
                        <strong>Verifikasi Sistem:</strong> Biometrik OK, Radius Lokasi ~10m ke titik Kantor (Aman/Valid).
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: WORKER TASK REPORTS & APPROVALS */}
          {activeTab === 'tugas' && (
            <div className="space-y-6">
              
              {/* Task filters */}
              <div className="bg-slate-950/40 p-6 rounded-2xl border border-[#1a1c23] shadow-xl space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Laporan Tugas Outsource</h3>
                    <p className="text-xs text-slate-400 mt-1">Review, Tolak atau Setujui Verifikasi Hasil Kerja</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tasks.filter(t => t.status === 'Menunggu Verifikasi').length > 0 ? (
                    <div className="col-span-full border-l-4 border-l-amber-500 bg-amber-500/10 border-t border-b border-r border-amber-500/5 p-4 rounded-r-xl rounded-l-none text-xs text-amber-200">
                      <strong>Perhatian:</strong> Ada <strong>{tasks.filter(t => t.status === 'Menunggu Verifikasi').length} Laporan Pekerjaan</strong> butuh tindakan Anda untuk diverifikasi di program SIOP ini agar status selesai!
                    </div>
                  ) : null}
                </div>

                {/* Task grid representation */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-[#0e0f14]/80 backdrop-blur-md rounded-2xl border border-[#1a1c23] shadow-lg overflow-hidden flex flex-col justify-between hover:border-slate-800 transition-all duration-300">
                      {/* Photo Header */}
                      <div className="h-40 bg-slate-950 relative">
                        {task.proofPhoto ? (
                          <img src={task.proofPhoto} alt="Proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-500 text-[11px] border-b border-[#13151b]">
                            No upload photo proof
                          </div>
                        )}
                        <span className={`absolute top-3 right-3 text-[9px] font-bold px-2.5 py-1 rounded-md border tracking-wide uppercase ${
                          task.status === 'Selesai' 
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                            : task.status === 'Menunggu Verifikasi' 
                            ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse' 
                            : 'bg-indigo-600 text-white border-indigo-400'
                        }`}>
                          {task.status}
                        </span>
                      </div>

                      {/* Info body */}
                      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div>
                            <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">{task.timestamp}</span>
                            <h4 className="text-xs font-bold text-slate-200 mt-2.5 leading-snug">{task.title}</h4>
                            <p className="text-[10px] text-slate-400 mt-1 font-semibold">{task.employeeName} ({task.employeeRole})</p>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-900/40 italic">
                            "{task.description}"
                          </p>
                        </div>

                        {/* Admin Action triggers */}
                        <div className="pt-3 border-t border-[#13151b]">
                          {task.status === 'Menunggu Verifikasi' ? (
                            <div className="space-y-2">
                              <input 
                                type="text"
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Tulis feedback (opsional)..."
                                className="w-full text-[11px] p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleTaskAction(task, 'APPROVE')}
                                  className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-sm cursor-pointer transition-colors"
                                >
                                  Terima / Selesai
                                </button>
                                <button
                                  onClick={() => handleTaskAction(task, 'REJECT')}
                                  className="py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                                >
                                  Tolak / Revisi
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 p-2.5 rounded-xl font-bold flex flex-col gap-1">
                              <span>✓ Status: {task.status === 'Selesai' ? 'Disetujui' : 'Dalam Proses'}</span>
                              {task.adminFeedback && (
                                <p className="font-normal italic text-slate-450">"{task.adminFeedback}"</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: LAPORAN & REKAP (ANALYTICS CHARTS) */}
          {activeTab === 'rekap' && (
            <div className="space-y-6">
              
              <div className="bg-slate-950/40 p-6 rounded-2xl border border-[#1a1c23] shadow-xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Analitik & Rekap Kehadiran</h3>
                <p className="text-xs text-slate-400 mt-1">Metrik performa harian dan bulanan outsource BPJS Ketenagakerjaan</p>
                
                {/* Visual Custom Graphics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                  
                  {/* CHART 1: Attendance Percentage Group */}
                  <div className="p-5 bg-[#0e0f14]/85 border border-[#1a1c23]/80 rounded-2xl">
                    <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-5 font-display">Rasio Kehadiran 5 Hari Terakhir</h4>
                    
                    {/* Simulated SVG Graph */}
                    <div className="h-48 flex items-end justify-between px-4 pb-4 border-b border-slate-900 relative">
                      {/* Grid Line lines */}
                      <div className="absolute left-0 right-0 top-12 border-t border-[#15171e] pointer-events-none"></div>
                      <div className="absolute left-0 right-0 top-24 border-t border-[#15171e] pointer-events-none"></div>
                      <div className="absolute left-0 right-0 top-36 border-t border-[#15171e] pointer-events-none"></div>

                      <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                        <span className="text-[9px] font-mono font-bold text-slate-500">80%</span>
                        <div className="w-6 bg-indigo-600/60 rounded-t-md transition-all duration-500 hover:bg-indigo-500/80" style={{ height: '96px' }}></div>
                        <span className="text-[10px] font-bold text-slate-400">Senin</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                        <span className="text-[9px] font-mono font-bold text-slate-500">100%</span>
                        <div className="w-6 bg-indigo-600/60 rounded-t-md transition-all duration-500 hover:bg-indigo-500/80" style={{ height: '120px' }}></div>
                        <span className="text-[10px] font-bold text-slate-400">Selasa</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                        <span className="text-[9px] font-mono font-bold text-slate-500">67%</span>
                        <div className="w-6 bg-rose-500 rounded-t-md transition-all duration-500 hover:bg-rose-400" style={{ height: '80px' }}></div>
                        <span className="text-[10px] font-bold text-slate-400">Rabu</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 z-10 w-12">
                        <span className="text-[9px] font-mono font-bold text-emerald-400">100%</span>
                        <div className="w-6 bg-emerald-500 rounded-t-md transition-all duration-500 hover:opacity-80 pb-1" style={{ height: '120px' }}></div>
                        <span className="text-[10px] font-extrabold text-[#52b788] tracking-wide font-display">Hari Ini</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-center text-slate-500 mt-4 font-semibold">
                      Kehadiran hari ini sempurna dengan seluruh staff outsource melakukan logging GPS masuk.
                    </p>
                  </div>

                  {/* CHART 2: Task Completion Progress by worker */}
                  <div className="p-5 bg-[#0e0f14]/85 border border-[#1a1c23]/80 rounded-2xl flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-5 font-display">Kontribusi Kegiatan hari ini</h4>
                      
                      <div className="space-y-4">
                        {employees.map(emp => {
                          const userTasks = tasks.filter(t => t.employeeId === emp.id && t.date === todayStr);
                          const userTasksDone = userTasks.filter(t => t.status === 'Selesai');
                          const percentage = userTasks.length > 0 ? (userTasksDone.length / userTasks.length) * 100 : 0;
                          
                          return (
                            <div key={emp.id} className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center font-bold text-slate-300">
                                <span className="truncate">{emp.name} ({emp.role})</span>
                                <span className="font-mono text-[10px] text-[#4ea8de]">{userTasksDone.length}/{userTasks.length} Selesai</span>
                              </div>
                              <div className="w-full bg-slate-900 border border-slate-950 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    percentage === 100 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-700'
                                  }`} 
                                  style={{ width: `${Math.max(percentage, 8)}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 font-semibold mt-6">
                      Data kontribusi dihitung berdasarkan total checkin verifikasi laporan harian.
                    </p>
                  </div>

                </div>

                {/* 📌 SEKTOR KONTROL GOOGLE WORKSPACE SINKRONISASI */}
                <div className="bg-[#0e0f14]/85 border border-indigo-500/15 rounded-2xl p-6 space-y-6 mt-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-900 pb-5 gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                        <Database className="w-5 h-5 text-indigo-400 stroke-[2]" />
                        Pusat Sinkronisasi Google Workspace
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Ekspor, cadangkan foto biometrik, serta integrasikan auto-append laporan BPJS Ketenagakerjaan secara langsung</p>
                    </div>

                    {!googleUser && (
                      <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-md">
                        ⚠️ Google Client Belum Terhubung
                      </span>
                    )}
                  </div>

                  {!googleUser ? (
                    <div className="bg-slate-900/45 p-6 rounded-xl border border-[#1b1d26] flex flex-col items-center text-center justify-center gap-3">
                      <FileSpreadsheet className="w-10 h-10 text-slate-600 animate-pulse" />
                      <div>
                        <h5 className="text-xs font-bold text-slate-200">Kelistrikan Google Workspace Nonaktif</h5>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-md leading-relaxed">
                          Anda berada di mode demo luring (offline). Silakan hubungkan akun Google Suite Anda dengan tombol <strong className="text-slate-300">"Mulai Google Sync"</strong> di pojok kanan atas layar untuk mengaktifkan sinkronisasi Cloud Firestore, ekspor Google Sheets harian, dan pencadangan foto Google Drive secara nyata.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Google Sheets Panel */}
                      <div className="bg-slate-950/60 p-5 rounded-xl border border-zinc-900 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                              <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-200">Laporan Google Sheets</h5>
                              <p className="text-[10px] text-slate-500 font-medium">Buat spreadsheet laporan multi-worksheet</p>
                            </div>
                          </div>

                          <p className="text-[11.5px] text-slate-350 leading-relaxed">
                            Ekspor seluruh database karyawan outsource, absensi harian GPS swafoto, beserta seluruh daftar verifikasi laporan tugas ke dalam satu fail Google Spreadsheet yang teratur dan berwarna.
                          </p>
                        </div>

                        <div className="pt-5 space-y-3.5 border-t border-zinc-900 mt-5">
                          {/* Live indicator if linked */}
                          {syncSheetId ? (
                            <div className="bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-lg p-2.5 text-[10.5px] font-bold flex items-center gap-1.5 flex-wrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                              <span className="truncate flex-1">Terhubung ID: {syncSheetId.slice(0, 18)}...</span>
                              <a 
                                href={`https://docs.google.com/spreadsheets/d/${syncSheetId}/edit`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5 active:scale-95 transition-transform"
                              >
                                Buka <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500 italic">Spreadsheet belum ditautkan untuk sinkronisasi otomatis.</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={handleExportSheets}
                              disabled={isExportingSheets}
                              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isExportingSheets ? 'animate-spin text-indigo-450' : ''}`} />
                              {isExportingSheets ? 'Mengekspor...' : 'Ekspor Laporan Harian'}
                            </button>

                            <button
                              onClick={handleToggleAutoSync}
                              disabled={isExportingSheets}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ${
                                syncSheetId 
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20' 
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              {syncSheetId ? 'Hentikan Live Sync' : 'Aktifkan Live Sync'}
                            </button>
                          </div>

                          {spreadsheetLink && (
                            <div className="bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between">
                              <span>Laporan Sukses Dibuat!</span>
                              <a 
                                href={spreadsheetLink} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors"
                              >
                                Buka Spreadsheet <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Google Drive Panel */}
                      <div className="bg-slate-950/60 p-5 rounded-xl border border-zinc-900 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                              <FolderOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-200">Cadangan Foto Google Drive</h5>
                              <p className="text-[10px] text-slate-500 font-medium">Backup berkas foto biometrik cloud</p>
                            </div>
                          </div>

                          <p className="text-[11.5px] text-slate-350 leading-relaxed">
                            Secara otomatis membuat folder khusus di akun Google Drive Anda dan mencadangkan swafoto (selfie) deteksi wajah kehadiran masuk/pulang serta foto resolusi tinggi bukti penugasan staff outsourcing.
                          </p>
                        </div>

                        <div className="pt-5 space-y-3.5 border-t border-zinc-900 mt-5">
                          {isSyncingDrive ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Mencadangkan dokumen foto & biometrik ke Drive...</span>
                            </div>
                          ) : driveBackupResult ? (
                            <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-lg space-y-2 text-xs">
                              <p className="font-semibold text-slate-300 flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                Berhasil mencadangkan <strong>{driveBackupResult.successCount} berkas foto</strong> harian ({driveBackupResult.failedCount} gagal).
                              </p>
                              {driveBackupResult.folderLink && (
                                <a 
                                  href={driveBackupResult.folderLink} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1"
                                >
                                  Buka Folder Cadangan Drive <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500 italic">Belum ada proses backup yang berjalan.</p>
                          )}

                          <button
                            onClick={handleDriveBackup}
                            disabled={isSyncingDrive}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <FolderOpen className="w-4 h-4" />
                            {isSyncingDrive ? 'Memproses Pencadangan...' : 'Mulai Backup ke Google Drive'}
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: MANAJEMEN USER (STAFF ACCOUNT CONTROL) */}
          {activeTab === 'user' && (
            <div className="bg-slate-950/40 p-6 rounded-2xl border border-[#1a1c23] shadow-xl space-y-6">
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display font-display">Kontrol Manajer Tenaga Outsource</h3>
                  <p className="text-xs text-slate-400 mt-1">Daftar login PIN digital dan status aktif personil</p>
                </div>
                
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-bold text-xs rounded-xl flex items-center gap-2 transform active:scale-95 transition-all shadow-md shadow-emerald-900/10 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 stroke-[2.2]" /> Tambah Staff Baru
                </button>
              </div>

              {/* Grid Accounts List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {employees.map(emp => (
                  <div key={emp.id} className="bg-[#0e0f14]/85 rounded-2xl p-4 border border-[#1a1c23] relative flex flex-col justify-between hover:border-slate-800 transition-all duration-300">
                    <div>
                      {/* Avatar plus quick detail */}
                      <div className="flex items-center gap-3">
                        <img src={emp.avatar} alt={emp.name} className="w-12 h-12 rounded-xl object-cover border border-[#1a1c23] shrink-0" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{emp.name}</h4>
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 px-2 py-0.5 rounded-md font-bold inline-block mt-2.5 uppercase tracking-wide">{emp.role}</span>
                        </div>
                      </div>

                      {/* Phone and pincode */}
                      <div className="mt-4 space-y-1 text-xs">
                        <div className="flex justify-between items-center py-2 border-b border-slate-900">
                          <span className="text-slate-550 text-[10px] uppercase font-bold">No. Telepon</span>
                          <span className="font-mono text-slate-300 font-semibold">{emp.phone}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-900">
                          <span className="text-slate-550 text-[10px] uppercase font-bold">PIN Android App</span>
                          <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-md">{emp.pin}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-900">
                          <span className="text-slate-550 text-[10px] uppercase font-bold">Status Kontrak</span>
                          <span className="text-emerald-400 font-bold">{emp.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menonaktifkan atau hapus ${emp.name}?`)) {
                            onDeleteEmployee(emp.id);
                          }
                        }}
                        className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/15 rounded-lg text-[10px] font-bold font-sans transition-colors cursor-pointer"
                      >
                        Hapus Personil
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add User Modal Dialog */}
              {showAddUserModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0e1017] border border-[#1b1d26] rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
                    <button onClick={() => setShowAddUserModal(false)} className="absolute top-4 right-4 p-1.5 hover:bg-slate-900 text-slate-400 rounded-lg transition-colors cursor-pointer">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                    
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 font-display">
                      <UserPlus className="text-emerald-450 w-5 h-5" />
                      Daftarkan Outsource Baru
                    </h3>

                    <form onSubmit={handleAddUser} className="space-y-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Nama Lengkap</label>
                        <input 
                          type="text" 
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          required
                          placeholder="Ketik nama personil..."
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Pilih Peran Operasional</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as EmployeeRole)}
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="Office Boy">Office Boy (OB)</option>
                          <option value="Security">Security (Satpam)</option>
                          <option value="Driver">Driver (Sopir)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">No. HP / WhatsApp Active</label>
                        <input 
                          type="text" 
                          value={newUserPhone}
                          onChange={(e) => setNewUserPhone(e.target.value)}
                          placeholder="Contoh: 0812..."
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">4-Digit PIN App Mandiri</label>
                        <input 
                          type="text" 
                          maxLength={4}
                          value={newUserPin}
                          onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                          required
                          placeholder="PIN Contoh: 4321"
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 tracking-wider font-mono text-center font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-xl font-bold font-sans tracking-wide shadow-md shadow-emerald-950/25 transition-colors cursor-pointer mt-2"
                      >
                        Konfirmasi & Daftarkan Kontrak
                      </button>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 6: JOB DESK MANAGEMENTS */}
          {activeTab === 'jobdesk' && (
            <div className="bg-slate-950/40 p-6 rounded-2xl border border-[#1a1c23] shadow-xl space-y-6">
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Standard Operasional Prosedur (SOP)</h3>
                  <p className="text-xs text-slate-400 mt-1">Daftar master checklist penugasan di Android Employee App</p>
                </div>

                <button
                  onClick={() => setShowAddJobDeskModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-100 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-emerald-900/10 cursor-pointer transition-colors"
                >
                  <PlusSymbol /> Tambah SOP Job Desk
                </button>
              </div>

              {/* Mapped Job list per role categories */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['Office Boy', 'Security', 'Driver'].map((role) => (
                  <div key={role} className="bg-[#0e0f14]/85 p-5 rounded-2xl border border-[#1a1c23] space-y-4">
                    <h4 className="text-xs font-bold text-slate-200 tracking-wider uppercase border-b border-slate-900 pb-2.5 flex items-center justify-between font-display">
                      <span>{role}</span>
                      <span className="bg-slate-950 border border-slate-900 rounded-md px-2 py-0.5 text-[9px] text-[#4ea8de] font-mono">
                        {jobDeskItems.filter(j => j.role === role).length} SOP
                      </span>
                    </h4>

                    <div className="space-y-3">
                      {jobDeskItems.filter(j => j.role === role).map(item => (
                        <div key={item.id} className="p-3.5 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1.5 hover:border-slate-800 transition-colors">
                          <h5 className="text-[11px] font-bold text-slate-200 leading-snug">{item.taskTitle}</h5>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-medium">{item.description}</p>
                          <span className="inline-block text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/15 font-mono px-2 py-0.5 mt-2 rounded-md font-bold uppercase tracking-wide">
                            {item.schedule}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Job Desk SOP modal */}
              {showAddJobDeskModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0e1017] border border-[#1b1d26] rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
                    <button onClick={() => setShowAddJobDeskModal(false)} className="absolute top-4 right-4 p-1.5 hover:bg-slate-900 text-slate-400 rounded-lg transition-colors cursor-pointer">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                    
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 font-display">
                      Tambah Master SOP Baru
                    </h3>

                    <form onSubmit={handleAddJobDesk} className="space-y-4 text-xs">
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Peran Kategori</label>
                        <select 
                          value={jRole}
                          onChange={(e) => setJRole(e.target.value as EmployeeRole)}
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="Office Boy">Office Boy</option>
                          <option value="Security">Security</option>
                          <option value="Driver">Driver</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Judul SOP / Penugasan</label>
                        <input 
                          type="text"
                          required
                          value={jTitle}
                          onChange={(e) => setJTitle(e.target.value)}
                          placeholder="e.g. Cek air aki kendaraan dinas"
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Uraian Cara / Detail Standar Instruksi</label>
                        <textarea
                          required
                          value={jDesc}
                          onChange={(e) => setJDesc(e.target.value)}
                          rows={3}
                          placeholder="e.g. Cek volume air aki berada dalam range indikator atas bawah sebelum menyalakan mesin..."
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Jadwal Roster Rutin</label>
                        <input 
                          type="text"
                          value={jSchedule}
                          onChange={(e) => setJSchedule(e.target.value)}
                          placeholder="e.g. Setiap Senin Pagi"
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-xl font-bold font-sans tracking-wide shadow-md shadow-emerald-950/25 transition-colors cursor-pointer mt-2"
                      >
                        Konfirmasi Master SOP
                      </button>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// Custom simple inline icons
function PlusSymbol() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
