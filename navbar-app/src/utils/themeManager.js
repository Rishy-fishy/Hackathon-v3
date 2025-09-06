// Theme Manager using Dark Reader
class ThemeManager {
  constructor() {
    this.darkReaderConfig = {
      brightness: 100,
      contrast: 90,
      sepia: 10
    };
    
    this.init();
  }

  init() {
    // Wait for Dark Reader to be available
    this.waitForDarkReader().then(() => {
      // Apply saved theme on page load
      this.applySavedTheme();
      
      // Listen for system theme changes if auto mode is enabled
      this.setupSystemThemeListener();
    });
  }

  async waitForDarkReader() {
    return new Promise((resolve) => {
      if (window.DarkReader) {
        resolve();
        return;
      }
      
      const checkInterval = setInterval(() => {
        if (window.DarkReader) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('Dark Reader not loaded after 5 seconds');
        resolve();
      }, 5000);
    });
  }

  applySavedTheme() {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      this.setTheme(settings.theme || 'light');
    }
  }

  setTheme(theme) {
    if (!window.DarkReader) {
      console.warn('Dark Reader not available');
      return;
    }

    switch (theme) {
      case 'dark':
        window.DarkReader.enable(this.darkReaderConfig);
        break;
      case 'light':
        window.DarkReader.disable();
        break;
      case 'auto':
        window.DarkReader.auto(this.darkReaderConfig);
        break;
      default:
        window.DarkReader.disable();
    }
  }

  setupSystemThemeListener() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.theme === 'auto') {
            // Re-apply auto theme to pick up system change
            this.setTheme('auto');
          }
        }
      });
    }
  }

  isEnabled() {
    return window.DarkReader ? window.DarkReader.isEnabled() : false;
  }

  async exportGeneratedCSS() {
    if (window.DarkReader) {
      return await window.DarkReader.exportGeneratedCSS();
    }
    return '';
  }

  updateConfig(config) {
    this.darkReaderConfig = { ...this.darkReaderConfig, ...config };
    // Re-apply current theme with new config if dark mode is active
    if (this.isEnabled()) {
      window.DarkReader.enable(this.darkReaderConfig);
    }
  }
}

// Create and export a singleton instance
export const themeManager = new ThemeManager();
export default themeManager;
