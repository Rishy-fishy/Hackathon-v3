import React, { useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip } from '@mui/material';

// Modern MUI-based Reports page with editable data rows.
export default function AdminReports(){
  // Placeholder datasets
  const [summary, setSummary] = useState([
    { key:'totalRecords', label:'Total Records', value:12458, note:'+5.2% vs last period' },
    { key:'activeAgents', label:'Active Field Agents', value:78, note:'+0 vs last period' },
    { key:'newRecords', label:'New Records (Period)', value:1230, note:'-2.1% new records' }
  ]);
  const [distribution, setDistribution] = useState([
    { key:'severe', label:'Severe', percent:15 },
    { key:'moderate', label:'Moderate', percent:25 },
    { key:'mild', label:'Mild', percent:18 }
  ]);
  const [editing, setEditing] = useState(null); // { section:'summary'|'distribution', index }
  const [draft, setDraft] = useState({});

  function openEdit(section, index){
    setEditing({ section, index });
    const source = section==='summary'? summary : distribution;
    setDraft({ ...source[index] });
  }
  function closeEdit(){ setEditing(null); }
  function saveEdit(){
    if(!editing) return;
    if(editing.section==='summary'){
      setSummary(s=> s.map((row,i)=> i===editing.index? { ...row, ...draft, value: Number(draft.value)||0 } : row));
    } else {
      setDistribution(d=> d.map((row,i)=> i===editing.index? { ...row, ...draft, percent: Number(draft.percent)||0 } : row));
    }
    closeEdit();
  }

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:3 }}>
      <Typography variant='h6' fontWeight={600}>Reports (Editable Data)</Typography>
      <Grid container spacing={3}>
        {/* Summary Metrics Table */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
            <CardContent sx={{ p:2.2 }}>
              <Typography variant='subtitle2' fontWeight={600} mb={1}>Summary Metrics</Typography>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight:600 }}>Metric</TableCell>
                    <TableCell sx={{ fontWeight:600 }}>Value</TableCell>
                    <TableCell sx={{ fontWeight:600 }}>Note</TableCell>
                    <TableCell sx={{ fontWeight:600 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.map((row,i)=>(
                    <TableRow key={row.key} hover>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>{row.value}</TableCell>
                      <TableCell>{row.note}</TableCell>
                      <TableCell><Button size='small' onClick={()=>openEdit('summary', i)}>Edit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
        {/* Distribution Table */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
            <CardContent sx={{ p:2.2 }}>
              <Typography variant='subtitle2' fontWeight={600} mb={1}>Malnutrition Distribution</Typography>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight:600 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight:600 }}>Percent</TableCell>
                    <TableCell sx={{ fontWeight:600 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {distribution.map((row,i)=>(
                    <TableRow key={row.key} hover>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>
                        <Chip size='small' label={`${row.percent}%`} sx={{ bgcolor:'rgba(14,165,233,.08)', color:'#0c4a6e', fontWeight:600 }} />
                      </TableCell>
                      <TableCell><Button size='small' onClick={()=>openEdit('distribution', i)}>Edit</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editing)} onClose={closeEdit} fullWidth maxWidth='sm'>
        <DialogTitle>Edit Entry</DialogTitle>
        <DialogContent sx={{ pt:2, display:'flex', flexDirection:'column', gap:2 }}>
          {editing?.section==='summary' && (
            <>
              <TextField label='Metric Label' size='small' value={draft.label||''} onChange={e=>setDraft(d=>({...d,label:e.target.value}))} fullWidth />
              <TextField label='Value' size='small' value={draft.value||''} onChange={e=>setDraft(d=>({...d,value:e.target.value}))} fullWidth />
              <TextField label='Note' size='small' value={draft.note||''} onChange={e=>setDraft(d=>({...d,note:e.target.value}))} fullWidth />
            </>
          )}
          {editing?.section==='distribution' && (
            <>
              <TextField label='Severity Label' size='small' value={draft.label||''} onChange={e=>setDraft(d=>({...d,label:e.target.value}))} fullWidth />
              <TextField label='Percent' size='small' value={draft.percent||''} onChange={e=>setDraft(d=>({...d,percent:e.target.value}))} fullWidth />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant='contained' onClick={saveEdit}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
