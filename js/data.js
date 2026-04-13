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

// ─── ACADEMIC YEARS ──────────────────────────────────────────────────────────
async function nmGetAcademicYears(schoolId) {
  const { data, error } = await sb.from('academic_years').select('*').eq('school_id', schoolId).order('name', { ascending: false });
  if (error) { console.error('Error fetching academic years:', error); return []; }
  return data;
}

async function nmSaveAcademicYear(year) {
  const isNew = !year.id;
  const payload = {
    school_id: year.school_id || year.schoolId,
    name: year.name,
    is_active: !!year.is_active
  };

  if (payload.is_active) {
    // Deactivate others for this school
    await sb.from('academic_years').update({ is_active: false }).eq('school_id', payload.school_id);
  }

  if (!isNew) {
    const { data, error } = await sb.from('academic_years').update(payload).eq('id', year.id).select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await sb.from('academic_years').insert([payload]).select();
    if (error) throw error;
    return data[0];
  }
}

async function nmSetDefaultYear(yearId, schoolId) {
  // Ensure only one is active
  await sb.from('academic_years').update({ is_active: false }).eq('school_id', schoolId);
  const { error } = await sb.from('academic_years').update({ is_active: true }).eq('id', yearId);
  if (error) throw error;
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
async function nmGetStudents(schoolId, academicYearId, force = false) {
  const now = Date.now();
  const cacheKey = `${schoolId || 'all'}_${academicYearId || 'any'}`;
  
  if (!force && nmCache.students[cacheKey] && (now - nmCache.students[cacheKey].timestamp < CACHE_TTL)) {
    return nmCache.students[cacheKey].data;
  }

  let query = sb.from('students').select('*').order('full_name');
  if (schoolId) query = query.eq('school_id', schoolId);
  if (academicYearId) query = query.eq('academic_year_id', academicYearId);
  
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
    photo:  s.photo || null,
    academic_year_id: v(s.academic_year_id || s.academicYearId)
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

/** 
 * Promote Students logic: 
 * CLONES student records into a new Year and increments the Class. 
 */
async function nmPromoteStudents(studentIds, targetYearId) {
  const { data: students, error: fetchErr } = await sb.from('students').select('*').in('id', studentIds);
  if (fetchErr) throw fetchErr;

  const clones = students.map(s => {
    // Increment Class
    let currentClass = parseInt(s.class);
    let nextClass = isNaN(currentClass) ? s.class : (currentClass + 1).toString();
    if (currentClass === 12) nextClass = 'Alumni';

    const { id, created_at, ...rest } = s; // Strip original ID and timestamp
    return {
      ...rest,
      academic_year_id: targetYearId,
      class: nextClass
    };
  });

  const { data, error } = await sb.from('students').insert(clones).select();
  if (error) throw error;
  return data;
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
async function nmGetStats(schoolId, academicYearId) {
  // Use head=true for exact counts without fetching data rows (Very fast)
  const studentQuery = sb.from('students').select('*', { count: 'exact', head: true });
  if (schoolId) studentQuery.eq('school_id', schoolId);
  if (academicYearId) studentQuery.eq('academic_year_id', academicYearId);
  
  const schoolQuery = sb.from('schools').select('*', { count: 'exact', head: true });
  const userQuery = sb.from('profiles').select('*', { count: 'exact', head: true });
  
  const cnsQuery = sb.from('counselling_records').select('*', { count: 'exact', head: true });
  if (schoolId) cnsQuery.eq('school_id', schoolId);
  // Counselling is student-linked, but we might want to filter by year if it was year-bound.
  // Currently, history stays linked to the student record of that year.
  
  const fuQuery = sb.from('counselling_records').select('*', { count: 'exact', head: true }).eq('follow_up', true);
  if (schoolId) fuQuery.eq('school_id', schoolId);

  const maleQuery = sb.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Male');
  if (schoolId) maleQuery.eq('school_id', schoolId);
  if (academicYearId) maleQuery.eq('academic_year_id', academicYearId);

  const femaleQuery = sb.from('students').select('*', { count: 'exact', head: true }).eq('gender', 'Female');
  if (schoolId) femaleQuery.eq('school_id', schoolId);
  if (academicYearId) femaleQuery.eq('academic_year_id', academicYearId);

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

async function nmUpdateProfile(id, updates) {
  const { data, error } = await sb.from('profiles').update(updates).eq('id', id).select();
  if (error) { console.error('Error updating profile:', error); throw error; }
  return data[0];
}

// ─── SUPPORT QUERIES ─────────────────────────────────────────────────────────
async function nmGetSupportQueries() {
  const { data, error } = await sb.from('support_queries').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Error fetching support queries:', error); return []; }
  return data || [];
}

async function nmSaveSupportQuery(q) {
  const payload = {
    school_name: q.schoolName || q.school_name,
    user_name:   q.userName || q.user_name,
    email:       q.email,
    phone:       q.phone,
    query:       q.query,
    status:      q.status || 'pending'
  };
  
  if (q.id) {
    const { data, error } = await sb.from('support_queries').update(payload).eq('id', q.id).select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await sb.from('support_queries').insert([payload]).select();
    if (error) throw error;
    return data[0];
  }
}

async function nmDeleteSupportQuery(id) {
  const { error } = await sb.from('support_queries').delete().eq('id', id);
  if (error) throw error;
}

// ─── TEACHER DIARIES ──────────────────────────────────────────────────────────
async function nmGetTeacherDiaries(userId, schoolId) {
  let query = sb.from('teacher_diaries').select('*').order('diary_date', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  if (schoolId) query = query.eq('school_id', schoolId);
  
  const { data, error } = await query;
  if (error) { console.error('Error fetching teacher diaries:', error); return []; }
  return data || [];
}

async function nmSaveTeacherDiary(diary) {
  const payload = {
    school_id: diary.schoolId,
    user_id: diary.userId,
    teacher_name: diary.teacherName,
    diary_date: diary.diaryDate || nmToday(),
    period: diary.period,
    class: diary.class,
    section: diary.section,
    total_students: diary.totalStudents,
    present: diary.present,
    leave: diary.leave,
    on_duty: diary.onDuty,
    not_reported: diary.notReported,
    topic_discussed: diary.topicDiscussed
  };
  
  if (diary.id) {
    const { data, error } = await sb.from('teacher_diaries').update(payload).eq('id', diary.id).select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await sb.from('teacher_diaries').insert([payload]).select();
    if (error) throw error;
    return data[0];
  }
}

async function nmDeleteTeacherDiary(id) {
  const { error } = await sb.from('teacher_diaries').delete().eq('id', id);
  if (error) throw error;
}
