/* ── NobleMinds Parent Interactions Module ────────────────────────────────────────────── */
'use strict';

async function renderInteractions() {
  const q = (document.getElementById('int-search')?.value||'').toLowerCase();
  const fFrom = document.getElementById('int-from')?.value;
  const fTo = document.getElementById('int-to')?.value;

  const students = await nmGetStudents(schoolId, currentYearId);
  const interactions = await nmGetInteractions(schoolId);
  
  const list = interactions.filter(i => {
    const dateVal = i.interaction_date || '';
    if (fFrom && dateVal < fFrom) return false;
    if (fTo && dateVal > fTo) return false;

    const s = students.find(x => x.id === (i.student_id));
    return !q || 
           (s && (s.full_name||s.fullName).toLowerCase().includes(q)) || 
           (i.parent_name||'').toLowerCase().includes(q) ||
           (i.discussion_summary||'').toLowerCase().includes(q);
  });
  
  const tbody = document.getElementById('int-tbody');
  const empty = document.getElementById('int-empty');
  if (!list.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  
  tbody.innerHTML = list.map(i => {
    const s = students.find(x => x.id === (i.student_id)) || { full_name: 'Unknown', class:'?', section:'?', house:'?' };
    const dateVal = i.interaction_date || '';
    const parentEsc = nmEscapeHTML(i.parent_name || '—');
    const modeEsc = nmEscapeHTML(i.interaction_mode || '—');
    const summaryEsc = nmEscapeHTML(i.discussion_summary || '—');
    const nameEsc  = nmEscapeHTML(s.full_name || s.fullName || 'Unknown');
    const admEsc   = nmEscapeHTML(s.admission_number || s.admissionNumber || '');

    let modeBadgeClass = 'badge-gray';
    if(modeEsc === 'Mobile' || modeEsc === 'Message') modeBadgeClass = 'badge-blue';
    if(modeEsc === 'Face to Face') modeBadgeClass = 'badge-purple';
    if(modeEsc === 'Email') modeBadgeClass = 'badge-amber';

    return `<tr>
      <td data-label="Date">${nmFmtDate(dateVal)}</td>
      <td data-label="Student">
        <div style="font-weight:600;color:var(--clr-primary);cursor:pointer;" onclick="viewStudent('${s.id}')">${nameEsc}</div>
        <div style="font-size:0.7rem;color:var(--clr-text-2);">${admEsc} · Class ${s.class} ${s.section||''}</div>
      </td>
      <td data-label="Parent / Guardian">
        <div style="font-weight:500;">${parentEsc}</div>
      </td>
      <td data-label="Mode"><span class="badge ${modeBadgeClass}">${modeEsc}</span></td>
      <td data-label="Summary" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${summaryEsc}">${summaryEsc}</td>
      <td data-label="Action">
        <div style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="openInteractionModal('${i.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteInteractionRecord('${i.id}')" title="Delete">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function openInteractionModal(id) {
  await loadStudentCache();
  initStudentSearch('int', false);

  if (id) {
    const list = await nmGetInteractions(schoolId);
    const i = list.find(x => x.id === id);
    if (!i) return;
    const s = allCachedStudents.find(x => x.id === i.student_id);

    document.getElementById('int-modal-title').textContent = 'Edit Parent Interaction';
    document.getElementById('int-id').value = i.id;
    document.getElementById('int-date').value = i.interaction_date || '';
    document.getElementById('int-mode').value = i.interaction_mode || 'Mobile';
    document.getElementById('int-parent-name').value = i.parent_name || '';
    document.getElementById('int-summary').value = i.discussion_summary || '';

    if (s) {
      handleStudentSelect('int', s.id, false);
    }
  } else {
    document.getElementById('int-modal-title').textContent = 'Add Parent Interaction';
    document.getElementById('int-id').value = '';
    document.getElementById('int-date').value = nmToday();
    document.getElementById('int-mode').value = 'Mobile';
    document.getElementById('int-parent-name').value = '';
    document.getElementById('int-summary').value = '';
    clearSingleSelection('int');
  }
  openModal('int-modal');
}

async function saveInteraction() {
  const sid = document.getElementById('int-student').value;
  const date = document.getElementById('int-date').value;
  const mode = document.getElementById('int-mode').value;
  const parentName = document.getElementById('int-parent-name').value.trim();
  const summary = document.getElementById('int-summary').value.trim();

  if (!date || !sid || !parentName || !summary) { 
    nmToast('Please select a student and fill all fields','error'); 
    return; 
  }

  try {
    await nmSaveInteraction({
      id: document.getElementById('int-id').value || undefined,
      school_id: schoolId, 
      student_id: sid, 
      date: date, 
      mode: mode, 
      parent_name: parentName, 
      summary: summary
    });
    closeModal('int-modal');
    nmToast('Interaction record saved','success');
    await renderInteractions();
  } catch (err) {
    console.error('Interaction save failed:', err);
    nmToast('Error saving record', 'error');
  }
}

async function deleteInteractionRecord(id) {
  if (await nmConfirm('Delete this interaction record?')) {
    await nmDeleteInteraction(id);
    await renderInteractions();
    nmToast('Record deleted','info');
  }
}

async function exportInteractions() {
  const q = (document.getElementById('int-search')?.value||'').toLowerCase();
  const fFrom = document.getElementById('int-from')?.value;
  const fTo = document.getElementById('int-to')?.value;

  let list = await nmGetInteractions(schoolId);
  const students = await nmGetStudents(schoolId, currentYearId);

  list = list.filter(i => {
    const dateVal = i.interaction_date || '';
    if (fFrom && dateVal < fFrom) return false;
    if (fTo && dateVal > fTo) return false;

    const s = students.find(x => x.id === (i.student_id));
    return !q || 
           (s && (s.full_name||s.fullName).toLowerCase().includes(q)) || 
           (i.parent_name||'').toLowerCase().includes(q) ||
           (i.discussion_summary||'').toLowerCase().includes(q);
  });

  if (!list.length) { nmToast('No records to export', 'info'); return; }
  
  const data = list.map(i => {
    const s = students.find(x => x.id === (i.student_id)) || {};
    return {
      Date: i.interaction_date || '',
      StudentName: s.full_name || s.fullName || 'Unknown',
      AdmissionNo: s.admission_number || s.admissionNumber || '',
      Class: s.class || '',
      Section: s.section || '',
      ParentName: i.parent_name,
      InteractionMode: i.interaction_mode,
      DiscussionSummary: i.discussion_summary
    };
  }).reverse();
  nmExportExcel(data, `NobleMinds_ParentInteractions_${new Date().toISOString().split('T')[0]}.xlsx`);
}
