import React, { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color: string;
  type: "sine" | "bars";
}

export default function AudioVisualizer({ analyser, isActive, color, type }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyser?.frequencyBinCount || 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      // Clear with very slight fade for trailing glow effect
      ctx.fillStyle = "rgba(10, 10, 15, 0.4)";
      ctx.fillRect(0, 0, width, height);

      if (!analyser || !isActive) {
        // Draw centered idle line
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      if (type === "sine") {
        // Get time domain data for oscilliscope wave
        analyser.getByteTimeDomainData(dataArray);

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else {
        // Get frequency database for digital bars visualizer
        analyser.getByteFrequencyData(dataArray);

        ctx.shadowBlur = 8;
        ctx.shadowColor = color;

        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.8;

          // Draw double-mirrored bars
          const yTop = (height - barHeight) / 2;

          ctx.fillStyle = color;
          ctx.fillRect(x, yTop, barWidth - 1, barHeight);

          x += barWidth;
        }
        ctx.shadowBlur = 0; // reset
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isActive, color, type]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 rounded-xl bg-slate-950/40 border border-white/5 opacity-80"
      width={400}
      height={64}
      id={`audio-visualizer-${type}`}
    />
  );
}
