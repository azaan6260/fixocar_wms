import { getSupabaseClient } from './supabaseClient';
import { 
  getEmployees, saveEmployees,
  getVendors, saveVendors,
  getCities, saveCities,
  getWorkshops, saveWorkshops,
  getJobCards, saveJobCards,
  dispatchToastNotification
} from './storage';
import { JobCard, JobTask } from '../types';

export interface SyncResult {
  success: boolean;
  isConfigured: boolean;
  missingTables: string[];
  employeesSynced: number;
  citiesSynced: number;
  workshopsSynced: number;
  vendorsSynced: number;
  jobCardsSynced: number;
  errors: string[];
}

export async function syncFromSupabase(): Promise<SyncResult> {
  const client = getSupabaseClient();
  const missingTables: string[] = [];
  const errors: string[] = [];

  if (!client) {
    return {
      success: false,
      isConfigured: false,
      missingTables: [],
      employeesSynced: 0,
      citiesSynced: 0,
      workshopsSynced: 0,
      vendorsSynced: 0,
      jobCardsSynced: 0,
      errors: ['Supabase client is not configured.']
    };
  }

  let employeesSynced = 0;
  let citiesSynced = 0;
  let workshopsSynced = 0;
  let vendorsSynced = 0;
  let jobCardsSynced = 0;

  try {
    // 1. EMPLOYEES
    const { data: employees, error: empErr } = await client.from('employees').select('*');
    if (empErr) {
      if (empErr.code === '42P01') missingTables.push('employees');
      errors.push(`Employees table error: ${empErr.message}`);
    } else if (employees !== null) {
      const local = employees.map((e: any) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        phone: e.phone,
        email: e.email || '',
        specializedTeam: e.specialized_team,
        status: e.status,
        avatarUrl: e.avatar_url,
        activeJobsCount: e.active_jobs_count || 0,
        loginId: e.login_id,
        password: e.password_hash || e.password,
        baseSalary: e.base_salary,
        createdAt: e.created_at,
        employmentType: e.employment_type || 'PAYROLL',
        cityId: e.city_id,
        cityName: e.city_name,
        workshopId: e.workshop_id,
        workshopName: e.workshop_name
      }));
      saveEmployees(local, true);
      employeesSynced = local.length;
    }

    // 2. CITIES
    const { data: cities, error: cityErr } = await client.from('cities').select('*');
    if (cityErr) {
      if (cityErr.code === '42P01') missingTables.push('cities');
      errors.push(`Cities table error: ${cityErr.message}`);
    } else if (cities !== null) {
      const localCities = cities.map((c: any) => ({
        id: c.id,
        name: c.name,
        state: c.state || '',
        createdAt: c.created_at || new Date().toISOString().split('T')[0]
      }));
      saveCities(localCities, true);
      citiesSynced = localCities.length;
    }

    // 3. WORKSHOPS
    const { data: workshops, error: wsErr } = await client.from('workshops').select('*');
    if (wsErr) {
      if (wsErr.code === '42P01') missingTables.push('workshops');
      errors.push(`Workshops table error: ${wsErr.message}`);
    } else if (workshops !== null) {
      const localWorkshops = workshops.map((w: any) => ({
        id: w.id,
        name: w.name,
        cityId: w.city_id,
        cityName: w.city_name,
        address: w.address,
        phone: w.phone,
        isCars24Partner: w.is_cars24_partner,
        managerName: w.manager_name,
        createdAt: w.created_at
      }));
      saveWorkshops(localWorkshops, true);
      workshopsSynced = localWorkshops.length;
    }

    // 4. VENDORS
    const { data: vendors, error: venErr } = await client.from('vendors').select('*');
    if (venErr) {
      if (venErr.code === '42P01') missingTables.push('vendors');
      errors.push(`Vendors table error: ${venErr.message}`);
    } else if (vendors !== null) {
      const localVendors = vendors.map((v: any) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        contactPerson: v.contact_person,
        phone: v.phone,
        email: v.email,
        address: v.address,
        outstandingBalance: v.outstanding_balance,
        rating: v.rating,
        createdAt: v.created_at
      }));
      saveVendors(localVendors, true);
      vendorsSynced = localVendors.length;
    }

    // 5. JOB CARDS & TASKS
    const { data: jobCards, error: jcErr } = await client.from('job_cards').select('*');
    const { data: jobTasks } = await client.from('job_tasks').select('*');
    if (jcErr) {
      if (jcErr.code === '42P01') missingTables.push('job_cards');
      errors.push(`Job cards table error: ${jcErr.message}`);
    } else if (jobCards !== null) {
      const localCards = jobCards.map((c: any): JobCard => {
        const tasks: JobTask[] = (jobTasks || []).filter((t: any) => t.job_card_id === c.id).map((t: any) => ({
          id: t.id,
          jobCardId: t.job_card_id,
          title: t.title || t.description || 'Task', 
          category: t.category || 'REPAIR',
          assignedToId: t.assigned_to_id || t.assigned_to,
          assignedToName: t.assigned_to_name,
          assignedType: t.assigned_type || 'EMPLOYEE',
          estimatedCost: t.estimated_cost || 0,
          customerPrice: t.customer_price || t.estimated_cost || 0,
          status: t.status || 'PENDING',
          requiresCustomerApproval: t.requires_customer_approval || false,
          isCustomerApproved: t.is_customer_approved !== null ? t.is_customer_approved : undefined,
          rejectionReason: t.rejection_reason,
          notes: t.notes || t.description,
          completedAt: t.completed_at,
          isAdditionalWork: t.is_additional_work,
          additionalWorkRequestedBy: t.additional_work_requested_by,
          additionalWorkRequestedAt: t.additional_work_requested_at,
          approvalStatus: t.approval_status
        }));

        return {
          id: c.id,
          vehicle: {
            registrationNumber: c.registration_number,
            make: c.vehicle_make,
            model: c.vehicle_model,
            year: c.vehicle_year,
            color: c.vehicle_color,
            vin: c.vehicle_vin,
            fuelLevel: c.fuel_level,
            mileage: c.mileage
          },
          customer: {
            id: c.customer_id || `cust-${c.id}`,
            name: c.customer_name,
            phone: c.customer_phone,
            email: c.customer_email,
            address: c.customer_address
          },
          status: c.status,
          serviceType: c.service_type,
          packageName: c.package_name,
          floorManagerId: c.floor_manager_id,
          pickupRequested: c.pickup_requested,
          deliveryRequested: c.delivery_requested,
          discount: c.discount,
          taxRate: c.tax_rate,
          advancePaid: c.advance_paid,
          qcPassed: c.qc_passed,
          qcNotes: c.qc_notes,
          tasks,
          createdAt: c.created_at,
          estimatedCompletionDate: c.estimated_completion_date,
          qcChecklist: []
        };
      });

      saveJobCards(localCards, true);
      jobCardsSynced = localCards.length;
    }

    if (missingTables.length > 0) {
      dispatchToastNotification({
        type: 'ESTIMATE_DECLINED',
        title: '⚠️ Missing Supabase Tables Detected',
        message: `Database tables missing: ${missingTables.join(', ')}. Run the SQL migration script from Database Settings.`
      });
    }

  } catch (err: any) {
    console.error('Initial sync failed', err);
    errors.push(err.message || String(err));
  }

  return {
    success: errors.length === 0,
    isConfigured: true,
    missingTables,
    employeesSynced,
    citiesSynced,
    workshopsSynced,
    vendorsSynced,
    jobCardsSynced,
    errors
  };
}

export async function pushLocalDataToSupabase(): Promise<{
  success: boolean;
  message: string;
  details: { cities: number; workshops: number; employees: number; vendors: number; jobCards: number };
  errors: string[];
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase client is not configured.',
      details: { cities: 0, workshops: 0, employees: 0, vendors: 0, jobCards: 0 },
      errors: ['Supabase URL / API key missing.']
    };
  }

  const errors: string[] = [];
  const cities = getCities();
  const workshops = getWorkshops();
  const employees = getEmployees();
  const vendors = getVendors();
  const jobCards = getJobCards();

  let cPushed = 0;
  let wPushed = 0;
  let ePushed = 0;
  let vPushed = 0;
  let jcPushed = 0;

  // Push Cities
  for (const c of cities) {
    const { error } = await client.from('cities').upsert({
      id: c.id,
      name: c.name,
      state: c.state,
    });
    if (error) errors.push(`Cities table error (${c.name}): ${error.message}`);
    else cPushed++;
  }

  // Push Workshops
  for (const w of workshops) {
    const { error } = await client.from('workshops').upsert({
      id: w.id,
      name: w.name,
      city_id: w.cityId,
      city_name: w.cityName,
      address: w.address,
      phone: w.phone,
      is_cars24_partner: w.isCars24Partner,
      manager_name: w.managerName,
    });
    if (error) errors.push(`Workshops table error (${w.name}): ${error.message}`);
    else wPushed++;
  }

  // Push Employees
  for (const e of employees) {
    const { error } = await client.from('employees').upsert({
      id: e.id,
      name: e.name,
      role: e.role,
      phone: e.phone,
      email: e.email || `${e.id}@workshop.fixocar.com`,
      specialized_team: e.specializedTeam,
      status: e.status || 'AVAILABLE',
      active_jobs_count: e.activeJobsCount || 0,
      avatar_url: e.avatarUrl,
      login_id: e.loginId,
      password_hash: e.password || 'password123',
      base_salary: e.baseSalary || 0,
      employment_type: e.employmentType || 'PAYROLL',
      city_id: e.cityId,
      city_name: e.cityName,
      workshop_id: e.workshopId,
      workshop_name: e.workshopName,
      updated_at: new Date().toISOString()
    });
    if (error) errors.push(`Employees table error (${e.name}): ${error.message}`);
    else ePushed++;
  }

  // Push Vendors
  for (const v of vendors) {
    const { error } = await client.from('vendors').upsert({
      id: v.id,
      name: v.name,
      category: v.category,
      contact_person: v.contactPerson,
      phone: v.phone,
      email: v.email,
      address: v.address,
      outstanding_balance: v.outstandingBalance,
      rating: v.rating,
    });
    if (error) errors.push(`Vendors table error (${v.name}): ${error.message}`);
    else vPushed++;
  }

  // Push Job Cards
  for (const card of jobCards) {
    const { error } = await client.from('job_cards').upsert({
      id: card.id,
      registration_number: card.vehicle.registrationNumber,
      vehicle_make: card.vehicle.make,
      vehicle_model: card.vehicle.model,
      vehicle_year: card.vehicle.year,
      vehicle_color: card.vehicle.color,
      vehicle_vin: card.vehicle.vin,
      fuel_level: card.vehicle.fuelLevel,
      mileage: card.vehicle.mileage,
      customer_name: card.customer.name,
      customer_phone: card.customer.phone,
      customer_email: card.customer.email,
      customer_address: card.customer.address,
      status: card.status,
      service_type: card.serviceType,
      package_name: card.packageName,
      floor_manager_id: card.floorManagerId,
      pickup_requested: card.pickupRequested,
      delivery_requested: card.deliveryRequested,
      discount: card.discount,
      tax_rate: card.taxRate,
      advance_paid: card.advancePaid,
      qc_passed: card.qcPassed,
      qc_notes: card.qcNotes,
    });
    if (error) errors.push(`Job Cards table error (${card.id}): ${error.message}`);
    else jcPushed++;
  }

  const isSuccess = errors.length === 0;
  return {
    success: isSuccess,
    message: isSuccess
      ? `Successfully pushed ${cPushed} cities, ${wPushed} workshops, ${ePushed} employees, ${vPushed} vendors, ${jcPushed} job cards to Supabase database!`
      : `Pushed ${cPushed} cities, ${wPushed} workshops, ${ePushed} employees (${errors.length} failed). Please check if tables exist.`,
    details: { cities: cPushed, workshops: wPushed, employees: ePushed, vendors: vPushed, jobCards: jcPushed },
    errors
  };
}
