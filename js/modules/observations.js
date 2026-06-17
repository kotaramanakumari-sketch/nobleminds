/* ── NobleMinds Observations Module ────────────────────────────────────────────── */
'use strict';

async function renderObservations() {
  const q = (document.getElementById('obs-search')?.value||'').toLowerCase();
  const fFrom = document.getElementById('obs-from')?.value;
  const fTo = document.getElementById('obs-to')?.value;

  const students = await nmGetStudents(schoolId, currentYearId);
  const obs = await nmGetObservations(schoolId);
  
  const list = obs.filter(o => {
    const dateVal = o.observation_date || o.date || '';
    if (fFrom && dateVal < fFrom) return false;
    if (fTo && dateVal > fTo) return false;
    
    const s = students.find(x => x.id === (o.student_id || o.studentId));
    return !q || (s && (s.full_name||s.fullName).toLowerCase().includes(q)) || (o.observation||'').toLowerCase().includes(q);
  });
  
  const tbody = document.getElementById('obs-tbody');
  const empty = document.getElementById('obs-empty');
  if (!list.length) { tbody.innerHTML=''; empty.classList.remove('hidden'); return; }
  const studentSeq = {};
  [...obs].reverse().forEach(o => {
    const sid = o.student_id || o.studentId;
    if (sid) {
      studentSeq[sid] = (studentSeq[sid] || 0) + 1;
      o._seqNumber = studentSeq[sid];
    }
  });

  tbody.innerHTML = list.map(o => {
    const s = students.find(x => x.id === (o.student_id || o.studentId)) || { full_name: 'Unknown', class:'?', section:'?', house:'?' };
    const dateVal = o.observation_date || o.date || '';
    const observationEsc = nmEscapeHTML(o.observation || '—');
    const nameEsc  = nmEscapeHTML(s.full_name || s.fullName || 'Unknown');
    const admEsc   = nmEscapeHTML(s.admission_number || s.admissionNumber || '');
    const observerEsc = nmEscapeHTML(o.observed_by || o.observedBy || 'Staff');

    return `<tr>
      <td data-label="Date">${nmFmtDate(dateVal)}<div style="font-size:0.7rem;color:var(--clr-text-3);">by ${observerEsc}</div></td>
      <td data-label="Student">
        <div style="font-weight:600;color:var(--clr-primary);cursor:pointer;" onclick="viewStudent('${s.id}')">${nameEsc}</div>
        <div style="font-size:0.7rem;color:var(--clr-text-2);">${admEsc}</div>
      </td>
      <td data-label="Class">Class ${s.class}</td>
      <td data-label="Section">${s.section}</td>
      <td data-label="House">${s.house||'—'}</td>
      <td data-label="No. of Obs"><span class="badge" style="background:#e5e7eb; color:#000; font-weight:bold;">${o._seqNumber || 1}</span></td>
      <td data-label="Observation" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${observationEsc}">${observationEsc}</td>
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
        id: idValue, school_id: schoolId, user_id: userId, student_id: selected[0].id, observation_date: date, observation: text 
      });
    } else {
      for (const s of selected) {
        await nmSaveObservation({ 
          school_id: schoolId, user_id: userId, student_id: s.id, observation_date: date, observation: text 
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
  const q = (document.getElementById('obs-search')?.value||'').toLowerCase();
  const fFrom = document.getElementById('obs-from')?.value;
  const fTo = document.getElementById('obs-to')?.value;

  let obs = await nmGetObservations(schoolId);
  const students = await nmGetStudents(schoolId, currentYearId);

  const studentSeq = {};
  [...obs].reverse().forEach(o => {
    const sid = o.student_id || o.studentId;
    if (sid) {
      studentSeq[sid] = (studentSeq[sid] || 0) + 1;
      o._seqNumber = studentSeq[sid];
    }
  });

  let list = obs.filter(o => {
    const dateVal = o.observation_date || o.date || '';
    if (fFrom && dateVal < fFrom) return false;
    if (fTo && dateVal > fTo) return false;
    
    const s = students.find(x => x.id === (o.student_id || o.studentId));
    return !q || (s && (s.full_name||s.fullName).toLowerCase().includes(q)) || (o.observation||'').toLowerCase().includes(q);
  });

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
      'Obs #': o._seqNumber || 1,
      Observation: o.observation
    };
  }).reverse();
  nmExportExcel(data, `NobleMinds_Observations_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function deleteObservationRecord(id) {
  if (await nmConfirm('Delete this observation?')) {
    await nmDeleteObservation(id);
    await renderObservations();
    nmToast('Observation deleted','info');
  }
}
