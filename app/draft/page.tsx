'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Player = {
  id: number;
  name: string;
  position: string | null;
  team: string | null;
  selected_count: number;
};

type Counters = { total: number; GK: number; DEF: number; MID: number; FWD: number };

export default function TransfersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mySel, setMySel] = useState<number[]>([]);
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<{ id: number; name: string; position: string | null } | null>(null);

  // Filters
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [posFilter, setPosFilter] = useState<string>('ALL');

  // Load user + username
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      setUser(u);
      if (u) {
        const { data: p } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', u.id)
          .maybeSingle();
        setMyUsername(p?.username ?? null);
      } else {
        setMyUsername(null);
      }
    })();
  }, []);

  // Load players + my selections
  const load = async () => {
    const { data: p, error: pErr } = await supabase.from('players').select('*').order('name');
    if (pErr) { console.error(pErr); alert('Players error: ' + pErr.message); setPlayers([]); }
    else setPlayers(p ?? []);

    const { data: uData } = await supabase.auth.getUser();
    const u = uData?.user;
    if (u) {
      const { data: s, error: sErr } = await supabase.from('selections').select('player_id').eq('user_id', u.id);
      if (!sErr) setMySel((s ?? []).map(r => r.player_id));
    } else {
      setMySel([]);
    }
  };
  useEffect(() => { load(); }, [user]);

  // Realtime refresh
  useEffect(() => {
    const ch1 = supabase
      .channel('players')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, load)
      .subscribe();
    const ch2 = supabase
      .channel('selections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'selections' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [user]);

  const color = (c: number) => (c >= 2 ? 'bg-red' : c === 1 ? 'bg-yellow' : 'bg-green');

  // ---- typed counters (no ts-expect-error)
  const counters: Counters = useMemo(() => {
    const posOnly: Omit<Counters, 'total'> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of players) {
      if (mySel.includes(p.id)) {
        const k = (p.position ?? '').toUpperCase();
        if (k === 'GK' || k === 'DEF' || k === 'MID' || k === 'FWD') {
          const key = k as keyof Omit<Counters, 'total'>;
          posOnly[key] += 1;
        }
      }
    }
    const total = posOnly.GK + posOnly.DEF + posOnly.MID + posOnly.FWD;
    return { total, GK: posOnly.GK, DEF: posOnly.DEF, MID: posOnly.MID, FWD: posOnly.FWD };
  }, [players, mySel]);

  const limits = { GK: 2, DEF: 5, MID: 5, FWD: 3, TOTAL: 15 };

  const requireUsername = () => {
    if (!myUsername) {
      if (confirm('Please set your username first. Go to the Account page now?')) {
        window.location.href = '/account';
      }
      return false;
    }
    return true;
  };

  // Helper: write to feed_events, fallback to posts if needed
  const postToFeed = async (message: string, kind: 'selection_add' | 'swap', playerId: number) => {
    const { error: feErr } = await supabase.from('feed_events').insert({
      kind,
      actor_id: user!.id,
      player_id: playerId,
      message,
    });
    if (feErr) {
      console.error('feed_events insert failed:', feErr);
      await supabase.from('posts').insert({
        user_id: user!.id,
        content: `${kind === 'swap' ? 'transfer' : 'selection'}: ${message}`,
      });
      alert('Note: Event feed didn’t accept the transfer, so a post was added instead.');
    }
  };

  // Select (first-time pick)
  const selectPlayer = async (p: Player) => {
    if (!user) return alert('Please sign in first');
    if (!requireUsername()) return;
    if (p.selected_count >= 2) return alert('That player already has two owners.');
    if (mySel.includes(p.id)) return alert('You already own that player.');
    if (!confirm(`${myUsername} selected ${p.name} — confirm?`)) return;

    const { error } = await supabase.from('selections').insert({ user_id: user.id, player_id: p.id });
    if (error) return alert(error.message);

    await postToFeed(`${myUsername} selected ${p.name}`, 'selection_add', p.id);
  };

  // Start swap (mark who to replace)
  const startSwap = (p: Player) => {
    if (!user) return alert('Please sign in first');
    if (!requireUsername()) return;
    setSwapFrom({ id: p.id, name: p.name, position: p.position ?? null });
  };

  // Confirm replacement (same-position only)
  const pickReplacement = async (newP: Player) => {
    if (!user || !swapFrom) return;
    if (!requireUsername()) return;

    if ((swapFrom.position ?? '') !== (newP.position ?? ''))
      return alert('You can only swap for the same position.');
    if (newP.selected_count >= 2) return alert('That player already has two owners.');
    if (mySel.includes(newP.id)) return alert('You already own that player.');
    if (!confirm(`${myUsername} swapped ${swapFrom.name} for ${newP.name} — confirm?`)) return;

    const { error: rpcErr } = await supabase.rpc('swap_selection', {
      p_user_id: user.id,
      p_old_player_id: swapFrom.id,
      p_new_player_id: newP.id,
    });
    if (rpcErr) return alert(rpcErr.message);

    await postToFeed(`${myUsername} swapped ${swapFrom.name} for ${newP.name}`, 'swap', newP.id);
    setSwapFrom(null);
  };

  const cancelSwap = () => setSwapFrom(null);

  // Filter options and filtered list
  const teamOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) if (p.team) set.add(p.team);
    return Array.from(set).sort();
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      const teamOk = teamFilter === 'ALL' || (p.team ?? '') === teamFilter;
      const posOk = posFilter === 'ALL' || (p.position ?? '').toUpperCase() === posFilter;
      return teamOk && posOk;
    });
  }, [players, teamFilter, posFilter]);

  // Group filtered players by position in GK → DEF → MID → FWD order (A→Z inside)
  const grouped = useMemo(() => {
    const g: Record<'GK' | 'DEF' | 'MID' | 'FWD', Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of filteredPlayers) {
      const k = (p.position ?? '').toUpperCase() as 'GK' | 'DEF' | 'MID' | 'FWD';
      if (k in g) g[k].push(p);
    }
    (['GK','DEF','MID','FWD'] as const).forEach(k => g[k].sort((a,b)=>a.name.localeCompare(b.name)));
    return g;
  }, [filteredPlayers]);

  // Eligible replacements when in swap mode
  const eligibleReplacementIds = useMemo(() => {
    if (!swapFrom) return new Set<number>();
    const ids = new Set<number>();
    for (const p of players) {
      const samePos = (p.position ?? '') === (swapFrom.position ?? '');
      const hasRoom = p.selected_count < 2;
      const notMine = !mySel.includes(p.id);
      if (samePos && hasRoom && notMine) ids.add(p.id);
    }
    return ids;
  }, [swapFrom, players, mySel]);

  // Render a position section
  const renderSection = (label: 'GK'|'DEF'|'MID'|'FWD', list: Player[]) => {
    if (list.length === 0) return null;
    return (
      <div key={label} style={{display:'grid', gap:8}}>
        <div className="card" style={{fontWeight:600}}>{label}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12 }}>
          {list.map((p) => {
            const mine = mySel.includes(p.id);
            const isEligible = swapFrom ? eligibleReplacementIds.has(p.id) : false;
            return (
              <div
                key={p.id}
                className={`card ${color(p.selected_count)}`}
                style={{ opacity: swapFrom && !mine && !isEligible ? 0.5 : 1 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="badge">{[p.team, p.position].filter(Boolean).join(' · ')}</div>
                    <div className="badge" style={{ marginTop: 4 }}>Selected: {p.selected_count}/2</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {!mine && !swapFrom && p.selected_count < 2 && (
                      <button className="btn" onClick={() => selectPlayer(p)}>Select</button>
                    )}
                    {mine && !swapFrom && (
                      <button className="btn secondary" onClick={() => startSwap(p)}>Swap out</button>
                    )}
                    {swapFrom && isEligible && (
                      <button className="btn" onClick={() => pickReplacement(p)}>Pick as replacement</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Transfers</h1>

      {/* Counter bar */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div><strong>Squad:</strong> {counters.total}/{limits.TOTAL}</div>
        <div className="badge">GK {counters.GK}/{limits.GK}</div>
        <div className="badge">DEF {counters.DEF}/{limits.DEF}</div>
        <div className="badge">MID {counters.MID}/{limits.MID}</div>
        <div className="badge">FWD {counters.FWD}/{limits.FWD}</div>
        {swapFrom && <div className="badge">Swap mode: {swapFrom.name} ({swapFrom.position})</div>}
      </div>

      {/* Filters */}
      <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>Team</label>
          <select className="input" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="ALL">All teams</option>
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>Position</label>
          <select className="input" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
            <option value="ALL">All positions</option>
            <option value="GK">GK</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="FWD">FWD</option>
          </select>
        </div>
        {(teamFilter !== 'ALL' || posFilter !== 'ALL') && (
          <button className="btn secondary" onClick={() => { setTeamFilter('ALL'); setPosFilter('ALL'); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Swap notice */}
      {swapFrom && (
        <div className="card" style={{ borderColor: '#60a5fa', background: '#eff6ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Swap mode</div>
              <div className="badge">Choose a replacement for <strong>{swapFrom.name}</strong> ({swapFrom.position}).</div>
            </div>
            <button className="btn secondary" onClick={cancelSwap}>Cancel</button>
          </div>
        </div>
      )}

      {/* Sections: GK → DEF → MID → FWD */}
      {renderSection('GK',  grouped.GK)}
      {renderSection('DEF', grouped.DEF)}
      {renderSection('MID', grouped.MID)}
      {renderSection('FWD', grouped.FWD)}
    </div>
  );
}