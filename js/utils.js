'use strict';

// ─── NobleMInds Utilities ─────────────────────────────────────────────────────

/** Get today's date in YYYY-MM-DD format */
function nmToday() {
  return new Date().toISOString().split('T')[0];
}

/** Calculate age from DOB string */
function nmCalcAge(dob) {
  if (!dob) return '';
  const today = new Date(), birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Format date to Indian locale */
function nmFmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Convert file to Base64 */
function nmToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Parse CSV text into array of objects */
function nmParseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {});
  });
}

/** Download array of objects as Excel (.xlsx) */
function nmExportExcel(data, filename) {
  if (!data || !data.length) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
}

/** Download array of objects as CSV (using SheetJS for better escaping) */
function nmExportCSV(data, filename) {
  if (!data || !data.length) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click(); URL.revokeObjectURL(url);
}

/** Show a toast notification */
function nmToast(message, type = 'success') {
  let container = document.getElementById('nm-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'nm-toast-container';
    container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  toast.className = `nm-toast nm-toast-${type}`;
  toast.innerHTML = `<span class="nm-toast-icon">${icons[type] || '•'}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('nm-toast-show'));
  setTimeout(() => {
    toast.classList.remove('nm-toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/** Validate Indian phone number */
function nmValidPhone(p) { return /^[6-9]\d{9}$/.test(p); }
/** Validate Aadhar (12 digits) */
function nmValidAadhar(a) { return /^\d{12}$/.test(a); }
/** Validate email */
function nmValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/** Generate Excel template for bulk import */
function nmDownloadTemplate() {
  const headers = [
    'admissionNumber','fullName','class','section','house','dob','gender',
    'religion','caste','address','phone','email','aadhar','apaarNumber','pen',
    'fatherName','fatherQualification','fatherOccupation','fatherPhone',
    'motherName','motherQualification','motherOccupation','motherPhone',
    'medicalHistory','ncc','nss','sgfi','scouts'
  ];
  const sample = {
    admissionNumber: 'SCH/2024/001', fullName: 'Ravi Kumar', class: '9', section: 'A', house: 'Blue', dob: '2010-05-15', gender: 'Male',
    religion: 'Hindu', caste: 'OC', address: '123 Main St, City', phone: '9876543210', email: 'ravi@email.com', aadhar: '123456789012', 
    apaarNumber: 'APAAR001', pen: 'PEN001', fatherName: 'Suresh Kumar', fatherQualification: 'Graduate', fatherOccupation: 'Business',
    fatherPhone: '9876543211', motherName: 'Sunita Devi', motherQualification: 'Graduate', motherOccupation: 'Homemaker',
    motherPhone: '9876543212', medicalHistory: 'None', ncc: 'Yes', nss: 'No', sgfi: 'No', scouts: 'Yes'
  };
  
  const worksheet = XLSX.utils.json_to_sheet([sample], { header: headers });
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  XLSX.writeFile(workbook, 'NobleMinds_Import_Template.xlsx');
}

/** Confirm dialog promise */
function nmConfirm(msg, okText = 'Delete', okClass = 'btn-danger') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'nm-confirm-overlay';
    overlay.innerHTML = `
      <div class="nm-confirm-box">
        <div class="nm-confirm-icon">⚠</div>
        <p class="nm-confirm-msg">${msg}</p>
        <div class="nm-confirm-btns">
          <button class="btn btn-ghost" id="nm-cancel-btn">Cancel</button>
          <button class="btn ${okClass}" id="nm-ok-btn">${okText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('nm-ok-btn').onclick = () => { overlay.remove(); resolve(true); };
    document.getElementById('nm-cancel-btn').onclick = () => { overlay.remove(); resolve(false); };
  });
}

/** Debounce function */
function nmDebounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Simple throttle function */
function nmThrottle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      fn(...args);
      last = now;
    }
  };
}

/** Theme Initialization & Toggle */
function nmInitTheme() {
  const theme = localStorage.getItem('nm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const toggles = document.querySelectorAll('.theme-toggle-cb');
  toggles.forEach(t => t.checked = (theme === 'dark'));
}

function nmToggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('nm_theme', newTheme);
  const toggles = document.querySelectorAll('.theme-toggle-cb');
  toggles.forEach(t => t.checked = (newTheme === 'dark'));
}

// Apply theme immediately on load
if (typeof document !== 'undefined') {
  nmInitTheme();
}
