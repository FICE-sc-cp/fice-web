'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { fice, mediaUrl, type VotingScreenData } from '@/lib/api';
import { FrogMascot } from '@/components/ui/FrogMascot';

// Helpers
function pluralVotes(v: number): string {
  const a = Math.abs(v) % 10;
  const b = Math.abs(v) % 100;
  if (a === 1 && b !== 11) return 'голос';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'голоси';
  return 'голосів';
}

function fmtNumber(v: number): string {
  return v.toLocaleString('uk-UA');
}

function getInitials(name: string): string {
  const people = name.split(/\s+та\s+|\s+і\s+|\s*&\s*/i);
  if (people.length > 1) {
    return people
      .map((p) => p.trim().charAt(0))
      .filter(Boolean)
      .join('+')
      .toUpperCase();
  }
  const w = name.trim().split(/\s+/);
  return (w[0]?.charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
}

const GRADIENT_MAIN = 'linear-gradient(90deg, #2eff97 -19.71%, #36dfff 48.48%, #ad46ff 116.67%)';
const GRADIENT_BLUE = 'linear-gradient(90deg, #00e3f3 0%, #2b7fff 100%)';
const GRADIENT_ORANGE = 'linear-gradient(90deg, #ff8904 0%, #fb2c36 100%)';

export default function LiveVotingScreenPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<VotingScreenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Screen modes
  const [viewMode, setViewMode] = useState<'leaderboard' | 'ceremony'>('leaderboard');
  // Manual override for hiding candidate counts:
  // null = automatic (auto-hides when 49% of all votes/voters reached)
  // boolean = manual override by organizer
  const [manualHideOverride, setManualHideOverride] = useState<boolean | null>(null);

  // Auto-hide when 49% threshold is reached
  const isAutoThresholdReached = !!data?.voting?.isThresholdReached;
  const hideCounts = manualHideOverride !== null ? manualHideOverride : isAutoThresholdReached;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Ceremony reveal state: 0 = hidden, 1 = 3rd revealed, 2 = 2nd revealed, 3 = 1st revealed (champion!)
  const [ceremonyStep, setCeremonyStep] = useState<number>(0);

  // Pagination for 9+ candidates mode
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [isPageTimerPaused, setIsPageTimerPaused] = useState<boolean>(false);

  // Canvas & timer refs
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pageRotateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 16:9 Scale fitting
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const handleResize = () => {
      const sx = window.innerWidth / 1920;
      const sy = window.innerHeight / 1080;
      setScale(Math.min(sx, sy));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch live screen data
  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fice.votingScreen(id);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити дані');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Initial fetch and auto-polling every 2.5s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Auto-hide controls when mouse is idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  // ================= MULTI-WAVE CONFETTI ENGINE =================
  const confettiAnimRef = useRef<number | null>(null);
  const celebrationEndRef = useRef<number>(0);
  const particlesRef = useRef<
    Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rotation: number;
      rotSpeed: number;
      opacity: number;
      shape: 'rect' | 'circle' | 'strip';
      drag: number;
    }>
  >([]);

  const spawnConfettiWave = useCallback((canvas: HTMLCanvasElement, count = 120, customColors?: string[]) => {
    const defaultColors = [
      '#2EFF97', // Green
      '#36DFFF', // Cyan
      '#AD46FF', // Purple
      '#F6339A', // Pink
      '#FF8904', // Orange
      '#FFD700', // Gold
      '#FFFFFF', // White
    ];
    const colors = customColors || defaultColors;

    for (let i = 0; i < count; i++) {
      const mode = i % 3;
      let x = 0;
      let y = 0;
      let vx = 0;
      let vy = 0;

      if (mode === 0) {
        // Left cannon
        x = 40 + Math.random() * 80;
        y = canvas.height - 60;
        vx = Math.random() * 16 + 6;
        vy = -(Math.random() * 24 + 14);
      } else if (mode === 1) {
        // Right cannon
        x = canvas.width - 40 - Math.random() * 80;
        y = canvas.height - 60;
        vx = -(Math.random() * 16 + 6);
        vy = -(Math.random() * 24 + 14);
      } else {
        // Top shower
        x = Math.random() * canvas.width;
        y = -20;
        vx = (Math.random() - 0.5) * 8;
        vy = Math.random() * 6 + 2;
      }

      const shapes: ('rect' | 'circle' | 'strip')[] = ['rect', 'strip', 'circle'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      particlesRef.current.push({
        x,
        y,
        w: shape === 'strip' ? Math.random() * 14 + 10 : Math.random() * 10 + 6,
        h: shape === 'strip' ? Math.random() * 5 + 3 : Math.random() * 10 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx,
        vy,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        opacity: 1,
        shape,
        drag: shape === 'strip' ? 0.96 : 0.98,
      });
    }
  }, []);

  const stopConfetti = useCallback(() => {
    if (confettiAnimRef.current) {
      cancelAnimationFrame(confettiAnimRef.current);
      confettiAnimRef.current = null;
    }
    celebrationEndRef.current = 0;
    particlesRef.current = [];
    const canvas = confettiCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const fireConfetti = useCallback(
    (type: 'gold' | 'silver' | 'bronze' | 'all' = 'all') => {
      const canvas = confettiCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // 1st place/all has extended multi-wave (14s), 2nd/3rd has quick celebration burst (3.5-4s)
      const duration = type === 'bronze' ? 3500 : type === 'silver' ? 4000 : 14000;
      celebrationEndRef.current = Date.now() + duration;
      let lastWaveTime = 0;

      let colors: string[];
      if (type === 'bronze') {
        colors = ['#FF8904', '#FB2C36', '#FFB066', '#FFFFFF', '#FFD700'];
      } else if (type === 'silver') {
        colors = ['#00E3F3', '#2B7FFF', '#FFFFFF', '#E2E8F0', '#94A3B8'];
      } else {
        colors = ['#2EFF97', '#36DFFF', '#AD46FF', '#F6339A', '#FF8904', '#FFD700', '#FFFFFF'];
      }

      spawnConfettiWave(canvas, type === 'all' || type === 'gold' ? 200 : 120, colors);

      if (confettiAnimRef.current) {
        cancelAnimationFrame(confettiAnimRef.current);
      }

      const render = () => {
        const now = Date.now();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (now < celebrationEndRef.current && (type === 'all' || type === 'gold') && now - lastWaveTime > 400) {
          spawnConfettiWave(canvas, 75, colors);
          lastWaveTime = now;
        }

        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.28;
          p.vx *= p.drag;
          p.rotation += p.rotSpeed;

          if (p.y > canvas.height * 0.35) {
            p.opacity -= 0.004;
          }

          if (p.opacity <= 0 || p.y > canvas.height + 80) {
            particles.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;

          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
          ctx.restore();
        }

        if (particles.length > 0 || now < celebrationEndRef.current) {
          confettiAnimRef.current = requestAnimationFrame(render);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          confettiAnimRef.current = null;
        }
      };

      render();
    },
    [spawnConfettiWave],
  );

  // Stop confetti when switching between tabs/modes
  useEffect(() => {
    stopConfetti();
  }, [viewMode, stopConfetti]);

  // Stop confetti when browser tab is switched or hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopConfetti();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [stopConfetti]);

  // Clean up confetti on unmount
  useEffect(() => {
    return () => {
      stopConfetti();
    };
  }, [stopConfetti]);

  // Candidates calculations
  const candidates = useMemo(() => data?.candidates ?? [], [data?.candidates]);
  const candidateCount = candidates.length;

  const totalVotes = useMemo(() => {
    if (data?.voting.totalVotes !== undefined && data.voting.totalVotes > 0) {
      return data.voting.totalVotes;
    }
    return candidates.reduce((sum, c) => sum + (c.votesCount || 0), 0);
  }, [data?.voting.totalVotes, candidates]);

  // Carousel pagination for > 8 candidates
  const pageSize = 8;
  const restCandidates = useMemo(() => (candidateCount > 8 ? candidates.slice(3) : []), [candidateCount, candidates]);
  const pageCount = useMemo(() => Math.ceil(restCandidates.length / pageSize), [restCandidates.length]);

  useEffect(() => {
    if (candidateCount <= 8 || pageCount <= 1 || isPageTimerPaused) return;

    pageRotateTimerRef.current = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % pageCount);
    }, 8000);

    return () => {
      if (pageRotateTimerRef.current) clearInterval(pageRotateTimerRef.current);
    };
  }, [candidateCount, pageCount, isPageTimerPaused]);

  // Winners mapping for ceremony
  type PodiumCandidate = {
    id: string;
    name: string;
    description: string | null;
    photoUrl: string | null;
    votesCount: number;
    percentage: number;
  };

  const winners = useMemo(() => {
    const wMap: Record<number, PodiumCandidate | undefined> = {};
    if (data?.winners && data.winners.length > 0) {
      for (const w of data.winners) {
        wMap[w.place] = w;
      }
    }
    // Fallback to top candidates if winners array is not populated
    if (!wMap[1] && candidates[0]) wMap[1] = candidates[0];
    if (!wMap[2] && candidates[1]) wMap[2] = candidates[1];
    if (!wMap[3] && candidates[2]) wMap[3] = candidates[2];
    return wMap;
  }, [data?.winners, candidates]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'c' || e.key === 'C') {
        fireConfetti('all');
      } else if (e.key === '0') {
        stopConfetti();
        setCeremonyStep(0);
      } else if (e.key === '1') {
        stopConfetti();
        setCeremonyStep(1);
        fireConfetti('bronze');
      } else if (e.key === '2') {
        stopConfetti();
        setCeremonyStep(2);
        fireConfetti('silver');
      } else if (e.key === '3') {
        stopConfetti();
        setCeremonyStep(3);
        fireConfetti('gold');
      } else if (e.key === ' ' || e.key === 'ArrowRight') {
        if (viewMode === 'ceremony') {
          setCeremonyStep((prev) => {
            const next = Math.min(3, prev + 1);
            stopConfetti();
            if (next === 1) fireConfetti('bronze');
            else if (next === 2) fireConfetti('silver');
            else if (next === 3) fireConfetti('gold');
            return next;
          });
        } else if (candidateCount > 8 && pageCount > 1) {
          setPageIndex((prev) => (prev + 1) % pageCount);
        }
      } else if (e.key === 'ArrowLeft') {
        if (viewMode === 'ceremony') {
          setCeremonyStep((prev) => {
            const next = Math.max(0, prev - 1);
            stopConfetti();
            return next;
          });
        } else if (candidateCount > 8 && pageCount > 1) {
          setPageIndex((prev) => (prev - 1 + pageCount) % pageCount);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, fireConfetti, stopConfetti, candidateCount, pageCount]);

  const botUsername = process.env.NEXT_PUBLIC_USER_BOT_USERNAME || 'fice_event_bot';
  const qrTargetUrl = `https://t.me/${botUsername}?start=vote_${id}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=1&bgcolor=ffffff&color=000000&data=${encodeURIComponent(
    qrTargetUrl,
  )}`;

  const isClosed = data?.voting.status === 'CLOSED';
  const isActive = data?.voting.status === 'ACTIVE';

  // Ceremony slots config matching reference
  const ceremonySlots = [
    {
      place: 2,
      left: 100,
      width: 520,
      top: 380,
      pedH: 92,
      pedSize: 44,
      grad: GRADIENT_BLUE,
      keyColor: '#36dfff',
      pad: 4,
      nameSize: 36,
      pctSize: 60,
      qSize: 190,
      question: 'Хто на 2 місці?',
      revealAt: 2,
    },
    {
      place: 1,
      left: 660,
      width: 600,
      top: 300,
      pedH: 124,
      pedSize: 56,
      grad: GRADIENT_MAIN,
      keyColor: '#2eff97',
      pad: 6,
      nameSize: 44,
      pctSize: 76,
      qSize: 240,
      question: 'Хто переможець?',
      revealAt: 3,
    },
    {
      place: 3,
      left: 1300,
      width: 520,
      top: 420,
      pedH: 68,
      pedSize: 40,
      grad: GRADIENT_ORANGE,
      keyColor: '#ff8904',
      pad: 4,
      nameSize: 36,
      pctSize: 60,
      qSize: 170,
      question: 'Хто на 3 місці?',
      revealAt: 1,
    },
  ];

  // Decorative confetti array for ceremony climax
  const decorConfetti = useMemo(() => {
    const raw = [
      [128, 262, 22, '#2eff97', 12],
      [214, 318, 14, '#f6339a', -20],
      [322, 270, 18, '#36dfff', 30],
      [436, 330, 12, '#ff8904', 8],
      [520, 262, 20, '#ad46ff', -12],
      [580, 344, 14, '#2eff97', 40],
      [1334, 268, 18, '#ff8904', -8],
      [1430, 336, 22, '#36dfff', 18],
      [1540, 276, 14, '#2eff97', -30],
      [1628, 356, 20, '#f6339a', 10],
      [1716, 282, 16, '#ad46ff', 24],
      [1790, 380, 12, '#2b7fff', -16],
      [26, 420, 18, '#36dfff', 20],
      [58, 560, 12, '#ff8904', -14],
      [22, 700, 20, '#ad46ff', 6],
      [64, 850, 14, '#2eff97', 30],
      [1850, 470, 20, '#2eff97', -24],
      [1872, 620, 12, '#f6339a', 16],
      [1836, 760, 18, '#36dfff', -6],
      [1878, 900, 14, '#ff8904', 28],
      [640, 400, 12, '#36dfff', 18],
      [1276, 380, 14, '#ad46ff', -22],
      [620, 520, 16, '#f6339a', 12],
      [1284, 540, 12, '#2eff97', -10],
    ];
    return raw.map((a, i) => ({
      x: a[0] as number,
      y: a[1] as number,
      s: a[2] as number,
      c: a[3] as string,
      r: a[4] as number,
      d: (i % 6) * 0.35,
    }));
  }, []);

  return (
    <div
      onMouseMove={handleMouseMove}
      className="fixed inset-0 bg-[#101010] flex items-center justify-center overflow-hidden select-none"
    >
      {/* Dynamic Multi-Wave Confetti Canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      />

      {/* ================= 1920x1080 STAGE CANVAS ================= */}
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
        className="relative overflow-hidden bg-[#101010] text-white font-sans tabular-nums"
      >
        {/* ================= AMBIENT GLOWS ================= */}
        <div
          style={{
            position: 'absolute',
            left: -260,
            top: 560,
            width: 1000,
            height: 760,
            background: 'radial-gradient(closest-side, rgba(173, 70, 255, 0.30), rgba(173, 70, 255, 0))',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 1240,
            top: 80,
            width: 900,
            height: 700,
            background: 'radial-gradient(closest-side, rgba(0, 227, 243, 0.18), rgba(0, 227, 243, 0))',
            pointerEvents: 'none',
          }}
        />

        {/* Dynamic Ceremony Glows */}
        {viewMode === 'ceremony' && ceremonyStep === 1 && (
          <div
            style={{
              position: 'absolute',
              left: 1060,
              top: 260,
              width: 1000,
              height: 900,
              background: 'radial-gradient(closest-side, rgba(255, 137, 4, 0.30), rgba(0, 0, 0, 0))',
              pointerEvents: 'none',
            }}
          />
        )}
        {viewMode === 'ceremony' && ceremonyStep === 2 && (
          <div
            style={{
              position: 'absolute',
              left: -140,
              top: 220,
              width: 1000,
              height: 940,
              background: 'radial-gradient(closest-side, rgba(54, 223, 255, 0.28), rgba(0, 0, 0, 0))',
              pointerEvents: 'none',
            }}
          />
        )}
        {viewMode === 'ceremony' && ceremonyStep === 3 && (
          <div
            style={{
              position: 'absolute',
              left: 360,
              top: 120,
              width: 1200,
              height: 1000,
              background: 'radial-gradient(closest-side, rgba(46, 255, 151, 0.26), rgba(0, 0, 0, 0))',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ================= TOP HEADER BAR ================= */}
        <header
          style={{
            position: 'absolute',
            left: 60,
            top: 32,
            width: 1800,
            height: 88,
            boxSizing: 'border-box',
            padding: '0 56px 0 32px',
            borderRadius: 20,
            background: GRADIENT_MAIN,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            color: '#0c0a09',
            zIndex: 10,
          }}
        >
          {/* Logo */}
          <img
            src="/logo_black.png"
            alt="FICE — Студрада ФІОТ"
            style={{ height: 52, width: 'auto', display: 'block' }}
          />

          {/* Divider */}
          <div style={{ width: 4, height: 44, borderRadius: 2, background: '#0c0a09', flexShrink: 0 }} />

          {/* Event Title */}
          <div
            style={{
              flexGrow: 1,
              minWidth: 0,
              fontSize: 34,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data?.voting.eventName || 'Бал ФІОТ 2026'}
          </div>

          {/* Total Votes Count */}
          {totalVotes > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 34, fontWeight: 900, whiteSpace: 'nowrap' }}>
                {fmtNumber(totalVotes)} {pluralVotes(totalVotes)}
                {data?.voting.turnoutPercentage !== undefined && data?.voting.turnoutPercentage !== null && (
                  <span style={{ fontSize: 26, fontWeight: 700, opacity: 0.85, marginLeft: 8 }}>
                    ({data.voting.turnoutPercentage}%)
                  </span>
                )}
              </div>

              {hideCounts && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 12,
                    background: '#0c0a09',
                    color: '#36dfff',
                    fontSize: 20,
                    fontWeight: 800,
                    border: '1.5px solid rgba(54, 223, 255, 0.5)',
                    boxShadow: '0 0 16px rgba(54, 223, 255, 0.25)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Проголосувало понад 49% виборців — голоси за кандидатів приховано для збереження інтриги"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Інтрига (&gt;49%)</span>
                </div>
              )}
            </div>
          )}

          {/* Live / Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 24px',
              borderRadius: 14,
              background: '#0c0a09',
              color: '#ffffff',
              fontSize: 30,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            {viewMode === 'ceremony' ? (
              <>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                  <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
                  <path d="M17 5h3v2a3 3 0 0 1-3 3" />
                  <path d="M7 5H4v2a3 3 0 0 0 3 3" />
                </svg>
                <span>Нагородження</span>
              </>
            ) : isActive ? (
              <>
                <span
                  className="live-dot"
                  style={{ width: 18, height: 18, borderRadius: '50%', background: '#2eff97' }}
                />
                <span>Наживо</span>
              </>
            ) : isClosed ? (
              <>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>Завершено</span>
              </>
            ) : (
              <>
                <span
                  className="live-dot"
                  style={{ width: 18, height: 18, borderRadius: '50%', background: '#ff8904' }}
                />
                <span>Скоро старт</span>
              </>
            )}
          </div>
        </header>

        {/* Mascot Frog floating top right */}
        <div
          className="frog-float"
          style={{
            position: 'absolute',
            left: 1834,
            top: 36,
            width: 80,
            height: 80,
            zIndex: 11,
          }}
        >
          <FrogMascot className="w-full h-full" />
        </div>

        {/* ================= NOMINATION HEADER / CLIMAX MARQUEE ================= */}
        {viewMode === 'leaderboard' ? (
          <div
            style={{
              position: 'absolute',
              left: 60,
              top: 160,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 28,
            }}
          >
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 14 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 80,
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {data?.voting.title || 'Номінація'}
              </h1>
              <span
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: GRADIENT_MAIN,
                }}
              />
            </div>
            {isClosed && (
              <div
                style={{
                  marginTop: 14,
                  padding: '8px 22px',
                  borderRadius: 14,
                  border: '3px solid #ffffff',
                  fontSize: 34,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                Підсумки
              </div>
            )}
          </div>
        ) : (
          /* Ceremony Title / Climax Marquee */
          <>
            {ceremonyStep < 3 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 150,
                  width: 1920,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 80,
                      lineHeight: 1,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}
                  >
                    {data?.voting.title || 'Номінація'}
                  </h1>
                  <span
                    style={{
                      height: 10,
                      width: '100%',
                      borderRadius: 999,
                      background: GRADIENT_MAIN,
                    }}
                  />
                </div>
              </div>
            ) : (
              /* Climax Header: Running Marquee */
              <>
                {/* Floating decor particles */}
                {decorConfetti.map((p, idx) => (
                  <span
                    key={idx}
                    className="confetti-decor"
                    style={
                      {
                        position: 'absolute',
                        left: p.x,
                        top: p.y,
                        width: p.s,
                        height: p.s,
                        background: p.c,
                        borderRadius: p.s > 18 ? 4 : 2,
                        animationDelay: `${p.d}s`,
                        ['--r' as string]: `${p.r}deg`,
                        zIndex: 1,
                      } as React.CSSProperties
                    }
                  />
                ))}

                {/* Marquee Banner */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 144,
                    width: 1920,
                    height: 88,
                    overflow: 'hidden',
                    background: GRADIENT_MAIN,
                    zIndex: 2,
                  }}
                >
                  <div
                    className="flex w-max h-full items-center animate-marquee"
                    style={{ width: 'max-content' }}
                  >
                    {[...Array(12)].map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 36, paddingRight: 36 }}>
                        <span
                          style={{
                            fontSize: 40,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            color: '#000000',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Вітаємо переможців
                        </span>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#000000',
                            flexShrink: 0,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Champion Badge over 1st place */}
                <div
                  style={{
                    position: 'absolute',
                    left: 660,
                    top: 268,
                    width: 600,
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 12,
                  }}
                >
                  <div
                    style={{
                      padding: '10px 30px',
                      borderRadius: 16,
                      border: '5px solid #101010',
                      background: GRADIENT_MAIN,
                      color: '#000000',
                      fontSize: 36,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Переможець
                  </div>
                </div>

                {/* Cheering Mascot Frog near winner */}
                <div
                  className="frog-float"
                  style={{
                    position: 'absolute',
                    left: 1182,
                    top: 238,
                    width: 72,
                    height: 72,
                    zIndex: 13,
                  }}
                >
                  <FrogMascot className="w-full h-full" />
                </div>
              </>
            )}
          </>
        )}

        {/* ================= LEADERBOARD CONTENT ================= */}
        {viewMode === 'leaderboard' ? (
          isLoading && !data ? (
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 304,
                width: 1280,
                height: 736,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
              }}
            >
              <div className="h-16 w-16 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin" />
              <div style={{ fontSize: 32, fontWeight: 700, color: '#cdcdcd' }}>
                Підключення до сцени…
              </div>
            </div>
          ) : error && !data ? (
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 304,
                width: 1280,
                height: 736,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: '#f87171' }}>{error}</div>
            </div>
          ) : candidateCount === 0 ? (
            /* Layout: 0 Candidates ("Очікування кандидатів") */
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 304,
                width: 1280,
                height: 736,
                boxSizing: 'border-box',
                border: '3px dashed #71717a',
                borderRadius: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 36,
                textAlign: 'center',
                padding: 48,
              }}
            >
              <div className="frog-big" style={{ width: 168, height: 168 }}>
                <FrogMascot className="w-full h-full" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
                  Очікування кандидатів
                </div>
                <div style={{ maxWidth: 900, fontSize: 38, fontWeight: 700, lineHeight: 1.25, color: '#ffffff' }}>
                  Рейтинг з’явиться тут, щойно додадуть перших учасників
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, height: 44, alignItems: 'flex-end' }} aria-hidden="true">
                <span className="px1" style={{ width: 26, height: 26, background: '#2eff97' }} />
                <span className="px2" style={{ width: 26, height: 26, background: '#36dfff' }} />
                <span className="px3" style={{ width: 26, height: 26, background: '#ad46ff' }} />
              </div>
            </div>
          ) : candidateCount <= 4 ? (
            /* Layout 1a: 2–4 Candidates (Cards Grid) */
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 304,
                width: 1280,
                height: 736,
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(2, candidateCount)}, minmax(0, 1fr))`,
                gap: 24,
              }}
            >
              {candidates.slice(0, 4).map((c, i) => {
                const isLeader = i === 0 && (c.votesCount > 0 || isClosed);
                const rank = i + 1;
                const pct = Math.round(c.percentage);
                const photoH = candidateCount <= 2 ? 430 : candidateCount === 3 ? 410 : 390;
                const nameSize = candidateCount <= 2 ? 44 : candidateCount === 3 ? 38 : 30;
                const pctSize = candidateCount <= 2 ? 96 : candidateCount === 3 ? 84 : 72;

                return (
                  <div
                    key={c.id}
                    style={{
                      boxSizing: 'border-box',
                      height: 736,
                      padding: isLeader ? 4 : 3,
                      borderRadius: 20,
                      background: isLeader ? GRADIENT_MAIN : '#52525b',
                    }}
                  >
                    <div
                      style={{
                        boxSizing: 'border-box',
                        height: '100%',
                        borderRadius: 17,
                        background: '#101010',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                      }}
                    >
                      {/* Photo Container */}
                      <div
                        style={{
                          position: 'relative',
                          height: photoH,
                          flexShrink: 0,
                          borderRadius: 12,
                          overflow: 'hidden',
                          background: '#1d1d24',
                        }}
                      >
                        {c.photoUrl ? (
                          <>
                            <img
                              src={mediaUrl(c.photoUrl) || c.photoUrl}
                              alt=""
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'blur(28px) brightness(0.5)',
                                transform: 'scale(1.25)',
                              }}
                            />
                            <img
                              src={mediaUrl(c.photoUrl) || c.photoUrl}
                              alt={c.name}
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                opacity: 0.3,
                                background: GRADIENT_MAIN,
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: candidateCount <= 2 ? 88 : 72,
                                fontWeight: 900,
                                letterSpacing: '-0.03em',
                                lineHeight: 1,
                              }}
                            >
                              {getInitials(c.name)}
                            </div>
                          </>
                        )}

                        {/* Rank Badge */}
                        {isLeader ? (
                          <div
                            style={{
                              position: 'absolute',
                              left: 12,
                              top: 12,
                              height: 60,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '0 18px',
                              borderRadius: 12,
                              background: GRADIENT_MAIN,
                              color: '#000000',
                              fontSize: 36,
                              fontWeight: 900,
                            }}
                          >
                            1
                            <span
                              style={{
                                fontSize: candidateCount === 4 ? 22 : 26,
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              Лідер
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              left: 12,
                              top: 12,
                              width: 60,
                              height: 60,
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 12,
                              border: '3px solid #ffffff',
                              background: '#0c0a09',
                              color: '#ffffff',
                              fontSize: 34,
                              fontWeight: 900,
                            }}
                          >
                            {rank}
                          </div>
                        )}
                      </div>

                      {/* Name & Description */}
                      <div
                        style={{
                          flexGrow: 1,
                          minHeight: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div
                          className="line-clamp-2"
                          style={{
                            fontSize: nameSize,
                            fontWeight: 800,
                            lineHeight: 1.15,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {c.name}
                        </div>
                      </div>

                      {/* Percentage & Progress Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {isLeader ? (
                          <div
                            className="text-gradient"
                            style={{ fontSize: pctSize, fontWeight: 900, lineHeight: 1 }}
                          >
                            {pct}%
                          </div>
                        ) : (
                          <div style={{ fontSize: pctSize, fontWeight: 900, lineHeight: 1, color: '#ffffff' }}>
                            {pct}%
                          </div>
                        )}

                        <div
                          style={{
                            height: 16,
                            borderRadius: 999,
                            background: '#3f3f46',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(pct, 1)}%`,
                              borderRadius: 999,
                              background: GRADIENT_MAIN,
                              transition: 'width 0.7s ease-out',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            height: 34,
                            fontSize: 28,
                            fontWeight: 700,
                            lineHeight: '34px',
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {hideCounts ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                color: '#a1a1aa',
                                fontSize: 22,
                                fontWeight: 700,
                                background: 'rgba(255, 255, 255, 0.06)',
                                padding: '3px 12px',
                                borderRadius: 8,
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              Голоси приховано
                            </span>
                          ) : (
                            `${fmtNumber(c.votesCount)} ${pluralVotes(c.votesCount)}`
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : candidateCount <= 8 ? (
            /* Layout 1b: 5–8 Candidates (Horizontal Rows) */
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 304,
                width: 1280,
                height: 736,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {(() => {
                const n = candidateCount;
                const rowH = Math.min(120, Math.floor((736 - (n - 1) * 12) / n));
                const thumbH = Math.max(48, rowH - 22);

                return candidates.map((c, i) => {
                  const isLeader = i === 0 && (c.votesCount > 0 || isClosed);
                  const rank = i + 1;
                  const pct = Math.round(c.percentage);

                  return (
                    <div
                      key={c.id}
                      style={{
                        flexShrink: 0,
                        height: rowH,
                        boxSizing: 'border-box',
                        padding: isLeader ? 4 : 2,
                        borderRadius: 16,
                        background: isLeader ? GRADIENT_MAIN : '#3f3f46',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          boxSizing: 'border-box',
                          borderRadius: 13,
                          background: isLeader ? '#101010' : '#16161b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 20,
                          padding: '0 28px 0 14px',
                        }}
                      >
                        {/* Rank Badge */}
                        {isLeader ? (
                          <div
                            style={{
                              flexShrink: 0,
                              width: 64,
                              height: 64,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 12,
                              background: GRADIENT_MAIN,
                              color: '#000000',
                              fontSize: 38,
                              fontWeight: 900,
                            }}
                          >
                            1
                          </div>
                        ) : (
                          <div
                            style={{
                              flexShrink: 0,
                              width: 64,
                              height: 64,
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 12,
                              border: '3px solid #ffffff',
                              background: '#0c0a09',
                              color: '#ffffff',
                              fontSize: 36,
                              fontWeight: 900,
                            }}
                          >
                            {rank}
                          </div>
                        )}

                        {/* Thumbnail */}
                        <div
                          style={{
                            flexShrink: 0,
                            position: 'relative',
                            width: 60,
                            height: thumbH,
                            borderRadius: 10,
                            overflow: 'hidden',
                            background: '#1d1d24',
                          }}
                        >
                          {c.photoUrl ? (
                            <img
                              src={mediaUrl(c.photoUrl) || c.photoUrl}
                              alt={c.name}
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: '50% 22%',
                              }}
                            />
                          ) : (
                            <>
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  opacity: 0.3,
                                  background: GRADIENT_MAIN,
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontSize: 24,
                                  fontWeight: 900,
                                }}
                              >
                                {getInitials(c.name)}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Middle: Name & Progress Bar */}
                        <div
                          style={{
                            flexGrow: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: rowH > 90 ? 12 : 6,
                          }}
                        >
                          <div
                            style={{
                              fontSize: rowH > 90 ? 34 : 28,
                              fontWeight: 800,
                              lineHeight: 1.1,
                              letterSpacing: '-0.01em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{
                              height: 14,
                              borderRadius: 999,
                              background: '#3f3f46',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.max(pct, 1)}%`,
                                borderRadius: 999,
                                background: GRADIENT_MAIN,
                                transition: 'width 0.7s ease-out',
                              }}
                            />
                          </div>
                        </div>

                        {/* Right: Percentage & Votes Count */}
                        <div
                          style={{
                            flexShrink: 0,
                            width: 176,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 2,
                            textAlign: 'right',
                          }}
                        >
                          {isLeader ? (
                            <div
                              className="text-gradient"
                              style={{ fontSize: 56, fontWeight: 900, lineHeight: 1 }}
                            >
                              {pct}%
                            </div>
                          ) : (
                            <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: '#ffffff' }}>
                              {pct}%
                            </div>
                          )}

                          {hideCounts ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                color: '#a1a1aa',
                                fontSize: 18,
                                fontWeight: 700,
                                background: 'rgba(255, 255, 255, 0.06)',
                                padding: '2px 8px',
                                borderRadius: 6,
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              Приховано
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: 24,
                                fontWeight: 700,
                                lineHeight: 1.1,
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fmtNumber(c.votesCount)} {pluralVotes(c.votesCount)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            /* Layout 1c: 9+ Candidates (Top 3 Cards + Paginated Carousel Rows) */
            <>
              {/* Left Column: Top-3 Cards */}
              <div
                style={{
                  position: 'absolute',
                  left: 60,
                  top: 304,
                  width: 600,
                  height: 736,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {candidates.slice(0, 3).map((t, i) => {
                  const isLeader = i === 0;
                  const rank = i + 1;
                  const pct = Math.round(t.percentage);

                  return (
                    <div
                      key={t.id}
                      style={{
                        flexShrink: 0,
                        height: 234,
                        boxSizing: 'border-box',
                        padding: isLeader ? 4 : 3,
                        borderRadius: 20,
                        background: isLeader ? GRADIENT_MAIN : '#3f3f46',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          boxSizing: 'border-box',
                          borderRadius: 17,
                          background: '#101010',
                          padding: 14,
                          display: 'flex',
                          gap: 20,
                        }}
                      >
                        {/* Photo Box */}
                        <div
                          style={{
                            position: 'relative',
                            flexShrink: 0,
                            width: 150,
                            height: '100%',
                            borderRadius: 12,
                            overflow: 'hidden',
                            background: '#1d1d24',
                          }}
                        >
                          {t.photoUrl ? (
                            <>
                              <img
                                src={mediaUrl(t.photoUrl) || t.photoUrl}
                                alt=""
                                aria-hidden="true"
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  filter: 'blur(22px) brightness(0.5)',
                                  transform: 'scale(1.25)',
                                }}
                              />
                              <img
                                src={mediaUrl(t.photoUrl) || t.photoUrl}
                                alt={t.name}
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                }}
                              />
                            </>
                          ) : (
                            <>
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  opacity: 0.3,
                                  background: GRADIENT_MAIN,
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontSize: 48,
                                  fontWeight: 900,
                                }}
                              >
                                {getInitials(t.name)}
                              </div>
                            </>
                          )}

                          {/* Rank badge */}
                          {isLeader ? (
                            <div
                              style={{
                                position: 'absolute',
                                left: 8,
                                top: 8,
                                width: 52,
                                height: 52,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 10,
                                background: GRADIENT_MAIN,
                                color: '#000000',
                                fontSize: 32,
                                fontWeight: 900,
                              }}
                            >
                              1
                            </div>
                          ) : (
                            <div
                              style={{
                                position: 'absolute',
                                left: 8,
                                top: 8,
                                width: 52,
                                height: 52,
                                boxSizing: 'border-box',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 10,
                                border: '3px solid #ffffff',
                                background: '#0c0a09',
                                color: '#ffffff',
                                fontSize: 30,
                                fontWeight: 900,
                              }}
                            >
                              {rank}
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div
                          style={{
                            flexGrow: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '4px 6px 4px 0',
                          }}
                        >
                          <div
                            className="line-clamp-2"
                            style={{
                              fontSize: 31,
                              fontWeight: 800,
                              lineHeight: 1.12,
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {t.name}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              {isLeader ? (
                                <div
                                  className="text-gradient"
                                  style={{ fontSize: 60, fontWeight: 900, lineHeight: 1 }}
                                >
                                  {pct}%
                                </div>
                              ) : (
                                <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1, color: '#ffffff' }}>
                                  {pct}%
                                </div>
                              )}

                              {hideCounts ? (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: '#a1a1aa',
                                    fontSize: 20,
                                    fontWeight: 700,
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    padding: '2px 10px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                  </svg>
                                  Приховано
                                </div>
                              ) : (
                                <div
                                  style={{
                                    fontSize: 26,
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {fmtNumber(t.votesCount)} {pluralVotes(t.votesCount)}
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                height: 14,
                                borderRadius: 999,
                                background: '#3f3f46',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.max(pct, 1)}%`,
                                  borderRadius: 999,
                                  background: GRADIENT_MAIN,
                                  transition: 'width 0.7s ease-out',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Paginated Rows for Ranks 4+ */}
              <div
                style={{
                  position: 'absolute',
                  left: 684,
                  top: 304,
                  width: 656,
                  height: 736,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Header & Segments Bar */}
                {(() => {
                  const startIdx = pageIndex * pageSize;
                  const currentSlice = restCandidates.slice(startIdx, startIdx + pageSize);
                  const pageFrom = startIdx + 4;
                  const pageTo = Math.min(startIdx + pageSize + 3, candidateCount);

                  return (
                    <>
                      <div
                        style={{
                          height: 52,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                        }}
                      >
                        <div style={{ fontSize: 32, fontWeight: 800, whiteSpace: 'nowrap' }}>
                          Місця {pageFrom}–{pageTo}{' '}
                          <span style={{ color: '#a1a1aa', fontWeight: 700 }}>з {candidateCount}</span>
                        </div>

                        {/* Page indicator bars */}
                        {pageCount > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {[...Array(pageCount)].map((_, sIdx) => (
                              <div
                                key={sIdx}
                                onClick={() => setPageIndex(sIdx)}
                                style={{
                                  position: 'relative',
                                  width: 84,
                                  height: 12,
                                  borderRadius: 999,
                                  background: '#3f3f46',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                }}
                              >
                                {sIdx === pageIndex ? (
                                  <div
                                    className={isPageTimerPaused ? '' : 'page-timer'}
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      height: '100%',
                                      width: isPageTimerPaused ? '100%' : undefined,
                                      borderRadius: 999,
                                      background: GRADIENT_MAIN,
                                    }}
                                  />
                                ) : sIdx < pageIndex ? (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: 0,
                                      height: '100%',
                                      width: '100%',
                                      borderRadius: 999,
                                      background: '#ffffff',
                                    }}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Rows for active page */}
                      {currentSlice.map((r, rIdx) => {
                        const globalRank = startIdx + 4 + rIdx;
                        const pct = Math.round(r.percentage);

                        return (
                          <div
                            key={r.id}
                            style={{
                              flexShrink: 0,
                              height: 74,
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 16,
                              padding: '0 22px 0 18px',
                              borderRadius: 14,
                              border: '2px solid #3f3f46',
                              background: '#16161b',
                            }}
                          >
                            <div
                              style={{
                                flexShrink: 0,
                                width: 52,
                                fontSize: 32,
                                fontWeight: 900,
                                color: '#ffffff',
                              }}
                            >
                              {globalRank}
                            </div>
                            <div
                              className="line-clamp-2"
                              style={{
                                flexGrow: 1,
                                minWidth: 0,
                                fontSize: 28,
                                fontWeight: 800,
                                lineHeight: 1.08,
                              }}
                            >
                              {r.name}
                            </div>
                            {hideCounts ? (
                              <div
                                style={{
                                  flexShrink: 0,
                                  width: 44,
                                  display: 'flex',
                                  justifyContent: 'center',
                                  color: '#71717a',
                                }}
                                title="Голоси приховано"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </div>
                            ) : (
                              <div
                                style={{
                                  flexShrink: 0,
                                  width: 80,
                                  textAlign: 'right',
                                  fontSize: 24,
                                  fontWeight: 700,
                                  color: '#d4d4d8',
                                }}
                              >
                                {r.votesCount}
                              </div>
                            )}
                            <div
                              style={{
                                flexShrink: 0,
                                width: 96,
                                textAlign: 'right',
                                fontSize: 40,
                                fontWeight: 900,
                                lineHeight: 1,
                              }}
                            >
                              {pct}%
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </>
          )
        ) : (
          /* ================= MODE: CEREMONY / PODIUM REVEAL ================= */
          <div style={{ position: 'absolute', inset: 0 }}>
            {ceremonySlots.map((s) => {
              const winner = winners[s.place];
              const pct = winner ? Math.round(winner.percentage) : 0;
              const isRevealed = ceremonyStep >= s.revealAt && !!winner;
              const isFirst = s.place === 1;
              const isNextToReveal = s.revealAt === ceremonyStep + 1;

              return (
                <div
                  key={s.place}
                  style={{
                    position: 'absolute',
                    left: s.left,
                    top: s.top,
                    width: s.width,
                    height: 1040 - s.top,
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: isFirst ? 11 : 10,
                  }}
                >
                  {isRevealed && winner ? (
                    /* Revealed State */
                    <div
                      style={{
                        flexGrow: 1,
                        minHeight: 0,
                        boxSizing: 'border-box',
                        padding: `${s.pad}px ${s.pad}px 0 ${s.pad}px`,
                        borderRadius: '20px 20px 0 0',
                        background: s.grad,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          boxSizing: 'border-box',
                          borderRadius: '15px 15px 0 0',
                          background: '#101010',
                          padding: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 16,
                          textAlign: 'center',
                        }}
                      >
                        {/* Winner Photo */}
                        <div
                          style={{
                            position: 'relative',
                            flexGrow: 1,
                            minHeight: 0,
                            borderRadius: 12,
                            overflow: 'hidden',
                            background: '#1d1d24',
                          }}
                        >
                          {winner.photoUrl ? (
                            <>
                              <img
                                src={mediaUrl(winner.photoUrl) || winner.photoUrl}
                                alt=""
                                aria-hidden="true"
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  filter: 'blur(30px) brightness(0.5)',
                                  transform: 'scale(1.25)',
                                }}
                              />
                              <img
                                src={mediaUrl(winner.photoUrl) || winner.photoUrl}
                                alt={winner.name}
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                }}
                              />
                            </>
                          ) : (
                            <>
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  opacity: 0.35,
                                  background: s.grad,
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontSize: 80,
                                  fontWeight: 900,
                                }}
                              >
                                {getInitials(winner.name)}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Name */}
                        <div
                          className="line-clamp-2"
                          style={{
                            flexShrink: 0,
                            fontSize: s.nameSize,
                            fontWeight: 800,
                            lineHeight: 1.1,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {winner.name}
                        </div>

                        {/* Percentage & Votes Count */}
                        <div
                          style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'center',
                            gap: 20,
                          }}
                        >
                          {isFirst ? (
                            <span
                              className="text-gradient"
                              style={{ fontSize: s.pctSize, fontWeight: 900, lineHeight: 1 }}
                            >
                              {pct}%
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: s.pctSize,
                                fontWeight: 900,
                                lineHeight: 1,
                                color: '#ffffff',
                              }}
                            >
                              {pct}%
                            </span>
                          )}

                          {hideCounts && ceremonyStep < 3 ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                color: '#a1a1aa',
                                fontSize: 24,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              Приховано
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 30,
                                fontWeight: 700,
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fmtNumber(winner.votesCount)} {pluralVotes(winner.votesCount)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Hidden Mystery Slot */
                    <div
                      style={{
                        flexGrow: 1,
                        minHeight: 0,
                        boxSizing: 'border-box',
                        border: `4px dashed ${s.keyColor}`,
                        borderBottom: 'none',
                        borderRadius: '20px 20px 0 0',
                        background: '#16161b',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        textAlign: 'center',
                        padding: 24,
                      }}
                    >
                      <div
                        className={isNextToReveal ? 'q-next' : ''}
                        style={{
                          fontSize: s.qSize,
                          fontWeight: 900,
                          lineHeight: 1,
                          color: s.keyColor,
                        }}
                      >
                        ?
                      </div>
                      <div
                        style={{
                          fontSize: 38,
                          fontWeight: 800,
                          lineHeight: 1.15,
                          color: '#ffffff',
                        }}
                      >
                        {s.question}
                      </div>
                    </div>
                  )}

                  {/* Pedestal Bottom Base */}
                  <div
                    style={{
                      flexShrink: 0,
                      height: s.pedH,
                      borderRadius: '0 0 20px 20px',
                      background: s.grad,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000000',
                      fontSize: s.pedSize,
                      fontWeight: 900,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {s.place} місце
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= RIGHT SIDEBAR ================= */}
        {viewMode === 'leaderboard' && (
          <div
            style={{
              position: 'absolute',
              left: 1380,
              top: 160,
              width: 480,
              height: 880,
              boxSizing: 'border-box',
              padding: 4,
              borderRadius: 20,
              background: GRADIENT_MAIN,
              zIndex: 10,
            }}
          >
            {isClosed ? (
              /* State: Voting Closed */
              <div
                style={{
                  height: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 17,
                  background: '#101010',
                  padding: '48px 40px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 40,
                  textAlign: 'center',
                }}
              >
                {/* Large Gradient Checkmark Icon */}
                <div
                  style={{
                    width: 136,
                    height: 136,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: GRADIENT_MAIN,
                  }}
                >
                  <svg
                    width="76"
                    height="76"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>

                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 800,
                    lineHeight: 1.08,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Голосування завершено
                </div>

                {totalVotes > 0 && (
                  <div
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: 3,
                      borderRadius: 16,
                      background: GRADIENT_MAIN,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 13,
                        background: '#101010',
                        padding: '26px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <div
                        className="text-gradient"
                        style={{ fontSize: 104, fontWeight: 900, lineHeight: 1 }}
                      >
                        {fmtNumber(totalVotes)}
                      </div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#ffffff' }}>
                        Всього голосів
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    color: '#ffffff',
                  }}
                >
                  Дякуємо всім, хто проголосував!
                </div>
              </div>
            ) : (
              /* State: Active / Upcoming - QR Code for Audience */
              <div
                style={{
                  height: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 17,
                  background: '#101010',
                  padding: '40px 36px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 32,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Голосуй у Telegram-боті
                </div>

                {/* QR Code Container */}
                <div
                  style={{
                    width: 400,
                    height: 400,
                    boxSizing: 'border-box',
                    padding: 20,
                    borderRadius: 16,
                    background: '#ffffff',
                  }}
                >
                  <img
                    src={qrApiUrl}
                    alt="QR-код для голосування в Telegram-боті"
                    style={{ width: 360, height: 360, display: 'block' }}
                  />
                </div>

                {/* Bot pill */}
                <div
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    padding: '20px 16px',
                    borderRadius: 16,
                    background: GRADIENT_MAIN,
                    color: '#000000',
                    fontSize: 38,
                    fontWeight: 900,
                  }}
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22 11 13 2 9 22 2z" />
                  </svg>
                  <span>@{botUsername}</span>
                </div>

                <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, color: '#ffffff' }}>
                  Наведи камеру телефона на код
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= FLOATING OPERATOR TOOLBAR ================= */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 p-3 rounded-2xl border-2 border-[#3f3f46] bg-[#111114]/95 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] transition-all duration-300 font-sans ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
      >
        {/* Mode Selector */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#1d1d24]">
          <button
            type="button"
            onClick={() => {
              stopConfetti();
              setViewMode('leaderboard');
            }}
            className={`flex items-center gap-2 h-11 px-5 rounded-lg text-sm font-extrabold transition-all cursor-pointer ${
              viewMode === 'leaderboard'
                ? 'bg-gradient-main text-black shadow-md'
                : 'text-white hover:text-brand-cyan'
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
            <span>Рейтинг</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopConfetti();
              setViewMode('ceremony');
            }}
            className={`flex items-center gap-2 h-11 px-5 rounded-lg text-sm font-extrabold transition-all cursor-pointer ${
              viewMode === 'ceremony'
                ? 'bg-gradient-main text-black shadow-md'
                : 'text-white hover:text-brand-cyan'
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
              <path d="M17 5h3v2a3 3 0 0 1-3 3" />
              <path d="M7 5H4v2a3 3 0 0 0 3 3" />
            </svg>
            <span>Церемонія</span>
          </button>
        </div>

        <div className="w-0.5 h-9 bg-[#3f3f46]" />

        {/* Ceremony Specific Controls */}
        {viewMode === 'ceremony' && (
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  stopConfetti();
                  setCeremonyStep(1);
                  fireConfetti('bronze');
                }}
                className={`px-3.5 h-11 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                  ceremonyStep >= 1
                    ? 'border-[#ff8904] bg-[#ff8904]/20 text-[#ff8904]'
                    : 'border-white/10 hover:border-white/30 text-white/70'
                }`}
                title="Відкрити 3 місце (Бронза)"
              >
                🥉 3 місце
              </button>
              <button
                type="button"
                onClick={() => {
                  stopConfetti();
                  setCeremonyStep(2);
                  fireConfetti('silver');
                }}
                className={`px-3.5 h-11 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                  ceremonyStep >= 2
                    ? 'border-[#36dfff] bg-[#36dfff]/20 text-[#36dfff]'
                    : 'border-white/10 hover:border-white/30 text-white/70'
                }`}
                title="Відкрити 2 місце (Срібло)"
              >
                🥈 2 місце
              </button>
              <button
                type="button"
                onClick={() => {
                  stopConfetti();
                  setCeremonyStep(3);
                  fireConfetti('gold');
                }}
                className={`px-4 h-11 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                  ceremonyStep >= 3
                    ? 'border-brand-green bg-gradient-main text-black shadow-[0_0_20px_rgba(46,255,151,0.5)]'
                    : 'border-brand-green/50 bg-brand-green/10 text-brand-green hover:bg-brand-green/20'
                }`}
                title="Відкрити 1 місце (Кульмінація!)"
              >
                👑 1 місце!
              </button>
              <button
                type="button"
                onClick={() => {
                  stopConfetti();
                  setCeremonyStep(0);
                }}
                className="px-3 h-11 rounded-xl text-xs font-bold text-white/60 hover:text-white transition-colors cursor-pointer"
                title="Скинути всі відкриття"
              >
                Скинути
              </button>
              <button
                type="button"
                onClick={() => {
                  stopConfetti();
                  fireConfetti('all');
                }}
                className="px-3.5 h-11 rounded-xl text-xs font-bold border border-brand-purple/40 bg-brand-purple/15 text-brand-purple hover:bg-brand-purple/25 transition-all cursor-pointer"
                title="Запустити конфеті"
              >
                🎉 Салют
              </button>
            </div>
            <div className="w-0.5 h-9 bg-[#3f3f46]" />
          </>
        )}

        {/* Carousel controls for >8 candidates */}
        {viewMode === 'leaderboard' && candidateCount > 8 && pageCount > 1 && (
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPageIndex((p) => (p - 1 + pageCount) % pageCount)}
                className="h-11 px-3 rounded-xl border border-white/10 bg-[#1d1d24] text-white hover:border-white/30 text-xs font-bold cursor-pointer"
                title="Попередня сторінка"
              >
                ◀ Стор.
              </button>
              <button
                type="button"
                onClick={() => setIsPageTimerPaused(!isPageTimerPaused)}
                className={`h-11 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isPageTimerPaused
                    ? 'border-brand-orange text-brand-orange bg-brand-orange/10'
                    : 'border-white/10 text-white/70 bg-[#1d1d24]'
                }`}
                title="Пауза / Авто-прокрутка сторінок"
              >
                {isPageTimerPaused ? '▶ Старт' : '⏸ Пауза'}
              </button>
              <button
                type="button"
                onClick={() => setPageIndex((p) => (p + 1) % pageCount)}
                className="h-11 px-3 rounded-xl border border-white/10 bg-[#1d1d24] text-white hover:border-white/30 text-xs font-bold cursor-pointer"
                title="Наступна сторінка"
              >
                Стор. ▶
              </button>
            </div>
            <div className="w-0.5 h-9 bg-[#3f3f46]" />
          </>
        )}

        {/* Hide Counts Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={hideCounts}
          onClick={() =>
            setManualHideOverride((prev) => (prev !== null ? !prev : !isAutoThresholdReached))
          }
          className="flex items-center gap-3 h-11 px-4 rounded-xl bg-[#1d1d24] text-white text-sm font-extrabold cursor-pointer transition-colors hover:bg-[#25252e]"
          title={
            isAutoThresholdReached
              ? 'Голоси кандидатів приховано автоматично (проголосувало понад 49% виборців). Натисніть, щоб змінити.'
              : 'Приховати точну кількість голосів кандидатів для збереження інтриги'
          }
        >
          <span
            style={{
              position: 'relative',
              width: 44,
              height: 24,
              borderRadius: 999,
              background: hideCounts ? GRADIENT_MAIN : '#3f3f46',
              transition: 'background 0.3s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: hideCounts ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: hideCounts ? '#0c0a09' : '#ffffff',
                transition: 'left 0.25s ease',
              }}
            />
          </span>
          <span>
            {hideCounts
              ? `🔒 Голоси приховані ${
                  isAutoThresholdReached && manualHideOverride === null ? '(авто >49%)' : ''
                }`
              : '👁️ Показувати голоси'}
          </span>
        </button>

        {manualHideOverride !== null && (
          <button
            type="button"
            onClick={() => setManualHideOverride(null)}
            className="h-11 px-3 rounded-xl border border-white/10 bg-[#1d1d24] text-white/70 hover:text-white hover:border-white/30 text-xs font-bold cursor-pointer"
            title="Скинути до автоматичного режиму (>49%)"
          >
            Скинути в авто
          </button>
        )}

        <div className="w-0.5 h-9 bg-[#3f3f46]" />

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-2 h-11 px-4 rounded-xl bg-[#1d1d24] text-white text-sm font-extrabold cursor-pointer transition-colors hover:bg-[#25252e]"
          title="Повноекранний режим (F)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
          <span>{isFullscreen ? 'Вийти' : 'На весь екран'}</span>
        </button>
      </div>
    </div>
  );
}
