'use strict';

/**
 * NobleMinds Data Module (Supabase Optimized)
 * All functions are now ASYNCHRONOUS.
 */

// ─── CACHE & REALTIME ──────────────────────────────────────────────────────────
const nmCache = {
  students: {},    // { [schoolId]: { data: [], timestamp: 0 } }
  schools: { data: [], timestamp: 0 },
  stats: { data: {}, timestamp: 0 }
};
const CACHE_TTL = 30000; // 30 seconds

/** Generic subscription helper */
function nmSubscribe(table, schoolId, callback) {
  const channel = sb.channel(`public:${table}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: table,
      filter: schoolId ? `school_id=eq.${schoolId}` : undefined
    }, (payload) => {
      console.log(`[Realtime] ${table} changed:`, payload);
      // Invalidate cache for this school/table
      if (schoolId) delete nmCache.students[schoolId];
      else if (table === 'schools') nmCache.schools.timestamp = 0;
      
      callback(payload);
    })
    .subscribe();
    
  return channel;
}

// ─── SCHOOLS ──────────────────────────────────────────────────────────────────
async function nmGetSchools(force = false) {
  const now = Date.now();
  if (!force && nmCache.schools.data.length && (now - nmCache.schools.timestamp < CACHE_TTL)) {
    return nmCache.schools.data;
  }

  const { data, error } = await sb.from('schools').select('*').order('name');
  if (error) { console.error('Error fetching schools:', error); return []; }
  
  nmCache.schools.data = data;
  nmCache.schools.timestamp = now;
  return data;
}

async function nmSaveSchool(school) {
  const isNew = !school.id;
  const payload = {
    udise:     school.udise,
    name:      school.name,
    code:      school.code,
    address:   school.address,
    principal: school.principal,
    phone:     school.phone,
    email:     school.email,
    established: school.established
  };

  if (!isNew) {
    const { data, error } = await sb.from('schools').update(payload).eq('id', school.id).select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await sb.from('schools').insert([payload]).select();
    if (error) throw error;
    return data[0];
  }
}

async function nmDeleteSchool(id) {
  const { error } = await sb.from('schools').delete().eq('id', id);
  if (error) throw error;
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
async function nmGetStudents(schoolId, force = false) {
  const now = Date.now();
  const cacheKey = schoolId || 'all';
  
  if (!force && nmCache.students[cacheKey] && (now - nmCache.students[cacheKey].timestamp < CACHE_TTL)) {
    return nmCache.students[cacheKey].data;
  }

  let query = sb.from('students').select('*').order('full_name');
  if (schoolId) query = query.eq('school_id', schoolId);
  
  const { data, error } = await query;
  if (error) { console.error('Error fetching students:', error); return []; }
  
  nmCache.students[cacheKey] = { data, timestamp: now };
  return data;
}

async function nmSaveStudent(s) {
  // Helper: convert empty strings to null so Supabase doesn't reject typed columns
  const v = val => (val === '' || val === undefined) ? null : val;

  const isNew = !s.id;
  const payload = {
    school_id:        v(s.school_id || s.schoolId),
    admission_number: v(s.admission_number || s.admissionNumber),
    full_name:        v(s.full_name || s.fullName),
    class:            v(s.class),
    section:          v(s.section),
    house:            v(s.house),
    dob:              v(s.dob),                   // DATE - must be null not ""
    gender:           v(s.gender),
    religion:         v(s.religion),
    caste:            v(s.caste),
    address:          v(s.address),
    phone:            v(s.phone),
    email:            v(s.email),
    aadhar:           v(s.aadhar),
    apaar_number:     v(s.apaar_number || s.apaarNumber),
    pen:              v(s.pen),
    father_name:      v(s.father_name || s.fatherName),
    father_phone:     v(s.father_phone || s.fatherPhone),
    mother_name:      v(s.mother_name || s.motherName),
    mother_phone:     v(s.mother_phone || s.motherPhone),
    medical_history:  v(s.medical_history || s.medicalHistory),
    ncc:    !!s.ncc,
    nss:    !!s.nss,
    sgfi:   !!s.sgfi,
    scouts: !!s.scouts,
    photo:  s.photo || null
  };

  console.log('[nmSaveStudent] payload:', payload);

  if (!isNew) {
    const { data, error } = await sb.from('students').update(payload).eq('id', s.id).select();
    if (error) { console.error('[nmSaveStudent] update error:', error); throw error; }
    return data[0];
  } else {
    const { data, error } = await sb.from('students').insert([payload]).select();
    if (error) { console.error('[nmSaveStudent] insert error:', error); throw error; }
    return data[0];
  }
}

async function nmDeleteStudent(id) {
  // Cascading deletes for related records
  await Promise.all([
    sb.from('observations').delete().eq('student_id', id),
    sb.from('counselling_records').delete().eq('student_id', id),
    sb.from('movements').delete().eq('student_id', id)
  ]);
  
  // Delete the actual student record
  await sb.from('students').delete().eq('id', id);
}

// ─── OBSERVATIONS ─────────────────────────────────────────────────────────────
async function nmGetObservations(id, isSchool = true) {
  let query = sb.from('observations').select('*').order('observation_date', { ascending: false });
  if (id) {
    if (isSchool) query = query.eq('school_id', id);
    else query = query.eq('student_id', id);
  }
  const { data, error } = await query;
  return data || [];
}
async function nmSaveObservation(obs) {
  const payload = {
    student_id: obs.student_id || obs.studentId,
    school_id: obs.school_id || obs.schoolId,
    observation: obs.observation,
    severity: obs.severity || 'Normal',
    observation_date: obs.date || obs.observation_date || nmToday()
  };
  if (obs.id) {
    const { data, error } = await sb.from('observations').update(payload).eq('id', obs.id).select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await sb.from('observations').insert([payload]).select();
    if (error) throw error;
    return data[0];
  }
}

// ─── COUNSELLING ──────────────────────────────────────────────────────────────
async function nmGetCounselling(id, isSchool = true) {
  let query = sb.from('counselling_records').select('*').order('record_date', { ascending: false });
  if (id) {
    if (isSchool) query = query.eq('school_id', id);
    else query = query.eq('student_id', id);
  }
  const { data, error } = await query;
  return data || [];
}
async function nmSaveCounselling(rec) {
  const payload = {
    student_id: rec.student_id || rec.studentId,
    school_id: rec.school_id || rec.schoolId,
    issue: rec.issue,
    counselling: rec.counselling,
    status: rec.status,
    follow_up: !!(rec.follow_up || rec.followUp),
    record_date: rec.date || rec.record_date || nmToday()
  };
  if (rec.id) {
    const { data, error } = await sb.from('counselling_records').update(payload).eq('id', rec.id).select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await sb.from('counselling_records').insert([payload]).select();
    if (error) throw error;
    return data[0];
  }
}

// ─── MOVEMENTS ────────────────────────────────────────────────────────────────
async function nmGetMovements(id, isSchool = true) {
  let query = sb.from('movements').select('*').order('leave_date', { ascending: false });
  if (id) {
    if (isSchool) query = query.eq('school_id', id);
    else query = query.eq('student_id', id);
  }
  const { data, error } = await query;
  return data || [];
}
async function nmSaveMovement(mov) {
  const payload = {
    student_id: mov.student_id || mov.studentId,
    school_id: mov.school_id || mov.schoolId,
    leave_date: mov.leave_date || mov.leaveDate,
    report_date: mov.report_date || mov.reportDate,
    reason: mov.reason,
    escort_name: mov.escort_name || mov.escortName,
    relationship: mov.relationship,
    phone: mov.phone
  };
  if (mov.id) {
    const { data, error } = await sb.from('movements').update(payload).eq('id', mov.id).select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await sb.from('movements').insert([payload]).select();
    if (error) throw error;
    return data[0];
  }
}

// ─── REGISTRATION REQUESTS ───────────────────────────────────────────────────
async function nmGetRegistrationRequests() {
  const { data, error } = await sb.from('registration_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  return data || [];
}
async function nmSaveRegistrationRequest(req) {
  const payload = {
    udise:       req.udise,
    school_name: req.schoolName || req.school_name,
    address:     req.address,
    admin_name:  req.name || req.admin_name,
    email:       req.email,
    phone:       req.phone,
    status:      'pending'
  };
  const { data, error } = await sb.from('registration_requests').insert([payload]).select();
  if (error) throw error;
  return data[0];
}
async function nmProcessRegistrationRequest(requestId, approve = true) {
  if (approve) {
    const { data: req, error: fetchErr } = await sb.from('registration_requests').select('*').eq('id', requestId).single();
    if (fetchErr) throw fetchErr;

    if (req) {
      // 1. Create the School record
      const school = await nmSaveSchool({
        name: req.school_name,
        udise: req.udise,
        address: req.address,
        email: req.email,
        phone: req.phone,
        principal: req.admin_name
      });

      // 2. Create/Update the Profile record for the administrator
      // We look for the profile by email since we don't have the UID in the request.
      const { data: profile, error: pError } = await sb.from('profiles').select('*').eq('email', req.email).single();
      
      if (profile) {
        await sb.from('profiles').update({
          school_id: school.id,
          school_name: school.name,
          role: 'user' // School admin
        }).eq('id', profile.id);
      } else {
        console.warn('No profile found for email:', req.email);
        // If profile doesn't exist yet, it will be created when they sign up or we can't do much here.
      }
      console.log('Processed school and profile linking for request:', school.id);
    }
  }
  const { error: updErr } = await sb.from('registration_requests').update({ status: approve ? 'approved' : 'rejected' }).eq('id', requestId);
  if (updErr) throw updErr;
}

// ─── STATS ────────────────────────────────────────────────────────────────────
async function nmGetStats(schoolId) {
  // Use head=true for exact counts without fetching data rows (Very fast)
  const studentQuery = sb.from('students').select('*', { count: 'exact', head: true });
  if (schoolId) studentQuery.eq('school_id', schoolId);
  
  const schoolQuery = sb.from('schools').select('*', { count: 'exact', head: true });
  const userQuery = sb.from('profiles').select('*', { count: 'exact', head: true });
  
  const cnsQuery = sb.from('counselling_records').select('*', { count: 'exact', head: true });
  if (schoolId) cnsQuery.eq('school_id', schoolId);
  
  const fuQuery = sb.from('counselling_records').select('*', { count: 'exact', head: true }).eq('follow_up', true);
  if (schoolId) fuQuery.eq('school_id', schoolId);

  const maleQuery = sb.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Male');
  if (schoolId) maleQuery.eq('school_id', schoolId);

  const femaleQuery = sb.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Female');
  if (schoolId) femaleQuery.eq('school_id', schoolId);

  const [
    { count: totalStudents },
    { count: totalSchools },
    { count: totalUsers },
    { count: cnsCount },
    { count: fuCount },
    { count: maleCount },
    { count: femaleCount }
  ] = await Promise.all([
    studentQuery, schoolQuery, userQuery, cnsQuery, fuQuery, maleQuery, femaleQuery
  ]);

  return {
    total: totalStudents || 0,
    schools: totalSchools || 0,
    users: totalUsers || 0,
    counselling: { 
      total: cnsCount || 0,
      followUps: fuCount || 0 
    },
    genders: { Male: maleCount || 0, Female: femaleCount || 0 }
  };
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
async function nmGetStudentHistory(studentId) {
  const [obs, cns, mov] = await Promise.all([
    nmGetObservations(studentId, false),
    nmGetCounselling(studentId, false),
    nmGetMovements(studentId, false)
  ]);
  
  const history = [
    ...obs.map(o => ({ ...o, type: 'observation', date: o.observation_date })),
    ...cns.map(c => ({ ...c, type: 'counselling', date: c.record_date })),
    ...mov.map(m => ({ ...m, type: 'movement', date: m.leave_date }))
  ];
  
  return history.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ─── USERS / PROFILES ────────────────────────────────────────────────────────
async function nmGetUsers() {
  const { data, error } = await sb.from('profiles').select('*').order('name');
  if (error) { console.error('Error fetching users:', error); return []; }
  return data;
}
