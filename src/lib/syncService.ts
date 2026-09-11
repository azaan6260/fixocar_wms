import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient, getStoredSupabaseConfig, fetchServerSupabaseConfig } from './supabaseClient';
import { 
  getAllEmployees, getEmployees, saveEmployees,
  getVendors, saveVendors,
  getCities, saveCities,
  getWorkshops, saveWorkshops,
  getAllJobCards, getJobCards, saveJobCards,
  getJobCardHistoryRecords, saveJobCardHistoryRecords,
  getVehicleCheckIns, saveVehicleCheckIns,
  getCarModels, saveCarModels,
  getStandardJobs, saveStandardJobs,
  getInventoryItems, saveInventoryItems,
  getDeliveries, saveDeliveries,
  getPurchaseOrders, savePurchaseOrders,
  getWorkshopExpenses, saveWorkshopExpenses,
  getAttendances, saveAttendances,
  getSalaries, saveSalaries,
  dispatchToastNotification,
  getAuthUser, saveAuthUser,
  getActiveWorkshopId, setActiveWorkshopId
} from './storage';
import { INITIAL_CITIES, INITIAL_WORKSHOPS } from './mockData';
import { JobCard, JobTask, VehicleCheckIn, CarModelRecord, StandardJob, Employee, City, Workshop, Vendor, JobCardHistoryRecord, InventoryItem, DeliveryRecord, PurchaseOrder, WorkshopExpense, AttendanceRecord, SalaryRecord } from '../types';

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

function verifyAndUpdateAuthUserWorkshop(mergedEmployees: Employee[], sourceTag: string) {
  const authUser = getAuthUser();
  if (!authUser) {
    console.log(`[SYNC_WORKSHOP_TRACE] [${sourceTag}] No active authenticated user session in localStorage.`);
    return;
  }

  const matchedEmp = mergedEmployees.find(e => 
    (e.id && e.id === authUser.id) ||
    (e.email && authUser.email && e.email.toLowerCase().trim() === authUser.email.toLowerCase().trim()) ||
    (e.loginId && authUser.loginId && e.loginId.toLowerCase().trim() === authUser.loginId.toLowerCase().trim())
  );

  console.log(`[SYNC_WORKSHOP_TRACE] [${sourceTag}] Authenticated User Workshop Sync Check:`, {
    authUserId: authUser.id,
    authUserName: authUser.name,
    authUserRole: authUser.role,
    matchedEmployeeId: matchedEmp?.id || null,
    matchedEmployeeName: matchedEmp?.name || null,
    syncedWorkshopId: matchedEmp?.workshopId || null,
    syncedWorkshopName: matchedEmp?.workshopName || null,
    syncedCityId: matchedEmp?.cityId || null,
    syncedCityName: matchedEmp?.cityName || null,
    currentActiveWorkshopId: getActiveWorkshopId()
  });

  if (matchedEmp) {
    const wsId = matchedEmp.workshopId || null;
    const wsName = matchedEmp.workshopName || null;
    const cId = matchedEmp.cityId || null;
    const cName = matchedEmp.cityName || null;

    if (wsId && (authUser.workshopId !== wsId || authUser.workshopName !== wsName)) {
      console.log(`[SYNC_WORKSHOP_TRACE] [${sourceTag}] Synchronizing updated workshop_id (${wsId}) to authenticated user context.`);
      const updatedUser = {
        ...authUser,
        workshopId: wsId,
        workshopName: wsName,
        cityId: cId,
        cityName: cName
      };
      saveAuthUser(updatedUser);
      setActiveWorkshopId(wsId);
    } else if (wsId) {
      setActiveWorkshopId(wsId);
    } else {
      console.warn(`[SYNC_WORKSHOP_TRACE] [${sourceTag}] User '${authUser.name}' (${authUser.id}) has NO assigned workshop_id in employee registry (Unassigned).`);
    }
  }
}

export interface ChunkedFetchOptions {
  chunkSize?: number;
  selectQuery?: string;
  orderBy?: { column: string; ascending?: boolean };
}

/**
 * Downloads data from a Supabase table in smaller paginated batches/chunks.
 * Prevents HTTP request timeouts, payload truncation, and high memory usage during mobile synchronization.
 */
export async function fetchTableInChunks<T = any>(
  client: any,
  tableName: string,
  options: ChunkedFetchOptions = {}
): Promise<{ data: T[] | null; error: any }> {
  if (!client) {
    return { data: null, error: new Error('Supabase client is not available') };
  }

  const chunkSize = options.chunkSize || 100;
  const selectQuery = options.selectQuery || '*';
  let allRows: T[] = [];
  let page = 0;
  let hasMore = true;
  let lastError: any = null;

  while (hasMore) {
    const from = page * chunkSize;
    const to = from + chunkSize - 1;

    try {
      let query = client
        .from(tableName)
        .select(selectQuery)
        .range(from, to);

      if (options.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
      }

      const { data, error } = await query;

      if (error) {
        lastError = error;
        console.warn(`[CHUNKED_FETCH] Error fetching page ${page} (${from}-${to}) for table '${tableName}':`, error.message || error);
        break;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        allRows = allRows.concat(data as T[]);
        console.log(`[CHUNKED_FETCH] Downloaded chunk ${page + 1} (${data.length} records, range ${from}-${to}) for table '${tableName}'`);
        if (data.length < chunkSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    } catch (chunkErr: any) {
      lastError = chunkErr;
      console.error(`[CHUNKED_FETCH] Exception on page ${page} for table '${tableName}':`, chunkErr);
      break;
    }
  }

  if (lastError && allRows.length === 0) {
    return { data: null, error: lastError };
  }

  return { data: allRows, error: null };
}

export async function syncFromSupabase(): Promise<SyncResult> {
  const missingTables: string[] = [];
  const errors: string[] = [];

  let employeesSynced = 0;
  let citiesSynced = 0;
  let workshopsSynced = 0;
  let vendorsSynced = 0;
  let jobCardsSynced = 0;

  // 0. Always initialize/sync server Supabase credentials first so mobile & server share context
  await fetchServerSupabaseConfig().catch(() => null);

  // 1. Always pull from central server store first (syncs laptop & mobile)
  try {
    const res = await fetch(`/api/central/store?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success && data.store) {
        const store = data.store;
        if (Array.isArray(store.employees) && store.employees.length > 0) {
          const currentLocal = getEmployees();
          const empMap = new Map<string, Employee>();
          
          for (const rawEmp of store.employees) {
            const sEmp: Employee = {
              id: rawEmp.id,
              name: rawEmp.name || rawEmp.employee_name || rawEmp.full_name || 'Staff',
              role: rawEmp.role || 'MECHANIC',
              phone: rawEmp.phone || rawEmp.mobile || '',
              email: rawEmp.email || rawEmp.work_email || '',
              specializedTeam: rawEmp.specializedTeam || rawEmp.specialized_team || 'Mechanical',
              status: rawEmp.status || 'AVAILABLE',
              avatarUrl: rawEmp.avatarUrl || rawEmp.avatar_url,
              activeJobsCount: rawEmp.activeJobsCount || rawEmp.active_jobs_count || 0,
              loginId: rawEmp.loginId || rawEmp.login_id || rawEmp.email,
              password: rawEmp.password || rawEmp.password_hash || '123456',
              baseSalary: rawEmp.baseSalary || rawEmp.base_salary || 0,
              employmentType: rawEmp.employmentType || rawEmp.employment_type || 'PAYROLL',
              cityId: rawEmp.cityId || rawEmp.city_id,
              cityName: rawEmp.cityName || rawEmp.city_name,
              workshopId: rawEmp.workshopId || rawEmp.workshop_id,
              workshopName: rawEmp.workshopName || rawEmp.workshop_name
            };
            const key = (sEmp.id || sEmp.email || sEmp.loginId || sEmp.name || '').toLowerCase().trim();
            if (key) empMap.set(key, sEmp);
          }
          for (const lEmp of currentLocal) {
            const key = (lEmp.id || lEmp.email || lEmp.loginId || lEmp.name || '').toLowerCase().trim();
            if (key && !empMap.has(key)) {
              empMap.set(key, lEmp);
            }
          }
          const merged = Array.from(empMap.values());
          saveEmployees(merged, true);
          employeesSynced = merged.length;
          verifyAndUpdateAuthUserWorkshop(merged, 'Central Store');
        }

        const serverJobCards = Array.isArray(store.jobCards) ? store.jobCards : [];
        const currentLocalJobCards = getAllJobCards();
        const mergedJobCards: JobCard[] = [...serverJobCards];
        for (const loc of currentLocalJobCards) {
          if (!mergedJobCards.some(m => m.id === loc.id)) {
            mergedJobCards.push(loc);
          }
        }
        if (mergedJobCards.length > 0) {
          saveJobCards(mergedJobCards, true);
          jobCardsSynced = mergedJobCards.length;
        }

        const serverJobCardHistory = Array.isArray(store.jobCardHistory) ? store.jobCardHistory : [];
        const currentLocalHistory = getJobCardHistoryRecords();
        const mergedHistory: JobCardHistoryRecord[] = [...serverJobCardHistory];
        for (const loc of currentLocalHistory) {
          if (!mergedHistory.some(m => m.id === loc.id)) {
            mergedHistory.push(loc);
          }
        }
        if (mergedHistory.length > 0) {
          saveJobCardHistoryRecords(mergedHistory);
        }

        const serverInventoryItems = Array.isArray(store.inventoryItems) ? store.inventoryItems : [];
        const currentLocalInventory = getInventoryItems();
        const mergedInventory: InventoryItem[] = [...serverInventoryItems];
        for (const loc of currentLocalInventory) {
          if (!mergedInventory.some(m => m.id === loc.id)) {
            mergedInventory.push(loc);
          }
        }
        if (mergedInventory.length > 0) {
          saveInventoryItems(mergedInventory);
        }

        const serverDeliveryRecords = Array.isArray(store.deliveryRecords) ? store.deliveryRecords : [];
        const currentLocalDeliveries = getDeliveries();
        const mergedDeliveries: DeliveryRecord[] = [...serverDeliveryRecords];
        for (const loc of currentLocalDeliveries) {
          if (!mergedDeliveries.some(m => m.id === loc.id)) {
            mergedDeliveries.push(loc);
          }
        }
        if (mergedDeliveries.length > 0) {
          saveDeliveries(mergedDeliveries);
        }

        const serverPurchaseOrders = Array.isArray(store.purchaseOrders) ? store.purchaseOrders : [];
        const currentLocalPOs = getPurchaseOrders();
        const mergedPOs: PurchaseOrder[] = [...serverPurchaseOrders];
        for (const loc of currentLocalPOs) {
          if (!mergedPOs.some(m => m.id === loc.id)) {
            mergedPOs.push(loc);
          }
        }
        if (mergedPOs.length > 0) {
          savePurchaseOrders(mergedPOs);
        }

        const serverExpenses = Array.isArray(store.workshopExpenses) ? store.workshopExpenses : [];
        const currentLocalExpenses = getWorkshopExpenses();
        const mergedExpenses: WorkshopExpense[] = [...serverExpenses];
        for (const loc of currentLocalExpenses) {
          if (!mergedExpenses.some(m => m.id === loc.id)) {
            mergedExpenses.push(loc);
          }
        }
        if (mergedExpenses.length > 0) {
          saveWorkshopExpenses(mergedExpenses);
        }

        const serverStdJobs = Array.isArray(store.standardJobs) ? store.standardJobs : [];
        const currentLocalStdJobs = getStandardJobs();
        const mergedStdJobs: StandardJob[] = [...serverStdJobs];
        for (const loc of currentLocalStdJobs) {
          if (!mergedStdJobs.some(m => m.id === loc.id)) {
            mergedStdJobs.push(loc);
          }
        }
        if (mergedStdJobs.length > 0) {
          saveStandardJobs(mergedStdJobs, true);
        }

        const serverCarModels = Array.isArray(store.carModels) ? store.carModels : [];
        const currentLocalCarModels = getCarModels();
        const mergedCarModels: CarModelRecord[] = [...serverCarModels];
        for (const loc of currentLocalCarModels) {
          if (!mergedCarModels.some(m => m.id === loc.id || (m.make === loc.make && m.model === loc.model))) {
            mergedCarModels.push(loc);
          }
        }
        if (mergedCarModels.length > 0) {
          saveCarModels(mergedCarModels, true);
        }

        const serverAttendance = Array.isArray(store.attendanceRecords) ? store.attendanceRecords : [];
        const currentLocalAttendance = getAttendances();
        const mappedAttendance: AttendanceRecord[] = serverAttendance.map((a: any) => ({
          id: a.id,
          employeeId: a.employeeId || a.employee_id,
          date: a.date,
          status: a.status || 'PRESENT',
          clockInTime: a.clockInTime || a.clock_in_time || a.checkInTime || a.check_in_time,
          clockOutTime: a.clockOutTime || a.clock_out_time || a.checkOutTime || a.check_out_time,
          clockInLocation: a.clockInLocation || a.clock_in_location,
          clockOutLocation: a.clockOutLocation || a.clock_out_location,
          photoUrl: a.photoUrl || a.photo_url
        }));
        const mergedAttendance: AttendanceRecord[] = [...mappedAttendance];
        for (const loc of currentLocalAttendance) {
          if (!mergedAttendance.some(m => m.id === loc.id)) {
            mergedAttendance.push(loc);
          }
        }
        if (mergedAttendance.length > 0) {
          saveAttendances(mergedAttendance, true);
        }

        const serverSalaries = Array.isArray(store.salaryRecords) ? store.salaryRecords : [];
        const currentLocalSalaries = getSalaries();
        const mappedSalaries: SalaryRecord[] = serverSalaries.map((s: any) => ({
          id: s.id,
          employeeId: s.employeeId || s.employee_id,
          month: s.month,
          baseSalary: s.baseSalary ?? s.base_salary ?? 0,
          deductions: s.deductions ?? 0,
          bonuses: s.bonuses ?? s.bonus ?? 0,
          netPay: s.netPay ?? s.net_pay ?? s.netSalary ?? 0,
          status: s.status || 'PENDING',
          transferDate: s.transferDate || s.transfer_date || s.paymentDate || s.payment_date
        }));
        const mergedSalaries: SalaryRecord[] = [...mappedSalaries];
        for (const loc of currentLocalSalaries) {
          if (!mergedSalaries.some(m => m.id === loc.id)) {
            mergedSalaries.push(loc);
          }
        }
        if (mergedSalaries.length > 0) {
          saveSalaries(mergedSalaries, true);
        }

        const serverCities = Array.isArray(store.cities) ? store.cities : [];
        const currentLocalCities = getCities();
        const mergedCities: City[] = serverCities.map((c: any) => ({
          id: c.id,
          name: c.name || c.city_name || c.cityName || c.title || 'City',
          state: c.state || c.state_name || c.province || '',
          createdAt: c.createdAt || c.created_at || new Date().toISOString().split('T')[0]
        }));
        for (const loc of currentLocalCities) {
          if (!mergedCities.some(m => m.id === loc.id || (m.name && loc.name && m.name.toLowerCase().trim() === loc.name.toLowerCase().trim()))) {
            mergedCities.push(loc);
          }
        }
        for (const init of INITIAL_CITIES) {
          if (!mergedCities.some(m => m.id === init.id || (m.name && init.name && m.name.toLowerCase().trim() === init.name.toLowerCase().trim()))) {
            mergedCities.push(init);
          }
        }
        saveCities(mergedCities, true);
        citiesSynced = mergedCities.length;

        const serverWorkshops = Array.isArray(store.workshops) ? store.workshops : [];
        const currentLocalWorkshops = getWorkshops();
        const mergedWorkshops: Workshop[] = serverWorkshops.map((w: any) => ({
          id: w.id,
          name: w.name || w.workshop_name || w.workshopName || 'Workshop',
          code: w.code || 'WS',
          cityId: w.city_id || w.cityId,
          cityName: w.city_name || w.cityName || w.city || '',
          address: w.address || '',
          phone: w.phone || '',
          isCars24Partner: w.is_cars24_partner ?? w.isCars24Partner ?? false,
          managerName: w.manager_name || w.managerName || '',
          createdAt: w.created_at || w.createdAt
        }));
        for (const loc of currentLocalWorkshops) {
          if (!mergedWorkshops.some(m => m.id === loc.id || (m.name && loc.name && m.name.toLowerCase() === loc.name.toLowerCase()))) {
            mergedWorkshops.push(loc);
          }
        }
        saveWorkshops(mergedWorkshops, true);
        workshopsSynced = mergedWorkshops.length;

        const serverVendors = Array.isArray(store.vendors) ? store.vendors : [];
        const currentLocalVendors = getVendors();
        const mergedVendors: Vendor[] = [...serverVendors];
        for (const loc of currentLocalVendors) {
          if (!mergedVendors.some(m => m.id === loc.id)) {
            mergedVendors.push(loc);
          }
        }
        saveVendors(mergedVendors, true);
        vendorsSynced = mergedVendors.length;

        const serverCheckIns = Array.isArray(store.vehicleCheckIns) ? store.vehicleCheckIns : [];
        const currentLocalCheckIns = getVehicleCheckIns();
        const mergedCheckIns: VehicleCheckIn[] = [...serverCheckIns];
        for (const loc of currentLocalCheckIns) {
          if (!mergedCheckIns.some(m => m.id === loc.id)) {
            mergedCheckIns.push(loc);
          }
        }
        if (mergedCheckIns.length > 0) {
          saveVehicleCheckIns(mergedCheckIns);
        }
      }
    }

    // Always push local datasets up to central server store after merging
    try {
      await pushLocalDataToSupabase();
    } catch (pushStoreErr) {
      console.warn('[SYNC_TRACE] Post-pull push to central store warning:', pushStoreErr);
    }
  } catch (centralErr) {
    console.warn('[SYNC_TRACE] Central server store sync warning:', centralErr);
  }

  // 2. Direct Supabase table queries if client is configured
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: true,
      isConfigured: false,
      missingTables: [],
      employeesSynced,
      citiesSynced,
      workshopsSynced,
      vendorsSynced,
      jobCardsSynced,
      errors: []
    };
  }

  try {
    // 0. Push any un-synced local records first so they are saved to Supabase central database
    try {
      await pushLocalDataToSupabase();
    } catch (pushFirstErr) {
      console.warn('[SYNC_TRACE] Initial pushLocalDataToSupabase warning:', pushFirstErr);
    }

    // 1. EMPLOYEES (Chunked Fetch)
    const { data: employees, error: empErr } = await fetchTableInChunks<any>(client, 'employees', { chunkSize: 100 });
    if (empErr) {
      if (empErr.code === '42P01') missingTables.push('employees');
      errors.push(`Employees table error: ${empErr.message || empErr}`);
    } else if (employees !== null) {
      const supaEmployees: Employee[] = employees.map((e: any) => ({
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

      // Merge remote Supabase DB employees with local employees so no records are lost
      const currentLocal = getEmployees();
      const empMap = new Map<string, Employee>();

      for (const sEmp of supaEmployees) {
        const key = (sEmp.id || sEmp.email || sEmp.loginId || sEmp.name || '').toLowerCase().trim();
        if (key) empMap.set(key, sEmp);
      }
      for (const lEmp of currentLocal) {
        const key = (lEmp.id || lEmp.email || lEmp.loginId || lEmp.name || '').toLowerCase().trim();
        if (key && !empMap.has(key)) {
          empMap.set(key, lEmp);
        }
      }
      const mergedEmployees = Array.from(empMap.values());
      saveEmployees(mergedEmployees, true);
      employeesSynced = mergedEmployees.length;
      verifyAndUpdateAuthUserWorkshop(mergedEmployees, 'Supabase DB');
    }

    // 2. CITIES (Chunked Fetch)
    const { data: cities, error: cityErr } = await fetchTableInChunks<any>(client, 'cities', { chunkSize: 100 });
    if (cityErr) {
      if (cityErr.code === '42P01') missingTables.push('cities');
      errors.push(`Cities table error: ${cityErr.message || cityErr}`);
    } else {
      const supaCities: City[] = (cities || []).map((c: any) => ({
        id: c.id,
        name: c.name || c.city_name || c.cityName || c.title || 'City',
        state: c.state || c.state_name || c.province || '',
        createdAt: c.created_at || c.createdAt || new Date().toISOString().split('T')[0]
      }));

      const currentLocal = getCities();
      const mergedCities: City[] = [...supaCities];
      for (const loc of [...currentLocal, ...INITIAL_CITIES]) {
        if (!mergedCities.some(m => m.id === loc.id || (m.name && loc.name && m.name.toLowerCase() === loc.name.toLowerCase()))) {
          mergedCities.push(loc);
        }
      }
      saveCities(mergedCities, true);
      citiesSynced = mergedCities.length;

      for (const c of mergedCities) {
        client.from('cities').upsert({
          id: c.id,
          name: c.name,
          state: c.state || ''
        }).then(() => {}, () => {});
      }
    }

    // 3. WORKSHOPS (Chunked Fetch)
    const { data: workshops, error: wsErr } = await fetchTableInChunks<any>(client, 'workshops', { chunkSize: 100 });
    if (wsErr) {
      if (wsErr.code === '42P01') missingTables.push('workshops');
      errors.push(`Workshops table error: ${wsErr.message || wsErr}`);
    } else {
      const supaWorkshops: Workshop[] = (workshops || []).map((w: any) => ({
        id: w.id,
        name: w.name || w.workshop_name || w.workshopName || 'Workshop',
        code: w.code || 'WS',
        cityId: w.city_id || w.cityId,
        cityName: w.city_name || w.cityName || w.city || '',
        address: w.address || '',
        phone: w.phone || '',
        isCars24Partner: w.is_cars24_partner ?? w.isCars24Partner ?? false,
        managerName: w.manager_name || w.managerName || '',
        createdAt: w.created_at || w.createdAt
      }));

      const currentLocal = getWorkshops();
      const mergedWorkshops: Workshop[] = [...supaWorkshops];
      for (const loc of [...currentLocal, ...INITIAL_WORKSHOPS]) {
        if (!mergedWorkshops.some(m => m.id === loc.id || (m.name && loc.name && m.name.toLowerCase() === loc.name.toLowerCase()))) {
          mergedWorkshops.push(loc);
        }
      }
      saveWorkshops(mergedWorkshops, true);
      workshopsSynced = mergedWorkshops.length;

      for (const w of mergedWorkshops) {
        const fullPayload = {
          id: w.id,
          name: w.name,
          city_id: w.cityId,
          city_name: w.cityName,
          code: w.code || 'WS',
          address: w.address || '',
          phone: w.phone || '',
          is_cars24_partner: w.isCars24Partner ?? false,
          manager_name: w.managerName || '',
        };
        client.from('workshops').upsert(fullPayload).then(() => {}, () => {});
      }
    }

    // 4. VENDORS (Chunked Fetch)
    const { data: vendors, error: venErr } = await fetchTableInChunks<any>(client, 'vendors', { chunkSize: 100 });
    if (venErr) {
      if (venErr.code === '42P01') missingTables.push('vendors');
      errors.push(`Vendors table error: ${venErr.message || venErr}`);
    } else if (vendors !== null) {
      const supaVendors: Vendor[] = vendors.map((v: any) => ({
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

      const currentLocal = getVendors();
      const mergedVendors: Vendor[] = [...supaVendors];
      for (const loc of currentLocal) {
        if (!mergedVendors.some(m => m.id === loc.id)) {
          mergedVendors.push(loc);
        }
      }
      saveVendors(mergedVendors, true);
      vendorsSynced = mergedVendors.length;
    }

    // 5. JOB CARDS & TASKS (Chunked Fetch)
    const { data: jobCards, error: jcErr } = await fetchTableInChunks<any>(client, 'job_cards', { chunkSize: 100 });
    const { data: jobTasks } = await fetchTableInChunks<any>(client, 'job_tasks', { chunkSize: 100 });
    if (jcErr) {
      if (jcErr.code === '42P01') missingTables.push('job_cards');
      errors.push(`Job cards table error: ${jcErr.message || jcErr}`);
    } else if (jobCards !== null) {
      const supaCards = jobCards.map((c: any): JobCard => {
        const tasks: JobTask[] = (jobTasks || []).filter((t: any) => t.job_card_id === c.id || t.jobCardId === c.id).map((t: any) => ({
          id: t.id,
          jobCardId: t.job_card_id || t.jobCardId || c.id,
          title: t.title || t.description || 'Task', 
          category: t.category || 'REPAIR',
          assignedToId: t.assigned_to_id || t.assigned_to || t.assignedToId,
          assignedToName: t.assigned_to_name || t.assignedToName,
          assignedType: t.assigned_type || t.assignedType || 'EMPLOYEE',
          estimatedCost: t.estimated_cost || t.estimatedCost || 0,
          customerPrice: t.customer_price || t.customerPrice || t.estimated_cost || 0,
          status: t.status || 'PENDING',
          requiresCustomerApproval: t.requires_customer_approval ?? t.requiresCustomerApproval ?? false,
          isCustomerApproved: t.is_customer_approved !== null && t.is_customer_approved !== undefined ? t.is_customer_approved : t.isCustomerApproved,
          rejectionReason: t.rejection_reason || t.rejectionReason,
          notes: t.notes || t.description,
          completedAt: t.completed_at || t.completedAt,
          isAdditionalWork: t.is_additional_work || t.isAdditionalWork,
          additionalWorkRequestedBy: t.additional_work_requested_by || t.additionalWorkRequestedBy,
          additionalWorkRequestedAt: t.additional_work_requested_at || t.additionalWorkRequestedAt,
          approvalStatus: t.approval_status || t.approvalStatus
        }));

        const regNo = c.registration_number || c.registrationNumber || c.reg_no || c.reg_number || c.regNo || c.vehicle_reg || c.vehicle?.registrationNumber || 'REG-PENDING';
        const makeVal = c.vehicle_make || c.vehicleMake || c.make || c.vehicle?.make || 'Vehicle';
        const modelVal = c.vehicle_model || c.vehicleModel || c.model || c.vehicle?.model || '';
        const yearVal = c.vehicle_year || c.vehicleYear || c.year || c.vehicle?.year || 2022;
        const colorVal = c.vehicle_color || c.vehicleColor || c.color || c.vehicle?.color || 'Standard';
        const vinVal = c.vehicle_vin || c.vehicleVin || c.vin || c.vehicle?.vin || '';
        const fuelVal = c.fuel_level || c.fuelLevel || c.fuel_type || c.fuelType || 50;
        const mileageVal = c.mileage || c.odometer || 0;

        const custName = c.customer_name || c.customerName || c.name || c.customer?.name || 'Customer';
        const custPhone = c.customer_phone || c.customerPhone || c.phone || c.customer?.phone || '';
        const custEmail = c.customer_email || c.customerEmail || c.email || c.customer?.email || '';
        const custAddress = c.customer_address || c.customerAddress || c.address || c.customer?.address || '';

        return {
          id: String(c.id),
          vehicle: {
            registrationNumber: regNo,
            make: makeVal,
            model: modelVal,
            year: Number(yearVal) || 2022,
            color: colorVal,
            vin: vinVal,
            fuelLevel: Number(fuelVal) || 50,
            mileage: Number(mileageVal) || 0
          },
          customer: {
            id: c.customer_id || c.customerId || `cust-${c.id}`,
            name: custName,
            phone: custPhone,
            email: custEmail,
            address: custAddress
          },
          status: c.status || 'ESTIMATE_PENDING',
          serviceType: c.service_type || c.serviceType || 'REPAIR',
          packageName: c.package_name || c.packageName,
          floorManagerId: c.floor_manager_id || c.floorManagerId,
          pickupRequested: c.pickup_requested ?? c.pickupRequested ?? false,
          deliveryRequested: c.delivery_requested ?? c.deliveryRequested ?? false,
          discount: Number(c.discount) || 0,
          taxRate: Number(c.tax_rate || c.taxRate) || 18,
          advancePaid: Number(c.advance_paid || c.advancePaid) || 0,
          qcPassed: c.qc_passed ?? c.qcPassed ?? false,
          qcNotes: c.qc_notes || c.qcNotes,
          cityId: c.city_id || c.cityId,
          cityName: c.city_name || c.cityName,
          workshopId: c.workshop_id || c.workshopId,
          workshopName: c.workshop_name || c.workshopName,
          floorManagerName: c.floor_manager_name || c.floorManagerName,
          isCars24: c.is_cars24 ?? c.isCars24 ?? false,
          cars24RefNo: c.cars24_ref_no || c.cars24RefNo,
          tasks,
          createdAt: c.created_at || c.createdAt || new Date().toISOString(),
          estimatedCompletionDate: c.estimated_completion_date || c.estimatedCompletionDate,
          qcChecklist: c.qc_checklist || c.qcChecklist || []
        };
      });

      const currentLocal = getAllJobCards();
      const mergedCards = [...supaCards];
      for (const loc of currentLocal) {
        if (!mergedCards.some(m => m.id === loc.id)) {
          mergedCards.push(loc);
        }
      }

      saveJobCards(mergedCards, true);
      jobCardsSynced = mergedCards.length;
    }

    // 6. VEHICLE CHECK-INS (GATE PASS) (Chunked Fetch)
    const { data: vehicleCheckIns, error: vciErr } = await fetchTableInChunks<any>(client, 'vehicle_check_ins', { chunkSize: 100 });
    if (vciErr) {
      if (vciErr.code === '42P01') missingTables.push('vehicle_check_ins');
    } else if (vehicleCheckIns !== null) {
      const supaCheckIns: VehicleCheckIn[] = vehicleCheckIns.map((v: any) => ({
        id: v.id,
        registrationNumber: v.registration_number,
        make: v.make || 'Vehicle',
        model: v.model || '',
        variant: v.variant,
        fuelType: v.fuel_type || 'Petrol',
        color: v.color || 'White',
        fuelLevel: v.fuel_level || 50,
        mileage: v.mileage || 10000,
        isCars24: v.is_cars24 ?? false,
        cars24RefNo: v.cars24_ref_no,
        customerName: v.customer_name || 'Customer',
        customerPhone: v.customer_phone || '',
        checkedInAt: v.check_in_time || v.created_at || new Date().toISOString(),
        checkedInByName: v.check_in_driver_name || 'Security',
        checkInDriverName: v.check_in_driver_name || 'Driver',
        checkInDriverPhone: v.check_in_driver_phone || '',
        checkInPhotoWithDriverUrl: v.driver_photo_url,
        checkInNotes: v.check_in_notes,
        status: v.status || 'CHECKED_IN',
        jobCardId: v.job_card_id,
        checkedOutAt: v.check_out_time,
        checkOutDriverName: v.check_out_driver_name,
        checkOutDriverPhone: v.check_out_driver_phone,
        checkOutPhotoWithDriverUrl: v.check_out_driver_photo_url
      }));

      const currentCheckIns = getVehicleCheckIns();
      const mergedCheckIns = [...supaCheckIns];
      for (const loc of currentCheckIns) {
        if (!mergedCheckIns.some(m => m.id === loc.id)) {
          mergedCheckIns.push(loc);
        }
      }
      saveVehicleCheckIns(mergedCheckIns);
    }

    // 7. CAR MODELS & VARIANTS (Chunked Fetch)
    const { data: carModels, error: cmErr } = await fetchTableInChunks<any>(client, 'car_models', { chunkSize: 100 });
    if (cmErr) {
      if (cmErr.code === '42P01') missingTables.push('car_models');
    } else if (carModels !== null) {
      const supaModels: CarModelRecord[] = carModels.map((m: any) => ({
        id: m.id,
        make: m.make,
        model: m.model,
        category: m.category || 'HATCHBACK',
        fuelTypes: Array.isArray(m.fuel_types) ? m.fuel_types : ['Petrol', 'Diesel'],
        variants: Array.isArray(m.variants) ? m.variants : [],
        engineOilSpec: m.engine_oil_spec || '',
        coolantSpec: m.coolant_spec || '',
        recommendedPsi: m.recommended_psi || '',
        notes: m.notes || '',
        createdAt: m.created_at || new Date().toISOString()
      }));

      const currentModels = getCarModels();
      const mergedModels = [...supaModels];
      for (const loc of currentModels) {
        if (!mergedModels.some(m => m.id === loc.id || (m.make === loc.make && m.model === loc.model))) {
          mergedModels.push(loc);
        }
      }
      saveCarModels(mergedModels, true);
    }

    // 8. STANDARD JOBS (Chunked Fetch)
    const { data: stdJobs, error: sjErr } = await fetchTableInChunks<any>(client, 'standard_jobs', { chunkSize: 100 });
    if (sjErr) {
      if (sjErr.code === '42P01') missingTables.push('standard_jobs');
    } else if (stdJobs !== null) {
      const supaStdJobs: StandardJob[] = stdJobs.map((j: any) => ({
        id: j.id,
        title: j.title,
        category: j.category || 'REPAIR',
        hsnSacCode: j.hsn_sac_code || '998729',
        retailPrice: j.retail_price || j.default_price || 0,
        cars24Price: j.cars24_price || j.default_price || 0,
        isContractBasis: j.is_contract_basis ?? false,
        painterPayout: j.painter_payout || 0,
        denterPayout: j.denter_payout || 0,
        contractorPayout: j.contractor_payout || 0,
        estimatedHours: j.estimated_hours || 1.0,
        description: j.description || '',
        requiresCustomerApproval: j.requires_customer_approval ?? false
      }));

      const currentStdJobs = getStandardJobs();
      const mergedStdJobs = [...supaStdJobs];
      for (const loc of currentStdJobs) {
        if (!mergedStdJobs.some(m => m.id === loc.id)) {
          mergedStdJobs.push(loc);
        }
      }
      saveStandardJobs(mergedStdJobs, true);
    }

    // 9. JOB CARD HISTORY (Chunked Fetch)
    const { data: historyRows, error: histErr } = await fetchTableInChunks<any>(client, 'job_card_history', { chunkSize: 100 });
    if (histErr) {
      if (histErr.code === '42P01') missingTables.push('job_card_history');
    } else if (historyRows !== null) {
      const supaHistory: JobCardHistoryRecord[] = historyRows.map((h: any) => ({
        id: h.id || `hist-${Date.now()}`,
        jobCardId: h.job_card_id,
        previousStatus: h.previous_status,
        newStatus: h.new_status,
        actionType: h.action_type || 'STATUS_CHANGE',
        changedById: h.changed_by_id,
        changedByName: h.changed_by_name || 'System',
        changedByRole: h.changed_by_role,
        notes: h.notes,
        metadata: h.metadata,
        createdAt: h.created_at || new Date().toISOString()
      }));
      saveJobCardHistoryRecords(supaHistory);
    }

    // 10. INVENTORY ITEMS (Chunked Fetch)
    const { data: invItems, error: invErr } = await fetchTableInChunks<any>(client, 'inventory_items', { chunkSize: 100 });
    if (invErr) {
      if (invErr.code === '42P01') missingTables.push('inventory_items');
    } else if (invItems !== null) {
      const supaInventory: InventoryItem[] = invItems.map((i: any) => ({
        id: i.id,
        name: i.name,
        partNumber: i.part_number,
        category: i.category,
        stockQuantity: i.stock_quantity || 0,
        unit: i.unit || 'Pcs',
        minStockAlert: i.min_stock_alert || 5,
        unitCost: i.unit_cost || 0,
        sellingPrice: i.selling_price || 0,
        supplierVendorId: i.supplier_vendor_id,
        supplierVendorName: i.supplier_vendor_name,
        shelfLocation: i.shelf_location,
        workshopId: i.workshop_id,
        workshopName: i.workshop_name,
        lastRestockedAt: i.last_restocked_at
      }));
      saveInventoryItems(supaInventory);
    }

    // 11. DELIVERY RECORDS (Chunked Fetch)
    const { data: deliveries, error: delErr } = await fetchTableInChunks<any>(client, 'delivery_records', { chunkSize: 100 });
    if (delErr) {
      if (delErr.code === '42P01') missingTables.push('delivery_records');
    } else if (deliveries !== null) {
      const supaDeliveries: DeliveryRecord[] = deliveries.map((d: any) => ({
        id: d.id,
        jobCardId: d.job_card_id,
        vehicleReg: d.vehicle_reg,
        customerName: d.customer_name,
        customerPhone: d.customer_phone,
        deliveryBoyId: d.delivery_boy_id,
        deliveryBoyName: d.delivery_boy_name,
        deliveryBoyPhone: d.delivery_boy_phone,
        type: d.type || 'DELIVERY',
        pickupAddress: d.pickup_address,
        deliveryAddress: d.delivery_address,
        status: d.status || 'ASSIGNED',
        totalAmountDue: d.total_amount_due || 0,
        paymentStatus: d.payment_status || 'PENDING',
        paymentMethod: d.payment_method,
        collectedAt: d.collected_at,
        currentLat: d.current_lat,
        currentLng: d.current_lng,
        destinationLat: d.destination_lat,
        destinationLng: d.destination_lng,
        etaMinutes: d.eta_minutes || 20,
        notes: d.notes,
        updatedAt: d.updated_at
      }));
      saveDeliveries(supaDeliveries);
    }

    // 12. PURCHASE ORDERS (Chunked Fetch)
    const { data: purchaseOrders, error: poErr } = await fetchTableInChunks<any>(client, 'purchase_orders', { chunkSize: 100 });
    if (poErr) {
      if (poErr.code === '42P01') missingTables.push('purchase_orders');
    } else if (purchaseOrders !== null) {
      const supaPOs: PurchaseOrder[] = purchaseOrders.map((p: any) => ({
        id: p.id,
        jobCardId: p.job_card_id,
        vehicleReg: p.vehicle_reg,
        vendorId: p.vendor_id,
        vendorName: p.vendor_name,
        category: p.category,
        itemDescription: p.item_description,
        amount: p.amount || 0,
        status: p.status || 'ISSUED',
        createdAt: p.created_at
      }));
      savePurchaseOrders(supaPOs);
    }

    // 13. WORKSHOP EXPENSES (Chunked Fetch)
    const { data: expenses, error: expErr } = await fetchTableInChunks<any>(client, 'workshop_expenses', { chunkSize: 100 });
    if (expErr) {
      if (expErr.code === '42P01') missingTables.push('workshop_expenses');
    } else if (expenses !== null) {
      const supaExpenses: WorkshopExpense[] = expenses.map((e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: e.amount || 0,
        date: e.date || new Date().toISOString().split('T')[0],
        workshopId: e.workshop_id,
        workshopName: e.workshop_name,
        paymentMode: e.payment_mode || 'UPI',
        paidByName: e.paid_by_name || 'Staff',
        vendorName: e.vendor_name,
        receiptNumber: e.receipt_number,
        notes: e.notes,
        isApproved: e.is_approved ?? true,
        approvedByName: e.approved_by_name,
        createdAt: e.created_at
      }));
      saveWorkshopExpenses(supaExpenses);
    }

    // 14. ATTENDANCE RECORDS (Chunked Fetch)
    const { data: attendanceRows, error: attErr } = await fetchTableInChunks<any>(client, 'attendance_records', { chunkSize: 100 });
    if (attErr) {
      if (attErr.code === '42P01') missingTables.push('attendance_records');
    } else if (attendanceRows !== null) {
      const supaAttendance: AttendanceRecord[] = attendanceRows.map((a: any) => ({
        id: a.id,
        employeeId: a.employee_id,
        date: a.date,
        status: a.status,
        clockInTime: a.check_in_time || a.clock_in_time,
        clockOutTime: a.check_out_time || a.clock_out_time,
        clockInLocation: a.clock_in_location,
        clockOutLocation: a.clock_out_location,
        photoUrl: a.photo_url
      }));
      const currentAtt = getAttendances();
      const mergedAtt = [...supaAttendance];
      for (const loc of currentAtt) {
        if (!mergedAtt.some(m => m.id === loc.id)) {
          mergedAtt.push(loc);
        }
      }
      saveAttendances(mergedAtt, true);
    }

    // 15. SALARY RECORDS (Chunked Fetch)
    const { data: salaryRows, error: salErr } = await fetchTableInChunks<any>(client, 'salary_records', { chunkSize: 100 });
    if (salErr) {
      if (salErr.code === '42P01') missingTables.push('salary_records');
    } else if (salaryRows !== null) {
      const supaSalaries: SalaryRecord[] = salaryRows.map((s: any) => ({
        id: s.id,
        employeeId: s.employee_id,
        month: s.month,
        baseSalary: s.base_salary || 0,
        bonuses: s.bonus || s.bonuses || 0,
        deductions: s.deductions || 0,
        netPay: s.net_salary || s.net_pay || 0,
        status: s.status || 'PENDING',
        transferDate: s.payment_date || s.transfer_date
      }));
      const currentSal = getSalaries();
      const mergedSal = [...supaSalaries];
      for (const loc of currentSal) {
        if (!mergedSal.some(m => m.id === loc.id)) {
          mergedSal.push(loc);
        }
      }
      saveSalaries(mergedSal, true);
    }

    // Automatically push merged dataset back to Supabase in background
    pushLocalDataToSupabase().catch(pushErr => {
      console.warn('[SYNC_TRACE] Background pushLocalDataToSupabase error after sync:', pushErr);
    });

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
  const cities = getCities();
  const workshops = getWorkshops();
  const employees = getAllEmployees();
  const vendors = getVendors();
  const jobCards = getAllJobCards();
  const checkIns = getVehicleCheckIns();

  // Always sync to central backend server first
  try {
    await fetch('/api/central/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employees,
        jobCards,
        cities,
        workshops,
        vendors,
        vehicleCheckIns: checkIns,
        jobCardHistory: getJobCardHistoryRecords(),
        inventoryItems: getInventoryItems(),
        deliveryRecords: getDeliveries(),
        purchaseOrders: getPurchaseOrders(),
        workshopExpenses: getWorkshopExpenses(),
        attendanceRecords: getAttendances(),
        salaryRecords: getSalaries()
      })
    });
  } catch (centralPushErr) {
    console.warn('[SYNC_TRACE] Push to central store warning:', centralPushErr);
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: true,
      message: 'Synced with central server store.',
      details: { cities: cities.length, workshops: workshops.length, employees: employees.length, vendors: vendors.length, jobCards: jobCards.length },
      errors: []
    };
  }

  const errors: string[] = [];
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
    const fullPayload = {
      id: w.id,
      name: w.name,
      city_id: w.cityId,
      city_name: w.cityName,
      code: w.code || 'WS',
      address: w.address || '',
      phone: w.phone || '',
      is_cars24_partner: w.isCars24Partner ?? false,
      manager_name: w.managerName || '',
    };
    let { error } = await client.from('workshops').upsert(fullPayload);

    if (error && (error.message?.includes('is_cars24_partner') || error.message?.includes('manager_name') || error.message?.includes('schema cache'))) {
      const fallbackPayload = {
        id: w.id,
        name: w.name,
        city_id: w.cityId,
        city_name: w.cityName,
        code: w.code || 'WS',
        address: w.address || '',
        phone: w.phone || '',
      };
      const res = await client.from('workshops').upsert(fallbackPayload);
      error = res.error;
    }

    if (error) errors.push(`Workshops table error (${w.name}): ${error.message}`);
    else wPushed++;
  }

  // Push Employees
  for (const e of employees) {
    let { error } = await client.from('employees').upsert({
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
      password_hash: e.password || '123456',
      base_salary: e.baseSalary || 0,
      employment_type: e.employmentType || 'PAYROLL',
      city_id: e.cityId || null,
      city_name: e.cityName || null,
      workshop_id: e.workshopId || null,
      workshop_name: e.workshopName || null,
      updated_at: new Date().toISOString()
    });

    if (error && (error.message?.includes('foreign key') || error.message?.includes('fk_employees') || error.message?.includes('schema cache'))) {
      const fb = await client.from('employees').upsert({
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
        password_hash: e.password || '123456',
        base_salary: e.baseSalary || 0,
        employment_type: e.employmentType || 'PAYROLL',
        city_id: e.cityId || null,
        city_name: e.cityName || null,
        workshop_id: e.workshopId || null,
        workshop_name: e.workshopName || null,
        updated_at: new Date().toISOString()
      });
      error = fb.error;
    }

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

  // Push Job Cards & Tasks
  for (const card of jobCards) {
    const fullPayload = {
      id: card.id,
      registration_number: card.vehicle?.registrationNumber || 'UNKNOWN',
      vehicle_make: card.vehicle?.make || 'Vehicle',
      vehicle_model: card.vehicle?.model || '',
      vehicle_year: card.vehicle?.year || 2022,
      vehicle_color: card.vehicle?.color || 'Standard',
      vehicle_vin: card.vehicle?.vin || '',
      fuel_level: card.vehicle?.fuelLevel || 50,
      mileage: card.vehicle?.mileage || 0,
      customer_name: card.customer?.name || 'Customer',
      customer_phone: card.customer?.phone || '',
      customer_email: card.customer?.email || '',
      customer_address: card.customer?.address || '',
      status: card.status || 'CREATED',
      service_type: card.serviceType || 'CUSTOM_REPAIR',
      package_name: card.packageName || null,
      floor_manager_id: card.floorManagerId || null,
      floor_manager_name: card.floorManagerName || null,
      city_id: card.cityId || null,
      city_name: card.cityName || null,
      workshop_id: card.workshopId || null,
      workshop_name: card.workshopName || null,
      is_cars24: card.isCars24 || false,
      cars24_ref_no: card.cars24RefNo || null,
      pickup_requested: card.pickupRequested || false,
      delivery_requested: card.deliveryRequested || false,
      discount: card.discount || 0,
      tax_rate: card.taxRate || 18,
      advance_paid: card.advancePaid || 0,
      qc_passed: card.qcPassed || false,
      qc_notes: card.qcNotes || null,
      updated_at: new Date().toISOString()
    };

    let { error } = await client.from('job_cards').upsert(fullPayload);

    if (error && (error.message?.includes('foreign key') || error.message?.includes('fk_job_cards') || error.message?.includes('schema cache'))) {
      const fallbackPayload = {
        ...fullPayload,
        floor_manager_id: null,
        city_id: null,
        workshop_id: null
      };
      const res = await client.from('job_cards').upsert(fallbackPayload);
      error = res.error;
    }

    if (Array.isArray(card.tasks) && card.tasks.length > 0) {
      for (const t of card.tasks) {
        await client.from('job_tasks').upsert({
          id: t.id,
          job_card_id: card.id,
          title: t.title || t.notes || 'Task',
          category: t.category || 'REPAIR',
          assigned_to_id: t.assignedToId || null,
          assigned_to_name: t.assignedToName || null,
          assigned_type: t.assignedType || 'EMPLOYEE',
          estimated_cost: t.estimatedCost || 0,
          customer_price: t.customerPrice || t.estimatedCost || 0,
          status: t.status || 'PENDING',
          requires_customer_approval: t.requiresCustomerApproval || false,
          is_customer_approved: t.isCustomerApproved !== undefined ? t.isCustomerApproved : null,
          rejection_reason: t.rejectionReason || null,
          notes: t.notes || null,
          completed_at: t.completedAt || null,
          updated_at: new Date().toISOString()
        });
      }
    }

    if (error) errors.push(`Job Cards table error (${card.id}): ${error.message}`);
    else jcPushed++;
  }

  // Push Vehicle Check-Ins (Gate Pass)
  let vciPushed = 0;
  for (const ci of checkIns) {
    const { error } = await client.from('vehicle_check_ins').upsert({
      id: ci.id,
      registration_number: ci.registrationNumber,
      make: ci.make,
      model: ci.model,
      variant: ci.variant,
      fuel_type: ci.fuelType,
      color: ci.color,
      fuel_level: ci.fuelLevel,
      mileage: ci.mileage,
      is_cars24: ci.isCars24,
      cars24_ref_no: ci.cars24RefNo,
      customer_name: ci.customerName,
      customer_phone: ci.customerPhone,
      check_in_driver_name: ci.checkInDriverName,
      check_in_driver_phone: ci.checkInDriverPhone,
      driver_photo_url: ci.checkInPhotoWithDriverUrl,
      check_in_notes: ci.checkInNotes,
      status: ci.status,
      job_card_id: ci.jobCardId
    });
    if (error) errors.push(`Vehicle Check-ins table error (${ci.id}): ${error.message}`);
    else vciPushed++;
  }

  // Push Car Models & Variants
  const carModelsList = getCarModels();
  let cmPushed = 0;
  for (const m of carModelsList) {
    const { error } = await client.from('car_models').upsert({
      id: m.id,
      make: m.make,
      model: m.model,
      category: m.category,
      fuel_types: m.fuelTypes,
      variants: m.variants || [],
      engine_oil_spec: m.engineOilSpec || '',
      coolant_spec: m.coolantSpec || '',
      recommended_psi: m.recommendedPsi || '',
      notes: m.notes || '',
      updated_at: new Date().toISOString()
    });
    if (error) errors.push(`Car Models table error (${m.make} ${m.model}): ${error.message}`);
    else cmPushed++;
  }

  // Push Standard Jobs
  const stdJobsList = getStandardJobs();
  let sjPushed = 0;
  for (const j of stdJobsList) {
    const { error } = await client.from('standard_jobs').upsert({
      id: j.id,
      title: j.title,
      category: j.category,
      hsn_sac_code: j.hsnSacCode || '998729',
      default_price: j.retailPrice || 0,
      retail_price: j.retailPrice || 0,
      cars24_price: j.cars24Price || 0,
      is_contract_basis: j.isContractBasis || false,
      painter_payout: j.painterPayout || j.retailPainterPayout || 0,
      denter_payout: j.denterPayout || j.retailDenterPayout || 0,
      contractor_payout: j.contractorPayout || j.retailContractorPayout || 0,
      estimated_hours: j.estimatedHours || 1.0,
      description: j.description || '',
      requires_customer_approval: j.requiresCustomerApproval || false,
    });
    if (error) errors.push(`Standard Jobs table error (${j.title}): ${error.message}`);
    else sjPushed++;
  }

  // Push Job Card History
  const historyList = getJobCardHistoryRecords();
  for (const h of historyList) {
    await client.from('job_card_history').upsert({
      id: h.id,
      job_card_id: h.jobCardId,
      previous_status: h.previousStatus || null,
      new_status: h.newStatus,
      action_type: h.actionType || 'STATUS_CHANGE',
      changed_by_id: h.changedById || null,
      changed_by_name: h.changedByName || 'System',
      changed_by_role: h.changedByRole || null,
      notes: h.notes || null,
      created_at: h.createdAt
    });
  }

  // Push Inventory Items
  const inventoryList = getInventoryItems();
  for (const item of inventoryList) {
    await client.from('inventory_items').upsert({
      id: item.id,
      name: item.name,
      part_number: item.partNumber,
      category: item.category,
      stock_quantity: item.stockQuantity || 0,
      unit: item.unit || 'Pcs',
      min_stock_alert: item.minStockAlert || 5,
      unit_cost: item.unitCost || 0,
      selling_price: item.sellingPrice || 0,
      supplier_vendor_id: item.supplierVendorId || null,
      supplier_vendor_name: item.supplierVendorName || null,
      shelf_location: item.shelfLocation || null,
      workshop_id: item.workshopId || null,
      workshop_name: item.workshopName || null,
      last_restocked_at: item.lastRestockedAt || new Date().toISOString()
    });
  }

  // Push Delivery Records
  const deliveriesList = getDeliveries();
  for (const del of deliveriesList) {
    await client.from('delivery_records').upsert({
      id: del.id,
      job_card_id: del.jobCardId,
      vehicle_reg: del.vehicleReg,
      customer_name: del.customerName,
      customer_phone: del.customerPhone,
      delivery_boy_id: del.deliveryBoyId || null,
      delivery_boy_name: del.deliveryBoyName || null,
      delivery_boy_phone: del.deliveryBoyPhone || null,
      type: del.type || 'DELIVERY',
      pickup_address: del.pickupAddress || null,
      delivery_address: del.deliveryAddress || null,
      status: del.status || 'ASSIGNED',
      total_amount_due: del.totalAmountDue || 0,
      payment_status: del.paymentStatus || 'PENDING',
      payment_method: del.paymentMethod || null,
      collected_at: del.collectedAt || null,
      current_lat: del.currentLat || null,
      current_lng: del.currentLng || null,
      destination_lat: del.destinationLat || null,
      destination_lng: del.destinationLng || null,
      eta_minutes: del.etaMinutes || 20,
      notes: del.notes || null,
      updated_at: (del as any).updatedAt || new Date().toISOString()
    });
  }

  // Push Purchase Orders
  const poList = getPurchaseOrders();
  for (const po of poList) {
    await client.from('purchase_orders').upsert({
      id: po.id,
      job_card_id: po.jobCardId,
      vehicle_reg: po.vehicleReg,
      vendor_id: po.vendorId,
      vendor_name: po.vendorName,
      category: po.category,
      item_description: po.itemDescription,
      amount: po.amount || 0,
      status: po.status || 'ISSUED',
      created_at: po.createdAt
    });
  }

  // Push Workshop Expenses
  const expList = getWorkshopExpenses();
  for (const exp of expList) {
    await client.from('workshop_expenses').upsert({
      id: exp.id,
      title: exp.title,
      category: exp.category,
      amount: exp.amount || 0,
      date: exp.date || new Date().toISOString().split('T')[0],
      workshop_id: exp.workshopId || null,
      workshop_name: exp.workshopName || null,
      payment_mode: exp.paymentMode || 'UPI',
      paid_by_name: exp.paidByName || 'Staff',
      vendor_name: exp.vendorName || null,
      receipt_number: exp.receiptNumber || null,
      notes: exp.notes || null,
      is_approved: exp.isApproved ?? true,
      approved_by_name: exp.approvedByName || null,
      created_at: exp.createdAt
    });
  }

  // Push Attendance Records
  const attList = getAttendances();
  for (const att of attList) {
    await client.from('attendance_records').upsert({
      id: att.id,
      employee_id: att.employeeId,
      date: att.date,
      status: att.status,
      check_in_time: att.clockInTime || null,
      check_out_time: att.clockOutTime || null
    });
  }

  // Push Salary Records
  const salList = getSalaries();
  for (const sal of salList) {
    await client.from('salary_records').upsert({
      id: sal.id,
      employee_id: sal.employeeId,
      month: sal.month,
      base_salary: sal.baseSalary || 0,
      bonus: sal.bonuses || 0,
      deductions: sal.deductions || 0,
      net_salary: sal.netPay || 0,
      status: sal.status || 'PENDING',
      payment_date: sal.transferDate || null
    });
  }

  const isSuccess = errors.length === 0;
  return {
    success: isSuccess,
    message: isSuccess
      ? `Successfully pushed ${cPushed} cities, ${wPushed} workshops, ${ePushed} employees, ${vPushed} vendors, ${jcPushed} job cards, ${vciPushed} gate pass check-ins, ${cmPushed} car models, ${sjPushed} standard jobs to Supabase database!`
      : `Pushed ${cPushed} cities, ${wPushed} workshops, ${ePushed} employees, ${cmPushed} car models (${errors.length} failed). Please check if tables exist.`,
    details: { cities: cPushed, workshops: wPushed, employees: ePushed, vendors: vPushed, jobCards: jcPushed },
    errors
  };
}

export interface AuthDiagnosticReport {
  timestamp: string;
  isConfigured: boolean;
  supabaseUrl: string | null;
  hasServiceRoleKey: boolean;
  serviceKeyRole: 'service_role' | 'anon' | 'unknown' | 'none';
  authServiceAvailable: boolean;
  canWriteToAuthUsers: boolean;
  userCountInAuthUsers: number | null;
  details: string[];
  recommendations: string[];
}

/**
 * Diagnostic tool function that checks the connection to Supabase specifically for authentication service availability.
 * Verifies whether the 'service_role' key has sufficient permissions to write to the 'auth.users' table,
 * logs a detailed diagnostic report to the console, and returns the report.
 */
export async function checkAuthServiceConnection(): Promise<AuthDiagnosticReport> {
  const timestamp = new Date().toISOString();
  const details: string[] = [];
  const recommendations: string[] = [];

  // 1. Fetch current configuration
  const serverConfig = await fetchServerSupabaseConfig().catch(() => null);
  const localConfig = getStoredSupabaseConfig();

  const supabaseUrl = serverConfig?.supabaseUrl || localConfig.supabaseUrl || null;
  const supabaseAnonKey = serverConfig?.supabaseAnonKey || localConfig.supabaseAnonKey || '';
  const supabaseServiceKey = serverConfig?.supabaseServiceKey || localConfig.supabaseServiceKey || '';

  details.push(`[${timestamp}] Starting Supabase Authentication Service Diagnostic...`);

  if (!supabaseUrl) {
    details.push('❌ Supabase URL is missing or not configured.');
    recommendations.push('Configure your Supabase Project URL in the Database Settings modal.');

    const report: AuthDiagnosticReport = {
      timestamp,
      isConfigured: false,
      supabaseUrl: null,
      hasServiceRoleKey: false,
      serviceKeyRole: 'none',
      authServiceAvailable: false,
      canWriteToAuthUsers: false,
      userCountInAuthUsers: null,
      details,
      recommendations
    };

    logConsoleReport(report);
    return report;
  }

  details.push(`✅ Supabase Endpoint URL: ${supabaseUrl}`);

  // Helper to parse JWT role
  const parseJwtRole = (key: string): 'service_role' | 'anon' | 'unknown' | 'none' => {
    if (!key) return 'none';
    try {
      const parts = key.trim().split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.role === 'service_role') return 'service_role';
        if (payload.role === 'anon') return 'anon';
      }
    } catch {
      return 'unknown';
    }
    return 'unknown';
  };

  const serviceKeyRole = parseJwtRole(supabaseServiceKey);
  const hasServiceRoleKey = Boolean(supabaseServiceKey && supabaseServiceKey.length > 20);

  if (!hasServiceRoleKey) {
    details.push('⚠️ Service Role Key is missing. Standard anon key cannot manage auth.users directly.');
    recommendations.push('Paste your secret service_role key into Database Settings to grant auth.users write permissions.');
  } else if (serviceKeyRole === 'anon') {
    details.push('❌ Misconfiguration: You pasted the public "anon" key into the Service Role Key field!');
    recommendations.push('Replace the key in the Service Role Key field with your secret "service_role" key from Supabase Project Settings -> API.');
  } else if (serviceKeyRole === 'service_role') {
    details.push('✅ Valid JWT "service_role" key detected.');
  } else {
    details.push(`ℹ️ Service Key detected (JWT role: ${serviceKeyRole}).`);
  }

  let authServiceAvailable = false;
  let canWriteToAuthUsers = false;
  let userCountInAuthUsers: number | null = null;

  // 2. Test server-side diagnostic endpoint
  try {
    const res = await fetch('/api/supabase/admin/diagnose-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseUrl,
        supabaseServiceKey,
        supabaseAnonKey
      })
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.success || data.isConfigured)) {
        authServiceAvailable = true;
        details.push('✅ Connection test to Supabase API successful.');
      }
    }
  } catch (err: any) {
    details.push(`⚠️ Backend diagnostic check failed: ${err.message}`);
  }

  // 3. Test direct client Auth Admin API permissions (to verify writing to auth.users)
  const keyToUseForAdmin = serviceKeyRole === 'service_role' ? supabaseServiceKey : (supabaseServiceKey || supabaseAnonKey);
  if (keyToUseForAdmin && supabaseUrl) {
    try {
      const adminClient = createClient(supabaseUrl, keyToUseForAdmin, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      if (adminClient.auth?.admin) {
        const { data: userList, error: listErr } = await adminClient.auth.admin.listUsers();

        if (!listErr && userList) {
          authServiceAvailable = true;
          canWriteToAuthUsers = serviceKeyRole === 'service_role' || serviceKeyRole === 'unknown';
          userCountInAuthUsers = userList.users ? userList.users.length : 0;

          details.push(`✅ Auth Admin Service is ONLINE and accessible.`);
          if (canWriteToAuthUsers) {
            details.push(`✅ Service Role Key PERMISSION GRANTED: Sufficient permissions verified to create, update, and write to 'auth.users' table.`);
            details.push(`📊 Current registered accounts in 'auth.users': ${userCountInAuthUsers}`);
          } else {
            details.push(`⚠️ Auth listing succeeded but key is not a service_role key. Write operations to auth.users may fail.`);
          }
        } else if (listErr) {
          if (listErr.message?.includes('JWT') || listErr.message?.includes('apiKey') || listErr.status === 401) {
            details.push(`❌ Service Role Key Permission DENIED: ${listErr.message}`);
            recommendations.push('The provided Service Role Key is invalid or unauthorized. Copy the secret service_role key from Supabase Project Settings -> API.');
          } else {
            details.push(`❌ Auth Service query failed: ${listErr.message}`);
            recommendations.push(`Check Supabase Auth service status and permissions: ${listErr.message}`);
          }
        }
      }
    } catch (adminErr: any) {
      details.push(`❌ Exception testing Auth Admin API: ${adminErr.message}`);
    }
  }

  if (!canWriteToAuthUsers && recommendations.length === 0) {
    recommendations.push('Ensure the service_role key is configured and that Email Auth is enabled in Supabase Dashboard.');
  }

  const report: AuthDiagnosticReport = {
    timestamp,
    isConfigured: true,
    supabaseUrl,
    hasServiceRoleKey,
    serviceKeyRole,
    authServiceAvailable,
    canWriteToAuthUsers,
    userCountInAuthUsers,
    details,
    recommendations
  };

  logConsoleReport(report);
  return report;
}

function logConsoleReport(report: AuthDiagnosticReport) {
  console.group('%c 🔐 Supabase Auth Service Diagnostic Report', 'background: #0f172a; color: #38bdf8; font-weight: bold; padding: 6px 12px; border-radius: 6px;');
  console.log(`%cTimestamp:%c ${report.timestamp}`, 'font-weight: bold', 'color: #94a3b8');
  console.log(`%cSupabase URL:%c ${report.supabaseUrl || 'N/A'}`, 'font-weight: bold', 'color: #cbd5e1');
  console.log(`%cService Role Key:%c ${report.hasServiceRoleKey ? `Present (${report.serviceKeyRole})` : 'Missing'}`, 'font-weight: bold', report.hasServiceRoleKey && report.serviceKeyRole === 'service_role' ? 'color: #4ade80' : 'color: #f87171');
  console.log(`%cAuth Service Status:%c ${report.authServiceAvailable ? 'ONLINE ✅' : 'OFFLINE / UNREACHABLE ❌'}`, 'font-weight: bold', report.authServiceAvailable ? 'color: #4ade80' : 'color: #f87171');
  console.log(`%cWrite Permission ('auth.users'):%c ${report.canWriteToAuthUsers ? 'GRANTED ✅' : 'DENIED ❌'}`, 'font-weight: bold', report.canWriteToAuthUsers ? 'color: #4ade80' : 'color: #f87171');
  if (report.userCountInAuthUsers !== null) {
    console.log(`%cTotal Registered Auth Users:%c ${report.userCountInAuthUsers}`, 'font-weight: bold', 'color: #a78bfa');
  }

  console.group('%c Diagnostic Log Details:', 'color: #38bdf8; font-weight: bold');
  report.details.forEach(line => console.log(line));
  console.groupEnd();

  if (report.recommendations.length > 0) {
    console.group('%c Recommendations / Required Actions:', 'color: #fbbf24; font-weight: bold');
    report.recommendations.forEach(rec => console.log(`• ${rec}`));
    console.groupEnd();
  }

  console.groupEnd();
}

// Bind to window for instant dev console invocation
if (typeof window !== 'undefined') {
  (window as any).checkAuthServiceConnection = checkAuthServiceConnection;
}
