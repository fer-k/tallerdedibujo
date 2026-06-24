"use client";

import { useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";

type Point = [number, number, number];

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

const subjects = ["un gato", "la luna", "un viejo"];
const attributes = ["melancólico", "bailando", "furioso"];

function randomPrompt(): string {
  const s = subjects[Math.floor(Math.random() * subjects.length)];
  const a = attributes[Math.floor(Math.random() * attributes.length)];
  return `${s} ${a}`;
}

function randomColorPair(): [string, string] {
  const hue = Math.floor(Math.random() * 360);
  return [
    `hsl(${hue}, 70%, 40%)`,
    `hsl(${(hue + 180) % 360}, 70%, 40%)`,
  ];
}

export default function Home() {
  // Two canvas layers: committed strokes below, live stroke above
  const committedRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const isDrawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const rafId = useRef<number | null>(null);
  const dirty = useRef(false);

  const [colors, setColors] = useState<[string, string] | null>(null);
  const [activeColor, setActiveColor] = useState<string>("");
  const [prompt, setPrompt] = useState<string | null>(null);

  const activeColorRef = useRef(activeColor);

  useEffect(() => {
    const pair = randomColorPair();
    setColors(pair);
    setActiveColor(pair[0]);
    activeColorRef.current = pair[0];
    setPrompt(randomPrompt());
  }, []);

  useEffect(() => {
    const canvas = committedRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Size live canvas to match
    const live = liveRef.current;
    if (live) {
      live.width = canvas.width;
      live.height = canvas.height;
    }
  }, []);

  function getPos(e: PointerEvent, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top, e.pressure];
  }

  function renderLiveStroke() {
    const live = liveRef.current;
    if (!live) return;
    const ctx = live.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, live.width, live.height);

    const pts = currentPoints.current;
    if (pts.length === 0) return;

    const stroke = getStroke(pts, {
      size: 6,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });

    const path = new Path2D(getSvgPathFromStroke(stroke));
    ctx.fillStyle = activeColorRef.current;
    ctx.fill(path);
  }

  function scheduleRender() {
    if (dirty.current || rafId.current !== null) return;
    dirty.current = true;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      dirty.current = false;
      renderLiveStroke();
    });
  }

  function commitStroke() {
    const committed = committedRef.current;
    const live = liveRef.current;
    if (!committed || !live) return;
    const ctx = committed.getContext("2d");
    if (!ctx) return;
    // Draw live layer onto committed layer, then clear live
    ctx.drawImage(live, 0, 0);
    const liveCtx = live.getContext("2d");
    liveCtx?.clearRect(0, 0, live.width, live.height);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const canvas = liveRef.current!;
    currentPoints.current = [getPos(e.nativeEvent, canvas)];
    isDrawing.current = true;
    scheduleRender();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const canvas = liveRef.current!;
    // Collect coalesced events for full Apple Pencil resolution
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ce of events) {
      currentPoints.current.push(getPos(ce, canvas));
    }
    scheduleRender();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const canvas = liveRef.current!;
    currentPoints.current.push(getPos(e.nativeEvent, canvas));
    // Cancel any pending rAF and do a final synchronous render before committing
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
      dirty.current = false;
    }
    renderLiveStroke();
    commitStroke();
    currentPoints.current = [];
    isDrawing.current = false;
  }

  function clearCanvas() {
    const canvas = committedRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const live = liveRef.current;
    live?.getContext("2d")?.clearRect(0, 0, live.width, live.height);
  }

  const canvasClass = "absolute inset-0 w-full h-full";

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen bg-gray-100 gap-4">
      {prompt && (
        <p className="text-gray-500 text-sm tracking-wide italic">{prompt}</p>
      )}
      <div className="relative w-[90vw] h-[82vh]">
        <canvas ref={committedRef} className={canvasClass} />
        <canvas
          ref={liveRef}
          className={`${canvasClass} cursor-crosshair`}
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
      <div className="absolute bottom-8 flex items-center gap-4">
        {(colors ?? []).map((color) => (
          <button
            key={color}
            onClick={() => { activeColorRef.current = color; setActiveColor(color); }}
            style={{ backgroundColor: color }}
            className={`w-9 h-9 rounded-full transition-all ${
              activeColor === color
                ? "ring-2 ring-offset-2 ring-gray-800 scale-110"
                : "opacity-60 hover:opacity-90"
            }`}
          />
        ))}
        <button
          onClick={clearCanvas}
          className="px-3 py-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
