import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { getRoleLabel } from '../utils/roleAccess';

const API = 'http://localhost:8000';

const Card = ({ title, description, children }) => (
  <section className="rounded-3xl border border-outline-variant/20 bg-surface shadow-sm overflow-hidden">
    <div className="p-6 border-b border-outline-variant/10">
      <h2 className="text-lg font-black text-on-surface">{title}</h2>
      <p className="text-sm text-on-surface-variant mt-1">{description}</p>
    </div>
    <div className="p-6">{children}</div>
  </section>
);

const Field = ({ label, type = 'text', value, onChange, placeholder, autoComplete }) => (
  <label className="block">
    <span className="block text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant mb-2">{label}</span>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
    />
  </label>
);

export default function Settings() {
  const { token, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [logoutStatus, setLogoutStatus] = useState(null);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingLogoutAll, setLoadingLogoutAll] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminDb, setAdminDb] = useState(null);
  const [adminError, setAdminError] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const roleLabel = useMemo(() => getRoleLabel(user?.role), [user?.role]);
  const isAdmin = user?.role === 'admin';

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setLoadingPassword(true);
    try {
      const res = await fetch(`${API}/auth/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not update password.');
      }

      setPasswordStatus({ type: 'success', text: data.message || 'Password updated successfully. Please log in again.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1000);
    } catch (err) {
      setPasswordStatus({ type: 'error', text: err.message });
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setEmailStatus(null);
    setLoadingEmail(true);
    try {
      const res = await fetch(`${API}/auth/me/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
          body: JSON.stringify({
            new_email: newEmail,
            password: emailPassword,
          }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not update email.');
      }
      setEmailStatus({ type: 'success', text: 'Profile email updated successfully.' });
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1000);
      setEmailPassword('');
    } catch (err) {
      setEmailStatus({ type: 'error', text: err.message });
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleLogoutAll = async () => {
    setLogoutStatus(null);
    setLoadingLogoutAll(true);
    try {
      const res = await fetch(`${API}/auth/me/logout-all`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not log out sessions.');
      }
      setLogoutStatus({ type: 'success', text: data.message || 'All sessions have been logged out.' });
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 800);
    } catch (err) {
      setLogoutStatus({ type: 'error', text: err.message });
    } finally {
      setLoadingLogoutAll(false);
    }
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setAdminError(null);
    setAdminLoading(true);
    try {
      const [usersRes, dbRes] = await Promise.all([
        fetch(`${API}/auth/admin/users`, { headers: authHeaders }),
        fetch(`${API}/auth/admin/database`, { headers: authHeaders }),
      ]);

      const usersData = await usersRes.json().catch(() => ({}));
      const dbData = await dbRes.json().catch(() => ({}));

      if (!usersRes.ok) {
        throw new Error(usersData.detail || 'Failed to load users.');
      }
      if (!dbRes.ok) {
        throw new Error(dbData.detail || 'Failed to load database overview.');
      }

      setAdminUsers(usersData || []);
      setAdminDb(dbData || null);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    setRoleSavingId(userId);
    setAdminError(null);
    try {
      const res = await fetch(`${API}/auth/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not update role.');
      }
      setAdminUsers((prev) => prev.map((item) => (item.id === userId ? data : item)));
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setRoleSavingId(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    const target = adminUsers.find((item) => item.id === userId);
    if (!target) return;
    if (!window.confirm(`Delete ${target.email}? This cannot be undone.`)) return;

    setDeletingId(userId);
    setAdminError(null);
    try {
      const res = await fetch(`${API}/auth/admin/users/${userId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not delete user.');
      }
      setAdminUsers((prev) => prev.filter((item) => item.id !== userId));
      setAdminDb((prev) => prev ? { ...prev, users: Math.max(0, (prev.users || 0) - 1) } : prev);
    } catch (err) {
      setAdminError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-on-surface-variant/50">Settings</p>
        <h1 className="mt-2 text-3xl font-black text-on-surface">Account settings</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Manage your profile, password, and sign-in sessions.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Current account"
          description="See the basic account details tied to your session."
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-container px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">Email</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">{user?.email || 'Unknown'}</p>
            </div>
            <div className="rounded-2xl bg-surface-container px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">Role</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">{roleLabel}</p>
            </div>
          </div>
        </Card>

        <Card
          title="Update profile email"
          description="Change the email tied to your account. Current password required."
        >
          <form onSubmit={handleEmailChange} className="space-y-4">
            <Field
              label="New email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
            <Field
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />

            {emailStatus && (
              <div className={`rounded-2xl px-4 py-3 text-sm ${emailStatus.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
                {emailStatus.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingEmail}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-95 disabled:opacity-60"
            >
              {loadingEmail ? 'Updating…' : 'Update email'}
            </button>
          </form>
        </Card>

        <Card
          title="Change password"
          description="Use a strong password and keep it private."
        >
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Field
              label="Current password"
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
            />
            <Field
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
            />
            <Field
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />

            {passwordStatus && (
              <div className={`rounded-2xl px-4 py-3 text-sm ${passwordStatus.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
                {passwordStatus.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingPassword}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-95 disabled:opacity-60"
            >
              {loadingPassword ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </Card>

        <Card
          title="Session controls"
          description="Sign out every active session for this account."
        >
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              This will invalidate the current session and any other signed-in devices.
            </p>

            {logoutStatus && (
              <div className={`rounded-2xl px-4 py-3 text-sm ${logoutStatus.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
                {logoutStatus.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogoutAll}
              disabled={loadingLogoutAll}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
            >
              {loadingLogoutAll ? 'Logging out…' : 'Logout all sessions'}
            </button>
          </div>
        </Card>
      </div>

      {isAdmin && (
        <section className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-black text-on-surface">Admin control panel</h2>
              <p className="text-sm text-on-surface-variant mt-1">Manage users, roles, and database overview from one place.</p>
            </div>
            <button
              type="button"
              onClick={loadAdminData}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-95"
            >
              {adminLoading ? 'Loading…' : 'Refresh admin data'}
            </button>
          </div>

          {adminError && (
            <div className="rounded-2xl bg-red-500/10 text-red-700 px-4 py-3 text-sm">
              {adminError}
            </div>
          )}

          <div className="space-y-6">
            <Card
              title="Database overview"
              description="Quick view of tables, users, and role distribution."
            >
              {adminDb ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-surface-container px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">Tables</p>
                    <p className="mt-1 text-sm font-semibold text-on-surface">{(adminDb.tables || []).join(', ') || 'None'}</p>
                  </div>
                  <div className="rounded-2xl bg-surface-container px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">Users</p>
                    <p className="mt-1 text-sm font-semibold text-on-surface">{adminDb.users ?? 0}</p>
                  </div>
                  {Object.entries(adminDb.roles || {}).map(([role, count]) => (
                    <div key={role} className="rounded-2xl bg-surface-container px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">{getRoleLabel(role)}</p>
                      <p className="mt-1 text-sm font-semibold text-on-surface">{count}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant">Click “Refresh admin data” to load database stats.</p>
              )}
            </Card>

            <Card
              title="User management"
              description="Change roles or remove users from the database."
            >
              {adminUsers.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No users loaded yet. Refresh admin data to begin.</p>
              ) : (
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <div className="max-h-[540px] overflow-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-surface">
                        <tr className="border-b border-outline-variant/15">
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">User</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">Role</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">2FA</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10 bg-surface-container">
                        {adminUsers.map((item) => (
                          <tr key={item.id} className="hover:bg-surface/70 transition-colors">
                            <td className="px-4 py-3 align-top">
                              <p className="text-sm font-bold text-on-surface">{item.email}</p>
                              <p className="text-[11px] text-on-surface-variant mt-1">ID {item.id}</p>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <select
                                value={item.role}
                                onChange={(e) => handleRoleChange(item.id, e.target.value)}
                                disabled={roleSavingId === item.id || item.email === user?.email}
                                className="w-full min-w-[150px] rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-sm"
                              >
                                <option value="admin">Admin</option>
                                <option value="viewer">Viewer</option>
                                <option value="auditor">Auditor</option>
                                <option value="itadmin">IT Admin</option>
                              </select>
                              {item.email === user?.email && (
                                <p className="mt-2 text-[11px] text-on-surface-variant">Your own role is locked while you are signed in.</p>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${item.totp_enabled ? 'bg-green-500/10 text-green-700' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                {item.totp_enabled ? 'Enabled' : 'Off'}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(item.id)}
                                disabled={deletingId === item.id || item.email === user?.email}
                                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {deletingId === item.id ? 'Deleting�' : item.email === user?.email ? 'Current user' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </section>
      )}

    </div>
  );
}

