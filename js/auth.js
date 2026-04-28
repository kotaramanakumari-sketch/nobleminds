'use strict';

/**
 * NobleMinds Auth Module (Supabase Version)
 * Handles authentication and session management using cloud database.
 */

const NM_SESSION_KEY = 'nm_session';

/** Initialize auth — Checks for existing session */
async function nmInitAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const profile = await nmGetProfile(session.user.id);
    if (profile) {
      sessionStorage.setItem(NM_SESSION_KEY, JSON.stringify(profile));
    }
  }
}

/** Get profile for a specific user ID */
async function nmGetProfile(userId) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}

/** 
 * Sign Up - Creates Auth user + Profile record
 * Used by register.html for instant school setup
 */
async function nmSignUp(data) {
  const { email, password, name, schoolName, schoolId, udise, phone, address } = data;

  // 1. Create the Auth User
  const { data: authData, error: authError } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }
    }
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign up failed');

  // 2. Create the profile
  const { error: profError } = await sb.from('profiles').insert([{
    id: authData.user.id,
    name: name,
    email: email,
    role: email.toLowerCase() === 'kotaramanakumari@gmail.com' ? 'admin' : 'user',
    school_id: schoolId || null,
    school_name: schoolId ? schoolName : 'Pending Approval'
  }]);

  if (profError) {
    console.warn('Profile creation error (might already exist):', profError);
  }

  // 3. Create the registration request ONLY if it's a new school signup
  if (!schoolId) {
    const { error: reqError } = await sb.from('registration_requests').insert([{
      udise:      udise,
      school_name: schoolName,
      address:    address,
      admin_name: name,
      email:      email,
      phone:      phone,
      status:     'pending'
    }]);

    if (reqError) {
      console.error('Request creation error:', reqError);
    }
  }

  return { success: true, user: authData.user };
}

/** Login with email + password */
async function nmLogin(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  
  if (error) return { success: false, message: error.message };
  
  let profile = await nmGetProfile(data.user.id);

  // Auto-heal super admin profile if it got lost/skipped
  if (!profile && email.toLowerCase() === 'kotaramanakumari@gmail.com') {
    const { error: profError } = await sb.from('profiles').insert([{
      id: data.user.id,
      name: 'Super Admin',
      role: 'admin',
      school_id: null,
      school_name: 'NobleMinds Headquarters'
    }]);
    if (profError) {
      alert("Database Error: " + profError.message);
    } else {
      profile = await nmGetProfile(data.user.id);
    }
  }

  if (profile) {
    sessionStorage.setItem(NM_SESSION_KEY, JSON.stringify(profile));
    return { success: true, user: profile };
  }

  
  return { success: false, message: 'Profile not found.' };
}

/** Logout */
async function nmLogout() {
  try {
    await sb.auth.signOut();
  } catch(e) {
    console.error('Sign out error:', e);
  }
  sessionStorage.removeItem(NM_SESSION_KEY);
  const inSub = window.location.pathname.includes('/admin/') ||
                window.location.pathname.includes('/user/');
  window.location.replace(inSub ? '../login.html' : 'login.html');
}

/** Get current session (from sessionStorage or Supabase) */
function nmGetSession() {
  return JSON.parse(sessionStorage.getItem(NM_SESSION_KEY) || 'null');
}

/**
 * Require auth. Returns profile or redirects.
 */
function nmRequireAuth(requiredRole) {
  const session = nmGetSession();
  const inSub = window.location.pathname.includes('/admin/') ||
                window.location.pathname.includes('/user/');
                
  if (!session) {
    window.location.replace(inSub ? '../login.html' : 'login.html');
    return null;
  }
  
  if (requiredRole && session.role !== requiredRole) {
    if (session.role === 'admin')
      window.location.replace(inSub ? '../admin/' : 'admin/');
    else
      window.location.replace(inSub ? '../user/' : 'user/');
    return null;
  }
  return session;
}

/** Generate initials avatar from name */
function nmGetInitials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

/** 
 * DATA MIGRATION TOOL (Supports Supabase Upsert)
 * Migrates data from legacy and local storage structures.
 */
async function nmMigrateToCloud() {
  console.log('🚀 Starting Cloud Migration...');
  nmToast('Starting cloud migration...', 'info');
  
  try {
    // 1. Schools
    const schools = JSON.parse(localStorage.getItem('nm_schools') || '[]');
    if (schools.length) {
      console.log(`📡 Migrating ${schools.length} schools...`);
      const { error } = await sb.from('schools').upsert(schools.map(s => ({
        id: s.id, name: s.name, code: s.code || '', address: s.address || '',
        principal: s.principal || '', phone: s.phone || '', email: s.email || '',
        udise: s.udise || '', established: s.established || ''
      })));
      if (error) console.error('School migration error:', error);
    }

    // 2. Students
    const students = JSON.parse(localStorage.getItem('nm_students') || '[]');
    if (students.length) {
      console.log(`📡 Migrating ${students.length} students...`);
      const { error } = await sb.from('students').upsert(students.map(s => ({
        id: s.id, school_id: s.schoolId || s.school_id, full_name: s.fullName || s.full_name,
        admission_number: s.admissionNumber || s.admission_number, class: s.class, section: s.section,
        house: s.house, phone: s.phone, dob: s.dob, gender: s.gender, religion: s.religion,
        caste: s.caste, address: s.address, email: s.email, aadhar: s.aadhar,
        pen: s.pen, father_name: s.fatherName || s.father_name, mother_name: s.motherName || s.mother_name,
        medical_history: s.medicalHistory || s.medical_history,
        ncc: !!s.ncc, nss: !!s.nss, sgfi: !!s.sgfi, scouts: !!s.scouts, photo: s.photo
      })));
      if (error) console.error('Student migration error:', error);
    }

    // 3. Observations
    const obs = JSON.parse(localStorage.getItem('nm_observations') || '[]');
    if (obs.length) {
      console.log(`📡 Migrating ${obs.length} observations...`);
      const { error } = await sb.from('observations').upsert(obs.map(o => ({
        id: o.id, student_id: o.studentId || o.student_id, school_id: o.schoolId || o.school_id,
        observation: o.observation, severity: o.severity || 'Normal',
        observation_date: o.date || o.observation_date || nmToday()
      })));
      if (error) console.error('Observation migration error:', error);
    }

    // 4. Counselling
    const cns = JSON.parse(localStorage.getItem('nm_counselling') || '[]');
    if (cns.length) {
      console.log(`📡 Migrating ${cns.length} counselling records...`);
      const { error } = await sb.from('counselling_records').upsert(cns.map(c => ({
        id: c.id, student_id: c.studentId || c.student_id, school_id: c.schoolId || c.school_id,
        issue: c.issue, counselling: c.counselling, status: c.status || 'Resolved',
        follow_up: !!(c.followUp || c.follow_up), record_date: c.date || c.record_date || nmToday()
      })));
      if (error) console.error('Counselling migration error:', error);
    }

    // 5. Movements
    const movs = JSON.parse(localStorage.getItem('nm_movements') || '[]');
    if (movs.length) {
      console.log(`📡 Migrating ${movs.length} movements...`);
      const { error } = await sb.from('movements').upsert(movs.map(m => ({
        id: m.id, student_id: m.studentId || m.student_id, school_id: m.schoolId || m.school_id,
        leave_date: m.leaveDate || m.leave_date, report_date: m.reportDate || m.report_date,
        reason: m.reason, escort_name: m.escortName || m.escort_name, relationship: m.relationship,
        phone: m.phone
      })));
      if (error) console.error('Movement migration error:', error);
    }

    console.log('✅ Migration Complete!');
    nmToast('Migration completed successfully!', 'success');
  } catch (err) {
    console.error('Migration failed fatal:', err);
    nmToast('Migration failed. Check console.', 'error');
  }
}
