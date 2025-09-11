import React, { useState, useEffect } from 'react';
import './AdminPage.css';
// Core MUI components
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Avatar,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Chip,
  InputAdornment,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  LinearProgress
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  BarChart as BarChartIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Logout as LogoutIcon,
  CloudDownload as CloudDownloadIcon,
  Person as PersonIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import AdminRecords from './AdminRecords';
import AdminAnalytics from './AdminAnalytics';
import MapWidget from './MapWidget';
import AdminAgents from './AdminAgents';

// Backend endpoints expected:
// POST /api/admin/login { username, password } -> { token, username, expiresIn }
// GET  /api/admin/stats  (Authorization: Bearer <token>) -> { totalChildRecords, recentUploads }
// GET  /api/admin/children (Authorization: Bearer <token>) -> { children: [...] }

export default function AdminPage() {
  // Resolution order for backend base URL (first non-empty wins):
  // 1. window.__API_BASE (runtime injected script) e.g. placed in public/runtime-config.js
  // 2. REACT_APP_API_BASE (build-time)
  // 3. If running on localhost frontend dev server -> http://localhost:3002
  // 4. Empty string => same-origin relative calls
  const runtimeBase = typeof window !== 'undefined' && window.__API_BASE ? window.__API_BASE : '';
  const CLOUD_RUN_FALLBACK = 'https://navbar-backend-clean-87485236346.us-central1.run.app';
  const API_BASE = (
    runtimeBase ||
    process.env.REACT_APP_API_BASE ||
    // If developing locally and no override, still use remote backend instead of failing
    (window.location.hostname === 'localhost' ? CLOUD_RUN_FALLBACK : CLOUD_RUN_FALLBACK)
  ).replace(/\/$/,'');
  if (typeof window !== 'undefined') {
    // One-time debug to confirm which backend URL AdminPage is using
    if (!window.__ADMIN_API_BASE_LOGGED) {
      console.log('[AdminPage] Using backend base:', API_BASE);
      window.__ADMIN_API_BASE_LOGGED = true;
    }
  }
  const api = (path) => `${API_BASE}${path}`;
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [token,setToken] = useState(null);
  const [error,setError] = useState(null);
  const [stats,setStats] = useState(null);
  const [loading,setLoading] = useState(false);
  const [downloadHealthId, setDownloadHealthId] = useState('');
  const [section, setSection] = useState('Dashboard');
  const [profileAnchor, setProfileAnchor] = useState(null);
  const openProfileMenu = (e) => setProfileAnchor(e.currentTarget);
  const closeProfileMenu = () => setProfileAnchor(null);

  // Load token from sessionStorage (so refresh keeps session) but never store password.
  useEffect(()=>{
    const t = sessionStorage.getItem('admin_token');
    if (t) setToken(t);
    // Removed forcing body overflow hidden so page can scroll naturally
  },[]);

  useEffect(()=>{
    if (token) {
      fetchStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  async function login(e){
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = api('/api/admin/login');
      const resp = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ username, password })
      });
      let json;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        json = await resp.json();
      } else {
        const text = await resp.text();
        throw new Error(`Non-JSON response (${resp.status}) from ${url}: ${text.substring(0,120)}`);
      }
      if(!resp.ok){ setError(json.error||'Login failed'); return; }
      setToken(json.token);
      sessionStorage.setItem('admin_token', json.token);
      setPassword(''); // clear password field
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function fetchStats(){
    setLoading(true);
    setError(null);
    try {
      const url = api('/api/admin/stats');
      const resp = await fetch(url, { headers:{ Authorization: `Bearer ${token}` }});
      let json;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        json = await resp.json();
      } else {
        const text = await resp.text();
        throw new Error(`Non-JSON response (${resp.status}) from ${url}: ${text.substring(0,120)}`);
      }
      if(!resp.ok){
        if (resp.status === 401){
          sessionStorage.removeItem('admin_token');
          setToken(null);
        }
        setError(json.error||'Failed to fetch stats');
        return;
      }
      setStats(json);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }


  function logout(){
    sessionStorage.removeItem('admin_token');
    setToken(null);
    setStats(null);
  }

  // ====================== LOGIN VIEW (Unchanged Logic) ======================
  if(!token){
    return (
      <Box className="admin-page" sx={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', p:2 }}>
        <Paper elevation={6} sx={{ p:4, borderRadius:4, width:'100%', maxWidth:440 }}>
          <Typography variant="h4" fontWeight={600} textAlign="center" mb={3}>Admin Login</Typography>
          <Box component="form" onSubmit={login} sx={{ display:'flex', flexDirection:'column', gap:2 }}>
            <TextField size="medium" label="Username" value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" />
            <TextField size="medium" label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" />
            <Button type="submit" variant="contained" disabled={loading} sx={{ py:1.2, fontWeight:600 }}>{loading? 'Signing in...':'Login'}</Button>
            {error && <Box role="alert" sx={{ background:'#ffe5e5', color:'#b30000', p:1.2, borderRadius:1, fontSize:14 }}>{error}</Box>}
          </Box>
        </Paper>
      </Box>
    );
  }

  // ====================== DASHBOARD DERIVED VALUES (Presentation only) ======================
  const totalRecords = stats?.totalChildRecords ?? 0;
  const recentUploads = stats?.recentUploads || [];
  // Placeholder / derived values (no API changes):
  const activeFieldAgents = 56; // static demo value matching design
  const malnutritionCases = 123; // legacy placeholder
  const pendingUploads = Math.max(0, recentUploads.filter(u => !u.uploadedAt).length) || 12; // fallback demo value

  // New richer placeholder data for redesigned dashboard
  const severityStats = { severe: 84, moderate: 210, mild: 560, normal: 900 };
  const severityTotal = Object.values(severityStats).reduce((a,b)=>a+b,0) || 1;
  const severityPct = Object.fromEntries(
    Object.entries(severityStats).map(([k,v])=>[k, ((v / severityTotal) * 100).toFixed(0)])
  );
  // Snapshot deltas (placeholders – replace with real period comparisons later)
  const prevTotalRecords = totalRecords ? Math.round(totalRecords * 0.948) : 0; // implies +5.2%
  const totalRecordsDelta = prevTotalRecords ? (((totalRecords - prevTotalRecords)/prevTotalRecords)*100).toFixed(1) : '0.0';
  const prevActiveAgents = activeFieldAgents; // no change
  const activeAgentsDelta = 0; // neutral
  const newRecords = 1230; // placeholder
  const prevNewRecords = 1256; // placeholder for -2.1%
  const newRecordsDelta = (((newRecords - prevNewRecords)/prevNewRecords)*100).toFixed(1); // negative
  const regionBreakdown = [
    { region:'Northern Region', cases:2714, severe:112 },
    { region:'Eastern Region',  cases:1980, severe:74  },
    { region:'Western Region',  cases:2239, severe:95  },
    { region:'Southern Region', cases:1534, severe:61  }
  ];
  const agentPerformance = [
    { agent:'John',   uploads:138, avgTime:'3d 14h', accuracy:'98%', completeness:'94%' },
    { agent:'Mary',   uploads:124, avgTime:'2d 4h',  accuracy:'97%', completeness:'96%' },
    { agent:'Jane',   uploads:118, avgTime:'2d 9h',  accuracy:'99%', completeness:'99%' },
    { agent:'Peter',  uploads:102, avgTime:'3d 5h',  accuracy:'96%', completeness:'92%' },
    { agent:'Victor', uploads: 98, avgTime:'4d 6h',  accuracy:'95%', completeness:'89%' }
  ];
  const dataQuality = { missingKey:'3.6%', missingFields:56, duplicates:12, outliers:9, lastScan:'2h ago' };
  const cohortAgeGroups = [
    { group:'0-1', total:320, normal:180, mild:70, moderate:50, severe:20 },
    { group:'2-3', total:540, normal:300, mild:120, moderate:80, severe:40 },
    { group:'4-5', total:460, normal:290, mild:90,  moderate:55, severe:25 },
    { group:'6-7', total:330, normal:215, mild:60,  moderate:38, severe:17 },
    { group:'8-9', total:220, normal:160, mild:30,  moderate:20, severe:10 }
  ];
  const followUp = { compliance:92, completed:1132, scheduled:981 };
  const exportLog = [
    { ts:'2025-09-10 10:25', type:'Summary (30 days)', user:'Admin',       duration:'1.2s', format:'PDF' },
    { ts:'2025-09-10 09:15', type:'Malnutrition Trend', user:'Analyst',    duration:'0.9s', format:'PDF' },
    { ts:'2025-09-09 16:05', type:'Agent Performance - Q3', user:'Coord', duration:'1.4s', format:'CSV' }
  ];

  // Trend line (can be replaced by real API data later)
  const trendPoints = [10,25,18,32,22,28,40,24,38,45,50,58];
  const nf = new Intl.NumberFormat('en-US');
  const trendPolyline = trendPoints.map((p,i)=>`${(i/(trendPoints.length-1))*100},${100 - p}`).join(' ');
  const trendAreaPath = `M0,100 L${trendPolyline.replace(/ /g,' L')} L100,100 Z`;

  const handleDownload = (e) => {
    e.preventDefault();
    if(!downloadHealthId.trim()) return;
    // Placeholder implementation – real implementation would request a PDF endpoint.
    alert(`Download for Health ID: ${downloadHealthId} (placeholder)`);
  };

  const drawerWidth = 220;

  return (
    <Box sx={{ display:'flex', minHeight:'100vh', width:'100%', bgcolor:'#f5f7fb', overflowX:'hidden' }}>
      {/* Sidebar */}
      <Drawer variant="permanent" sx={{ width:drawerWidth, flexShrink:0, [`& .MuiDrawer-paper`]: { width:drawerWidth, boxSizing:'border-box', borderRight:'1px solid #e2e8f0', background:'#ffffff' } }}>
        <Toolbar sx={{ px:3, gap:1 }}>
          <Avatar sx={{ bgcolor:'#1976d2', width:34, height:34 }}>CH</Avatar>
          <Typography variant="subtitle1" fontWeight={600}>Child Health</Typography>
        </Toolbar>
        <Divider />
        <Box sx={{ flex:1, display:'flex', flexDirection:'column', py:1 }}>
          <List sx={{ py:0 }}>
            {[
              { key:'Dashboard', icon:DashboardIcon },
              { key:'Records', icon:FolderIcon },
              { key:'Analytics', icon:BarChartIcon },
              { key:'Agents', icon:GroupIcon }
            ].map(item => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <ListItemButton
                  key={item.key}
                  onClick={()=>setSection(item.key)}
                  disableRipple
                  selected={active}
                  sx={{
                    mx:1,
                    my:0.75,
                    borderRadius:2.5,
                    height:50,
                    px:2,
                    border: active ? 'none' : '1px solid #d1d5db',
                    fontWeight: active ? 600 : 500,
                    transition:'all .18s ease',
                    boxShadow: active ? '0 2px 4px rgba(0,0,0,.25)' : 'none',
                    // Base (inactive) styles
                    bgcolor:'#fff',
                    color:'#111827',
                    '& .MuiListItemIcon-root': { color:'#475569', minWidth:30 },
                    '&:hover':{ bgcolor:'#f1f5f9' },
                    // Active styles with higher specificity & !important to defeat legacy css
                    ...(active ? {
                      bgcolor:'#000 !important',
                      color:'#fff !important',
                      '& .MuiListItemIcon-root': { color:'#fff !important' },
                      '&:hover': { bgcolor:'#111 !important' }
                    }:{}),
                    // Also enforce when MUI applies selected class
                    '&.Mui-selected':{
                      bgcolor:'#000 !important',
                      color:'#fff !important'
                    },
                    '&.Mui-selected:hover':{
                      bgcolor:'#111 !important'
                    }
                  }}
                >
                  <ListItemIcon>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize:15, fontWeight: active?600:500 }}>
                        {item.key}
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Box sx={{ flex:1 }} />
          {/* Profile actions moved to avatar dropdown */}
        </Box>
      </Drawer>

      {/* Main Content */}
  <Box sx={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Top Bar */}
        <AppBar position="static" elevation={0} sx={{ background:'#ffffff', color:'#111', borderBottom:'1px solid #e2e8f0' }}>
          <Toolbar sx={{ gap:2 }}>
            <Typography variant="h6" sx={{ fontSize:18, fontWeight:600 }}>{section}</Typography>
            <Box sx={{ flex:1 }} />
            <IconButton onClick={fetchStats} disabled={loading} sx={{ ml:1 }}>{loading? <CircularProgress size={20} />:<RefreshIcon />}</IconButton>
            <Avatar onClick={openProfileMenu} sx={{ width:36, height:36, ml:1, cursor:'pointer' }} aria-controls={profileAnchor? 'profile-menu':undefined} aria-haspopup="true" aria-expanded={profileAnchor? 'true':undefined}>A</Avatar>
            <Menu
              id="profile-menu"
              anchorEl={profileAnchor}
              open={Boolean(profileAnchor)}
              onClose={closeProfileMenu}
              transformOrigin={{ vertical:'top', horizontal:'right' }}
              anchorOrigin={{ vertical:'bottom', horizontal:'right' }}
            >
              <MenuItem onClick={closeProfileMenu} sx={{ gap:1 }}>
                <PersonIcon fontSize="small" /> Admin Profile
              </MenuItem>
              <MenuItem onClick={()=>{ closeProfileMenu(); logout(); }} sx={{ gap:1, color:'#b91c1c' }}>
                <LogoutIcon fontSize="small" /> Logout
              </MenuItem>
            </Menu>

          </Toolbar>
        </AppBar>

        {/* Scrollable content area */}
        <Box sx={{ flex:1, p:{ xs:2, md:4 }, display:'flex', flexDirection:'column', gap:4, width:'100%' }}>
          {section === 'Dashboard' && (
            <React.Fragment>
              {/* Summary Snapshot (updated to match reference design) */}
              <Grid container spacing={2}>
                {/* Total Records */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, background:'#fff' }}>
                    <CardContent sx={{ p:2.25 }}>
                      <Typography sx={{ fontSize:13, fontWeight:600, color:'#475569', mb:0.5 }}>Total Records</Typography>
                      <Typography variant="h5" fontWeight={700}>{nf.format(totalRecords)}</Typography>
                      <Typography variant="caption" sx={{ mt:0.5, display:'flex', alignItems:'center', gap:.5, color: parseFloat(totalRecordsDelta) >= 0 ? 'success.main':'error.main' }}>
                        {parseFloat(totalRecordsDelta) >= 0 ? '↑' : '↓'} {Math.abs(totalRecordsDelta)}% vs last period
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                {/* Active Field Agents */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, background:'#fff' }}>
                    <CardContent sx={{ p:2.25 }}>
                      <Typography sx={{ fontSize:13, fontWeight:600, color:'#475569', mb:0.5 }}>Active Field Agents</Typography>
                      <Typography variant="h5" fontWeight={700}>{activeFieldAgents}</Typography>
                      <Typography variant="caption" sx={{ mt:0.5, color:'text.secondary' }}>– 0 vs last period</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                {/* Malnutrition Distribution (show Severe/Moderate/Mild only) */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, background:'#fff' }}>
                    <CardContent sx={{ p:2.25 }}>
                      <Typography sx={{ fontSize:13, fontWeight:600, color:'#475569', mb:0.5 }}>Malnutrition Distribution</Typography>
                      <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.75 }}>
                        <Box sx={{ textAlign:'center', flex:1 }}>
                          <Typography sx={{ fontSize:14, fontWeight:600, color:'#dc2626' }}>{severityPct.severe}%</Typography>
                          <Typography variant="caption" sx={{ color:'#64748b' }}>Severe</Typography>
                        </Box>
                        <Box sx={{ textAlign:'center', flex:1 }}>
                          <Typography sx={{ fontSize:14, fontWeight:600, color:'#f59e0b' }}>{severityPct.moderate}%</Typography>
                          <Typography variant="caption" sx={{ color:'#64748b' }}>Moderate</Typography>
                        </Box>
                        <Box sx={{ textAlign:'center', flex:1 }}>
                          <Typography sx={{ fontSize:14, fontWeight:600, color:'#d97706' }}>{severityPct.mild}%</Typography>
                          <Typography variant="caption" sx={{ color:'#64748b' }}>Mild</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mt:0.5, display:'flex', height:6, borderRadius:3, overflow:'hidden' }}>
                        <Box sx={{ width:`${severityPct.severe}%`, bgcolor:'#dc2626' }} />
                        <Box sx={{ width:`${severityPct.moderate}%`, bgcolor:'#f59e0b' }} />
                        <Box sx={{ width:`${severityPct.mild}%`, bgcolor:'#d97706' }} />
                        <Box sx={{ flex:1, bgcolor:'#16a34a' }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                {/* New vs Last Period */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, background:'#fff' }}>
                    <CardContent sx={{ p:2.25 }}>
                      <Typography sx={{ fontSize:13, fontWeight:600, color:'#475569', mb:0.5 }}>New vs. Last Period</Typography>
                      <Typography variant="h5" fontWeight={700}>{nf.format(newRecords)}</Typography>
                      <Typography variant="caption" sx={{ mt:0.5, display:'flex', alignItems:'center', gap:.5, color: parseFloat(newRecordsDelta) >= 0 ? 'success.main':'error.main' }}>
                        {parseFloat(newRecordsDelta) >= 0 ? '↑' : '↓'} {Math.abs(newRecordsDelta)}% new records
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Trends & Severity Bar */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, height:'100%' }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Malnutrition Trends</Typography>
                      <Box sx={{ height:200, background:'#ffffff', border:'1px solid #f1f5f9', borderRadius:1, position:'relative' }}>
                        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.5" />
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={trendAreaPath} fill="url(#trendFill)" opacity="0.6" />
                          <polyline points={trendPolyline} fill="none" stroke="#0284c7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                        </svg>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, height:'100%' }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Severity Breakdown</Typography>
                      <Box sx={{ height:200, display:'flex', alignItems:'flex-end', gap:2, px:1 }}>
                        {[{ label:'Normal', value:severityStats.normal, color:'#16a34a' },{ label:'Mild', value:severityStats.mild, color:'#0ea5e9' },{ label:'Moderate', value:severityStats.moderate, color:'#f59e0b' },{ label:'Severe', value:severityStats.severe, color:'#dc2626' }].map(s=> {
                          const h = (s.value / Math.max(...Object.values(severityStats))) * 160 + 20;
                          return (
                            <Box key={s.label} sx={{ flex:1, textAlign:'center' }}>
                              <Box sx={{ height:h, bgcolor:s.color, borderRadius:1, transition:'0.3s', boxShadow:'0 2px 4px rgba(0,0,0,.08)' }} />
                              <Typography variant="caption" sx={{ mt:0.5, display:'block', fontWeight:600 }}>{s.label}</Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Geographic Breakdown & Map Placeholder */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={7}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Geographic Breakdown</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight:600 }}>Region</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Cases</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Severe</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {regionBreakdown.map(r=> (
                            <TableRow key={r.region} hover>
                              <TableCell>{r.region}</TableCell>
                              <TableCell>{nf.format(r.cases)}</TableCell>
                              <TableCell>{r.severe}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, height:'100%' }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Region Map</Typography>
                      <MapWidget height={260} markers={[
                        { position:{ lat:28.6139, lng:77.2090 }, label:'Delhi' },
                        { position:{ lat:19.0760, lng:72.8777 }, label:'Mumbai' },
                        { position:{ lat:13.0827, lng:80.2707 }, label:'Chennai' }
                      ]} />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Field Agent Performance & Data Quality */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Field Agent Performance</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight:600 }}>Agent</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Uploads</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Avg Time</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Accuracy</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Completeness</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {agentPerformance.map(a=> (
                            <TableRow key={a.agent}>
                              <TableCell>{a.agent}</TableCell>
                              <TableCell>{a.uploads}</TableCell>
                              <TableCell>{a.avgTime}</TableCell>
                              <TableCell><Chip size="small" label={a.accuracy} color="success" variant="outlined" /></TableCell>
                              <TableCell><Chip size="small" label={a.completeness} color="info" variant="outlined" /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, height:'100%', display:'flex', flexDirection:'column' }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Data Quality Report</Typography>
                      <Box sx={{ mb:2 }}>
                        <Typography variant="caption" sx={{ fontWeight:600 }}>Missing Key Fields</Typography>
                        <Typography variant="h6" sx={{ mt:0.5, fontWeight:700 }}>{dataQuality.missingKey}</Typography>
                        <LinearProgress variant="determinate" value={parseFloat(dataQuality.missingKey)} sx={{ mt:0.5, height:6, borderRadius:3 }} />
                      </Box>
                      <Divider sx={{ my:1 }} />
                      <Typography variant="caption" display="block">Missing Fields: {dataQuality.missingFields}</Typography>
                      <Typography variant="caption" display="block">Duplicates: {dataQuality.duplicates}</Typography>
                      <Typography variant="caption" display="block">Outliers Flagged: {dataQuality.outliers}</Typography>
                      <Typography variant="caption" display="block" sx={{ mt:1, color:'text.secondary' }}>Last Scan {dataQuality.lastScan}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Cohort Age Group Analysis & Follow-up Compliance */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Cohort / Age Group Analysis</Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight:600 }}>Age Group</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Total</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Normal</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Mild</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Moderate</TableCell>
                            <TableCell sx={{ fontWeight:600 }}>Severe</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cohortAgeGroups.map(g=> (
                            <TableRow key={g.group}>
                              <TableCell>{g.group}</TableCell>
                              <TableCell>{g.total}</TableCell>
                              <TableCell>{g.normal}</TableCell>
                              <TableCell>{g.mild}</TableCell>
                              <TableCell>{g.moderate}</TableCell>
                              <TableCell>{g.severe}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, height:'100%' }}>
                    <CardContent sx={{ p:2.2 }}>
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>Follow-up Compliance</Typography>
                      <Box sx={{ display:'flex', alignItems:'center', gap:2, mt:1 }}>
                        <Box sx={{ textAlign:'center', flex:1 }}>
                          <Typography variant="h4" fontWeight={700}>{followUp.compliance}%</Typography>
                          <Typography variant="caption" color="text.secondary">Compliance Rate</Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem />
                        <Box sx={{ flex:1 }}>
                          <Typography variant="caption" display="block">Completed: {followUp.completed}</Typography>
                          <Typography variant="caption" display="block">Scheduled: {followUp.scheduled}</Typography>
                        </Box>
                      </Box>
                      <LinearProgress variant="determinate" value={followUp.compliance} sx={{ mt:2, height:8, borderRadius:4 }} />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Recent Uploads Table (kept) */}
              <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Recent Uploads</Typography>
                  <Paper variant="outlined" sx={{ width:'100%', overflowX:'auto', border:'1px solid #f1f5f9' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight:600 }}>CHILD ID</TableCell>
                          <TableCell sx={{ fontWeight:600 }}>NAME</TableCell>
                          <TableCell sx={{ fontWeight:600 }}>LOCATION</TableCell>
                          <TableCell sx={{ fontWeight:600 }}>REPRESENTATIVE</TableCell>
                          <TableCell sx={{ fontWeight:600 }}>STATUS</TableCell>
                          <TableCell sx={{ fontWeight:600 }}>DATE</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recentUploads.length ? recentUploads.map((u, i) => {
                          const date = u.uploadedAt ? new Date(u.uploadedAt).toISOString().split('T')[0] : '—';
                          const status = u.uploadedAt ? 'Uploaded' : 'Pending';
                          return (
                            <TableRow key={u.healthId || i} hover>
                              <TableCell>{u.healthId || '—'}</TableCell>
                              <TableCell>{u.name || 'Unknown'}</TableCell>
                              <TableCell>{u.location || '—'}</TableCell>
                              <TableCell>{u.representative || '—'}</TableCell>
                              <TableCell>
                                <Chip size="small" label={status} color={status==='Uploaded' ? 'success':'warning'} variant="outlined" sx={{ fontWeight:600 }} />
                              </TableCell>
                              <TableCell>{date}</TableCell>
                            </TableRow>
                          );
                        }) : (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py:4, color:'text.secondary' }}>
                              {loading? 'Loading records...' : 'No uploads yet'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Paper>
                </CardContent>
              </Card>

              {/* Download Health Record */}
              <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
                <CardContent sx={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <Typography variant="subtitle2" fontWeight={600}>Download Health Record</Typography>
                  <Box component="form" onSubmit={handleDownload} sx={{ display:'flex', flexDirection:{ xs:'column', sm:'row' }, gap:2 }}>
                    <TextField fullWidth size="small" placeholder="Enter Health ID" value={downloadHealthId} onChange={e=>setDownloadHealthId(e.target.value)} />
                    <Button type="submit" variant="contained" startIcon={<CloudDownloadIcon />} sx={{ minWidth:180 }}>Download PDF</Button>
                  </Box>
                </CardContent>
              </Card>

              {/* Export Log */}
              <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
                <CardContent sx={{ p:2.2 }}>
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>Export Log</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight:600 }}>Timestamp</TableCell>
                        <TableCell sx={{ fontWeight:600 }}>Report Type</TableCell>
                        <TableCell sx={{ fontWeight:600 }}>Generated By</TableCell>
                        <TableCell sx={{ fontWeight:600 }}>Duration</TableCell>
                        <TableCell sx={{ fontWeight:600 }}>Format</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {exportLog.map((r,i)=> (
                        <TableRow key={i}>
                          <TableCell>{r.ts}</TableCell>
                          <TableCell>{r.type}</TableCell>
                          <TableCell>{r.user}</TableCell>
                          <TableCell>{r.duration}</TableCell>
                          <TableCell>{r.format}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </React.Fragment>
          )}

          {section === 'Records' && (
            <AdminRecords recentUploads={recentUploads} loading={loading} />
          )}
          {section === 'Analytics' && (
            <AdminAnalytics />
          )}
          {section === 'Agents' && (
            <AdminAgents token={token} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
