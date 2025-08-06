export const judgeKeywords = (keywords, text) => {
  for (const keyword of keywords) {
    if (text.includes(keyword)) return true;
  }
  return false;
};
