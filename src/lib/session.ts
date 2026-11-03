/**
 * Every storage key that carries authentication or user identity. Login writes
 * these across two files (api.ts and Login.tsx) in both casings, so clearing
 * them has to be driven from one list rather than repeated per call site.
 */
const AUTH_SESSION_KEYS = [
  'isLogin', 'userInfo', 'user', 'username', 'password',
  'userCode', 'usercode', 'orgCode', 'orgcode',
  'customerCode', 'custcode', 'userRole', 'appcode',
];

const AUTH_LOCAL_KEYS = ['user', 'userInfo', 'userName', 'authToken', 'userSession'];

/**
 * Wipes every trace of the signed-in user. The access-denied flow needs this
 * because loginUser() has already written identity keys by the time the active
 * flag is checked, so a deactivated account would otherwise keep a half-built
 * session behind the modal.
 */
export function clearAuthSession() {
  try {
    AUTH_SESSION_KEYS.forEach(key => sessionStorage.removeItem(key));
  } catch (e) { /* ignore storage errors */ }
  try {
    AUTH_LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
  } catch (e) { /* ignore storage errors */ }
}

/** Wording for each way an account can be barred from signing in. */
export const ACCOUNT_MESSAGES = {
  notYetActive: 'Your account is still yet to active. Please contact the administrator.',
  inactive: 'Your account has expired or is inactive. Please contact the administrator.',
};

/**
 * Resolves the `active` flag carried on the login response's userData entry.
 *
 *   "0" - before the user's From Date, not yet active
 *   "1" - inside the From/To window, allowed
 *   "2" - past the user's To Date, expired
 *
 * The two blocked states carry different wording, so the caller shows the one
 * that matches. Legacy boolean-ish spellings are treated as expired, since that
 * is what they meant before the three-state flag existed.
 *
 * A missing or unrecognised value is allowed: a response without the field must
 * not lock every user out of the application.
 */
export function getAccountAccess(active: unknown): { allowed: boolean; message?: string } {
  const value = String(active ?? '').trim().toLowerCase();
  if (value === '') return { allowed: true };
  if (value === '0') return { allowed: false, message: ACCOUNT_MESSAGES.notYetActive };
  if (['2', 'false', 'n', 'no', 'inactive', 'expired'].includes(value)) {
    return { allowed: false, message: ACCOUNT_MESSAGES.inactive };
  }
  return { allowed: true };
}

export function getSessionCodes() {
  const raw = sessionStorage.getItem('user') || sessionStorage.getItem('userInfo') || '{}';
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw as string) || {};
  } catch (e) {
    parsed = {};
  }

  const usercode = (
    sessionStorage.getItem('usercode') ||
    sessionStorage.getItem('userCode') ||
    parsed?.userCode ||
    parsed?.usercode ||
    parsed?.user ||
    ''
  ).toString();
  const custcode = 'ICME';
  const orgcode = (
    sessionStorage.getItem('orgcode') ||
    sessionStorage.getItem('orgCode') ||
    sessionStorage.getItem('orgcode') ||
    parsed?.orgCode ||
    parsed?.orgcode ||
    parsed?.org_code ||
    parsed?.organizationCode ||
    ''
  ).toString();
  const appcode = (sessionStorage.getItem('appcode') || sessionStorage.getItem('appCode') || 'IG').toString();

  return {
    usercode,
    custcode,
    orgcode,
    appcode,
  };
}
