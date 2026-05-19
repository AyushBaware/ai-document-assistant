export const chunkText = (
  text,
  maxLength = 12000
) => {

  if (
    text.length <= maxLength
  ) {
    return text;
  }

  return (
    text.slice(0, maxLength)
  );
};