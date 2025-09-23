import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Card, CardContent, Typography, TextField, InputAdornment, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, IconButton } from '@mui/material';
import { Search as SearchIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export default function AdminAgents({ token }) {
  // Always use production identity backend for now (since no local backend is set up)
  const IDENTITY_API_BASE = 'http://34.27.252.72:8080';
  const api = useCallback((path) => `${IDENTITY_API_BASE}${path}`, []);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [openDetail, setOpenDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [poll, setPoll] = useState(true);
  const [identityToken, setIdentityToken] = useState(null);
  const POLL_INTERVAL_MS = 15000; // 15s auto-refresh

  // Login to identity backend to get token
  const loginToIdentityBackend = useCallback(async () => {
    try {
      const resp = await fetch(api('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Admin', password: 'Admin@123' })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Identity login failed');
      setIdentityToken(json.token);
      return json.token;
    } catch (e) {
      console.error('Identity backend login failed:', e);
      setError(`Identity login failed: ${e.message}`);
      return null;
    }
  }, [api]);

  const fetchAgents = useCallback(async (manual=false)=>{
    if(!token) return; setLoading(true); setError(null);
    try {
      // Get identity token if not available
      let idToken = identityToken;
      if (!idToken) {
        idToken = await loginToIdentityBackend();
        if (!idToken) return;
      }

      const resp = await fetch(api('/api/admin/identities'), { headers:{ Authorization:`Bearer ${idToken}` } });
      let json; try { json = await resp.json(); } catch { json = { items:[] }; }
      if(!resp.ok) {
        // If unauthorized, try to login again
        if (resp.status === 401) {
          idToken = await loginToIdentityBackend();
          if (idToken) {
            const retryResp = await fetch(api('/api/admin/identities'), { headers:{ Authorization:`Bearer ${idToken}` } });
            json = await retryResp.json();
            if (!retryResp.ok) throw new Error(json.error || 'Failed to fetch identities');
          } else {
            throw new Error('Authentication failed');
          }
        } else {
          throw new Error(json.error || 'Failed to fetch identities');
        }
      }
      setAgents(json.items || []);
      if(manual) setPoll(false); // stop auto polling if user manually refreshed
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }, [token, api, identityToken, loginToIdentityBackend]);

  // initial + polling
  useEffect(()=>{ if(token){ fetchAgents(); } }, [token, fetchAgents]);
  useEffect(()=>{
    if(!poll || !token) return; const id = setInterval(()=> fetchAgents(), POLL_INTERVAL_MS); return ()=> clearInterval(id);
  }, [poll, token, fetchAgents]);

  const filtered = useMemo(()=>{
    if(!search) return agents;
    const s = search.toLowerCase();
    return agents.filter(a => [a.name, a.individualId, a.email, a.phone, a.region, a.country].some(v => (v||'').toLowerCase().includes(s)));
  }, [agents, search]);

  function statusChip(){
    return <Chip size="small" label="Imported" sx={{ fontWeight:600, bgcolor:'rgba(99,102,241,.15)', color:'#4f46e5' }} />;
  }

  async function openAgentDetail(id){
    try {
      setDetail({ loading:true }); setOpenDetail(true);
      
      // Get identity token if not available
      let idToken = identityToken;
      if (!idToken) {
        idToken = await loginToIdentityBackend();
        if (!idToken) {
          setDetail({ loading:false, error: 'Authentication failed' });
          return;
        }
      }

      const resp = await fetch(api(`/api/admin/identities/${id}`), { headers:{ Authorization:`Bearer ${idToken}` } });
      const json = await resp.json();
      if(!resp.ok) {
        if (resp.status === 401) {
          // Try to login again
          idToken = await loginToIdentityBackend();
          if (idToken) {
            const retryResp = await fetch(api(`/api/admin/identities/${id}`), { headers:{ Authorization:`Bearer ${idToken}` } });
            const retryJson = await retryResp.json();
            if (!retryResp.ok) throw new Error(retryJson.error || 'Failed to load identity');
            setDetail({ loading:false, data: retryJson });
            return;
          }
        }
        throw new Error(json.error||'Failed to load identity');
      }
      setDetail({ loading:false, data: json });
    } catch(e){ setDetail({ loading:false, error: e.message }); }
  }

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:2 }}>
        <Typography variant="h6" fontWeight={600}>Field Agents (Identities)</Typography>
        <Box sx={{ display:'flex', gap:1 }}>
          <IconButton size="small" onClick={()=>fetchAgents(true)} title="Refresh now"><RefreshIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
      <TextField
        placeholder="Search by name, ID, email, phone, region"
        size="small"
        value={search}
        onChange={e=>setSearch(e.target.value)}
        fullWidth
        InputProps={{ startAdornment:(<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
        sx={{ background:'#fff', maxWidth:900 }}
      />
      <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, background:'#fff' }}>
        <CardContent sx={{ p:0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight:600 }}>NAME</TableCell>
                <TableCell sx={{ fontWeight:600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight:600 }}>EMAIL</TableCell>
                <TableCell sx={{ fontWeight:600 }}>PHONE</TableCell>
                <TableCell sx={{ fontWeight:600 }}>REGION</TableCell>
                <TableCell sx={{ fontWeight:600 }}>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={22} /></TableCell></TableRow>
              )}
              {!loading && filtered.map(a => (
                <TableRow key={a.individualId} hover sx={{ cursor:'pointer' }} onClick={()=>openAgentDetail(a.individualId)}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell sx={{ color:'#0f62fe', fontWeight:600 }}>{a.individualId}</TableCell>
                  <TableCell>{a.email || '—'}</TableCell>
                  <TableCell>{a.phone || '—'}</TableCell>
                  <TableCell>{a.region || a.country || '—'}</TableCell>
                  <TableCell>{statusChip()}</TableCell>
                </TableRow>
              ))}
              {!loading && !filtered.length && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py:6, color:'text.secondary' }}>No identities found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {error && <Box sx={{ color:'#dc2626', fontSize:13 }}>{error}</Box>}

      <Dialog open={openDetail} onClose={()=>setOpenDetail(false)} fullWidth maxWidth="md">
        <DialogTitle>Identity Detail</DialogTitle>
        <DialogContent dividers sx={{ fontFamily:'monospace', fontSize:13 }}>
          {(!detail || detail.loading) && 'Loading...'}
          {detail && detail.error && <Box sx={{ color:'#dc2626' }}>{detail.error}</Box>}
          {detail && detail.data && (
            <>
              <Box sx={{ mb:2 }}>
                <strong>{detail.data.summary?.name}</strong> ({detail.data.individualId})<br/>
                {detail.data.summary?.email} {detail.data.summary?.phone && ' | '+detail.data.summary.phone}
              </Box>
              <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{JSON.stringify(detail.data.identity, null, 2)}</pre>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenDetail(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
