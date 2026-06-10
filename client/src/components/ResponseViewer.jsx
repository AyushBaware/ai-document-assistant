import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";

const getSectionStyle = (title = "") => {
  const lower = title.toLowerCase();

  if (lower.includes("overview")) {
    return `border-cyan-500/10 bg-cyan-500/[0.03]`;
  }

  if (lower.includes("important")) {
    return `border-purple-500/10 bg-purple-500/[0.03]`;
  }

  if (lower.includes("revision")) {
    return `border-green-500/10 bg-green-500/[0.03]`;
  }

  return `border-white/5 bg-white/[0.02]`;
};

const ResponseViewer = ({ content }) => {
  // Animation variants for sections
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      className="max-w-none text-gray-200 prose prose-invert max-w-none"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => {
            const title = children?.toString();

            return (
              <motion.div
                variants={itemVariants}
                className={`mt-8 mb-5 rounded-2xl border px-4 sm:px-6 lg:px-7 py-4 sm:py-5 lg:py-6 backdrop-blur-lg ${getSectionStyle(
                  title
                )}`}
              >
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight m-0">
                  {children}
                </h1>
              </motion.div>
            );
          },

          h2: ({ children }) => (
            <motion.h2
              variants={itemVariants}
              className="text-xl sm:text-2xl lg:text-3xl font-bold text-cyan-200 mt-8 mb-4 tracking-tight"
            >
              {children}
            </motion.h2>
          ),

          h3: ({ children }) => (
            <motion.h3
              variants={itemVariants}
              className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mt-6 mb-3"
            >
              {children}
            </motion.h3>
          ),

          p: ({ children }) => (
            <motion.p
              variants={itemVariants}
              className="leading-8 sm:leading-8 lg:leading-9 text-gray-300 mb-5 text-base sm:text-lg lg:text-[17px] font-normal"
            >
              {children}
            </motion.p>
          ),

          ul: ({ children }) => (
            <motion.ul
              variants={itemVariants}
              className="space-y-3 sm:space-y-4 ml-5 sm:ml-6 lg:ml-7 mb-6 list-disc marker:text-cyan-400"
            >
              {children}
            </motion.ul>
          ),

          li: ({ children }) => (
            <motion.li
              variants={itemVariants}
              className="leading-8 sm:leading-8 lg:leading-9 text-gray-300 text-base sm:text-lg lg:text-[17px] pl-2 sm:pl-3 font-normal"
            >
              {children}
            </motion.li>
          ),

          strong: ({ children }) => (
            <strong className="text-white font-bold bg-gradient-to-r from-cyan-400/20 to-blue-400/20 px-1 py-0.5 rounded">
              {children}
            </strong>
          ),

          blockquote: ({ children }) => (
            <motion.blockquote
              variants={itemVariants}
              className="border-l-4 border-cyan-400/50 pl-4 sm:pl-5 lg:pl-6 italic text-gray-300 my-6 bg-cyan-500/[0.08] py-4 px-4 rounded-r-lg text-base sm:text-lg lg:text-[17px]"
            >
              {children}
            </motion.blockquote>
          ),

          hr: () => (
            <motion.div
              variants={itemVariants}
              className="my-8 h-px bg-gradient-to-r from-white/0 via-white/20 to-white/0 rounded-full"
            />
          ),

          code: ({ inline, children }) => {
            if (inline) {
              return (
                <code className="bg-white/10 text-cyan-300 px-2 py-1 rounded text-sm sm:text-base font-mono font-semibold">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-white/5 text-gray-200 px-4 py-3 rounded-lg overflow-x-auto my-4 text-sm sm:text-base font-mono">
                {children}
              </code>
            );
          },

          a: ({ href, children }) => (
            <a
              href={href}
              className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </motion.div>
  );
};

export default ResponseViewer;