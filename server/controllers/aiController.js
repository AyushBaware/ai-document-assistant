const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const createRequestBody = (prompt) => ({
  contents: [
    {
      role: "user",
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.8,
    maxOutputTokens: 2048,
  },
});

export const generateAIResponse = async (req, res) => {
  try {
    const { extractedText, type } = req.body;

    if (!extractedText) {
      return res.status(400).json({
        success: false,
        message: "No extracted text",
      });
    }

    let prompt = "";

    switch (type) {
      case "summary":
        prompt = `
Generate a detailed professional summary of the following document.

Requirements:
- Cover all important topics
- Use sections and headings
- Keep it concise but informative
- Explain the main ideas clearly

Document:

${extractedText}
`;
        break;
      case "notes":
        prompt = `
You are an expert study assistant.

Create detailed, well-structured study notes from the following document.

Rules:
- Use proper headings
- Use bullet points
- Explain concepts clearly
- Include important definitions
- Include examples if possible
- Cover ALL major topics from the document
- Make notes detailed and beginner-friendly
- Format output beautifully

Document:

${extractedText}
`;
      case "explain":
        prompt = `
Explain the following document in very simple beginner-friendly language.

Requirements:
- Explain step-by-step
- Use simple examples
- Avoid technical jargon where possible
- Make it easy for a student to understand

Document:

${extractedText}
`;
        break;
      default:
        prompt = `Summarize this document:\n\n${extractedText}`;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Gemini API key is not configured.",
      });
    }

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(createRequestBody(prompt)),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data.error?.message || "Gemini generation request failed.";
      return res
        .status(response.status)
        .json({ success: false, message, details: data.error });
    }

    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    return res.status(200).json({ success: true, result: text });
  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
