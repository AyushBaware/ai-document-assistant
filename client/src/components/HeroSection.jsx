// HeroSection.jsx
import { motion } from "framer-motion";
import { FiFileText } from "react-icons/fi";

function HeroSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative inline-flex p-[1.5px] rounded-full mb-6 overflow-hidden"
      >
        {/* Permanent faint ring — keeps the pill's edge visible
            even in the moment the animated sweep is on the far side */}
        <span className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />

        {/* Slow single-arc sweep — reads as a subtle "live" highlight,
            not a loading spinner */}
        <span
          className="absolute inset-[-150%] animate-[spin_5s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, transparent 78%, rgba(103,232,249,0.9) 88%, rgba(59,130,246,0.6) 94%, transparent 100%)",
          }}
        />

        <span className="relative inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#030712]">
          <FiFileText className="text-cyan-400 text-base shrink-0" />
          <span className="text-sm sm:text-base font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
            DocuMind AI
          </span>
        </span>
      </motion.div>

      <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight tracking-tight">
        Turn Documents Into
        <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          {" "}Smart Insights
        </span>
      </h1>

      <p className="mt-5 text-gray-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
        Upload a PDF, DOCX, or PPT — get instant summaries, notes, and
        AI-powered answers.
      </p>
    </motion.div>
  );
}

export default HeroSection;