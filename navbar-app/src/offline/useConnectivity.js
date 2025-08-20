import { useEffect, useState } from 'react';

export default function useConnectivity(pingUrl='/api/ping', intervalMs=15000) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(()=>{
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const id = setInterval(async ()=>{
      try { await fetch(pingUrl, { method:'HEAD', cache:'no-store' }); setOnline(true);} catch { setOnline(false);}  
    }, intervalMs);
    return ()=>{ window.removeEventListener('online', update); window.removeEventListener('offline', update); clearInterval(id);} ;
  }, [pingUrl, intervalMs]);

  return online;
}
