// Everything the university needs to change lives here. All values are placeholders.
export const CONFIG = {
  // While true, the site tells people not to enter real details.
  testMode: true,

  university: { th: 'มหาวิทยาลัยตัวอย่าง', en: 'Example University', monogram: 'EU' },
  // Path to a square logo in /public, such as 'logo.png'. null draws the monogram instead.
  logoUrl: null,
  event: { th: 'งาน Open House', en: 'Open House' },
  eventDate: { th: 'วันที่จัดงาน', en: 'Event date' },
  admissionsText: 'example.com/admissions',

  privacyContact: 'privacy@example.com',
  // Change this whenever the consent wording changes. Each entry records the version it agreed to.
  noticeVersion: 'draft-1',

  programs: [
    { id: 'program-a', th: 'หลักสูตรตัวอย่าง A', en: 'Example program A' },
    { id: 'program-b', th: 'หลักสูตรตัวอย่าง B', en: 'Example program B' },
    { id: 'program-c', th: 'หลักสูตรตัวอย่าง C', en: 'Example program C' },
    { id: 'undecided', th: 'ยังไม่แน่ใจ', en: 'Not sure yet' },
  ],
};
