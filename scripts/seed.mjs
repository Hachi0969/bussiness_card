// Adds obviously fake entries to the local test database.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { insertLead, openDatabase } from '../server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = openDatabase(process.env.DB_PATH ?? join(root, 'data', 'test-leads.sqlite'));

const rows = [
  { name: 'นักเรียนทดสอบ หนึ่ง', grade: 12, programId: 'program-a', contactMethod: 'line', contactValue: 'test.student1' },
  { name: 'นักเรียนทดสอบ สอง', grade: 11, programId: 'program-b', contactMethod: 'phone', contactValue: '0800000002', status: 'contacted' },
  { name: 'Test Student Three', grade: 10, programId: 'undecided', contactMethod: 'email', contactValue: 'student3@example.com', status: 'interested' },
  { name: 'Test Student Four', grade: 9, programId: 'program-c', contactMethod: 'email', contactValue: 'student4@example.com', status: 'do_not_contact' },
];

for (const row of rows) insertLead(db, row);
console.log(`Added ${rows.length} test entries.`);
