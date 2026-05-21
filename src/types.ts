/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EmployeeRole = 'Office Boy' | 'Security' | 'Driver' | 'Supervisor';

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  status: 'Aktif' | 'Nonaktif';
  avatar: string;
  phone: string;
  pin: string;
}

export type TaskStatus = 'Proses' | 'Menunggu Verifikasi' | 'Selesai';

export interface Task {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: EmployeeRole;
  title: string;
  description: string;
  status: TaskStatus;
  timestamp: string; // HH:MM or ISO
  date: string; // YYYY-MM-DD
  proofPhoto?: string;
  adminFeedback?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: EmployeeRole;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:MM
  checkOutTime?: string; // HH:MM
  photoIn?: string;
  photoOut?: string;
  latIn?: number;
  lngIn?: number;
  latOut?: number;
  lngOut?: number;
  locationNameIn?: string;
  locationNameOut?: string;
  device?: string;
}

export interface JobDeskItem {
  id: string;
  role: EmployeeRole;
  taskTitle: string;
  description: string;
  schedule: string;
}
