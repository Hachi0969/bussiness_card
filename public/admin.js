import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not interested',
  do_not_contact: 'Stop contacting',
};
const METHOD_LABELS = { phone: 'Phone', email: 'Email', line: 'LINE' };

// The token is kept in memory only, so closing the page signs staff out.
let token = '';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'That token isn’t right.' : 'Something went wrong. Please try again.');
  return response.json();
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function renderRow(lead) {
  const row = document.createElement('tr');
  const program = CONFIG.programs.find((p) => p.id === lead.program_id)?.en ?? lead.program_id;

  const select = document.createElement('select');
  select.setAttribute('aria-label', `Status for ${lead.name}`);
  Object.entries(STATUS_LABELS).forEach(([value, label]) => select.add(new Option(label, value)));
  select.value = lead.status;
  select.addEventListener('change', async () => {
    try {
      await api(`/api/admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
      lead.status = select.value;
      $('message').textContent = '';
    } catch (err) {
      select.value = lead.status;
      $('message').textContent = err.message;
    }
  });
  const statusCell = document.createElement('td');
  statusCell.append(select);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn-text';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    if (!confirm(`Permanently delete ${lead.name}’s details?`)) return;
    try {
      await api(`/api/admin/leads/${lead.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      $('message').textContent = err.message;
    }
  });
  const removeCell = document.createElement('td');
  removeCell.append(remove);

  row.append(
    cell(new Date(lead.created_at).toLocaleString()),
    cell(lead.name),
    cell(lead.grade),
    cell(program),
    cell(METHOD_LABELS[lead.contact_method]),
    cell(lead.contact_value),
    statusCell,
    removeCell,
  );
  return row;
}

async function load() {
  const { leads } = await api('/api/admin/leads');
  $('count').textContent = `${leads.length} ${leads.length === 1 ? 'entry' : 'entries'}`;
  $('rows').replaceChildren(...leads.map(renderRow));
  $('results').hidden = false;
  $('login').hidden = true;
  $('message').textContent = '';
}

$('login').addEventListener('submit', async (event) => {
  event.preventDefault();
  token = $('token').value.trim();
  $('token').value = '';
  try {
    await load();
  } catch (err) {
    token = '';
    $('message').textContent = err.message;
  }
});
