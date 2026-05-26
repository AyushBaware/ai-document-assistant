import { useState } from "react";

import ResponseViewer from "./ResponseViewer";

import { motion } from "framer-motion";

import { FiUploadCloud } from "react-icons/fi";

import { uploadFile } from "../api/uploadApi";

import { generateAI } from "../api/aiApi";

function UploadBox() {
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState("");

  const [error, setError] = useState("");

  const [previewText, setPreviewText] = useState("");

  const [aiLoading, setAiLoading] = useState(false);

  const [aiResult, setAiResult] = useState("");

  const [copied, setCopied] = useState(false);

  const handleFileUpload = async (file) => {
    if (!file) return;

    setSelectedFile(file);

    setLoading(true);

    setSuccess("");

    setError("");

    setPreviewText("");

    setAiResult("");

    try {
      const data = await uploadFile(file);

      setSuccess(data.message);

      setPreviewText(data.extractedText);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const generateContent = async (type) => {
    try {
      setError("");

      setAiLoading(true);

      setAiResult("");

      const data = await generateAI(previewText, type);

      setAiResult(data.result);
    } catch (error) {
      setError(error.response?.data?.message || "AI generation failed");

      setAiResult("");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.95,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      transition={{
        duration: 0.5,
      }}
      className="
        mt-12
        border border-white/10
        bg-white/5
        backdrop-blur-2xl
        rounded-3xl
        p-3 sm:p-6  md:p-12
        shadow-[0_0_60px_rgba(0,255,255,0.06)]
      "
    >
      <div
        className="
        flex flex-col
        items-center
        text-center
      "
      >
        <motion.div
          animate={{
            y: [0, -5, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 3,
          }}
          className="
          w-20 h-20
          rounded-full
          bg-cyan-500/10
          flex items-center
          justify-center
          border border-cyan-400/20
          shadow-[0_0_40px_rgba(34,211,238,0.15)]
        "
        >
          <FiUploadCloud
            className="
              text-4xl
              text-cyan-400
            "
          />
        </motion.div>

        <h2
          className="
          mt-6
          text-2xl sm:text-3xl
          font-bold
        "
        >
          Upload Your Document
        </h2>

        <p
          className="
          mt-3
          text-gray-400
          max-w-xl
          text-sm sm:text-base
          leading-7
        "
        >
          Upload PDFs, DOCX, PPTX or TXT and generate structured AI-powered summaries, notes, and
          explanations instantly.
        </p>

        <label
          className="
            mt-8
            cursor-pointer
            px-6 py-3
            rounded-2xl
            bg-gradient-to-r
            from-cyan-500
            to-blue-600
            hover:scale-105
            hover:opacity-90
            transition-all
            duration-300
            font-medium
            shadow-[0_0_30px_rgba(34,211,238,0.25)]
          "
        >
          {loading ? "Processing..." : "Choose Document"}

          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
            onChange={(e) => handleFileUpload(e.target.files[0])}
          />
        </label>

        {selectedFile && (
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="
              mt-6
              w-full
              max-w-md
              bg-white/5
              border border-white/10
              rounded-2xl
              p-4
            "
          >
            <p
              className="
                font-medium
                truncate
              "
            >
              {selectedFile.name}
            </p>

            <p
              className="
                text-sm
                text-gray-400
                mt-1
              "
            >
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </motion.div>
        )}

        {success && (
          <p
            className="
              mt-4
              text-green-400
            "
          >
            {success}
          </p>
        )}

        {error && (
          <p
            className="
              mt-4
              text-red-400
            "
          >
            {error}
          </p>
        )}
      </div>

      {previewText && (
        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          className="
            mt-10
          "
        >
          <div
            className="
    flex
    flex-wrap

    justify-center

    gap-3

    mt-6
  "
          >
            <motion.button
              whileHover={{
                scale: 1.03,
              }}
              whileTap={{
                scale: 0.97,
              }}
              onClick={() => generateContent("summary")}
              className="
      px-4 sm:px-5
      py-2.5

      rounded-xl

      text-sm
      font-medium

      text-white

      bg-cyan-500/15
      border border-cyan-400/15

      hover:bg-cyan-500/25
      hover:border-cyan-300/30

      transition-all
      duration-300

      shadow-[0_0_15px_rgba(34,211,238,0.08)]
      hover:shadow-[0_0_25px_rgba(34,211,238,0.18)]
    "
            >
              Summary
            </motion.button>

            <motion.button
              whileHover={{
                scale: 1.03,
              }}
              whileTap={{
                scale: 0.97,
              }}
              onClick={() => generateContent("notes")}
              className="
      px-4 sm:px-5
      py-2.5

      rounded-xl

      text-sm
      font-medium

      text-white

      bg-purple-500/15
      border border-purple-400/15

      hover:bg-purple-500/25
      hover:border-purple-300/30

      transition-all
      duration-300

      shadow-[0_0_15px_rgba(168,85,247,0.08)]
      hover:shadow-[0_0_25px_rgba(168,85,247,0.18)]
    "
            >
              Notes
            </motion.button>

            <motion.button
              whileHover={{
                scale: 1.03,
              }}
              whileTap={{
                scale: 0.97,
              }}
              onClick={() => generateContent("explain")}
              className="
      px-4 sm:px-5
      py-2.5

      rounded-xl

      text-sm
      font-medium

      text-white

      bg-blue-500/15
      border border-blue-400/15

      hover:bg-blue-500/25
      hover:border-blue-300/30

      transition-all
      duration-300

      shadow-[0_0_15px_rgba(59,130,246,0.08)]
      hover:shadow-[0_0_25px_rgba(59,130,246,0.18)]
    "
            >
              Explain
            </motion.button>
          </div>

          {aiLoading && (
            <motion.div
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              className="
                mt-12
                flex flex-col
                items-center
                gap-6
              "
            >
              <motion.div
                animate={{
                  rotate: 360,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "linear",
                }}
                className="
                  w-14 h-14
                  border-4
                  border-cyan-500/20
                  border-t-cyan-400
                  rounded-full
                "
              />

              <div
                className="
                  text-center
                "
              >
                <h3
                  className="
                    text-lg sm:text-xl
                    font-semibold
                    text-cyan-300
                  "
                >
                  AI is Understanding Your Document
                </h3>

                <p
                  className="
                    text-gray-400
                    mt-2
                    text-sm sm:text-base
                  "
                >
                  Generating structured learning experience...
                </p>
              </div>
            </motion.div>
          )}

          {aiResult && (
            <motion.div
              initial={{
                opacity: 0,
                y: 40,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.5,
              }}
              className="
                mt-12
                relative
              "
            >
              <div
                className="
                  absolute
                  inset-0
                  bg-gradient-to-r
                  from-cyan-500/10
                  via-blue-500/10
                  to-purple-500/10
                  blur-3xl
                "
              />

              <div
                className="
    relative

    border border-white/5

    bg-gradient-to-b
    from-white/[0.03]
    to-white/[0.01]

    backdrop-blur-2xl

    rounded-xl sm:rounded-2xl

    overflow-hidden

    shadow-[0_0_25px_rgba(0,255,255,0.03)]
  "
              >
                {/* HEADER */}

                <div
                  className="
      px-3 sm:px-5
      py-3

      border-b border-white/[0.04]

      flex
      items-center
      justify-between

      gap-3
    "
                >
                  <div
                    className="
        min-w-0
      "
                  >
                    <h3
                      className="
          text-sm sm:text-lg

          font-semibold

          tracking-tight

          text-white

          leading-tight
        "
                    >
                      AI Learning Response
                    </h3>

                    <p
                      className="
          text-[11px] sm:text-xs

          text-gray-500

          mt-0.5
        "
                    >
                      Fast structured understanding
                    </p>
                  </div>

                  {/* COPY BUTTON */}

                  <button

  onClick={() => {

    navigator.clipboard.writeText(
      aiResult
    );

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }}

  className="
    w-8 h-8

    flex
    items-center
    justify-center

    rounded-lg

    bg-white/[0.04]

    border border-white/[0.05]

    hover:bg-white/[0.08]

    transition-all
    duration-300

    shrink-0

    active:scale-95
  "
>

  {copied ? (

    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="
        w-4 h-4
        text-green-400
      "
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>

  ) : (

    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className="
        w-4 h-4
        text-gray-300
      "
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 013.75 20.625V7.875c0-.621.504-1.125 1.125-1.125H8.25m7.5-3.375h3.375c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125H9.375A1.125 1.125 0 018.25 17.25V4.5c0-.621.504-1.125 1.125-1.125h6.375z"
      />
    </svg>

  )}

</button>
                </div>

                {/* RESPONSE CONTENT */}

                <div
                  className="
      px-3 sm:px-5
      py-4 sm:py-5

      max-h-[82vh]

      overflow-y-auto

      scrollbar-thin
      scrollbar-thumb-white/10
      scrollbar-track-transparent
    "
                >
                  <ResponseViewer content={aiResult} />
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default UploadBox;
