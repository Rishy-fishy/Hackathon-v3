import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, CardContent, TextField, InputAdornment, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Stack, Menu, MenuItem, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, InputLabel, Select, Snackbar
} from '@mui/material';
import { Search as SearchIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';

// Clean implementation: header filter menus for Age, Gender, Location, Malnutrition Status
export default function AdminRecords({ recentUploads = [], loading }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ age: null, gender: '', location: '', status: '' });
  const [menus, setMenus] = useState({ age: null, gender: null, location: null, status: null });
  const [records, setRecords] = useState([]); // editable working copy
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState(null); // { record, index }
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Build dataset (fallback demo data when empty)
  const dataset = useMemo(() => {
    if (recentUploads.length) {
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
  }, [recentUploads]);

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

  const beginEdit = (row) => { setEditing({ ...row }); setEditOpen(true); };
  const closeEdit = () => { setEditOpen(false); setEditing(null); };
  const saveEdit = () => {
    if (!editing) return;
    setRecords(rs => rs.map(r => r.id === editing.id ? editing : r));
    // Placeholder: here you could call an API to persist edits.
    closeEdit();
  };
  const beginDelete = (row) => { setToDelete(row); setDeleteOpen(true); };
  const closeDelete = () => { setDeleteOpen(false); setToDelete(null); };
  const confirmDelete = () => {
    if (toDelete) {
      setRecords(rs => {
        const index = rs.findIndex(r => r.id === toDelete.id);
        const updated = rs.filter(r => r.id !== toDelete.id);
        setRecentlyDeleted({ record: toDelete, index });
        setSnackbarOpen(true);
        return updated;
      });
    }
    // Placeholder: API call to delete record could go here.
    closeDelete();
    if (editOpen) closeEdit();
  };
  const undoDelete = () => {
    if (recentlyDeleted) {
      setRecords(rs => {
        const { record, index } = recentlyDeleted;
        const copy = [...rs];
        const insertAt = Math.min(Math.max(index, 0), copy.length);
        copy.splice(insertAt, 0, record);
        return copy;
      });
      setRecentlyDeleted(null);
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
                    <Typography variant='body2' color='text.secondary'>{loading ? 'Loading records...' : 'No records found'}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={editOpen} onClose={closeEdit} maxWidth='sm' fullWidth>
          <DialogTitle>Edit Record</DialogTitle>
            <DialogContent dividers>
              {editing && (
                <Stack spacing={2} mt={1}>
                  <TextField label='Child ID' value={editing.id} size='small' disabled />
                  <TextField label='Name' value={editing.name} size='small' onChange={e=>setEditing(ed=>({...ed, name:e.target.value}))} />
                  <TextField label='Age' type='number' value={editing.age} size='small' onChange={e=>setEditing(ed=>({...ed, age:Number(e.target.value)}))} />
                  <FormControl size='small'>
                    <InputLabel>Gender</InputLabel>
                    <Select label='Gender' value={editing.gender} onChange={e=>setEditing(ed=>({...ed, gender:e.target.value}))}>
                      <MenuItem value='Male'>Male</MenuItem>
                      <MenuItem value='Female'>Female</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField label='Location' value={editing.location} size='small' onChange={e=>setEditing(ed=>({...ed, location:e.target.value}))} />
                  <TextField label='Representative ID' value={editing.rep} size='small' onChange={e=>setEditing(ed=>({...ed, rep:e.target.value}))} />
                  <FormControl size='small'>
                    <InputLabel>Status</InputLabel>
                    <Select label='Status' value={editing.status} onChange={e=>setEditing(ed=>({...ed, status:e.target.value}))}>
                      {['Severe','Moderate','Mild','Normal'].map(s=> <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ justifyContent:'space-between' }}>
              <Button color='error' variant='contained' onClick={()=>beginDelete(editing)} disabled={!editing}>Delete</Button>
              <Box>
                <Button onClick={closeEdit} color='inherit' sx={{ mr:1 }}>Cancel</Button>
                <Button onClick={saveEdit} variant='contained'>Save</Button>
              </Box>
            </DialogActions>
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
            <Button onClick={closeDelete} color='inherit'>Cancel</Button>
            <Button onClick={confirmDelete} color='error' variant='contained'>Delete</Button>
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
