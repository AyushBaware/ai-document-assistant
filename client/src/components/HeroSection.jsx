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
        className="relative inline-flex items-center gap-2.5 mb-6 px-4 py-2 rounded-full bg-white/[0.06] border border-cyan-400/20 backdrop-blur-xl shadow-[0_0_25px_rgba(34,211,238,0.12)]"
      >
        {/* Soft pulsing glow behind the badge — subtle, not distracting */}
        <motion.span
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-cyan-400/10 blur-md -z-10"
        />

        <FiFileText className="text-cyan-400 text-base shrink-0" />
        <span className="text-sm sm:text-base font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
          DocuMind AI
        </span>
      </motion.div>

      <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight">
        Transform Documents Into
        <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          {" "}Smart Insights
        </span>
      </h1>

      <p className="mt-6 text-gray-300 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed">
        Upload PDFs, DOCX, PPTs and instantly generate summaries,
        notes, explanations, and AI-powered answers.
      </p>
    </motion.div>
  );
}

export default HeroSection;