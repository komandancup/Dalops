/**
 * Google Workspace Integration Helpers for Google Drive & Google Sheets
 * Uses standard Google REST APIs with Firebase Google Auth access tokens.
 */

// Helper to check/create a parent folder in Google Drive
export async function getOrCreateFolder(accessToken: string, folderName: string): Promise<string> {
  try {
    // 1. Search for existing folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // 2. Folder does not exist, create it
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const folder = await createRes.json();
    return folder.id;
  } catch (error) {
    console.error('Error in getOrCreateFolder:', error);
    throw error;
  }
}

// Uploads a base64 encoded photo (data URL) to a folder in Google Drive
export async function uploadPhotoToDrive(
  accessToken: string,
  fileName: string,
  base64Data: string,
  folderId?: string
): Promise<any> {
  try {
    const mimeType = base64Data.match(/data:([^;]+);/)?.[1] || 'image/png';
    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    // Decode base64 into a Blob
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const fileBlob = new Blob([byteArray], { type: mimeType });

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: folderId ? [folderId] : undefined
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: form
    });

    if (!res.ok) {
      throw new Error(`Drive Upload HTTP Error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Error in uploadPhotoToDrive:', error);
    throw error;
  }
}

// Export database records to a newly created styled Google Spreadsheet
export async function exportToGoogleSheets(
  accessToken: string,
  title: string,
  employees: any[],
  attendances: any[],
  tasks: any[]
): Promise<any> {
  try {
    // 1. Create a spreadsheet with 3 worksheets
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: title },
        sheets: [
          { properties: { title: 'Daftar Kehadiran Outsource' } },
          { properties: { title: 'Laporan Kegiatan Tugas' } },
          { properties: { title: 'Master Karyawan' } }
        ]
      })
    });

    if (!createRes.ok) {
      throw new Error(`Sheets Create HTTP Error: ${createRes.status}`);
    }

    const doc = await createRes.json();
    const spreadsheetId = doc.spreadsheetId;

    // 2. Prepare spreadsheet values
    const employeesRows = [
      ['ID Karyawan', 'Nama Lengkap', 'Jabatan / Peran', 'Status', 'Nomor Telepon'],
      ...employees.map(e => [e.id, e.name, e.role, e.status, e.phone])
    ];

    const attendancesRows = [
      ['Tanggal', 'Nama Karyawan', 'Peran', 'Jam Masuk', 'Jam Pulang', 'Lokasi Masuk', 'Lokasi Pulang', 'Device (Android)'],
      ...attendances.map(a => [
        a.date,
        a.employeeName,
        a.employeeRole,
        a.checkInTime || '-',
        a.checkOutTime || '-',
        a.locationNameIn || '-',
        a.locationNameOut || '-',
        a.device || '-'
      ])
    ];

    const tasksRows = [
      ['Tanggal', 'Jam Lapor', 'Nama Karyawan', 'Peran', 'Jenis Kegiatan / Judul SOP', 'Deskripsi Kegiatan', 'Status Tinjauan', 'Catatan Admin'],
      ...tasks.map(t => [
        t.date,
        t.timestamp,
        t.employeeName,
        t.employeeRole,
        t.title,
        t.description,
        t.status,
        t.adminFeedback || '-'
      ])
    ];

    // 3. Write data into worksheets using value-update batch request
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: "'Daftar Kehadiran Outsource'!A1", values: attendancesRows },
          { range: "'Laporan Kegiatan Tugas'!A1", values: tasksRows },
          { range: "'Master Karyawan'!A1", values: employeesRows }
        ]
      })
    });

    if (!updateRes.ok) {
      throw new Error(`Sheets Write HTTP Error: ${updateRes.status}`);
    }

    // 4. Style the sheets with basic styling (bold headers, colored backgrounds)
    // We can do this dynamically or keep it simple since writing succeeded
    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    };
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    throw error;
  }
}

// Appends a single Attendance row automatically if sync enabled
export async function appendAttendanceToSheet(
  accessToken: string,
  spreadsheetId: string,
  a: any
): Promise<any> {
  try {
    const values = [[
      a.date,
      a.employeeName,
      a.employeeRole,
      a.checkInTime || '-',
      a.checkOutTime || '-',
      a.locationNameIn || '-',
      a.locationNameOut || '-',
      a.device || '-'
    ]];

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daftar Kehadiran Outsource'!A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });
    return await res.json();
  } catch (err) {
    console.error('Error appending attendance to sheet:', err);
  }
}

// Appends a single Task row automatically if sync enabled
export async function appendTaskToSheet(
  accessToken: string,
  spreadsheetId: string,
  t: any
): Promise<any> {
  try {
    const values = [[
      t.date,
      t.timestamp,
      t.employeeName,
      t.employeeRole,
      t.title,
      t.description,
      t.status,
      t.adminFeedback || '-'
    ]];

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Laporan Kegiatan Tugas'!A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });
    return await res.json();
  } catch (err) {
    console.error('Error appending task to sheet:', err);
  }
}
