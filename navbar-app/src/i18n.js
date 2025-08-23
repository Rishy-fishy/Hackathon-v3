import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English translations
const resources = {
  en: {
    translation: {
      common: {
        welcome_message: 'Welcome to Child Health Records',
        welcome_user: 'Welcome, {{name}}!'
      },
      navigation: {
        profile: 'Profile'
      },
      app: {
        subtitle: 'Manage child health records efficiently'
      },
      home: {
        total_records: 'Total Records',
        pending_sync: 'Pending Sync'
      },
      sync: {
        sync_complete: 'Synced'
      },
      child: {
        add_new: 'Add New Record',
        child_information: 'Enter child health information'
      },
      records: {
        title: 'View Records',
        all_records: 'Browse all child health records'
      },
      settings: {
        title: 'Settings',
        general: 'Configure app preferences'
      },
      help: {
        title: 'Help & Guide',
        user_guide: 'Learn how to use the app'
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

export default i18n;
