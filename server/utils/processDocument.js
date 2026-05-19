export const processDocument =
(text) => {

  if (!text) return "";

  // Normalize line endings
  let processed =
    text.replace(/\r\n/g, "\n");

  // Remove excessive spaces
  processed =
    processed.replace(
      /[ \t]+/g,
      " "
    );

  // Remove excessive empty lines
  processed =
    processed.replace(
      /\n{3,}/g,
      "\n\n"
    );

  // Split into lines
  const lines =
    processed
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

  // Detect repeated lines
  const lineFrequency = {};

  lines.forEach(line => {

    const normalized =
      line.toLowerCase();

    lineFrequency[normalized] =
      (lineFrequency[normalized] || 0)
      + 1;
  });

  // Remove likely repeated headers/footers
  const cleanedLines =
    lines.filter(line => {

      const normalized =
        line.toLowerCase();

      // remove tiny repeated lines
      if (
        line.length < 50 &&
        lineFrequency[normalized] > 3
      ) {
        return false;
      }

      return true;
    });

  // Rebuild document
  processed =
    cleanedLines.join("\n");

  // Detect heading patterns
  processed =
    processed.replace(

      /^(\d+\.?\s+[A-Z][^\n]{2,60})$/gm,

      "\n# $1\n"
    );

  // Detect ALL CAPS headings
  processed =
    processed.replace(

      /^([A-Z][A-Z\s]{4,})$/gm,

      "\n# $1\n"
    );

  // Detect subheadings
  processed =
    processed.replace(

      /^([A-Z][A-Za-z\s]{3,40}:)$/gm,

      "\n## $1\n"
    );

  // Final cleanup
  processed =
    processed.replace(
      /\n{3,}/g,
      "\n\n"
    );

  return processed.trim();
};