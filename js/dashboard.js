/* ── NobleMinds Dashboard Core Logic ────────────────────────────────────────── */
'use strict';

let schoolId = '', currentYearId = '', allYears = [], currentStudentId = '', excelParsed = [], currentStep = 1;
let allCachedStudents = [];
let selectedStudentsMap = { o: [], c: null, m: null };

async function init() {
  await nmInitAuth();
  const session = nmRequireAuth('user');
  if (session) {
    schoolId = session.school_id || session.school_id;
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
  if (!y26) {
    try {
      await nmSaveAcademicYear({ school_id: schoolId, name: '2026-2027', is_active: true });
      allYears = await nmGetAcademicYears(schoolId);
      y26 = allYears.find(y => y.name === '2026-2027');
    } catch(e) { console.error('Academic year setup failed:', e); }
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
    `<div class="table-wrapper"><table class="data-table"><thead><tr><th>Student</th><th>Class</th><th>Added</th><th></th></tr></thead><tbody>${recent.map(s => {
      const nameEsc = nmEscapeHTML(s.full_name || s.fullName || '—');
      return `<tr>
      <td data-label="Student"><div style="display:flex;align-items:center;gap:10px;">${s.photo?`<img src="${s.photo}" style="width:30px;height:30px;border-radius:8px;object-fit:cover;">`:`<div class="avatar" style="width:30px;height:30px;font-size:0.7rem;">${nameEsc[0]}</div>`}<span style="font-weight:600;">${nameEsc}</span></div></td>
      <td data-label="Class"><span class="badge badge-purple">Class ${s.class}</span></td>
      <td data-label="Added">${nmFmtDate(s.created_at||s.createdAt)}</td>
      <td data-label="Action"><button class="btn btn-ghost btn-sm" onclick="viewStudent('${s.id}')">👁 View</button></td>
    </tr>`; }).join('')}</tbody></table></div>`;

  // Recent Counselling
  const recentCns = [...counselling].reverse().slice(0,5);
  let cnsHtml = '';
  if (!recentCns.length) {
    cnsHtml = '<div class="empty-state" style="padding:20px;"><p>No counselling records yet.</p></div>';
  } else {
    for (const c of recentCns) {
      const s = students.find(x => x.id === (c.student_id || c.studentId)) || { full_name: 'Unknown' };
      const nameEsc = nmEscapeHTML(s.full_name || s.fullName || 'Unknown');
      const issueEsc = nmEscapeHTML(c.issue || '—');
      cnsHtml += `<div style="padding:12px;border-bottom:1px solid var(--clr-border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;">${nameEsc}</div>
          <div style="font-size:0.75rem;color:var(--clr-text-2);">${issueEsc}</div>
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

// ── Student Selection Generic Logic ──────────────────────────────────────────
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
  if (results) results.classList.remove('active');
  const input = document.getElementById(`${prefix}-student-search`);
  if (input) input.value = '';

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
  const awayRecords = {};
  movs.forEach(m => {
    if (!m.report_date && !m.reportDate) {
      awayRecords[m.student_id || m.studentId] = m;
    }
  });
  return awayRecords;
}

init();
