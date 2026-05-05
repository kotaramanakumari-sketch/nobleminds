/* ── NobleMinds Students Module ────────────────────────────────────────────────── */
'use strict';

async function renderStudents() {
  const q  = (document.getElementById('std-search')?.value||'').toLowerCase();
  const fc = document.getElementById('f-class')?.value||'';
  const fs = document.getElementById('f-section')?.value||'';
  const fg = document.getElementById('f-gender')?.value||'';
  
  let list = await nmGetStudents(schoolId, currentYearId);
  const totalCount = list.length;
  
  if (q)  list = list.filter(s=>(s.full_name||s.fullName||'').toLowerCase().includes(q)||(s.admission_number||s.admissionNumber||'').toLowerCase().includes(q));
  if (fc) list = list.filter(s=>s.class===fc);
  if (fs) list = list.filter(s=>s.section===fs);
  if (fg) list = list.filter(s=>s.gender===fg);
  
  document.getElementById('nb-count').textContent = totalCount;
  const tbody = document.getElementById('std-tbody');
  const empty = document.getElementById('std-empty');
  
  if (!list.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(s => {
    const nameEsc = nmEscapeHTML(s.full_name || s.fullName || '—');
    const admEsc = nmEscapeHTML(s.admission_number || s.admissionNumber || '');
    return `<tr>
    <td data-label="Student"><div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="viewStudent('${s.id}')">${s.photo?`<img src="${s.photo}" style="width:34px;height:34px;border-radius:8px;object-fit:cover;">`:`<div class="avatar" style="width:34px;height:34px;font-size:0.75rem;">${(s.full_name||s.fullName||'?')[0]}</div>`}<div><div style="font-weight:600;color:var(--clr-primary);">${nameEsc}</div><div style="font-size:0.72rem;color:var(--clr-text-2);">${admEsc}</div></div></div></td>
    <td data-label="Class"><span class="badge badge-purple">Class ${s.class||'?'}</span></td>
    <td data-label="Section">${s.section||'—'}</td>
    <td data-label="House"><span class="badge badge-gray">${s.house||'—'}</span></td>
    <td data-label="Phone">${s.phone||'—'}</td>
    <td data-label="Actions"><div style="display:flex;gap:4px;">
      <button class="btn btn-ghost btn-sm" onclick="editStudent('${s.id}')" title="Edit">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteStudentRow('${s.id}')" title="Delete">🗑 Delete</button>
    </div></td>
  </tr>`; }).join('');
}

function exportStudents() {
  nmGetStudents(schoolId, currentYearId).then(list => {
    if (!list.length) { nmToast('No students to export','info'); return; }
    const safe = list.map(s => { const c={...s}; delete c.photo; delete c.fatherPhoto; delete c.motherPhoto; return c; });
    nmExportExcel(safe, `students_${schoolId}.xlsx`);
    nmToast('Exported successfully!','success');
  });
}

// ── Student Promotion ──────────────────────────────────────────────────────────
async function openPromotionModal() {
  const currentList = await getFilteredStudentList();
  if (!currentList.length) return nmToast('No students matching current filters to promote','error');
  
  const years = allYears.filter(y => y.id !== currentYearId);
  if (!years.length) return nmToast('Please create a target Academic Year first in Settings.', 'info');

  const sel = document.getElementById('p-target-year');
  sel.innerHTML = '<option value="">— Select Target Year —</option>' + years.map(y => `<option value="${y.id}">${y.name}</option>`).join('');
  
  document.getElementById('p-selection-info').textContent = `Promoting ${currentList.length} students from the current filtered list.`;
  openModal('promotion-modal');
}

async function getFilteredStudentList() {
  const q  = (document.getElementById('std-search')?.value||'').toLowerCase();
  const fc = document.getElementById('f-class')?.value||'';
  const fs = document.getElementById('f-section')?.value||'';
  const fg = document.getElementById('f-gender')?.value||'';
  
  let list = await nmGetStudents(schoolId, currentYearId);
  if (q)  list = list.filter(s=>(s.full_name||s.fullName||'').toLowerCase().includes(q)||(s.admission_number||s.admissionNumber||'').toLowerCase().includes(q));
  if (fc) list = list.filter(s=>s.class===fc);
  if (fs) list = list.filter(s=>s.section===fs);
  if (fg) list = list.filter(s=>s.gender===fg);
  return list;
}

async function confirmPromotion() {
  const targetYearId = document.getElementById('p-target-year').value;
  if (!targetYearId) return nmToast('Please select a target year','error');
  
  const list = await getFilteredStudentList();
  const msg = `Are you sure? You are about to clone ${list.length} students to the new year. Their classes will be incremented automatically (e.g. 4 -> 5).`;
  
  if (await nmConfirm(msg)) {
    const btn = document.getElementById('p-btn');
    btn.disabled = true; btn.textContent = 'Processing Promotion...';
    
    try {
      const ids = list.map(s => s.id);
      await nmPromoteStudents(ids, targetYearId);
      closeModal('promotion-modal');
      nmToast(`Successfully promoted ${list.length} students!`,'success');
      await renderStudents();
    } catch(e) {
      nmToast('Promotion failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Confirm Promotion (Clone)';
    }
  }
}

// ── View Student ──────────────────────────────────────────────────────────────
async function viewStudent(id) {
  const students = await nmGetStudents(schoolId);
  const s = students.find(x => x.id === id);
  if (!s) return;
  
  currentStudentId = id;
  const act = [s.ncc&&'NCC',s.nss&&'NSS',s.sgfi&&'SGFI',s.scouts&&'Scouts & Guides'].filter(Boolean);
  const history = await nmGetStudentHistory(id);

  const nameEsc = nmEscapeHTML(s.full_name || s.fullName || '—');
  const admEsc = nmEscapeHTML(s.admission_number || s.admissionNumber || '');
  const addrEsc = nmEscapeHTML(s.address || '—');
  const fNameEsc = nmEscapeHTML(s.father_name || s.fatherName || '—');
  const mNameEsc = nmEscapeHTML(s.mother_name || s.motherName || '—');

  document.getElementById('student-modal-body').innerHTML = `
    <div class="profile-header">
      <div class="profile-photo">${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`:'<span style="font-size:2.5rem;">👤</span>'}</div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 16px;">
          <div>
            <div class="profile-name">${nameEsc}</div>
            <div style="color:var(--clr-text-2);font-size:0.88rem;">${admEsc} · ID: ${s.id.slice(0,8)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="nmPreparePrintProfile('${id}')" style="white-space:nowrap;">🖨 Print</button>
        </div>
        <div class="profile-meta">
          <span class="badge badge-purple">Class ${s.class||'?'} - ${s.section||'?'}</span>
          <span class="badge badge-gray">${s.house||'—'} House</span>
          <span class="badge ${s.gender==='Male'?'badge-blue':'badge-pink'}">${s.gender||'—'}</span>
          ${act.map(a=>`<span class="badge badge-green">${a}</span>`).join('')}
        </div>
      </div>
      <div class="profile-actions">
        <div class="profile-actions-btns">
          <button class="btn btn-primary btn-sm" onclick="quickAddObservation('${id}')">👁‍🗨 Obs</button>
          <button class="btn btn-primary btn-sm" onclick="quickAddCounselling('${id}')">🤝 Cns</button>
          <button class="btn btn-primary btn-sm" onclick="quickAddMovement('${id}')">🏃 Mov</button>
        </div>
        <div style="font-size:0.7rem; color:var(--clr-text-3); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Quick Actions</div>
      </div>
    </div>
    
    <div class="profile-grid">
      <div>
        <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">📋 Profile Information</h4>
        <div class="info-grid mb-16">
          ${iI('DOB',nmFmtDate(s.dob))}${iI('Age',s.dob?nmCalcAge(s.dob)+' years' : (s.age ? s.age + ' years' : '—'))}
          ${iI('Religion',s.religion)}${iI('Caste',s.caste)}
          ${iI('Phone',s.phone)}${iI('Email',s.email)}
        </div>
        <h4 style="margin-bottom:12px;">🏠 Address</h4>
        <div style="padding:12px 16px;background:var(--clr-surface);border-radius:var(--radius-sm);border:1px solid var(--clr-border);margin-bottom:16px;color:var(--clr-text-2);font-size:0.88rem;">${addrEsc}</div>
        <h4 style="margin-bottom:12px;">📁 Identity Documents</h4>
        <div class="info-grid mb-16">${iI('Aadhar',s.aadhar)}${iI('APAAR',s.apaar_number||s.apaarNumber||'—')}${iI('PEN',s.pen)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div><h4 style="margin-bottom:10px;">👨 Father</h4><div class="info-grid" style="grid-template-columns:1fr;">${iI('Name',fNameEsc)}${iI('Phone',s.father_phone||s.fatherPhone)}</div></div>
          <div><h4 style="margin-bottom:10px;">👩 Mother</h4><div class="info-grid" style="grid-template-columns:1fr;">${iI('Name',mNameEsc)}${iI('Phone',s.mother_phone||s.motherPhone)}</div></div>
        </div>
        <h4 style="margin-bottom:12px;">🏥 Medical History</h4>
        <div style="padding:12px 16px;background:var(--clr-surface);border-radius:var(--radius-sm);border:1px solid var(--clr-border);color:var(--clr-text-2);font-size:0.88rem;">${nmEscapeHTML(s.medical_history||s.medicalHistory||'None recorded')}</div>
      </div>
      
      <div>
        <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">📜 History Timeline</h4>
        <div class="timeline">
          ${!history.length ? '<div class="empty-state" style="padding:24px;"><p>No records found.</p></div>' : 
            history.map(h => {
              let icon = '👁', title = h.type === 'observation' ? 'Observation' : h.issue || 'History', body = h.type === 'observation' ? h.observation : h.counselling || h.reason || '';
              let footer = '';
              if (h.type === 'counselling') {
                icon = '🤝'; 
                footer = `<div class="timeline-footer"><span class="status-badge ${h.follow_up||h.followUp ? 'status-followup' : 'status-resolved'}">${h.follow_up||h.followUp ? 'Follow-up' : h.status}</span></div>`;
              } else if (h.type === 'movement') {
                icon = '🏃'; title = `Movement: ${h.reason}`;
                body = `<strong>Leaving:</strong> ${nmFmtDate(h.leave_date||h.leaveDate)} · <strong>Return:</strong> ${nmFmtDate(h.report_date||h.reportDate)}<br><strong>Outgoing Escort:</strong> ${h.escort_name||h.escortName} (${h.relationship})`;
                if (h.report_date || h.reportDate) {
                  body += `<br><strong>Incoming Escort:</strong> ${h.return_escort_name || h.returnEscortName || '—'} (${h.return_relationship || h.returnRelationship || '—'})`;
                }
              }
              const titleEsc = nmEscapeHTML(title);
              const bodyEsc = nmEscapeHTML(body);
              return `
                <div class="timeline-item ${h.type}">
                  <div class="timeline-dot">${icon}</div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="timeline-title">${titleEsc}</span>
                      <span class="timeline-date">${nmFmtDate(h.date)}</span>
                    </div>
                    <div class="timeline-body">${bodyEsc}</div>
                    ${footer}
                  </div>
                  <div class="timeline-actions" style="opacity:0; transition:opacity 0.2s;">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteTimelineRecord('${h.type}', '${h.id}')" title="Delete" style="color:var(--clr-danger);">🗑</button>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
      </div>
    </div>`;
  document.getElementById('modal-delete-btn').onclick = () => deleteStudentRow(id, true);
  openModal('student-modal');
}
function iI(k,v){return`<div class="info-item"><div class="key">${k}</div><div class="val">${v||'—'}</div></div>`;}

// ── Quick Actions from Profile ────────────────────────────────────────────────
async function quickAddObservation(id) {
  closeModal('student-modal');
  await openObservationModal();
  handleStudentSelect('o', id, true);
}
async function quickAddCounselling(id) {
  closeModal('student-modal');
  await openCounsellingModal();
  handleStudentSelect('c', id, false);
}
async function quickAddMovement(id) {
  closeModal('student-modal');
  await openMovementModal();
  handleStudentSelect('m', id, false);
}

async function deleteStudentRow(id, fromModal) {
  const ok = await nmConfirm('Delete this student record permanently?');
  if (!ok) return;
  await nmDeleteStudent(id);
  if (fromModal) closeModal('student-modal');
  await renderStudents(); 
  await renderDashboard();
  nmToast('Student deleted.','info');
}

// ── 5-Step Form ───────────────────────────────────────────────────────────────
let editingId = null, photoB64 = '', fatherPhotoB64 = '', motherPhotoB64 = '';

function resetForm() {
  editingId = null; photoB64 = ''; fatherPhotoB64 = ''; motherPhotoB64 = '';
  document.getElementById('form-title').textContent = '➕ Add New Student';
  ['f-adm','f-name','f-address','f-phone','f-email','f-aadhar','f-apaar','f-pen',
   'f-fname','f-fqual','f-focc','f-fphone','f-mname','f-mqual','f-mocc','f-mphone','f-medical',
   'f-dob','f-age'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  ['f-class-val','f-section-val','f-house','f-religion','f-caste'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.querySelectorAll('input[name="gender"]').forEach(r=>r.checked=false);
  ['f-ncc','f-nss','f-sgfi','f-scouts'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=false; });
  resetPhotoBox('sp-preview','Upload Photo');
  resetPhotoBox('fp-preview','Upload Photo');
  resetPhotoBox('mp-preview','Upload Photo');
  goToStep(1);
}

function resetPhotoBox(id, label) {
  const box = document.getElementById(id); if(!box) return;
  const inp = box.querySelector('input');
  box.innerHTML = `<input type="file" accept="image/*" onchange="previewPhoto(this,'${id}')">
    <span style="font-size:2rem;color:var(--clr-text-3);">📷</span>
    <span style="font-size:0.7rem;color:var(--clr-text-3);margin-top:4px;">${label} (Max 200KB)</span>`;
  if (inp) box.querySelector('input').id = inp.id;
}

async function editStudent(id) {
  const students = await nmGetStudents(schoolId, currentYearId);
  const s = students.find(x => x.id === id);
  if (!s) return;
  editingId = id;
  photoB64 = s.photo||''; fatherPhotoB64 = s.father_photo||s.fatherPhoto||''; motherPhotoB64 = s.mother_photo||s.motherPhoto||'';
  document.getElementById('form-title').textContent = '✏️ Edit Student Record';
  
  setVal('f-adm',s.admission_number||s.admissionNumber);
  setVal('f-name',s.full_name||s.fullName);
  setVal('f-class-val',s.class);
  setVal('f-section-val',s.section);
  setVal('f-house',s.house);
  setVal('f-dob',s.dob);
  setVal('f-age',s.dob?nmCalcAge(s.dob)+' years' : (s.age ? s.age + ' years' : ''));
  setVal('f-religion',s.religion);
  setVal('f-caste',s.caste);
  setVal('f-address',s.address);
  setVal('f-phone',s.phone);
  setVal('f-email',s.email);
  setVal('f-aadhar',s.aadhar);
  setVal('f-apaar',s.apaar_number||s.apaarNumber);
  setVal('f-pen',s.pen);
  setVal('f-fname',s.father_name||s.fatherName);
  setVal('f-fqual',s.father_qualification||s.fatherQualification);
  setVal('f-focc',s.father_occupation||s.fatherOccupation);
  setVal('f-fphone',s.father_phone||s.fatherPhone);
  setVal('f-mname',s.mother_name||s.motherName);
  setVal('f-mqual',s.mother_qualification||s.motherQualification);
  setVal('f-mocc',s.mother_occupation||s.motherOccupation);
  setVal('f-mphone',s.mother_phone||s.motherPhone);
  setVal('f-medical',s.medical_history||s.medicalHistory);
  
  document.querySelectorAll('input[name="gender"]').forEach(r=>r.checked=r.value===s.gender);
  ['ncc','nss','sgfi','scouts'].forEach(a=>{ const el=document.getElementById('f-'+a); if(el) el.checked=!!s[a]; });
  
  if (s.photo) setPhotoPreview('sp-preview','f-photo',s.photo);
  if (s.father_photo||s.fatherPhoto) setPhotoPreview('fp-preview','f-father-photo',s.father_photo||s.fatherPhoto);
  if (s.mother_photo||s.motherPhoto) setPhotoPreview('mp-preview','f-mother-photo',s.mother_photo||s.motherPhoto);
  
  showSection('add-student', document.querySelector('[onclick*="add-student"]'));
  goToStep(1);
}
function setVal(id,v){const el=document.getElementById(id);if(el&&v!=null)el.value=v;}
function setPhotoPreview(boxId,inputId,src){
  const box=document.getElementById(boxId);if(!box)return;
  box.innerHTML=`<input type="file" id="${inputId}" accept="image/*" onchange="previewPhoto(this,'${boxId}')">
    <img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
}

async function previewPhoto(input, boxId) {
  if (!input.files[0]) return;
  const file = input.files[0];
  
  // Restriction: Photo must be below 200KB
  if (file.size > 200 * 1024) {
    nmToast('Photo size must be below 200KB. Please compress or crop the image.', 'error');
    input.value = '';
    return;
  }

  const b64 = await nmToBase64(file);
  const box = document.getElementById(boxId); if (!box) return;
  box.innerHTML = `<input type="file" id="${input.id}" accept="image/*" onchange="previewPhoto(this,'${boxId}')"><img src="${b64}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  if (boxId==='sp-preview') photoB64 = b64;
  if (boxId==='fp-preview') fatherPhotoB64 = b64;
  if (boxId==='mp-preview') motherPhotoB64 = b64;
}

function calcAge() {
  const dob = document.getElementById('f-dob').value;
  document.getElementById('f-age').value = dob ? nmCalcAge(dob)+' years' : '';
}

function goToStep(n) {
  currentStep = n;
  document.querySelectorAll('.step-pane').forEach((p,i) => p.classList.toggle('active', i+1===n));
  document.querySelectorAll('.sp-item').forEach((it,i) => {
    it.classList.toggle('active', i+1===n);
    it.classList.toggle('done', i+1<n);
    const num = it.querySelector('.sp-num');
    if (i+1 < n) num.textContent = '✓';
    else num.textContent = i+1;
  });
  if (n===5) buildSummary();
}

function nextStep(n) {
  if (n===1) {
    if (!document.getElementById('f-adm').value.trim()) { nmToast('Admission number is required','error'); return; }
    if (!document.getElementById('f-name').value.trim()) { nmToast('Student name is required','error'); return; }
    if (!document.getElementById('f-class-val').value)   { nmToast('Please select a class','error'); return; }
    if (!document.getElementById('f-dob').value)         { nmToast('Date of birth is required','error'); return; }
    if (!document.querySelector('input[name="gender"]:checked')) { nmToast('Please select gender','error'); return; }
  }
  goToStep(n+1);
}

function buildSummary() {
  const g = id => document.getElementById(id)?.value||'';
  const gender = document.querySelector('input[name="gender"]:checked')?.value||'—';
  const acts = ['ncc','nss','sgfi','scouts'].filter(a=>document.getElementById('f-'+a)?.checked).join(', ')||'None';
  document.getElementById('form-summary').innerHTML = `
    <b>Name:</b> ${g('f-name')} &nbsp;|&nbsp; <b>Adm No:</b> ${g('f-adm')} &nbsp;|&nbsp; <b>Class:</b> ${g('f-class-val')}-${g('f-section-val')}<br>
    <b>DOB:</b> ${nmFmtDate(g('f-dob'))} &nbsp;|&nbsp; <b>Age:</b> ${g('f-age')} &nbsp;|&nbsp; <b>Gender:</b> ${gender} &nbsp;|&nbsp; <b>House:</b> ${g('f-house')||'—'}<br>
    <b>Religion:</b> ${g('f-religion')||'—'} &nbsp;|&nbsp; <b>Caste:</b> ${g('f-caste')||'—'}<br>
    <b>Father:</b> ${g('f-fname')||'—'} (${g('f-focc')||'—'}) &nbsp;|&nbsp; <b>Mother:</b> ${g('f-mname')||'—'} (${g('f-mocc')||'—'})<br>
    <b>Activities:</b> ${acts}`;
}

async function submitStudent() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const gender = document.querySelector('input[name="gender"]:checked')?.value||'';

  const phone = g('f-phone');
  if (phone && !nmValidPhone(phone)) { nmToast('Please enter a valid 10-digit phone number','error'); return; }
  
  const email = g('f-email');
  if (email && !nmValidEmail(email)) { nmToast('Please enter a valid email address','error'); return; }
  
  const aadhar = g('f-aadhar');
  if (aadhar && !nmValidAadhar(aadhar)) { nmToast('Please enter a valid 12-digit Aadhar number','error'); return; }

  if (!schoolId) {
    nmToast('Session error: school not identified. Please log out and log in again.', 'error');
    return;
  }

  const student = {
    id: editingId || undefined,
    school_id: schoolId,
    academic_year_id: currentYearId,
    admission_number: g('f-adm'),
    full_name: g('f-name'),
    class: g('f-class-val'),
    section: g('f-section-val'),
    house: g('f-house'),
    dob: g('f-dob') || null,
    gender,
    religion: g('f-religion'),
    caste: g('f-caste'),
    address: g('f-address'),
    phone: g('f-phone'),
    email: g('f-email'),
    aadhar: g('f-aadhar'),
    apaar_number: g('f-apaar'),
    pen: g('f-pen'),
    father_name: g('f-fname'),
    father_phone: g('f-fphone'),
    mother_name: g('f-mname'),
    mother_phone: g('f-mphone'),
    medical_history: g('f-medical'),
    ncc: document.getElementById('f-ncc')?.checked||false,
    nss: document.getElementById('f-nss')?.checked||false,
    sgfi: document.getElementById('f-sgfi')?.checked||false,
    scouts: document.getElementById('f-scouts')?.checked||false,
    photo: photoB64,
    father_photo: fatherPhotoB64,
    mother_photo: motherPhotoB64
  };

  const btn = document.getElementById('submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving…'; }

  try {
    await nmSaveStudent(student);
    nmToast(editingId ? 'Student record updated!' : 'Student added successfully!', 'success');
    editingId = null;
    await showSection('students', document.querySelector('[onclick*="students"]'));
  } catch (err) {
    console.error('Save student error:', err);
    nmToast('Error saving student: ' + (err.message || 'Unknown error. Check console.'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✓ Save Student Record'; }
  }
}

// ── Excel Import ─────────────────────────────────────────────────────────────
async function handleExcelUpload(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  
  await loadStudentCache();

  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    excelParsed = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    
    if (!excelParsed.length) { nmToast('No data found in file','error'); return; }
    showExcelPreview();
  };
  reader.readAsArrayBuffer(file);
}

function showExcelPreview() {
  const previewContainer = document.getElementById('excel-preview');
  previewContainer.classList.remove('hidden');
  
  let validCount = 0, dupCount = 0, errCount = 0;
  
  excelParsed.forEach(row => {
    const adm = (row.admissionNumber || row['Admission Number'] || row['Admission No'] || '').toString().trim();
    const name = (row.fullName || row['Full Name'] || row['Student Name'] || '').toString().trim();
    const cls = (row.class || row['Class'] || '').toString().trim();
    
    row._status = 'valid';
    row._msg = 'Ready to import';

    if (!name || !adm || !cls) {
      row._status = 'error';
      row._msg = 'Missing Name, Admission No, or Class';
      errCount++;
    } else if (allCachedStudents.find(s => (s.admission_number||s.admissionNumber) === adm)) {
      row._status = 'duplicate';
      row._msg = 'Admission Number already exists in database';
      dupCount++;
    } else {
      validCount++;
    }
  });

  document.getElementById('excel-preview-title').textContent = `Import Preview — ${excelParsed.length} records`;
  
  const summaryHtml = `
    <div class="import-summary-bar">
      <div style="color:var(--clr-text-2)">Total: ${excelParsed.length}</div>
      <div style="color:var(--clr-success)">✓ ${validCount} Valid</div>
      <div style="color:var(--clr-warning)">⚠ ${dupCount} Duplicates (Skipped)</div>
      <div style="color:var(--clr-danger)">✕ ${errCount} Errors (Skipped)</div>
    </div>
  `;

  const displayCols = ['Status', 'admissionNumber', 'fullName', 'class', 'section', 'phone', 'email'];
  
  document.getElementById('excel-table-wrap').innerHTML = summaryHtml + `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>${displayCols.map(c => `<th>${c.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>`).join('')}</tr></thead>
        <tbody>${excelParsed.slice(0, 100).map(r => {
          const statusClass = r._status === 'error' ? 'row-error' : (r._status === 'duplicate' ? 'row-duplicate' : '');
          return `<tr class="${statusClass}">
            <td><span class="status-pill ${r._status}" title="${r._msg}">${r._status}</span></td>
            <td>${r.admissionNumber || r['Admission Number'] || r['Admission No'] || '—'}</td>
            <td>${r.fullName || r['Full Name'] || r['Student Name'] || '—'}</td>
            <td>${r.class || r['Class'] || '—'}</td>
            <td>${r.section || r['Section'] || '—'}</td>
            <td>${r.phone || r['Phone'] || '—'}</td>
            <td>${r.email || r['Email'] || '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    ${excelParsed.length > 100 ? `<div style="padding:12px; font-size:0.8rem; color:var(--clr-text-3);">...and ${excelParsed.length - 100} more rows.</div>` : ''}
  `;

  const importBtn = document.getElementById('import-btn');
  importBtn.disabled = (validCount === 0);
  importBtn.innerHTML = `✓ Import ${validCount} Valid Records`;
}

function clearExcel() {
  excelParsed = [];
  document.getElementById('excel-preview').classList.add('hidden');
  document.getElementById('excel-file').value = '';
}

async function confirmImport() {
  const validRows = excelParsed.filter(r => r._status === 'valid');
  if (!validRows.length) return;
  
  const btn = document.getElementById('import-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  
  let successCount = 0;
  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    btn.textContent = `Importing (${i + 1}/${validRows.length})...`;
    
    try {
      await nmSaveStudent({
        school_id: schoolId,
        academic_year_id: currentYearId,
        admission_number: (row.admissionNumber || row['Admission Number'] || row['Admission No'] || '').toString(),
        full_name:   row.fullName || row['Full Name'] || row['Student Name'] || '',
        class:      (row.class || row['Class'] || '').toString(),
        section:    (row.section || row['Section'] || '').toString(),
        house:      row.house || row['House'] || '',
        dob:        row.dob || row['DOB'] || row['Date of Birth'] || null,
        gender:     row.gender || row['Gender'] || '',
        religion:   row.religion || row['Religion'] || '',
        caste:      row.caste || row['Caste'] || '',
        address:    row.address || row['Address'] || '',
        phone:      (row.phone || row['Phone'] || row['Phone Number'] || '').toString(),
        email:      row.email || row['Email'] || '',
        aadhar:     (row.aadhar || row['Aadhar Number'] || row['Aadhar'] || '').toString(),
        apaar_number:row.apaarNumber || row['APAAR Number'] || row['APAAR'] || '',
        pen:        row.pen || row['PEN'] || '',
        father_name: row.fatherName || row['Father Name'] || '',
        mother_name: row.motherName || row['Mother Name'] || '',
        medical_history: row.medicalHistory || '',
        ncc:    ['yes','true','1'].includes((row.ncc||'').toString().toLowerCase()),
        nss:    ['yes','true','1'].includes((row.nss||'').toString().toLowerCase()),
        sgfi:   ['yes','true','1'].includes((row.sgfi||'').toString().toLowerCase()),
        scouts: ['yes','true','1'].includes((row.scouts||'').toString().toLowerCase()),
      });
      successCount++;
    } catch (e) {
      console.error('Import row fail:', e);
    }
  }
  
  nmToast(`Successfully imported ${successCount} students!`, 'success');
  clearExcel();
  btn.disabled = false;
  btn.innerHTML = originalText;
  await renderStudents();
  showSection('students', document.querySelector('[onclick*="students"]'));
}

const dz = document.getElementById('drop-zone');
if (dz) {
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if(f) { const inp=document.getElementById('excel-file'); const dt=new DataTransfer(); dt.items.add(f); inp.files=dt.files; handleExcelUpload(inp); } });
}
async function deleteTimelineRecord(type, id) {
  if (type === 'observation') {
    if (typeof deleteObservationRecord === 'function') await deleteObservationRecord(id);
  } else if (type === 'counselling') {
    if (typeof deleteCounsellingRecord === 'function') await deleteCounsellingRecord(id);
  } else if (type === 'movement') {
    if (typeof deleteMovementRecord === 'function') await deleteMovementRecord(id);
  }
  // Refresh the profile view
  if (currentStudentId) await viewStudent(currentStudentId);
}
