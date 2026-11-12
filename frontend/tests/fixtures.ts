export const user = { id: 1, email: 'a@example.com', name: 'Ada Lovelace', language: 'en' }
const regions = ['North', 'South', 'East', 'West'], cats = ['Furniture', 'Technology', 'Office Supplies'], segs = ['Consumer', 'Corporate', 'Home Office']
export const rows = Array.from({ length: 48 }, (_, i) => ({
  order_id: `O-${i}`, order_date: `${i % 2 ? 2024 : 2023}-${String((i % 12) + 1).padStart(2, '0')}-10`, region: regions[i % 4], product_category: cats[i % 3],
  product: ['Chair', 'Laptop', 'Paper'][i % 3], sales: 100 + i * 10, profit: 10 + (i % 5) * 4 - 6, quantity: 1 + (i % 4), customer_segment: segs[i % 3],
}))
export const dataset = { id: 'd1', name: 'sales.csv', size_bytes: 1000, rows: 48, cols: 9, created_at: '2025-01-01', updated_at: '2025-01-01', operations: [] }
const profile = { rows: 48, columns: 3, duplicates: 0, missing_cells: 1, kinds: { numeric: 2, categorical: 1 }, issues: [{ column: 'sales', type: 'missing', message: "'sales' has 1 missing values (2%)." }],
  column_info: [{ name: 'region', kind: 'categorical', dtype: 'object', missing: 0, missing_pct: 0, unique: 4, top_values: [{ value: 'North', count: 12 }] }, { name: 'sales', kind: 'numeric', dtype: 'float64', missing: 1, missing_pct: 2.1, unique: 40, min: 1, max: 9, mean: 4, median: 4, std: 2 }] }
const challenges = [{ id: 'regions', title: 'List the regions', level: 'Beginner', prompt: 'Return each region.', hint: 'DISTINCT', solved: false }]
export const publicPortfolio = { name: 'Ada Lovelace', headline: 'Aspiring Data Analyst', bio: 'Hello', education: '', goals: '', skills: ['SQL'], links: { github: 'https://github.com/x' }, resume_url: '', projects: [{ title: 'Public Project', summary: 's', tools: ['SQL'], dataset: '', methodology: '', findings: '', links: {} }] }

export function route(method: string, url: string): any {
  const u = url.split('?')[0]
  const miss = () => { const e: any = new Error('404'); e.response = { status: 404, data: { detail: 'This portfolio does not exist or is not public.' } }; throw e }
  if (u === '/auth/me') return user
  if (u === '/progress') return { completed: [], quiz_attempts: [] }
  if (u === '/summary') return { datasets: 1, analyses: 0, lessons_completed: 0, quiz_attempts: 0, perfect_quizzes: 0, cleaning_steps: 0, sql_solved: 0, projects_completed: 0 }
  if (u === '/datasets') return [dataset]
  if (u === '/analyses') return []
  if (u === '/samples/retail') return { key: 'retail', rows }
  if (u === '/datasets/d1/profile') return profile
  if (u === '/datasets/d1/preview') return { page: 1, page_size: 25, pages: 1, total_rows: 2, columns: [{ name: 'region', kind: 'categorical' }, { name: 'sales', kind: 'numeric' }], rows: [{ region: 'North', sales: 5 }, { region: 'South', sales: null }] }
  if (u === '/datasets/d1/eda') return { insights: ["'sales' is right-skewed."], correlation: null }
  if (u === '/sql/schema') return [{ table: 'orders', rows: 1500, columns: [{ name: 'sales', type: 'REAL' }] }]
  if (u === '/sql/challenges') return challenges
  if (u === '/projects/progress') return {}
  if (u === '/portfolio') return { headline: '', bio: '', education: '', goals: '', skills: [], links: {}, resume_url: '', is_public: false, show_progress: false, projects: [], slug: null }
  if (u === '/embeds') return []
  if (u === '/public/portfolio/abc') return publicPortfolio
  if (u.startsWith('/public/portfolio/')) return miss()
  throw Object.assign(new Error('unmocked ' + method + ' ' + url), { response: { status: 404, data: { detail: 'unmocked ' + url } } })
}
