import { useState } from "react";
import { generateAI, generateAIFromSession } from "../api/aiApi";
import { updateSessionResponse } from "../api/sessionApi";

export function useAIGeneration({
  geminiKey,
  user,
  token,
  selectedIds,
  selectedFileNames,
  cachedResults,
  setCachedResults,
  setAiResult,
  setGlossary,
  setActiveMode,
  setError,
  setSourceFileNames,
  currentSessionId,
  currentBatchId,
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
      setSourceFileNames(cachedResults[cacheKey].sourceFileNames || []);
      setActiveMode(type);
      return;
    }

    try {
      setError("");
      setAiLoading(true);
      setAnalysisStage("Analyzing documents...");
      setActiveMode(type);
      // Intentionally NOT clearing aiResult/glossary here — if a previous
      // result (different selection or mode) is already on screen, it stays
      // visible, dimmed, while this generates. Only replaced once the new
      // result actually arrives, so the panel never goes blank mid-toggle.

      let data;

      // Route by whether a saved session exists — not isPreloadedSession.
      // A fresh upload by a logged-in user already has a real session
      // (created in useFileUpload.js right after upload) just as much as
      // a reopened one. Matches the condition ChatPanel.jsx already uses.
      if (currentSessionId && token) {
        data = await generateAIFromSession(
          currentSessionId,
          type,
          geminiKey,
          token,
          selectedFileNames,
        );
      } else {
        data = await generateAI(currentBatchId, type, selectedIds);
      }

      const glossaryData = data.glossary || [];
      setCachedResults((prev) => ({
        ...prev,
        [cacheKey]: { result: data.result, glossary: glossaryData, sourceFileNames: selectedFileNames },
      }));
      setAiResult(data.result);
      setGlossary(glossaryData);
      setSourceFileNames(selectedFileNames);

      if (user && token && currentSessionId) {
        try {
          await updateSessionResponse(
            currentSessionId,
            type,
            data.result,
            data.tokenBudget,
            token,
            glossaryData,
            selectedFileNames,
          );
        } catch (saveErr) {
          console.warn("Response save failed (non-blocking):", saveErr.message);
        }
      }    } catch (err) {
      // GUEST_LIMIT_REACHED already shows a clear full-screen modal
      // (see App.jsx) — no need to also show a redundant inline error.
      if (err.response?.data?.code !== "GUEST_LIMIT_REACHED") {
        setError(
          err.response?.data?.message ||
            "AI generation failed. Please try again.",
        );
      }
      // A genuine failure is the only case that clears the panel —
      // toggling selection or regenerating never lands here.
      setAiResult("");
      setGlossary([]);
      setSourceFileNames([]);
      setActiveMode(null);
    } finally {
      setAiLoading(false);
      setAnalysisStage("");
    }
  };

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