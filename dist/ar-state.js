// One automatic clean restart after a sustained loss; never retain an untracked pose.
export function createTrackingRecovery({onRecover, delay = 7000, setTimer = setTimeout, clearTimer = clearTimeout}) {
  let timer, tracked = false, stopped = false;
  const cancel = () => { if (timer !== undefined) clearTimer(timer); timer = undefined; };
  return {
    found() { if (stopped) return; tracked = true; cancel(); },
    lost() {
      if (stopped || !tracked || timer !== undefined) return;
      tracked = false;
      timer = setTimer(() => { timer = undefined; if (!stopped) onRecover(); }, delay);
    },
    stop() { stopped = true; cancel(); },
  };
}
export function advanceDay(day, elapsedSeconds, daysPerSecond, totalDays, canAdvance) {
  return canAdvance ? Math.min(totalDays, day + Math.max(0, Math.min(elapsedSeconds, .1)) * daysPerSecond) : day;
}
export function targetAlignment(target, info) {
  if (target.metadata?.alignment) return target.metadata.alignment;
  return {scale: info.pixelsPerMetre / 774, x: 1 / 774, y: -5.5 / 774};
}
