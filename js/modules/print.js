/* ── NobleMinds Print Module ─────────────────────────────────────────────────── */
'use strict';

async function nmPreparePrintProfile(id, options = {}) {
  const orientation = options.orientation || 'portrait';
  
  try {
    let s = null;
    if (typeof allCachedStudents !== 'undefined' && allCachedStudents.length) {
      s = allCachedStudents.find(x => x.id === id);
    }
    if (!s) {
      const { data, error } = await sb.from('students').select('*').eq('id', id).maybeSingle();
      if (!error && data) s = data;
    }
    if (!s) { nmToast('Student not found', 'error'); return; }

    // Apply orientation via dynamic style
    let styleTag = document.getElementById('print-orientation-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'print-orientation-style';
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `@page { size: ${orientation}; margin: 10mm; }`;

    const history = await nmGetStudentHistory(id);
    const p = document.getElementById('print-section');
    
    // Add print class for styling and orientation
    document.body.classList.add('printing-profile');
    if (orientation === 'landscape') document.body.classList.add('print-landscape');
    else document.body.classList.remove('print-landscape');

    // Secure data mapping with Escaping
    const esc = nmEscapeHTML;
    const infoRow = (k, v) => `<div class="print-info-item"><strong>${k}</strong><span>${esc(v) || '—'}</span></div>`;

    p.innerHTML = `
      <div class="print-header">
        <div class="print-logo-wrap">
          <img src="../assets/logo.png" class="print-logo">
          <div class="print-header-text">
            <h1>Student Record</h1>
            <p>${esc(document.getElementById('sb-school-name')?.textContent || s.school_name || s.schoolName || 'NobleMinds Platform')} · Official Archive</p>
          </div>
        </div>
        <div class="print-meta">
          <div>Ref: NM/STU/${esc(s.admission_number || s.admissionNumber || '000')}</div>
          <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
          <div>Time: ${new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
      </div>

      <div class="print-row">
        <div class="print-photo-wrap">
          <img src="${esc(s.photo || '../assets/logo.png')}" class="print-photo">
        </div>
        <div style="flex:1;">
          <h2 style="margin:0 0 10px; font-size:18pt; color:#000;">${esc(s.full_name || s.fullName || '—')}</h2>
          <div class="print-grid">
            ${infoRow('Admission No', s.admission_number || s.admissionNumber)}
            ${infoRow('Class & Section', `${s.class || '?'} - ${s.section || '?'}`)}
            ${infoRow('Gender', s.gender)}
            ${infoRow('House', s.house)}
            ${infoRow('Date of Birth', nmFmtDate(s.dob))}
            ${infoRow('Age', s.dob ? nmCalcAge(s.dob) + ' Years' : (s.age ? s.age + ' Years' : '—'))}
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
      <div style="padding:15px; border:1px solid #eee; font-size:10pt; color:#333; line-height:1.6; border-radius:6px;">${esc(s.medical_history || s.medicalHistory || 'No significant medical history recorded.')}</div>

      <h3 class="print-section-title">Counselling, Observation & Movement History</h3>
      <div class="timeline">
        ${history.length ? history.map(h => {
          let icon = '👁', title = h.type === 'observation' ? 'Observation' : (h.issue || 'Record');
          let body = h.type === 'observation' ? h.observation : (h.counselling || '');
          if (h.type === 'movement') {
            icon = '🏃'; title = `Movement: ${h.reason}`;
            body = `Leaving: ${nmFmtDate(h.leave_date || h.leaveDate)} · Return: ${nmFmtDate(h.report_date || h.reportDate)}<br>` + 
                   `Outgoing Escort: ${esc(h.escort_name || h.escortName)} (${esc(h.relationship)}) · Contact: ${esc(h.phone)}`;
            if (h.report_date || h.reportDate) {
              body += `<br>Incoming Escort: ${esc(h.return_escort_name || h.returnEscortName || '—')} (${esc(h.return_relationship || h.returnRelationship || '—')}) · Contact: ${esc(h.return_phone || h.returnPhone || '—' )}`;
            }
          }
          return `
          <div class="timeline-item ${h.type}">
            <div class="timeline-dot">${icon}</div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-title"><strong>${esc(title)}</strong></span>
                <span class="timeline-date">${nmFmtDate(h.date)}</span>
              </div>
              <div class="timeline-body">${esc(body)}</div>
              ${h.type === 'counselling' ? `<div style="margin-top:8px;"><span class="status-badge">${esc(h.status || 'Resolved')}</span></div>` : ''}
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

    // Cleanup logic using native events
    const cleanup = () => {
      document.body.classList.remove('printing-profile');
      document.body.classList.remove('print-landscape');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // Short delay for images to load before dialog
    setTimeout(() => {
      window.print();
    }, 500);

  } catch (err) {
    console.error('[PrintModule] Error:', err);
    nmToast('Failed to prepare print profile: ' + err.message, 'error');
    document.body.classList.remove('printing-profile');
  }
}
