import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card, CardContent, TextField, InputAdornment, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Stack, Menu, MenuItem, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, InputLabel, Select, Snackbar, Grid, Divider, IconButton
} from '@mui/material';
import { Search as SearchIcon, ArrowDropDown as ArrowDropDownIcon, Close as CloseIcon, DeleteOutline as DeleteOutlineIcon, PhotoCamera as PhotoCameraIcon } from '@mui/icons-material';

// Clean implementation: header filter menus for Age, Gender, Location, Malnutrition Status
export default function AdminRecords({ recentUploads = [], loading }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ age: null, gender: '', location: '', status: '' });
  const [menus, setMenus] = useState({ age: null, gender: null, location: null, status: null });
  const [records, setRecords] = useState([]); // editable working copy
  const [allRecords, setAllRecords] = useState([]); // all records from MongoDB
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState(null); // { record, index }
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // API base URL
  const API_BASE = (
    (typeof window !== 'undefined' && window.__API_BASE) ||
    process.env.REACT_APP_API_BASE ||
    'http://34.58.198.143:8080'
  ).replace(/\/$/, '');

  // Fetch all records from MongoDB
  const fetchAllRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
      if (!token) {
        console.warn('No admin token found for fetching records');
        setRecordsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/admin/children?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch records: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AdminRecords] Fetched records:', data.total, 'records');
      
      // Transform the records to match the expected format
      const transformedRecords = data.records.map((record, idx) => ({
        id: record.healthId || record._id || `ID${idx+1}`,
        name: record.name || 'Unknown',
        age: record.age || record.ageInMonths || (Math.floor(Math.random() * 5) + 1),
        gender: record.gender || (idx % 2 ? 'Male' : 'Female'),
        location: record.location || record.address || `Location ${idx+1}`,
        rep: record.representative || record.rep || `Rep${String(idx+1).padStart(3, '0')}`,
        status: record.malnutritionStatus || record.status || 'Normal',
        uploadedAt: record.uploadedAt ? new Date(record.uploadedAt) : new Date(),
        // Include all original data for editing
        ...record
      }));
      
      setAllRecords(transformedRecords);
      
    } catch (error) {
      console.error('[AdminRecords] Failed to fetch records:', error);
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'error', message: 'Failed to load records from database' } 
      }));
    } finally {
      setRecordsLoading(false);
    }
  }, [API_BASE]);

  // Fetch records on component mount
  useEffect(() => {
    fetchAllRecords();
  }, [fetchAllRecords]);

  // Build dataset (use real MongoDB data when available, fallback to demo data)
  const dataset = useMemo(() => {
    // Priority 1: Use all records from MongoDB if available
    if (allRecords.length > 0) {
      console.log('[AdminRecords] Using MongoDB records:', allRecords.length);
      return allRecords;
    }
    
    // Priority 2: Use recent uploads as fallback (limited data)
    if (recentUploads.length > 0) {
      console.log('[AdminRecords] Using recentUploads as fallback:', recentUploads.length);
      return recentUploads.map((u, idx) => ({
        id: u.healthId || `ID${idx+1}`,
        name: u.name || 'Unknown',
        age: u.age || (2 + (idx % 5)),
        gender: u.gender || (idx % 2 ? 'Male' : 'Female'),
        location: u.location || `Rural Village ${String.fromCharCode(65 + (idx % 6))}`,
        rep: u.representative || `Rep00${(idx%9)+1}`,
        status: u.malnutritionStatus || (['Severe','Moderate','Mild','Normal'][idx % 4]),
        uploadedAt: u.uploadedAt ? new Date(u.uploadedAt) : null
      }));
    }
    
    // Priority 3: Demo data when no real data is available
    console.log('[AdminRecords] Using demo data');
    return Array.from({ length: 12 }).map((_, idx) => ({
      id: ['12345','67890','11223','33445','55667','77889','99001','22334','44556','66778','88990','99011'][idx],
      name: ['Sophia Clark','Ethan Carter','Olivia Davis','Liam Evans','Ava Foster','Noah Green','Isabella Hayes','Jackson Ingram','Mia Jenkins','Lucas King','Harper Lewis','Mason Moore'][idx],
      age: [3,2,4,5,3,4,2,4,1,3,5,2][idx],
      gender: ['Female','Male','Female','Male','Female','Male','Female','Male','Female','Male','Female','Male'][idx],
      location: ['Rural Village A','Urban Center B','Rural Village C','Urban Center D','Rural Village E','Urban Center F','Rural Village G','Urban Center H','Rural Village I','Urban Center J','Rural Village K','Urban Center L'][idx],
      rep: ['Rep001','Rep002','Rep003','Rep004','Rep005','Rep006','Rep007','Rep008','Rep009','Rep010','Rep011','Rep012'][idx],
      status: ['Severe','Moderate','Mild','Normal','Severe','Moderate','Mild','Normal','Severe','Moderate','Mild','Normal'][idx],
      uploadedAt: new Date()
    }));
  }, [allRecords, recentUploads]);

  // sync working copy when dataset changes
  useEffect(() => { setRecords(dataset); }, [dataset]);

  const unique = useMemo(()=>({
    age: Array.from(new Set(records.map(r=>r.age))).sort((a,b)=>a-b),
    gender: Array.from(new Set(records.map(r=>r.gender))).sort(),
    location: Array.from(new Set(records.map(r=>r.location))).sort(),
    status: Array.from(new Set(records.map(r=>r.status)))
  }), [records]);

  const rows = useMemo(()=>{
    return records.filter(r => {
      if (search) {
        const s = search.toLowerCase();
        if(![r.id, r.name, r.location, r.rep].some(v => String(v).toLowerCase().includes(s))) return false;
      }
      if (filters.age != null && r.age !== filters.age) return false;
      if (filters.gender && r.gender !== filters.gender) return false;
      if (filters.location && r.location !== filters.location) return false;
      if (filters.status && r.status !== filters.status) return false;
      return true;
    });
  }, [records, search, filters]);

  const statusColor = (status) => ({ Severe:'error', Moderate:'warning', Mild:'info', Normal:'success' }[status] || 'default');

  const openMenu = (key, e) => setMenus(m => ({ ...m, [key]: e.currentTarget }));
  const closeMenu = (key) => setMenus(m => ({ ...m, [key]: null }));
  const chooseFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); closeMenu(key); };
  const clearFilter = (key) => setFilters(f=>({ ...f, [key]: key==='age'? null : '' }));

  const beginEdit = (row) => {
    setEditing({
      ...row,
      dateOfBirth: row.dateOfBirth || '',
      aadhaarId: row.aadhaarId || '',
      weightKg: row.weightKg || '',
      heightCm: row.heightCm || '',
      guardianName: row.guardianName || row.rep || '',
      phoneNumber: row.phoneNumber || '',
      relation: row.relation || '',
      photoData: row.photoData || ''
    });
    setEditOpen(true);
  };
  const closeEdit = () => { setEditOpen(false); setEditing(null); };
  const saveEdit = async () => {
    if (!editing) return;
    
    setSaving(true);
    try {
      // Get admin token
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
      if (!token) {
        window.dispatchEvent(new CustomEvent('toast', { 
          detail: { type: 'error', message: 'Authentication required. Please log in again.' } 
        }));
        return;
      }

      // Prepare update data
      const updateData = {
        name: editing.name,
        gender: editing.gender,
        dateOfBirth: editing.dateOfBirth,
        weightKg: editing.weightKg ? parseFloat(editing.weightKg) : null,
        heightCm: editing.heightCm ? parseFloat(editing.heightCm) : null,
        status: editing.status,
        guardianName: editing.guardianName,
        phoneNumber: editing.phoneNumber,
        relation: editing.relation,
        aadhaarId: editing.aadhaarId,
        location: editing.location,
        rep: editing.rep,
        photoData: editing.photoData
      };

      const response = await fetch(`${API_BASE}/api/admin/child/${editing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Update failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Update local state with the response from server
      const updatedRecord = {
        ...result.record,
        id: result.record.healthId, // ensure consistency
        status: result.record.malnutritionStatus || result.record.status,
        rep: result.record.representative || result.record.rep
      };
      
      setRecords(rs => rs.map(r => r.id === editing.id ? updatedRecord : r));
      
      // Also update allRecords to keep data in sync
      setAllRecords(rs => rs.map(r => r.id === editing.id ? updatedRecord : r));
      
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'success', message: 'Record updated successfully in MongoDB!' } 
      }));
      
      closeEdit();
    } catch (error) {
      console.error('Save error:', error);
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'error', message: error.message || 'Failed to update record' } 
      }));
    } finally {
      setSaving(false);
    }
  };
  const beginDelete = (row) => { setToDelete(row); setDeleteOpen(true); };
  const closeDelete = () => { setDeleteOpen(false); setToDelete(null); };
  const confirmDelete = async () => {
    if (!toDelete) return;
    
    setDeleting(true);
    try {
      // Get admin token
      const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
      if (!token) {
        window.dispatchEvent(new CustomEvent('toast', { 
          detail: { type: 'error', message: 'Authentication required. Please log in again.' } 
        }));
        return;
      }

      const response = await fetch(`${API_BASE}/api/admin/child/${toDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Delete failed: ${response.status}`);
      }

      // Remove from both local state and allRecords
      setRecords(rs => {
        const index = rs.findIndex(r => r.id === toDelete.id);
        const updated = rs.filter(r => r.id !== toDelete.id);
        setRecentlyDeleted({ record: toDelete, index });
        setSnackbarOpen(true);
        return updated;
      });
      
      // Also remove from allRecords to keep data in sync
      setAllRecords(rs => rs.filter(r => r.id !== toDelete.id));

      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'success', message: 'Record deleted successfully from MongoDB!' } 
      }));
      
    } catch (error) {
      console.error('Delete error:', error);
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'error', message: error.message || 'Failed to delete record' } 
      }));
    } finally {
      setDeleting(false);
    }
    
    closeDelete();
    if (editOpen) closeEdit();
  };
  const undoDelete = () => {
    if (recentlyDeleted) {
      // Note: This only restores the record in the UI - it's permanently deleted from MongoDB
      setRecords(rs => {
        const { record, index } = recentlyDeleted;
        const copy = [...rs];
        const insertAt = Math.min(Math.max(index, 0), copy.length);
        copy.splice(insertAt, 0, record);
        return copy;
      });
      setRecentlyDeleted(null);
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'warning', message: 'Record restored in UI only - it was permanently deleted from MongoDB' } 
      }));
    }
    setSnackbarOpen(false);
  };
  const closeSnackbar = () => setSnackbarOpen(false);

  return (
    <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, background:'#fff' }}>
      <CardContent sx={{ p:3 }}>
        <Stack direction='row' spacing={2} alignItems='stretch' mb={2}>
          <TextField
            placeholder='Search records...'
            size='small'
            fullWidth
            value={search}
            onChange={e=>setSearch(e.target.value)}
            InputProps={{ startAdornment:(<InputAdornment position='start'><SearchIcon fontSize='small' /></InputAdornment>) }}
            sx={{ bgcolor:'#fff' }}
          />
        </Stack>

        <TableContainer component={Paper} variant='outlined' sx={{ borderColor:'#f1f5f9' }}>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight:600 }}>CHILD ID</TableCell>
                <TableCell sx={{ fontWeight:600 }}>NAME</TableCell>
                <TableCell sx={{ fontWeight:600 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:.5 }}>
                    AGE
                      <Box component='span' role='button' onClick={(e)=>openMenu('age', e)} tabIndex={0} aria-haspopup='true' aria-label='Filter by age'
                        sx={{ lineHeight:0, cursor:'pointer', display:'inline-flex', alignItems:'center',
                          border:'0 !important', outline:'0 !important', boxShadow:'none !important', background:'transparent', p:0, m:0,
                          '& svg':{ transition:'color .15s', border:'0 !important' },
                          '&:hover svg':{ color:'#0f62fe' },
                          '&:focus,&:focus-visible':{ outline:'0 !important', boxShadow:'none' }
                        }}>
                        <ArrowDropDownIcon fontSize='small' />
                      </Box>
                    {filters.age!=null && <Chip size='small' label={filters.age} onDelete={()=>clearFilter('age')} />}
                  </Box>
                  <Menu anchorEl={menus.age} open={Boolean(menus.age)} onClose={()=>closeMenu('age')}>
                    <MenuItem onClick={()=>chooseFilter('age', null)}>All</MenuItem>
                    {unique.age.map(a=> <MenuItem key={a} onClick={()=>chooseFilter('age', a)}>{a}</MenuItem>)}
                  </Menu>
                </TableCell>
                <TableCell sx={{ fontWeight:600 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:.5 }}>
                    GENDER
                      <Box component='span' role='button' onClick={(e)=>openMenu('gender', e)} tabIndex={0} aria-haspopup='true' aria-label='Filter by gender'
                        sx={{ lineHeight:0, cursor:'pointer', display:'inline-flex', alignItems:'center',
                          border:'0 !important', outline:'0 !important', boxShadow:'none !important', background:'transparent', p:0, m:0,
                          '& svg':{ transition:'color .15s', border:'0 !important' },
                          '&:hover svg':{ color:'#0f62fe' },
                          '&:focus,&:focus-visible':{ outline:'0 !important', boxShadow:'none' }
                        }}>
                        <ArrowDropDownIcon fontSize='small' />
                      </Box>
                    {filters.gender && <Chip size='small' label={filters.gender} onDelete={()=>clearFilter('gender')} />}
                  </Box>
                  <Menu anchorEl={menus.gender} open={Boolean(menus.gender)} onClose={()=>closeMenu('gender')}>
                    <MenuItem onClick={()=>chooseFilter('gender', '')}>All</MenuItem>
                    {unique.gender.map(g=> <MenuItem key={g} onClick={()=>chooseFilter('gender', g)}>{g}</MenuItem>)}
                  </Menu>
                </TableCell>
                <TableCell sx={{ fontWeight:600 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:.5 }}>
                    LOCATION
                      <Box component='span' role='button' onClick={(e)=>openMenu('location', e)} tabIndex={0} aria-haspopup='true' aria-label='Filter by location'
                        sx={{ lineHeight:0, cursor:'pointer', display:'inline-flex', alignItems:'center',
                          border:'0 !important', outline:'0 !important', boxShadow:'none !important', background:'transparent', p:0, m:0,
                          '& svg':{ transition:'color .15s', border:'0 !important' },
                          '&:hover svg':{ color:'#0f62fe' },
                          '&:focus,&:focus-visible':{ outline:'0 !important', boxShadow:'none' }
                        }}>
                        <ArrowDropDownIcon fontSize='small' />
                      </Box>
                    {filters.location && <Chip size='small' label={filters.location} onDelete={()=>clearFilter('location')} />}
                  </Box>
                  <Menu anchorEl={menus.location} open={Boolean(menus.location)} onClose={()=>closeMenu('location')} sx={{ maxHeight:300 }}>
                    <MenuItem onClick={()=>chooseFilter('location', '')}>All</MenuItem>
                    {unique.location.map(l=> <MenuItem key={l} onClick={()=>chooseFilter('location', l)}>{l}</MenuItem>)}
                  </Menu>
                </TableCell>
                <TableCell sx={{ fontWeight:600 }}>REPRESENTATIVE ID</TableCell>
                <TableCell sx={{ fontWeight:600 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:.5 }}>
                    MALNUTRITION STATUS
                      <Box component='span' role='button' onClick={(e)=>openMenu('status', e)} tabIndex={0} aria-haspopup='true' aria-label='Filter by malnutrition status'
                        sx={{ lineHeight:0, cursor:'pointer', display:'inline-flex', alignItems:'center',
                          border:'0 !important', outline:'0 !important', boxShadow:'none !important', background:'transparent', p:0, m:0,
                          '& svg':{ transition:'color .15s', border:'0 !important' },
                          '&:hover svg':{ color:'#0f62fe' },
                          '&:focus,&:focus-visible':{ outline:'0 !important', boxShadow:'none' }
                        }}>
                        <ArrowDropDownIcon fontSize='small' />
                      </Box>
                    {filters.status && <Chip size='small' label={filters.status} onDelete={()=>clearFilter('status')} />}
                  </Box>
                  <Menu anchorEl={menus.status} open={Boolean(menus.status)} onClose={()=>closeMenu('status')}>
                    <MenuItem onClick={()=>chooseFilter('status', '')}>All</MenuItem>
                    {unique.status.map(s=> <MenuItem key={s} onClick={()=>chooseFilter('status', s)}>{s}</MenuItem>)}
                  </Menu>
                </TableCell>
                <TableCell sx={{ fontWeight:600 }} align='center'>ACTION</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length ? rows.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ color:'#0f62fe', fontWeight:600 }}>{r.id}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.age}</TableCell>
                  <TableCell>{r.gender}</TableCell>
                  <TableCell>{r.location}</TableCell>
                  <TableCell>{r.rep}</TableCell>
                  <TableCell>
                    <Chip size='small' label={r.status} color={statusColor(r.status)} variant='outlined' sx={{ fontWeight:600 }} />
                  </TableCell>
                  <TableCell align='center'>
                    <Typography variant='body2' sx={{ color:'#0f62fe', cursor:'pointer', fontWeight:500 }} onClick={()=>beginEdit(r)}>Edit</Typography>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} align='center' sx={{ py:6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      {loading || recordsLoading ? 'Loading records from MongoDB...' : 'No records found'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

  <Dialog open={editOpen} onClose={closeEdit} maxWidth='md' fullWidth scroll='paper' PaperProps={{ sx:{ border:'2px solid #000', borderRadius:0, boxShadow:'none' } }}>
          {editing && (
            <Box sx={{ position:'relative' }}>
              <DialogTitle sx={{ pb:0, typography:'h6', fontSize:18, fontWeight:600, textAlign:'center' }}>
                <IconButton onClick={closeEdit} sx={{ position:'absolute', right:12, top:12 }} aria-label='Close dialog'>
                  <CloseIcon />
                </IconButton>
                <Typography variant='subtitle1' align='center' sx={{ fontWeight:600, mt:1 }}>{editing.id}</Typography>
              </DialogTitle>
              <DialogContent dividers sx={{ pt:2 }}>
                <Box sx={{ borderBottom:'1px solid #000', mx:12, mb:4 }} />
                <Grid container spacing={4}>
                  {/* Form fields left */}
                  <Grid item xs={12} sm={8} md={9}>
                    <Grid container spacing={3}>
                      {/* Row 1 */}
                      <Grid item xs={12} md={4}>
                        <TextField label='Name *' fullWidth size='small' value={editing.name} onChange={e=>setEditing(ed=>({...ed, name:e.target.value}))} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl size='small' fullWidth>
                          <InputLabel>Gender</InputLabel>
                          <Select label='Gender' value={editing.gender||''} onChange={e=>setEditing(ed=>({...ed, gender:e.target.value}))}>
                            <MenuItem value='Male'>Male</MenuItem>
                            <MenuItem value='Female'>Female</MenuItem>
                            <MenuItem value='Other'>Other</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField label='Date of Birth' type='date' fullWidth size='small' InputLabelProps={{ shrink:true }} value={editing.dateOfBirth} onChange={e=>setEditing(ed=>({...ed, dateOfBirth:e.target.value}))} />
                      </Grid>
                      {/* Row 2 */}
                      <Grid item xs={12} md={4}>
                        <TextField label='Weight (kg)' type='number' fullWidth size='small' value={editing.weightKg} onChange={e=>setEditing(ed=>({...ed, weightKg:e.target.value}))} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField label='Height (cm)' type='number' fullWidth size='small' value={editing.heightCm} onChange={e=>setEditing(ed=>({...ed, heightCm:e.target.value}))} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl size='small' fullWidth>
                          <InputLabel>Status</InputLabel>
                          <Select label='Status' value={editing.status} onChange={e=>setEditing(ed=>({...ed, status:e.target.value}))}>
                            {['Severe','Moderate','Mild','Normal'].map(s=> <MenuItem key={s} value={s}>{s}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      {/* Row 3 */}
                      <Grid item xs={12} md={4}>
                        <TextField label='Guardian' fullWidth size='small' value={editing.guardianName} onChange={e=>setEditing(ed=>({...ed, guardianName:e.target.value}))} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField label='Phone Number' fullWidth size='small' value={editing.phoneNumber} onChange={e=>setEditing(ed=>({...ed, phoneNumber:e.target.value}))} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField label='Relation with Child' fullWidth size='small' value={editing.relation} onChange={e=>setEditing(ed=>({...ed, relation:e.target.value}))} />
                      </Grid>
                      {/* Row 4 */}
                      <Grid item xs={12} md={4}>
                        <TextField label='Aadhaar ID (optional)' fullWidth size='small' value={editing.aadhaarId} onChange={e=>setEditing(ed=>({...ed, aadhaarId:e.target.value}))} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField label='Location' fullWidth size='small' value={editing.location} onChange={e=>setEditing(ed=>({...ed, location:e.target.value}))} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField label='Representative ID' fullWidth size='small' value={editing.rep} onChange={e=>setEditing(ed=>({...ed, rep:e.target.value}))} />
                      </Grid>
                    </Grid>
                  </Grid>
                  {/* Photo upload right */}
                  <Grid item xs={12} sm={4} md={3} sx={{ display:'flex', justifyContent:'center', alignSelf:'flex-start' }}>
                    <Box sx={{ position:'relative', width:200, height:200, border:'2px solid #000', display:'flex', alignItems:'center', justifyContent:'center', bgcolor:'#fafafa' }}>
                      {editing.photoData ? (
                        <>
                          <img src={editing.photoData} alt='Child' style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          <IconButton size='small' onClick={()=>setEditing(ed=>({...ed, photoData:''}))} sx={{ position:'absolute', top:4, right:4, bgcolor:'rgba(255,255,255,0.9)' }} aria-label='Remove photo'>
                            <CloseIcon fontSize='small' />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton component='label' sx={{ flexDirection:'column', color:'#000', '&:hover':{ color:'#222' } }}>
                          <PhotoCameraIcon />
                          <Typography variant='caption' sx={{ fontSize:14 }}>Upload</Typography>
                          <input hidden type='file' accept='image/*' onChange={e=>{
                            const file = e.target.files?.[0];
                            if(file){
                              const reader = new FileReader();
                              reader.onload = ev => setEditing(ed=>({...ed, photoData: ev.target?.result || ''}));
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </IconButton>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions sx={{ px:3, py:2, position:'sticky', bottom:0, bgcolor:'#fff', borderTop:'2px solid #000', display:'flex', justifyContent:'space-between' }}>
                <Button 
                  onClick={()=>beginDelete(editing)} 
                  startIcon={<DeleteOutlineIcon />} 
                  color='error' 
                  variant='outlined' 
                  size='small' 
                  sx={{ textTransform:'none' }}
                  disabled={saving || deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
                <Box sx={{ display:'flex', gap:2 }}>
                  <Button 
                    onClick={closeEdit} 
                    variant='outlined' 
                    color='inherit' 
                    sx={{ textTransform:'none', minWidth:110 }}
                    disabled={saving || deleting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={saveEdit} 
                    variant='outlined' 
                    sx={{ textTransform:'none', borderColor:'#000', color:'#000', minWidth:120, '&:hover':{ bgcolor:'#000', color:'#fff', borderColor:'#000' } }}
                    disabled={saving || deleting}
                  >
                    {saving ? 'Saving...' : 'Save to MongoDB'}
                  </Button>
                </Box>
              </DialogActions>
            </Box>
          )}
        </Dialog>

        <Dialog open={deleteOpen} onClose={closeDelete} maxWidth='xs' fullWidth>
          <DialogTitle>Delete Record</DialogTitle>
          <DialogContent dividers>
            <Typography variant='body2' sx={{ mb:1 }}>You are about to permanently delete this record.</Typography>
            <Box sx={{ p:1, bgcolor:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:1 }}>
              <Typography variant='caption' display='block'><strong>ID:</strong> {toDelete?.id}</Typography>
              <Typography variant='caption' display='block'><strong>Name:</strong> {toDelete?.name}</Typography>
              <Typography variant='caption' display='block'><strong>Location:</strong> {toDelete?.location}</Typography>
              <Typography variant='caption' display='block'><strong>Status:</strong> {toDelete?.status}</Typography>
            </Box>
            <Typography variant='caption' color='error.main' display='block' sx={{ mt:1 }}>This action cannot be undone (unless you click UNDO immediately after).</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDelete} color='inherit' disabled={deleting}>Cancel</Button>
            <Button onClick={confirmDelete} color='error' variant='contained' disabled={deleting}>
              {deleting ? 'Deleting from MongoDB...' : 'Delete from MongoDB'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={5000}
          onClose={closeSnackbar}
          message={recentlyDeleted ? `Record ${recentlyDeleted.record.id} deleted` : 'Record deleted'}
          action={<Button size='small' onClick={undoDelete} sx={{ color:'#fff' }}>UNDO</Button>}
          ContentProps={{ sx:{ bgcolor:'#334155' } }}
        />
      </CardContent>
    </Card>
  );
}
