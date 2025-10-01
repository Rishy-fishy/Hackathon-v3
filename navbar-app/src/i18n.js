import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Multilingual translations
const resources = {
  en: {
    translation: {
      common: {
        welcome_message: 'Welcome to Child Health Records',
        welcome_user: 'Welcome, {{name}}!',
        add_child: 'ADD CHILD',
        view_data: 'VIEW DATA', 
        records: 'RECORDS',
        settings: 'SETTINGS',
        profile: 'PROFILE',
        upload: 'UPLOAD',
        search: 'Search',
        loading: 'Loading...',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        select: 'Select',
        no_photo: 'No Photo',
        months: 'months',
        years: 'years',
        months_short: 'm',
        years_short: 'y'
      },
      navigation: {
        profile: 'Profile'
      },
      app: {
        title: 'ChildHealthBooklet',
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
        child_information: 'Enter child health information',
        name: 'Name',
        age: 'Age',
        gender: 'Gender',
        weight: 'Weight (kg)',
        height: 'Height (cm)',
        guardian: 'Guardian'
      },
      records: {
        title: 'My Records',
        all_records: 'Browse all child health records',
        my_records: 'My Records',
        health_id: 'Health ID',
        status: 'Status',
        uploaded: 'UPLOADED',
        no_records_yet: 'You haven\'t created any records yet. Use "Add Child" to create your first record.'
      },
      settings: {
        title: 'Settings',
        general: 'Configure app preferences',
        appearance_language: 'Appearance & Language',
        theme: 'Theme',
        language: 'Language',
        notifications: 'Notifications'
      },
      help: {
        title: 'Help & Guide',
        user_guide: 'Learn how to use the app'
      },
      viewdata: {
        title: 'Child Health Records',
        search_placeholder: 'Search by ID, Name, Guardian, or Gender...',
        upload: 'Upload',
        upload_title_auth: 'Upload pending/failed records to server',
        upload_title_noauth: 'Login required to upload',
        no_match: 'No records match your search criteria.',
        no_records: 'No records saved yet.',
        click_note: 'Click on any record row to view detailed information in a popup.'
      },
      fields: {
        health_id: 'Health ID',
        name: 'Name',
        age: 'Age',
        gender: 'Gender',
        weight_kg: 'Weight (kg)',
        height_cm: 'Height (cm)',
        guardian: 'Guardian',
        status: 'Status',
        father_name: "Father's Name",
        date_of_birth: 'Date of Birth',
        mobile: 'Mobile',
        aadhaar_no: 'Aadhaar No.',
        malnutrition_signs: 'Malnutrition Signs',
        recent_illnesses: 'Recent Illnesses',
        id_reference: 'ID Reference',
        guardian_name: 'Guardian Name',
        guardian_phone: 'Guardian Phone',
        guardian_relation: 'Guardian Relation',
        update_photo: 'Update Photo',
        male: 'Male',
        female: 'Female'
      },
      status: {
        uploaded: 'Uploaded',
        pending: 'Pending Upload',
        failed: 'Upload Failed',
        recording: 'Recording',
        recorded: 'Recorded'
      },
      actions: {
        download_pdf: 'Download PDF',
        modify: 'Modify',
        edit_record: 'Edit Record',
        save_changes: 'Save Changes',
        cancel: 'Cancel'
      }
    }
  },
  hi: {
    translation: {
      common: {
        welcome_message: 'बाल स्वास्थ्य रिकॉर्ड में आपका स्वागत है',
        welcome_user: 'स्वागत है, {{name}}!',
        add_child: 'बच्चा जोड़ें',
        view_data: 'डेटा देखें',
        records: 'रिकॉर्ड्स',
        settings: 'सेटिंग्स',
        profile: 'प्रोफ़ाइल',
        upload: 'अपलोड',
        search: 'खोजें',
        loading: 'लोड हो रहा है...',
        save: 'सेव करें',
        cancel: 'रद्द करें',
        delete: 'हटाएं',
        edit: 'संपादित करें',
        select: 'चुनें',
        no_photo: 'कोई फोटो नहीं',
        months: 'महीने',
        years: 'वर्ष',
        months_short: 'मा',
        years_short: 'व'
      },
      navigation: {
        profile: 'प्रोफ़ाइल'
      },
      app: {
        title: 'बाल स्वास्थ्य बुकलेट',
        subtitle: 'बाल स्वास्थ्य रिकॉर्ड को कुशलतापूर्वक प्रबंधित करें'
      },
      home: {
        total_records: 'कुल रिकॉर्ड्स',
        pending_sync: 'लंबित सिंक'
      },
      sync: {
        sync_complete: 'सिंक पूर्ण'
      },
      child: {
        add_new: 'नया रिकॉर्ड जोड़ें',
        child_information: 'बच्चे की स्वास्थ्य जानकारी दर्ज करें',
        name: 'नाम',
        age: 'उम्र',
        gender: 'लिंग',
        weight: 'वजन (किग्रा)',
        height: 'ऊंचाई (सेमी)',
        guardian: 'अभिभावक'
      },
      records: {
        title: 'मेरे रिकॉर्ड्स',
        all_records: 'सभी बाल स्वास्थ्य रिकॉर्ड्स देखें',
        my_records: 'मेरे रिकॉर्ड्स',
        health_id: 'स्वास्थ्य आईडी',
        status: 'स्थिति',
        uploaded: 'अपलोड हो गया',
        no_records_yet: 'आपने अभी तक कोई रिकॉर्ड नहीं बनाया है। अपना पहला रिकॉर्ड बनाने के लिए "बच्चा जोड़ें" का उपयोग करें।'
      },
      settings: {
        title: 'सेटिंग्स',
        general: 'ऐप प्राथमिकताएं कॉन्फ़िगर करें',
        appearance_language: 'दिखावट और भाषा',
        theme: 'थीम',
        language: 'भाषा',
        notifications: 'सूचनाएं'
      },
      help: {
        title: 'सहायता और गाइड',
        user_guide: 'ऐप का उपयोग करना सीखें'
      },
      viewdata: {
        title: 'बाल स्वास्थ्य रिकॉर्ड्स',
        search_placeholder: 'ID, नाम, अभिभावक, या लिंग से खोजें...',
        upload: 'अपलोड',
        upload_title_auth: 'लंबित/असफल रिकॉर्ड्स को सर्वर पर अपलोड करें',
        upload_title_noauth: 'अपलोड के लिए लॉगिन आवश्यक',
        no_match: 'कोई रिकॉर्ड आपके खोज मानदंड से मेल नहीं खाता।',
        no_records: 'अभी तक कोई रिकॉर्ड सेव नहीं किया गया।',
        click_note: 'विस्तृत जानकारी देखने के लिए किसी भी रिकॉर्ड पंक्ति पर क्लिक करें।'
      },
      fields: {
        health_id: 'स्वास्थ्य आईडी',
        name: 'नाम',
        age: 'उम्र',
        gender: 'लिंग',
        weight_kg: 'वजन (किग्रा)',
        height_cm: 'ऊंचाई (सेमी)',
        guardian: 'अभिभावक',
        status: 'स्थिति',
        father_name: 'पिता का नाम',
        date_of_birth: 'जन्म तिथि',
        mobile: 'मोबाइल',
        aadhaar_no: 'आधार नंबर',
        malnutrition_signs: 'कुपोषण के लक्षण',
        recent_illnesses: 'हाल की बीमारियां',
        id_reference: 'आईडी संदर्भ',
        guardian_name: 'अभिभावक का नाम',
        guardian_phone: 'अभिभावक का फोन',
        guardian_relation: 'अभिभावक का रिश्ता',
        update_photo: 'फोटो अपडेट करें',
        male: 'पुरुष',
        female: 'महिला'
      },
      status: {
        uploaded: 'अपलोड हो गया',
        pending: 'अपलोड लंबित',
        failed: 'अपलोड असफल',
        recording: 'रिकॉर्डिंग',
        recorded: 'रिकॉर्ड किया गया'
      },
      actions: {
        download_pdf: 'PDF डाउनलोड करें',
        modify: 'संशोधित करें',
        edit_record: 'रिकॉर्ड संपादित करें',
        save_changes: 'परिवर्तन सेव करें',
        cancel: 'रद्द करें'
      }
    }
  },
  es: {
    translation: {
      common: {
        welcome_message: 'Bienvenido a Registros de Salud Infantil',
        welcome_user: '¡Bienvenido, {{name}}!',
        add_child: 'AGREGAR NIÑO',
        view_data: 'VER DATOS',
        records: 'REGISTROS',
        settings: 'CONFIGURACIONES',
        profile: 'PERFIL',
        upload: 'SUBIR',
        search: 'Buscar',
        loading: 'Cargando...',
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        edit: 'Editar',
        select: 'Seleccionar',
        no_photo: 'Sin Foto',
        months: 'meses',
        years: 'años',
        months_short: 'm',
        years_short: 'a'
      },
      navigation: {
        profile: 'Perfil'
      },
      app: {
        title: 'Libreta de Salud Infantil',
        subtitle: 'Gestiona los registros de salud infantil de manera eficiente'
      },
      home: {
        total_records: 'Registros Totales',
        pending_sync: 'Sincronización Pendiente'
      },
      sync: {
        sync_complete: 'Sincronizado'
      },
      child: {
        add_new: 'Agregar Nuevo Registro',
        child_information: 'Ingrese información de salud del niño',
        name: 'Nombre',
        age: 'Edad',
        gender: 'Género',
        weight: 'Peso (kg)',
        height: 'Altura (cm)',
        guardian: 'Tutor'
      },
      records: {
        title: 'Mis Registros',
        all_records: 'Explorar todos los registros de salud infantil',
        my_records: 'Mis Registros',
        health_id: 'ID de Salud',
        status: 'Estado',
        uploaded: 'SUBIDO',
        no_records_yet: 'Aún no has creado ningún registro. Usa "Agregar Niño" para crear tu primer registro.'
      },
      settings: {
        title: 'Configuraciones',
        general: 'Configurar preferencias de la app',
        appearance_language: 'Apariencia e Idioma',
        theme: 'Tema',
        language: 'Idioma',
        notifications: 'Notificaciones'
      },
      help: {
        title: 'Ayuda y Guía',
        user_guide: 'Aprende a usar la app'
      },
      viewdata: {
        title: 'Registros de Salud Infantil',
        search_placeholder: 'Buscar por ID, Nombre, Tutor, o Género...',
        upload: 'Subir',
        upload_title_auth: 'Subir registros pendientes/fallidos al servidor',
        upload_title_noauth: 'Se requiere iniciar sesión para subir',
        no_match: 'Ningún registro coincide con sus criterios de búsqueda.',
        no_records: 'Aún no hay registros guardados.',
        click_note: 'Haga clic en cualquier fila de registro para ver información detallada en una ventana emergente.'
      },
      fields: {
        health_id: 'ID de Salud',
        name: 'Nombre',
        age: 'Edad',
        gender: 'Género',
        weight_kg: 'Peso (kg)',
        height_cm: 'Altura (cm)',
        guardian: 'Tutor',
        status: 'Estado',
        father_name: 'Nombre del Padre',
        date_of_birth: 'Fecha de Nacimiento',
        mobile: 'Móvil',
        aadhaar_no: 'Núm. Aadhaar',
        malnutrition_signs: 'Signos de Desnutrición',
        recent_illnesses: 'Enfermedades Recientes',
        id_reference: 'Referencia de ID',
        guardian_name: 'Nombre del Tutor',
        guardian_phone: 'Teléfono del Tutor',
        guardian_relation: 'Relación del Tutor',
        update_photo: 'Actualizar Foto',
        male: 'Masculino',
        female: 'Femenino'
      },
      status: {
        uploaded: 'Subido',
        pending: 'Subida Pendiente',
        failed: 'Subida Fallida',
        recording: 'Grabando',
        recorded: 'Grabado'
      },
      actions: {
        download_pdf: 'Descargar PDF',
        modify: 'Modificar',
        edit_record: 'Editar Registro',
        save_changes: 'Guardar Cambios',
        cancel: 'Cancelar'
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
