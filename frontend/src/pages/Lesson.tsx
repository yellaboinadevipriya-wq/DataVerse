
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  PenLine,
  Target,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Notice, Tabs } from '../components/ui'
import { errMsg, useApp } from '../ctx'
import { ALL_LESSONS, findLesson } from '../data/curriculum'
import {
  getLocalizedLesson,
  type LessonLanguage,
} from '../data/lesson-translations'

type Tab = 'learn' | 'practice' | 'quiz'

export default function LessonPage() {
  const { lessonId } = useParams()
  const lesson = findLesson(lessonId)
  const { user, progress, refreshProgress, refreshSummary, toast } = useApp()

  const language: LessonLanguage =
    user?.language === 'te' || user?.language === 'hi'
      ? user.language
      : 'en'

  const displayLesson = lesson
    ? getLocalizedLesson(lesson, language)
    : undefined

  const [tab, setTab] = useState<Tab>('learn')
  const [showSol, setShowSol] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [result, setResult] = useState<{ score: number } | null>(null)

  useEffect(() => {
    setTab('learn')
    setShowSol(false)
    setPicked([])
    setResult(null)
  }, [lessonId])

  if (!lesson) {
    return (
      <div className="empty">
        <h2>Lesson not found</h2>
        <Link className="btn primary" to="/academy">
          Back to Academy
        </Link>
      </div>
    )
  }

  // Use translated content for display, but preserve the original
  // lesson for scoring, completion, and saved progress.
  const shownLesson = displayLesson ?? lesson

  const idx = ALL_LESSONS.findIndex((l) => l.id === lesson.id)
  const prev = ALL_LESSONS[idx - 1]
  const next = ALL_LESSONS[idx + 1]

  const done = progress.completed.some(
    (c) => c.lesson_id === lesson.id,
  )

  const order: Tab[] = ['learn', 'practice', 'quiz']

  const dir = (t: Tab) =>
    order.indexOf(t) >= order.indexOf(tab) ? 1 : -1

  const toggleDone = async () => {
    if (!user) {
      return toast('Sign in to save your progress.', 'error')
    }

    try {
      if (done) {
        await api.delete(`/progress/lessons/${lesson.id}`)
      } else {
        await api.post('/progress/lessons', {
          lesson_id: lesson.id,
        })
      }

      await Promise.all([refreshProgress(), refreshSummary()])

      if (!done) {
        toast('Lesson marked complete.', 'success')
      }
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const submitQuiz = async () => {
    // Keep the original answer indexes for accurate scoring.
    const score = lesson.quiz.reduce(
      (total, question, index) =>
        total + (picked[index] === question.answer ? 1 : 0),
      0,
    )

    setResult({ score })

    if (!user) {
      return toast(
        'Quiz scored locally. Sign in to save attempts.',
        'info',
      )
    }

    try {
      await api.post('/quiz-attempts', {
        lesson_id: lesson.id,
        score,
        total: lesson.quiz.length,
        answers: picked.map((answer) => answer ?? -1),
      })

      await Promise.all([refreshProgress(), refreshSummary()])
    } catch (e) {
      toast(errMsg(e), 'error')
    }
  }

  const lastAttempt = progress.quiz_attempts.find(
    (attempt) => attempt.lesson_id === lesson.id,
  )

  const languageLabel =
    language === 'te'
      ? 'తెలుగు'
      : language === 'hi'
        ? 'हिन्दी'
        : 'English'

  return (
    <>
      <p className="small muted">
        <Link to="/academy">Academy</Link> /{' '}
        {ALL_LESSONS[idx]?.levelTitle ?? ''} / {shownLesson.title}
      </p>

      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'clamp(1.9rem,4vw,2.8rem)' }}>
            {shownLesson.title}
          </h1>

          <span className="chip">
            Module {ALL_LESSONS[idx]?.level} · {lesson.minutes} min ·{' '}
            {languageLabel}
          </span>
        </div>

        <button
          className={'btn ' + (done ? '' : 'primary')}
          onClick={toggleDone}
        >
          <CheckCircle2 size={16} />
          {done ? 'Completed — undo' : 'Mark complete'}
        </button>
      </div>

      <div style={{ height: '1.2rem' }} />

      <Tabs
        id="lesson"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'learn', label: 'Learn', icon: <BookOpen size={16} /> },
          {
            key: 'practice',
            label: 'Practice',
            icon: <PenLine size={16} />,
          },
          {
            key: 'quiz',
            label: `Quiz (${lesson.quiz.length})`,
            icon: <ListChecks size={16} />,
          },
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ x: 50 * dir(tab), opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -50 * dir(tab), opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 'learn' && (
            <div className="grid">
              <div className="card">
                <h3>
                  <Target
                    size={18}
                    style={{ verticalAlign: -3 }}
                  />{' '}
                  Objectives
                </h3>

                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {shownLesson.objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </div>

              {shownLesson.sections.map((section, index) => (
                <motion.div
                  key={`${section.h}-${index}`}
                  className="card"
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.06 * index }}
                >
                  <h3>{section.h}</h3>
                  <p style={{ margin: 0 }}>{section.p}</p>
                </motion.div>
              ))}

              <div className="card">
                <h3>Example: {shownLesson.example.title}</h3>
                <pre>
                  <code>{shownLesson.example.code}</code>
                </pre>
              </div>

              {shownLesson.mistakes && (
                <div className="card">
                  <h3>Common mistakes</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    {shownLesson.mistakes.map((mistake, index) => (
                      <li key={index}>{mistake}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="card">
                <h3>
                  <Lightbulb
                    size={18}
                    style={{ verticalAlign: -3 }}
                  />{' '}
                  Key takeaways
                </h3>

                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  {shownLesson.takeaways.map((takeaway, index) => (
                    <li key={index}>{takeaway}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === 'practice' && (
            <div className="card">
              <h3>Exercise</h3>
              <p>{shownLesson.exercise.prompt}</p>

              <Notice>
                Hint: {shownLesson.exercise.hint}
              </Notice>

              <button
                className="btn"
                onClick={() => setShowSol(!showSol)}
              >
                {showSol ? 'Hide' : 'Reveal'} sample solution
              </button>

              <AnimatePresence>
                {showSol && (
                  <motion.pre
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <code>{shownLesson.exercise.solution}</code>
                  </motion.pre>
                )}
              </AnimatePresence>

              {shownLesson.challenge && (
                <>
                  <h3 style={{ marginTop: '1rem' }}>
                    Challenge
                  </h3>
                  <p>{shownLesson.challenge}</p>
                </>
              )}

              {shownLesson.expected && (
                <details>
                  <summary>Expected output and explanation</summary>
                  <p className="muted" style={{ margin: 0 }}>
                    {shownLesson.expected}
                  </p>
                </details>
              )}

              <div
                className="row"
                style={{ marginTop: '1rem' }}
              >
                {shownLesson.lab && (
                  <Link
                    className="btn primary"
                    to={shownLesson.lab.to}
                  >
                    {shownLesson.lab.label}
                  </Link>
                )}

                <Link className="btn" to="/workspace">
                  Practice in the Workspace
                </Link>
              </div>
            </div>
          )}

          {tab === 'quiz' && (
            <div className="grid">
              {lastAttempt && !result && (
                <Notice>
                  Your latest saved attempt: {lastAttempt.score}/
                  {lastAttempt.total}.
                </Notice>
              )}

              {shownLesson.quiz.map((question, questionIndex) => (
                <div className="card" key={questionIndex}>
                  <h3>
                    {questionIndex + 1}. {question.q}
                  </h3>

                  {question.options.map((option, optionIndex) => {
                    const correctAnswer =
                      lesson.quiz[questionIndex]?.answer

                    const cls = result
                      ? optionIndex === correctAnswer
                        ? ' right'
                        : picked[questionIndex] === optionIndex
                          ? ' wrong'
                          : ''
                      : picked[questionIndex] === optionIndex
                        ? ' sel'
                        : ''

                    return (
                      <button
                        key={optionIndex}
                        className={'quiz-opt' + cls}
                        disabled={!!result}
                        onClick={() => {
                          const updated = [...picked]
                          updated[questionIndex] = optionIndex
                          setPicked(updated)
                        }}
                      >
                        {result && optionIndex === correctAnswer && (
                          <CheckCircle2 size={16} />
                        )}

                        {result &&
                          picked[questionIndex] === optionIndex &&
                          optionIndex !== correctAnswer && (
                            <XCircle size={16} />
                          )}

                        {option}
                      </button>
                    )
                  })}

                  {result && (
                    <p
                      className="small muted"
                      style={{ margin: '.5rem 0 0' }}
                    >
                      {shownLesson.quiz[questionIndex]?.explain}
                    </p>
                  )}
                </div>
              ))}

              {result ? (
                <div className="card center">
                  <h2>
                    {result.score}/{lesson.quiz.length}
                  </h2>

                  <p className="muted">
                    {result.score === lesson.quiz.length
                      ? 'Perfect score!'
                      : 'Review the explanations above, then retry.'}
                  </p>

                  <button
                    className="btn"
                    onClick={() => {
                      setResult(null)
                      setPicked([])
                    }}
                  >
                    Retry quiz
                  </button>
                </div>
              ) : (
                <button
                  className="btn primary"
                  disabled={
                    picked.filter((answer) => answer !== undefined)
                      .length < lesson.quiz.length
                  }
                  onClick={submitQuiz}
                >
                  Submit answers
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          marginTop: '2rem',
        }}
      >
        {prev ? (
          <Link className="btn" to={`/academy/${prev.id}`}>
            <ArrowLeft size={16} />
            {prev.title}
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          <Link
            className="btn primary"
            to={`/academy/${next.id}`}
          >
            {next.title}
            <ArrowRight size={16} />
          </Link>
        ) : (
          <Link className="btn" to="/academy">
            Back to Academy
          </Link>
        )}
      </div>
    </>
  )
}
