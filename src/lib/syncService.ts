import { getSupabaseClient } from './supabaseClient';
import { 
  getEmployees, saveEmployees,
  getVendors, saveVendors,
  getCities, saveCities,
  getWorkshops, saveWorkshops,
  getJobCards, saveJobCards
} from './storage';
import { JobCard, JobTask } from '../types';

export async function syncFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data: employees } = await client.from('employees').select('*');
    if (employees && employees.length > 0) {
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
        password: e.password,
        baseSalary: e.base_salary,
        createdAt: e.created_at,
        employmentType: e.employment_type || 'PAYROLL',
        cityId: e.city_id,
        cityName: e.city_name,
        workshopId: e.workshop_id,
        workshopName: e.workshop_name
      }));
      saveEmployees(local, true);
    }
    
    const { data: cities } = await client.from('cities').select('*');
    if (cities && cities.length > 0) {
      saveCities(cities.map((c: any) => ({
        id: c.id,
        name: c.name,
        state: c.state,
        createdAt: c.created_at
      })), true);
    }

    const { data: workshops } = await client.from('workshops').select('*');
    if (workshops && workshops.length > 0) {
      saveWorkshops(workshops.map((w: any) => ({
        id: w.id,
        name: w.name,
        cityId: w.city_id,
        cityName: w.city_name,
        address: w.address,
        phone: w.phone,
        isCars24Partner: w.is_cars24_partner,
        managerName: w.manager_name,
        createdAt: w.created_at
      })), true);
    }

    const { data: vendors } = await client.from('vendors').select('*');
    if (vendors && vendors.length > 0) {
      saveVendors(vendors.map((v: any) => ({
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
      })), true);
    }
    
    // Fetch job cards and tasks
    const { data: jobCards } = await client.from('job_cards').select('*');
    const { data: jobTasks } = await client.from('job_tasks').select('*');
    if (jobCards && jobCards.length > 0) {
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
    }

  } catch (err) {
    console.error('Initial sync failed', err);
  }
}
