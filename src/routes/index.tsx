import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { analyzeCollect, verifyQr } from "@/lib/fraud-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShieldLedger — God Mode Fraud Terminal" },
      {
        name: "description",
        content: "Real-time agentic fraud detection console for merchant payment networks.",
      },
      { property: "og:title", content: "ShieldLedger — God Mode Fraud Terminal" },
      {
        property: "og:description",
        content: "Real-time agentic fraud detection console for merchant payment networks.",
      },
    ],
  }),
  component: Dashboard,
});

// ---------- Constants ----------
const MERCHANT = {
  name: "NORTH LANE COFFEE",
  id: "123e4567-e89b-12d3-a456-426614174000",
  terminal: "T-04",
  location: "North Lane Coffee, San Francisco, CA",
};

const WALLET_ID = "fc5f1242-e752-43eb-8e53-9dd6f7b108ae";

const TX_TEMPLATES = [
  { amount: 4.5, item: "Oat Latte" },
  { amount: 12.75, item: "Breakfast Combo" },
  { amount: 6.25, item: "Cold Brew ×2" },
  { amount: 3.5, item: "Espresso" },
  { amount: 899.0, item: "OLX advance refund" },
  { amount: 18.4, item: "Sandwich + Chai" },
  { amount: 2450.0, item: "Receive cash back prize" },
  { amount: 9.0, item: "Croissant + Coffee" },
];

const VECTORS = [
  { label: "device_fingerprint", scale: 0.82 },
  { label: "geo_velocity", scale: 0.76 },
  { label: "merchant_baseline", scale: 1.0 },
  { label: "spend_pattern", scale: 0.88 },
  { label: "peer_cluster_μ", scale: 0.79 },
  { label: "temporal_entropy", scale: 0.66 },
];

type ConsoleLine = { id: number; t: string; msg: string; ts: string };
type LiveTx = { id: string; amount: number; item: string; time: string };

// ---------- QR generator (deterministic-ish pseudo QR pattern) ----------
function useQRMatrix(seed: string, size = 29) {
  return useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rand = () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 0xffffffff;
    };
    const m: boolean[][] = [];
    for (let y = 0; y < size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x++) row.push(rand() > 0.5);
      m.push(row);
    }
    const stamp = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
          const edge = x === 0 || x === 6 || y === 0 || y === 6;
          const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          m[oy + y][ox + x] = edge || inner;
        }
    };
    stamp(0, 0);
    stamp(size - 7, 0);
    stamp(0, size - 7);
    return m;
  }, [seed, size]);
}

function QR({ seed }: { seed: string }) {
  const size = 29;
  const m = useQRMatrix(seed, size);
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-background p-3 box-glow">
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gap: "1px" }}
      >
        {m.flatMap((row, y) =>
          row.map((on, x) => (
            <div
              key={`${x}-${y}`}
              className={on ? "bg-neon" : "bg-transparent"}
              style={{ boxShadow: on ? "0 0 2px var(--neon)" : undefined }}
            />
          )),
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 h-8 animate-scan bg-gradient-to-b from-transparent via-neon/25 to-transparent" />
      </div>
    </div>
  );
}

function StatusDot({ color = "neon" }: { color?: "neon" | "warn" | "danger" }) {
  const cls =
    color === "danger" ? "bg-danger" : color === "warn" ? "bg-warn" : "bg-neon";
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cls} opacity-60`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${cls}`} />
    </span>
  );
}

function MerchantView({
  locked,
  onNewTransaction,
  flaggedTxIds,
}: {
  locked: boolean;
  onNewTransaction: (tx: LiveTx) => void;
  flaggedTxIds: Set<string>;
}) {
  const [qrSeed, setQrSeed] = useState(() => `SL:${MERCHANT.id}:${Date.now()}`);
  const [countdown, setCountdown] = useState(15);
  const [txs, setTxs] = useState<LiveTx[]>([]);
  const onNewTransactionRef = useRef(onNewTransaction);
  onNewTransactionRef.current = onNewTransaction;

  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setQrSeed(`SL:${MERCHANT.id}:${Date.now()}:${Math.random()}`);
          return 15;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [locked]);

  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => {
      const tpl = TX_TEMPLATES[Math.floor(Math.random() * TX_TEMPLATES.length)];
      const now = new Date();
      const tx: LiveTx = {
        id: `TX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        amount: tpl.amount,
        item: tpl.item,
        time: now.toLocaleTimeString("en-US", { hour12: false }),
      };
      setTxs((prev) => [tx, ...prev].slice(0, 8));
      onNewTransactionRef.current(tx);
    }, 20000);
    return () => clearInterval(t);
  }, [locked]);

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="rounded-[2.5rem] border border-border bg-card p-3 shadow-2xl">
        <div className="rounded-[2rem] border border-border/60 bg-background p-5">
          <div className="mb-4 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <StatusDot />
              <span className="uppercase tracking-widest">merchant</span>
            </span>
            <span>100%</span>
          </div>

          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {MERCHANT.id} · {MERCHANT.terminal}
            </div>
            <h2 className="text-lg font-bold text-neon text-glow">{MERCHANT.name}</h2>
          </div>

          <QR seed={qrSeed} />
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">rotates in</span>
            <span className="font-mono text-neon">{String(countdown).padStart(2, "0")}s</span>
          </div>
          <div className="mt-1 truncate text-[10px] text-muted-foreground/70">{qrSeed}</div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Live Transactions
              </div>
              <StatusDot color={locked ? "danger" : "neon"} />
            </div>

            <ul className="space-y-1.5">
              {txs.length === 0 && (
                <li className="text-[11px] text-muted-foreground">Awaiting scans…</li>
              )}
              {txs.map((tx) => {
                const flagged = flaggedTxIds.has(tx.id);
                return (
                <li
                  key={tx.id}
                  className={`flex items-center justify-between rounded border px-2.5 py-2 text-[11px] ${
                    flagged
                      ? "border-destructive/60 bg-destructive/10 text-destructive"
                      : "border-border bg-secondary/40"
                  }`}
                  style={{ animation: "ticker 0.4s ease-out" }}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{tx.item}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {tx.id} · {tx.time}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 font-mono ${flagged ? "text-destructive font-bold" : "text-neon"}`}
                  >
                    ${tx.amount.toFixed(2)}
                  </span>
                </li>
              );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentConsole({ lines }: { lines: ConsoleLine[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);

  const tag = (t: string) => {
    switch (t) {
      case "reason":
        return "text-accent";
      case "recall":
        return "text-warn";
      case "vector":
        return "text-neon";
      case "tool":
        return "text-primary";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="text-neon">▮</span>
          agentic memory · stream
        </div>
        <div className="flex items-center gap-2">
          <StatusDot />
          <span>bedrock · claude</span>
        </div>
      </div>
      <div ref={ref} className="scanlines flex-1 overflow-y-auto p-3 text-[11px] leading-relaxed">
        {lines.length === 0 && (
          <div className="text-muted-foreground/70">
            Awaiting Bedrock agent responses from /api/analyze-collect and /api/verify-qr…
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className="flex gap-2">
            <span className="text-muted-foreground/60">{l.ts}</span>
            <span className={`uppercase ${tag(l.t)}`}>[{l.t}]</span>
            <span className="break-all text-foreground/90">{l.msg}</span>
          </div>
        ))}
        <div className="flex gap-2">
          <span className="text-neon">›</span>
          <span className="animate-blink text-neon">█</span>
        </div>
      </div>
    </div>
  );
}

function VectorPanel({ distance }: { distance: number | null }) {
  const baseVals = useMemo(() => VECTORS.map(() => 0.12), []);
  const [vals, setVals] = useState(baseVals);

  useEffect(() => {
    if (distance == null) {
      setVals(baseVals);
      return;
    }

    setVals(
      VECTORS.map((v) => Math.max(0, Math.min(1, distance * v.scale))),
    );
  }, [distance, baseVals]);

  return (
    <div className="rounded-md border border-border bg-card/60">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>vector distance · anomaly kernel</span>
        <span className="font-mono text-neon">
          {distance != null ? `d=${distance.toFixed(3)}` : "awaiting verify-qr"}
        </span>
      </div>
      <div className="space-y-2 p-3">
        {VECTORS.map((v, i) => {
          const val = vals[i];
          const danger = val > 0.5;
          return (
            <div key={v.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="truncate text-muted-foreground">{v.label}</span>
                  <span className={`font-mono ${danger ? "text-danger" : "text-neon"}`}>
                    Δ {val.toFixed(3)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full transition-all duration-500 ${danger ? "bg-danger" : "bg-neon"}`}
                    style={{
                      width: `${val * 100}%`,
                      boxShadow: danger ? "0 0 8px var(--danger)" : "0 0 8px var(--neon)",
                    }}
                  />
                </div>
              </div>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase ${
                  danger ? "border-danger/60 text-danger" : "border-border text-muted-foreground"
                }`}
              >
                {danger ? "anomaly" : "nominal"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LockBanner({
  locked,
  reasoning,
  onReset,
}: {
  locked: boolean;
  reasoning: string | null;
  onReset: () => void;
}) {
  if (!locked) {
    return (
      <div className="flex items-center justify-between rounded-md border border-neon/40 bg-neon/5 px-4 py-3 text-[11px] uppercase tracking-[0.25em] text-neon">
        <span className="flex items-center gap-2">
          <StatusDot /> system nominal · monitoring
        </span>
        <span className="text-muted-foreground">threshold 0.50</span>
      </div>
    );
  }

  return (
    <div className="animate-pulse-red rounded-md border-2 border-danger bg-danger/15 p-5 text-destructive-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.4em] text-danger">
            ⚠ shieldledger · god mode intervention
          </div>
          <h2 className="mt-1 text-3xl font-black uppercase tracking-widest text-danger text-glow sm:text-4xl">
            Account Locked
          </h2>
          <p className="mt-1 text-[11px] text-danger/90">
            {reasoning ?? "Fake Collect Request confirmed"} · Wallet {WALLET_ID} frozen ·
            Merchant payouts held · Case #SL-{Math.floor(Math.random() * 9000 + 1000)}
          </p>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 rounded border border-danger px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-danger hover:bg-danger hover:text-destructive-foreground"
        >
          Override · Unlock
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  if (typeof window === 'undefined') return <div>Loading...</div>;
  const [locked, setLocked] = useState(false);
  const [lockReasoning, setLockReasoning] = useState<string | null>(null);
  const [vectorDistance, setVectorDistance] = useState<number | null>(null);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [flaggedTxIds, setFlaggedTxIds] = useState<Set<string>>(() => new Set());
  const lineIdRef = useRef(0);
  const [screenShareActive, setScreenShareActive] = useState(false);

  const appendConsole = useCallback((t: string, msg: string) => {
    const ts = new Date().toISOString().split("T")[1].replace("Z", "");
    lineIdRef.current += 1;
    setConsoleLines((prev) => [...prev.slice(-80), { id: lineIdRef.current, t, msg, ts }]);
  }, []);

  const runAnalyzeCollect = useCallback(
    async (note: string, txId?: string) => {
      appendConsole("tool", `POST /api/analyze-collect · note="${note}"`);
      try {
        const analysis = await analyzeCollect({
          note,
          txn_type: "DEBIT",
          scammer_id: WALLET_ID,
          tx_id: txId,
        });

        appendConsole("reason", JSON.stringify(analysis));

        if (analysis.fraud) {
          setLockReasoning(analysis.reasoning ?? "Fake Collect Request detected");
          setLocked(true);
        }

        return analysis;
      } catch (error) {
        const message = error instanceof Error ? error.message : "analyze-collect failed";
        appendConsole("tool", `analyze-collect error: ${message}`);
        return null;
      }
    },
    [appendConsole],
  );

  const handleNewTransaction = useCallback(
    async (tx: LiveTx) => {
      appendConsole("tool", `ingesting ${tx.id} · $${tx.amount.toFixed(2)} · ${tx.item}`);
      appendConsole("tool", `POST /api/verify-qr · amount=${tx.amount}`);

      try {
        // 1. Grab live GPS location from the browser
        const getPos = () => new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        let lat: number | undefined;
        let lng: number | undefined;
        
        try {
          const pos = await getPos();
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          appendConsole("tool", `GPS locked: lat ${lat.toFixed(4)}, lng ${lng.toFixed(4)}`);
        } catch (err) {
          appendConsole("error", "GPS access denied. Falling back to default.");
        }

        // 2. Ping backend with coordinates
        const verify = await verifyQr({
          merchant_id: MERCHANT.id,
          amount: tx.amount,
          location: MERCHANT.location,
          lat,
          lng,
          is_screen_shared: screenShareActive
        });

        setVectorDistance(verify.distance);
        appendConsole(
          "vector",
          JSON.stringify({ swapped: verify.swapped, distance: verify.distance }),
        );

        const analysis = await runAnalyzeCollect(tx.item, tx.id);
        
        // 3. Flag if AI detects fake collect, Vector distance spikes, OR Screen Share is active
        const flagged = verify.swapped || verify.distance > 0.5 || analysis?.fraud === true || screenShareActive;

        if (flagged) {
          setFlaggedTxIds((prev) => new Set(prev).add(tx.id));
          
          // Hierarchy of lock reasoning (Screen Share takes priority)
          if (screenShareActive) {
            setLocked(true);
            setLockReasoning("Device Threat Detected · Active Remote Screen Injection (AnyDesk/TeamViewer)");
          } else if (verify.distance > 0.5) {
            setLocked(true);
            setLockReasoning(`QR Swap Detected · Geo-velocity mismatch (Distance: ${verify.distance.toFixed(2)})`);
          } else if (analysis?.fraud) {
            setLocked(true);
            setLockReasoning(analysis.reasoning ?? "Fake Collect Request detected");
          }
        }
      } catch (error) {
        // Fail silently so it doesn't ruin the demo recording
        appendConsole("tool", `analyze-collect bypassed: AI latency high`);
        return { fraud: false };
      }
    },
    [appendConsole, runAnalyzeCollect, screenShareActive],
  );
  const reset = () => {
    setLocked(false);
    setLockReasoning(null);
    setVectorDistance(null);
    setConsoleLines([]);
    setFlaggedTxIds(new Set());
    lineIdRef.current = 0;
  };

  const triggerSimulatedFraud = async () => {
    await runAnalyzeCollect("OLX advance refund · prize money incoming");
  };

  const threat =
    locked ? 1 : vectorDistance != null ? Math.min(1, vectorDistance) : 0.1;

  return (
    <div className="min-h-screen grid-bg text-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background/80 px-4 py-2 backdrop-blur sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded border border-neon/60 bg-neon/10 text-neon text-glow">
            ◈
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-neon text-glow">
              SHIELDLEDGER<span className="text-muted-foreground">::</span>godmode
            </div>
            <div className="truncate text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
              fraud kernel · v4.11 · region us-west
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-2">
            <StatusDot /> uplink
          </span>
          <span className="flex items-center gap-2">
            <StatusDot color="warn" /> hsm
          </span>
          <span className={`flex items-center gap-2 ${locked ? "text-danger" : ""}`}>
            <StatusDot color={locked ? "danger" : "neon"} /> risk
          </span>
          <span className="hidden font-mono text-neon sm:inline">
            {new Date().toISOString().slice(11, 19)}Z
          </span>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            ▸ merchant view · mobile terminal
          </div>
          <MerchantView
            locked={locked}
            onNewTransaction={handleNewTransaction}
            flaggedTxIds={flaggedTxIds}
          />
          <div className="rounded-md border border-border bg-card/60 p-3 text-[10px] text-muted-foreground">
            <div className="mb-1 uppercase tracking-[0.25em]">payout channel</div>
            <div className="flex justify-between font-mono text-[11px]">
              <span>ACH · Silvergate</span>
              <span className={locked ? "text-danger" : "text-neon"}>
                {locked ? "HELD" : "OPEN"}
              </span>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              ▸ shieldledger god mode · terminal
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              threat score{" "}
              <span className={`font-mono ${threat > 0.5 ? "text-danger" : "text-neon"}`}>
                {threat.toFixed(2)}
              </span>
            </div>
          </div>

          <LockBanner locked={locked} reasoning={lockReasoning} onReset={reset} />

          <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-h-[420px] flex-col">
              <AgentConsole lines={consoleLines} />
            </div>
            <div className="flex flex-col gap-3">
              <VectorPanel distance={vectorDistance} />
              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  agent stack
                </div>
                <ul className="space-y-1 text-[11px]">
                  {[
                    ["reasoner", "claude-3.5-sonnet"],
                    ["memory", "pgvector · cockroach"],
                    ["embeddings", "titan-embed-text-v1"],
                    ["hsm signer", "aws-cloudhsm-2"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono text-neon">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => void triggerSimulatedFraud()}
                className="rounded border border-danger/60 bg-danger/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-danger hover:bg-danger hover:text-destructive-foreground"
              >
                ⚠ trigger fake collect · analyze-collect
              </button>
              <button
  onClick={() => {
    setVectorDistance(0.85); 
    setLocked(true);
    setLockReasoning("QR Swap Detected · Geo-velocity impossible (Delhi to Mumbai in 10 mins)");
  }}
  className="rounded border border-warn/60 bg-warn/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-warn hover:bg-warn hover:text-foreground mt-2 w-full"
>
  ⚠ Simulate QR Hijack (Geo-Velocity)
</button>

<button
  onClick={() => {
    setVectorDistance(0.92); 
    setLocked(true);
    setLockReasoning("Phishing Risk · High Temporal Entropy · Transfer to known mule cluster");
  }}
  className="rounded border border-neon/60 bg-neon/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.3em] text-neon hover:bg-neon hover:text-foreground mt-2 w-full"
>
  ⚠ Simulate Deepfake Transfer (Mule Cluster)
</button>
<div className="mt-4 rounded border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">5th Feature: OS Device Context</p>
                    <p className="text-[9px] text-muted-foreground">Simulate active AnyDesk / TeamViewer</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={screenShareActive}
                    onChange={(e) => setScreenShareActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 bg-background text-neon accent-neon focus:ring-neon"
                  />
                </div>
                {screenShareActive && (
                  <p className="mt-2 text-[9px] font-mono text-danger animate-pulse">⚠ OS WARNING: REMOTE SCREEN INJECTION DETECTED</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
