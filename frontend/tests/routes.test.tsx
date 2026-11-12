import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { route, rows, user } from './fixtures'

vi.mock('../src/api', async (orig) => {
  const real: any = await orig()
  const { route } = await import('./fixtures')
  const call = (m: string) => async (url: string, body?: any) => {
    if (m === 'post' && url === '/auth/login') return { data: { token: 't', user: (await import('./fixtures')).user } }
    return { data: route(m, url) }
  }
  return { ...real, api: { get: call('get'), post: call('post'), put: call('put'), patch: call('patch'), delete: call('delete') }, downloadFile: vi.fn() }
})

import App from '../src/App'
import { AppProvider } from '../src/ctx'
import { applyFilters, kpis, money } from '../src/lib/retail'

const mount = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppProvider><App /></AppProvider></MemoryRouter>)
const h1 = async (re: RegExp) => waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(re), { timeout: 8000 })
const noCrash = () => expect(screen.queryByText(/unexpected error/i)).toBeNull()

beforeEach(() => { localStorage.clear() })
afterEach(cleanup)

describe('authenticated routes render real content (not blank)', () => {
  beforeEach(() => localStorage.setItem('dataverse.token', 'tok'))
  const cases: [string, RegExp][] = [
    ['/', /Explore your data/], ['/academy', /Academy/], ['/academy/tb-lod', /Level of Detail/], ['/academy/pb-calculate', /CALCULATE/], ['/academy/l1-intro', /analytics/i],
    ['/tableau', /Tableau/], ['/powerbi', /Power BI/], ['/viz-lab', /Visualization/], ['/workspace', /Workspace/], ['/sql-lab', /SQL/], ['/projects', /Projects/],
    ['/projects/excel-sales', /Excel Sales/], ['/portfolio', /Portfolio/], ['/progress', /progress/i], ['/saved', /Saved/], ['/profile', /settings/i], ['/p/abc', /Ada Lovelace/],
  ]
  it.each(cases)('%s', async (path, re) => { mount(path); await h1(re); noCrash() })

  it('workspace with a dataset shows its tabs and data', async () => {
    mount('/workspace?dataset=d1'); await h1(/sales\.csv/)
    expect(await screen.findByText('North')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Profile/ }))
    expect(await screen.findByText(/Data-quality issues/)).toBeTruthy(); noCrash()
  })
  it('tableau simulator tab renders', async () => { mount('/tableau?tab=sim'); expect(await screen.findByText(/learning simulation/i, {}, { timeout: 8000 })).toBeTruthy(); noCrash() })
  it('tableau embed tab renders for a signed-in user', async () => { mount('/tableau?tab=embed'); expect(await screen.findByText(/Add your own Tableau dashboard/, {}, { timeout: 6000 })).toBeTruthy(); noCrash() })
  it('power bi report editor renders', async () => { mount('/powerbi?tab=report'); expect(await screen.findByText(/Fields · Sales/, {}, { timeout: 8000 })).toBeTruthy(); noCrash() })
  it('power bi measures tab renders', async () => { mount('/powerbi?tab=measures'); expect(await screen.findByText(/does not run a DAX engine/, {}, { timeout: 8000 })).toBeTruthy(); noCrash() })
  it('unknown route and public portfolio 404 show messages', async () => {
    mount('/nope'); expect(await screen.findByText('Page not found')).toBeTruthy(); cleanup()
    mount('/p/missing'); expect(await screen.findByText(/Portfolio not available/)).toBeTruthy()
  })
})

describe('signed-out behaviour', () => {
  it.each(['/workspace', '/projects', '/portfolio', '/progress', '/sql-lab'])('%s redirects to sign-in', async (p) => { mount(p); expect(await screen.findByRole('tab', { name: /Create account/ })).toBeTruthy() })
  it('public pages work without an account', async () => { mount('/academy/tb-interface'); await h1(/Tableau basics/); cleanup(); mount('/'); await h1(/Explore your data/); noCrash() })
  it('login lands on a populated home page, not a blank screen', async () => {
    mount('/auth')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } })
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in', hidden: false }))
    expect(await screen.findByText(/Welcome back, Ada/, {}, { timeout: 8000 })).toBeTruthy(); noCrash()
  })
})

describe('visualizations are computed from the data', () => {
  it('KPI helpers match manual sums and filters', () => {
    const k = kpis(rows as any)
    expect(k.sales).toBe(rows.reduce((a, r) => a + r.sales, 0)); expect(k.orders).toBe(48)
    const north = applyFilters(rows as any, { regions: ['North'], categories: [], segments: [], year: 'all', q: '' })
    expect(north.length).toBe(12); expect(kpis(north).sales).toBe(rows.filter((r) => r.region === 'North').reduce((a, r) => a + r.sales, 0))
    expect(applyFilters(rows as any, { regions: [], categories: [], segments: [], year: '2024', q: '' }).every((r) => r.order_date.startsWith('2024'))).toBe(true)
    expect(applyFilters(rows as any, { regions: [], categories: [], segments: [], year: 'all', q: 'laptop' }).every((r) => r.product === 'Laptop')).toBe(true)
  })
  it('changing the Region filter updates the KPI cards', async () => {
    localStorage.setItem('dataverse.token', 'tok'); mount('/viz-lab'); await h1(/Visualization/)
    const card = async (label: string) => (await screen.findByText(label)).parentElement as HTMLElement
    const all = '₹' + money(kpis(rows as any).sales)
    await waitFor(() => expect(within(screen.getAllByText('Total sales')[0].parentElement!).getByText(all)).toBeTruthy(), { timeout: 4000 })
    fireEvent.click(screen.getByLabelText('North'))
    const north = '₹' + money(kpis(rows.filter((r) => r.region === 'North') as any).sales)
    await waitFor(() => expect(within(screen.getAllByText('Total sales')[0].parentElement!).getByText(north)).toBeTruthy(), { timeout: 4000 })
    expect(screen.getByText(/12 of 48 records match/)).toBeTruthy()
  })
})

describe('simulators behave like their teaching models', () => {
  beforeEach(() => localStorage.setItem('dataverse.token', 'tok'))
  it('tableau: dropping Region and Sales on shelves builds the bar view and ticks the checkpoint', async () => {
    mount('/tableau?tab=sim')
    fireEvent.click(await screen.findByLabelText('Add Region to cols', {}, { timeout: 8000 }))
    fireEvent.click(screen.getByLabelText('Add Sales to rows'))
    expect(await screen.findByRole('heading', { name: 'SUM(Sales) by Region' })).toBeTruthy()
    const row = screen.getByText('Bar chart: SUM(Sales) by Region').parentElement!
    expect(row.querySelector('.lucide-check')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Add Product Category to color'))
    expect(row.parentElement!.textContent).toContain('Split the bars by Product Category')
  })
  it('power bi: CALCULATE ignores the category slicer while Total Sales follows it', async () => {
    mount('/powerbi?tab=measures')
    const chip = async (name: string) => (await screen.findByText(name, {}, { timeout: 8000 })).closest('.card')!.querySelector('.chip')!.textContent
    const [t0, tech0] = [await chip('Total Sales'), await chip('Technology Sales')]
    fireEvent.click(screen.getByLabelText('Furniture'))
    await waitFor(async () => expect(await chip('Total Sales')).not.toBe(t0))
    expect(await chip('Technology Sales')).toBe(tech0) // CALCULATE overrides the Furniture slicer
    expect(screen.getByText(/CALCULATE replaced your category slicer \(Furniture\)/)).toBeTruthy()
  })
})
