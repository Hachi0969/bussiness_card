// Sends follow-up entries and staff actions to Supabase, or to the local test server
// when CONFIG.supabase is null.
import { CONFIG } from './config.js';

export class ApiError extends Error {
  constructor(status, code) {
    super(code || 'error');
    this.status = status;
    this.code = code;
  }
}

async function rpc(fn, args) {
  const { url, publishableKey } = CONFIG.supabase;
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (response.ok) return response.status === 204 ? null : response.json();
  const body = await response.json().catch(() => ({}));
  throw new ApiError(response.status, body.message);
}

async function local(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { method, headers, body: body && JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, response.status === 429 ? 'too_many_requests' : data.error);
  return data;
}

export async function submitLead(lead) {
  if (CONFIG.supabase) {
    return rpc('submit_lead', {
      p_name: lead.name,
      p_grade: lead.grade,
      p_program_id: lead.programId,
      p_contact_method: lead.contactMethod,
      p_contact_value: lead.contactValue,
      p_consent: true,
      p_notice_version: CONFIG.noticeVersion,
    });
  }
  return local('/api/leads', { method: 'POST', body: { ...lead, consent: true, noticeVersion: CONFIG.noticeVersion } });
}

export async function listLeads(token) {
  if (CONFIG.supabase) return rpc('staff_list_leads', { p_token: token });
  return (await local('/api/admin/leads', { token })).leads;
}

export async function setLeadStatus(token, id, status) {
  if (CONFIG.supabase) return rpc('staff_set_status', { p_token: token, p_id: id, p_status: status });
  return local(`/api/admin/leads/${id}`, { method: 'PATCH', token, body: { status } });
}

export async function deleteLead(token, id) {
  if (CONFIG.supabase) return rpc('staff_delete_lead', { p_token: token, p_id: id });
  return local(`/api/admin/leads/${id}`, { method: 'DELETE', token });
}
