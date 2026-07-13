import { useState } from "react";
import { generateAI, generateAIFromSession } from "../api/aiApi";
import { updateSessionResponse } from "../api/sessionApi";

// ============================================================
// useAIGeneration.js
//
// Owns calling Gemini for Summary/Notes/Explain: cache lookup
// (avoids re-calling Gemini for a mode already generated for
// the current document selection), the fresh-upload vs.
// past-session branching (same pattern as chatApi.js), and
// saving the result back to the session in MongoDB.
// ============================================================
export function useAIGeneration({
  geminiKey,
  user,
  token,
  selectedIds,
  cachedResults,
  setCachedResults,
  setAiResult,
  setGlossary,
  setActiveMode,
  setError,
  currentSessionId,
  isPreloadedSession,
  setMenuOpen,
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");

  const generateContent = async (type) => {
    if (selectedIds.length === 0) {
      setError("Please select at least one document to analyze.");
      return;
    }

    const cacheKey = `${type}_${[...selectedIds].sort().join(",")}`;
    if (cachedResults[cacheKey]) {
      setAiResult(cachedResults[cacheKey].result);
      setGlossary(cachedResults[cacheKey].glossary || []);
      setActiveMode(type);
      return;
    }

    try {
      setError("");
      setAiLoading(true);
      setAnalysisStage("Analyzing documents...");
      setActiveMode(type);
      setAiResult("");

      let data;

      if (isPreloadedSession && currentSessionId && token) {
        data = await generateAIFromSession(
          currentSessionId,
          type,
          geminiKey,
          token,
        );
      } else {
        data = await generateAI(null, type, selectedIds, geminiKey);
      }

      const glossaryData = data.glossary || [];
      setCachedResults((prev) => ({
        ...prev,
        [cacheKey]: { result: data.result, glossary: glossaryData },
      }));
      setAiResult(data.result);
      setGlossary(glossaryData);

      // Save the response back to the session in MongoDB
      if (user && token && currentSessionId) {
        try {
          await updateSessionResponse(
            currentSessionId,
            type,
            data.result,
            data.tokenBudget,
            token,
            glossaryData,
          );
        } catch (saveErr) {
          console.warn("Response save failed (non-blocking):", saveErr.message);
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "AI generation failed. Please try again.",
      );
      setAiResult("");
      setGlossary([]);
      setActiveMode(null);
    } finally {
      setAiLoading(false);
      setAnalysisStage("");
    }
  };

  // Switches the full-screen view between Chat and a mode (Summary/
  // Notes/Explain). Reuses generateContent's own caching, so re-picking
  // an already-generated mode just re-shows the cached result instead
  // of calling Gemini again.
  const handleNavSelect = (type) => {
    setMenuOpen(false);
    if (type === null) {
      setActiveMode(null);
      return;
    }
    generateContent(type);
  };

  return { aiLoading, analysisStage, generateContent, handleNavSelect };
}