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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const snapshot = useRef<ImageData | null>(null);

  const [colors, setColors] = useState<[string, string] | null>(null);
  const [activeColor, setActiveColor] = useState<string>("");
  const [prompt, setPrompt] = useState<string | null>(null);

  const activeColorRef = useRef(activeColor);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);

  useEffect(() => {
    const pair = randomColorPair();
    setColors(pair);
    setActiveColor(pair[0]);
    setPrompt(randomPrompt());
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top, e.pressure];
  }

  function drawPoints(points: Point[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stroke = getStroke(points, {
      size: 6,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });

    const path = new Path2D(getSvgPathFromStroke(stroke));
    ctx.fillStyle = activeColorRef.current;
    ctx.fill(path);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (canvas) {
      snapshot.current = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    }
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    currentPoints.current = [getPos(e)];
    isDrawing.current = true;
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    currentPoints.current = [...currentPoints.current, getPos(e)];
    ctx.putImageData(snapshot.current!, 0, 0);
    drawPoints(currentPoints.current);
  }

  function onPointerUp() {
    if (!isDrawing.current) return;
    drawPoints(currentPoints.current);
    const canvas = canvasRef.current;
    if (canvas) {
      snapshot.current = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    }
    currentPoints.current = [];
    isDrawing.current = false;
  }

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen bg-gray-100 gap-4">
      {prompt && (
        <p className="text-gray-500 text-sm tracking-wide italic">{prompt}</p>
      )}
      <canvas
        ref={canvasRef}
        className="bg-white w-[90vw] h-[82vh] touch-none cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="absolute bottom-8 flex items-center gap-4">
        {(colors ?? []).map((color) => (
          <button
            key={color}
            onClick={() => setActiveColor(color)}
            style={{ backgroundColor: color }}
            className={`w-9 h-9 rounded-full transition-all ${
              activeColor === color
                ? "ring-2 ring-offset-2 ring-gray-800 scale-110"
                : "opacity-60 hover:opacity-90"
            }`}
          />
        ))}
        <button
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            snapshot.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
          }}
          className="px-3 py-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
