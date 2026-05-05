/* ── NobleMinds Movements Module ───────────────────────────────────────────────── */
'use strict';

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
    const nameEsc = nmEscapeHTML(s.full_name || s.fullName || 'Unknown');
    const reasonEsc = nmEscapeHTML(m.reason || '—');
    const escortEsc = nmEscapeHTML(m.escort_name || m.escortName || '—');
    const relEsc = nmEscapeHTML(m.relationship || '—');
    const phoneEsc = nmEscapeHTML(m.phone || '—');
    const rEscortEsc = nmEscapeHTML(m.return_escort_name || m.returnEscortName || '—');
    const rRelEsc = nmEscapeHTML(m.return_relationship || m.returnRelationship || '—');
    const rPhoneEsc = nmEscapeHTML(m.return_phone || m.returnPhone || '—');

    return `<tr>
      <td data-label="Student">
        <div style="font-weight:600;">${nameEsc}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-2);">Class ${s.class} · ${s.section} · ${s.house} House</div>
      </td>
      <td data-label="Leave Date"><div style="font-weight:600;color:var(--clr-primary);">${nmFmtDate(m.leave_date||m.leaveDate)}</div></td>
      <td data-label="Reason" style="max-width:200px;font-size:0.85rem;" title="${reasonEsc}">${reasonEsc}</td>
      <td data-label="Outgoing Escort">
        <div style="font-weight:500;">${escortEsc}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-2);">${relEsc} · ${phoneEsc}</div>
      </td>
      <td data-label="Return Date">
        ${isIncoming ? `<div style="font-weight:600;color:var(--clr-success);">${nmFmtDate(m.report_date||m.reportDate)}</div>` : `<span class="badge" style="background:rgba(255,193,7,0.1);color:#ffc107;">Away</span>`}
      </td>
      <td data-label="Incoming Escort">
        ${isIncoming ? `
        <div style="font-weight:500;">${rEscortEsc}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-2);">${rRelEsc} · ${rPhoneEsc}</div>
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
