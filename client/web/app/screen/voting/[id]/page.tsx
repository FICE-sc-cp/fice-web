'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { fice, mediaUrl, type VotingScreenData } from '@/lib/api';

export default function LiveVotingScreenPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<VotingScreenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Screen modes
  const [viewMode, setViewMode] = useState<'leaderboard' | 'ceremony'>('leaderboard');
  const [hideCounts, setHideCounts] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Ceremony reveal state: 0 = hidden, 1 = 3rd revealed, 2 = 2nd revealed, 3 = 1st revealed (champion!)
  const [ceremonyStep, setCeremonyStep] = useState<number>(0);

  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch live screen data
  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fice.votingScreen(id);
      setData(res);
      setLastUpdated(new Date());
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

  // Handle Fullscreen toggle
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

  // Auto-hide controls when idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  // ================= EXTENDED MULTI-WAVE CONFETTI ENGINE (8s Celebration) =================
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

  const spawnConfettiWave = useCallback((canvas: HTMLCanvasElement, count = 120) => {
    const colors = [
      '#FFD700', // Gold
      '#FFF490', // Light Gold
      '#00f0ff', // Cyan
      '#a855f7', // Purple
      '#ec4899', // Pink
      '#22c55e', // Green
      '#ffffff', // White
    ];

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
        // Top rain
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

  const fireConfetti = useCallback(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    celebrationEndRef.current = Date.now() + 16000;
    let lastWaveTime = 0;

    spawnConfettiWave(canvas, 200);

    if (confettiAnimRef.current) {
      cancelAnimationFrame(confettiAnimRef.current);
    }

    const render = () => {
      const now = Date.now();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (now < celebrationEndRef.current && now - lastWaveTime > 380) {
        spawnConfettiWave(canvas, 80);
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
          p.opacity -= 0.0035;
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
      }
    };

    render();
  }, [spawnConfettiWave]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'c' || e.key === 'C') {
        fireConfetti();
      } else if (e.key === '1') {
        setCeremonyStep(3);
        fireConfetti();
      } else if (e.key === '2') {
        setCeremonyStep(2);
      } else if (e.key === '3') {
        setCeremonyStep(1);
      } else if (e.key === ' ' || e.key === 'ArrowRight') {
        if (viewMode === 'ceremony') {
          setCeremonyStep((prev) => {
            const next = Math.min(3, prev + 1);
            if (next === 3) fireConfetti();
            return next;
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, fireConfetti]);

  const botUsername =
    process.env.NEXT_PUBLIC_USER_BOT_USERNAME || 'fice_event_bot';
  const qrTargetUrl = `https://t.me/${botUsername}?startapp=vote_${id}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=1&bgcolor=ffffff&color=000000&data=${encodeURIComponent(
    qrTargetUrl,
  )}`;

  const winners = data?.winners ?? [];
  const firstPlace = winners.find((w) => w.place === 1);
  const secondPlace = winners.find((w) => w.place === 2);
  const thirdPlace = winners.find((w) => w.place === 3);

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-screen w-full bg-[#080811] text-white flex flex-col justify-between overflow-hidden select-none font-sans"
    >
      {/* Background Ambience Glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[900px] rounded-full bg-purple-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 h-96 w-[700px] rounded-full bg-cyan-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-96 w-[700px] rounded-full bg-fuchsia-600/15 blur-[140px]" />

      {/* Confetti Canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      />

      {/* ================= TOP BAR ================= */}
      <header className="relative z-10 px-8 py-5 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <img
              src="/logo_white.png"
              alt="Студрада ФІОТ"
              className="h-10 lg:h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,240,255,0.35)]"
            />
          </div>
          <div>
            <div className="text-xs uppercase font-extrabold tracking-widest text-brand-cyan/80">
              {data?.voting.eventName || 'Студрада ФІОТ'}
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
              {data?.voting.title || 'Голосування'}
            </h1>
          </div>
        </div>

        {/* Center Live Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs lg:text-sm font-black uppercase tracking-wider ${
              data?.voting.status === 'ACTIVE'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'border-amber-500/50 bg-amber-500/10 text-amber-400'
            }`}
          >
            {data?.voting.status === 'ACTIVE' ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span>Голосування наживо</span>
              </>
            ) : (
              <>
                <span>🔒 Голосування закрито</span>
              </>
            )}
          </div>

          <div className="px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
            <span className="text-xs uppercase text-muted tracking-wider mr-2 font-bold">
              Всього голосів:
            </span>
            <span className="text-lg lg:text-xl font-black text-brand-cyan">
              {data?.voting.totalVotes ?? 0}
            </span>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="relative z-10 flex-1 px-8 py-6 flex flex-col justify-center">
        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-12 w-12 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin" />
            <p className="text-lg text-muted font-bold tracking-wide">
              Підключення до сцени…
            </p>
          </div>
        ) : error && !data ? (
          <div className="text-center py-20">
            <p className="text-xl text-red-400 font-bold">{error}</p>
          </div>
        ) : !data || data.candidates.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <div className="text-5xl">🎭</div>
            <h2 className="text-2xl font-black text-fg">Очікування кандидатів</h2>
            <p className="text-muted text-base">
              У цій номінації ще немає схвалених кандидатів для показу на сцені.
            </p>
          </div>
        ) : viewMode === 'leaderboard' ? (
          /* ================= MODE: LIVE LEADERBOARD ================= */
          <div className="max-w-7xl mx-auto w-full space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.candidates.map((c, index) => {
                const isTop1 = index === 0 && (c.votesCount > 0);
                const isTop2 = index === 1 && (c.votesCount > 0);
                const isTop3 = index === 2 && (c.votesCount > 0);

                return (
                  <div
                    key={c.id}
                    className={`relative overflow-hidden rounded-3xl border flex flex-col transition-all duration-500 backdrop-blur-lg ${
                      isTop1
                        ? 'border-amber-400/60 bg-gradient-to-b from-amber-500/20 via-black/60 to-black/80 shadow-[0_0_40px_rgba(245,158,11,0.25)]'
                        : isTop2
                        ? 'border-slate-300/40 bg-gradient-to-b from-slate-300/15 via-black/60 to-black/80'
                        : isTop3
                        ? 'border-amber-700/40 bg-gradient-to-b from-amber-700/15 via-black/60 to-black/80'
                        : 'border-white/15 bg-white/[0.04] hover:border-white/30'
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="absolute top-4 left-4 z-20">
                      <div
                        className={`h-9 w-9 rounded-2xl flex items-center justify-center font-black text-base shadow-xl ${
                          isTop1
                            ? 'bg-amber-400 text-black shadow-amber-400/50 ring-2 ring-amber-300'
                            : isTop2
                            ? 'bg-slate-200 text-black shadow-slate-200/40 ring-2 ring-slate-300'
                            : isTop3
                            ? 'bg-amber-700 text-white shadow-amber-700/40'
                            : 'bg-black/60 backdrop-blur-md text-white border border-white/20'
                        }`}
                      >
                        #{index + 1}
                      </div>
                    </div>

                    {/* Big Stage Candidate Photo */}
                    <div className="relative h-72 sm:h-80 lg:h-96 xl:h-[440px] w-full overflow-hidden bg-black/60 flex items-center justify-center">
                      {c.photoUrl ? (
                        <>
                          {/* Ambient blurred backdrop so photo is not cropped and fills the card */}
                          <img
                            src={mediaUrl(c.photoUrl) || c.photoUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none"
                          />
                          {/* Full uncropped photo */}
                          <img
                            src={mediaUrl(c.photoUrl) || c.photoUrl}
                            alt={c.name}
                            className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] transition-transform duration-700 hover:scale-105"
                          />
                        </>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-6xl text-muted/40">
                          🎭
                        </div>
                      )}
                      {/* Gradient overlay on bottom of photo */}
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none z-10" />

                      {/* Live Percentage tag on photo */}
                      <div className="absolute bottom-3 right-4 z-20 flex items-baseline gap-1">
                        <span className="text-3xl lg:text-4xl font-black text-brand-cyan drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
                          {c.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Candidate Details */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-black text-xl lg:text-2xl text-white truncate">
                            {c.name}
                          </h3>
                          {!hideCounts && (
                            <span className="shrink-0 text-xs sm:text-sm font-bold text-muted/90 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                              {c.votesCount}{' '}
                              {c.votesCount === 1
                                ? 'голос'
                                : c.votesCount >= 2 && c.votesCount <= 4
                                ? 'голоси'
                                : 'голосів'}
                            </span>
                          )}
                        </div>

                        {c.description && (
                          <p className="text-xs sm:text-sm text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                            {c.description}
                          </p>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isTop1
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_15px_rgba(245,158,11,0.8)]'
                              : 'bg-gradient-to-r from-cyan-500 to-brand-cyan shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                          }`}
                          style={{ width: `${Math.max(c.percentage, 1)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= MODE: CEREMONY / PODIUM REVEAL ================= */
          <div className="max-w-5xl mx-auto w-full flex flex-col items-center justify-center space-y-6">
            <div className="text-center space-y-1">
              <span className="text-xs uppercase font-black tracking-widest text-amber-400">
                Урочистий фінал
              </span>
              <h2 className="text-3xl lg:text-4xl font-black text-white">
                Переможці номінації
              </h2>
            </div>

            {/* The 3D Podium */}
            <div className="w-full grid grid-cols-3 gap-4 lg:gap-8 items-end pt-8">
              {/* 2ND PLACE (SILVER) */}
              <div className="flex flex-col items-center">
                {ceremonyStep >= 2 && secondPlace ? (
                  <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center space-y-3 mb-3">
                    <span className="text-3xl">🥈</span>
                    <div className="relative h-48 w-48 lg:h-64 lg:w-64 xl:h-72 xl:w-72 rounded-3xl overflow-hidden border-2 border-slate-300 shadow-[0_0_35px_rgba(203,213,225,0.4)] bg-black/60 flex items-center justify-center">
                      {secondPlace.photoUrl ? (
                        <>
                          <img
                            src={mediaUrl(secondPlace.photoUrl) || secondPlace.photoUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none"
                          />
                          <img
                            src={mediaUrl(secondPlace.photoUrl) || secondPlace.photoUrl}
                            alt={secondPlace.name}
                            className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
                          />
                        </>
                      ) : (
                        <div className="h-full w-full bg-slate-800 flex items-center justify-center text-5xl">
                          🎭
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-black text-lg lg:text-xl text-white">
                        {secondPlace.name}
                      </div>
                      <div className="text-sm font-bold text-slate-300">
                        {secondPlace.percentage}% {!hideCounts && `(${secondPlace.votesCount})`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-muted/40 text-sm font-bold">
                    <span className="text-2xl mb-1 opacity-40">🔒</span>
                    2 місце
                  </div>
                )}
                {/* Pedestal */}
                <div className="w-full h-36 lg:h-44 rounded-t-3xl border-t-2 border-x-2 border-slate-300/40 bg-gradient-to-b from-slate-400/20 to-black/70 flex flex-col items-center justify-center shadow-lg">
                  <span className="text-4xl lg:text-6xl font-black text-slate-300/80">
                    2
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                    Срібло
                  </span>
                </div>
              </div>

              {/* 1ST PLACE (GOLD / CHAMPION) */}
              <div className="flex flex-col items-center -mt-8">
                {ceremonyStep >= 3 && firstPlace ? (
                  <div className="animate-in fade-in zoom-in duration-700 flex flex-col items-center space-y-3 mb-3">
                    <span className="text-5xl animate-bounce">👑</span>
                    <div className="relative h-64 w-64 lg:h-80 lg:w-80 xl:h-96 xl:w-96 rounded-3xl overflow-hidden border-4 border-amber-400 shadow-[0_0_60px_rgba(245,158,11,0.6)] bg-black/60 flex items-center justify-center">
                      {firstPlace.photoUrl ? (
                        <>
                          <img
                            src={mediaUrl(firstPlace.photoUrl) || firstPlace.photoUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-40 scale-125 pointer-events-none"
                          />
                          <img
                            src={mediaUrl(firstPlace.photoUrl) || firstPlace.photoUrl}
                            alt={firstPlace.name}
                            className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_10px_35px_rgba(0,0,0,0.85)]"
                          />
                        </>
                      ) : (
                        <div className="h-full w-full bg-amber-950 flex items-center justify-center text-6xl">
                          🏆
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-black text-xl lg:text-2xl text-amber-300 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                        {firstPlace.name}
                      </div>
                      <div className="text-base font-extrabold text-amber-200">
                        {firstPlace.percentage}% {!hideCounts && `(${firstPlace.votesCount} голосів)`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-56 flex flex-col items-center justify-center text-amber-400/40 text-sm font-bold">
                    <span className="text-4xl mb-1 opacity-40">👑</span>
                    Переможець
                  </div>
                )}
                {/* Pedestal */}
                <div className="w-full h-52 lg:h-64 rounded-t-3xl border-t-4 border-x-2 border-amber-400/60 bg-gradient-to-b from-amber-500/30 to-black/80 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.25)]">
                  <span className="text-6xl lg:text-8xl font-black text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                    1
                  </span>
                  <span className="text-xs uppercase font-black tracking-widest text-amber-300">
                    Переможець
                  </span>
                </div>
              </div>

              {/* 3RD PLACE (BRONZE) */}
              <div className="flex flex-col items-center">
                {ceremonyStep >= 1 && thirdPlace ? (
                  <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center space-y-3 mb-3">
                    <span className="text-3xl">🥉</span>
                    <div className="relative h-44 w-44 lg:h-56 lg:w-56 xl:h-64 xl:w-64 rounded-3xl overflow-hidden border-2 border-amber-700 shadow-[0_0_30px_rgba(180,83,9,0.35)] bg-black/60 flex items-center justify-center">
                      {thirdPlace.photoUrl ? (
                        <>
                          <img
                            src={mediaUrl(thirdPlace.photoUrl) || thirdPlace.photoUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none"
                          />
                          <img
                            src={mediaUrl(thirdPlace.photoUrl) || thirdPlace.photoUrl}
                            alt={thirdPlace.name}
                            className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
                          />
                        </>
                      ) : (
                        <div className="h-full w-full bg-amber-950 flex items-center justify-center text-5xl">
                          🎭
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-black text-base lg:text-lg text-white">
                        {thirdPlace.name}
                      </div>
                      <div className="text-sm font-bold text-amber-600">
                        {thirdPlace.percentage}% {!hideCounts && `(${thirdPlace.votesCount})`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-36 flex flex-col items-center justify-center text-muted/40 text-sm font-bold">
                    <span className="text-2xl mb-1 opacity-40">🔒</span>
                    3 місце
                  </div>
                )}
                {/* Pedestal */}
                <div className="w-full h-28 lg:h-36 rounded-t-3xl border-t-2 border-x-2 border-amber-700/40 bg-gradient-to-b from-amber-700/20 to-black/70 flex flex-col items-center justify-center shadow-lg">
                  <span className="text-4xl lg:text-5xl font-black text-amber-600/80">
                    3
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-amber-700">
                    Бронза
                  </span>
                </div>
              </div>
            </div>

            {/* Ceremony Controls */}
            <div className="flex flex-wrap items-center gap-2 pt-4">
              <button
                onClick={() => setCeremonyStep(1)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  ceremonyStep >= 1
                    ? 'border-amber-700 bg-amber-700/20 text-amber-400'
                    : 'border-white/10 hover:border-white/30 text-muted'
                }`}
              >
                🥉 3 місце
              </button>
              <button
                onClick={() => setCeremonyStep(2)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  ceremonyStep >= 2
                    ? 'border-slate-300 bg-slate-300/20 text-slate-200'
                    : 'border-white/10 hover:border-white/30 text-muted'
                }`}
              >
                🥈 2 місце
              </button>
              <button
                onClick={() => {
                  setCeremonyStep(3);
                  fireConfetti();
                }}
                className={`px-5 py-2 rounded-xl text-xs font-black border transition-all ${
                  ceremonyStep >= 3
                    ? 'border-amber-400 bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                    : 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                }`}
              >
                👑 1 місце (Переможець!)
              </button>
              <button
                onClick={() => {
                  setCeremonyStep(0);
                }}
                className="px-3 py-2 rounded-xl text-xs text-muted hover:text-white"
              >
                Скинути
              </button>
              <button
                onClick={fireConfetti}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
              >
                🎉 Салют конфеті
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ================= FOOTER / QR BAR ================= */}
      <footer className="relative z-10 px-8 py-4 flex items-center justify-between border-t border-white/10 bg-black/60 backdrop-blur-md">
        {/* Large Stage QR Code for Audience */}
        <div className="flex items-center gap-6">
          <div className="relative h-36 w-36 sm:h-44 sm:w-44 lg:h-52 lg:w-52 rounded-3xl overflow-hidden bg-white p-2.5 shadow-[0_0_40px_rgba(0,240,255,0.45)] border-4 border-brand-cyan shrink-0 flex items-center justify-center">
            <img
              src={qrApiUrl}
              alt="QR Code для голосування"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-brand-cyan/20 border border-brand-cyan/50 text-brand-cyan text-xs sm:text-sm lg:text-base font-black uppercase tracking-wider">
              <span>📱 СКАНУЙ ТА ГОЛОСУЙ</span>
            </div>
            <div className="text-base sm:text-lg lg:text-2xl font-black text-white">
              Наведи камеру або заходь у бота:
            </div>
            <div className="text-sm sm:text-base lg:text-lg font-mono text-brand-cyan font-black flex items-center gap-2.5">
              <img
                src="/logo_white.png"
                alt="Студрада ФІОТ"
                className="h-6 w-auto inline-block drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]"
              />
              <span>@{botUsername}</span>
            </div>
          </div>
        </div>

        {/* Live sync heartbeat */}
        <div className="text-right text-xs text-muted space-y-1">
          <div className="flex items-center justify-end gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-cyan animate-ping" />
            <span>Оновлено: {lastUpdated.toLocaleTimeString('uk-UA')}</span>
          </div>
        </div>
      </footer>

      {/* ================= FLOATING STAGE TOOLBAR ================= */}
      <div
        className={`fixed bottom-20 right-8 z-40 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/80 backdrop-blur-xl p-1.5 shadow-2xl transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={() => setViewMode('leaderboard')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'leaderboard'
              ? 'bg-brand-cyan text-black shadow-lg shadow-cyan-500/20'
              : 'text-muted hover:text-white'
          }`}
        >
          📊 Рейтинг
        </button>
        <button
          onClick={() => setViewMode('ceremony')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'ceremony'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
              : 'text-muted hover:text-white'
          }`}
        >
          🏆 Пʼєдестал
        </button>
        <div className="h-4 w-px bg-white/20" />
        <button
          onClick={() => setHideCounts(!hideCounts)}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
            hideCounts
              ? 'border-brand-cyan/40 text-brand-cyan bg-brand-cyan/10'
              : 'border-white/10 text-muted hover:text-white'
          }`}
          title="Приховати точну кількість голосів для інтриги"
        >
          {hideCounts ? '🔒 Голоси приховані' : '👁️ Показувати голоси'}
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-xl text-muted hover:text-white hover:bg-white/10"
          title="Повноекранний режим"
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>
    </div>
  );
}
