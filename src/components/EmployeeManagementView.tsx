import React, { useState, useEffect } from 'react';
import { UserRole, Employee, AttendanceRecord, SalaryRecord, SpecializedTeam, Workshop } from '../types';
import { 
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getAttendances, createAttendance,
  getSalaries, createSalaryRecord, updateSalaryStatus,
  getWorkshops
} from '../lib/storage';
import { 
  Users, UserPlus, Save, Trash2, Edit2, Key, CheckCircle, 
  MapPin, Camera, DollarSign, Calendar, Clock, Lock, Building2, AlertTriangle
} from 'lucide-react';

interface EmployeeManagementProps {
  currentRole: UserRole;
}

export function EmployeeManagementView({ currentRole }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'ATTENDANCE' | 'PAYROLL'>('DIRECTORY');
  const [employmentFilter, setEmploymentFilter] = useState<'ALL' | 'PAYROLL' | 'CONTRACT'>('ALL');
  
  // Create/Edit employee state
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isNewEmployee, setIsNewEmployee] = useState(false);

  // Attendance state
  const [markingAttendance, setMarkingAttendance] = useState<boolean>(false);

  const isSuperAdmin = currentRole === 'SUPER_ADMIN';
  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN';
  const isManager = currentRole === 'FLOOR_MANAGER';
  
  // Admin and Managers can add employees and associate them with workshops
  const canManageEmployees = isSuperAdmin || isAdmin || isManager;
  const canDeleteEmployees = isSuperAdmin || isAdmin;

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setEmployees(getEmployees());
    setAttendances(getAttendances());
    setSalaries(getSalaries());
    setWorkshops(getWorkshops());
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    // Ensure workshop association is properly linked
    if (editingEmployee.workshopId) {
      const selectedWs = workshops.find(w => w.id === editingEmployee.workshopId);
      if (selectedWs) {
        editingEmployee.workshopName = selectedWs.name;
        editingEmployee.cityId = selectedWs.cityId;
        editingEmployee.cityName = selectedWs.cityName;
      }
    }

    if (isNewEmployee) {
      createEmployee(editingEmployee as any);
    } else {
      updateEmployee(editingEmployee.id, editingEmployee);
    }
    setEditingEmployee(null);
    setIsNewEmployee(false);
    refreshData();
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm('Are you sure you want to remove this employee?')) {
      deleteEmployee(id);
      refreshData();
    }
  };

  const handleMarkAttendance = () => {
    // Simulating marking attendance for "current user"
    // In a real app we'd know who is logged in. 
    // Here we just pick the first employee if none specified or mock it
    const myEmpId = employees[0]?.id || 'emp-9999';
    createAttendance({
      employeeId: myEmpId,
      date: new Date().toISOString().split('T')[0],
      clockInTime: new Date().toLocaleTimeString(),
      status: 'PRESENT',
      clockInLocation: 'Workshop Entrance - LAT: 19.0760, LNG: 72.8777',
      photoUrl: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop'
    });
    setMarkingAttendance(false);
    alert('Attendance marked successfully with photo and location verified.');
    refreshData();
  };

  const handleGenerateSalary = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const base = emp.baseSalary || 20000;
    createSalaryRecord({
      employeeId: emp.id,
      month: new Date().toISOString().slice(0, 7),
      baseSalary: base,
      deductions: 0,
      bonuses: 1000,
      netPay: base + 1000,
      status: 'PENDING'
    });
    refreshData();
  };

  const handleTransferSalary = (salId: string) => {
    updateSalaryStatus(salId, 'TRANSFERRED');
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('DIRECTORY')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'DIRECTORY' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Users className="w-4 h-4" /> Employee Directory
        </button>
        
        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'ATTENDANCE' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" /> Attendance Tracker
        </button>

        {(isAdmin || isManager) && (
          <button
            onClick={() => setActiveTab('PAYROLL')}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'PAYROLL' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4" /> Payroll & Salary
          </button>
        )}
      </div>

      {/* DIRECTORY TAB */}
      {activeTab === 'DIRECTORY' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Staff Directory</h2>
              <p className="text-xs text-slate-500">Superadmins add cities/workshops. Admins & Floor Managers assign employees to workshops.</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Filter Pills */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setEmploymentFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    employmentFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({employees.length})
                </button>
                <button
                  onClick={() => setEmploymentFilter('PAYROLL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    employmentFilter === 'PAYROLL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
                  }`}
                >
                  💼 Payroll ({employees.filter(e => e.employmentType === 'PAYROLL').length})
                </button>
                <button
                  onClick={() => setEmploymentFilter('CONTRACT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    employmentFilter === 'CONTRACT'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-purple-600'
                  }`}
                >
                  📜 Contract Basis ({employees.filter(e => e.employmentType === 'CONTRACT').length})
                </button>
              </div>

              {canManageEmployees && (
                <button
                  onClick={() => {
                    const defaultWs = workshops[0];
                    setEditingEmployee({
                      id: '', 
                      name: '', 
                      role: 'MECHANIC', 
                      phone: '', 
                      email: '', 
                      specializedTeam: 'Mechanical', 
                      status: 'AVAILABLE', 
                      activeJobsCount: 0,
                      employmentType: 'PAYROLL',
                      loginId: '', 
                      password: '', 
                      baseSalary: 25000,
                      workshopId: defaultWs?.id || '',
                      workshopName: defaultWs?.name || '',
                      cityId: defaultWs?.cityId || '',
                      cityName: defaultWs?.cityName || ''
                    });
                    setIsNewEmployee(true);
                  }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" /> Add Employee
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees
              .filter(emp => employmentFilter === 'ALL' || emp.employmentType === employmentFilter)
              .map(emp => {
                const isContract = emp.employmentType === 'CONTRACT';

                return (
                  <div key={emp.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-slate-500 font-bold text-lg">
                          {emp.avatarUrl ? <img src={emp.avatarUrl} alt={emp.name} className="w-full h-full object-cover" /> : emp.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 dark:text-slate-100">{emp.name}</h3>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[10px] uppercase font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                              {emp.role}
                            </span>
                            {isContract ? (
                              <span className="text-[10px] uppercase font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded border border-purple-300 dark:border-purple-800">
                                📜 Contract Basis
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                💼 Payroll
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {canManageEmployees && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingEmployee(emp);
                              setIsNewEmployee(false);
                            }} 
                            title="Edit / Associate Workshop"
                            className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {canDeleteEmployees && (
                            <button 
                              onClick={() => handleDeleteEmployee(emp.id)} 
                              title="Delete Employee"
                              className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Assigned Workshop & City Display */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          Workshop Hub:
                        </span>
                        {emp.workshopName ? (
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{emp.workshopName}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Unassigned</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          City Location:
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{emp.cityName || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <p><strong>Team:</strong> {emp.specializedTeam}</p>
                      <p><strong>Phone:</strong> {emp.phone}</p>
                      <p><strong>Status:</strong> {emp.status}</p>
                    </div>

                    {(isAdmin || isManager) && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><Key className="w-3.5 h-3.5" /> Login ID:</span>
                          <strong className="text-slate-700 dark:text-slate-300 font-mono">{emp.loginId || 'Not Set'}</strong>
                        </div>

                        {isContract ? (
                          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-800 dark:text-purple-300">
                            <strong>Piece-Rate / Job Basis:</strong> Earns payout per job allocation (Denting & Painting). Settled via Contractor Desk.
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Base Salary:</span>
                            <strong className="text-slate-700 dark:text-slate-300 font-mono">₹{(emp.baseSalary || 0).toLocaleString('en-IN')} / mo</strong>
                          </div>
                        )}

                        {canManageEmployees && (
                          <button
                            onClick={() => {
                              setEditingEmployee(emp);
                              setIsNewEmployee(false);
                            }}
                            className="w-full mt-2 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Building2 className="w-3.5 h-3.5" /> Associate / Edit Details
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'ATTENDANCE' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Daily Attendance</h2>
            
            <button
              onClick={() => setMarkingAttendance(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" /> Mark My Attendance (Selfie & GPS)
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Date</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Employee</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Status</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Clock In</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attendances.map(att => {
                    const emp = employees.find(e => e.id === att.employeeId);
                    return (
                      <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{att.date}</td>
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{emp?.name || 'Unknown'}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {att.status}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-xs">{att.clockInTime || '-'}</td>
                        <td className="p-4 text-xs text-slate-500">
                          {att.clockInLocation ? (
                            <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                              <MapPin className="w-3.5 h-3.5" /> GPS Verified
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {attendances.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">No attendance records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PAYROLL TAB */}
      {activeTab === 'PAYROLL' && (isAdmin || isManager) && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Payroll & Salary Transfers</h2>
              <p className="text-xs text-slate-500">Monthly salary processing for full-time payroll staff. Piece-rate contractors (Denters & Painters) are managed in Contractor Payouts Desk.</p>
            </div>
          </div>

          <div className="p-4 bg-purple-50/80 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                📜
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-purple-900 dark:text-purple-200">Contract Basis Staff (Denters & Painters)</h4>
                <p className="text-xs text-purple-700 dark:text-purple-300">Contractors earn piece-rate job payouts per allocated job card panel instead of a monthly fixed salary.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Generate Salary List */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Eligible Payroll Staff</span>
                <span className="text-xs text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">Fixed Salary</span>
              </h3>
              
              <div className="space-y-3">
                {employees.map(emp => {
                  const isContract = emp.employmentType === 'CONTRACT';
                  
                  return (
                    <div key={`sal-gen-${emp.id}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{emp.name}</p>
                          {isContract ? (
                            <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded">Contract</span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded">Payroll</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {isContract ? 'Piece-rate payouts per job' : `₹${(emp.baseSalary || 0).toLocaleString('en-IN')} / mo`}
                        </p>
                      </div>

                      {isAdmin && (
                        isContract ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                            Contract Desk
                          </span>
                        ) : (
                          <button onClick={() => handleGenerateSalary(emp.id)} className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                            Generate
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generated Salary Records */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Pending & Transferred Salaries</h3>
              
              <div className="space-y-3">
                {salaries.map(sal => {
                  const emp = employees.find(e => e.id === sal.employeeId);
                  return (
                    <div key={sal.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{emp?.name || 'Unknown'}</span>
                          <span className="text-xs font-mono text-slate-400">({sal.month})</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Base: ₹{sal.baseSalary.toLocaleString('en-IN')} | Bonus: ₹{sal.bonuses.toLocaleString('en-IN')}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Net Pay</p>
                          <p className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">₹{sal.netPay.toLocaleString('en-IN')}</p>
                        </div>
                        
                        {sal.status === 'PENDING' ? (
                          <button 
                            onClick={() => handleTransferSalary(sal.id)}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md whitespace-nowrap"
                          >
                            Transfer Now
                          </button>
                        ) : (
                          <span className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Paid
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {salaries.length === 0 && (
                  <div className="p-8 text-center text-slate-500">No salary records generated for this month.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-xl shadow-2xl p-5 sm:p-8 space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {isNewEmployee ? 'Add New Employee' : 'Edit Employee Profile'}
            </h3>
            
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                  <input type="text" required value={editingEmployee.name} onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">System Role</label>
                  <select 
                    value={editingEmployee.role} 
                    onChange={e => {
                      const newRole = e.target.value as UserRole;
                      const isContractRole = newRole === 'DENTER' || newRole === 'PAINTER';
                      const defaultTeam: SpecializedTeam = 
                        newRole === 'DENTER' ? 'Denting' : 
                        newRole === 'PAINTER' ? 'Paint' : 
                        newRole === 'MECHANIC' ? 'Mechanical' : 
                        newRole === 'DELIVERY_BOY' ? 'Logistics' : editingEmployee.specializedTeam;

                      setEditingEmployee({
                        ...editingEmployee, 
                        role: newRole,
                        specializedTeam: defaultTeam,
                        employmentType: isContractRole ? 'CONTRACT' : 'PAYROLL'
                      });
                    }} 
                    className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="MECHANIC">Mechanic</option>
                    <option value="FLOOR_MANAGER">Floor Manager</option>
                    <option value="DENTER">Denter (Contract Basis)</option>
                    <option value="PAINTER">Painter (Contract Basis)</option>
                    <option value="DELIVERY_BOY">Delivery Boy</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                  <input type="text" value={editingEmployee.phone} onChange={e => setEditingEmployee({...editingEmployee, phone: e.target.value})} className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Specialized Team</label>
                  <select 
                    value={editingEmployee.specializedTeam} 
                    onChange={e => {
                      const team = e.target.value as SpecializedTeam;
                      const isContractTeam = team === 'Denting' || team === 'Paint';
                      setEditingEmployee({
                        ...editingEmployee, 
                        specializedTeam: team,
                        employmentType: isContractTeam ? 'CONTRACT' : editingEmployee.employmentType || 'PAYROLL'
                      });
                    }} 
                    className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Denting">Denting (Contract Payouts)</option>
                    <option value="Paint">Paint (Contract Payouts)</option>
                    <option value="Detailing & Washing">Detailing & Washing</option>
                    <option value="Management">Management</option>
                    <option value="Logistics">Logistics</option>
                  </select>
                </div>

                {/* Employment Basis Selector (Payroll vs Contract) */}
                <div className="col-span-1 sm:col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      Employment Basis & Pay Structure *
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase">Denters & Painters default to Contract Basis</span>
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingEmployee({ ...editingEmployee, employmentType: 'PAYROLL' })}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        editingEmployee.employmentType === 'PAYROLL' || !editingEmployee.employmentType
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/30 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-extrabold text-xs flex items-center gap-1.5">
                        💼 Full-Time Payroll
                      </span>
                      <span className="text-[10px] opacity-80 font-normal">Monthly fixed base salary + monthly payroll</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingEmployee({ ...editingEmployee, employmentType: 'CONTRACT' })}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        editingEmployee.employmentType === 'CONTRACT'
                          ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/30 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-extrabold text-xs flex items-center gap-1.5">
                        📜 Contract Basis
                      </span>
                      <span className="text-[10px] opacity-80 font-normal">Piece-rate / job-based payout (Denters, Painters)</span>
                    </button>
                  </div>
                </div>

                {/* Mandatory Assigned Workshop Dropdown */}
                <div className="col-span-1 sm:col-span-2 bg-blue-50/50 dark:bg-blue-950/30 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-800/60 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Assigned Workshop Hub * (Required)
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Associated City</span>
                  </label>
                  
                  {workshops.length > 0 ? (
                    <select
                      required
                      value={editingEmployee.workshopId || ''}
                      onChange={e => {
                        const selectedWsId = e.target.value;
                        const ws = workshops.find(w => w.id === selectedWsId);
                        setEditingEmployee({
                          ...editingEmployee,
                          workshopId: selectedWsId,
                          workshopName: ws?.name || '',
                          cityId: ws?.cityId || '',
                          cityName: ws?.cityName || ''
                        });
                      }}
                      className="w-full p-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>-- Select Assigned Workshop --</option>
                      {workshops.map(ws => (
                        <option key={ws.id} value={ws.id}>
                          {ws.name} ({ws.cityName}) {ws.isCars24Partner ? '⭐ Cars24 Partner' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>No Workshops found! A Superadmin must create a Workshop in Cities & Workshops first.</span>
                    </div>
                  )}
                  {editingEmployee.cityName && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      Assigned to City: <strong className="text-slate-700 dark:text-slate-300">{editingEmployee.cityName}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Lock className="w-4 h-4"/> Security & Payroll</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Login ID (Username)</label>
                    <input type="text" value={editingEmployee.loginId || ''} onChange={e => setEditingEmployee({...editingEmployee, loginId: e.target.value})} className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Password</label>
                    <input type="password" value={editingEmployee.password || ''} onChange={e => setEditingEmployee({...editingEmployee, password: e.target.value})} className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Monthly Base Salary (₹)</label>
                    <input type="number" value={editingEmployee.baseSalary || 0} onChange={e => setEditingEmployee({...editingEmployee, baseSalary: Number(e.target.value)})} className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setEditingEmployee(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2">
                  <Save className="w-4 h-4"/> Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK ATTENDANCE MOCK MODAL */}
      {markingAttendance && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl p-6 sm:p-8 text-center space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            <div className="w-32 h-32 rounded-full border-4 border-blue-500/30 overflow-hidden mx-auto relative group">
              <img src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop" alt="Face Scanner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-blue-500/20 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Scan Face to Clock In</h3>
              <p className="text-sm text-slate-500 mt-2 flex items-center justify-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-500" /> Location Verified: FixoCar Workshop
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setMarkingAttendance(false)} className="grow py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleMarkAttendance} className="grow py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md shadow-blue-500/30 transition-colors">
                Confirm Clock-In
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
