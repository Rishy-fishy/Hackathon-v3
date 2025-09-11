import React, { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, InputAdornment, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, CircularProgress } from '@mui/material';
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material';

export default function AdminAgents({ token }) {
  const API_BASE = (process.env.REACT_APP_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:3002' : '')).replace(/\/$/, '');
  const api = (path) => `${API_BASE}${path}`;
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [openNew, setOpenNew] = useState(false);
  const [newAgent, setNewAgent] = useState({ name:'', contact:'', email:'', age:'', type:'Field', photo:'', status:'Active' });
  const [saving, setSaving] = useState(false);

  useEffect(()=>{ if(token) fetchAgents(); }, [token]);

  async function fetchAgents(){
    setLoading(true); setError(null);
    try {
      const resp = await fetch(api('/api/admin/agents'), { headers:{ Authorization: `Bearer ${token}` } });
      let json; try { json = await resp.json(); } catch { json = []; }
      if(!resp.ok) throw new Error(json.error || 'Failed to fetch agents');
      const items = json.items || json || [];
      // Fallback demo data if empty
      setAgents(items.length ? items : [
        { id:'AGT001', name:'Liam Carter', contact:'555-123-4567', region:'North Region', status:'Active' },
        { id:'AGT002', name:'Olivia Bennett', contact:'555-987-6543', region:'South Region', status:'Active' },
        { id:'AGT003', name:'Noah Thompson', contact:'555-246-8013', region:'East Region', status:'Inactive' },
        { id:'AGT004', name:'Ava Harper', contact:'555-369-1470', region:'West Region', status:'Active' },
        { id:'AGT005', name:'Ethan Foster', contact:'555-789-0123', region:'Central Region', status:'Active' }
      ]);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  }

  const filtered = useMemo(()=>{
    if(!search) return agents;
    const s = search.toLowerCase();
    return agents.filter(a => [a.name, a.id, a.region, a.contact].some(v => String(v).toLowerCase().includes(s)));
  }, [agents, search]);

  async function createAgent(e){
    e.preventDefault();
    setSaving(true);
    try {
      // POST new agent (placeholder local append)
      const body = { ...newAgent, id:`AGT${String(agents.length+1).padStart(3,'0')}` };
      // Optionally: await fetch(api('/api/admin/agents'), { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(body) });
      setAgents(a=>[...a, body]);
      setOpenNew(false);
  setNewAgent({ name:'', contact:'', email:'', age:'', type:'Field', photo:'', status:'Active' });
    } catch(e){ /* surface error if needed */ }
    finally { setSaving(false); }
  }

  const statusChip = (status) => (
    <Chip size="small" label={status} sx={{ fontWeight:600, bgcolor: status==='Active'? 'rgba(34,197,94,.15)':'rgba(220,38,38,.15)', color: status==='Active'? '#15803d':'#b91c1c' }} />
  );

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:2 }}>
        <Typography variant="h6" fontWeight={600}>Field Agents</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={()=>setOpenNew(true)} sx={{ textTransform:'none', borderRadius:2 }}>Add New Agent</Button>
      </Box>
      <TextField
        placeholder="Search field agents by name, ID, or region"
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
                <TableCell sx={{ fontWeight:600 }}>AGENT ID</TableCell>
                <TableCell sx={{ fontWeight:600 }}>CONTACT</TableCell>
                <TableCell sx={{ fontWeight:600 }}>ASSIGNED REGION</TableCell>
                <TableCell sx={{ fontWeight:600 }}>STATUS</TableCell>
                <TableCell sx={{ fontWeight:600 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={22} /></TableCell></TableRow>
              )}
              {!loading && filtered.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.name}</TableCell>
                  <TableCell sx={{ color:'#0f62fe', fontWeight:600 }}>{a.id}</TableCell>
                  <TableCell>{a.contact || a.email || '—'}</TableCell>
                  <TableCell>{a.region || '—'}</TableCell>
                  <TableCell>{statusChip(a.status || 'Active')}</TableCell>
                  <TableCell><Button size="small">Edit</Button></TableCell>
                </TableRow>
              ))}
              {!loading && !filtered.length && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py:6, color:'text.secondary' }}>No agents found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openNew} onClose={()=>!saving && setOpenNew(false)} fullWidth maxWidth="sm" component="form" onSubmit={createAgent}>
        <DialogTitle>Add New Agent</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt:0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Name" value={newAgent.name} onChange={e=>setNewAgent(a=>({...a, name:e.target.value}))} fullWidth required size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Contact" value={newAgent.contact} onChange={e=>setNewAgent(a=>({...a, contact:e.target.value}))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Email" type="email" value={newAgent.email} onChange={e=>setNewAgent(a=>({...a, email:e.target.value}))} fullWidth required size="small" />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label="Age" type="number" value={newAgent.age} onChange={e=>setNewAgent(a=>({...a, age:e.target.value}))} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField label="Type" value={newAgent.type} onChange={e=>setNewAgent(a=>({...a, type:e.target.value}))} fullWidth size="small" placeholder="Field" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Photo URL" value={newAgent.photo} onChange={e=>setNewAgent(a=>({...a, photo:e.target.value}))} fullWidth size="small" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenNew(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} variant="contained">{saving? 'Saving...':'Create'}</Button>
        </DialogActions>
      </Dialog>
      {error && <Box sx={{ color:'#dc2626', fontSize:13 }}>{error}</Box>}
    </Box>
  );
}
