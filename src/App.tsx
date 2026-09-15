import React, { useState, useEffect } from 'react';
import { UserRole, JobCard, Employee, Vendor, AuthUser, isTabAllowedForRole, getDefaultTabForRole, normalizeTabId } from './types';
import { 
  getJobCards, 
  getAllJobCards,
  getEmployees, 
  getAllEmployees,
  getVendors, 
  getCities,
  getWorkshops,
  getStandardJobs,
  getCarModels,
  getInventoryItems,
  getWorkshopExpenses,
  getJobCardHistoryRecords,
  getDeliveries,
  getPurchaseOrders,
  getVehicleCheckIns,
  getAttendances,
  getSalaries,
  getJobCardById, 
  subscribeToStore,
  getAuthUser,
  logoutAuthUser,
  validateLocalStorageIntegrity
} from './lib/storage';
import { Camera, Wrench, Home } from 'lucide-react';
import { syncFromSupabase } from './lib/syncService';
import { fetchServerSupabaseConfig } from './lib/supabaseClient';

import { HeaderNav } from './components/HeaderNav';
import { DashboardOverview } from './components/DashboardOverview';
import { JobCardList } from './components/JobCardList';
import { VehicleStatusPipelineView } from './components/VehicleStatusPipelineView';
import { JobCardDetailView } from './components/JobCardDetailView';
import { CreateJobCardModal } from './components/CreateJobCardModal';
import { CustomerPortal } from './components/CustomerPortal';
import { CustomerApprovalPortalModal } from './components/CustomerApprovalPortalModal';
import { FloorManagerQCModal } from './components/FloorManagerQCModal';
import { DeliveryTrackingView } from './components/DeliveryTrackingView';
import { VendorManagementView } from './components/VendorManagementView';
import { RoleWorkspaceView } from './components/RoleWorkspaceView';
import { LicensePlateScannerModal } from './components/LicensePlateScannerModal';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { EmployeeManagementView } from './components/EmployeeManagementView';
import { CityWorkshopManagementView } from './components/CityWorkshopManagementView';
import { InventoryView } from './components/InventoryView';
import { StandardJobsManagementView } from './components/StandardJobsManagementView';
import { ContractorPayoutsView } from './components/ContractorPayoutsView';
import { DailyHuddleView } from './components/DailyHuddleView';
import { GatePassCheckInView } from './components/GatePassCheckInView';
import { JobCardQRModal } from './components/JobCardQRModal';
import { LiveJobCardTrackerModal } from './components/LiveJobCardTrackerModal';
import { OutsourcedJobsView } from './components/OutsourcedJobsView';
import { PartOrderBasketView } from './components/PartOrderBasketView';
import { InvoiceManagementView } from './components/InvoiceManagementView';
import { AccountingAndExpensesView } from './components/AccountingAndExpensesView';
import { CarModelsManagementView } from './components/CarModelsManagementView';
import { ToastContainer } from './components/ToastContainer';
import { UnifiedLoginModal } from './components/UnifiedLoginModal';
import { CommonHomePage } from './components/CommonHomePage';
import { CustomerDashboard } from './components/CustomerDashboard';
import { AppVersionModal } from './components/AppVersionModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { initMobileEnvironment, setupNativeBackButton } from './lib/mobileBridge';

export default function App() {
  // Authentication state
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getAuthUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginModalInitialTab, setLoginModalInitialTab] = useState<'STAFF' | 'CUSTOMER'>('CUSTOMER');

  // Route tracking (/wms vs /)
  const [routePath, setRoutePath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname.toLowerCase() + window.location.hash.toLowerCase() + window.location.search.toLowerCase();
    }
    return '/';
  });

  const isWmsRoute = routePath.includes('wms');

  // WMS Role & Tab State
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const user = getAuthUser();
    if (user && user.role) return user.role;
    return 'MECHANIC';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    const user = getAuthUser();
    if (user && user.role) return getDefaultTabForRole(user.role);
    return 'dashboard';
  });

  // Reactive store state
  const [jobCards, setJobCards] = useState<JobCard[]>(() => getJobCards());
  const [employees, setEmployees] = useState<Employee[]>(() => getEmployees());
  const [vendors, setVendors] = useState<Vendor[]>(() => getVendors());

  // Modals state
  const [selectedJobCardId, setSelectedJobCardId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalPrefill, setCreateModalPrefill] = useState<any>();
  const [customerPortalCardId, setCustomerPortalCardId] = useState<string | null>(null);
  const [qcModalCardId, setQcModalCardId] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isAppVersionModalOpen, setIsAppVersionModalOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(window.location.pathname.toLowerCase() + window.location.hash.toLowerCase() + window.location.search.toLowerCase());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    initMobileEnvironment();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // QR Code Modals State
  const [qrModalCardId, setQrModalCardId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Keep a mutable ref of current UI state to avoid recreating the back button event listener repeatedly.
  const uiStateRef = React.useRef({
    selectedJobCardId,
    isCreateModalOpen,
    customerPortalCardId,
    qcModalCardId,
    isSupabaseModalOpen,
    isAppVersionModalOpen,
    qrModalCardId,
    isScannerOpen,
    isLoginModalOpen,
    activeTab,
    currentRole,
    routePath
  });

  useEffect(() => {
    uiStateRef.current = {
      selectedJobCardId,
      isCreateModalOpen,
      customerPortalCardId,
      qcModalCardId,
      isSupabaseModalOpen,
      isAppVersionModalOpen,
      qrModalCardId,
      isScannerOpen,
      isLoginModalOpen,
      activeTab,
      currentRole,
      routePath
    };
  }, [
    selectedJobCardId,
    isCreateModalOpen,
    customerPortalCardId,
    qcModalCardId,
    isSupabaseModalOpen,
    isAppVersionModalOpen,
    qrModalCardId,
    isScannerOpen,
    isLoginModalOpen,
    activeTab,
    currentRole,
    routePath
  ]);

  // Handle Capacitor native Android back button clicks
  useEffect(() => {
    let backListener: any = null;

    const setupBackButton = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        
        backListener = await CapApp.addListener('backButton', () => {
          const state = uiStateRef.current;
          const openModalsInDom = document.querySelectorAll('.fixed.inset-0.z-50, .fixed.inset-0.z-40, [role="dialog"]');

          // 1. Close any active modal or detailed screen first
          if (state.selectedJobCardId !== null) {
            setSelectedJobCardId(null);
          } else if (state.isCreateModalOpen) {
            setIsCreateModalOpen(false);
          } else if (state.customerPortalCardId !== null) {
            setCustomerPortalCardId(null);
          } else if (state.qcModalCardId !== null) {
            setQcModalCardId(null);
          } else if (state.qrModalCardId !== null) {
            setQrModalCardId(null);
          } else if (state.isScannerOpen) {
            setIsScannerOpen(false);
          } else if (state.isSupabaseModalOpen) {
            setIsSupabaseModalOpen(false);
          } else if (state.isAppVersionModalOpen) {
            setIsAppVersionModalOpen(false);
          } else if (state.isLoginModalOpen) {
            setIsLoginModalOpen(false);
          } else if (openModalsInDom.length > 0) {
            // Trigger Escape key event to close nested child modals
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
          }
          // 2. If no modal is open, but inside WMS and not on default 'dashboard' tab, navigate back to 'dashboard' tab
          else if (state.routePath.includes('wms') && state.activeTab !== 'dashboard') {
            setActiveTab('dashboard');
          }
          // 3. If no modal is open and on WMS dashboard tab, navigate back to home screen '/'
          else if (state.routePath.includes('wms')) {
            window.history.pushState({}, '', '/');
            setRoutePath('/');
          }
          // 4. If already on home screen '/' with no modals open, exit the native application
          else {
            CapApp.exitApp();
          }
        });
      } catch (err) {
        console.warn('Capacitor App back button listener skipped on this platform:', err);
      }
    };

    setupBackButton();

    return () => {
      if (backListener) {
        backListener.then((listener: any) => {
          if (listener && typeof listener.remove === 'function') {
            listener.remove();
          }
        }).catch(() => {});
      }
    };
  }, []);

  const handleGlobalScan = (scannedPlate: string) => {
    setIsScannerOpen(false);
    const cleanReg = scannedPlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Employee view
    const activeCard = jobCards.find(j => 
      j.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanReg && 
      j.status !== 'CLOSED' && j.status !== 'DELIVERED'
    );

    if (activeCard) {
      setSelectedJobCardId(activeCard.id);
      return;
    }

    // No active card. Any historical ones?
    const historicalCards = jobCards.filter(j => 
      j.vehicle.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanReg
    );

    if (historicalCards.length > 0) {
      historicalCards.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSelectedJobCardId(historicalCards[0].id);
      return;
    }

    // No cards at all, prefill create modal
    setCreateModalPrefill(scannedPlate);
    setIsCreateModalOpen(true);
  };

  // Keep track of active user ID to ensure currentRole automatically syncs on sign-in
  const prevAuthUserIdRef = React.useRef<string | null>(authUser?.id || null);

  useEffect(() => {
    const currentUserId = authUser?.id || null;
    if (currentUserId !== prevAuthUserIdRef.current) {
      prevAuthUserIdRef.current = currentUserId;
      if (authUser && authUser.role) {
        setCurrentRole(authUser.role);
        setActiveTab(getDefaultTabForRole(authUser.role));
      } else if (!authUser) {
        setCurrentRole('MECHANIC');
        setActiveTab('dashboard');
      }
    }
  }, [authUser]);

  // Handle Login Success
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    setJobCards(getJobCards());
    setEmployees(getEmployees());
    setVendors(getVendors());
    setIsLoginModalOpen(false);
    if (user.role) {
      setCurrentRole(user.role);
      setActiveTab(getDefaultTabForRole(user.role));
    }
    // Route enforcement based on user type upon login
    if (typeof window !== 'undefined') {
      if (user.userType === 'CUSTOMER') {
        window.history.pushState({}, '', '/');
        setRoutePath('/');
      } else {
        window.history.pushState({}, '', '/wms');
        setRoutePath('/wms');
      }
    }
  };

  // Handle Logout
  const handleLogout = () => {
    logoutAuthUser();
    setAuthUser(null);
    setCurrentRole('MECHANIC');
    setActiveTab('dashboard');
    setSelectedJobCardId(null);
    setCustomerPortalCardId(null);
    setQcModalCardId(null);
    setQrModalCardId(null);
  };

  // Subscribe to storage updates & sync from Supabase on startup and periodically
  useEffect(() => {
    const runDiagnosticCheck = () => {
      const isMobile = typeof navigator !== 'undefined' && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768);
      const storeStats = {
        cities: getCities().length,
        workshops: getWorkshops().length,
        employees: getAllEmployees().length,
        vendors: getVendors().length,
        standard_jobs: getStandardJobs().length,
        car_models: getCarModels().length,
        inventory_items: getInventoryItems().length,
        workshop_expenses: getWorkshopExpenses().length,
        job_cards: getAllJobCards().length,
        job_tasks: getAllJobCards().reduce((acc, card) => acc + (card.tasks ? card.tasks.length : 0), 0),
        job_card_history: getJobCardHistoryRecords().length,
        delivery_records: getDeliveries().length,
        purchase_orders: getPurchaseOrders().length,
        vehicle_check_ins: getVehicleCheckIns().length,
        attendance_records: getAttendances().length,
        salary_records: getSalaries().length
      };

      const unhydratedTables = Object.entries(storeStats)
        .filter(([_, count]) => count === 0)
        .map(([table]) => table);

      console.log(`[DIAGNOSTIC_CHECK] ${isMobile ? '[MOBILE_DEVICE]' : '[DESKTOP_DEVICE]'} Storage Hydration Audit (16 Tables):`, storeStats);

      if (unhydratedTables.length > 0) {
        console.warn(`[DIAGNOSTIC_CHECK] ⚠️ ${unhydratedTables.length} of 16 expected tables failed to hydrate or are empty on initialization:`, unhydratedTables);
      } else {
        console.log(`[DIAGNOSTIC_CHECK] ✅ All 16 expected database tables successfully hydrated in local store.`);
      }
    };

    const initializeGlobalSync = async () => {
      validateLocalStorageIntegrity();
      await fetchServerSupabaseConfig();
      await syncFromSupabase();
      runDiagnosticCheck();
    };
    initializeGlobalSync();

    // Auto-sync every 15 seconds to ensure mobile and desktop stay continuously linked with database
    const syncInterval = setInterval(() => {
      syncFromSupabase().catch(() => {});
    }, 15000);

    // Re-sync on tab focus or screen visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromSupabase().catch(() => {});
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubscribe = subscribeToStore(() => {
      setJobCards(getJobCards());
      setEmployees(getEmployees());
      setVendors(getVendors());
      setAuthUser(getAuthUser());
    });
    
    const handleOpenSupabaseModal = () => setIsSupabaseModalOpen(true);
    window.addEventListener('open-supabase-modal', handleOpenSupabaseModal);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('open-supabase-modal', handleOpenSupabaseModal);
      unsubscribe();
    };
  }, []);

  // Enforce role-based tab access
  useEffect(() => {
    if (authUser && authUser.role) {
      if (!isTabAllowedForRole(currentRole, activeTab)) {
        setActiveTab(getDefaultTabForRole(currentRole));
      }
    }
  }, [currentRole, activeTab, authUser]);

  // Enforce strict route separation:
  // - /wms is strictly for staff/admin & WMS working
  // - / is strictly for customer portal & customer home
  useEffect(() => {
    if (authUser && typeof window !== 'undefined') {
      if (authUser.userType === 'CUSTOMER' && isWmsRoute) {
        window.history.replaceState({}, '', '/');
        setRoutePath('/');
      } else if (authUser.userType !== 'CUSTOMER' && !isWmsRoute) {
        window.history.replaceState({}, '', '/wms');
        setRoutePath('/wms');
      }
    }
  }, [authUser, isWmsRoute]);

  const activeCardForDetail = selectedJobCardId ? getJobCardById(selectedJobCardId) : null;
  const activeCardForCustomerPortal = customerPortalCardId ? getJobCardById(customerPortalCardId) : null;
  const activeCardForQC = qcModalCardId ? getJobCardById(qcModalCardId) : null;
  const activeCardForQR = qrModalCardId ? getJobCardById(qrModalCardId) : null;

  // VIEW 1: NOT AUTHENTICATED -> DIRECT SIGN IN SCREEN
  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          {/* Header Bar Navigation */}
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Fixo<span className="text-blue-500">Car</span> WMS</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Workshop Operating System</p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold">
              Secure Sign In
            </span>
          </div>

          <UnifiedLoginModal
            isOpen={true}
            isEmbedded={true}
            initialTab="STAFF"
            onClose={() => {}}
            onLoginSuccess={handleLoginSuccess}
          />

          <div className="mt-4 text-center">
            <p className="text-xs text-slate-500">
              Authorized credentials are created and managed by the Workshop Administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: AUTHENTICATED AS CUSTOMER -> REDESIGNED CUSTOMER DASHBOARD
  if (authUser.userType === 'CUSTOMER') {
    return (
      <div className="min-h-screen bg-slate-950 font-sans">
        <CustomerDashboard
          onLogout={handleLogout}
        />

        {/* Render Customer Approval Modal if opened */}
        {activeCardForCustomerPortal && (
          <CustomerApprovalPortalModal
            card={activeCardForCustomerPortal}
            onClose={() => setCustomerPortalCardId(null)}
          />
        )}
      </div>
    );
  }

  // VIEW 3: AUTHENTICATED AS STAFF / CONTRACTOR / ADMIN -> WORKSHOP MANAGEMENT SYSTEM (WMS)
  const normalizedTab = normalizeTabId(activeTab);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
      
      {/* Global Toast Alert Notifications Container */}
      <ToastContainer onSelectJobCard={(id) => setSelectedJobCardId(id)} />

      {/* Top Header Navigation */}
      <HeaderNav
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenAppVersionModal={() => setIsAppVersionModalOpen(true)}
        onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onSelectJobCard={(id) => setSelectedJobCardId(id)}
        onLogout={handleLogout}
        onGoHome={handleLogout}
      />

      {/* Main Viewport Content */}
      <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8">
        
        {normalizedTab === 'dashboard' && (
          <DashboardOverview
            jobCards={jobCards}
            currentRole={currentRole}
            onOpenNewJobCard={(regNum) => {
              setCreateModalPrefill(regNum);
              setIsCreateModalOpen(true);
            }}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenAIDiagnostics={() => {}}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {normalizedTab === 'daily-huddle' && (
          <DailyHuddleView
            jobCards={jobCards}
            currentRole={currentRole}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
            onOpenQCModal={(id) => setQcModalCardId(id)}
          />
        )}

        {normalizedTab === 'gate-pass' && (
          <GatePassCheckInView
            onOpenCreateJobCardWithPrefill={(prefill) => {
              setCreateModalPrefill(prefill);
              setIsCreateModalOpen(true);
            }}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
          />
        )}

        {normalizedTab === 'job-cards' && (
          <JobCardList
            jobCards={jobCards}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
            onOpenQCModal={(id) => setQcModalCardId(id)}
            onOpenQRModal={(id) => setQrModalCardId(id)}
            initialSection={activeTab === 'job-cards-history' ? 'HISTORY' : 'ACTIVE'}
          />
        )}

        {normalizedTab === 'outsourced-jobs' && (
          <OutsourcedJobsView
            currentRole={currentRole}
            onOpenJobCard={(id) => setSelectedJobCardId(id)}
          />
        )}

        {normalizedTab === 'part-basket' && (
          <PartOrderBasketView
            currentRole={currentRole}
            onOpenJobCard={(id) => setSelectedJobCardId(id)}
          />
        )}

        {normalizedTab === 'status-pipeline' && (
          <VehicleStatusPipelineView
            jobCards={jobCards}
            currentRole={currentRole}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
            onOpenQCModal={(id) => setQcModalCardId(id)}
            initialFilter={activeTab === 'rfc_quick' || activeTab === 'rfc' ? 'RFC' : undefined}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView currentRole={currentRole} />
        )}

        {activeTab === 'standard-jobs' && (
          <StandardJobsManagementView currentRole={currentRole} />
        )}

        {activeTab === 'contractor-payouts' && (
          <ContractorPayoutsView currentRole={currentRole} />
        )}

        {activeTab === 'invoices' && (
          <InvoiceManagementView 
            currentRole={currentRole} 
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
          />
        )}

        {(activeTab === 'accounting' || activeTab === 'accounting-expenses') && (
          <AccountingAndExpensesView currentRole={currentRole} />
        )}

        {activeTab === 'role-workspace' && (
          <RoleWorkspaceView
            currentRole={currentRole}
            jobCards={jobCards}
            onOpenJobCard={(id) => setSelectedJobCardId(id)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
          />
        )}

        {activeTab === 'deliveries' && (
          <DeliveryTrackingView 
            currentRole={currentRole} 
            onOpenQRModal={(id) => setQrModalCardId(id)}
          />
        )}

        {activeTab === 'vendors' && (
          <VendorManagementView />
        )}

        {activeTab === 'workshops' && (
          <CityWorkshopManagementView 
            currentRole={currentRole} 
            onNavigateEmployees={() => setActiveTab('employees')}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeeManagementView currentRole={currentRole} />
        )}

        {activeTab === 'car-models' && (
          <CarModelsManagementView />
        )}

        {activeTab === 'customer-portal' && (
          <CustomerDashboard onLogout={handleLogout} />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            FixoCar • Worry-Free Car Repair OS ({authUser.name} - {authUser.role})
          </span>
          <div className="flex items-center gap-3">
            <a href="tel:8819915656" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
              Call: 8819915656
            </a>
            <span>•</span>
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Supabase DB Configuration
            </button>
            <span>•</span>
            <button
              onClick={handleLogout}
              className="text-rose-500 hover:underline font-bold cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </footer>
 
      {/* Mobile Floating Bottom Bar Dock */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenNewJobCard={() => setIsCreateModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onLogout={handleLogout}
        currentRole={currentRole}
      />

      {/* MODALS */}

      {/* Create New Job Card Modal */}
      <CreateJobCardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateModalPrefill(undefined);
        }}
        prefilledRegNum={createModalPrefill}
        employees={employees}
        vendors={vendors}
        onCardCreated={(newCard) => {
          setSelectedJobCardId(newCard.id);
        }}
      />

      {/* Job Card Detailed View Modal */}
      {activeCardForDetail && (
        <JobCardDetailView
          card={activeCardForDetail}
          currentRole={currentRole}
          onClose={() => setSelectedJobCardId(null)}
          employees={employees}
          vendors={vendors}
          onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
          onOpenQCModal={(id) => setQcModalCardId(id)}
          onOpenQRModal={(id) => setQrModalCardId(id)}
        />
      )}

      {/* Customer Approval Portal Modal */}
      {activeCardForCustomerPortal && (
        <CustomerApprovalPortalModal
          card={activeCardForCustomerPortal}
          onClose={() => setCustomerPortalCardId(null)}
        />
      )}

      {/* Floor Manager Quality Control Inspection Modal */}
      {activeCardForQC && (
        <FloorManagerQCModal
          card={activeCardForQC}
          onClose={() => setQcModalCardId(null)}
        />
      )}

      {/* High-Resolution Printable Job Card QR Code Modal */}
      {activeCardForQR && (
        <JobCardQRModal
          card={activeCardForQR}
          onClose={() => setQrModalCardId(null)}
        />
      )}

      {/* Global License Plate Scanner */}
      {isScannerOpen && (
        <LicensePlateScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanComplete={handleGlobalScan}
        />
      )}

      {/* Supabase Database Settings Modal */}
      <SupabaseSettingsModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />

      {/* Android APK Version Manager Modal */}
      <AppVersionModal
        isOpen={isAppVersionModalOpen}
        onClose={() => setIsAppVersionModalOpen(false)}
      />

    </div>
  );
}
