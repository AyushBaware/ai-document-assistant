import { useState } from "react";

import { motion }
from "framer-motion";

import {
  FiUploadCloud,
} from "react-icons/fi";

import {
  uploadFile,
} from "../api/uploadApi";

import {
  generateAI,
} from "../api/aiApi";

function UploadBox() {

  const [selectedFile,
    setSelectedFile] =
    useState(null);

  const [loading,
    setLoading] =
    useState(false);

  const [success,
    setSuccess] =
    useState("");

  const [error,
    setError] =
    useState("");

  const [previewText,
    setPreviewText] =
    useState("");

  const [aiLoading,
    setAiLoading] =
    useState(false);

  const [aiResult,
    setAiResult] =
    useState("");

  const handleFileUpload =
    async (file) => {

      if (!file) return;

      setSelectedFile(file);

      setLoading(true);

      setSuccess("");

      setError("");

      setPreviewText("");

      setAiResult("");

      try {

        const data =
          await uploadFile(file);

        setSuccess(data.message);

        setPreviewText(
          data.extractedText
        );

      } catch (err) {

        setError(
          err.response?.data?.message
          || "Upload failed"
        );

      } finally {

        setLoading(false);
      }
  };

  const generateContent =
    async (type) => {

      try {

        setError("");
        setAiLoading(true);
        setAiResult("");

        const data =
          await generateAI(
            previewText,
            type
          );

        setAiResult(data.result);

      } catch (error) {

        setError(
          error.response?.data?.message
          || "AI generation failed"
        );

        setAiResult("");

      } finally {

        setAiLoading(false);
      }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.9,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      transition={{
        delay: 0.3,
      }}
      className="
        mt-14
        border border-white/10
        bg-white/5
        backdrop-blur-xl
        rounded-3xl
        p-8 md:p-12
        shadow-2xl
      "
    >

      <div className="
        flex flex-col
        items-center
        text-center
      ">

        <div className="
          w-20 h-20
          rounded-full
          bg-cyan-500/10
          flex items-center
          justify-center
          border border-cyan-400/20
        ">
          <FiUploadCloud
            className="
              text-4xl
              text-cyan-400
            "
          />
        </div>

        <h2 className="
          mt-6
          text-2xl
          font-semibold
        ">
          Upload Your Document
        </h2>

        <p className="
          mt-3
          text-gray-400
          max-w-md
        ">
          Upload PDFs and generate
          AI-powered insights instantly.
        </p>

        <label
          className="
            mt-8
            cursor-pointer
            px-6 py-3
            rounded-xl
            bg-gradient-to-r
            from-cyan-500
            to-blue-600
            hover:opacity-90
            transition
            font-medium
          "
        >

          {
            loading
              ? "Processing..."
              : "Choose PDF"
          }

          <input
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={(e) =>
              handleFileUpload(
                e.target.files[0]
              )
            }
          />
        </label>

        {
          selectedFile && (
            <motion.div
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
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
              <p className="
                font-medium truncate
              ">
                {selectedFile.name}
              </p>

              <p className="
                text-sm text-gray-400 mt-1
              ">
                {
                  (
                    selectedFile.size /
                    1024 /
                    1024
                  ).toFixed(2)
                } MB
              </p>
            </motion.div>
          )
        }

        {
          success && (
            <p className="
              mt-4
              text-green-400
            ">
              {success}
            </p>
          )
        }

        {
          error && (
            <p className="
              mt-4
              text-red-400
            ">
              {error}
            </p>
          )
        }

      </div>

      {
        previewText && (

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

            <div className="
              flex flex-wrap
              gap-4
              justify-center
            ">

              <button
                onClick={() =>
                  generateContent(
                    "summary"
                  )
                }
                className="
                  px-5 py-3
                  rounded-xl
                  bg-cyan-500/20
                  border border-cyan-400/20
                  hover:bg-cyan-500/30
                  transition
                "
              >
                Generate Summary
              </button>

              <button
                onClick={() =>
                  generateContent(
                    "notes"
                  )
                }
                className="
                  px-5 py-3
                  rounded-xl
                  bg-purple-500/20
                  border border-purple-400/20
                  hover:bg-purple-500/30
                  transition
                "
              >
                Generate Notes
              </button>

              <button
                onClick={() =>
                  generateContent(
                    "explain"
                  )
                }
                className="
                  px-5 py-3
                  rounded-xl
                  bg-blue-500/20
                  border border-blue-400/20
                  hover:bg-blue-500/30
                  transition
                "
              >
                Explain Simply
              </button>

            </div>

            {
              aiLoading && (
                <p className="
                  mt-8
                  text-center
                  text-cyan-400
                ">
                  Gemini is thinking...
                </p>
              )
            }

            {
              aiResult && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="
                    mt-8
                    border border-white/10
                    bg-white/5
                    backdrop-blur-xl
                    rounded-3xl
                    p-6
                    whitespace-pre-wrap
                    leading-relaxed
                    text-gray-200
                  "
                >

                  {aiResult}

                </motion.div>
              )
            }

          </motion.div>
        )
      }

    </motion.div>
  );
}

export default UploadBox;