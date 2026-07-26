import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'hi';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.jobCards': 'Job Cards',
    'nav.myRoleTasks': 'My Role Tasks',
    'nav.delivery': 'Delivery Tracker',
    'nav.vendors': 'Vendors & POs',
    'nav.employees': 'Employee Management',
    'nav.customerPortal': 'Customer Portal',
    'nav.workshopLogin': 'Workshop Login',
    'nav.language': 'Language',
    
    'role.mechanicWorkspace': 'Mechanical Technician Workspace',
    'role.denterWorkspace': 'Denting & Body Metalwork Station',
    'role.painterWorkspace': 'Spray Booth & Paint Restoration Studio',
    'role.deliveryWorkspace': 'Logistics Driver Taskboard',
    'role.managementWorkspace': 'Floor Management Oversight Board',
    'role.focus': 'Focus purely on the tasks allotted to your team role with direct status toggles and inspection logging.',
    'role.tasksAssigned': 'Work Orders Assigned to Your Team',
    'role.noTasks': 'No active tasks pending for this role.',
    
    'status.completed': 'COMPLETED',
    'status.inProgress': 'IN PROGRESS',
    'status.pending': 'PENDING',
    
    'common.vehicle': 'Vehicle: ',
    'common.search': 'Search tasks...',
    
    'action.startWork': 'Start Work',
    'action.markComplete': 'Mark Complete',
    'action.viewDetails': 'View Details',
    'action.customerPortal': 'Customer Portal',
    'action.qcCheck': 'QC Check'
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड (Dashboard)',
    'nav.jobCards': 'जॉब कार्ड (Job Cards)',
    'nav.myRoleTasks': 'मेरे कार्य (My Role Tasks)',
    'nav.delivery': 'डिलीवरी ट्रैकर (Delivery Tracker)',
    'nav.vendors': 'विक्रेता (Vendors)',
    'nav.employees': 'कर्मचारी (Employees)',
    'nav.customerPortal': 'ग्राहक पोर्टल (Customer Portal)',
    'nav.workshopLogin': 'वर्कशॉप लॉगिन (Workshop Login)',
    'nav.language': 'भाषा (Language)',

    'role.mechanicWorkspace': 'मेकेनिकल तकनीशियन कार्यक्षेत्र (Mechanic Workspace)',
    'role.denterWorkspace': 'डेंटिंग कार्यक्षेत्र (Denting Station)',
    'role.painterWorkspace': 'पेंटिंग कार्यक्षेत्र (Paint Studio)',
    'role.deliveryWorkspace': 'लॉजिस्टिक्स चालक (Logistics Driver)',
    'role.managementWorkspace': 'प्रबंधन बोर्ड (Management Board)',
    'role.focus': 'केवल अपने टीम रोल के कार्यों पर ध्यान केंद्रित करें। (Focus purely on the tasks allotted to your team role.)',
    'role.tasksAssigned': 'आपकी टीम को सौंपे गए कार्य आदेश (Assigned Tasks)',
    'role.noTasks': 'इस भूमिका के लिए कोई सक्रिय कार्य लंबित नहीं है। (No active tasks.)',
    
    'status.completed': 'पूरा हो गया (COMPLETED)',
    'status.inProgress': 'प्रगति पर (IN PROGRESS)',
    'status.pending': 'लंबित (PENDING)',
    
    'common.vehicle': 'वाहन (Vehicle): ',
    'common.search': 'खोजें (Search)...',
    
    'action.startWork': 'काम शुरू करें (Start Work)',
    'action.markComplete': 'पूरा हुआ (Mark Complete)',
    'action.viewDetails': 'विवरण देखें (View Details)',
    'action.customerPortal': 'ग्राहक पोर्टल (Customer Portal)',
    'action.qcCheck': 'क्यूसी जांच (QC Check)'
  }
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
