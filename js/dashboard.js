/* NobleMinds Dashboard Logic */
'use strict';

let schoolId = '', currentYearId = '', allYears = [], currentStudentId = '', excelParsed = [], currentStep = 1;

async function init() {
  await nmInitAuth();
  const session = nmRequireAuth('user');
  if (session) {
    schoolId = session.school_id || session.school_id; // Check both cases
    document.getElementById('user-name-disp').textContent = session.name;
    document.getElementById('user-avatar').textContent    = nmGetInitials(session.name);
    const sn = session.school_name || session.schoolName || 'School Portal';
    document.getElementById('sb-school-name').textContent = sn;
    if (document.getElementById('print-school-heading')) {
      document.getElementById('print-school-heading').textContent = sn.toUpperCase();
    }
    
    await loadAcademicYears();
  }

  // Set up Realtime Subscriptions
  try {
    const refreshUI = nmDebounce(async () => {
      const activeSection = document.querySelector('.page-section.active')?.id.replace('section-', '') || 'dashboard';
      console.log('[Realtime] Refreshing active section:', activeSection);
      
      if (activeSection === 'dashboard') await renderDashboard();
      else if (activeSection === 'students') await renderStudents();
      else if (activeSection === 'observations') await renderObservations();
      else if (activeSection === 'counselling') await renderCounselling();
      else if (activeSection === 'movement') await renderMovements();
      else if (activeSection === 'teacher-diary') await renderTeacherDiaries();
    }, 1000);

    nmSubscribe('students', schoolId, refreshUI);
    nmSubscribe('observations', schoolId, refreshUI);
    nmSubscribe('counselling_records', schoolId, refreshUI);
    nmSubscribe('movements', schoolId, refreshUI);
    nmSubscribe('teacher_diaries', schoolId, refreshUI);
  } catch(e) { console.warn('[init] realtime setup fail:', e); }
  
  // Handle URL params
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const stdId  = params.get('studentId');
  if (action === 'add-observations' && stdId) {
    await showSection('observations');
    await quickAddObservation(stdId);
  } else if (action === 'add-counselling' && stdId) {
    await showSection('counselling');
    await quickAddCounselling(stdId);
  } else if (action === 'add-movement' && stdId) {
    await showSection('movement');
    await quickAddMovement(stdId);
  } else {
    await showSection('dashboard');
  }
}

// ── Academic Years ────────────────────────────────────────────────────────────
async function loadAcademicYears() {
  allYears = await nmGetAcademicYears(schoolId);
  
  let y26 = allYears.find(y => y.name === '2026-2027');
  let y23 = allYears.find(y => y.name === '2023-2024');

  // 1. Create 2026-2027 if missing
  if (!y26) {
    try {
      await nmSaveAcademicYear({ school_id: schoolId, name: '2026-2027', is_active: true });
      allYears = await nmGetAcademicYears(schoolId);
      y26 = allYears.find(y => y.name === '2026-2027');
    } catch(e) { console.error('Academic year setup failed:', e); }
  }

  // 2. Aggressive Migration: If 2023-2024 exists, MOVE all students to 2026-2027 and delete old year.
  if (y23 && y26) {
    try {
      console.log('Migrating data to 2026-2027...');
      await sb.from('students').update({ academic_year_id: y26.id }).eq('academic_year_id', y23.id);
      await sb.from('students').update({ academic_year_id: y26.id }).eq('school_id', schoolId).is('academic_year_id', null);
      await sb.from('academic_years').delete().eq('id', y23.id);
      
      allYears = await nmGetAcademicYears(schoolId);
      y26 = allYears.find(y => y.name === '2026-2027');
      nmToast('Academic Year migrated to 2026-2027 successfully!', 'success');
    } catch(e) { console.error('Manual migration failed:', e); }
  }

  if (allYears.length) {
    const active = allYears.find(y => y.is_active) || y26 || allYears[0];
    currentYearId = active.id;
  }
  renderYearSelector();
}

function renderYearSelector() {
  const el = document.getElementById('topbar-year-sel');
  if (!el) return;
  if (!allYears.length) {
    el.innerHTML = '<option value="">No years found</option>';
    return;
  }
  el.innerHTML = allYears.map(y => `
    <option value="${y.id}" ${y.id === currentYearId ? 'selected' : ''}>
      ${y.name} ${y.is_active ? ' (Active)' : ''}
    </option>
  `).join('');
}

async function changeYear(yearId) {
  currentYearId = yearId;
  const activeSection = document.querySelector('.page-section.active').id.replace('section-', '');
  await showSection(activeSection);
}

async function renderAcademicYears() {
  const years = await nmGetAcademicYears(schoolId);
  const list = document.getElementById('ay-list');
  if (!list) return;
  list.innerHTML = years.map(y => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--clr-surface); border-bottom:1px solid var(--clr-border);">
      <div>
        <div style="font-weight:700; font-size:0.95rem;">Academic Year ${y.name}</div>
        <div style="font-size:0.75rem; color:var(--clr-text-3);">Created ${nmFmtDate(y.created_at)}</div>
      </div>
      <div>
        ${y.is_active ? '<span class="badge badge-green">Active Default</span>' : `<button class="btn btn-ghost btn-sm" onclick="setActiveYear('${y.id}')">Set as Active</button>`}
      </div>
    </div>
  `).join('');
}

async function addAcademicYear() {
  const name = document.getElementById('ay-name-new').value.trim();
  if (!name) return nmToast('Year name is required','error');
  try {
    await nmSaveAcademicYear({ school_id: schoolId, name, is_active: false });
    document.getElementById('ay-name-new').value = '';
    await loadAcademicYears();
    await renderAcademicYears();
    nmToast('Academic Year added successfully','success');
  } catch(e) { 
    nmToast('Error adding year: ' + e.message, 'error'); 
  }
}

async function setActiveYear(id) {
  if (await nmConfirm('Making this the active year will set it as the default for all portal users. Continue?')) {
    try {
      await nmSetDefaultYear(id, schoolId);
      await loadAcademicYears();
      await renderAcademicYears();
      nmToast('Global active year updated','success');
    } catch(e) {
      nmToast('Error: ' + e.message, 'error');
    }
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
const pageTitles = { dashboard:'Dashboard', students:'Students', 'add-student':'Add Student', import:'Bulk Import', observations:'Observations', counselling:'Counselling', movement:'Movement Record', settings:'Settings', 'teacher-diary': 'Teacher Diary' };
function toggleMobileMenu() {
  document.querySelector('.sidebar').classList.toggle('open');
}
async function showSection(id, el) {
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('topbar-title').textContent = pageTitles[id] || id;

  if (id === 'dashboard') await renderDashboard();
  if (id === 'students')  await renderStudents();
  if (id === 'observations') await renderObservations();
  if (id === 'counselling')  await renderCounselling();
  if (id === 'movement')     await renderMovements();
  if (id === 'settings')     await renderAcademicYears();
  if (id === 'teacher-diary') await renderTeacherDiaries();
}
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target===o) o.classList.remove('active'); }));

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  if (!schoolId) {
    document.getElementById('dash-school-label').innerHTML = `<span style="color:#d9534f;font-weight:600;">⚠ Account Not Linked</span> &nbsp;&mdash;&nbsp; Your account has not been linked to a school. Please contact the Super Admin.`;
    document.getElementById('ds-total').textContent = '0';
    document.getElementById('ds-sessions').textContent = '0';
    document.getElementById('ds-followups').textContent = '0';
    document.getElementById('ds-activities').textContent = '0';
    document.getElementById('recent-table').innerHTML = '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">🚫</div><h3>No School Assigned</h3><p>Data will appear here once an admin assigns you to a school.</p></div>';
    document.getElementById('recent-cns-list').innerHTML = '<div class="empty-state" style="padding:20px;"><p>No records found.</p></div>';
    document.getElementById('nb-count').textContent = '0';
    return;
  }

  const stats = await nmGetStats(schoolId, currentYearId);
  const students = (await nmGetStudents(schoolId, currentYearId)) || [];
  const counselling = (await nmGetCounselling(schoolId)) || [];
  
  document.getElementById('ds-total').textContent    = stats.total;
  document.getElementById('ds-sessions').textContent = stats.counselling.total;
  document.getElementById('ds-followups').textContent = stats.counselling.followUps;
  document.getElementById('ds-activities').textContent = stats.total ? students.filter(s=>s.ncc||s.nss||s.sgfi||s.scouts).length : 0;
  
  document.getElementById('nb-count').textContent    = stats.total;
  document.getElementById('dash-school-label').textContent = `School: ${document.getElementById('sb-school-name').textContent} · ${stats.total} students enrolled`;
  
  // Recent Students
  const recent = [...students].reverse().slice(0,5);
  document.getElementById('recent-table').innerHTML = !recent.length ?
    '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">🎓</div><h3>No students yet</h3><p>Add your first student to get started.</p></div>' :
    `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Added</th><th></th></tr></thead><tbody>${recent.map(s=>`<tr>
      <td data-label="Student"><div style="display:flex;align-items:center;gap:10px;">${s.photo?`<img src="${s.photo}" style="width:30px;height:30px;border-radius:8px;object-fit:cover;">`:`<div class="avatar" style="width:30px;height:30px;font-size:0.7rem;">${(s.full_name||s.fullName||'?')[0]}</div>`}<span style="font-weight:600;">${s.full_name||s.fullName}</span></div></td>
      <td data-label="Class"><span class="badge badge-purple">Class ${s.class}</span></td>
      <td data-label="Added">${nmFmtDate(s.created_at||s.createdAt)}</td>
      <td data-label="Action"><button class="btn btn-ghost btn-sm" onclick="viewStudent('${s.id}')">👁 View</button></td>
    </tr>`).join('')}</tbody></table></div>`;

  // Recent Counselling
  const recentCns = [...counselling].reverse().slice(0,5);
  let cnsHtml = '';
  if (!recentCns.length) {
    cnsHtml = '<div class="empty-state" style="padding:20px;"><p>No counselling records yet.</p></div>';
  } else {
    for (const c of recentCns) {
      const s = students.find(x => x.id === (c.student_id || c.studentId)) || { full_name: 'Unknown' };
      cnsHtml += `<div style="padding:12px;border-bottom:1px solid var(--clr-border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;">${s.full_name||s.fullName}</div>
          <div style="font-size:0.75rem;color:var(--clr-text-2);">${c.issue}</div>
          <div style="font-size:0.7rem;color:var(--clr-text-3); margin-top:2px;">${nmFmtDate(c.date)}</div>
        </div>
        <div>
          <span class="status-badge ${c.follow_up||c.followUp ? 'status-followup' : 'status-resolved'}">${c.follow_up||c.followUp ? 'Follow-up' : 'Resolved'}</span>
        </div>
      </div>`;
    }
  }
  document.getElementById('recent-cns-list').innerHTML = cnsHtml;

  // Render Analytics
  await renderStrengthChart(students);
}

/**
 * Renders the Student Strength by Class bar chart
 */
async function renderStrengthChart(students) {
  const container = document.getElementById('strength-chart-container');
  if (!container) return;
  
  if (!students.length) {
    container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--clr-text-3);">No student data available for this year.</div>';
    return;
  }

  // Group by class
  const counts = {};
  students.forEach(s => {
    const cls = s.class || 'Unknown';
    counts[cls] = (counts[cls] || 0) + 1;
  });

  // Sort classes logically
  const classOrder = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'Alumni'];
  const sortedClasses = Object.keys(counts).sort((a, b) => {
    let ia = classOrder.indexOf(a.toString());
    let ib = classOrder.indexOf(b.toString());
    if (ia === -1) ia = 999;
    if (ib === -1) ib = 999;
    return ia - ib;
  });

  const max = Math.max(...Object.values(counts), 1);
  
  container.innerHTML = sortedClasses.map((cls, index) => {
    const count = counts[cls];
    const pct = (count / max) * 100;
    const delay = index * 50; // Staggered animation
    return `
      <div class="chart-row" style="animation-delay: ${delay}ms">
        <div class="chart-label">${['Nursery','LKG','UKG','Alumni'].includes(cls) ? cls : 'Class ' + cls}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="width: 0%" data-pct="${pct}"></div>
        </div>
        <div class="chart-count">${count}</div>
      </div>
    `;
  }).join('');

  // Update Year Label
  const yearLabel = document.getElementById('chart-year-label');
  if (yearLabel && allYears.length) {
    const year = allYears.find(y => y.id === currentYearId);
    if (year) yearLabel.textContent = year.name;
  }

  // Trigger bar expansion animation
  setTimeout(() => {
    container.querySelectorAll('.chart-bar').forEach(bar => {
      bar.style.width = bar.getAttribute('data-pct') + '%';
    });
  }, 150);
}

// ── Students ──────────────────────────────────────────────────────────────────
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
  tbody.innerHTML = list.map(s=>`<tr>
    <td data-label="Student"><div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="viewStudent('${s.id}')">${s.photo?`<img src="${s.photo}" style="width:34px;height:34px;border-radius:8px;object-fit:cover;">`:`<div class="avatar" style="width:34px;height:34px;font-size:0.75rem;">${(s.full_name||s.fullName||'?')[0]}</div>`}<div><div style="font-weight:600;color:var(--clr-primary);">${s.full_name||s.fullName||'—'}</div><div style="font-size:0.72rem;color:var(--clr-text-2);">${s.admission_number||s.admissionNumber||''}</div></div></div></td>
    <td data-label="Class"><span class="badge badge-purple">Class ${s.class||'?'}</span></td>
    <td data-label="Section">${s.section||'—'}</td>
    <td data-label="House"><span class="badge badge-gray">${s.house||'—'}</span></td>
    <td data-label="Phone">${s.phone||'—'}</td>
    <td data-label="Actions"><div style="display:flex;gap:4px;">
      <button class="btn btn-ghost btn-sm" onclick="editStudent('${s.id}')" title="Edit">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteStudentRow('${s.id}')" title="Delete">🗑 Delete</button>
    </div></td>
  </tr>`).join('');
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

  document.getElementById('student-modal-body').innerHTML = `
    <div class="profile-header">
      <div class="profile-photo">${s.photo?`<img src="${s.photo}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;">`:'<span style="font-size:2.5rem;">👤</span>'}</div>
      <div style="flex:1;">
        <div class="profile-name">${s.full_name||s.fullName||'—'}</div>
        <div style="color:var(--clr-text-2);font-size:0.88rem;">${s.admission_number||s.admissionNumber||''} · ID: ${s.id.slice(0,8)}</div>
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
          <button class="btn btn-ghost btn-sm" onclick="nmPreparePrintProfile('${id}')">🖨 Print</button>
        </div>
        <div style="font-size:0.7rem; color:var(--clr-text-3); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Quick Actions</div>
      </div>
    </div>
    
    <div class="profile-grid">
      <div>
        <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">📋 Profile Information</h4>
        <div class="info-grid mb-16">
          ${iI('DOB',nmFmtDate(s.dob))}${iI('Age',s.dob?nmCalcAge(s.dob)+' years' : (s.age ? s.age : '—'))}
          ${iI('Religion',s.religion)}${iI('Caste',s.caste)}
          ${iI('Phone',s.phone)}${iI('Email',s.email)}
        </div>
        <h4 style="margin-bottom:12px;">🏠 Address</h4>
        <div style="padding:12px 16px;background:var(--clr-surface);border-radius:var(--radius-sm);border:1px solid var(--clr-border);margin-bottom:16px;color:var(--clr-text-2);font-size:0.88rem;">${s.address||'—'}</div>
        <h4 style="margin-bottom:12px;">📁 Identity Documents</h4>
        <div class="info-grid mb-16">${iI('Aadhar',s.aadhar)}${iI('APAAR',s.apaar_number||s.apaarNumber||'—')}${iI('PEN',s.pen)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div><h4 style="margin-bottom:10px;">👨 Father</h4><div class="info-grid" style="grid-template-columns:1fr;">${iI('Name',s.father_name||s.fatherName)}${iI('Phone',s.father_phone||s.fatherPhone)}</div></div>
          <div><h4 style="margin-bottom:10px;">👩 Mother</h4><div class="info-grid" style="grid-template-columns:1fr;">${iI('Name',s.mother_name||s.motherName)}${iI('Phone',s.mother_phone||s.motherPhone)}</div></div>
        </div>
        <h4 style="margin-bottom:12px;">🏥 Medical History</h4>
        <div style="padding:12px 16px;background:var(--clr-surface);border-radius:var(--radius-sm);border:1px solid var(--clr-border);color:var(--clr-text-2);font-size:0.88rem;">${s.medical_history||s.medicalHistory||'None recorded'}</div>
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
              return `
                <div class="timeline-item ${h.type}">
                  <div class="timeline-dot">${icon}</div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="timeline-title">${title}</span>
                      <span class="timeline-date">${nmFmtDate(h.date)}</span>
                    </div>
                    <div class="timeline-body">${body}</div>
                    ${footer}
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
    input.value = ''; // Clear the input
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

  // VALIDATION
  const phone = g('f-phone');
  if (phone && !nmValidPhone(phone)) { nmToast('Please enter a valid 10-digit phone number','error'); return; }
  
  const email = g('f-email');
  if (email && !nmValidEmail(email)) { nmToast('Please enter a valid email address','error'); return; }
  
  const aadhar = g('f-aadhar');
  if (aadhar && !nmValidAadhar(aadhar)) { nmToast('Please enter a valid 12-digit Aadhar number','error'); return; }

  // Guard: schoolId must be set
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
  
  // Ensure cache is loaded for duplicate checking
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

// Drag-and-drop
const dz = document.getElementById('drop-zone');
if (dz) {
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if(f) { const inp=document.getElementById('excel-file'); const dt=new DataTransfer(); dt.items.add(f); inp.files=dt.files; handleExcelUpload(inp); } });
}

// ── Student Selection Generic Logic ──────────────────────────────────────────
let allCachedStudents = [];
let selectedStudentsMap = { o: [], c: null, m: null };

async function loadStudentCache() {
  if (!allCachedStudents.length) {
    allCachedStudents = await nmGetStudents(schoolId);
  }
}

function initStudentSearch(prefix, isMulti = false, customSource = null) {
  const input = document.getElementById(`${prefix}-student-search`);
  const results = document.getElementById(`${prefix}-search-results`);
  if (!input || !results) return;

  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('active'); return; }
    
    // Use custom source list if provided, else default to all cached students
    const source = customSource || allCachedStudents;
    const filtered = source.filter(s => 
      (s.full_name || s.fullName || '').toLowerCase().includes(q) || 
      (s.admission_number || s.admissionNumber || '').toLowerCase().includes(q)
    ).slice(0, 10);

    if (!filtered.length) {
      results.innerHTML = `<div style="padding:10px;color:var(--clr-text-3);">${customSource ? 'No students found (Only "Away" students shown)' : 'No students found'}</div>`;
    } else {
      results.innerHTML = filtered.map(s => `
        <div class="student-result-item" onclick="handleStudentSelect('${prefix}', '${s.id}', ${isMulti})">
          <div class="avatar" style="width:30px;height:30px;font-size:0.7rem;">${(s.full_name||'U')[0]}</div>
          <div class="student-result-info">
            <div class="student-result-name">${s.full_name || s.fullName}</div>
            <div class="student-result-meta">${s.admission_number || s.admissionNumber} · Class ${s.class}${s.section}</div>
          </div>
        </div>
      `).join('');
    }
    results.classList.add('active');
  };

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('active');
    }
  });
}

async function handleStudentSelect(prefix, studentId, isMulti) {
  const s = allCachedStudents.find(x => x.id === studentId);
  if (!s) return;

  const results = document.getElementById(`${prefix}-search-results`);
  results.classList.remove('active');
  const input = document.getElementById(`${prefix}-student-search`);
  input.value = '';

  if (isMulti) {
    if (!selectedStudentsMap[prefix].find(x => x.id === studentId)) {
      selectedStudentsMap[prefix].push(s);
      renderSelectedChips(prefix);
    }
  } else {
    selectedStudentsMap[prefix] = s;
    document.getElementById(`${prefix}-student`).value = s.id;
    document.getElementById(`${prefix}-selected-name`).textContent = `${s.full_name || s.fullName} (${s.admission_number || s.admissionNumber})`;
    document.getElementById(`${prefix}-selection-disp`).classList.remove('hidden');
    document.getElementById(`${prefix}-search-wrap`).classList.add('hidden');

    if (prefix === 'm' && document.getElementById('mov-mode').value === 'incoming') {
      const awayRecords = await searchOutgoingRecords();
      const existing = awayRecords[studentId];
      if (existing) {
        document.getElementById('mov-id').value = existing.id;
        document.getElementById('m-reason').value = existing.reason;
        document.getElementById('m-leave-date').value = existing.leave_date || existing.leaveDate;
        document.getElementById('m-escort-name').value = existing.escort_name || existing.escortName;
        document.getElementById('m-relationship').value = existing.relationship;
        document.getElementById('m-phone').value = existing.phone;

        document.getElementById('m-return-escort-name').value = existing.return_escort_name || existing.returnEscortName || existing.escort_name || existing.escortName || '';
        document.getElementById('m-return-relationship').value = existing.return_relationship || existing.returnRelationship || existing.relationship || '';
        document.getElementById('m-return-phone').value = existing.return_phone || existing.returnPhone || existing.phone || '';

        document.getElementById('m-report-date').value = nmToday();
        
        // Ensure readOnly states are correctly applied (in case they were manually changed)
        document.getElementById('m-leave-date').readOnly = true;
        document.getElementById('m-reason').readOnly = true;
        document.getElementById('m-escort-name').readOnly = true;
        document.getElementById('m-relationship').readOnly = true;
        document.getElementById('m-phone').readOnly = true;
      }
    }
  }
}

function renderSelectedChips(prefix) {
  const area = document.getElementById(`${prefix}-selected-area`);
  if (!area) return;
  area.innerHTML = selectedStudentsMap[prefix].map(s => `
    <div class="student-chip">
      ${s.full_name || s.fullName}
      <span class="remove-btn" onclick="removeStudentChip('${prefix}', '${s.id}')">✕</span>
    </div>
  `).join('');
}

function removeStudentChip(prefix, sid) {
  selectedStudentsMap[prefix] = selectedStudentsMap[prefix].filter(x => x.id !== sid);
  renderSelectedChips(prefix);
}

function clearSingleSelection(prefix) {
  selectedStudentsMap[prefix] = null;
  const sid = document.getElementById(`${prefix}-student`);
  if (sid) sid.value = '';
  document.getElementById(`${prefix}-selection-disp`).classList.add('hidden');
  document.getElementById(`${prefix}-search-wrap`).classList.remove('hidden');
  document.getElementById(`${prefix}-student-search`).focus();
  
  if (prefix === 'm') {
    // Reset movement fields if cleared
    document.getElementById('m-reason').value = '';
    document.getElementById('m-leave-date').value = nmToday();
    document.getElementById('m-report-date').value = '';
    document.getElementById('m-escort-name').value = '';
    document.getElementById('m-relationship').value = '';
    document.getElementById('m-phone').value = '';
    document.getElementById('m-return-escort-name').value = '';
    document.getElementById('m-return-relationship').value = '';
    document.getElementById('m-return-phone').value = '';

    document.getElementById('m-leave-date').readOnly = false;
    document.getElementById('m-reason').readOnly = false;
    document.getElementById('m-escort-name').readOnly = false;
    document.getElementById('m-relationship').readOnly = false;
    document.getElementById('m-phone').readOnly = false;
  }
}

async function searchOutgoingRecords() {
  const movs = await nmGetMovements(schoolId);
  // Get unique latest away record for each student
  const awayRecords = {};
  movs.forEach(m => {
    if (!m.report_date && !m.reportDate) {
      awayRecords[m.student_id || m.studentId] = m;
    }
  });
  return awayRecords;
}

// ── Observations Logic ─────────────────────────────────────────────────────────
async function renderObservations() {
  const q = (document.getElementById('obs-search')?.value||'').toLowerCase();
  const students = await nmGetStudents(schoolId, currentYearId);
  const obs = await nmGetObservations(schoolId);
  
  const list = obs.filter(o => {
    const s = students.find(x => x.id === (o.student_id || o.studentId));
    return !q || (s && (s.full_name||s.fullName).toLowerCase().includes(q)) || (o.observation||'').toLowerCase().includes(q);
  }).reverse();
  
  const tbody = document.getElementById('obs-tbody');
  const empty = document.getElementById('obs-empty');
  if (!list.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(o => {
    const s = students.find(x => x.id === (o.student_id || o.studentId)) || { full_name: 'Unknown', class:'?', section:'?', house:'?' };
    const dateVal = o.observation_date || o.date || '';
    return `<tr>
      <td data-label="Date">${nmFmtDate(dateVal)}</td>
      <td data-label="Student"><div style="font-weight:600;color:var(--clr-primary);cursor:pointer;" onclick="viewStudent('${s.id}')">${s.full_name||s.fullName}</div><div style="font-size:0.7rem;color:var(--clr-text-2);">${s.admission_number||s.admissionNumber||''}</div></td>
      <td data-label="Class">Class ${s.class}</td>
      <td data-label="Section">${s.section}</td>
      <td data-label="House">${s.house||'—'}</td>
      <td data-label="Observation" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.observation}</td>
      <td data-label="Actions"><div style="display:flex;gap:4px;">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openObservationModal('${o.id}')" title="Edit">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteObservationRecord('${o.id}')" title="Delete">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function openObservationModal(id) {
  await loadStudentCache();
  initStudentSearch('o', true);

  if (id) {
    const list = await nmGetObservations(schoolId);
    const o = list.find(x => x.id === id);
    if (!o) return;
    const s = allCachedStudents.find(x => x.id === (o.student_id || o.studentId));
    
    document.getElementById('obs-modal-title').textContent = 'Edit Observation';
    document.getElementById('o-id').value = o.id;
    document.getElementById('o-date').value = o.observation_date || o.date || '';
    document.getElementById('o-text').value = o.observation;
    
    selectedStudentsMap.o = s ? [s] : [];
    renderSelectedChips('o');
  } else {
    document.getElementById('obs-modal-title').textContent = 'Add Observation';
    document.getElementById('o-id').value = '';
    document.getElementById('o-date').value = nmToday();
    document.getElementById('o-text').value = '';
    selectedStudentsMap.o = [];
    renderSelectedChips('o');
  }
  openModal('obs-modal');
}

async function saveObservation() {
  const idValue = document.getElementById('o-id').value;
  const date = document.getElementById('o-date').value;
  const text = document.getElementById('o-text').value.trim();
  const selected = selectedStudentsMap.o;

  if (!selected.length || !date || !text) { 
    nmToast('Please select at least one student and fill all fields', 'error'); 
    return; 
  }

  try {
    if (idValue && selected.length === 1) {
      await nmSaveObservation({ 
        id: idValue, school_id: schoolId, student_id: selected[0].id, observation_date: date, observation: text 
      });
    } else {
      for (const s of selected) {
        await nmSaveObservation({ 
          school_id: schoolId, student_id: s.id, observation_date: date, observation: text 
        });
      }
    }
    closeModal('obs-modal');
    nmToast(`${selected.length} Observation(s) saved`,'success');
    await renderObservations();
  } catch (err) {
    nmToast('Error saving observations','error');
  }
}

async function exportObservations() {
  const list = await nmGetObservations(schoolId);
  const students = await nmGetStudents(schoolId, currentYearId);
  if (!list.length) { nmToast('No observations to export', 'info'); return; }
  const data = list.map(o => {
    const s = students.find(x => x.id === (o.student_id || o.studentId)) || {};
    return {
      Date: o.observation_date || o.date || '',
      StudentName: s.full_name || s.fullName || 'Unknown',
      AdmissionNo: s.admission_number || s.admissionNumber || '',
      Class: s.class || '',
      Section: s.section || '',
      House: s.house || '',
      Observation: o.observation
    };
  });
  nmExportExcel(data, `NobleMinds_Observations_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function deleteObservationRecord(id) {
  if (await nmConfirm('Delete this observation?')) {
    await nmDeleteObservation(id);
    await renderObservations();
    nmToast('Observation deleted','info');
  }
}

// ── Counselling Logic ─────────────────────────────────────────────────────────
async function renderCounselling() {
  const q = (document.getElementById('cns-search')?.value||'').toLowerCase();
  const students = await nmGetStudents(schoolId, currentYearId);
  const cns = await nmGetCounselling(schoolId);
  
  const list = cns.filter(c => {
    const s = students.find(x => x.id === (c.student_id || c.studentId));
    return !q || (s && (s.full_name||s.fullName).toLowerCase().includes(q)) || (c.issue||'').toLowerCase().includes(q);
  }).reverse();
  
  const tbody = document.getElementById('cns-tbody');
  const empty = document.getElementById('cns-empty');
  if (!list.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = list.map(c => {
    const s = students.find(x => x.id === (c.student_id || c.studentId)) || { full_name: 'Unknown', class:'?', section:'?', house:'?' };
    const dateVal = c.record_date || c.date || '';
    return `<tr>
      <td data-label="Date">${nmFmtDate(dateVal)}</td>
      <td data-label="Student"><div style="font-weight:600;color:var(--clr-primary);cursor:pointer;" onclick="viewStudent('${s.id}')">${s.full_name||s.fullName}</div><div style="font-size:0.7rem;color:var(--clr-text-2);">${s.admission_number||s.admissionNumber||''}</div></td>
      <td data-label="Class"><span class="badge badge-purple">Class ${s.class}</span></td>
      <td data-label="Section">${s.section||'—'}</td>
      <td data-label="House"><span class="badge badge-gray">${s.house||'—'}</span></td>
      <td data-label="Issue" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.issue || '—'}</td>
      <td data-label="Status"><span class="status-badge ${c.follow_up||c.followUp ? 'status-followup' : 'status-resolved'}">${c.follow_up||c.followUp ? 'Follow-up' : c.status||'Resolved'}</span></td>
      <td data-label="Action"><button class="btn btn-ghost btn-sm" onclick="openCounsellingModal('${c.id}')">✏️ Edit</button></td>
    </tr>`;
  }).join('');
}

async function openCounsellingModal(id) {
  await loadStudentCache();
  initStudentSearch('c', false);

  if (id) {
    const list = await nmGetCounselling(schoolId);
    const c = list.find(x => x.id === id);
    if (!c) return;
    const s = allCachedStudents.find(x => x.id === (c.student_id || c.studentId));

    document.getElementById('cns-modal-title').textContent = 'Edit Counselling Record';
    document.getElementById('c-id').value = c.id;
    document.getElementById('c-date').value = c.date;
    document.getElementById('c-issue').value = c.issue;
    document.getElementById('c-status').value = c.status || 'Resolved';
    document.getElementById('c-followup').checked = !!(c.follow_up || c.followUp);
    document.getElementById('c-text').value = c.counselling;

    if (s) {
      handleStudentSelect('c', s.id, false);
    }
  } else {
    document.getElementById('cns-modal-title').textContent = 'Add Counselling Record';
    document.getElementById('c-id').value = '';
    document.getElementById('c-date').value = nmToday();
    document.getElementById('c-issue').value = '';
    document.getElementById('c-status').value = 'Resolved';
    document.getElementById('c-followup').checked = false;
    document.getElementById('c-text').value = '';
    clearSingleSelection('c');
  }
  openModal('cns-modal');
}

async function saveCounselling() {
  const sid = document.getElementById('c-student').value;
  const date = document.getElementById('c-date').value;
  const issue = document.getElementById('c-issue').value.trim();
  const status = document.getElementById('c-status').value;
  const followUp = document.getElementById('c-followup').checked;
  const text = document.getElementById('c-text').value.trim();

  if (!date || !sid || !issue || !text) { nmToast('Please select a student and fill all fields','error'); return; }

  await nmSaveCounselling({
    id: document.getElementById('c-id').value || undefined,
    school_id: schoolId, student_id: sid, date, issue, status, follow_up: followUp, counselling: text
  });
  closeModal('cns-modal');
  nmToast('Counselling record saved','success');
  await renderCounselling();
  await renderDashboard();
}

async function deleteCounsellingRecord(id) {
  if (await nmConfirm('Delete this counselling record?')) {
    await nmDeleteCounselling(id);
    await renderCounselling();
    nmToast('Record deleted','info');
  }
}

async function exportCounselling() {
  const list = await nmGetCounselling(schoolId);
  const students = await nmGetStudents(schoolId, currentYearId);
  if (!list.length) { nmToast('No records to export', 'info'); return; }
  const data = list.map(c => {
    const s = students.find(x => x.id === (c.student_id || c.studentId)) || {};
    return {
      Date: c.date,
      StudentName: s.full_name || s.fullName || 'Unknown',
      AdmissionNo: s.admission_number || s.admissionNumber || '',
      Class: s.class || '',
      Section: s.section || '',
      Issue: c.issue,
      Status: c.status || 'Resolved',
      FollowUp: (c.follow_up || c.followUp) ? 'Yes' : 'No',
      Counselling: c.counselling
    };
  });
  nmExportExcel(data, `NobleMinds_Counselling_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function nmPreparePrintProfile(id) {
  const students = await nmGetStudents(schoolId);
  const s = students.find(x => x.id === id);
  if (!s) { nmToast('Student not found', 'error'); return; }

  const history = await nmGetStudentHistory(id);
  const p = document.getElementById('print-section');
  document.body.classList.add('printing-profile');

  const infoRow = (k, v) => `<div class="print-info-item"><strong>${k}</strong><span>${v || '—'}</span></div>`;

  p.innerHTML = `
    <div class="print-header">
      <div class="print-logo-wrap">
        <img src="../assets/logo.png" class="print-logo">
        <div class="print-header-text">
          <h1>Student Record</h1>
          <p>${document.getElementById('sb-school-name')?.textContent || s.school_name || 'NobleMinds Platform'} · Official Archive</p>
        </div>
      </div>
      <div class="print-meta">
        <div>Ref: NM/STU/${s.admission_number || '000'}</div>
        <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
        <div>Time: ${new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
    </div>

    <div class="print-row">
      <div class="print-photo-wrap">
        <img src="${s.photo || '../assets/logo.png'}" class="print-photo">
      </div>
      <div style="flex:1;">
        <h2 style="margin:0 0 10px; font-size:18pt; color:#000;">${s.full_name || s.fullName || '—'}</h2>
        <div class="print-grid">
          ${infoRow('Admission No', s.admission_number || s.admissionNumber)}
          ${infoRow('Class & Section', `${s.class || '?'} - ${s.section || '?'}`)}
          ${infoRow('Gender', s.gender)}
          ${infoRow('House', s.house)}
          ${infoRow('Date of Birth', nmFmtDate(s.dob))}
          ${infoRow('Age', s.dob ? nmCalcAge(s.dob) + ' Years' : '—')}
        </div>
      </div>
    </div>

    <h3 class="print-section-title">Personal & Contact Details</h3>
    <div class="print-grid">
      ${infoRow('Religion', s.religion)}
      ${infoRow('Caste', s.caste)}
      ${infoRow('Phone', s.phone)}
      ${infoRow('Email', s.email)}
      ${infoRow('Aadhar', s.aadhar)}
      ${infoRow('APAAR', s.apaar_number || s.apaarNumber)}
      ${infoRow('PEN', s.pen)}
    </div>
    <div style="margin-top:15px;">
      ${infoRow('Residential Address', s.address)}
    </div>

    <div class="print-grid" style="margin-top:20px;">
      <div>
        <h3 class="print-section-title">Father's Info</h3>
        ${infoRow('Name', s.father_name || s.fatherName)}
        ${infoRow('Occupation', s.father_occupation || s.fatherOccupation)}
        ${infoRow('Contact', s.father_phone || s.fatherPhone)}
      </div>
      <div>
        <h3 class="print-section-title">Mother's Info</h3>
        ${infoRow('Name', s.mother_name || s.motherName)}
        ${infoRow('Occupation', s.mother_occupation || s.motherOccupation)}
        ${infoRow('Contact', s.mother_phone || s.motherPhone)}
      </div>
    </div>

    <h3 class="print-section-title">Medical History</h3>
    <div style="padding:15px; border:1px solid #eee; font-size:10pt; color:#333; line-height:1.6; border-radius:6px;">${s.medical_history || s.medicalHistory || 'No significant medical history recorded.'}</div>

    <h3 class="print-section-title">Counselling, Observation & Movement History</h3>
    <div class="timeline">
      ${history.length ? history.map(h => {
        let icon = '👁', title = h.type === 'observation' ? 'Observation' : (h.issue || 'Record');
        let body = h.type === 'observation' ? h.observation : (h.counselling || '');
        if (h.type === 'movement') {
          icon = '🏃'; title = `Movement: ${h.reason}`;
          body = `Leaving: ${nmFmtDate(h.leave_date || h.leaveDate)} · Return: ${nmFmtDate(h.report_date || h.reportDate)}<br>` + 
                 `Outgoing Escort: ${h.escort_name || h.escortName} (${h.relationship}) · Contact: ${h.phone}`;
          if (h.report_date || h.reportDate) {
            body += `<br>Incoming Escort: ${h.return_escort_name || h.returnEscortName || '—'} (${h.return_relationship || h.returnRelationship || '—'}) · Contact: ${h.return_phone || h.returnPhone || '—'}`;
          }
        }
        return `
        <div class="timeline-item ${h.type}">
          <div class="timeline-dot">${icon}</div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-title"><strong>${title}</strong></span>
              <span class="timeline-date">${nmFmtDate(h.date)}</span>
            </div>
            <div class="timeline-body">${body}</div>
            ${h.type === 'counselling' ? `<div style="margin-top:8px;"><span class="status-badge">${h.status || 'Resolved'}</span></div>` : ''}
          </div>
        </div>
        `;
      }).join('') : '<p style="padding:10px; color:#666;">No history records found for this student.</p>'}
    </div>

    <div class="print-footer">
      <span>Official Student Record — NobleMinds</span>
      <span>Confidential Document</span>
    </div>
  `;

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-profile');
    }, 500);
  }, 300);
}

// ── Movement Logic ────────────────────────────────────────────────────────────
async function renderMovements() {
  const q = (document.getElementById('mov-search')?.value||'').toLowerCase();
  const students = await nmGetStudents(schoolId, currentYearId);
  const mov = await nmGetMovements(schoolId);
  
  const list = mov.filter(m => {
    const s = students.find(x => x.id === (m.student_id || m.studentId));
    return !q || (s && (s.full_name||s.fullName).toLowerCase().includes(q)) || 
           (m.escort_name||m.escortName||'').toLowerCase().includes(q) || (m.reason||'').toLowerCase().includes(q);
  }).reverse();
  
  const tbody = document.getElementById('mov-tbody');
  const empty = document.getElementById('mov-empty');
  if (!list.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  
  tbody.innerHTML = list.map(m => {
    const s = students.find(x => x.id === (m.student_id || m.studentId)) || { full_name: 'Unknown', class:'?', section:'?', house:'?' };
    const isIncoming = !!(m.report_date || m.reportDate);
    return `<tr>
      <td data-label="Student">
        <div style="font-weight:600;">${s.full_name||s.fullName}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-2);">Class ${s.class} · ${s.section} · ${s.house} House</div>
      </td>
      <td data-label="Leave Date"><div style="font-weight:600;color:var(--clr-primary);">${nmFmtDate(m.leave_date||m.leaveDate)}</div></td>
      <td data-label="Reason" style="max-width:200px;font-size:0.85rem;">${m.reason}</td>
      <td data-label="Outgoing Escort">
        <div style="font-weight:500;">${m.escort_name||m.escortName||'—'}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-2);">${m.relationship||'—'} · ${m.phone||'—'}</div>
      </td>
      <td data-label="Return Date">
        ${isIncoming ? `<div style="font-weight:600;color:var(--clr-success);">${nmFmtDate(m.report_date||m.reportDate)}</div>` : `<span class="badge" style="background:rgba(255,193,7,0.1);color:#ffc107;">Away</span>`}
      </td>
      <td data-label="Incoming Escort">
        ${isIncoming ? `
        <div style="font-weight:500;">${m.return_escort_name||m.returnEscortName||'—'}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-2);">${m.return_relationship||m.returnRelationship||'—'} · ${m.return_phone||m.returnPhone||'—'}</div>
        ` : `<span style="color:var(--clr-text-3); font-size:0.85rem;">—</span>`}
      </td>
      <td data-label="Actions">
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="openMovementModal('${m.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteMovementRecord('${m.id}')" title="Delete">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function changeMovementMode(mode) {
  const isOut = mode === 'outgoing';
  document.getElementById('mov-mode').value = mode;
  document.getElementById('mov-outgoing-fields').style.display = isOut ? 'block' : 'none';
  document.getElementById('mov-incoming-fields').style.display = isOut ? 'none' : 'block';
  document.getElementById('group-report-date').style.display = isOut ? 'none' : 'block';
  document.getElementById('card-escort-incoming').style.display = isOut ? 'none' : 'block';
  document.getElementById('lbl-date-1').textContent = isOut ? 'Date of Leaving *' : 'Date of Leaving (Auto)';
  document.getElementById('m-leave-date').readOnly = !isOut;
  document.getElementById('m-reason').readOnly = !isOut;
  document.getElementById('m-escort-name').readOnly = !isOut;
  document.getElementById('m-relationship').readOnly = !isOut;
  document.getElementById('m-phone').readOnly = !isOut;

  const btnOut = document.getElementById('btn-mov-outgoing');
  const btnIn = document.getElementById('btn-mov-incoming');
  
  if (isOut) {
    btnOut.style.background = 'var(--clr-primary)'; btnOut.style.color = '#fff';
    btnIn.style.background = 'transparent'; btnIn.style.color = 'inherit';
    initStudentSearch('m', false);
  } else {
    btnIn.style.background = 'var(--clr-primary)'; btnIn.style.color = '#fff';
    btnOut.style.background = 'transparent'; btnOut.style.color = 'inherit';
    searchOutgoingRecords().then(awayMap => {
      const awayIds = Object.keys(awayMap);
      const awayStudents = allCachedStudents.filter(s => awayIds.includes(s.id));
      initStudentSearch('m', false, awayStudents);
    });
  }
}

async function openMovementModal(id) {
  await loadStudentCache();
  initStudentSearch('m', false);

  if (id) {
    const list = await nmGetMovements(schoolId);
    const m = list.find(x => x.id === id);
    if (!m) return;
    const s = allCachedStudents.find(x => x.id === (m.student_id || m.studentId));

    document.getElementById('mov-modal-title').textContent = 'Edit Movement Record';
    document.getElementById('mov-id').value = m.id;
    document.getElementById('m-reason').value = m.reason;
    document.getElementById('m-leave-date').value = m.leave_date || m.leaveDate;
    document.getElementById('m-report-date').value = m.report_date || m.reportDate;
    document.getElementById('m-escort-name').value = m.escort_name || m.escortName;
    document.getElementById('m-relationship').value = m.relationship;
    document.getElementById('m-phone').value = m.phone;

    document.getElementById('m-return-escort-name').value = m.return_escort_name || m.returnEscortName || '';
    document.getElementById('m-return-relationship').value = m.return_relationship || m.returnRelationship || '';
    document.getElementById('m-return-phone').value = m.return_phone || m.returnPhone || '';

    if (s) {
      handleStudentSelect('m', s.id, false);
    }
  } else {
    document.getElementById('mov-modal-title').textContent = 'Add Movement Record';
    document.getElementById('mov-id').value = '';
    changeMovementMode('outgoing');
    clearSingleSelection('m');
  }
  openModal('movement-modal');
}

async function saveMovement() {
  const sid = document.getElementById('m-student').value;
  const mode = document.getElementById('mov-mode').value;
  const reason = document.getElementById('m-reason').value.trim();
  const leave = document.getElementById('m-leave-date').value;
  const report = document.getElementById('m-report-date').value;
  const escort = document.getElementById('m-escort-name').value.trim();
  const rel = document.getElementById('m-relationship').value.trim();
  const phone = document.getElementById('m-phone').value.trim();

  const rEscort = document.getElementById('m-return-escort-name').value.trim();
  const rRel = document.getElementById('m-return-relationship').value.trim();
  const rPhone = document.getElementById('m-return-phone').value.trim();

  if (!sid || !leave || !reason || !escort) { nmToast('Please select a student and fill all fields','error'); return; }
  if (mode === 'incoming' && (!report || !rEscort)) { nmToast('Please fill all Return Escort fields and Date of Reporting','error'); return; }

  try {
    const payload = {
      id: document.getElementById('mov-id').value || undefined,
      school_id: schoolId, student_id: sid, reason, leave_date: leave, report_date: report || null,
      escort_name: escort, relationship: rel, phone,
      return_escort_name: rEscort || null,
      return_relationship: rRel || null,
      return_phone: rPhone || null
    };
    
    await nmSaveMovement(payload);
    closeModal('movement-modal');
    nmToast(`Movement record ${mode === 'outgoing' ? 'saved' : 'updated'} successfully`,'success');
    await renderMovements();
  } catch (err) {
    nmToast('Error saving movement record','error');
  }
}

async function deleteMovementRecord(id) {
  if (await nmConfirm('Delete this movement record?')) {
    await nmDeleteMovement(id);
    await renderMovements();
    nmToast('Record deleted','info');
  }
}

function exportMovements() {
  nmGetMovements(schoolId).then(mov => {
    nmGetStudents(schoolId, currentYearId).then(students => {
      if (!mov.length) { nmToast('No records to export', 'info'); return; }
      const data = mov.map(m => {
        const s = students.find(x => x.id === (m.student_id || m.studentId)) || {};
        return {
          LeaveDate: m.leave_date || m.leaveDate,
          ReportDate: m.report_date || m.reportDate || 'Away',
          StudentName: s.full_name || s.fullName || 'Unknown',
          AdmissionNo: s.admission_number || s.admissionNumber || '',
          Reason: m.reason,
          Escort: m.escort_name || m.escortName,
          Relationship: m.relationship,
          EscortPhone: m.phone,
          ReturnEscort: m.return_escort_name || m.returnEscortName || '',
          ReturnRelationship: m.return_relationship || m.returnRelationship || '',
          ReturnEscortPhone: m.return_phone || m.returnPhone || ''
        };
      });
      nmExportExcel(data, `NobleMinds_Movements_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  });
}

// ── Teacher Diary Logic ───────────────────────────────────────────────────────
async function renderTeacherDiaries() {
  const q = (document.getElementById('diary-search')?.value||'').toLowerCase();
  const session = await sb.auth.getSession();
  const userId = session.data.session?.user?.id;
  const diaries = await nmGetTeacherDiaries(userId, schoolId);
  
  const list = diaries.filter(d => {
    return !q || 
           (d.topic_discussed||'').toLowerCase().includes(q) || 
           (d.class||'').toLowerCase().includes(q) ||
           (d.section||'').toLowerCase().includes(q);
  });
  
  const tbody = document.getElementById('diary-tbody');
  const empty = document.getElementById('diary-empty');
  if (!list.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  
  tbody.innerHTML = list.map(d => {
    return `<tr>
      <td data-label="Date"><div style="font-weight:600;color:var(--clr-primary);">${nmFmtDate(d.diary_date)}</div></td>
      <td data-label="Period"><span class="badge badge-purple">${d.period}</span></td>
      <td data-label="Class">
        <div style="font-weight:600;">Class ${d.class}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-2);">Section ${d.section}</div>
      </td>
      <td data-label="Attendance">
        <div style="font-size:0.8rem; display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <div><span style="color:var(--clr-success);">■</span> P: ${d.present}</div>
          <div><span style="color:var(--clr-danger);">■</span> L: ${d.leave}</div>
          <div><span style="color:var(--clr-amber);">■</span> OD: ${d.on_duty}</div>
          <div><span style="color:var(--clr-text-3);">■</span> NR: ${d.not_reported}</div>
        </div>
        <div style="font-size:0.75rem;font-weight:700;margin-top:4px;">Total: ${d.total_students}</div>
      </td>
      <td data-label="Topic" style="max-width:200px;font-size:0.85rem;">${d.topic_discussed}</td>
      <td data-label="Actions">
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="openDiaryModal('${d.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteTeacherDiary('${d.id}')" title="Delete">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateDiaryTotal() {
  const p = parseInt(document.getElementById('d-present').value) || 0;
  const l = parseInt(document.getElementById('d-leave').value) || 0;
  const od = parseInt(document.getElementById('d-onduty').value) || 0;
  const nr = parseInt(document.getElementById('d-notreported').value) || 0;
  const totalEl = document.getElementById('d-total-calc');
  if (totalEl) totalEl.textContent = p + l + od + nr;
}

async function openDiaryModal(id) {
  const dId = document.getElementById('d-id');
  const dDate = document.getElementById('d-date');
  const dPeriod = document.getElementById('d-period');
  const dClass = document.getElementById('d-class');
  const dSection = document.getElementById('d-section');
  const dPresent = document.getElementById('d-present');
  const dLeave = document.getElementById('d-leave');
  const dOnduty = document.getElementById('d-onduty');
  const dNotreported = document.getElementById('d-notreported');
  const dTopic = document.getElementById('d-topic');

  if (id) {
    const session = await sb.auth.getSession();
    const userId = session.data.session?.user?.id;
    const diaries = await nmGetTeacherDiaries(userId, schoolId);
    const d = diaries.find(x => x.id === id);
    if (!d) return;
    
    document.getElementById('diary-modal-title').textContent = 'Edit Diary Entry';
    dId.value = d.id;
    dDate.value = d.diary_date;
    dPeriod.value = d.period;
    dClass.value = d.class;
    dSection.value = d.section;
    dPresent.value = d.present;
    dLeave.value = d.leave;
    dOnduty.value = d.on_duty;
    dNotreported.value = d.not_reported;
    dTopic.value = d.topic_discussed;
  } else {
    document.getElementById('diary-modal-title').textContent = 'Add Diary Entry';
    dId.value = '';
    dDate.value = nmToday();
    dPeriod.value = '';
    dClass.value = '';
    dSection.value = '';
    dPresent.value = '0';
    dLeave.value = '0';
    dOnduty.value = '0';
    dNotreported.value = '0';
    dTopic.value = '';
  }
  updateDiaryTotal();
  openModal('diary-modal');
}

async function saveTeacherDiary() {
  const idValue = document.getElementById('d-id').value;
  const date = document.getElementById('d-date').value;
  const period = document.getElementById('d-period').value;
  const cls = document.getElementById('d-class').value.trim();
  const sec = document.getElementById('d-section').value.trim();
  const present = parseInt(document.getElementById('d-present').value) || 0;
  const leave = parseInt(document.getElementById('d-leave').value) || 0;
  const onduty = parseInt(document.getElementById('d-onduty').value) || 0;
  const notreported = parseInt(document.getElementById('d-notreported').value) || 0;
  const topic = document.getElementById('d-topic').value.trim();

  if (!date || !period || !cls || !sec || !topic) {
    nmToast('Please fill all required fields', 'error'); return;
  }

  const session = await sb.auth.getSession();
  const userId = session.data.session?.user?.id;
  const userName = document.getElementById('user-name-disp').textContent;

  await nmSaveTeacherDiary({
    id: idValue || undefined,
    schoolId: schoolId,
    userId: userId,
    teacherName: userName,
    diaryDate: date,
    period: period,
    class: cls,
    section: sec,
    totalStudents: present + leave + onduty + notreported,
    present: present,
    leave: leave,
    onDuty: onduty,
    notReported: notreported,
    topicDiscussed: topic
  });
  
  closeModal('diary-modal');
  nmToast('Diary entry saved successfully!', 'success');
  await renderTeacherDiaries();
}

async function deleteTeacherDiary(id) {
  if (await nmConfirm('Delete this diary entry?')) {
    await nmDeleteTeacherDiary(id);
    await renderTeacherDiaries();
    nmToast('Entry deleted', 'info');
  }
}

async function exportTeacherDiaries() {
  const session = await sb.auth.getSession();
  const userId = session.data.session?.user?.id;
  const diaries = await nmGetTeacherDiaries(userId, schoolId);
  
  if (!diaries.length) { nmToast('No diary entries to export', 'info'); return; }
  
  const data = diaries.map(d => ({
    'Date': d.diary_date,
    'Period': d.period,
    'Class': d.class,
    'Section': d.section,
    'Total Students': d.total_students,
    'Present': d.present,
    'Leave': d.leave,
    'On Duty': d.on_duty,
    'Not Reported': d.not_reported,
    'Topic Discussed': d.topic_discussed
  }));
  
  nmExportExcel(data, `Teacher_Diary_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Global listeners for Teacher Diary attendance
document.addEventListener('input', e => {
  if (e.target.closest('#diary-modal') && e.target.type === 'number') {
    updateDiaryTotal();
  }
});

// Run Init
init();
