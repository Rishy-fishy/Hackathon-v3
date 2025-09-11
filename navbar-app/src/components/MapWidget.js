import React, { useMemo } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { Box, CircularProgress, Typography } from '@mui/material';

/*
  Basic Google Map wrapper.
  NOTE: Provide your Google Maps API key via one of:
    1. window.__GOOGLE_MAPS_API_KEY injected at runtime (e.g. public/runtime-config.js)
    2. REACT_APP_GOOGLE_MAPS_KEY environment variable at build time
  Fallback: renders a message prompting for key.
*/
export default function MapWidget({ height=260, markers=[] }) {
  const runtimeKey = typeof window !== 'undefined' && window.__GOOGLE_MAPS_API_KEY;
  const apiKey = runtimeKey || process.env.REACT_APP_GOOGLE_MAPS_KEY;
  const center = useMemo(()=>({ lat: 20.5937, lng: 78.9629 }), []); // India centroid as neutral example

  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey || '' });

  if (!apiKey) {
    return (
      <Box sx={{ height, border:'1px dashed #cbd5e1', borderRadius:1, p:2, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
        <Typography variant='body2' color='text.secondary'>Google Maps API key missing.</Typography>
        <Typography variant='caption' color='text.secondary'>Set REACT_APP_GOOGLE_MAPS_KEY or window.__GOOGLE_MAPS_API_KEY</Typography>
      </Box>
    );
  }
  if (loadError) {
    return <Box sx={{ height, border:'1px solid #fecaca', borderRadius:1, p:2, display:'flex', alignItems:'center', justifyContent:'center', color:'#dc2626' }}>Map failed to load</Box>;
  }
  if (!isLoaded) {
    return <Box sx={{ height, display:'flex', alignItems:'center', justifyContent:'center' }}><CircularProgress size={28} /></Box>;
  }

  return (
    <Box sx={{ height, borderRadius:1, overflow:'hidden', position:'relative' }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={5}
        options={{
          mapTypeControl:false,
          fullscreenControl:false,
          streetViewControl:false,
          styles:[{ featureType:'poi', stylers:[{ visibility:'off'}]}]
        }}
      >
        {markers.map((m,i)=>(
          <Marker key={i} position={m.position} title={m.label || ''} />
        ))}
      </GoogleMap>
    </Box>
  );
}
