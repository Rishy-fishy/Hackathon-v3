import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Box, Button, Menu, MenuItem, Grid, LinearProgress, Stack
} from '@mui/material';

// Simple sparkline helper (static demo data similar to dashboard)
const trendPoints = [12,25,18,32,22,28,40,24,38,30];
const polyline = trendPoints.map((p,i)=>`${(i/(trendPoints.length-1))*100},${100 - p}`).join(' ');
const areaPath = `M0,100 L${polyline.replace(/ /g,' L')} L100,100 Z`;

export default function AdminAnalytics(){
  const [anchorRegion, setAnchorRegion] = useState(null);
  const [anchorActivity, setAnchorActivity] = useState(null);
  const [region, setRegion] = useState('All Regions');
  const [activity, setActivity] = useState('Field Activity');

  const regions = ['All Regions','North','South','East','West'];
  const activities = ['Field Activity','Survey','Vaccination','Nutrition'];

  const openR = (e)=>setAnchorRegion(e.currentTarget);
  const openA = (e)=>setAnchorActivity(e.currentTarget);
  const closeR = ()=>setAnchorRegion(null);
  const closeA = ()=>setAnchorActivity(null);
  const chooseRegion = (r)=>{ setRegion(r); closeR(); };
  const chooseActivity = (a)=>{ setActivity(a); closeA(); };

  const indicators = [
    { label:'Vaccination', value:75, color:'#0ea5e9' },
    { label:'Nutrition', value:90, color:'#22c55e' },
    { label:'Growth', value:60, color:'#6366f1' },
    { label:'Check-ups', value:30, color:'#ef4444' }
  ];

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:3 }}>
      <Box>
        <Typography variant='h6' fontWeight={600} gutterBottom>Analytics Dashboard</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb:2 }}>Analyze child health data across regions and field activities.</Typography>
        <Stack direction='row' spacing={1.5}>
          <Button onClick={openR} size='small' variant='outlined' sx={{ textTransform:'none', borderRadius:2, fontWeight:500 }}>{region}</Button>
            <Menu anchorEl={anchorRegion} open={Boolean(anchorRegion)} onClose={closeR}>
              {regions.map(r=> <MenuItem key={r} onClick={()=>chooseRegion(r)}>{r}</MenuItem>)}
            </Menu>
          <Button onClick={openA} size='small' variant='outlined' sx={{ textTransform:'none', borderRadius:2, fontWeight:500 }}>{activity}</Button>
            <Menu anchorEl={anchorActivity} open={Boolean(anchorActivity)} onClose={closeA}>
              {activities.map(a=> <MenuItem key={a} onClick={()=>chooseActivity(a)}>{a}</MenuItem>)}
            </Menu>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, height:'100%' }}>
            <CardContent>
              <Typography variant='subtitle2' fontWeight={600}>Regional Health Trends</Typography>
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mt:0.5, mb:1.5 }}>
                <Typography variant='h6' color='success.main' fontWeight={700} sx={{ fontSize:24 }}>+12%</Typography>
                <Typography variant='caption' color='success.main'>+12% vs last 30 days</Typography>
              </Box>
              <Box sx={{ height:170, position:'relative', background:'linear-gradient(180deg,#ffffff,#f3f6fa)', borderRadius:2, border:'1px solid #f1f5f9', px:0.5, overflow:'hidden' }}>
                <svg width='100%' height='100%' viewBox='0 0 100 100' preserveAspectRatio='none'>
                  <path d={areaPath} fill='url(#gradFillAna)' opacity='0.35' />
                  <polyline fill='none' stroke='#0284c7' strokeWidth='2.2' strokeLinejoin='round' strokeLinecap='round' points={polyline} />
                  <defs>
                    <linearGradient id='gradFillAna' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='0%' stopColor='#0ea5e9' stopOpacity='0.55' />
                      <stop offset='100%' stopColor='#0ea5e9' stopOpacity='0' />
                    </linearGradient>
                  </defs>
                </svg>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2, height:'100%' }}>
            <CardContent>
              <Typography variant='subtitle2' fontWeight={600}>Field Activity Levels</Typography>
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mt:0.5, mb:1.5 }}>
                <Typography variant='h6' color='error.main' fontWeight={700} sx={{ fontSize:24 }}>-5%</Typography>
                <Typography variant='caption' color='error.main'>-5% vs last 30 days</Typography>
              </Box>
              <Box sx={{ height:170, display:'flex', alignItems:'flex-end', justifyContent:'space-between', px:1 }}>
                {['A','B','C','D','E','F','G'].map((l,i)=>{
                  const h = [50,60,40,70,55,65,45][i];
                  return (
                    <Box key={l} sx={{ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', mx:0.25 }}>
                      <Box sx={{ width:18, borderRadius:1, background:'#e2e8f0', height:100, position:'relative', overflow:'hidden' }}>
                        <Box sx={{ position:'absolute', bottom:0, left:0, right:0, height:`${h}%`, bgcolor:'#6366f1' }} />
                      </Box>
                      <Typography variant='caption' sx={{ mt:0.5, color:'text.secondary' }}>{l}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card elevation={0} sx={{ border:'1px solid #e2e8f0', borderRadius:2 }}>
        <CardContent>
          <Typography variant='subtitle2' fontWeight={600} gutterBottom>Child Health Indicators</Typography>
          <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
            <Typography variant='h6' color='success.main' fontWeight={700} sx={{ fontSize:24 }}>+8%</Typography>
            <Typography variant='caption' color='success.main'>+8% vs last 30 days</Typography>
          </Box>
          <Stack spacing={2}>
            {indicators.map(row => (
              <Box key={row.label} sx={{ display:'flex', alignItems:'center', gap:3 }}>
                <Typography sx={{ width:120, fontSize:13, fontWeight:500, color:'#475569' }}>{row.label}</Typography>
                <Box sx={{ flex:1, position:'relative', height:10, borderRadius:5, background:'#e5e7eb' }}>
                  <Box sx={{ position:'absolute', left:0, top:0, bottom:0, width:`${row.value}%`, background:row.color, borderRadius:5 }} />
                </Box>
                <Typography variant='caption' sx={{ width:40, textAlign:'right', color:'text.secondary' }}>{row.value}%</Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
