/**
 * RBU (Ramdeobaba University) Department of AICS
 * B.Tech CSE (AIML) - V Semester Official Timetable Template
 * Session 2026-27 (W.E.F. 20-07-2026)
 */

export function getRbuVSemCourses(section = 'V A') {
  const s = section
  const sec = section.replace(/\s+/g, '')
  const isA = sec.includes('A')
  const isB = sec.includes('B')
  const isC = sec.includes('C')

  const mlFaculty = isC ? ['Prof. A. Gudadhe'] : ['Dr. A. Pimpalkar']
  const cecFaculty = isC ? ['Dr. P. Agarkar'] : ['Prof. H. Patil']
  const cnFaculty = isA ? ['Prof. N. Lanke'] : ['Dr. R. Welekar']
  const oeFaculty = isA ? ['Prof. Karthikeyan V.'] : isB ? ['Prof. A. Lokhande'] : ['Prof. P. Dhule']
  const ideaFaculty = isA ? ['Prof. S. Meshram'] : isB ? ['Prof. A. Lokhande'] : ['Prof. R. Padegaonkar']

  return [
    // Core Theory Courses (3 credits / 3 periods weekly)
    { id: `ML_${sec}`, name: 'Machine Learning (ML)', teachers: mlFaculty, section: s, credits: 3, hours: 3, is_lab: false, elective_group: null },
    { id: `CEC_${sec}`, name: 'Cloud & Edge Computing for AI (C&EC)', teachers: cecFaculty, section: s, credits: 3, hours: 3, is_lab: false, elective_group: null },
    { id: `CN_${sec}`, name: 'Computer Networks (CN)', teachers: cnFaculty, section: s, credits: 3, hours: 3, is_lab: false, elective_group: null },
    
    // Program Elective-I (PDA & IP running in parallel)
    { id: `PE1_PDA_${sec}`, name: 'PDA (Programming for Data Science)', teachers: ['D. Junghare'], section: s, credits: 3, hours: 3, is_lab: false, elective_group: `Group_PE1_${sec}` },
    { id: `PE1_IP_${sec}`, name: 'IP (Image Processing Generative Models)', teachers: ['Prof. S. Meshram'], section: s, credits: 3, hours: 3, is_lab: false, elective_group: `Group_PE1_${sec}` },

    // Open Elective-III & MDM-II
    { id: `OE_${sec}`, name: 'Open Elective-III (OE)', teachers: oeFaculty, section: s, credits: 1, hours: 1, is_lab: false, elective_group: null },
    { id: `MDM_${sec}`, name: 'MDM-II', teachers: ['MDM Faculty'], section: s, credits: 3, hours: 3, is_lab: false, elective_group: null },

    // Idea Lab (2 periods)
    { id: `IDEA_${sec}`, name: 'Idea Lab', teachers: ideaFaculty, section: s, credits: 1, hours: 2, is_lab: true, elective_group: null },

    // Parallel Batch Labs: Batch 1 (A1/A2 vs A3/A4)
    { id: `CN_LAB1_${sec}`, name: 'CN Lab (Batch 1)', teachers: isA ? ['Prof. N. Lanke', 'Dr. P. Agarkar'] : ['Dr. P. Agarkar', 'Prof. R. Padegaonkar'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_CN_CEC_1_${sec}` },
    { id: `CEC_LAB1_${sec}`, name: 'C&EC Lab (Batch 2)', teachers: ['Prof. H. Patil', 'Prof. P. Dhule'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_CN_CEC_1_${sec}` },

    // Parallel Batch Labs: Batch 2 (A3/A4 vs A1/A2)
    { id: `CN_LAB2_${sec}`, name: 'CN Lab (Batch 2)', teachers: isA ? ['Prof. N. Lanke', 'Dr. P. Agarkar'] : ['Dr. P. Agarkar', 'Prof. R. Padegaonkar'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_CN_CEC_2_${sec}` },
    { id: `CEC_LAB2_${sec}`, name: 'C&EC Lab (Batch 1)', teachers: ['Prof. H. Patil', 'Prof. P. Dhule'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_CN_CEC_2_${sec}` },

    // Parallel Batch Labs: ML Lab vs DAV Lab (Batch 1)
    { id: `ML_LAB1_${sec}`, name: 'ML Lab (Batch 1)', teachers: ['Dr. A. Pimpalkar', 'Prof. A. Gudadhe'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_ML_DAV_1_${sec}` },
    { id: `DAV_LAB1_${sec}`, name: 'DAV Lab (Batch 2)', teachers: ['Prof. Karthikeyan V.', 'Prof. S. Meshram'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_ML_DAV_1_${sec}` },

    // Parallel Batch Labs: ML Lab vs DAV Lab (Batch 2)
    { id: `ML_LAB2_${sec}`, name: 'ML Lab (Batch 2)', teachers: ['Dr. A. Pimpalkar', 'Prof. A. Gudadhe'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_ML_DAV_2_${sec}` },
    { id: `DAV_LAB2_${sec}`, name: 'DAV Lab (Batch 1)', teachers: ['Prof. Karthikeyan V.', 'Prof. S. Meshram'], section: s, credits: 1, hours: 2, is_lab: true, elective_group: `LAB_ML_DAV_2_${sec}` },
  ]
}

export const samplePayload = {
  num_days: 6,
  num_periods: 8,
  sections: ['V A', 'V B', 'V C'],
  teachers: [
    'Dr. A. Pimpalkar',
    'Prof. A. Gudadhe',
    'Prof. H. Patil',
    'Prof. P. Dhule',
    'Prof. N. Lanke',
    'Dr. R. Welekar',
    'Dr. P. Agarkar',
    'Prof. R. Padegaonkar',
    'Prof. Karthikeyan V.',
    'Prof. S. Meshram',
    'Prof. A. Lokhande',
    'D. Junghare',
    'MDM Faculty'
  ],
  rooms: [
    'DT-403',
    'DT-406',
    'DT-612',
    'DT-609 (Lab)',
    'DT-509 (Lab)',
    'DT-409 (Lab)',
    'DT-405 (Lab)'
  ],
  courses: [
    ...getRbuVSemCourses('V A'),
    ...getRbuVSemCourses('V B'),
    ...getRbuVSemCourses('V C'),
  ],
}

export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
