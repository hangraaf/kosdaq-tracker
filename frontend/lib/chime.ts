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

/**
 * 고급 시계 정각 차임 — grandfather-clock / minute repeater 톤.
 * 벨 파셜(0.5·1·2·2.4·3·4.5)을 겹쳐 풍부한 종소리를 합성하고,
 * E5 → C5 두 번 타격하는 "petite sonnerie" 패턴으로 정각을 알린다.
 */
function playRichBell(
  ctx: AudioContext,
  fundamental: number,
  startAt: number,
  decay: number,
  gain: number,
) {
  // [배수, 게인 가중치, 디케이 가중치(짧을수록 빠르게 사라짐), 파형]
  const partials: Array<[number, number, number, OscillatorType]> = [
    [0.5, 0.18, 1.10, "sine"],     // hum tone
    [1.0, 1.00, 1.00, "sine"],     // fundamental
    [2.0, 0.42, 0.70, "sine"],     // prime
    [2.4, 0.28, 0.55, "triangle"], // minor-third(벨 특유의 디튠)
    [3.0, 0.20, 0.45, "sine"],     // fifth
    [4.5, 0.10, 0.30, "sine"],     // nominal upper
  ];

  partials.forEach(([mult, g, dMul, type]) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fundamental * mult, startAt);

    const env = ctx.createGain();
    const peak = gain * g;
    const dur = decay * dMul;
    env.gain.setValueAtTime(0, startAt);
    env.gain.linearRampToValueAtTime(peak, startAt + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

    osc.connect(env).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.05);
  });
}

export function playHourlyChime() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime + 0.05;
  // ding (E5) → 1.1s 후 dong (C5, 더 길고 깊은 디케이)
  playRichBell(ctx, 659.25, t0,        4.0, 0.26);
  playRichBell(ctx, 523.25, t0 + 1.05, 5.2, 0.30);
  setTimeout(() => ctx.close().catch(() => {}), 7000);
}
