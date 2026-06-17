'use strict';

/**
 * NobleMinds Student Directory Module
 * Renders student cards with metrics and active status indicators.
 */

let activeSmartFilters = {
  obs: false, // High Observations (>3)
  med: false, // Medical Alerts
  cns: false  // Active Counselling
};

let cachedStudents = [];
let cachedObservations = [];
let cachedCounselling = [];

/** Initialize and render the Student Directory */
async function renderDirectory() {
  const grid = document.getElementById('directory-grid');
  const emptyState = document.getElementById('dir-empty');
  const schoolLabel = document.getElementById('dir-school-label');

  if (!schoolId) {
    schoolLabel.textContent = 'No school linked';
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  // Show Loading state
  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--clr-text-2);">
      <div class="empty-state-icon" style="animation: spin 1.5s linear infinite; display: inline-block;">🔄</div>
      <h3 style="margin-top: 10px;">Loading Directory...</h3>
      <p style="font-size: 0.88rem; color: var(--clr-text-3);">Fetching records from cloud database</p>
    </div>
  `;
  emptyState.classList.add('hidden');

  try {
    // Fetch data in parallel
    const [students, observations, counselling] = await Promise.all([
      nmGetStudents(schoolId, currentYearId),
      nmGetObservations(schoolId),
      nmGetCounselling(schoolId)
    ]);

    cachedStudents = students || [];
    cachedObservations = observations || [];
    cachedCounselling = counselling || [];

    // Set school label info
    const schoolName = document.getElementById('sb-school-name')?.textContent || 'School';
    schoolLabel.textContent = `${schoolName} · ${cachedStudents.length} students enrolled`;

    applyDirectoryFilters();
  } catch (err) {
    console.error('Error rendering directory:', err);
    grid.innerHTML = '';
    schoolLabel.textContent = 'Error loading records';
    nmToast('Failed to load directory data: ' + err.message, 'error');
  }
}

/** Toggles one of the three smart filters */
function toggleSmartFilter(type) {
  activeSmartFilters[type] = !activeSmartFilters[type];
  
  const el = document.getElementById(`sf-${type}`);
  if (el) {
    el.classList.toggle('active', activeSmartFilters[type]);
  }
  
  applyDirectoryFilters();
}

/** Handle changes on regular input filters */
function onDirectoryFilterChange() {
  applyDirectoryFilters();
}

/** Main filtering and drawing logic */
function applyDirectoryFilters() {
  const query = document.getElementById('dir-search').value.trim().toLowerCase();
  const fClass = document.getElementById('dir-f-class').value;
  const fSection = document.getElementById('dir-f-section').value;
  const fHouse = document.getElementById('dir-f-house').value;

  const grid = document.getElementById('directory-grid');
  const emptyState = document.getElementById('dir-empty');

  // Filter students list
  const filtered = cachedStudents.filter(s => {
    // 1. Basic search text
    const name = (s.full_name || s.fullName || '').toLowerCase();
    const adm = (s.admission_number || s.admissionNumber || '').toLowerCase();
    if (query && !name.includes(query) && !adm.includes(query)) {
      return false;
    }

    // 2. Class select
    if (fClass && String(s.class) !== fClass) {
      return false;
    }

    // 3. Section select
    if (fSection && s.section !== fSection) {
      return false;
    }

    // 4. House select
    if (fHouse && s.house !== fHouse) {
      return false;
    }

    const sId = s.id;

    // 5. Smart Filter: High Observations (>3)
    if (activeSmartFilters.obs) {
      const obsCount = cachedObservations.filter(o => (o.student_id === sId || o.studentId === sId)).length;
      if (obsCount <= 3) return false;
    }

    // 6. Smart Filter: Medical Alerts
    if (activeSmartFilters.med) {
      const med = (s.medical_history || s.medicalHistory || '').trim().toLowerCase();
      const hasMed = med && med !== 'none' && med !== 'none recorded' && med !== 'no' && med !== 'nil' && med !== 'no medical history';
      if (!hasMed) return false;
    }

    // 7. Smart Filter: Active Counselling
    if (activeSmartFilters.cns) {
      const hasCns = cachedCounselling.some(c => 
        (c.student_id === sId || c.studentId === sId) && 
        c.status && c.status.toLowerCase() !== 'resolved'
      );
      if (!hasCns) return false;
    }

    return true;
  });

  // Render Grid
  if (!filtered.length) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(s => {
    const sId = s.id;
    const nameEsc = nmEscapeHTML(s.full_name || s.fullName || 'Unknown Student');
    const admEsc = nmEscapeHTML(s.admission_number || s.admissionNumber || '—');
    const classEsc = nmEscapeHTML(s.class || '?');
    const sectionEsc = nmEscapeHTML(s.section || '?');
    const houseEsc = nmEscapeHTML(s.house || 'None');
    
    // Count observations
    const obsCount = cachedObservations.filter(o => (o.student_id === sId || o.studentId === sId)).length;
    
    // Check medical history
    const med = (s.medical_history || s.medicalHistory || '').trim().toLowerCase();
    const hasMed = med && med !== 'none' && med !== 'none recorded' && med !== 'no' && med !== 'nil' && med !== 'no medical history';
    
    // Check counselling status
    const activeCns = cachedCounselling.filter(c => 
      (c.student_id === sId || c.studentId === sId) && 
      c.status && c.status.toLowerCase() !== 'resolved'
    );
    const hasCns = activeCns.length > 0;

    // Fallback avatar background color
    const avatarColor = getDirectoryAvatarColor(nameEsc);
    const initials = nameEsc.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'S';

    // Badge styling for observations
    let obsBadgeStyle = 'background: rgba(108,99,255,0.06); color: var(--clr-text-2); border: 1px solid var(--clr-border);';
    if (obsCount > 3) {
      obsBadgeStyle = 'background: rgba(239,68,68,0.1); color: var(--clr-danger); border: 1px solid rgba(239,68,68,0.2);';
    } else if (obsCount > 0) {
      obsBadgeStyle = 'background: rgba(245,158,11,0.08); color: var(--clr-warning); border: 1px solid rgba(245,158,11,0.15);';
    }

    // House styling
    let houseDotColor = '#9ca3af';
    if (houseEsc.toLowerCase() === 'red') houseDotColor = '#ef4444';
    if (houseEsc.toLowerCase() === 'blue') houseDotColor = '#3b82f6';
    if (houseEsc.toLowerCase() === 'green') houseDotColor = '#10b981';
    if (houseEsc.toLowerCase() === 'yellow') houseDotColor = '#eab308';

    return `
      <div class="student-card">
        <div class="student-card-header">
          ${s.photo ? 
            `<img class="student-card-avatar" src="${s.photo}" alt="${nameEsc}">` : 
            `<div class="student-card-avatar" style="background: ${avatarColor}; color: #fff; border: none;">${initials}</div>`
          }
          <div class="student-card-info">
            <div class="student-card-name" onclick="viewStudent('${sId}')" title="Click to view full timeline">${nameEsc}</div>
            <div class="student-card-adm">Adm: ${admEsc}</div>
          </div>
        </div>

        <div class="student-card-meta">
          <span class="badge badge-purple" style="font-size: 0.72rem;">Class ${classEsc}-${sectionEsc}</span>
          <span class="badge badge-gray" style="font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background: ${houseDotColor};"></span>
            ${houseEsc} House
          </span>
        </div>

        <div class="student-card-badges">
          <div class="student-card-badge-item">
            <span class="student-card-badge-label">👁‍🗨 Observations</span>
            <span class="status-badge" style="${obsBadgeStyle} font-size: 0.72rem; padding: 2px 8px; font-weight: 700;">${obsCount} Obs</span>
          </div>
          
          <div class="student-card-badge-item">
            <span class="student-card-badge-label">🩺 Medical Status</span>
            ${hasMed ? 
              `<span class="status-badge status-followup" style="background:rgba(239,68,68,0.1); color:var(--clr-danger); border:1px solid rgba(239,68,68,0.15); font-size: 0.72rem; padding: 2px 8px;">Alert</span>` : 
              `<span style="color: var(--clr-text-3); font-size: 0.72rem; font-weight:normal;">Normal</span>`
            }
          </div>

          <div class="student-card-badge-item">
            <span class="student-card-badge-label">🤝 Counselling</span>
            ${hasCns ? 
              `<span class="status-badge status-followup" style="font-size: 0.72rem; padding: 2px 8px;">Active (${activeCns.length})</span>` : 
              `<span style="color: var(--clr-text-3); font-size: 0.72rem; font-weight:normal;">None</span>`
            }
          </div>
        </div>

        <div class="student-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="viewStudent('${sId}')" style="border: 1px solid var(--clr-border);">👁 View Profile</button>
          
          <!-- Quick Record Button Group -->
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-primary btn-sm btn-icon" onclick="quickAddObservation('${sId}')" title="Log Observation">👁‍🗨</button>
            <button class="btn btn-primary btn-sm btn-icon" onclick="quickAddCounselling('${sId}')" title="Log Counselling Session">🤝</button>
            <button class="btn btn-primary btn-sm btn-icon" onclick="quickAddMovement('${sId}')" title="Log Movement/Leave">🏃</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/** Helper function to generate initials avatar background color based on hashing */
function getDirectoryAvatarColor(name) {
  const colors = [
    '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', 
    '#8b5cf6', '#ef4444', '#14b8a6', '#0ea5e9', '#f43f5e'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Ensure keyframe spinner is defined if not present
if (!document.getElementById('directory-spinner-style')) {
  const style = document.createElement('style');
  style.id = 'directory-spinner-style';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
