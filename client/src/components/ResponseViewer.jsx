import { useMemo, Children } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import GlossaryTerm from "./GlossaryTerm";

// ── GLOSSARY HELPERS ──────────────────────────────────────────
// One combined regex for every glossary term (longest first, so
// multi-word terms match before their shorter substrings), plus
// a lowercase lookup map for instant definition lookup.
const buildGlossaryLookup = (glossary = []) => {
  const valid = (glossary || []).filter(
    (g) => g && typeof g.term === "string" && typeof g.definition === "string"
  );
  if (valid.length === 0) return { glossaryMap: new Map(), glossaryRegex: null };

  const glossaryMap = new Map();
  valid.forEach((g) => glossaryMap.set(g.term.trim().toLowerCase(), g.definition));

  const escaped = valid
    .map((g) => g.term.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const glossaryRegex =
    escaped.length > 0 ? new RegExp(`\\b(${escaped.join("|")})s?\\b`, "gi") : null;

  return { glossaryMap, glossaryRegex };
};

// Splits one text string on glossary matches, wrapping each match
// in a GlossaryTerm. Non-string children (already-rendered
// elements, e.g. <strong>) pass through untouched.
const renderTextPiece = (text, glossaryMap, glossaryRegex, keyPrefix) => {
  if (!glossaryRegex || typeof text !== "string") return text;
  const parts = text.split(glossaryRegex);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (!part) return null;
    const definition = glossaryMap.get(part.trim().toLowerCase());
    if (definition) {
      return (
        <GlossaryTerm key={`${keyPrefix}-${i}`} term={part} definition={definition}>
          {part}
        </GlossaryTerm>
      );
    }
    return part;
  });
};

const renderWithGlossary = (children, glossaryMap, glossaryRegex) => {
  if (!glossaryRegex) return children;
  return Children.map(children, (child, i) =>
    typeof child === "string"
      ? renderTextPiece(child, glossaryMap, glossaryRegex, `gl-${i}`)
      : child
  );
};

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

const ResponseViewer = ({ content, glossary = [] }) => {
  // Built once per response, not on every render.
  const { glossaryMap, glossaryRegex } = useMemo(
    () => buildGlossaryLookup(glossary),
    [glossary]
  );

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
      className="text-gray-200 prose prose-sm sm:prose lg:prose-lg prose-invert max-w-none"
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
                className={`mt-6 mb-4 rounded-xl sm:rounded-2xl border px-3 sm:px-6 lg:px-7 py-3 sm:py-5 lg:py-6 backdrop-blur-lg ${getSectionStyle(
                  title
                )}`}
              >
                <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight m-0">
                  {children}
                </h1>
              </motion.div>
            );
          },

          h2: ({ children }) => (
            <motion.h2
              variants={itemVariants}
              className="text-lg sm:text-2xl lg:text-3xl font-bold text-cyan-200 mt-6 sm:mt-8 mb-3 sm:mb-4 tracking-tight"
            >
              {renderWithGlossary(children, glossaryMap, glossaryRegex)}
            </motion.h2>
          ),

          h3: ({ children }) => (
            <motion.h3
              variants={itemVariants}
              className="text-base sm:text-xl lg:text-2xl font-semibold text-white mt-5 sm:mt-6 mb-2 sm:mb-3"
            >
              {renderWithGlossary(children, glossaryMap, glossaryRegex)}
            </motion.h3>
          ),

          p: ({ children }) => (
            <motion.p
              variants={itemVariants}
              className="leading-7 sm:leading-8 lg:leading-9 text-gray-300 mb-4 sm:mb-5 text-[15px] sm:text-lg lg:text-[17px] font-normal"
            >
              {renderWithGlossary(children, glossaryMap, glossaryRegex)}
            </motion.p>
          ),

          ul: ({ children }) => (
            <motion.ul
              variants={itemVariants}
              className="space-y-2 sm:space-y-4 ml-4 sm:ml-6 lg:ml-7 mb-5 sm:mb-6 list-disc marker:text-cyan-400"
            >
              {children}
            </motion.ul>
          ),

          li: ({ children }) => (
            <motion.li
              variants={itemVariants}
              className="leading-7 sm:leading-8 lg:leading-9 text-gray-300 text-[15px] sm:text-lg lg:text-[17px] pl-1 sm:pl-3 font-normal"
            >
              {renderWithGlossary(children, glossaryMap, glossaryRegex)}
            </motion.li>
          ),

          strong: ({ children }) => (
            <strong className="text-white font-bold bg-linear-to-r from-cyan-400/20 to-blue-400/20 px-1 py-0.5 rounded">
              {children}
            </strong>
          ),

          blockquote: ({ children }) => (
            <motion.blockquote
              variants={itemVariants}
              className="border-l-4 border-cyan-400/50 pl-3 sm:pl-5 lg:pl-6 italic text-gray-300 my-4 sm:my-6 bg-cyan-500/8 py-3 sm:py-4 px-3 sm:px-4 rounded-r-lg text-[15px] sm:text-lg lg:text-[17px]"
            >
              {children}
            </motion.blockquote>
          ),

          hr: () => (
            <motion.div
              variants={itemVariants}
              className="my-8 h-px bg-linear-to-r from-white/0 via-white/20 to-white/0 rounded-full"
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