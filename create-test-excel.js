/* 
  create-test-excel.js
  Run with: node create-test-excel.js
  Creates a test .xlsx file matching the PRD structure
  Requires: npm install xlsx
*/

const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();

// ===== Sheet 1: Witel Singaraja Kantor TIF =====
const data1 = [
  ['', '', '', '', '', '', '', '', '', 'EVIDENT FOTO KOORDINAT & TIMESTAMP'],
  ['PEKERJAAN', 'AKTIVITAS', 'OBYEK PEKERJAAN', 'KELAS 1', 'KELAS 2', 'KELAS 3', 'KELAS 4', 'KELAS 5', '', '1', '2', '3', '4', '5'],
  ['Housekeeping', 'Pembersihan dinding', 'Dinding', '2 x sebulan', '2 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '', '', '', '', '', ''],
  ['', 'Pembersihan lantai', 'Lantai', '5 x seminggu', '5 x seminggu', '3 x seminggu', '3 x seminggu', '2 x seminggu', '', '', '', '', '', ''],
  ['', 'Pembersihan kaca jendela', 'Kaca Jendela', '1 x seminggu', '1 x seminggu', '1 x seminggu', '1 x 2 minggu', '1 x sebulan', '', '', '', '', '', ''],
  ['', 'Pembersihan AC', 'AC Split', '1 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '', '', '', '', '', ''],
  ['', 'Pembersihan toilet', 'Toilet', '5 x seminggu', '5 x seminggu', '5 x seminggu', '5 x seminggu', '5 x seminggu', '', '', '', '', '', ''],
  ['Landscaping', 'Pemotongan rumput', 'Taman', '2 x sebulan', '2 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '', '', '', '', '', ''],
  ['', 'Penyiraman tanaman', 'Taman', '5 x seminggu', '5 x seminggu', '3 x seminggu', '3 x seminggu', '2 x seminggu', '', '', '', '', '', ''],
  ['', 'Pemangkasan pohon', 'Pohon', '1 x sebulan', '1 x sebulan', '1 x 2 bulan', '1 x 2 bulan', '1 x 3 bulan', '', '', '', '', '', ''],
  ['Pest Control', 'Penyemprotan serangga', 'Seluruh area', '1 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '', '', '', '', '', ''],
  ['', 'Pemasangan perangkap tikus', 'Gudang', '1 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '1 x sebulan', '', '', '', '', '', ''],
];

const ws1 = XLSX.utils.aoa_to_sheet(data1);
// Set merges for PEKERJAAN column
ws1['!merges'] = [
  { s: { r: 2, c: 0 }, e: { r: 6, c: 0 } },  // Housekeeping
  { s: { r: 7, c: 0 }, e: { r: 9, c: 0 } },  // Landscaping
  { s: { r: 10, c: 0 }, e: { r: 11, c: 0 } }, // Pest Control
  { s: { r: 0, c: 9 }, e: { r: 0, c: 13 } },  // EVIDENT header merge
];
XLSX.utils.book_append_sheet(wb, ws1, '1. Witel Singaraja Kantor TIF');


// ===== Sheet 2: Ruang IOC (fewer KELAS columns) =====
const data2 = [
  ['', '', '', '', 'EVIDENT FOTO KOORDINAT & TIMESTAMP'],
  ['PEKERJAAN', 'AKTIVITAS', 'OBYEK PEKERJAAN', 'KELAS 5', '1', '2', '3'],
  ['Housekeeping', 'Pembersihan meja kerja', 'Meja', '5 x seminggu', '', '', ''],
  ['', 'Pembersihan monitor & keyboard', 'Perangkat IT', '5 x seminggu', '', '', ''],
  ['', 'Pembersihan lantai raised floor', 'Raised Floor', '2 x seminggu', '', '', ''],
  ['', 'Pembersihan karpet', 'Karpet', '1 x seminggu', '', '', ''],
  ['', 'Pembersihan panel kaca', 'Panel Kaca', '1 x seminggu', '', '', ''],
  ['Sanitasi', 'Disinfeksi permukaan', 'Handle Pintu', '5 x seminggu', '', '', ''],
  ['', 'Pembersihan dispenser', 'Dispenser', '5 x seminggu', '', '', ''],
];

const ws2 = XLSX.utils.aoa_to_sheet(data2);
ws2['!merges'] = [
  { s: { r: 2, c: 0 }, e: { r: 6, c: 0 } },
  { s: { r: 7, c: 0 }, e: { r: 8, c: 0 } },
  { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } },
];
XLSX.utils.book_append_sheet(wb, ws2, '2. Ruang IOC');


// ===== Sheet 3: Area Bali =====
const data3 = [
  ['', '', '', '', '', '', 'EVIDENT FOTO KOORDINAT & TIMESTAMP'],
  ['PEKERJAAN', 'AKTIVITAS', 'OBYEK PEKERJAAN', 'KELAS 1', 'KELAS 2', 'KELAS 3', '1', '2', '3', '4'],
  ['Housekeeping', 'Sweeping & mopping lantai', 'Lantai Granit', '5 x seminggu', '5 x seminggu', '3 x seminggu', '', '', '', ''],
  ['', 'Polishing lantai', 'Lantai Marmer', '1 x sebulan', '1 x sebulan', '1 x 2 bulan', '', '', '', ''],
  ['', 'Pembersihan lift', 'Lift Penumpang', '5 x seminggu', '5 x seminggu', '5 x seminggu', '', '', '', ''],
  ['', 'Pembersihan eskalator', 'Eskalator', '5 x seminggu', '5 x seminggu', '5 x seminggu', '', '', '', ''],
  ['MEP Support', 'Pengecekan lampu', 'Lampu Koridor', '5 x seminggu', '5 x seminggu', '5 x seminggu', '', '', '', ''],
  ['', 'Pembersihan panel listrik', 'Panel Listrik', '1 x sebulan', '1 x sebulan', '1 x sebulan', '', '', '', ''],
];

const ws3 = XLSX.utils.aoa_to_sheet(data3);
ws3['!merges'] = [
  { s: { r: 2, c: 0 }, e: { r: 5, c: 0 } },
  { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } },
  { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
];
XLSX.utils.book_append_sheet(wb, ws3, '3. Area Bali');


// Write file
XLSX.writeFile(wb, 'Test_Checklist_Housekeeping.xlsx');
console.log('✅ Test file created: Test_Checklist_Housekeeping.xlsx');
