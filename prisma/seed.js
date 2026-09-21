const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Insolvency & Restructuring Portal database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@resolve.com' },
    update: {},
    create: {
      name: 'Resolve Platform Admin',
      email: 'admin@resolve.com',
      password: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Admin seeded:', admin.email);

  // 2. Create Skills
  const skillNames = [
    'Insolvency',
    'CIRP',
    'Liquidation',
    'NCLT',
    'NCLAT',
    'Restructuring',
    'Financial Due Diligence',
    'Forensic Audit',
    'IBBI Regulations',
    'Section 29A Evaluation',
    'Claims Management',
    'Resolution Planning',
    'Stressed Asset Valuation',
    'IBC Law',
  ];

  const skills = [];
  for (const name of skillNames) {
    const s = await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    skills.push(s);
  }
  console.log(`Seeded ${skills.length} skills`);

  // 3. Create Employers & Organisations
  const employersData = [
    {
      orgName: 'Arcil (Asset Reconstruction Company India Ltd)',
      type: 'ARC',
      description: 'Pioneer asset reconstruction company in India managing stressed and non-performing corporate assets.',
      website: 'https://www.arcil.co.in',
      location: 'Mumbai, Maharashtra',
      userEmail: 'hr@arcil.co.in',
      userName: 'Suresh Menon (HR Head)',
      status: 'APPROVED',
    },
    {
      orgName: 'Alvarez & Marsal India',
      type: 'CONSULTING_FIRM',
      description: 'Global professional services firm notable for turnaround management and performance improvement.',
      website: 'https://www.alvarezandmarsal.com',
      location: 'Mumbai / Delhi NCR',
      userEmail: 'recruiting@alvarezandmarsal.com',
      userName: 'Pooja Kapoor (Talent Acquisition)',
      status: 'APPROVED',
    },
    {
      orgName: 'Cyril Amarchand Mangaldas',
      type: 'LAW_FIRM',
      description: 'Premier full-service Indian law firm with dominant leadership in Insolvency & Bankruptcy Code practice.',
      website: 'https://www.cyrilshroff.com',
      location: 'New Delhi / Mumbai',
      userEmail: 'careers@cyrilamarchand.com',
      userName: 'Arjun Deshmukh (Partner - IBC Practice)',
      status: 'APPROVED',
    },
    {
      orgName: 'BDO India Restructuring Advisory',
      type: 'CA_FIRM',
      description: 'Specialised insolvency resolution advisory, liquidation support, and forensic audit for financial institutions.',
      website: 'https://www.bdo.in',
      location: 'Gurugram / Bengaluru',
      userEmail: 'hiring@bdoindia.in',
      userName: 'Meenakshi Sundaram (Director - Restructuring)',
      status: 'APPROVED',
    },
    {
      orgName: 'Apex Stressed Assets Recovery Fund',
      type: 'RESOLUTION_APPLICANT',
      description: 'Special situations investment fund acquiring and turning around stressed manufacturing and infra assets.',
      website: 'https://www.apexdistressed.com',
      location: 'Hyderabad, Telangana',
      userEmail: 'contact@apexdistressed.com',
      userName: 'Kalyan Rao',
      status: 'PENDING',
    },
    {
      orgName: 'State Bank of India (SAMB Division)',
      type: 'BANK',
      description: 'Stressed Assets Management Branch managing resolution of large corporate loan exposures.',
      website: 'https://sbi.co.in',
      location: 'Mumbai, Maharashtra',
      userEmail: 'samb.recruitment@sbi.co.in',
      userName: 'Rajiv Mathur (DGM SAMB)',
      status: 'APPROVED',
    },
  ];

  const seededEmployers = [];
  for (const emp of employersData) {
    const user = await prisma.user.upsert({
      where: { email: emp.userEmail },
      update: {},
      create: {
        name: emp.userName,
        email: emp.userEmail,
        password: passwordHash,
        role: 'EMPLOYER',
        status: 'ACTIVE',
      },
    });

    let employer = await prisma.employer.findFirst({
      where: { name: emp.orgName },
    });

    if (!employer) {
      employer = await prisma.employer.create({
        data: {
          name: emp.orgName,
          type: emp.type,
          description: emp.description,
          website: emp.website,
          location: emp.location,
          status: emp.status,
          members: {
            create: {
              userId: user.id,
              role: 'ADMIN',
            },
          },
        },
      });
    }
    seededEmployers.push(employer);
  }
  console.log(`Seeded ${seededEmployers.length} employers`);

  // 4. Create Candidates & Profiles
  const candidatesData = [
    {
      name: 'Rajesh Mehta',
      email: 'rajesh.mehta@example.com',
      phone: '+91 98201 12345',
      city: 'Mumbai',
      designation: 'Insolvency Professional & Senior CA',
      experience: 9,
      currentSalary: 2800000,
      expectedSalary: 3500000,
      noticePeriod: '30 Days',
      skills: ['Insolvency', 'CIRP', 'Liquidation', 'NCLT', 'Section 29A Evaluation'],
      educations: [
        { qualification: 'CA', degree: 'Chartered Accountant', institution: 'ICAI', startYear: 2011, completionYear: 2015 },
        { qualification: 'IBBI Registration', degree: 'Insolvency Professional', institution: 'IBBI', startYear: 2018, completionYear: 2018 },
      ],
      experiences: [
        { organisation: 'PwC India', designation: 'Manager - Deals & Restructuring', isCurrent: true, description: 'Handled 4 full CIRP processes of medium & large enterprises in metals and EPC.' },
        { organisation: 'Deloitte Touche Tohmatsu', designation: 'Senior Consultant', isCurrent: false, description: 'Forensic audits and financial modeling for Section 29A eligibility assessments.' },
      ],
    },
    {
      name: 'Advocate Ananya Verma',
      email: 'ananya.verma@example.com',
      phone: '+91 98110 54321',
      city: 'New Delhi',
      designation: 'Senior Legal Associate (IBC & NCLT)',
      experience: 5,
      currentSalary: 1800000,
      expectedSalary: 2400000,
      noticePeriod: 'Immediate',
      skills: ['IBC Law', 'NCLT', 'NCLAT', 'Resolution Planning', 'Claims Management'],
      educations: [
        { qualification: 'LLB', degree: 'Bachelor of Laws', institution: 'National Law University, Delhi', startYear: 2014, completionYear: 2019 },
      ],
      experiences: [
        { organisation: 'Khaitan & Co', designation: 'Associate - Dispute Resolution', isCurrent: true, description: 'Drafted Section 7 & 9 applications, argued interim applications at NCLT Principal Bench.' },
      ],
    },
    {
      name: 'Vikram Singhania',
      email: 'vikram.singhania@example.com',
      phone: '+91 97400 98765',
      city: 'Bengaluru',
      designation: 'Restructuring Analyst',
      experience: 3,
      currentSalary: 1200000,
      expectedSalary: 1600000,
      noticePeriod: '15 Days',
      skills: ['Financial Due Diligence', 'Restructuring', 'Stressed Asset Valuation', 'Forensic Audit'],
      educations: [
        { qualification: 'CFA & B.Com', degree: 'CFA Level 2, B.Com (Hons)', institution: 'Christ University', startYear: 2017, completionYear: 2020 },
      ],
      experiences: [
        { organisation: 'Grant Thornton Bharat', designation: 'Analyst - Recovery & Reorganisation', isCurrent: true, description: 'Information memorandum preparation, cash flow monitoring of corporate debtors.' },
      ],
    },
    {
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91 99300 11223',
      city: 'Mumbai',
      designation: 'Company Secretary & Compliance Officer',
      experience: 6,
      currentSalary: 1500000,
      expectedSalary: 2000000,
      noticePeriod: '60 Days',
      skills: ['IBBI Regulations', 'Claims Management', 'Insolvency', 'CIRP'],
      educations: [
        { qualification: 'CS', degree: 'Company Secretary', institution: 'ICSI', startYear: 2013, completionYear: 2017 },
      ],
      experiences: [
        { organisation: 'Shardul Amarchand Mangaldas', designation: 'Senior Compliance Executive', isCurrent: true, description: 'Coordinated Committee of Creditors (CoC) voting compliance and statutory filings.' },
      ],
    },
  ];

  const seededCandidates = [];
  for (const c of candidatesData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        name: c.name,
        email: c.email,
        password: passwordHash,
        role: 'CANDIDATE',
        status: 'ACTIVE',
      },
    });

    let profile = await prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.candidateProfile.create({
        data: {
          userId: user.id,
          phone: c.phone,
          city: c.city,
          designation: c.designation,
          experience: c.experience,
          currentSalary: c.currentSalary,
          expectedSalary: c.expectedSalary,
          noticePeriod: c.noticePeriod,
          educations: {
            create: c.educations,
          },
          experiences: {
            create: c.experiences,
          },
        },
      });

      // Link skills
      for (const skName of c.skills) {
        const foundSkill = skills.find((s) => s.name === skName);
        if (foundSkill) {
          await prisma.candidateSkill.create({
            data: {
              candidateProfileId: profile.id,
              skillId: foundSkill.id,
            },
          });
        }
      }
    }
    seededCandidates.push(user);
  }
  console.log(`Seeded ${seededCandidates.length} candidate profiles`);

  // 5. Create Jobs
  const jobsData = [
    {
      title: 'Lead Resolution Professional - Real Estate CIRP',
      description: 'Lead the corporate insolvency resolution process for an ongoing Tier-1 real estate project under NCLT New Delhi. Oversee CoC meetings, claim evaluations, forensic audits, and preparation of resolution plan evaluations.',
      requirements: 'Valid IBBI Registration, 5+ years post-qualification experience in IBC, proven track record with real estate / infrastructure CIRP mandates.',
      employerIndex: 0, // Arcil
      status: 'ACTIVE',
      jobType: 'MANDATE_BASED',
      salaryRange: 'RANGE_25_TO_40_LPA',
      experienceLevel: 'SENIOR_LEVEL',
      skillIndices: [0, 1, 3, 8, 9],
    },
    {
      title: 'Senior Associate - Turnaround & Restructuring Advisory',
      description: 'Deliver financial reviews, liquidity monitoring, business turnaround advisory, and distressed asset valuation for banking clients and resolution applicants.',
      requirements: 'Chartered Accountant (CA) or MBA Finance with 3-6 years of experience in corporate restructuring, stressed debt underwriting, or transaction advisory.',
      employerIndex: 1, // Alvarez & Marsal
      status: 'ACTIVE',
      jobType: 'FULL_TIME',
      salaryRange: 'RANGE_18_TO_25_LPA',
      experienceLevel: 'MID_LEVEL',
      skillIndices: [0, 5, 6, 7, 11],
    },
    {
      title: 'Insolvency & Bankruptcy Legal Counsel / Associate',
      description: 'Represent creditors, resolution professionals, and bidders in NCLT and NCLAT proceedings. Formulate litigation strategies and draft Section 7/9/10/60 applications.',
      requirements: 'LLB / LLM with 3-7 years in commercial litigation and IBC practice. Excellent court pleading and legal drafting capability.',
      employerIndex: 2, // Cyril Amarchand
      status: 'ACTIVE',
      jobType: 'CONTRACT',
      salaryRange: 'RANGE_12_TO_18_LPA',
      experienceLevel: 'MID_LEVEL',
      skillIndices: [3, 4, 13, 10],
    },
    {
      title: 'Manager - Stressed Asset Due Diligence & Claims',
      description: 'Collate, verify and determine financial, operational and statutory claims received during CIRP. Coordinate forensic audit teams and prepare Information Memorandums.',
      requirements: 'CA/CS with 4+ years of relevant experience in claims verification and statutory reporting under IBBI regulations.',
      employerIndex: 3, // BDO India
      status: 'ACTIVE',
      jobType: 'PART_TIME',
      salaryRange: 'RANGE_12_TO_18_LPA',
      experienceLevel: 'MID_LEVEL',
      skillIndices: [0, 1, 8, 10],
    },
    {
      title: 'Chief Risk & Recovery Manager (SAMB)',
      description: 'Supervise large NPA portfolio accounts, evaluate one-time settlement (OTS) proposals, and coordinate with NCLT counsels and resolution professionals.',
      requirements: 'Senior banking professional with 10+ years experience in corporate recovery, stressed assets, or SARFAESI/IBC enforcement.',
      employerIndex: 5, // SBI SAMB
      status: 'ACTIVE',
      jobType: 'FULL_TIME',
      salaryRange: 'RANGE_25_TO_40_LPA',
      experienceLevel: 'DIRECTOR_EXECUTIVE',
      skillIndices: [0, 5, 8, 12],
    },
    {
      title: 'IBC & Restructuring Legal Intern',
      description: 'Assist Senior Insolvency Associates with research on NCLT & NCLAT judicial precedents, proof of claim verifications, and drafting CIRP compliance notices.',
      requirements: 'Final-year Law / CA student with strong academic understanding of IBC 2016 and Company Law.',
      employerIndex: 2, // Cyril Amarchand
      status: 'ACTIVE',
      jobType: 'INTERNSHIP',
      salaryRange: 'UNDER_6_LPA',
      experienceLevel: 'ENTRY_LEVEL',
      skillIndices: [3, 4, 10],
    },
  ];

  const seededJobs = [];
  for (const jd of jobsData) {
    const employer = seededEmployers[jd.employerIndex];
    if (!employer) continue;

    let job = await prisma.job.findFirst({
      where: { title: jd.title, employerId: employer.id },
    });

    if (!job) {
      job = await prisma.job.create({
        data: {
          title: jd.title,
          description: jd.description,
          requirements: jd.requirements,
          status: jd.status,
          jobType: jd.jobType || 'FULL_TIME',
          salaryRange: jd.salaryRange || 'NEGOTIABLE',
          experienceLevel: jd.experienceLevel || 'MID_LEVEL',
          employerId: employer.id,
        },
      });

      for (const sIdx of jd.skillIndices) {
        if (skills[sIdx]) {
          await prisma.jobSkill.create({
            data: {
              jobId: job.id,
              skillId: skills[sIdx].id,
            },
          });
        }
      }
    }
    seededJobs.push(job);
  }
  console.log(`Seeded ${seededJobs.length} jobs`);

  // 6. Create Applications
  const applicationsData = [
    { candidateIdx: 0, jobIdx: 0, status: 'INTERVIEW' },
    { candidateIdx: 1, jobIdx: 2, status: 'SHORTLISTED' },
    { candidateIdx: 2, jobIdx: 1, status: 'APPLIED' },
    { candidateIdx: 3, jobIdx: 3, status: 'SELECTED' },
    { candidateIdx: 0, jobIdx: 1, status: 'APPLIED' },
    { candidateIdx: 2, jobIdx: 4, status: 'REJECTED' },
  ];

  for (const app of applicationsData) {
    const cand = seededCandidates[app.candidateIdx];
    const j = seededJobs[app.jobIdx];
    if (cand && j) {
      const existing = await prisma.application.findFirst({
        where: { candidateId: cand.id, jobId: j.id },
      });
      if (!existing) {
        await prisma.application.create({
          data: {
            candidateId: cand.id,
            jobId: j.id,
            status: app.status,
          },
        });
      }
    }
  }
  console.log('Seeded applications');

  // 7. Create Reports
  const reportsData = [
    {
      reporterId: seededCandidates[0]?.id || 1,
      type: 'Fake job',
      description: 'Mandate lists misleading CIRP case details that concluded last year at NCLT Chandigarh.',
      status: 'OPEN',
    },
    {
      reporterId: seededCandidates[1]?.id || 1,
      type: 'Spam',
      description: 'Multiple duplicate postings for the same Restructuring Consultant role from an unverified agency.',
      status: 'INVESTIGATING',
    },
    {
      reporterId: seededCandidates[2]?.id || 1,
      type: 'Inappropriate content',
      description: 'Unauthorised disclosure of confidential creditor claims list in the job requirements description.',
      status: 'RESOLVED',
    },
    {
      reporterId: seededCandidates[3]?.id || 1,
      type: 'Fake organisation',
      description: 'Entity claiming to be an IBBI registered IPE without valid registration certificate or partner details.',
      status: 'OPEN',
    },
  ];

  for (const rep of reportsData) {
    const existing = await prisma.report.findFirst({
      where: { description: rep.description },
    });
    if (!existing) {
      await prisma.report.create({
        data: rep,
      });
    }
  }
  console.log('Seeded moderation reports');

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
