import { getSupabaseClient } from './supabaseClient';
import { 
  getEmployees, saveEmployees,
  getVendors, saveVendors,
  getCities, saveCities,
  getWorkshops, saveWorkshops,
  getJobCards, saveJobCards,
  getVehicleCheckIns, saveVehicleCheckIns,
  getCarModels, saveCarModels,
  getStandardJobs, saveStandardJobs,
  dispatchToastNotification
} from './storage';
import { JobCard, JobTask, VehicleCheckIn, CarModelRecord, StandardJob } from '../types';

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
        code: w.code || 'WS',
        cityId: w.city_id,
        cityName: w.city_name,
        address: w.address,
        phone: w.phone,
        isCars24Partner: w.is_cars24_partner ?? false,
        managerName: w.manager_name || '',
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
      if (jobCards.length > 0) {
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
      } else {
        // Supabase job_cards table is empty. Push local job cards to seed database
        const localCurrent = getJobCards();
        if (localCurrent.length > 0) {
          saveJobCards(localCurrent, false); // triggers push to Supabase
          jobCardsSynced = localCurrent.length;
        }
      }
    }

    // 6. VEHICLE CHECK-INS (GATE PASS)
    const { data: vehicleCheckIns, error: vciErr } = await client.from('vehicle_check_ins').select('*');
    if (vciErr) {
      if (vciErr.code === '42P01') missingTables.push('vehicle_check_ins');
    } else if (vehicleCheckIns !== null) {
      if (vehicleCheckIns.length > 0) {
        const localCheckIns: VehicleCheckIn[] = vehicleCheckIns.map((v: any) => ({
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
        saveVehicleCheckIns(localCheckIns);
      } else {
        // Supabase table empty -> push local check-ins to Supabase
        const currentCheckIns = getVehicleCheckIns();
        for (const ci of currentCheckIns) {
          await client.from('vehicle_check_ins').upsert({
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
        }
      }
    }

    // 7. CAR MODELS & VARIANTS
    const { data: carModels, error: cmErr } = await client.from('car_models').select('*');
    if (cmErr) {
      if (cmErr.code === '42P01') missingTables.push('car_models');
    } else if (carModels !== null) {
      if (carModels.length > 0) {
        const localModels: CarModelRecord[] = carModels.map((m: any) => ({
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
        saveCarModels(localModels, true);
      } else {
        // Supabase table empty -> push local car models to Supabase
        const currentModels = getCarModels();
        saveCarModels(currentModels, false);
      }
    }

    // 8. STANDARD JOBS
    const { data: stdJobs, error: sjErr } = await client.from('standard_jobs').select('*');
    if (sjErr) {
      if (sjErr.code === '42P01') missingTables.push('standard_jobs');
    } else if (stdJobs !== null) {
      if (stdJobs.length > 0) {
        const localStdJobs: StandardJob[] = stdJobs.map((j: any) => ({
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
        saveStandardJobs(localStdJobs, true);
      } else {
        // Supabase table empty -> push local standard jobs to Supabase
        const currentStdJobs = getStandardJobs();
        saveStandardJobs(currentStdJobs, false);
      }
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

  // Push Vehicle Check-Ins (Gate Pass)
  const checkIns = getVehicleCheckIns();
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
