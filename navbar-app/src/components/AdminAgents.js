import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { 
  Box, Card, CardContent, Typography, TextField, InputAdornment, Button, 
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Dialog, DialogTitle, 
  DialogContent, DialogActions, CircularProgress, IconButton, Grid, Divider, Avatar 
} from '@mui/material';
import { Search as SearchIcon, Refresh as RefreshIcon, Person as PersonIcon } from '@mui/icons-material';

export default function AdminAgents({ token }) {
  // Always use production identity backend for now (since no local backend is set up)
  const IDENTITY_API_BASE = 'http://34.27.252.72:8080';
  const api = useCallback((path) => `${IDENTITY_API_BASE}${path}`, []);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [openDetail, setOpenDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [poll, setPoll] = useState(true);
  const [identityToken, setIdentityToken] = useState(null);
  const POLL_INTERVAL_MS = 15000; // 15s auto-refresh

  // Helper function to extract English values from multi-language fields
  const getEnglishValue = useCallback((field) => {
    if (!field) return null;
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) {
      // Find English value
      const englishItem = field.find(item => item.language === 'eng');
      if (englishItem) return englishItem.value;
      // Fallback to first available value
      return field[0]?.value || field[0] || null;
    }
    return field;
  }, []);

  // Helper function to format identity data for clean display
  const formatIdentityData = useCallback((identity) => {
    if (!identity) return null;

    return {
      personalInfo: {
        fullName: getEnglishValue(identity.fullName) || 'N/A',
        givenName: getEnglishValue(identity.givenName) || 'N/A',
        familyName: getEnglishValue(identity.familyName) || 'N/A',
        middleName: getEnglishValue(identity.middleName) || 'N/A',
        nickName: getEnglishValue(identity.nickName) || 'N/A',
        preferredUsername: getEnglishValue(identity.preferredUsername) || 'N/A',
        gender: getEnglishValue(identity.gender) || 'N/A',
        dateOfBirth: identity.dateOfBirth || 'N/A',
        individualId: identity.individualId || 'N/A'
      },
      contactInfo: {
        email: identity.email || 'N/A',
        phone: identity.phone || 'N/A',
        addressLine1: getEnglishValue(identity.addressLine1) || 'N/A',
        addressLine2: getEnglishValue(identity.addressLine2) || 'N/A',
        addressLine3: getEnglishValue(identity.addressLine3) || 'N/A',
        region: getEnglishValue(identity.region) || 'N/A',
        province: getEnglishValue(identity.province) || 'N/A',
        city: getEnglishValue(identity.city) || 'N/A',
        postalCode: identity.postalCode || 'N/A',
        country: getEnglishValue(identity.country) || 'N/A'
      },
      timestamps: {
        createdAt: identity.createdAt || 'N/A',
        updatedAt: identity.updatedAt || 'N/A'
      }
    };
  }, [getEnglishValue]);

  // Simple component for displaying label-value pairs
  const InfoRow = ({ label, value }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', minWidth: 120 }}>
        {label}:
      </Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', wordBreak: 'break-word', maxWidth: '60%' }}>
        {value === 'N/A' ? (
          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>N/A</span>
        ) : (
          value
        )}
      </Typography>
    </Box>
  );

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
    if(!token) return; 
    
    // Only show loading indicator for manual refreshes, not background syncs
    if(manual) {
      setLoading(true);
    } else {
      setBackgroundSyncing(true);
    }
    setError(null);
    
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
    } catch(e){ 
      // Only show errors for manual refreshes, silently handle background sync errors
      if(manual) {
        setError(e.message); 
      }
    }
    finally { 
      if(manual) {
        setLoading(false);
      } else {
        setBackgroundSyncing(false);
      }
    }
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
    return <Chip size="small" label="Verified" sx={{ fontWeight:600, bgcolor:'rgba(7, 78, 7, 0.94)', color:'#00ff00d5' }} />;
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
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon color="primary" />
            <Typography variant="h6">Identity Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {(!detail || detail.loading) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          )}
          {detail && detail.error && (
            <Box sx={{ color: 'error.main', textAlign: 'center', py: 4 }}>
              {detail.error}
            </Box>
          )}
          {detail && detail.data && (() => {
            const formatted = formatIdentityData(detail.data.identity);
            return (
              <Box sx={{ py: 1 }}>
                {/* Header with name and ID */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  mb: 3,
                  p: 2,
                  bgcolor: 'primary.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'primary.200'
                }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                    {formatted.personalInfo.fullName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {formatted.personalInfo.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ID: {formatted.personalInfo.individualId}
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  {/* Personal Information */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
                          Personal Information
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <InfoRow label="Full Name" value={formatted.personalInfo.fullName} />
                          <InfoRow label="Given Name" value={formatted.personalInfo.givenName} />
                          <InfoRow label="Family Name" value={formatted.personalInfo.familyName} />
                          <InfoRow label="Middle Name" value={formatted.personalInfo.middleName} />
                          <InfoRow label="Gender" value={formatted.personalInfo.gender} />
                          <InfoRow label="Date of Birth" value={formatted.personalInfo.dateOfBirth} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Contact Information */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
                          Contact Information
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <InfoRow label="Email" value={formatted.contactInfo.email} />
                          <InfoRow label="Phone" value={formatted.contactInfo.phone} />
                          <InfoRow label="Region" value={formatted.contactInfo.region} />
                          <InfoRow label="Country" value={formatted.contactInfo.country} />
                          <InfoRow label="Postal Code" value={formatted.contactInfo.postalCode} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* System Information */}
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
                          System Information
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <InfoRow label="Individual ID" value={formatted.personalInfo.individualId} />
                          <InfoRow label="Preferred Username" value={formatted.personalInfo.preferredUsername} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={()=>setOpenDetail(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
