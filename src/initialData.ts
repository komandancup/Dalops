/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, Task, Attendance, JobDeskItem } from './types';

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: 'Chandra Permana',
    role: 'Office Boy',
    status: 'Aktif',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=260',
    phone: '081234567890',
    pin: '1234'
  },
  {
    id: 'emp-2',
    name: 'Dwi Prasetyo',
    role: 'Security',
    status: 'Aktif',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=260',
    phone: '081298765432',
    pin: '2345'
  },
  {
    id: 'emp-3',
    name: 'Eko Kurniawan',
    role: 'Driver',
    status: 'Aktif',
    avatar: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&q=80&w=260',
    phone: '085712345678',
    pin: '3456'
  }
];

export const INITIAL_ATTENDANCE: Attendance[] = [
  {
    id: 'att-1',
    employeeId: 'emp-1',
    employeeName: 'Chandra Permana',
    employeeRole: 'Office Boy',
    date: '2026-05-21',
    checkInTime: '07:45',
    checkOutTime: '16:00',
    locationNameIn: 'Kantor Cabang BPJS Ketenagakerjaan',
    locationNameOut: 'Kantor Cabang BPJS Ketenagakerjaan',
    latIn: -6.2008,
    lngIn: 106.8456,
    latOut: -6.2008,
    lngOut: 106.8456,
    device: 'Samsung Galaxy A54 (Android 14)'
  },
  {
    id: 'att-2',
    employeeId: 'emp-2',
    employeeName: 'Dwi Prasetyo',
    employeeRole: 'Security',
    date: '2026-05-21',
    checkInTime: '06:00',
    locationNameIn: 'Pos Keamanan Pintu Masuk',
    latIn: -6.2009,
    lngIn: 106.8455,
    device: 'Xiaomi Redmi Note 12 (Android 13)'
  },
  {
    id: 'att-3',
    employeeId: 'emp-3',
    employeeName: 'Eko Kurniawan',
    employeeRole: 'Driver',
    date: '2026-05-21',
    checkInTime: '07:30',
    locationNameIn: 'Lobby Utama Gedung',
    latIn: -6.2008,
    lngIn: 106.8456,
    device: 'Infinix Hot 30 (Android 13)'
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    employeeId: 'emp-1',
    employeeName: 'Chandra Permana',
    employeeRole: 'Office Boy',
    title: 'Kebersihan Ruang Kantor',
    description: 'Menyapu dan mengepel lantai seluruh ruangan lantai 1 dan 2.',
    status: 'Selesai',
    timestamp: '08:30',
    date: '2026-05-21'
  },
  {
    id: 'task-2',
    employeeId: 'emp-2',
    employeeName: 'Dwi Prasetyo',
    employeeRole: 'Security',
    title: 'Patroli Keliling',
    description: 'Patroli area parkir dan pintu masuk utama, tidak ada kejadian mencurigakan.',
    status: 'Selesai',
    timestamp: '09:00',
    date: '2026-05-21'
  },
  {
    id: 'task-3',
    employeeId: 'emp-3',
    employeeName: 'Eko Kurniawan',
    employeeRole: 'Driver',
    title: 'Pengantaran Kepala Cabang',
    description: 'Mengantar Kepala Cabang ke Kantor BPJS Area.',
    status: 'Selesai',
    timestamp: '07:45',
    date: '2026-05-21'
  },
  {
    id: 'task-4',
    employeeId: 'emp-1',
    employeeName: 'Chandra Permana',
    employeeRole: 'Office Boy',
    title: 'Fasilitas Ruang Rapat',
    description: 'Menyiapkan ruang rapat lantai 3 untuk 15 peserta.',
    status: 'Proses',
    timestamp: '11:00',
    date: '2026-05-21'
  },
  // Adding pending tasks to match "Menunggu Verifikasi"
  {
    id: 'task-5',
    employeeId: 'emp-2',
    employeeName: 'Dwi Prasetyo',
    employeeRole: 'Security',
    title: 'Pemeriksaan CCTV & Pos Jaga',
    description: 'Memastikan semua layar monitor CCTV berfungsi normal dan merekam.',
    status: 'Menunggu Verifikasi',
    timestamp: '13:15',
    date: '2026-05-21',
    proofPhoto: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'task-6',
    employeeId: 'emp-1',
    employeeName: 'Chandra Permana',
    employeeRole: 'Office Boy',
    title: 'Pembersihan Kaca Lobby',
    description: 'Membersihkan noda jari tangan dan debu pada pintu kaca lobby luar-dalam.',
    status: 'Menunggu Verifikasi',
    timestamp: '14:00',
    date: '2026-05-21',
    proofPhoto: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'task-7',
    employeeId: 'emp-3',
    employeeName: 'Eko Kurniawan',
    employeeRole: 'Driver',
    title: 'Servis Rutin Ambulans / Mobil Dinas',
    description: 'Membawa kendaraan dinas ke bengkel resmi untuk penggantian oli rutin.',
    status: 'Menunggu Verifikasi',
    timestamp: '14:30',
    date: '2026-05-21',
    proofPhoto: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=400'
  }
];

export const INITIAL_JOBDESC: JobDeskItem[] = [
  {
    id: 'jd-1',
    role: 'Office Boy',
    taskTitle: 'Kebersihan Ruang Kerja',
    description: 'Menyapu, mengepel, membersihkan meja, membuang sampah, dan menyemprot disinfektan.',
    schedule: 'Setiap Hari, Pukul 07:00 & 16:30'
  },
  {
    id: 'jd-2',
    role: 'Office Boy',
    taskTitle: 'Fasilitas Ruang Rapat',
    description: 'Menyiapkan meja-kursi, air minum, kabel HDMI/proyektor, dan merapikan kembali setelah digunakan.',
    schedule: 'Sesuai Request Jadwal Rapat'
  },
  {
    id: 'jd-3',
    role: 'Office Boy',
    taskTitle: 'Pengadaan Pantry',
    description: 'Penyediaan minuman teh/kopi direksi, memastikan stok logistik dapur terisi penuh.',
    schedule: 'Stand-by sepanjang jam kerja'
  },
  {
    id: 'jd-4',
    role: 'Security',
    taskTitle: 'Patroli Lingkungan',
    description: 'Keliling gedung (halaman depan, belakang, parkir, dan area genset) setiap 2 jam secara bergantian.',
    schedule: 'Setiap 2 Jam sekali'
  },
  {
    id: 'jd-5',
    role: 'Security',
    taskTitle: 'Pemeriksaan Portal & Buku Tamu',
    description: 'Memastikan semua kendaraan tamu tercatat, memeriksa identitas tamu, dan menyerahkan ID Visitor.',
    schedule: 'Stand-by Pos Jaga'
  },
  {
    id: 'jd-6',
    role: 'Security',
    taskTitle: 'Pelaporan CCTV',
    description: 'Memantau instrumen perekam kamera CCTV 16-channel, melaporkan anomali kelistrikan.',
    schedule: 'Jam Operasional Kantor'
  },
  {
    id: 'jd-7',
    role: 'Driver',
    taskTitle: 'Pengantaran Dinas Kepala Cabang',
    description: 'Mengantarkan Kepala Cabang atau Deputi Direktur ke agenda rapat di regional atau instansi mitra.',
    schedule: 'Sesuai Instruksi Agenda'
  },
  {
    id: 'jd-8',
    role: 'Driver',
    taskTitle: 'Pemeliharaan Kendaraan',
    description: 'Mencuci eksterior/interior mobil, cek tekanan ban, air aki, jadwal pergantian oli, dan isi bensin berkala.',
    schedule: 'Setiap Pagi sebelum jalan'
  },
  {
    id: 'jd-9',
    role: 'Driver',
    taskTitle: 'Logistik Dokumen Penting',
    description: 'Mengirimkan dokumen fisik penting, MOU, atau jaminan ke BPJS Pusat atau instansi keuangan terkait.',
    schedule: 'Kondisional sesuai penugasan'
  }
];
