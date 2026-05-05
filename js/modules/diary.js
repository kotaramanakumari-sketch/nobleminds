/* ── NobleMinds Teacher Diary Module ───────────────────────────────────────────── */
'use strict';

async function renderTeacherDiaries() {
  const q = (document.getElementById('diary-search')?.value||'').toLowerCase();
  const session = await sb.auth.getSession();
  const userId = session?.data?.session?.user?.id;
  if (!userId) { 
    document.getElementById('diary-tbody').innerHTML = '';
    document.getElementById('diary-empty').classList.remove('hidden');
    return;
  }
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
    const topicEsc = nmEscapeHTML(d.topic_discussed || '—');
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
          <div><span style="color:var(--clr-amber);">■</span> OD: ${d.onduty || d.on_duty}</div>
          <div><span style="color:var(--clr-text-3);">■</span> NR: ${d.notreported || d.not_reported}</div>
        </div>
        <div style="font-size:0.75rem;font-weight:700;margin-top:4px;">Total: ${d.total_students}</div>
      </td>
      <td data-label="Topic" style="max-width:200px;font-size:0.85rem;" title="${topicEsc}">${topicEsc}</td>
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
    dOnduty.value = d.onduty || d.on_duty;
    dNotreported.value = d.notreported || d.not_reported;
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
    'On Duty': d.onduty || d.on_duty,
    'Not Reported': d.notreported || d.not_reported,
    'Topic Discussed': d.topic_discussed
  }));
  
  nmExportExcel(data, `Teacher_Diary_${new Date().toISOString().split('T')[0]}.xlsx`);
}

document.addEventListener('input', e => {
  if (e.target.closest('#diary-modal') && e.target.type === 'number') {
    updateDiaryTotal();
  }
});
