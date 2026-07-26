import React, { useState, useEffect } from 'react';
import { UserRole, JobCard, Employee, Vendor } from './types';
import { 
  getJobCards, 
  getEmployees, 
  getVendors, 
  getJobCardById, 
  subscribeToStore 
} from './lib/storage';

import { HeaderNav } from './components/HeaderNav';
import { DashboardOverview } from './components/DashboardOverview';
import { JobCardList } from './components/JobCardList';
import { JobCardDetailView } from './components/JobCardDetailView';
import { CreateJobCardModal } from './components/CreateJobCardModal';
import { CustomerPortal } from './components/CustomerPortal';
import { CustomerApprovalPortalModal } from './components/CustomerApprovalPortalModal';
import { FloorManagerQCModal } from './components/FloorManagerQCModal';
import { DeliveryTrackingView } from './components/DeliveryTrackingView';
import { VendorManagementView } from './components/VendorManagementView';
import { RoleWorkspaceView } from './components/RoleWorkspaceView';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { EmployeeManagementView } from './components/EmployeeManagementView';
import { CityWorkshopManagementView } from './components/CityWorkshopManagementView';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('SUPER_ADMIN');
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

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

  // Subscribe to storage updates
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    
    const unsubscribe = subscribeToStore(() => {
      setJobCards(getJobCards());
      setEmployees(getEmployees());
      setVendors(getVendors());
    });
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubscribe();
    };
  }, []);

  const activeCardForDetail = selectedJobCardId ? getJobCardById(selectedJobCardId) : null;
  const activeCardForCustomerPortal = customerPortalCardId ? getJobCardById(customerPortalCardId) : null;
  const activeCardForQC = qcModalCardId ? getJobCardById(qcModalCardId) : null;

  // CUSTOMER FACING ROUTE
  if (currentPath === '/' || currentPath === '/index.html') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
        <header className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
          <div className="max-w-7xl mx-auto w-full flex justify-between items-center px-4">
            <h1 className="font-black text-2xl tracking-tight text-white flex items-center gap-2">
              <span className="text-amber-500">Fixo</span>Car
            </h1>
            <a 
              href="/wms" 
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/wms');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="text-xs font-bold bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              Workshop Login
            </a>
          </div>
        </header>

        <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <CustomerPortal
            currentRole={'CUSTOMER' as any}
            onOpenApprovalModal={(id) => setCustomerPortalCardId(id)}
          />
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              FixoCar • Worry-Free Car Repair
            </p>
            <p className="mt-1">Helpline: 8819915656</p>
          </div>
        </footer>

        {/* Render Customer Approval Modal if needed in customer portal */}
        {activeCardForCustomerPortal && (
          <CustomerApprovalPortalModal
            card={activeCardForCustomerPortal}
            onClose={() => setCustomerPortalCardId(null)}
          />
        )}
      </div>
    );
  }

  // WMS ROUTE (/wms)
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
      
      {/* Top Header Navigation */}
      <HeaderNav
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
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
            onOpenAIDiagnostics={() => setIsCreateModalOpen(true)}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'customer-portal' && (
          <CustomerPortal
            currentRole={currentRole}
            onOpenApprovalModal={(id) => setCustomerPortalCardId(id)}
          />
        )}

        {activeTab === 'job-cards' && (
          <JobCardList
            jobCards={jobCards}
            onSelectJobCard={(id) => setSelectedJobCardId(id)}
            onOpenNewJobCardModal={() => setIsCreateModalOpen(true)}
            onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
            onOpenQCModal={(id) => setQcModalCardId(id)}
          />
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
          <DeliveryTrackingView currentRole={currentRole} />
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

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            FixoCar • Worry-Free Car Repair OS
          </span>
          <div className="flex items-center gap-3">
            <a href="tel:8819915656" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
              Call: 8819915656
            </a>
            <span>•</span>
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="hover:text-blue-600 transition-colors"
            >
              Supabase DB Configuration
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
          onClose={() => setSelectedJobCardId(null)}
          employees={employees}
          vendors={vendors}
          onOpenCustomerApprovalPortal={(id) => setCustomerPortalCardId(id)}
          onOpenQCModal={(id) => setQcModalCardId(id)}
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

      {/* Supabase Database Settings Modal */}
      <SupabaseSettingsModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />

    </div>
  );
}
