// Purpose: Introduces DocuMind before first-time API-key setup.

import { motion, useReducedMotion } from "framer-motion";
import { FiArrowUpRight, FiBookmark, FiFileText, FiMessageCircle } from "react-icons/fi";

const features = [
  {
    icon: FiFileText,
    title: "Summary / Notes / Explain",
  },
  {
    icon: FiMessageCircle,
    title: "Ask Questions with source citations",
  },
  {
    icon: FiBookmark,
    title: "Saved history when signed in",
  },
];

const steps = [
  "Get a free Gemini API key from Google (takes about a minute)",
  "Paste it in DocuMind",
  "Upload a document and start",
];

function IntroScreen({ onGetStarted }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-[#030712] text-white md:h-dvh md:min-h-0 md:overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.18),transparent_58%),linear-gradient(180deg,#071326_0%,#030712_70%)]"
      />

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: "easeOut" }}
        className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 py-7 sm:px-6 sm:py-8 md:h-full md:min-h-0 md:py-3 lg:py-5"
      >
        <header className="mx-auto mb-5 max-w-3xl text-center sm:mb-6">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: 0.1 }}
            className="relative mb-3 inline-flex overflow-hidden rounded-full p-[1.5px]"
          >
            <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10" />
            <span
              aria-hidden="true"
              className={`absolute inset-[-150%] ${prefersReducedMotion ? "" : "animate-[spin_5s_linear_infinite]"}`}
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, transparent 78%, rgba(103,232,249,0.9) 88%, rgba(59,130,246,0.6) 94%, transparent 100%)",
              }}
            />
            <span className="relative inline-flex items-center gap-2.5 rounded-full bg-[#030712] px-4 py-2">
              <FiFileText aria-hidden="true" className="shrink-0 text-base text-cyan-400" />
              <span className="bg-linear-to-r from-cyan-300 to-blue-400 bg-clip-text text-sm font-semibold tracking-wide text-transparent sm:text-base">
                DocuMind AI
              </span>
            </span>
          </motion.div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Turn Documents Into Smart Insights
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base sm:leading-7">
            Upload PDFs, Word, PowerPoint, text files or images and get summaries,
            notes, plain-English explanations, and a chat that answers only from
            your own documents.
          </p>
        </header>

        <section aria-label="DocuMind features" className="grid gap-2.5 sm:grid-cols-3 md:gap-3">
          {features.map(({ icon: Icon, title }) => (
            <div
              key={title}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 sm:px-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                <Icon aria-hidden="true" className="text-lg" />
              </span>
              <p className="text-sm font-medium leading-5 text-gray-100">{title}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="intro-how-to" className="mt-5 sm:mt-6">
          <h2 id="intro-how-to" className="mb-3 text-center text-sm font-semibold text-gray-200">
            How to use
          </h2>
          <ol className="grid gap-2.5 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#0b1220]/65 px-3 py-3 sm:px-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 to-blue-600 text-xs font-bold text-[#04101e]">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm leading-5 text-gray-300">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-5 flex flex-col items-center gap-4 sm:mt-6">
          <button
            type="button"
            onClick={onGetStarted}
            className="group inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]"
          >
            Get Started
            <FiArrowUpRight aria-hidden="true" className="text-base transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>

        </div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-5 text-gray-500">
          Your key is stored encrypted and never shared. Guests get 5 free requests;
          signing in removes the limit.
        </p>
      </motion.div>
    </main>
  );
}

export default IntroScreen;