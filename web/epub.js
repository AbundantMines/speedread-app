// Warpreader — ePub Support
// Uses JSZip (loaded from CDN) to unzip ePub files
// ePub files are ZIP archives containing HTML/XHTML content files

// Load JSZip dynamically
async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => resolve(window.JSZip);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function extractEpubText(file) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  
  // 1. Parse container.xml to find OPF file path
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Invalid ePub: no container.xml');
  
  const opfPathMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
  if (!opfPathMatch) throw new Error('Invalid ePub: no OPF path');
  const opfPath = opfPathMatch[1];
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
  
  // 2. Parse OPF to get reading order (spine)
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) throw new Error('Invalid ePub: no OPF file');
  
  // Get manifest items
  const manifestItems = {};
  const manifestRegex = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]*\/>/gi;
  let m;
  while ((m = manifestRegex.exec(opfXml)) !== null) {
    manifestItems[m[1]] = m[2];
  }
  
  // Get spine order
  const spineRegex = /<itemref[^>]+idref="([^"]+)"/gi;
  const spineOrder = [];
  while ((m = spineRegex.exec(opfXml)) !== null) {
    if (manifestItems[m[1]]) spineOrder.push(manifestItems[m[1]]);
  }
  
  if (!spineOrder.length) throw new Error('Invalid ePub: empty spine');
  
  // 3. Extract and concatenate text from each spine item
  let fullText = '';
  let bookTitle = '';
  
  // Get title from OPF metadata
  const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  if (titleMatch) bookTitle = titleMatch[1].trim();
  
  for (const href of spineOrder) {
    const fullPath = opfDir + href;
    // Try with and without the opf directory prefix
    const fileContent = await (zip.file(fullPath)?.async('string') || 
                               zip.file(href)?.async('string') || 
                               Promise.resolve(''));
    
    if (!fileContent) continue;
    
    // Strip HTML/XHTML tags and extract text
    const text = fileContent
      // Remove head section entirely  
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      // Convert block elements to newlines
      .replace(/<\/?(p|div|h[1-6]|br|li|tr|section|article|chapter)[^>]*>/gi, '\n')
      // Remove all remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // Clean up whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    if (text.length > 50) {
      fullText += text + '\n\n';
    }
  }
  
  return { text: fullText.trim(), title: bookTitle };
}
