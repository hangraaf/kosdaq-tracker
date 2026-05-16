"use client";

/**
 * 백화점/호텔 로비 차임을 Web Audio로 합성.
 * 외부 음원 없이 sine + 약한 triangle 배음을 겹쳐 부드러운 mallet bell 톤을 만든다.
 * 사용자 제스처(버튼 클릭) 직후에 호출되어야 브라우저 autoplay 정책을 통과한다.
 */

type AC = typeof AudioContext;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const W = window as unknown as { AudioContext?: AC; webkitAudioContext?: AC };
  const Ctor = W.AudioContext ?? W.webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

function playBell(ctx: AudioContext, freq: number, startAt: number, duration: number, gain: number) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, startAt);
  master.gain.linearRampToValueAtTime(gain, startAt + 0.015);
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  master.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, startAt);
  osc1.connect(master);
  osc1.start(startAt);
  osc1.stop(startAt + duration + 0.05);

  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq * 2, startAt);
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  osc2.connect(g2).connect(master);
  osc2.start(startAt);
  osc2.stop(startAt + duration + 0.05);

  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(freq * 3, startAt);
  const g3 = ctx.createGain();
  g3.gain.value = 0.06;
  osc3.connect(g3).connect(master);
  osc3.start(startAt);
  osc3.stop(startAt + duration + 0.05);
}

function playSequence(notes: number[], stepMs = 220, duration = 1.6, gain = 0.22) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  notes.forEach((freq, i) => {
    playBell(ctx, freq, t0 + (i * stepMs) / 1000, duration, gain);
  });
  const totalMs = stepMs * notes.length + duration * 1000 + 100;
  setTimeout(() => ctx.close().catch(() => {}), totalMs);
}

// C5 = 523.25, E5 = 659.25, G5 = 783.99 — 메이저 트라이어드, 백화점 입장 차임 톤
export function playLoginChime() {
  playSequence([523.25, 659.25, 783.99], 220, 1.8, 0.22);
}

export function playLogoutChime() {
  playSequence([783.99, 659.25, 523.25], 220, 1.6, 0.18);
}
