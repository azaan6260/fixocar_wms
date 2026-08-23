import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Employee, AuthUser } from '../types';

const STORAGE_KEY_URL = 'autocraft_supabase_url';
const STORAGE_KEY_ANON = 'autocraft_supabase_anon_key';
const STORAGE_KEY_SERVICE_ROLE = 'autocraft_supabase_service_role_key';

export function getStoredSupabaseConfig() {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envAnon = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const envServiceKey = metaEnv.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
  
  const savedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const savedAnon = localStorage.getItem(STORAGE_KEY_ANON) || envAnon;
  const savedService = localStorage.getItem(STORAGE_KEY_SERVICE_ROLE) || envServiceKey;

  return {
    supabaseUrl: savedUrl,
    supabaseAnonKey: savedAnon,
    supabaseServiceKey: savedService,
    isConfigured: Boolean(savedUrl && (savedAnon || savedService))
  };
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.isConfigured) return null;

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(config.supabaseUrl, config.supabaseAnonKey || config.supabaseServiceKey);
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
}

export function saveSupabaseConfig(url: string, anonKey: string, serviceKey?: string) {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
  if (serviceKey) {
    localStorage.setItem(STORAGE_KEY_SERVICE_ROLE, serviceKey.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_SERVICE_ROLE);
  }
  supabaseInstance = null; // reset instance so next get creates fresh client
}

export function clearSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON);
  localStorage.removeItem(STORAGE_KEY_SERVICE_ROLE);
  supabaseInstance = null;
}

/**
 * Sync employee profile and login credentials directly to Supabase Auth & Database
 */
export async function syncEmployeeToSupabaseAuth(
  employee: Employee,
  newPassword?: string,
  action: 'create' | 'update' | 'delete' = 'update'
): Promise<{ success: boolean; authSynced?: boolean; message?: string }> {
  const config = getStoredSupabaseConfig();
  
  try {
    const res = await fetch('/api/supabase/admin/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        employee,
        newPassword,
        supabaseUrl: config.supabaseUrl,
        supabaseServiceKey: config.supabaseServiceKey,
        supabaseAnonKey: config.supabaseAnonKey
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err: any) {
    console.warn('Server sync endpoint error, attempting client-side direct upsert:', err);
  }

  // Client-side fallback to update public.employees table directly
  const client = getSupabaseClient();
  if (client) {
    try {
      if (action === 'delete') {
        await client.from('employees').delete().eq('id', employee.id);
        return { success: true, message: 'Deleted employee from Supabase database' };
      }

      const { error } = await client.from('employees').upsert({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        email: employee.email,
        specialized_team: employee.specializedTeam,
        status: employee.status || 'AVAILABLE',
        active_jobs_count: employee.activeJobsCount || 0,
        avatar_url: employee.avatarUrl,
        login_id: employee.loginId,
        password_hash: newPassword || employee.password,
        base_salary: employee.baseSalary || 0,
        employment_type: employee.employmentType || 'PAYROLL',
        city_id: employee.cityId,
        city_name: employee.cityName,
        workshop_id: employee.workshopId,
        workshop_name: employee.workshopName,
        updated_at: new Date().toISOString()
      });

      if (!error) {
        return { success: true, message: 'Saved to Supabase database' };
      }
    } catch (clientErr: any) {
      console.warn('Client Supabase upsert error:', clientErr);
    }
  }

  return { success: true, message: 'Saved locally' };
}

/**
 * Authenticate directly against Supabase database or Auth
 */
export async function authenticateViaSupabase(
  identifier: string,
  password?: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  if (!password) return { success: false, error: 'Password required' };
  
  try {
    const res = await fetch('/api/supabase/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        return { success: true, user: data.user };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch (err: any) {
    console.warn('Supabase login API error, checking local store:', err);
  }

  return { success: false, error: 'User not verified against Supabase' };
}

/**
 * Bulk sync all employees to Supabase Auth & Database
 */
export async function syncAllEmployeesToSupabase(
  employees: Employee[]
): Promise<{ total: number; synced: number; messages: string[] }> {
  let synced = 0;
  const messages: string[] = [];

  for (const emp of employees) {
    try {
      const res = await syncEmployeeToSupabaseAuth(emp, emp.password, 'update');
      if (res.success) {
        synced++;
        if (res.message) messages.push(`${emp.name}: ${res.message}`);
      }
    } catch (err: any) {
      messages.push(`${emp.name}: Failed (${err.message})`);
    }
  }

  return { total: employees.length, synced, messages };
}

