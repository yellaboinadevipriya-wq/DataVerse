import { useEffect, useRef } from 'react'

/** Lightweight canvas "data universe": drifting nodes linked by luminous edges, parallax on pointer.
 *  Falls back to a static frame for reduced-motion, pauses when the tab is hidden, scales down on weak devices. */
export default function Universe() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const weak = (navigator.hardwareConcurrency || 4) <= 4 || window.innerWidth < 700
    const N = weak ? 55 : 110
    const colors = ['#7c6cff', '#2ee6ff', '#ff5fd2', '#4f7bff']
    let w = 0, h = 0, raf = 0, mx = 0, my = 0
    const pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * .8 + .2,
      vx: (Math.random() - .5) * .00025, vy: (Math.random() - .5) * .00025, c: colors[(Math.random() * colors.length) | 0] }))
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      const px = pts.map((p) => ({ x: p.x * w + mx * 24 * p.z, y: p.y * h + my * 24 * p.z, p }))
      for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) {
        const dx = px[i].x - px[j].x, dy = px[i].y - px[j].y, d = Math.hypot(dx, dy), max = weak ? 110 : 140
        if (d < max) { ctx.globalAlpha = (1 - d / max) * .35; ctx.strokeStyle = px[i].p.c; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px[i].x, px[i].y); ctx.lineTo(px[j].x, px[j].y); ctx.stroke() }
      }
      for (const { x, y, p } of px) {
        ctx.globalAlpha = .9; ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 14 * p.z
        ctx.beginPath(); ctx.arc(x, y, 1.4 + 2.2 * p.z, 0, 7); ctx.fill(); ctx.shadowBlur = 0
      }
    }
    const tick = () => {
      for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < -.05 || p.x > 1.05) p.vx *= -1; if (p.y < -.05 || p.y > 1.05) p.vy *= -1 }
      draw(); raf = requestAnimationFrame(tick)
    }
    const move = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5 }
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) raf = requestAnimationFrame(tick) }
    resize(); draw(); if (!reduce) raf = requestAnimationFrame(tick)
    window.addEventListener('resize', resize); window.addEventListener('pointermove', move); document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return <canvas ref={ref} aria-hidden="true" />
}
