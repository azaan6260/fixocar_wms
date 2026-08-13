// Web Audio API soft chime for toast notifications
export function playNotificationChime(type: 'STATUS_CHANGE' | 'ESTIMATE_APPROVED' | 'ESTIMATE_DECLINED' | 'JOB_CARD_CREATED' | 'SUCCESS' | 'INFO' | 'WARNING' = 'INFO') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    if (type === 'ESTIMATE_APPROVED' || type === 'SUCCESS') {
      // High double chime (E5 -> G5)
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'ESTIMATE_DECLINED' || type === 'WARNING') {
      // Lower double chime (E4 -> C4)
      osc.frequency.setValueAtTime(329.63, now);
      osc.frequency.setValueAtTime(261.63, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Soft single chime (C5 -> E5)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    // Graceful fallback if audio context blocked or unsupported
  }
}
