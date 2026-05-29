import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuthStore } from "../store/authStore";

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");

  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => {
    api.get("/users/me/profile").then(({ data }) => {
      setEmail(data.user.email);
      setUsername(data.user.username);
      const d = new Date(data.user.created_at);
      setCreatedAt(d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
    }).catch(() => {});
  }, []);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    setProfileLoading(true);
    try {
      const body: Record<string, string> = {};
      if (email !== user?.email) body.email = email;
      if (username !== user?.username) body.username = username;
      if (Object.keys(body).length === 0) {
        setProfileErr("No changes to save");
        setProfileLoading(false);
        return;
      }
      const { data } = await api.put("/users/me/profile", body);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      useAuthStore.setState({ user: data.user });
      setProfileMsg("Profile updated");
    } catch (err: any) {
      setProfileErr(err.response?.data?.error || "Update failed");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg("");
    setPasswordErr("");
    if (cpNew.length < 8) { setPasswordErr("Password must be at least 8 characters"); return; }
    if (cpNew !== cpConfirm) { setPasswordErr("Passwords do not match"); return; }
    setPasswordLoading(true);
    try {
      await api.put("/users/me/password", { current_password: cpCurrent, new_password: cpNew });
      setPasswordMsg("Password changed");
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
    } catch (err: any) {
      setPasswordErr(err.response?.data?.error || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteErr("");
    if (deleteConfirm !== "DELETE") { setDeleteErr("Type DELETE to confirm"); return; }
    try {
      await api.delete("/users/me/account");
      logout();
      navigate("/login");
    } catch (err: any) {
      setDeleteErr(err.response?.data?.error || "Failed to delete account");
    }
  };

  return (
    <div className="min-h-screen bg-surface-950" style={{ color: '#f4f4f5' }}>
      <header className="border-b border-surface-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <button onClick={() => navigate("/dashboard")} className="text-sm transition-colors" style={{ color: '#a1a1aa' }}>Back to Dashboard</button>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-10">
        {/* Edit Profile */}
        <section>
          <h2 className="text-lg font-medium mb-1">Edit Profile</h2>
          {createdAt && <p className="text-xs mb-4" style={{ color: '#71717a' }}>Member since {createdAt}</p>}
          <form onSubmit={handleProfile} className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: '#a1a1aa' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg placeholder-surface-500 focus:outline-none focus:border-blue-500 text-sm" style={{ color: '#f4f4f5' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: '#a1a1aa' }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg placeholder-surface-500 focus:outline-none focus:border-blue-500 text-sm" style={{ color: '#f4f4f5' }} />
            </div>
            {profileMsg && <p className="text-sm" style={{ color: '#22c55e' }}>{profileMsg}</p>}
            {profileErr && <p className="text-sm" style={{ color: '#ef4444' }}>{profileErr}</p>}
            <button type="submit" disabled={profileLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 rounded-lg text-sm transition-colors" style={{ color: '#ffffff' }}>
              {profileLoading ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        {/* Change Password */}
        <section>
          <h2 className="text-lg font-medium mb-4">Change Password</h2>
          <form onSubmit={handlePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm mb-1" style={{ color: '#a1a1aa' }}>Current password</label>
              <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg placeholder-surface-500 focus:outline-none focus:border-blue-500 text-sm" style={{ color: '#f4f4f5' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: '#a1a1aa' }}>New password</label>
              <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} required
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg placeholder-surface-500 focus:outline-none focus:border-blue-500 text-sm" style={{ color: '#f4f4f5' }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: '#a1a1aa' }}>Confirm new password</label>
              <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} required
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg placeholder-surface-500 focus:outline-none focus:border-blue-500 text-sm" style={{ color: '#f4f4f5' }} />
            </div>
            {passwordMsg && <p className="text-sm" style={{ color: '#22c55e' }}>{passwordMsg}</p>}
            {passwordErr && <p className="text-sm" style={{ color: '#ef4444' }}>{passwordErr}</p>}
            <button type="submit" disabled={passwordLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 rounded-lg text-sm transition-colors" style={{ color: '#ffffff' }}>
              {passwordLoading ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="border border-red-900/50 rounded-lg p-5">
          <h2 className="text-lg font-medium mb-1" style={{ color: '#ef4444' }}>Danger Zone</h2>
          <p className="text-sm mb-4" style={{ color: '#a1a1aa' }}>Permanently delete your account and all associated data.</p>
          <div className="space-y-3">
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="w-full max-w-xs px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg placeholder-surface-500 focus:outline-none focus:border-red-500 text-sm" style={{ color: '#f4f4f5' }} />
            {deleteErr && <p className="text-sm" style={{ color: '#ef4444' }}>{deleteErr}</p>}
            <button onClick={handleDelete} disabled={deleteConfirm !== "DELETE"}
              className="block px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-surface-700 rounded-lg text-sm transition-colors" style={{ color: '#ffffff' }}>
              Delete my account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
