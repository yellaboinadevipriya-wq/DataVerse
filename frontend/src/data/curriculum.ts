export type QuizQ = { q: string; options: string[]; answer: number; explain: string }
export type Lesson = {
  id: string; title: string; minutes: number; objectives: string[]
  sections: { h: string; p: string }[]
  example: { title: string; lang: string; code: string }
  exercise: { prompt: string; hint: string; solution: string }
  takeaways: string[]; quiz: QuizQ[]
  challenge?: string; expected?: string; mistakes?: string[]; lab?: { to: string; label: string }
}
export type Level = { n: number; title: string; blurb: string; lessons: Lesson[]; planned: string[]; lab?: { to: string; label: string } }

import { TABLEAU_LESSONS, POWERBI_LESSONS } from './studio-lessons'

const L = (l: Lesson) => l

export const LEVELS: Level[] = [
  { n: 1, title: 'Foundations of Data Analytics', blurb: 'Think like an analyst: questions, data types, and data quality.', planned: ['Excel fundamentals', 'Spreadsheet formulas and functions', 'Sorting, filtering, pivot tables and charts'], lessons: [
    L({ id: 'l1-intro', title: 'What is data analytics?', minutes: 10,
      objectives: ['Define data analytics in your own words', 'Describe the four kinds of analysis', 'Turn a vague request into an analytical question'],
      sections: [
        { h: 'Analytics is answering questions with data', p: 'Data analytics means collecting, cleaning and examining data so people can make better decisions. A shop owner asking "Which products should I restock?" is asking an analytics question.' },
        { h: 'Four kinds of analysis', p: 'Descriptive analysis says what happened (sales last month). Diagnostic analysis asks why (sales fell because one region ran out of stock). Predictive analysis estimates what may happen. Prescriptive analysis suggests what to do. Most entry-level work is descriptive and diagnostic.' },
        { h: 'The analyst workflow', p: 'Ask → Collect → Clean → Explore → Visualize → Communicate. DataVerse\'s Workspace follows this order: upload, profile, clean, chart, ask, export.' },
      ],
      example: { title: 'Vague request → analytical question', lang: 'text', code: 'Request:  "Sales feel slow."\nQuestion: "Did total monthly revenue fall in the last 3 months compared with the same months last year, and in which regions?"\nData needed: order_date, region, revenue' },
      exercise: { prompt: 'Your manager says "Customers seem unhappy." Write one measurable analytical question and list two columns you would need.', hint: 'Make it measurable: a number, a time period, and a comparison.', solution: 'Example: "Did the average support rating drop in the last quarter compared with the previous one?" Columns: rating, ticket_date.' },
      takeaways: ['Analytics turns data into decisions', 'Good questions are specific and measurable', 'Cleaning comes before analysis'],
      quiz: [
        { q: 'Which type of analysis explains WHY something happened?', options: ['Descriptive', 'Diagnostic', 'Predictive', 'Prescriptive'], answer: 1, explain: 'Diagnostic analysis digs into causes; descriptive only reports what happened.' },
        { q: 'Which is the best analytical question?', options: ['Why is business bad?', 'Show me data', 'Did monthly revenue fall in Q3 versus Q2?', 'What is a chart?'], answer: 2, explain: 'It is measurable, time-bound and comparative.' },
        { q: 'What usually comes right after collecting data?', options: ['Presenting', 'Cleaning', 'Predicting', 'Deleting'], answer: 1, explain: 'Raw data almost always needs cleaning before it can be trusted.' },
      ] }),
    L({ id: 'l1-data-types', title: 'Types of data and data quality', minutes: 12,
      objectives: ['Tell numeric, categorical, date and text data apart', 'Name the main data-quality problems', 'Choose a sensible summary for each type'],
      sections: [
        { h: 'Column types', p: 'Numeric columns (price, age) support averages and sums. Categorical columns (region, grade) have a small set of labels and support counts. Date columns support trends over time. Text columns (comments) are free-form and need special handling.' },
        { h: 'Why types matter', p: 'An average of ZIP codes is meaningless even though they look numeric. Always ask what a column represents, not just how it is stored.' },
        { h: 'Data-quality problems', p: 'Missing values, duplicate rows, inconsistent labels ("India" vs "india"), wrong types (numbers stored as text), impossible values (age = 250) and outliers. DataVerse\'s Profile tab detects several of these automatically.' },
      ],
      example: { title: 'Choosing a summary', lang: 'text', code: 'price (numeric)      -> mean, median, min, max\nregion (categorical) -> counts, top values\norder_date (date)    -> trend by month\nnotes (text)         -> search / keyword counts' },
      exercise: { prompt: 'A column "pincode" holds values like 500081. Is it numeric or categorical, and why?', hint: 'Would adding two pincodes ever make sense?', solution: 'Categorical. It is an identifier: arithmetic on it has no meaning, so use counts and groups instead.' },
      takeaways: ['Meaning matters more than storage type', 'Profile data before analysing it', 'Quality problems silently distort results'],
      quiz: [
        { q: 'Which summary suits a categorical column best?', options: ['Mean', 'Standard deviation', 'Frequency counts', 'Correlation'], answer: 2, explain: 'Categories are described by how often each label appears.' },
        { q: '"Delhi" and "delhi" in one column is an example of…', options: ['Outlier', 'Inconsistent values', 'Duplicate rows', 'Missing data'], answer: 1, explain: 'Same meaning, different spelling — group-bys will treat them separately.' },
        { q: 'Age = 250 is most likely…', options: ['A valid outlier', 'An impossible value', 'A date', 'A category'], answer: 1, explain: 'No human is 250, so it is a data-entry error to investigate.' },
      ] }),
  ] },
  { n: 2, title: 'Microsoft Excel', blurb: 'Spreadsheet skills every analyst uses daily.', planned: ['Workbook basics, sorting, filtering and tables', 'SUM, AVERAGE, COUNT, IF, SUMIF, COUNTIF, XLOOKUP', 'Text and date functions', 'Conditional formatting, PivotTables and dashboards'], lessons: [], lab: { to: '/projects', label: 'Practice with the Excel project' } },
  { n: 3, title: 'SQL', blurb: 'Ask databases precise questions.', planned: ['Database fundamentals', 'JOINs', 'Subqueries and CTEs', 'Window functions', 'Practical business queries'], lab: { to: '/sql-lab', label: 'Open SQL Lab (8 graded challenges)' }, lessons: [
    L({ id: 'l2-select-where', title: 'SELECT, WHERE and ORDER BY', minutes: 12,
      objectives: ['Read rows with SELECT', 'Filter with WHERE', 'Sort with ORDER BY and limit results'],
      sections: [
        { h: 'SELECT chooses columns', p: 'SELECT name, price FROM products returns only those two columns from the products table. SELECT * returns every column.' },
        { h: 'WHERE filters rows', p: 'WHERE keeps rows that satisfy a condition: price > 100, region = \'North\', or combined with AND / OR.' },
        { h: 'ORDER BY and LIMIT', p: 'ORDER BY price DESC sorts from highest to lowest. LIMIT 5 keeps the first five rows — together they give you a "top 5".' },
      ],
      example: { title: 'Top 5 expensive products in the North', lang: 'sql', code: "SELECT name, price\nFROM products\nWHERE region = 'North' AND price > 100\nORDER BY price DESC\nLIMIT 5;" },
      exercise: { prompt: 'Write a query returning the 3 cheapest products whose category is \'Books\'.', hint: 'Combine WHERE, ORDER BY ascending, and LIMIT.', solution: "SELECT name, price FROM products WHERE category = 'Books' ORDER BY price ASC LIMIT 3;" },
      takeaways: ['SELECT picks columns, WHERE picks rows', 'Text values go in single quotes', 'ORDER BY + LIMIT = top-N'],
      quiz: [
        { q: 'Which clause filters rows?', options: ['SELECT', 'WHERE', 'ORDER BY', 'LIMIT'], answer: 1, explain: 'WHERE keeps only rows meeting the condition.' },
        { q: 'ORDER BY price DESC returns…', options: ['Cheapest first', 'Most expensive first', 'Random order', 'Only 10 rows'], answer: 1, explain: 'DESC means descending: largest values first.' },
        { q: 'Which gives the top 3 rows?', options: ['TOP BY 3', 'ORDER BY x DESC LIMIT 3', 'WHERE 3', 'SELECT 3'], answer: 1, explain: 'Sort first, then LIMIT.' },
      ] }),
    L({ id: 'l2-group-by', title: 'GROUP BY and aggregates', minutes: 14,
      objectives: ['Use COUNT, SUM, AVG, MIN and MAX', 'Group rows with GROUP BY', 'Filter groups with HAVING'],
      sections: [
        { h: 'Aggregates collapse many rows into one number', p: 'COUNT(*) counts rows, SUM adds, AVG averages, MIN/MAX find extremes.' },
        { h: 'GROUP BY makes one result per group', p: 'SELECT region, SUM(revenue) FROM sales GROUP BY region returns total revenue for each region. Every selected column must be either grouped or aggregated.' },
        { h: 'WHERE vs HAVING', p: 'WHERE filters rows before grouping. HAVING filters groups after aggregation — for example regions whose total exceeds 10,000.' },
      ],
      example: { title: 'Revenue per region above 10,000', lang: 'sql', code: 'SELECT region, SUM(revenue) AS total_revenue\nFROM sales\nGROUP BY region\nHAVING SUM(revenue) > 10000\nORDER BY total_revenue DESC;' },
      exercise: { prompt: 'Write a query that shows the number of orders per customer, only for customers with at least 5 orders.', hint: 'COUNT(*) with GROUP BY customer_id and HAVING.', solution: 'SELECT customer_id, COUNT(*) AS orders FROM orders GROUP BY customer_id HAVING COUNT(*) >= 5;' },
      takeaways: ['Aggregates summarise; GROUP BY splits into groups', 'HAVING filters after grouping', 'Same idea as DataVerse\'s bar-chart aggregations'],
      quiz: [
        { q: 'Which filters groups AFTER aggregation?', options: ['WHERE', 'HAVING', 'LIMIT', 'DISTINCT'], answer: 1, explain: 'HAVING works on aggregated results; WHERE works on raw rows.' },
        { q: 'SELECT region, AVG(price) … needs…', options: ['GROUP BY region', 'ORDER BY price', 'LIMIT 1', 'Nothing'], answer: 0, explain: 'region is not aggregated, so it must be grouped.' },
        { q: 'COUNT(*) returns…', options: ['Sum of a column', 'Number of rows', 'Maximum value', 'Average'], answer: 1, explain: 'It counts rows in each group (or the whole table).' },
      ] }),
  ] },
  { n: 4, title: 'Python for Data Analysis', blurb: 'Automate analysis with Python and pandas.', planned: ['Python fundamentals: variables, loops, functions', 'Lists, dictionaries and file handling', 'NumPy'], lessons: [
    L({ id: 'l3-pandas', title: 'Pandas: your first DataFrame', minutes: 15,
      objectives: ['Load a CSV into a DataFrame', 'Inspect shape, types and missing values', 'Filter and group data'],
      sections: [
        { h: 'A DataFrame is a table in Python', p: 'pandas stores tabular data in a DataFrame: rows and named columns. pd.read_csv loads a file.' },
        { h: 'Inspect before you analyse', p: 'df.shape gives (rows, columns), df.dtypes shows types, df.isna().sum() counts missing values per column and df.describe() summarises numeric columns.' },
        { h: 'Filter and group', p: 'df[df["price"] > 100] filters rows. df.groupby("region")["revenue"].sum() totals revenue per region — the same logic DataVerse runs on the server for your charts.' },
      ],
      example: { title: 'Load, inspect, summarise', lang: 'python', code: 'import pandas as pd\n\ndf = pd.read_csv("sales.csv")\nprint(df.shape)\nprint(df.isna().sum())\nprint(df.groupby("region")["revenue"].sum().sort_values(ascending=False))' },
      exercise: { prompt: 'Write pandas code to find the average price of rows where category is "Books".', hint: 'Filter first, then select the column and call .mean().', solution: 'df[df["category"] == "Books"]["price"].mean()' },
      takeaways: ['Always inspect shape, types and missing values first', 'Boolean masks filter rows', 'groupby + aggregate = summary per category'],
      quiz: [
        { q: 'Which counts missing values per column?', options: ['df.shape', 'df.isna().sum()', 'df.head()', 'df.dtypes'], answer: 1, explain: 'isna() marks missing cells; sum() counts them.' },
        { q: 'df.shape returns…', options: ['Column names', '(rows, columns)', 'Data types', 'A chart'], answer: 1, explain: 'It is a tuple with row and column counts.' },
        { q: 'Which total revenue per region?', options: ['df.sum("region")', 'df.groupby("region")["revenue"].sum()', 'df.filter("region")', 'df.region.revenue'], answer: 1, explain: 'groupby splits by region, then sum aggregates revenue.' },
      ] }),
  ] },
  { n: 5, title: 'Statistics & Analytical Thinking', blurb: 'Summarise and interpret numbers honestly.', planned: ['Probability fundamentals', 'Distributions and sampling', 'Correlation and regression', 'Hypothesis testing and confidence intervals'], lessons: [
    L({ id: 'l4-descriptive', title: 'Mean, median, mode and spread', minutes: 12,
      objectives: ['Compute mean, median and mode', 'Explain why the median resists outliers', 'Interpret standard deviation'],
      sections: [
        { h: 'Three kinds of "average"', p: 'The mean adds all values and divides by the count. The median is the middle value after sorting. The mode is the most frequent value.' },
        { h: 'Outliers pull the mean', p: 'For salaries 30, 32, 35, 38 and 400 (thousands) the mean is 107 but the median is 35. When data is skewed, report the median.' },
        { h: 'Spread', p: 'Standard deviation measures how far values typically sit from the mean. A small value means values cluster tightly; a large one means they are scattered.' },
      ],
      example: { title: 'Mean vs median', lang: 'python', code: 'import statistics as st\nsalaries = [30, 32, 35, 38, 400]\nprint(st.mean(salaries))    # 107\nprint(st.median(salaries))  # 35' },
      exercise: { prompt: 'Values: 4, 8, 8, 10, 20. Find the mean, median and mode.', hint: 'Mean = sum/count; sort for the median.', solution: 'Mean = 50/5 = 10, median = 8, mode = 8.' },
      takeaways: ['Mean is sensitive to outliers; median is robust', 'Mode suits categories', 'Always report spread, not just the centre'],
      quiz: [
        { q: 'Which measure resists outliers best?', options: ['Mean', 'Median', 'Sum', 'Range'], answer: 1, explain: 'The median depends on the middle position, not extreme values.' },
        { q: 'Mean of 2, 4, 6 is…', options: ['3', '4', '6', '12'], answer: 1, explain: '(2+4+6)/3 = 4.' },
        { q: 'A large standard deviation means values are…', options: ['Identical', 'Widely scattered', 'All missing', 'Sorted'], answer: 1, explain: 'It indicates large typical distance from the mean.' },
      ] }),
  ] },
  { n: 6, title: 'Data Cleaning & Preparation', blurb: 'Make messy data trustworthy, then explore it.', planned: ['Inconsistent values and data types', 'Outlier detection', 'Feature preparation', 'Data quality reporting'], lessons: [
    L({ id: 'l5-missing', title: 'Missing values and duplicates', minutes: 14,
      objectives: ['Find missing values and duplicates', 'Choose between dropping and filling', 'Explain the risk of each choice'],
      sections: [
        { h: 'Find them first', p: 'Profile the dataset: count missing cells per column and duplicate rows. In DataVerse, open the Profile tab.' },
        { h: 'Drop or fill?', p: 'Dropping rows is simple but loses information and can bias results if the missing rows are not random. Filling with the median (numeric) or mode (categorical) keeps rows but reduces variation. Never fill blindly — ask why the data is missing.' },
        { h: 'Duplicates', p: 'Exact duplicate rows inflate counts and sums. Remove them, but first check whether repeated rows are genuine repeat events (two identical purchases) rather than errors.' },
      ],
      example: { title: 'Cleaning in pandas', lang: 'python', code: 'df = df.drop_duplicates()\ndf["age"] = df["age"].fillna(df["age"].median())\ndf = df.dropna(subset=["customer_id"])' },
      exercise: { prompt: 'Upload any CSV to the Workspace, open Clean, and preview "Fill missing values" with the median on a numeric column. Compare the before/after mean.', hint: 'Use Preview before Apply. You can always Undo.', solution: 'The mean stays almost the same, but the number of missing cells drops to zero for that column.' },
      takeaways: ['Profile before cleaning', 'Filling and dropping both have trade-offs', 'Keep the original data so you can undo'],
      quiz: [
        { q: 'Filling missing numbers with the median is usually safer than the mean when…', options: ['Data is skewed', 'Data is text', 'There are no outliers', 'Always'], answer: 0, explain: 'Skew and outliers distort the mean.' },
        { q: 'Why check duplicates before removing them?', options: ['They are always errors', 'Some are real repeat events', 'Pandas forbids it', 'To save disk space'], answer: 1, explain: 'Two identical purchases may both be genuine.' },
        { q: 'A risk of dropping rows with missing data is…', options: ['Bias and lost information', 'Faster code', 'More columns', 'Nothing'], answer: 0, explain: 'If missingness is not random, the remaining sample may misrepresent reality.' },
      ] }),
  ] },
  { n: 7, title: 'Tableau', blurb: 'Build views and dashboards the way Tableau does.', planned: ['Maps and geographic views', 'Parameters, sets and hierarchies', 'Story points and performance'], lessons: TABLEAU_LESSONS, lab: { to: '/tableau', label: 'Open Tableau Studio' } },
  { n: 8, title: 'Microsoft Power BI', blurb: 'Model data, write DAX measures and design reports.', planned: ['Importing from databases', 'Decomposition trees and maps', 'Bookmarks, drill-through and Power BI Service sharing'], lessons: POWERBI_LESSONS, lab: { to: '/powerbi', label: 'Open Power BI Studio' } },
  { n: 9, title: 'Business Intelligence & Dashboard Design', blurb: 'Pick the right KPIs and chart, and avoid misleading visuals.', planned: ['KPI selection and metric definitions', 'Executive vs operational dashboards', 'Choosing the correct chart', 'Avoiding misleading visualizations', 'Communicating insights to stakeholders'], lessons: [], lab: { to: '/viz-lab', label: 'Open Visualization Lab' } },
  { n: 10, title: 'Advanced Analytics & AI-Assisted Analysis', blurb: 'Forecasting basics, segmentation and responsible AI.', planned: ['Trend analysis and forecasting fundamentals', 'Segmentation and cohort analysis', 'Anomaly detection concepts', 'Validating AI-generated SQL, Python and summaries'], lessons: [], lab: { to: '/workspace', label: 'Open Analytics Workspace' } },
  { n: 11, title: 'Job & Interview Preparation', blurb: 'Resume, portfolio and interview practice.', planned: ['Data Analyst resume preparation', 'SQL, Excel and pandas interview questions', 'Tableau and Power BI interview questions', 'Business case studies and mock interviews'], lessons: [], lab: { to: '/portfolio', label: 'Open Portfolio Studio' } },
]

export const ALL_LESSONS = LEVELS.flatMap((l) => l.lessons.map((x) => ({ ...x, level: l.n, levelTitle: l.title })))
export const findLesson = (id?: string) => ALL_LESSONS.find((l) => l.id === id)
