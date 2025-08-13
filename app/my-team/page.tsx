'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AuthBox from '@/components/AuthBox';

type Player = {
  id: number;
  name: string;
  position: string | null;
  team: string | null;
};

export default function MyTeamPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);

  // who am i?
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  // load my selected players
  const load = async () => {
    if (!user) {
      setMyPlayers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1) get my selection rows (player IDs)
    const selRes = await supabase
      .from('selections')
      .select('player_id')
      .eq('user_id', user.id);

    if (selRes.error) {
      console.error('[selections] error:', selRes.error);
      setMyPlayers([]);
      setLoading(false);
      return;
    }

    const ids = (selRes.data ?? []).map((r) => r.player_id);
    if (ids.length === 0) {
      setMyPlayers([]);
      setLoading(false);
      return;
    }

    // 2) fetch those players
    const plRes = await supabase
      .from('players')
      .select('id, name, position, team')
      .in('id', ids);

    if (plRes.error) {
      console.error('[players] error:', plRes.error);
      setMyPlayers([]);
      setLoading(false);
      return;
    }

    setMyPlayers((plRes.data ?? []) as Player[]);
    setLoading(false);
  };

  // initial + realtime refresh when my selections/players change
  useEffect(() => {
    load();

    const ch1 = supabase
      .channel('selections-my-team')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'selections' }, load)
      .subscribe();

    const ch2 = supabase
      .channel('players-my-team')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // group + sort
  const grouped = useMemo(() => {
    const g: Record<'GK' | 'DEF' | 'MID' | 'FWD', Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of myPlayers) {
      const k = (p.position ?? '').toUpperCase();
      if (k === 'GK' || k === 'DEF' || k === 'MID' || k === 'FWD') {
        g[k].push(p);
      }
    }
    (['GK', 'DEF', 'MID', 'FWD'] as const).forEach((k) =>
      g[k].sort((a, b) => a.name.localeCompare(b.name))
    );
    return g;
  }, [myPlayers]);

  const totals = useMemo(() => {
    const t = { GK: grouped.GK.length, DEF: grouped.DEF.length, MID: grouped.MID.length, FWD: grouped.FWD.length };
    return { ...t, TOTAL: t.GK + t.DEF + t.MID + t.FWD };
  }, [grouped]);

  const Section = ({ title, list }: { title: string; list: Player[] }) => {
    if (list.length === 0) return null;
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="card" style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {list.map((p) => (
            <div key={p.id} className="card">
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="badge">{[p.team, p.position].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <AuthBox />

      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>My Team</h1>

      {!user && <div className="card">Please sign in to view your team.</div>}

      {user && (
        <>
          {/* header with counts */}
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div><strong>Squad:</strong> {totals.TOTAL}/15</div>
            <div className="badge">GK {totals.GK}/2</div>
            <div className="badge">DEF {totals.DEF}/5</div>
            <div className="badge">MID {totals.MID}/5</div>
            <div className="badge">FWD {totals.FWD}/3</div>
          </div>

          {loading ? (
            <div>Loading…</div>
          ) : myPlayers.length === 0 ? (
            <div className="card">You haven’t selected any players yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <Section title="Goalkeepers" list={grouped.GK} />
              <Section title="Defenders"   list={grouped.DEF} />
              <Section title="Midfielders" list={grouped.MID} />
              <Section title="Forwards"    list={grouped.FWD} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
