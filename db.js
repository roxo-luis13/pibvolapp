// ===== SUPABASE - conexão e helpers =====
// ===== SUPABASE CONFIG =====
const SUPA_URL = 'https://knxdadcfphqadskwscya.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtueGRhZGNmcGhxYWRza3dzY3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDQzNTksImV4cCI6MjA5ODQyMDM1OX0.LInOxT_IubbrMfsd5d3waDRwCfJK9leA3bjSRDE8tKY';

async function sb(path, opts={}) {
  const res = await fetch(SUPA_URL + '/rest/v1/' + path, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + (session?.access_token || SUPA_KEY),
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
      ...opts.headers
    },
    ...opts
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || 'Erro ' + res.status);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function sbAuth(path, body) {
  const res = await fetch(SUPA_URL + '/auth/v1/' + path, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro de autenticação');
  return data;
}
