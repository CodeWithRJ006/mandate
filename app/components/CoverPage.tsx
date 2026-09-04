"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function CoverPage({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<"landing" | "loading" | "done">("landing");
  const [progress, setProgress] = useState(0);
  
  const canvasLeftRef = useRef<HTMLCanvasElement>(null);
  const canvasRightRef = useRef<HTMLCanvasElement>(null);

  const startSequence = () => {
    setStage("loading");
  };

  useEffect(() => {
    if (stage === "loading") {
      const canvasL = canvasLeftRef.current;
      const canvasR = canvasRightRef.current;
      if (!canvasL || !canvasR) return;
      const ctxL = canvasL.getContext("2d");
      const ctxR = canvasR.getContext("2d");
      
      const img = new window.Image();
      img.src = "/bg.jpg";
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        canvasL.width = w / 2; canvasL.height = h;
        canvasR.width = w / 2; canvasR.height = h;
        ctxL?.drawImage(img, 0, 0, w / 2, h, 0, 0, w / 2, h);
        ctxR?.drawImage(img, w / 2, 0, w / 2, h, 0, 0, w / 2, h);
      };

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 1;
        setProgress(currentProgress);
        
        if (currentProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setStage("done");
            onComplete();
          }, 100);
        }
      }, 25);
      
      return () => clearInterval(interval);
    }
  }, [stage, onComplete]);

  if (stage === "done") return null;

  let logText = "SYNCING DATA STREAM...";
  if (progress > 30) logText = "ESTABLISHING HANDSHAKE...";
  if (progress > 70) logText = "PROXIMITY ALERT...";
  if (progress > 90) logText = "CONNECTION IMMINENT...";

  const blockCount = 20;
  const blocksToFill = Math.floor((progress / 100) * blockCount);

  const leftPos = -40 + (progress * 0.385);
  const rightPos = 40 - (progress * 0.385);

  return (
    <>
      <div className={`landing-page ${stage === "landing" ? "show" : "hide"}`}>
        <div className="left-panel">
          <div className="product-badge">Razorpay Risk Engine</div>
          <h1 className="brand-title">MANDATE</h1>
          <h2 className="tagline">Trust the intent. Verify the action.</h2>
          <div className="features-list">Detector · Verifier · Auto-Responder</div>
          <p className="description">A security boundary for autonomous payment actions.</p>
          
          <button className="get-started-btn hover-trigger" onClick={startSequence}>
            Initialize Sequence
          </button>
        </div>
        <div className="right-panel">
          <img src="/data-makes-money.jpg" alt="Data Makes Money" className="floating-art" />
        </div>
      </div>

      <div className={`loading-stage ${stage === "loading" ? "show" : "hide"}`}>
        <canvas 
          ref={canvasLeftRef} 
          className="hand-canvas" 
          style={{ left: 0, transform: `translateY(-50%) translateX(${leftPos}%)` }}
        />
        <canvas 
          ref={canvasRightRef} 
          className="hand-canvas" 
          style={{ right: 0, transform: `translateY(-50%) translateX(${rightPos}%)` }}
        />

        <div className="retro-modal">
          <div className="modal-titlebar">
            <span>PROJECT.EXE</span>
            <div className="window-btns"><span>_</span><span>□</span><span>X</span></div>
          </div>
          <div className="modal-content">
            <div className="terminal-log">{logText}</div>
            <div className="progress-frame">
              <div className="progress-bar">
                {Array.from({ length: blockCount }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`progress-block ${i < blocksToFill ? "filled" : ""}`} 
                  />
                ))}
              </div>
            </div>
            <div className="telemetry-row">
              <span>0x0000FF</span>
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
