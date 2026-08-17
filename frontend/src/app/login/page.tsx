"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Procedural Ink Bleed Node
interface SplatNode {
  angle: number;
  currentR: number;
  maxR: number;
  speed: number;
}

// Procedural Ink Splash Mask
interface InkSplat {
  x: number;
  y: number;
  nodes: SplatNode[];
  alpha: number;
  life: number;
  decay?: number;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // References for Canvas Mask Reveal effect
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spotsRef = useRef<InkSplat[]>([]);
  const isHoveringFormRef = useRef(false);
  const lastSpawnRef = useRef({ x: -1000, y: -1000 });
  const formRef = useRef<HTMLDivElement | null>(null);

  // Spawn a smooth, bulbous procedural ink wash (thủy mặc) that bleeds outwards
  const spawnSpot = useCallback((x: number, y: number, isAuto = false) => {
    const nodes: SplatNode[] = [];
    const numNodes = 24; // Smooth out the curves
    const baseMaxR = isAuto ? 190 : 150;

    // Create 3 to 6 soft rounded lobes for the ink drop
    const lobeCount = 3 + Math.floor(Math.random() * 4);
    const phaseOffset = Math.random() * Math.PI * 2;

    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * Math.PI * 2;

      // Sine wave creates soft, rounded 'cauliflower' lobes of an ink wash
      const lobeEffect = Math.sin(angle * lobeCount + phaseOffset) * 0.25;
      // Very slight random noise for organic feel, no sharp spikes
      const randomNoise = (Math.random() - 0.5) * 0.15;

      const maxR = baseMaxR * (1.0 + lobeEffect + randomNoise);

      nodes.push({
        angle,
        currentR: 8, // Start slightly softer
        maxR,
        // Smooth, consistent explosive speed
        speed: 4.5 + Math.random() * 2.0,
      });
    }

    spotsRef.current.push({
      x,
      y,
      nodes,
      alpha: 1,
      life: 0,
    });

    // Safety cap: overflow splashes fade out smoothly, never pop out
    if (spotsRef.current.length > 120) {
      const oldest = spotsRef.current.shift();
      if (oldest) oldest.decay = 3;
    }
  }, []);

  // Track mouse movement to splash ink
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const dx = e.clientX - lastSpawnRef.current.x;
      const dy = e.clientY - lastSpawnRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Distinct splashes instead of a smeared trail
      if (dist > 45) {
        lastSpawnRef.current = { x: e.clientX, y: e.clientY };
        spawnSpot(e.clientX, e.clientY);
      }
    },
    [spawnSpot]
  );

  // High-DPI Canvas Mask Animation Loop (Clean, artifact-free eraser)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let autoTimer = 0;
    let dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Draw solid light cover background (#f4f7f5)
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#f4f7f5";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      // Auto-spawn reveal splashes when hovering over login form
      if (isHoveringFormRef.current && formRef.current) {
        autoTimer++;
        if (autoTimer % 18 === 0) {
          const rect = formRef.current.getBoundingClientRect();
          const rx = rect.left + Math.random() * rect.width;
          const ry = rect.top + Math.random() * rect.height;
          spawnSpot(rx, ry, true);
        }
      }

      // 2. Erase white cover using destination-out with pure clean gradient
      ctx.globalCompositeOperation = "destination-out";

      const spots = spotsRef.current;
      for (let i = spots.length - 1; i >= 0; i--) {
        const s = spots[i];

        // Quick dry so piled splashes vanish fast, reducing the layered look
        s.life += 0.024 * (s.decay ?? 1); // Controls fade out duration
        s.alpha = 1 - Math.pow(s.life, 2.5); // Stays opaque longer (ink drying)

        if (s.life >= 1 || s.alpha <= 0.005) {
          spots.splice(i, 1);
          continue;
        }

        let currentMaxRadius = 0;

        // Animate each vertex independently to simulate fluid ink bleeding
        for (const node of s.nodes) {
          const distLeft = node.maxR - node.currentR;
          node.currentR += distLeft * 0.06 + node.speed * (1 - s.life);
          node.speed *= 0.82; // Friction as ink absorbs into paper
          if (node.currentR > currentMaxRadius) currentMaxRadius = node.currentR;
        }

        ctx.save();
        ctx.translate(s.x, s.y);

        // Sharper radial gradient to simulate wet ink edges
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentMaxRadius * 1.1);
        grad.addColorStop(0, `rgba(0, 0, 0, ${s.alpha})`);
        grad.addColorStop(0.7, `rgba(0, 0, 0, ${s.alpha * 0.95})`);
        grad.addColorStop(0.9, `rgba(0, 0, 0, ${s.alpha * 0.25})`);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();

        const numNodes = s.nodes.length;

        // Mathematically correct smooth closed curve using midpoints
        const firstNode = s.nodes[0];
        const lastNode = s.nodes[numNodes - 1];
        const p0x = Math.cos(firstNode.angle) * firstNode.currentR;
        const p0y = Math.sin(firstNode.angle) * firstNode.currentR;
        const pNx = Math.cos(lastNode.angle) * lastNode.currentR;
        const pNy = Math.sin(lastNode.angle) * lastNode.currentR;

        const startX = (pNx + p0x) / 2;
        const startY = (pNy + p0y) / 2;
        ctx.moveTo(startX, startY);

        for (let j = 0; j < numNodes; j++) {
          const node = s.nodes[j];
          const currX = Math.cos(node.angle) * node.currentR;
          const currY = Math.sin(node.angle) * node.currentR;

          const nextNode = s.nodes[(j + 1) % numNodes];
          const nextX = Math.cos(nextNode.angle) * nextNode.currentR;
          const nextY = Math.sin(nextNode.angle) * nextNode.currentR;

          const midX = (currX + nextX) / 2;
          const midY = (currY + nextY) / 2;

          // Control point is the node, destination is the midpoint to next node
          ctx.quadraticCurveTo(currX, currY, midX, midY);
        }

        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [spawnSpot]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        user?: unknown;
      } | null;
      if (!response.ok) {
        setError(payload?.message ?? "Tài khoản hoặc mật khẩu không đúng.");
        setBusy(false);
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng kiểm tra backend và thử lại.");
      setBusy(false);
    }
  };

  return (
    <main
      onMouseMove={handleMouseMove}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f7f5] px-4 font-sans selection:bg-forest-800 selection:text-white"
    >
      {/* Background Layer: Misty Pine Forest Image */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/forest-bg.jpg')" }}
      />

      {/* Top Cover Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />

      <div className="z-10 w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">


        {/* Form Card */}
        <div
          ref={formRef}
          onMouseEnter={() => {
            isHoveringFormRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveringFormRef.current = false;
          }}
          className="card border border-slate-200/80 bg-white/90 p-8 shadow-[0_8px_30px_rgb(15,61,36,0.08)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_12px_40px_rgb(15,61,36,0.12)]"
        >
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-ink">Đăng nhập</h2>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200/80 bg-red-50/80 p-3.5 text-xs font-medium text-red-700 animate-in fade-in slide-in-from-top-1">
              <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="label text-xs font-semibold">Tài khoản</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  className="input pl-10 h-11"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tên đăng nhập (owner)"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label text-xs font-semibold">Mật khẩu</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  className="input pl-10 pr-10 h-11"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.046 10.046 0 012.122-.387c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-4.225-4.225L3 3" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn w-full h-11 mt-2 text-sm font-semibold shadow-md hover:shadow-lg transition-all"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Đăng nhập hệ thống
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              )}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}
