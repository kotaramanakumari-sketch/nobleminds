/* ── NobleMinds Counselling Module ────────────────────────────────────────────── */
'use strict';

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
    const issueEsc = nmEscapeHTML(c.issue || '—');
    const nameEsc  = nmEscapeHTML(s.full_name || s.fullName || 'Unknown');
    const admEsc   = nmEscapeHTML(s.admission_number || s.admissionNumber || '');

    return `<tr>
      <td data-label="Date">${nmFmtDate(dateVal)}</td>
      <td data-label="Student">
        <div style="font-weight:600;color:var(--clr-primary);cursor:pointer;" onclick="viewStudent('${s.id}')">${nameEsc}</div>
        <div style="font-size:0.7rem;color:var(--clr-text-2);">${admEsc}</div>
      </td>
      <td data-label="Class"><span class="badge badge-purple">Class ${s.class}</span></td>
      <td data-label="Section">${s.section||'—'}</td>
      <td data-label="House"><span class="badge badge-gray">${s.house||'—'}</span></td>
      <td data-label="Issue" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${issueEsc}">${issueEsc}</td>
      <td data-label="Status"><span class="status-badge ${c.follow_up||c.followUp ? 'status-followup' : 'status-resolved'}">${c.follow_up||c.followUp ? 'Follow-up' : c.status||'Resolved'}</span></td>
      <td data-label="Action">
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="openCounsellingModal('${c.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCounsellingRecord('${c.id}')" title="Delete">🗑</button>
        </div>
      </td>
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
    document.getElementById('c-date').value = c.date || c.record_date || '';
    document.getElementById('c-issue').value = c.issue || '';
    document.getElementById('c-status').value = c.status || 'Resolved';
    document.getElementById('c-followup').checked = !!(c.follow_up || c.followUp);
    document.getElementById('c-text').value = c.counselling || '';

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

  try {
    await nmSaveCounselling({
      id: document.getElementById('c-id').value || undefined,
      school_id: schoolId, student_id: sid, date, issue, status, follow_up: followUp, counselling: text
    });
    closeModal('cns-modal');
    nmToast('Counselling record saved','success');
    await renderCounselling();
    if (typeof renderDashboard === 'function') await renderDashboard();
  } catch (err) {
    console.error('Counselling save failed:', err);
    nmToast('Error saving record', 'error');
  }
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
