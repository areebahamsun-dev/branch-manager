"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  SECTIONS,
  DAYS,
  TOTAL_CELLS,
  buildDays,
  mondayOf,
  iso,
  parseISO,
  weekRange,
  keyOf,
  countDone,
} from "@/lib/checklist";

type Row = {
  id?: string;
  branch: string;
  manager: string | null;
  week_start: string;
  data: Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
};

const META_KEY = "hamsun-bm-checklist:meta";
const WEEK_KEY = "hamsun-bm-checklist:week";
const localKey = (b: string, w: string) => `hamsun-bm-checklist:${b}:${w}`;
const branchKey = (b: string) => b.trim() || "General";

function readWeek(): string {
  try {
    return localStorage.getItem(WEEK_KEY) || iso(mondayOf(new Date()));
  } catch {
    return iso(mondayOf(new Date()));
  }
}

function loadLocal(b: string, w: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(localKey(branchKey(b), w)) || "{}");
  } catch {
    return {};
  }
}

function readMeta(): { branch?: string; manager?: string } {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeMeta(branch: string, manager: string) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ branch, manager }));
  } catch {
    /* ignore */
  }
}

function ChecklistGrid({
  data,
  days,
  today,
  readOnly = false,
  onToggle,
}: {
  data: Record<string, boolean>;
  days: { label: string; number: number; date: Date }[];
  today?: string;
  readOnly?: boolean;
  onToggle?: (si: number, ri: number, di: number) => void;
}) {
  const isLockedDay = (di: number) => (today ? iso(days[di].date) < today : false);
  return (
    <>
      {SECTIONS.map((sec, si) => (
        <table key={si}>
          <thead>
            <tr>
              <th>{sec.title}</th>
              {days.map((d, di) => (
                <th className="day" key={di}>
                  {d.label}
                  <small>{d.number}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sec.rows.map((r, ri) => (
              <tr key={ri}>
                <td className="name">{r}</td>
                {DAYS.map((_, di) => {
                  const k = keyOf(si, ri, di);
                  const on = !!data[k];
                  const locked = readOnly || isLockedDay(di);
                  return (
                    <td
                      key={di}
                      className={`cell${on ? " on" : ""}${locked ? " readonly" : ""}`}
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`${r}, ${DAYS[di]} ${days[di].number}`}
                      tabIndex={locked ? -1 : 0}
                      onClick={locked || !onToggle ? undefined : () => onToggle(si, ri, di)}
                      onKeyDown={
                        locked || !onToggle
                          ? undefined
                          : (e) => {
                              if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                onToggle(si, ri, di);
                              }
                            }
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </>
  );
}

export default function Page() {
  const supabase = useMemo(() => createClient(), []);
  const [branchLive, setBranchLive] = useState(() => readMeta().branch ?? "");
  const [branch, setBranch] = useState(() => (readMeta().branch ?? "").trim() || "");
  const [manager, setManager] = useState(() => readMeta().manager ?? "");
  const [weekStart, setWeekStart] = useState<string>(readWeek);
  const [data, setData] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [sync, setSync] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [today] = useState(() => iso(new Date()));

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<Record<string, boolean>>(data);
  const managerRef = useRef(manager);
  const restoredRef = useRef(false);

  const days = useMemo(() => buildDays(parseISO(weekStart)), [weekStart]);
  const done = useMemo(() => countDone(data), [data]);
  const hasLocked = useMemo(() => days.some((d) => iso(d.date) < today), [days, today]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(""), 2200);
  }, []);

  function commitData(next: Record<string, boolean>) {
    dataRef.current = next;
    setData(next);
  }

  useEffect(() => {
    let cancelled = false;
    const b = branchKey(branch);
    (async () => {
      const { data: rows } = await supabase
        .from("weekly_checklists")
        .select("id, branch, manager, week_start, data, created_at, updated_at")
        .eq("branch", b)
        .order("week_start", { ascending: false })
        .limit(200);
      if (!cancelled && rows) setHistory(rows as unknown as Row[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [branch, supabase]);

  const saveNow = useCallback(() => {
    const b = branchKey(branch);
    const d = dataRef.current;
    const m = managerRef.current;
    const row = { branch: b, manager: m, week_start: weekStart, data: d };
    try {
      localStorage.setItem(localKey(b, weekStart), JSON.stringify(d));
    } catch {
      /* ignore */
    }
    setSync("saving");
    supabase
      .from("weekly_checklists")
      .upsert(row, { onConflict: "branch,week_start" })
      .then(({ error }) => {
        setSync(error ? "offline" : "saved");
        if (error) toast("Saved on this device only (sync pending)");
      });
    setHistory((prev) => {
      const i = prev.findIndex((r) => r.branch === b && r.week_start === weekStart);
      if (i === -1) return [{ ...row, id: "" }, ...prev];
      const copy = [...prev];
      copy[i] = { ...copy[i], data: d, manager: m };
      return copy;
    });
  }, [branch, weekStart, toast, supabase]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      saveNow();
    }
  }, [saveNow]);

  const queueSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 250);
  }, [saveNow]);

  useEffect(() => {
    let cancelled = false;
    const b = branchKey(branch);
    (async () => {
      const localData = loadLocal(b, weekStart);
      const { data: row } = await supabase
        .from("weekly_checklists")
        .select("data")
        .eq("branch", b)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (cancelled) return;
      const resolved = (row?.data as Record<string, boolean> | undefined) ?? localData;
      dataRef.current = resolved;
      setData(resolved);
      if (!row && Object.keys(resolved).length > 0) {
        if (!restoredRef.current) {
          restoredRef.current = true;
          toast("Restored from this device — syncing back up");
        }
        queueSave();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branch, weekStart, supabase, queueSave, toast]);

  function goToWeek(v: string) {
    flushSave();
    setWeekStart(v);
    try {
      localStorage.setItem(WEEK_KEY, v);
    } catch {
      /* ignore */
    }
  }

  function toggle(si: number, ri: number, di: number) {
    const k = keyOf(si, ri, di);
    const next = { ...dataRef.current };
    if (next[k]) delete next[k];
    else next[k] = true;
    commitData(next);
    try {
      localStorage.setItem(localKey(branchKey(branch), weekStart), JSON.stringify(next));
    } catch {
      /* ignore */
    }
    queueSave();
  }

  useEffect(() => {
    const flush = () => flushSave();
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  });

  function onBranchInput(v: string) {
    setBranchLive(v);
    writeMeta(v, managerRef.current);
    if (branchTimer.current) clearTimeout(branchTimer.current);
    branchTimer.current = setTimeout(() => {
      flushSave();
      setBranch(v.trim());
    }, 600);
  }

  function onManagerInput(v: string) {
    managerRef.current = v;
    setManager(v);
    writeMeta(branchLive, v);
  }

  function clearWeek() {
    if (!confirm("Clear all ticks for this week?")) return;
    commitData({});
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveNow();
    toast("Week cleared");
  }

  function loadRecord(r: Row) {
    flushSave();
    const b = r.branch === "General" ? "" : r.branch;
    managerRef.current = r.manager || "";
    setBranchLive(b);
    setBranch(r.branch);
    setManager(r.manager || "");
    goToWeek(r.week_start);
    setExpanded(null);
    writeMeta(b, r.manager || "");
  }

  return (
    <>
      <div className="controls">
        <label className="week">
          Week starting (Monday)
          <input
            type="date"
            value={weekStart}
            onChange={(e) => goToWeek(e.target.value || weekStart)}
          />
        </label>
        <label>
          Branch
          <input
            type="text"
            value={branchLive}
            onChange={(e) => onBranchInput(e.target.value)}
            placeholder="e.g. FSL"
            autoComplete="off"
          />
        </label>
        <label>
          Branch manager
          <input
            type="text"
            value={manager}
            onChange={(e) => onManagerInput(e.target.value)}
            placeholder="Name"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="sheet">
        <div className="sheet-head">
          <h1>Checklist</h1>
          <div className="sub">
            <span>For the Branch Manager</span>
          </div>
        </div>
        <div className="sheet-meta">
          <div>
            Branch: <b>{branchLive.trim() || "—"}</b>
          </div>
          <div>
            Manager: <b>{manager.trim() || "—"}</b>
          </div>
          <div>
            Week: <b>{weekRange(parseISO(weekStart))}</b>
          </div>
        </div>
        <ChecklistGrid data={data} days={days} today={today} onToggle={toggle} />
        {hasLocked && <div className="lock-hint">Past days are locked — not editable</div>}
        <div className="wordmark">
          <div>
            <div className="n">HAMSUN</div>
            <div className="h">HOSPITALITY</div>
          </div>
        </div>
      </div>

      <section className="history">
        <h2>
          Previous records <small>{history.length > 0 ? `${history.length} week(s)` : ""}</small>
        </h2>
        {history.length === 0 ? (
          <p className="empty">
            No previous records for this branch yet — your saved weeks will appear here.
          </p>
        ) : (
          history.map((r) => {
            const open = expanded === r.week_start;
            const d = countDone(r.data);
            return (
              <div key={r.week_start} className={`hrow${open ? " open" : ""}`}>
                <button
                  className="hrow-head"
                  onClick={() => setExpanded(open ? null : r.week_start)}
                  aria-expanded={open}
                >
                  <span className="hdate">{weekRange(parseISO(r.week_start))}</span>
                  <span className="hmeta">
                    Manager: <b>{r.manager || "—"}</b>
                  </span>
                  <span className="hprog">
                    <span className="htrack">
                      <span className="hfill" style={{ width: `${(d / TOTAL_CELLS) * 100}%` }} />
                    </span>
                    {d}/{TOTAL_CELLS}
                  </span>
                  <span className="hchev">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="hbody">
                    <div className="hsheet">
                      <div className="sheet-head head-small">
                        <h1>Checklist</h1>
                      </div>
                      <div className="sheet-meta">
                        <div>
                          Branch: <b>{r.branch === "General" ? "—" : r.branch}</b>
                        </div>
                        <div>
                          Manager: <b>{r.manager || "—"}</b>
                        </div>
                      </div>
                      <ChecklistGrid data={r.data} days={buildDays(parseISO(r.week_start))} readOnly />
                    </div>
                    <button className="load" onClick={() => loadRecord(r)}>
                      Open this week
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <div className="bar">
        <div className="progress">
          <span>
            {done} of {TOTAL_CELLS} done
          </span>
          <span className="sync" data-sync={sync}>
            {sync === "saving" ? "Saving…" : sync === "saved" ? "✓ Saved" : sync === "offline" ? "Offline" : ""}
          </span>
          <div className="track">
            <div className="fill" style={{ width: `${(done / TOTAL_CELLS) * 100}%` }} />
          </div>
        </div>
        <button className="ghost" onClick={clearWeek}>
          Clear week
        </button>
      </div>

      {toastMsg && <div className="toast show">{toastMsg}</div>}
    </>
  );
}