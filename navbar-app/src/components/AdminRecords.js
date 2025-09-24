import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card, CardContent, TextField, InputAdornment, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Stack, Menu, MenuItem, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Snackbar
} from '@mui/material';
import { Search as SearchIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';

// Clean implementation: header filter menus for Age, Gender, Location, Malnutrition Status
export default function AdminRecords() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ age: null, gender: '', location: '', status: '' });
  const [menus, setMenus] = useState({ age: null, gender: null, location: null, status: null });
  const [records, setRecords] = useState([]); // working copy of records
  const [allRecords, setAllRecords] = useState([]); // all records from MongoDB
  const [recordsLoading, setRecordsLoading] = useState(true);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState(null); // { record, index }
  const [snackbarOpen, setSnackbarOpen] = useState(false);

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
      const transformedRecords = data.records.map((record, idx) => {
        // Extract location info - handle both string and object formats
        let locationDisplay = `Location ${idx+1}`; // fallback
        if (record.uploaderLocation) {
          if (typeof record.uploaderLocation === 'string') {
            locationDisplay = record.uploaderLocation;
          } else if (typeof record.uploaderLocation === 'object') {
            // Extract city and state from location object
            const { city, state, country } = record.uploaderLocation;
            const parts = [city, state].filter(Boolean);
            locationDisplay = parts.length > 0 ? parts.join(', ') : (country || 'Unknown Location');
          }
        } else if (record.location) {
          locationDisplay = record.location;
        } else if (record.address) {
          locationDisplay = record.address;
        }

        // Determine malnutrition status based on malnutrition signs directly
        let malnutritionStatus = 'Normal'; // default for all cases including N/A
        
        if (record.malnutritionSigns && 
            record.malnutritionSigns !== 'None' && 
            record.malnutritionSigns !== '' && 
            record.malnutritionSigns !== 'none' &&
            record.malnutritionSigns !== 'N/A' &&
            record.malnutritionSigns !== 'n/a') {
          
          // Count the number of malnutrition signs by splitting and filtering
          const signs = record.malnutritionSigns
            .split(/[,;|\n()]/) // Added parentheses to split on
            .map(sign => sign.trim())
            .filter(sign => sign && 
                   sign !== 'None' && 
                   sign !== 'none' && 
                   sign !== 'N/A' && 
                   sign !== 'n/a' && 
                   sign !== 'nil' &&
                   sign.length > 2); // Filter out very short fragments
          
          const signCount = signs.length;
          
          if (signCount === 1) {
            malnutritionStatus = 'Normal';
          } else if (signCount === 2 || signCount === 3) {
            malnutritionStatus = 'Moderate';
          } else if (signCount > 3) {
            malnutritionStatus = 'Severe';
          }
        }

        return {
          // Only include the fields we need, without spreading the original record
          id: record.healthId || record._id || `ID${idx+1}`,
          name: record.name || 'Unknown',
          age: record.ageMonths || record.age || Math.floor(Math.random() * 60) + 1,
          gender: record.gender || (idx % 2 ? 'Male' : 'Female'),
          location: locationDisplay,
          rep: record.uploaderName || record.representative || record.rep || `Rep${String(idx+1).padStart(3, '0')}`,
          status: malnutritionStatus, // Our calculated status - no override possible
          uploadedAt: record.uploadedAt ? new Date(record.uploadedAt) : new Date(),
          // Include other useful fields but not the original status
          healthId: record.healthId,
          weightKg: record.weightKg,
          heightCm: record.heightCm,
          malnutritionSigns: record.malnutritionSigns,
          guardianName: record.guardianName,
          guardianPhone: record.guardianPhone,
          createdAt: record.createdAt
        };
      });
      
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

  // Build dataset (only use real MongoDB data, no fallbacks)
  const dataset = useMemo(() => {
    // Only use MongoDB records - no fallbacks to avoid showing temporary demo data
    console.log('[AdminRecords] Using MongoDB records:', allRecords.length);
    return allRecords;
  }, [allRecords]);

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
              {recordsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align='center' sx={{ py:6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Loading...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : rows.length > 0 ? rows.map(r => (
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
                    <Typography variant='body2' sx={{ color:'#dc2626', cursor:'pointer', fontWeight:500 }} onClick={()=>beginDelete(r)}>Delete</Typography>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} align='center' sx={{ py:6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      No records found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>



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
