'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AuthBox from '@/components/AuthBox';

type AnyRow = Record<string, any>;

type FeedItem =
  | { type: 'event'; id: string; created_at: string; username: string; text: string; raw: AnyRow; mine: boolean }
  | { type: 'post';  id: string; created_at: string; username: string; text: string; raw: AnyRow; mine: boolean };

export default function ActivityFeedPage() {
  const [user, setUser] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const load = async () => {
    setLoading(true);

    // ---- POSTS (very permissive select) ----
    const postsRes = await supabase
      .from('posts')
      .select('*')            // ← no column list (avoid 400s)
      .order('created_at', { ascending: false })
      .limit(100);

    if (postsRes.error) {
      console.error('[posts] select error:', postsRes.error);
    }

    // ---- FEED EVENTS (very permissive select) ----
    const eventsRes = await supabase
      .from('feed_events')
      .select('*')            // ← no column list (avoid 400s)
      .order('created_at', { ascending: false })
      .limit(100);

    if (eventsRes.error) {
      console.error('[feed_events] select error:', eventsRes.error);
    }

    const posts = postsRes.data ?? [];
    const events = eventsRes.data ?? [];

    // Build lightweight username map (best effort)
    const ids = new Set<string>();
    posts.forEach((p: AnyRow) => p.user_id && ids.add(p.user_id));
    events.forEach((e: AnyRow) => e.actor_id && ids.add(e.actor_id));

    let nameById: Record<string, string> = {};
    if (ids.size > 0) {
      const profRes = await supabase.from('profiles').select('id, username').in('id', Array.from(ids));
      if (profRes.error) {
        console.warn('[profiles] select error (will show Unknown usernames):', profRes.error);
      } else {
        nameById = Object.fromEntries((profRes.data ?? []).map((r: AnyRow) => [r.id, r.username ?? 'Unknown']));
      }
    }

    const uid = user?.id ?? '';

    const postItems: FeedItem[] = posts.map((p: AnyRow) => ({
      type: 'post',
      id: `post:${p.id}`,
      created_at: p.created_at ?? new Date(0).toISOString(),
      username: nameById[p.user_id] ?? 'Unknown',
      text: p.content ?? p.message ?? '',         // support either column name
      raw: p,
      mine: p.user_id === uid,
    }));

    const eventItems: FeedItem[] = events.map((e: AnyRow) => ({
      type: 'event',
      id: `event:${e.id}`,
      created_at: e.created_at ?? new Date(0).toISOString(),
      username: e.actor_id ? (nameById[e.actor_id] ?? 'Unknown') : 'System',
      text: e.message ?? '',
      raw: e,
      mine: false,
    }));

    const merged = [...postItems, ...eventItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setItems(merged);
    setLoading(false);
  };

  // Initial + realtime refresh
  useEffect(() => {
    load();

    const ch1 = supabase
      .channel('posts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, load)
      .subscribe();

    const ch2 = supabase
      .channel('events-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_events' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Composer: Enter submits; Shift+Enter = newline
  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitPost();
    }
  };

  const submitPost = async () => {
    if (!user) return alert('Please sign in first.');
    const content = draft.trim();
    if (!content) return;
    setPosting(true);
    const { error } = await supabase.from('posts').insert({ user_id: user.id, content });
    setPosting(false);
    if (error) {
      console.error('[posts] insert error:', error);
      return alert(error.message);
    }
    setDraft('');
  };

  // Editing
  const startEdit = (it: FeedItem) => {
    if (it.type !== 'post' || !it.mine) return;
    setEditingId(it.id);
    setEditingText(it.text);
  };
  const cancelEdit = () => { setEditingId(null); setEditingText(''); };
  const saveEdit = async (it: FeedItem) => {
    if (it.type !== 'post' || !it.mine) return;
    const postId = (it.raw as AnyRow).id;
    const content = editingText.trim();
    if (!content) return alert('Post cannot be empty.');
    const { error } = await supabase.from('posts').update({ content }).eq('id', postId);
    if (error) {
      console.error('[posts] update error:', error);
      return alert(error.message);
    }
    cancelEdit();
  };

  const kindLabel = (k: string) =>
    k === 'swap' ? 'transfer'
      : k === 'selection_add' ? 'selection'
      : k === 'selection_remove' ? 'removal'
      : k ?? 'event';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <AuthBox />

      {/* Composer */}
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <label style={{ fontSize: 12, opacity: 0.7 }}>
          Write a post (Enter to send, Shift+Enter for a new line)
        </label>
        <textarea
          className="input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onComposerKey}
          placeholder="Share an update with the league…"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={submitPost} disabled={posting}>
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {/* Feed */}
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Activity feed</h1>

      {loading ? (
        <div>Loading…</div>
      ) : items.length === 0 ? (
        <div className="card">No activity yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {items.map((it) => (
            <li key={it.id} className="card">
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {it.username} · {new Date(it.created_at).toLocaleString()}
                </div>

                {it.type === 'event' ? (
                  <div>
                    <strong>{kindLabel((it.raw as AnyRow).kind)}</strong>: {it.text}
                  </div>
                ) : editingId === it.id ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <textarea
                      className="input"
                      rows={3}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit(it);
                        }
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn secondary" onClick={cancelEdit}>Cancel</button>
                      <button className="btn" onClick={() => saveEdit(it)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{it.text}</div>
                )}

                {it.type === 'post' && it.mine && editingId !== it.id && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn secondary" onClick={() => startEdit(it)}>Edit</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
