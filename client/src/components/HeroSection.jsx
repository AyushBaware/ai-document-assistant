import { motion } from "framer-motion";

function HeroSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="text-center"
    >
      <h1 className="text-4xl md:text-6xl font-bold leading-tight">
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