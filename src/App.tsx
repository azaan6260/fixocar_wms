import React, { useState, useEffect } from 'react';
import { UserRole, JobCard, Employee, Vendor, AuthUser, isTabAllowedForRole, getDefaultTabForRole } from './types';
import { 
  getJobCards, 
  getEmployees, 
  getVendors, 
  getJobCardById, 
  subscribeToStore,
  getAuthUser,
  logoutAuthUser
} from './lib/storage';
import { Camera } from 'lucide-react';
import { syncFromSupabase } from './lib/syncService';

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

  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(window.location.pathname.toLowerCase() + window.location.hash.toLowerCase() + window.location.search.toLowerCase());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

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
  const [createModalPrefill, setCreateModalPrefill] = useState<string | undefined>();
  const [customerPortalCardId, setCustomerPortalCardId] = useState<string | null>(null);
  const [qcModalCardId, setQcModalCardId] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // QR Code Modals State
  const [qrModalCardId, setQrModalCardId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

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

  // Handle Login Success
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    setIsLoginModalOpen(false);
    if (user.role) {
      setCurrentRole(user.role);
      setActiveTab(getDefaultTabForRole(user.role));
    }
  };

  // Handle Logout
  const handleLogout = () => {
    logoutAuthUser();
    setAuthUser(null);
  };

  // Subscribe to storage updates
  useEffect(() => {
    syncFromSupabase();

    const unsubscribe = subscribeToStore(() => {
      setJobCards(getJobCards());
      setEmployees(getEmployees());
      setVendors(getVendors());
      setAuthUser(getAuthUser());
    });
    
    return () => {
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

  const activeCardForDetail = selectedJobCardId ? getJobCardById(selectedJobCardId) : null;
  const activeCardForCustomerPortal = customerPortalCardId ? getJobCardById(customerPortalCardId) : null;
  const activeCardForQC = qcModalCardId ? getJobCardById(qcModalCardId) : null;
  const activeCardForQR = qrModalCardId ? getJobCardById(qrModalCardId) : null;

  // VIEW 1A: NOT AUTHENTICATED & NAVIGATED TO /wms -> DEDICATED STAFF & ADMIN LOGIN
  if (!authUser && isWmsRoute) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans flex flex-col justify-center items-center p-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/25 mb-3">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">FixoCar WMS Portal</h1>
            <p className="text-xs text-slate-400 mt-1">Authorized Technician, Staff & Super Admin Gateway</p>
          </div>

          <UnifiedLoginModal
            isOpen={true}
            forcedMode="STAFF"
            onClose={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            onLoginSuccess={handleLoginSuccess}
          />
        </div>
      </div>
    );
  }

  // VIEW 1B: NOT AUTHENTICATED -> COMMON HOME PAGE FOR CUSTOMERS
  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans">
        <CommonHomePage
          onOpenLogin={() => {
            setIsLoginModalOpen(true);
          }}
          onBookService={() => {
            setIsLoginModalOpen(true);
          }}
        />

        {/* Customer Authentication Modal */}
        <UnifiedLoginModal
          isOpen={isLoginModalOpen}
          forcedMode="CUSTOMER"
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
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
        onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onSelectJobCard={(id) => setSelectedJobCardId(id)}
        onLogout={handleLogout}
        onGoHome={handleLogout}
      />

      {/* Main Viewport Content */}
      <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {activeTab === 'dashboard' && (
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
          />
        )}

        {activeTab === 'huddle' && (
          <DailyHuddleView
            jobCards={jobCards}
            currentRole={currentRole}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
            onOpenQCModal={(id) => setQcModalCardId(id)}
          />
        )}

        {activeTab === 'gatepass' && (
          <GatePassCheckInView
            onOpenCreateJobCardWithPrefill={(prefill) => {
              setCreateModalPrefill(prefill.regNo);
              setIsCreateModalOpen(true);
            }}
          />
        )}

        {activeTab === 'jobs' && (
          <JobCardList
            jobCards={jobCards}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
            onOpenQCModal={(id) => setQcModalCardId(id)}
            onOpenQRModal={(id) => setQrModalCardId(id)}
          />
        )}

        {activeTab === 'outsourced-jobs' && (
          <OutsourcedJobsView
            currentRole={currentRole}
            onOpenJobCard={(id) => setSelectedJobCardId(id)}
          />
        )}

        {activeTab === 'part-basket' && (
          <PartOrderBasketView
            currentRole={currentRole}
            onOpenJobCard={(id) => setSelectedJobCardId(id)}
          />
        )}

        {activeTab === 'pipeline' && (
          <VehicleStatusPipelineView
            jobCards={jobCards}
            currentRole={currentRole}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
            onOpenQCModal={(id) => setQcModalCardId(id)}
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

        {activeTab === 'accounting' && (
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
          <CarModelsManagementView currentRole={currentRole} />
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

    </div>
  );
}
