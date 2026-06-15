/**
 * Role-based access control for the frontend.
 *
 * Roles:
 * - admin: full access
 * - viewer: read-only access to core scan pages
 * - auditor: viewer + reports
 * - itadmin: viewer + operational controls
 */

const ROLE_PERMISSIONS = {
  admin: [
    'dashboard',
    'assets',
    'asset-inventory',
    'vulnerability-scan',
    'cbom',
    'cyber-rating',
    'analytics',
    'reports',
    'settings',
    'scan',
  ],
  viewer: [
    'dashboard',
    'assets',
    'asset-inventory',
    'cbom',
    'cyber-rating',
    'analytics',
  ],
  auditor: [
    'dashboard',
    'assets',
    'asset-inventory',
    'cbom',
    'cyber-rating',
    'analytics',
    'reports',
  ],
  itadmin: [
    'dashboard',
    'assets',
    'asset-inventory',
    'vulnerability-scan',
    'cbom',
    'cyber-rating',
    'analytics',
    'settings',
    'scan',
  ],
};

const ROUTE_PERMISSIONS = {
  '/': ['admin', 'viewer', 'auditor', 'itadmin'],
  '/assets': ['admin', 'viewer', 'auditor', 'itadmin'],
  '/asset-inventory': ['admin', 'viewer', 'auditor', 'itadmin'],
  '/vulnerability-scan': ['admin', 'itadmin'],
  '/cbom': ['admin', 'viewer', 'auditor', 'itadmin'],
  '/cyber-rating': ['admin', 'viewer', 'auditor', 'itadmin'],
  '/analytics': ['admin', 'viewer', 'auditor', 'itadmin'],
  '/reports': ['admin', 'auditor'],
  '/settings': ['admin', 'itadmin'],
};

const ROUTE_FEATURE_MAP = {
  '/': 'dashboard',
  '/assets': 'assets',
  '/asset-inventory': 'asset-inventory',
  '/vulnerability-scan': 'vulnerability-scan',
  '/cbom': 'cbom',
  '/cyber-rating': 'cyber-rating',
  '/analytics': 'analytics',
  '/reports': 'reports',
  '/settings': 'settings',
};

const ROLE_LABELS = {
  admin: 'Administrator',
  viewer: 'Hack2Skill Checker',
  auditor: 'Compliance Auditor',
  itadmin: 'IT Administrator',
};

const DEFAULT_ROLE = 'viewer';

export function normalizeRole(role) {
  return role && ROLE_PERMISSIONS[role] ? role : DEFAULT_ROLE;
}

export function canAccess(role, feature) {
  const normalizedRole = normalizeRole(role);
  return ROLE_PERMISSIONS[normalizedRole].includes(feature);
}

export function canAccessRoute(role, path) {
  const normalizedRole = normalizeRole(role);
  const allowedRoles = ROUTE_PERMISSIONS[path];

  if (!allowedRoles) {
    return normalizedRole === 'admin';
  }

  return allowedRoles.includes(normalizedRole);
}

export function getAccessibleRoutes(role) {
  const normalizedRole = normalizeRole(role);
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, allowedRoles]) => allowedRoles.includes(normalizedRole))
    .map(([path]) => path);
}

export function getFirstAuthorizedRoute(role) {
  const normalizedRole = normalizeRole(role);
  const preferredOrder = [
    '/',
    '/assets',
    '/asset-inventory',
    '/vulnerability-scan',
    '/cbom',
    '/cyber-rating',
    '/analytics',
    '/reports',
    '/settings',
  ];

  return preferredOrder.find((path) => canAccessRoute(normalizedRole, path)) || '/';
}

export function getRouteFeature(path) {
  return ROUTE_FEATURE_MAP[path] || null;
}

export function getRoleLabel(role) {
  const normalizedRole = normalizeRole(role);
  return ROLE_LABELS[normalizedRole] || role || 'Unknown';
}

export { ROLE_PERMISSIONS, ROUTE_PERMISSIONS, ROUTE_FEATURE_MAP, ROLE_LABELS };
