// Theme Manager using darkreader module (no global dependency)
import { enable as drEnable, disable as drDisable, auto as drAuto, isEnabled as drIsEnabled, exportGeneratedCSS as drExportCSS } from 'darkreader';

class ThemeManager {
  constructor() {
    this.darkReaderConfig = { brightness:100, contrast:90, sepia:10 };
    // Apply saved theme immediately
    this.applySavedTheme();
    this.setupSystemThemeListener();
  }

  applySavedTheme(){
    try {
      const saved = localStorage.getItem('appSettings');
      if(saved){
        const { theme='light' } = JSON.parse(saved);
        this.setTheme(theme);
      }
    } catch(e){ console.warn('applySavedTheme failed', e); }
  }

  setTheme(theme){
    switch(theme){
      case 'dark': drEnable(this.darkReaderConfig); break;
      case 'auto': drAuto(this.darkReaderConfig); break;
      case 'light': default: drDisable(); break;
    }
  }

  setupSystemThemeListener(){
    if(!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', ()=>{
      try {
        const saved = localStorage.getItem('appSettings');
        if(saved){
          const { theme } = JSON.parse(saved);
            if(theme==='auto') this.setTheme('auto');
        }
      } catch {}
    });
  }

  isEnabled(){ return drIsEnabled(); }
  async exportGeneratedCSS(){ return await drExportCSS(); }
  updateConfig(config){
    this.darkReaderConfig = { ...this.darkReaderConfig, ...config };
    if(this.isEnabled()) drEnable(this.darkReaderConfig);
  }
}

export const themeManager = new ThemeManager();
export default themeManager;
