// Everything the university needs to change lives here. All values are placeholders.
export const CONFIG = {
  // While true, the site tells people not to enter real details.
  testMode: false,

  university: { th: 'มหาวิทยาลัยเกษมบัณฑิต', en: 'Kasem Bundit University', monogram: 'KBU' },
  // Path to a square logo in /public, such as 'logo.png'. null draws the monogram instead.
  logoUrl: null,
  event: { th: 'งาน Open House', en: 'Open House' },
  eventDate: { th: 'วันที่จัดงาน', en: 'Event date' },
  admissionsText: 'KBU DTI International Program',

  // Where follow-up entries go. The publishable key is meant to be public: the database only
  // lets it call the functions in supabase/migrations. Set to null to use the local test server.
  supabase: {
    url: 'https://fdiswbnjmahwzvifyymv.supabase.co',
    publishableKey: 'sb_publishable_FICwgzzsX-kX0m_Dhzce2g_uAT0snn1',
  },

  privacyContact: 'privacy@example.com',
  // Change this whenever the consent wording changes. Each entry records the version it agreed to.
  noticeVersion: 'draft-1',

  programs: [
    { id: 'dti', th: 'วิทยาศาสตรบัณฑิต สาขาวิชานวัตกรรมเทคโนโลยีดิจิทัล', en: 'B.Sc. in Digital Technology Innovation' },
    { id: 'thai-foreigners', th: 'ศิลปศาสตรบัณฑิต สาขาวิชาภาษาไทยสำหรับชาวต่างชาติ', en: 'B.A. in Thai Language for Foreigners' },
    { id: 'hotel-restaurant', th: 'ศิลปศาสตรบัณฑิต สาขาวิชาการจัดการโรงแรมและร้านอาหาร', en: 'B.A. in Hotel and Restaurant Management' },
    { id: 'civil-eng', th: 'วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมโยธา', en: 'B.Eng. in Civil Engineering' },
    { id: 'lang-comm-intl', th: 'ศิลปศาสตรบัณฑิต สาขาวิชาภาษาเพื่อการสื่อสาร (หลักสูตรนานาชาติ)', en: 'B.A. in Language for Communication (International Program)' },
    { id: 'aviation-intl', th: 'บริหารธุรกิจบัณฑิต สาขาวิชาการจัดการอุตสาหกรรมการบิน (หลักสูตรนานาชาติ)', en: 'BBA in Aviation Industry Management (International Program)' },
    { id: 'mgmt-entrepreneur', th: 'บริหารธุรกิจบัณฑิต สาขาวิชาการจัดการและการเป็นผู้ประกอบการ', en: 'BBA in Management and Entrepreneurship' },
    { id: 'fashion-design', th: 'ศิลปศาสตรบัณฑิต สาขาวิชาการออกแบบแฟชั่น', en: 'B.A. in Fashion Design' },
    { id: 'lang-comm', th: 'ศิลปศาสตรบัณฑิต สาขาวิชาภาษาเพื่อการสื่อสาร', en: 'B.A. in Language for Communication' },
    { id: 'undecided', th: 'ยังไม่แน่ใจ', en: 'Not sure yet' },
  ],
};
