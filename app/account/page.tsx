'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Account() {
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      setUser(u);

      if (u) {
        const { data: p } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', u.id)
          .maybeSingle();
        if (p?.username) setUsername(p.username);
      }
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Please sign in first');
    const name = username.trim();
    if (!name) return alert('Please enter a username');

    // Optional: very simple validation
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) {
      return alert('Use 3–20 letters, numbers or underscores.');
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username: name });
    if (error) return alert(error.message);
    alert('Saved!');
  };

  if (loading) return <div>Loading…</div>;
  if (!user) return <div>Please sign in on the home page first.</div>;

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>Account</h2>
      <form onSubmit={save} style={{ display: 'grid', gap: 8 }}>
        <label>Username</label>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. SamTheManager"
          required
        />
        <button className="btn">Save</button>
      </form>
    </div>
  );
}
