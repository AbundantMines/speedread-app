// WarpRead Extension — Content Script (Readability-lite extraction)

function extractArticleText() {
  // Remove noise elements
  const clone = document.cloneNode(true);
  clone.querySelectorAll('script,style,nav,footer,header,aside,iframe,.ad,.sidebar,.menu,.nav,.comment,.comments').forEach(el => el.remove());

  // Try <article> first
  let main = clone.querySelector('article');
  if (!main) {
    // Heuristic: find the element with the most <p> children
    const candidates = clone.querySelectorAll('div, section, main');
    let best = null, bestScore = 0;
    candidates.forEach(el => {
      const ps = el.querySelectorAll('p');
      const textLen = el.textContent.length;
      const score = ps.length * 100 + textLen;
      if (score > bestScore) { bestScore = score; best = el; }
    });
    main = best || clone.body;
  }

  // Extract text from paragraphs
  const paragraphs = main.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
  let text = '';
  paragraphs.forEach(p => {
    const t = p.textContent.trim();
    if (t.length > 20) text += t + ' ';
  });

  return text.replace(/\s+/g, ' ').trim();
}

// Listen for extraction request from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT_ARTICLE') {
    const text = extractArticleText();
    const title = document.title;
    sendResponse({ text, title });
  }
});
