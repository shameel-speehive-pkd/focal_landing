"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Ship,
  Anchor,
  Truck,
  Shield,
  Compass,
  Users,
  Award,
  ArrowRight,
  ChevronDown,
  Globe,
  FileText,
  CheckCircle,
  Menu,
  X,
} from "lucide-react";

const TOTAL_FRAMES = 240;

interface Service {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
}

const NAV_LABELS = ["HOME", "THE APPROACH", "PILOTAGE", "PORT ARRIVAL", "DRY DOCK", "INLAND", "SERVICES"];

export default function FocalJourney() {
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<{ [key: string]: HTMLImageElement }>({});

  const [preloadProgress, setPreloadProgress] = useState(0);
  const [clip1Ready, setClip1Ready] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [currentClip, setCurrentClip] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(1);

  const [renderState, setRenderState] = useState({
    clipA: 1,
    frameA: 1,
    clipB: 1,
    frameB: 1,
    mix: 0,
  });
  const renderStateRef = useRef({
    clipA: 1,
    frameA: 1,
    clipB: 1,
    frameB: 1,
    mix: 0,
  });
  const transitionAnimRef = useRef<number | null>(null);

  const updateRenderState = (newState: Partial<typeof renderStateRef.current>) => {
    const updated = { ...renderStateRef.current, ...newState };
    renderStateRef.current = updated;
    setRenderState(updated);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [stats, setStats] = useState({ years: 0, offices: 0, portCalls: 0, vessels: 0 });

  const getFramePath = (clip: number, frame: number) => {
    const padded = String(frame).padStart(3, "0");
    return `/frames/clip${clip}/frames/ezgif-frame-${padded}.jpg`;
  };

  useEffect(() => {
    let loadedCount = 0;
    const batchSize = 25;

    const loadBatch = async (clip: number, start: number, end: number, onLoadOne: () => void) => {
      const promises = [];
      for (let f = start; f <= end; f++) {
        const src = getFramePath(clip, f);
        promises.push(
          new Promise<void>((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
              imagesRef.current[`${clip}-${f}`] = img;
              onLoadOne();
              resolve();
            };
            img.onerror = () => {
              const fallback = new Image();
              fallback.onload = () => {
                imagesRef.current[`${clip}-${f}`] = fallback;
                onLoadOne();
                resolve();
              };
              fallback.src = getFramePath(clip, 1);
            };
          })
        );
      }
      await Promise.all(promises);
    };

    const preloadClip1 = async () => {
      for (let i = 1; i <= TOTAL_FRAMES; i += batchSize) {
        const end = Math.min(i + batchSize - 1, TOTAL_FRAMES);
        await loadBatch(1, i, end, () => {
          loadedCount++;
          setPreloadProgress(Math.floor((loadedCount / TOTAL_FRAMES) * 100));
        });
      }
      setClip1Ready(true);
      preloadBackgroundClips();
    };

    const preloadBackgroundClips = async () => {
      for (let i = 1; i <= TOTAL_FRAMES; i += batchSize) {
        await loadBatch(2, i, Math.min(i + batchSize - 1, TOTAL_FRAMES), () => {});
      }
      for (let i = 1; i <= TOTAL_FRAMES; i += batchSize) {
        await loadBatch(3, i, Math.min(i + batchSize - 1, TOTAL_FRAMES), () => {});
      }
      for (let i = 1; i <= TOTAL_FRAMES; i += batchSize) {
        await loadBatch(4, i, Math.min(i + batchSize - 1, TOTAL_FRAMES), () => {});
      }
      for (let i = 1; i <= TOTAL_FRAMES; i += batchSize) {
        await loadBatch(5, i, Math.min(i + batchSize - 1, TOTAL_FRAMES), () => {});
      }
    };

    preloadClip1();
    return () => {
      if (transitionAnimRef.current) cancelAnimationFrame(transitionAnimRef.current);
    };
  }, []);

  const drawFramesBlended = (
    canvas: HTMLCanvasElement | null,
    clip1: number,
    frame1: number,
    clip2: number,
    frame2: number,
    mix: number
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const drawImg = (img: HTMLImageElement, alpha: number) => {
      ctx.globalAlpha = alpha;
      const imgRatio = img.width / img.height;
      const canvasRatio = width / height;
      let startX = 0, startY = 0, drawWidth = width, drawHeight = height;
      if (imgRatio > canvasRatio) {
        drawWidth = height * imgRatio;
        startX = (width - drawWidth) / 2;
      } else {
        drawHeight = width / imgRatio;
        startY = (height - drawHeight) / 2;
      }
      ctx.drawImage(img, startX, startY, drawWidth, drawHeight);
    };

    const getSafeImage = (clip: number, frame: number) => {
      const img = imagesRef.current[`${clip}-${frame}`];
      if (img && img.complete) return img;
      const fallback = imagesRef.current[`${clip}-1`];
      if (fallback && fallback.complete) return fallback;
      return null;
    };

    const img1 = getSafeImage(clip1, frame1);
    const img2 = getSafeImage(clip2, frame2);

    if (mix <= 0) {
      if (img1) drawImg(img1, 1.0);
    } else if (mix >= 1) {
      if (img2) drawImg(img2, 1.0);
    } else {
      if (img1) drawImg(img1, 1 - mix);
      if (img2) drawImg(img2, mix);
    }
    ctx.globalAlpha = 1.0;
  };

  const drawCurrentFrame = () => {
    const canvas = canvas1Ref.current;
    if (!canvas) return;
    const { clipA, frameA, clipB, frameB, mix } = renderStateRef.current;
    drawFramesBlended(canvas, clipA, frameA, clipB, frameB, mix);
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvas1Ref.current) {
        canvas1Ref.current.width = window.innerWidth;
        canvas1Ref.current.height = window.innerHeight;
        drawCurrentFrame();
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [clip1Ready]);

  useEffect(() => {
    drawCurrentFrame();
  }, [renderState]);

  const transitionTo = (targetClip: number, targetFrame: number, playFromStart = false) => {
    if (transitionAnimRef.current) {
      cancelAnimationFrame(transitionAnimRef.current);
      transitionAnimRef.current = null;
    }

    const { clipA, frameA, clipB, frameB, mix } = renderStateRef.current;

    let startClipA = clipA;
    let startFrameA = frameA;
    let startClipB = clipB;
    let startFrameB = frameB;
    let startMix = mix;
    let targetMix = 1;

    if (targetClip === clipB) {
      targetMix = 1;
    } else if (targetClip === clipA) {
      targetMix = 0;
    } else {
      if (mix > 0.5) {
        startClipA = clipB;
        startFrameA = frameB;
      } else {
        startClipA = clipA;
        startFrameA = frameA;
      }
      startClipB = targetClip;
      startFrameB = playFromStart ? 1 : targetFrame;
      startMix = 0;
      targetMix = 1;
    }

    updateRenderState({
      clipA: startClipA,
      frameA: startFrameA,
      clipB: startClipB,
      frameB: startFrameB,
      mix: startMix,
    });

    const mixDuration = 800; // 800ms crossfade
    const playDuration = playFromStart ? 3800 : 0; // 3800ms playback
    const totalDuration = Math.max(mixDuration, playDuration);

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      
      const mixProgress = Math.min(elapsed / mixDuration, 1);
      const mixEase = mixProgress < 0.5
        ? 2 * mixProgress * mixProgress
        : 1 - Math.pow(-2 * mixProgress + 2, 2) / 2;
      const currentMixVal = startMix + (targetMix - startMix) * mixEase;

      let currentFrameAVal = startFrameA;
      let currentFrameBVal = startFrameB;

      if (playFromStart) {
        const frameProgress = Math.min(elapsed / playDuration, 1);
        const frameEase = frameProgress < 0.5
          ? 4 * frameProgress * frameProgress * frameProgress
          : 1 - Math.pow(-2 * frameProgress + 2, 3) / 2;
        
        const calculatedFrame = Math.round(1 + (TOTAL_FRAMES - 1) * frameEase);
        
        if (targetMix === 1) {
          currentFrameBVal = calculatedFrame;
        } else {
          currentFrameAVal = calculatedFrame;
        }
      } else {
        if (targetMix === 1) {
          currentFrameBVal = targetFrame;
        } else {
          currentFrameAVal = targetFrame;
        }
      }

      updateRenderState({
        mix: currentMixVal,
        frameA: currentFrameAVal,
        frameB: currentFrameBVal,
      });

      setCurrentClip(targetClip);
      const activeFrameVal = targetMix === 1 ? currentFrameBVal : currentFrameAVal;
      setCurrentFrame(activeFrameVal);

      if (elapsed < totalDuration) {
        transitionAnimRef.current = requestAnimationFrame(step);
      } else {
        updateRenderState({
          clipA: targetClip,
          frameA: targetFrame,
          clipB: targetClip,
          frameB: targetFrame,
          mix: 0,
        });
        setCurrentClip(targetClip);
        setCurrentFrame(targetFrame);
        transitionAnimRef.current = null;
      }
    };

    transitionAnimRef.current = requestAnimationFrame(step);
  };

  const lastSectionRef = useRef(0);
  useEffect(() => {
    if (!clip1Ready) return;
    const prev = lastSectionRef.current;
    lastSectionRef.current = activeSection;

    if (activeSection === 0) {
      transitionTo(1, 1, false);
    } else if (activeSection === 1) {
      if (prev === 0) {
        transitionTo(1, 240, true);
      } else {
        transitionTo(1, 240, false);
      }
    } else if (activeSection === 2) {
      if (prev === 1) {
        transitionTo(2, 240, true);
      } else {
        transitionTo(2, 240, false);
      }
    } else if (activeSection === 3) {
      if (prev === 2) {
        transitionTo(3, 240, true);
      } else {
        transitionTo(3, 240, false);
      }
    } else if (activeSection === 4) {
      if (prev === 3) {
        transitionTo(4, 240, true);
      } else {
        transitionTo(4, 240, false);
      }
    } else if (activeSection === 5) {
      if (prev === 4) {
        transitionTo(5, 240, true);
      } else {
        transitionTo(5, 240, false);
      }
    } else if (activeSection === 6) {
      animateStats();
    }
  }, [activeSection, clip1Ready]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const clientHeight = e.currentTarget.clientHeight;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeSection && index >= 0 && index <= 6) setActiveSection(index);
  };

  const animateStats = () => {
    const targets = { years: 15, offices: 8, portCalls: 1200, vessels: 250 };
    const duration = 2200;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * (2 - progress);
      setStats({
        years: Math.round(targets.years * ease),
        offices: Math.round(targets.offices * ease),
        portCalls: Math.round(targets.portCalls * ease),
        vessels: Math.round(targets.vessels * ease),
      });
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToSection = (index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: index * containerRef.current.clientHeight, behavior: "smooth" });
      setActiveSection(index);
      setMobileMenuOpen(false);
    }
  };

  const services: Service[] = [
    {
      id: "agency",
      title: "Ship Agency Services",
      icon: <Anchor className="w-7 h-7 text-brand-blue" />,
      description: "Full port coordination offering complete physical care of vessels from pre-arrival to departure.",
      details: [
        "Vessel clearance and port declarations",
        "Stevedoring and cargo handling coordination",
        "Port tariff and disbursement accounting",
        "24/7 communications and reporting desk",
      ],
    },
    {
      id: "husbandry",
      title: "Husbandry Services",
      icon: <Users className="w-7 h-7 text-brand-blue" />,
      description: "Taking full care of operational, husbandry, and non-cargo related requirements of vessels.",
      details: [
        "Fresh water and provisions coordination",
        "Waste disposal and sludge removal management",
        "Vessel repairs, technical assistance, and diving surveys",
        "Lube oil and chemical deliveries",
      ],
    },
    {
      id: "logistics",
      title: "Logistics & Supply Chain",
      icon: <Truck className="w-7 h-7 text-brand-blue" />,
      description: "End-to-end multi-modal forwarding and customs clearance solutions across global trade routes.",
      details: [
        "Intermodal freight forwarding (ocean, air, road)",
        "Customs brokerage and clearance at major UAE/global hubs",
        "Warehousing, storage, and consolidation services",
        "Project cargo and heavy lift movement",
      ],
    },
    {
      id: "survey",
      title: "Marine Survey Services",
      icon: <Compass className="w-7 h-7 text-brand-blue" />,
      description: "Independent marine surveys ensuring transparency, compliance, and damage limitation.",
      details: [
        "Bunker quantity surveys (BQS)",
        "On-hire / off-hire condition surveys",
        "Cargo pre-loading inspections and damage assessments",
        "Draft surveys and safety compliance audits",
      ],
    },
    {
      id: "crew",
      title: "Crew Management",
      icon: <Users className="w-7 h-7 text-brand-blue" />,
      description: "Complete crew handling including visa logistics, medical support, and rotation management.",
      details: [
        "Visa processing, immigration clearance, and OK-to-Board letters",
        "Airport meet-and-greet, ground transportation, and hotel bookings",
        "Medical check-ups, hospitalization coordination, and dental care",
        "Crew training compliance and documentation verification",
      ],
    },
    {
      id: "bunkering",
      title: "Bunkering Coordination",
      icon: <Ship className="w-7 h-7 text-brand-blue" />,
      description: "Fuel and lubricant supply management in major shipping channels to minimize downtime.",
      details: [
        "Bunker fuel procurement (VLSFO, HSFO, MGO)",
        "Vessel-barge alignment and slot bookings",
        "Quality and quantity checks with ISO standards",
        "Competitive marine lubricants supply network",
      ],
    },
    {
      id: "store",
      title: "Store Supplies",
      icon: <Anchor className="w-7 h-7 text-brand-blue" />,
      description: "Provision of high-quality marine deck, engine, cabin, and safety store items.",
      details: [
        "ISO compliant deck and engine consumable supplies",
        "Electrical, cabin, and galley stores",
        "Approved PPE and marine safety gear",
        "Navigation equipment and technical publications",
      ],
    },
    {
      id: "provisions",
      title: "Provisions Supplies",
      icon: <CheckCircle className="w-7 h-7 text-brand-blue" />,
      description: "Fresh, frozen, and dry food provisions sourced globally with strict hygiene standards.",
      details: [
        "Fresh local fruits, vegetables, dairy, and bakery items",
        "Premium quality frozen meats, poultry, and seafood",
        "Dry provisions, canned items, spices, and international foods",
        "HACCP certified storage and cold-chain transport to vessels",
      ],
    },
    {
      id: "spares",
      title: "Spare Parts Delivery",
      icon: <Compass className="w-7 h-7 text-brand-blue" />,
      description: "Time-critical delivery of marine spares directly to vessels at ports, anchorage, or off-shore.",
      details: [
        "Inbound spare parts clearance and customs warehousing",
        "Last-mile launch boat deliveries to anchorage",
        "Coordination with vessel technical managers",
        "Express priority tracking and air freight links",
      ],
    },
    {
      id: "cash",
      title: "Cash to Master",
      icon: <Award className="w-7 h-7 text-brand-blue" />,
      description: "Secure, insured delivery of physical currency directly to vessel Captains in port or anchorage.",
      details: [
        "Strict security compliance and anti-money laundering protocol",
        "Physical launch boat transfer and master receipt validation",
        "Insured transit for major global currency demands",
        "Transparent fee structures and exchange rates",
      ],
    },
  ];

  const isScrolled = activeSection > 0;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black selection:bg-brand-blue selection:text-white">

      {/* ── Preloader ── */}
      {!clip1Ready && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-6 max-w-xs w-full px-8">
            <div className="flex items-center gap-3">
              <img src="/focal-logo-full.png" alt="Focal Logo" className="w-9 h-9 object-contain" />
              <span className="text-3xl font-black tracking-[0.2em] text-slate-900">FOCAL</span>
            </div>
            <p className="text-slate-400 text-[11px] tracking-[0.25em] font-mono text-center uppercase">
              Premium Ship Agency & Maritime Logistics
            </p>
            <div className="w-full bg-slate-100 rounded-full h-[3px] overflow-hidden">
              <div
                className="bg-brand-yellow h-full rounded-full transition-all duration-300"
                style={{ width: `${preloadProgress}%` }}
              />
            </div>
            <span className="text-xs tracking-wider text-brand-blue font-mono">
              LOADING — {preloadProgress}%
            </span>
          </div>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 left-0 w-full z-40 transition-all duration-500 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => scrollToSection(0)}
            className="flex items-center gap-2.5"
          >
            <img src="/focal-logo-full.png" alt="Focal Logo" className="w-7 h-7 object-contain" />
            <span className={`text-xl font-black tracking-[0.2em] ${isScrolled ? "text-slate-900" : "text-white"}`}>
              FOCAL
            </span>
          </button>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-7">
            {NAV_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => scrollToSection(i)}
                className={`text-[11px] font-semibold tracking-[0.15em] transition-colors ${
                  activeSection === i
                    ? (isScrolled ? "text-brand-blue" : "text-brand-yellow")
                    : isScrolled
                    ? "text-slate-500 hover:text-slate-900"
                    : "text-white/75 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 24/7 pill */}
          <div
            className={`hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-mono tracking-wider border transition-colors ${
              isScrolled
                ? "bg-brand-blue/5 border-brand-blue/20 text-brand-blue"
                : "bg-white/10 border-white/20 text-white"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-yellow opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-yellow" />
            </span>
            OPERATIONAL 24/7/365
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`lg:hidden p-2 ${isScrolled ? "text-slate-700" : "text-white"}`}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-lg flex flex-col gap-1 py-4 px-4">
            {NAV_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => scrollToSection(i)}
                className="text-left py-3 px-4 text-sm font-semibold text-slate-700 hover:text-brand-blue hover:bg-brand-blue/5 rounded-xl transition-colors tracking-wider"
              >
                {label}
              </button>
            ))}
            <div className="flex items-center justify-center gap-2 mt-2 bg-brand-blue/5 border border-brand-blue/10 px-4 py-2 rounded-full text-[11px] font-mono text-brand-blue mx-auto">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-yellow opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-yellow" />
              </span>
              24/7 GLOBAL SUPPORT ACTIVE
            </div>
          </div>
        )}
      </nav>

      {/* ── Canvas background ── */}
      <div
        className={`fixed inset-0 w-full h-full z-0 transition-opacity duration-700 ${
          activeSection === 6 ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <canvas
          ref={canvas1Ref}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark cinematic overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/65 pointer-events-none" />
      </div>

      {/* ── Scroll container ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative z-10 w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
      >

        {/* ════════════════════════
            SECTION 0 — HERO
            ════════════════════════ */}
        <section className="h-screen w-full snap-start flex flex-col justify-end relative overflow-hidden">

          {/* Decorative left amber accent */}
          <div className="absolute left-8 top-36 bottom-28 w-px bg-gradient-to-b from-transparent via-brand-yellow/35 to-transparent hidden lg:block pointer-events-none" />

          <div className="max-w-7xl mx-auto w-full px-8 md:px-16 lg:px-24 pb-14 md:pb-20 mt-auto">

            {/* Eyebrow */}
            <div className="flex items-center gap-4 mb-7">
              <div className="w-10 h-px bg-brand-yellow" />
              <span className="text-brand-yellow font-mono tracking-[0.28em] text-[11px] uppercase">
                Port Agency &amp; Maritime Logistics
              </span>
            </div>

            {/* Headline — editorial split */}
            <h1 className="font-black tracking-tighter leading-[0.88] text-white mb-7"
              style={{ fontSize: "clamp(3rem, 10vw, 9rem)" }}>
              CONNECTING
              <br />
              <span className="text-brand-yellow">OPEN</span> OCEAN
              <br />
              <span className="text-white/55">TO INLAND</span>
            </h1>

            {/* Thin ruled divider */}
            <div className="flex items-center gap-5 mb-8">
              <div className="flex-1 h-px bg-white/12" />
              <span className="text-white/35 text-[10px] font-mono tracking-[0.28em] uppercase hidden sm:block">
                UAE · Singapore · Rotterdam · Global
              </span>
              <div className="w-8 h-px bg-brand-yellow" />
            </div>

            {/* Two-column bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
              <p className="text-base md:text-lg text-white/60 leading-relaxed max-w-lg">
                The premier port agency and logistics partner across UAE, Singapore, and global key waterways — handling customs, bunkering, and cargo operations 24/7/365.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => scrollToSection(1)}
                  className="group flex items-center justify-center gap-2 bg-brand-yellow hover:bg-brand-yellow-hover text-black font-bold px-8 py-4 rounded-xl tracking-wider text-sm transition-all shadow-lg shadow-brand-yellow/25"
                >
                  EXPERIENCE THE JOURNEY
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => scrollToSection(6)}
                  className="flex items-center justify-center bg-white/10 hover:bg-white/18 border border-white/22 px-8 py-4 rounded-xl tracking-wider text-sm text-white transition-all"
                >
                  OUR SERVICES
                </button>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <span className="text-[9px] tracking-[0.35em] font-mono text-white/35 uppercase">Scroll</span>
            <div className="w-px h-9 bg-gradient-to-b from-white/45 to-transparent animate-pulse" />
          </div>
        </section>

        {/* ════════════════════════
            SECTION 1 — THE APPROACH
            ════════════════════════ */}
        <section className="h-screen w-full snap-start flex items-center relative px-6 md:px-16 lg:px-24 overflow-hidden">

          {/* Maritime course line — ship approach path */}
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            <svg className="w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="courseGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="65%" stopColor="white" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <line x1="0" y1="450" x2="1010" y2="450" stroke="url(#courseGrad)" strokeWidth="1.5" strokeDasharray="10 7" />
              <line x1="0" y1="462" x2="800" y2="462" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="6 10" />
              <circle cx="1010" cy="450" r="4" fill="white" fillOpacity="0.28" />
              <circle cx="1010" cy="450" r="9" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
            </svg>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 w-full max-w-7xl mx-auto relative z-10 transition-all duration-1000 transform ${
            currentClip === 1 && currentFrame >= TOTAL_FRAMES
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8 pointer-events-none"
          }`}>
            <div className="col-span-1 lg:col-start-7 lg:col-span-6 p-8 md:p-11 flex flex-col justify-center">
              <span className="text-brand-yellow font-mono tracking-wider text-[11px] uppercase font-semibold mb-3">
                01 / THE APPROACH
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight text-white">
                Emerging to the Harbor
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-6 max-w-xl">
                As <strong className="text-white">"Ocean Frontier"</strong> sails toward the harbor, Focal manages deep-sea coordination, customs documentation, anchorage berths, and pilotage alignment.
              </p>
              <button
                onClick={() => scrollToSection(2)}
                className="group flex items-center gap-2 text-white hover:text-brand-yellow font-bold tracking-wider text-sm transition-colors w-fit mt-2"
              >
                PROCEED TO PILOTAGE
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            SECTION 2 — PILOTAGE & INSPECTION
            ════════════════════════ */}
        <section className="h-screen w-full snap-start flex items-center relative px-6 md:px-16 lg:px-24 overflow-hidden">

          {/* Maritime course line — Pilotage */}
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            <svg className="w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="courseGrad2" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="65%" stopColor="white" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <line x1="1440" y1="450" x2="430" y2="450" stroke="url(#courseGrad2)" strokeWidth="1.5" strokeDasharray="10 7" />
              <line x1="1440" y1="462" x2="640" y2="462" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="6 10" />
              <circle cx="430" cy="450" r="4" fill="white" fillOpacity="0.28" />
              <circle cx="430" cy="450" r="9" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
            </svg>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 w-full max-w-7xl mx-auto relative z-10 transition-all duration-1000 transform ${
            currentClip === 2 && currentFrame >= TOTAL_FRAMES
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8 pointer-events-none"
          }`}>
            <div className="col-span-1 lg:col-span-6 p-8 md:p-11 flex flex-col justify-center">
              <span className="text-brand-yellow font-mono tracking-wider text-[11px] uppercase font-semibold mb-3">
                02 / PILOTAGE &amp; INSPECTION
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight text-white">
                Tugboat Assist &amp; Pilot Boarding
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-6 max-w-xl">
                Safeguarding harbor entry with experienced marine pilots, coordinated tugboat maneuvers, and port authority inspections.
              </p>
              <button
                onClick={() => scrollToSection(3)}
                className="group flex items-center gap-2 text-white hover:text-brand-yellow font-bold tracking-wider text-sm transition-colors w-fit mt-2"
              >
                PROCEED TO PORT ARRIVAL
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            SECTION 3 — PORT ARRIVAL
            ════════════════════════ */}
        <section className="h-screen w-full snap-start flex items-center relative px-6 md:px-16 lg:px-24 overflow-hidden">

          {/* Course line from left — vessel now berthed */}
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            <svg className="w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="courseGrad3" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="65%" stopColor="white" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <line x1="0" y1="450" x2="1010" y2="450" stroke="url(#courseGrad3)" strokeWidth="1.5" strokeDasharray="10 7" />
              <line x1="0" y1="438" x2="800" y2="438" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="6 10" />
              <circle cx="1010" cy="450" r="4" fill="white" fillOpacity="0.28" />
              <circle cx="1010" cy="450" r="9" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
            </svg>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 w-full max-w-7xl mx-auto relative z-10 transition-all duration-1000 transform ${
            currentClip === 3 && currentFrame >= TOTAL_FRAMES
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8 pointer-events-none"
          }`}>
            <div className="col-span-1 lg:col-start-7 lg:col-span-6 p-8 md:p-11 flex flex-col justify-center">
              <span className="text-brand-yellow font-mono tracking-wider text-[11px] uppercase font-semibold mb-3">
                03 / PORT ARRIVAL
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight text-white">
                Modern Automated Harbor
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-6 max-w-xl">
                When a vessel enters the harbor, operations accelerate. We handle crane-loading schedules, crew rotations, cash deliveries, store provisions, and marine surveys.
              </p>
              <button
                onClick={() => scrollToSection(4)}
                className="group flex items-center gap-2 text-white hover:text-brand-yellow font-bold tracking-wider text-sm transition-colors w-fit mt-2"
              >
                PROCEED TO SHIPYARD
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            SECTION 4 — DRY DOCK & MAINTENANCE
            ════════════════════════ */}
        <section className="h-screen w-full snap-start flex items-center relative px-6 md:px-16 lg:px-24 overflow-hidden">

          {/* Maritime course line — Dry Dock */}
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            <svg className="w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="courseGrad4" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="65%" stopColor="white" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <line x1="1440" y1="450" x2="430" y2="450" stroke="url(#courseGrad4)" strokeWidth="1.5" strokeDasharray="10 7" />
              <line x1="1440" y1="462" x2="640" y2="462" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="6 10" />
              <circle cx="430" cy="450" r="4" fill="white" fillOpacity="0.28" />
              <circle cx="430" cy="450" r="9" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
            </svg>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 w-full max-w-7xl mx-auto relative z-10 transition-all duration-1000 transform ${
            currentClip === 4 && currentFrame >= TOTAL_FRAMES
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8 pointer-events-none"
          }`}>
            <div className="col-span-1 lg:col-span-6 p-8 md:p-11 flex flex-col justify-center">
              <span className="text-brand-yellow font-mono tracking-wider text-[11px] uppercase font-semibold mb-3">
                04 / DRY DOCK &amp; MAINTENANCE
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight text-white">
                Shipyard Upgrades &amp; Green Tech
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-6 max-w-xl">
                Managing dry dock inspections, hull cleaning, green technology upgrades, and sustainable vessel recycling coordination.
              </p>
              <button
                onClick={() => scrollToSection(5)}
                className="group flex items-center gap-2 text-white hover:text-brand-yellow font-bold tracking-wider text-sm transition-colors w-fit mt-2"
              >
                PROCEED TO INLAND TRANSIT
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            SECTION 5 — INLAND DISTRIBUTION
            ════════════════════════ */}
        <section className="h-screen w-full snap-start flex items-center relative px-6 md:px-16 lg:px-24 overflow-hidden">

          {/* Course line from left — cargo route heading inland */}
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            <svg className="w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="courseGrad5" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="65%" stopColor="white" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              <line x1="0" y1="450" x2="1010" y2="450" stroke="url(#courseGrad5)" strokeWidth="1.5" strokeDasharray="10 7" />
              <line x1="0" y1="438" x2="800" y2="438" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="6 10" />
              <circle cx="1010" cy="450" r="4" fill="white" fillOpacity="0.28" />
              <circle cx="1010" cy="450" r="9" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
            </svg>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 w-full max-w-7xl mx-auto relative z-10 transition-all duration-1000 transform ${
            currentClip === 5 && currentFrame >= TOTAL_FRAMES
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8 pointer-events-none"
          }`}>
            <div className="col-span-1 lg:col-start-7 lg:col-span-6 p-8 md:p-11 flex flex-col justify-center">
              <span className="text-brand-yellow font-mono tracking-wider text-[11px] uppercase font-semibold mb-3">
                05 / INLAND DISTRIBUTION
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight text-white">
                Intermodal Last-Mile Delivery
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-6 max-w-xl">
                From vessel deck to logistics semi-trucks, we coordinate inland transport seamlessly. Our global supply chain hubs ensure cargo reaches final networks safely and transparently.
              </p>
              <button
                onClick={() => scrollToSection(6)}
                className="group flex items-center gap-2 text-brand-yellow hover:text-brand-yellow-hover font-bold tracking-wider text-sm transition-colors w-fit mt-2"
              >
                ENTER CORPORATE HUB
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            SECTION 4 — CORPORATE
            ════════════════════════ */}
        <section className="snap-start min-h-screen w-full bg-white relative z-20 flex flex-col">

          {/* 4a — Stats */}
          <div className="bg-slate-50 border-b border-slate-100 py-16 px-6 md:px-12">
            <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              {[
                { value: `${stats.years}+`, label: "Years of Operations" },
                { value: `${stats.offices}+`, label: "Global Offices" },
                { value: `${stats.portCalls}+`, label: "Port Calls Annually" },
                { value: `${stats.vessels}+`, label: "Vessels Served" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-4xl md:text-5xl font-black text-slate-900 font-mono mb-2 tabular-nums">{value}</span>
                  <div className="w-8 h-0.5 bg-brand-yellow mb-3" />
                  <span className="text-xs md:text-sm tracking-widest text-slate-400 font-mono uppercase leading-relaxed">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4b — Services grid */}
          <div className="bg-white py-24 px-6 md:px-12">
            <div className="max-w-7xl mx-auto">
              <div className="text-center max-w-2xl mx-auto mb-16">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="h-px w-8 bg-brand-yellow" />
                  <span className="text-brand-blue font-mono tracking-[0.25em] text-[11px] uppercase">Comprehensive Solutions</span>
                  <div className="h-px w-8 bg-brand-yellow" />
                </div>
                <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-slate-900">
                  Our Maritime Services
                </h2>
                <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                  Leading ship agency and logistics firm handling everything for vessels, crew, and cargo at major global hubs — 24/7/365.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className="group bg-white border border-slate-200 p-7 rounded-2xl hover:border-brand-blue/30 hover:shadow-xl hover:shadow-brand-blue/5 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="mb-5 p-3 bg-brand-blue/5 border border-brand-blue/10 rounded-xl inline-block group-hover:bg-brand-blue/10 transition-colors">
                        {service.icon}
                      </div>
                      <h3 className="text-lg font-bold mb-2.5 text-slate-900 group-hover:text-brand-blue transition-colors">
                        {service.title}
                      </h3>
                      <p className="text-slate-400 text-sm leading-relaxed mb-5">{service.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono tracking-wider text-brand-blue group-hover:translate-x-1.5 transition-transform duration-300">
                      <span>EXPLORE DETAILS</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Service detail modal */}
          {selectedService && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white border border-slate-200 p-8 md:p-10 rounded-3xl max-w-lg w-full relative shadow-2xl">
                <button
                  onClick={() => setSelectedService(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-brand-blue/5 border border-brand-blue/10 rounded-xl">{selectedService.icon}</div>
                  <h3 className="text-2xl font-black text-slate-900">{selectedService.title}</h3>
                </div>
                <p className="text-slate-500 text-sm md:text-base leading-relaxed mb-6 border-b border-slate-100 pb-6">
                  {selectedService.description}
                </p>
                <h4 className="text-[11px] font-mono tracking-widest text-brand-blue uppercase mb-4">Operational Scope:</h4>
                <ul className="flex flex-col gap-3">
                  {selectedService.details.map((detail, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600 leading-normal">
                      <CheckCircle className="w-4 h-4 text-brand-blue flex-shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setSelectedService(null)}
                  className="mt-8 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl text-sm tracking-wider transition-colors"
                >
                  CLOSE
                </button>
              </div>
            </div>
          )}

          {/* 4c — Global ports */}
          <div className="bg-slate-50 border-t border-slate-100 py-24 px-6 md:px-12">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px w-8 bg-brand-yellow" />
                    <span className="text-brand-blue font-mono tracking-[0.25em] text-[11px] uppercase">Where We Navigate</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight text-slate-900">
                    Strategic Global Networks
                  </h2>
                  <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-8">
                    Focal manages vessels in major international shipping hubs, providing seamless regional port agency services across all key waterways.
                  </p>
                  <div className="flex flex-col gap-5">
                    {[
                      {
                        title: "UAE Headquarters",
                        desc: "Dubai, Abu Dhabi, Fujairah, RAK, and Sharjah — complete UAE coastline coverage.",
                      },
                      {
                        title: "Global Corridors",
                        desc: "Singapore Strait, Turkey (Bosphorus & Dardanelles), Netherlands (Rotterdam, Amsterdam), Belgium (Antwerp, Zeebrugge), USA (Houston, Beaumont, Corpus Christi).",
                      },
                    ].map(({ title, desc }) => (
                      <div key={title} className="flex items-start gap-4">
                        <div className="p-2.5 bg-brand-blue/5 border border-brand-blue/10 rounded-xl text-brand-blue flex-shrink-0">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm mb-1">{title}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { region: "ASIA HUBS", city: "Singapore", detail: "PSA Terminals & Anchorage" },
                    { region: "MIDDLE EAST", city: "UAE", detail: "Jebel Ali, Fujairah Anchorages" },
                    { region: "EUROPE HUB", city: "Netherlands", detail: "Rotterdam & Amsterdam" },
                    { region: "EUROPE HUB", city: "Belgium", detail: "Antwerp & Zeebrugge" },
                    { region: "EURO-ASIA", city: "Turkey", detail: "Bosphorus & Dardanelles" },
                    { region: "AMERICAS", city: "USA", detail: "Houston, Beaumont, Corpus Christi" },
                  ].map(({ region, city, detail }) => (
                    <div
                      key={city}
                      className="bg-white border border-slate-200 p-5 rounded-2xl text-center hover:border-brand-blue/20 hover:shadow-md hover:shadow-brand-blue/5 transition-all duration-300"
                    >
                      <span className="text-brand-blue font-mono text-[10px] tracking-wider uppercase block mb-1">{region}</span>
                      <h4 className="text-base font-bold text-slate-900 mb-1">{city}</h4>
                      <p className="text-[11px] text-slate-400">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4d — ISO quality */}
          <div className="bg-white border-t border-slate-100 py-24 px-6 md:px-12">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-6 bg-slate-900 p-8 md:p-12 rounded-3xl">
                  <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-9 h-9 text-brand-yellow" />
                    <h3 className="text-2xl font-black text-white">ISO QMS Compliance</h3>
                  </div>
                  <p className="text-sm md:text-base text-slate-400 leading-relaxed mb-6">
                    Focal adheres to rigorous quality, transparency, and safety systems. All policies are monitored via Integrated ISO QMS frameworks.
                  </p>
                  <div className="flex flex-col">
                    {[
                      "Quality Management — ISO 9001:2015 Certified",
                      "Environmental Standard — ISO 14001:2015 Compliant",
                      "Safety Guidelines — QMS-POL-01 Ver 3.2",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 border-b border-white/5 py-3.5 text-xs md:text-sm text-slate-400">
                        <FileText className="w-4 h-4 text-brand-yellow flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px w-8 bg-brand-yellow" />
                    <span className="text-brand-blue font-mono tracking-[0.25em] text-[11px] uppercase">Corporate Philosophy</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight text-slate-900">
                    Traditional Values,<br />Automated Precision
                  </h2>
                  <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-8">
                    At Focal, we merge traditional maritime integrity with modern technological integration — guaranteeing complete transparency in port disbursements, safety protocols, and supply coordination.
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { title: "Transparency First", desc: "Itemized port expense reports and verified receipts for every Cash-to-Master or Bunkering delivery." },
                      { title: "Safety Audited", desc: "Every provisioning or crew launch is monitored under strict HSE procedures to guarantee zero incidents." },
                    ].map(({ title, desc }) => (
                      <div key={title} className="border-l-2 border-brand-yellow pl-4">
                        <h4 className="font-bold text-slate-900 text-sm mb-2">{title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4e — Contact form */}
          <div className="bg-slate-50 border-t border-slate-100 py-24 px-6 md:px-12">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="h-px w-8 bg-brand-yellow" />
                  <span className="text-brand-blue font-mono tracking-[0.25em] text-[11px] uppercase">Port Call Desk</span>
                  <div className="h-px w-8 bg-brand-yellow" />
                </div>
                <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-slate-900">
                  Request Vessel Support
                </h2>
                <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
                  Contact our global duty operators for agency clearance, provisioning, or spare parts deliveries.
                </p>
              </div>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white border border-slate-200 p-8 md:p-12 rounded-3xl shadow-sm"
              >
                {[
                  { label: "Vessel Name", type: "text", placeholder: "e.g. OCEAN FRONTIER" },
                  { label: "Estimated Port of Arrival", type: "text", placeholder: "e.g. Dubai Anchorages (UAE)" },
                  { label: "Contact Email", type: "email", placeholder: "ops@shipowner.com" },
                ].map(({ label, type, placeholder }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{label}</label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      className="bg-slate-50 border border-slate-200 focus:border-brand-yellow focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-300 focus:outline-none transition-all"
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Requested Service</label>
                  <select className="bg-slate-50 border border-slate-200 focus:border-brand-yellow rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none transition-all">
                    <option>Ship Agency Services</option>
                    <option>Bunkering Coordination</option>
                    <option>Crew Management</option>
                    <option>Husbandry Care</option>
                    <option>Store &amp; Provisions Supply</option>
                    <option>Other Logistics Support</option>
                  </select>
                </div>
                <div className="col-span-1 md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Operational Specifications</label>
                  <textarea
                    rows={4}
                    placeholder="Describe crew transfer counts, provision volumes, bunkering metrics, or delivery guidelines..."
                    className="bg-slate-50 border border-slate-200 focus:border-brand-yellow focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-300 focus:outline-none transition-all resize-none"
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <button
                    type="submit"
                    className="w-full bg-brand-yellow hover:bg-brand-yellow-hover text-black font-bold py-4 rounded-xl tracking-wider text-sm transition-all shadow-lg shadow-brand-yellow/20"
                  >
                    SUBMIT PORT CLEARANCE ENQUIRY
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* 4f — Footer */}
          <footer className="bg-slate-900 py-12 px-6 md:px-12 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2.5">
                <img src="/focal-logo-full.png" alt="Focal Logo" className="w-6 h-6 object-contain" />
                <span className="text-lg font-black tracking-[0.2em] text-white">FOCAL</span>
              </div>
              <p className="text-xs text-slate-500 text-center md:text-left leading-relaxed">
                &copy; {new Date().getFullYear()} Focal Shipping Services LLC. All rights reserved.
                <br />
                Dubai, UAE &nbsp;·&nbsp; ISO 9001:2015 &nbsp;·&nbsp; ISO 14001:2015
              </p>
              <div className="flex gap-6 text-xs text-slate-500 font-mono">
                <a href="#" className="hover:text-brand-yellow transition-colors">SAFETY POLICY</a>
                <a href="#" className="hover:text-brand-yellow transition-colors">ANTI-CORRUPTION</a>
                <a href="#" className="hover:text-brand-yellow transition-colors">TERMS</a>
              </div>
            </div>
          </footer>

        </section>
      </div>
    </div>
  );
}
