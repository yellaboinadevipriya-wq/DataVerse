import { vi } from 'vitest'

class RO { observe() {} unobserve() {} disconnect() {} }
class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } root = null; rootMargin = ''; thresholds = [] }
;(globalThis as any).ResizeObserver = RO
;(globalThis as any).IntersectionObserver = IO
window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as any)
window.scrollTo = vi.fn() as any
HTMLCanvasElement.prototype.getContext = (() => ({ clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}, setTransform() {} })) as any
URL.createObjectURL = vi.fn(() => 'blob:x')
URL.revokeObjectURL = vi.fn()
Element.prototype.scrollIntoView = vi.fn()
