'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type View = 'signin' | 'signup';

export default function AuthBox() {
  const [view, setView] = useState<View>('signin');
  const [user, setUser] = useState<any>(null);

  // Sign in form
  const [identifier, setIdentifier] = useState(''); // username OR email
  const [password, setPassword] = useState('');

  // Sign up form
  const [suUsername, setSuUsername] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const normalize = (s: string) => s.trim();

  // ---------- Sign in (username OR email + password) ----------
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let email = normalize(identifier);

      // If it doesn't look like an email, treat as username → look up email in profiles
      if (!email.includes('@')) {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', email)
          .maybeSingle();
        if (error) throw error;
        if (!data?.email) {
          alert('No account found for that username.');
          return;
        }
        email = data.email;
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authErr) {
        alert(authErr.message);
        return;
      }
      setIdentifier('');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  // ---------- Sign up (ensures auth before upsert to profiles) ----------
  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const username = normalize(suUsername);
      const email = normalize(suEmail);

      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        alert('Username must be 3–20 chars: letters, numbers, underscores.');
        return;
      }

      // 1) Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password: suPassword,
      });
      if (error) { alert(error.message); return; }

      // 2) If email confirmations are ON, there may be no session yet.
      //    Ensure we are authenticated before upserting to profiles (required by RLS).
      if (!data.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password: suPassword,
        });
        if (signInErr) {
          alert('Signed up, but need to sign in before saving username: ' + signInErr.message);
          return;
        }
      }

      // 3) Upsert username + email into profiles (trigger created the row on sign-up)
      const { data: udata } = await supabase.auth.getUser();
      const uid = udata?.user?.id;
      if (uid) {
        const { error: upErr } = await supabase
          .from('profiles')
          .upsert({ id: uid, username, email }, { onConflict: 'id' });
        if (upErr) {
          alert('Signed up, but failed to save username: ' + upErr.message);
          return;
        }
      }

      alert('Account created! You can now sign in.');
      setView('signin');
      setSuUsername('');
      setSuEmail('');
      setSuPassword('');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (user) {
    return (
      <div className="card" style={{display:'flex',gap:8,alignItems:'center',justifyContent:'space-between'}}>
        <div>Signed in</div>
        <div style={{display:'flex',gap:8}}>
          <a className="btn secondary" href="/account">Account</a>
          <button className="btn secondary" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{display:'grid',gap:12}}>
      <div style={{display:'flex',gap:8}}>
        <button
          className="btn secondary"
          onClick={() => setView('signin')}
          style={{opacity: view==='signin' ? 1 : 0.6}}
        >
          Sign in
        </button>
        <button
          className="btn secondary"
          onClick={() => setView('signup')}
          style={{opacity: view==='signup' ? 1 : 0.6}}
        >
          Sign up
        </button>
      </div>

      {view === 'signin' ? (
        <form onSubmit={signIn} style={{display:'grid',gap:8}}>
          <label>Username or email</label>
          <input
            className="input"
            value={identifier}
            onChange={(e)=>setIdentifier(e.target.value)}
            placeholder="yourname or you@example.com"
            required
          />
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />
          <button className="btn" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
        </form>
      ) : (
        <form onSubmit={signUp} style={{display:'grid',gap:8}}>
          <label>Username</label>
          <input
            className="input"
            value={suUsername}
            onChange={(e)=>setSuUsername(e.target.value)}
            placeholder="yourname"
            required
          />
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={suEmail}
            onChange={(e)=>setSuEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={suPassword}
            onChange={(e)=>setSuPassword(e.target.value)}
            minLength={6}
            required
          />
          <button className="btn" disabled={busy}>{busy ? 'Please wait…' : 'Create account'}</button>
        </form>
      )}
    </div>
  );
}
