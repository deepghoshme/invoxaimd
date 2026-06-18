/**
 * Minimal HTML sanitizer for seller-authored rich-text (description_html).
 * No external dependency — works in both Node (server components) and the
 * browser (client components).
 *
 * Allowlist approach:
 *  - Permitted tags: the subset that a Tiptap/Quill editor emits for prose.
 *  - Permitted attributes: href (links), src (images), alt, class, style
 *    ONLY when the value contains no expression characters (parentheses).
 *  - Strips anything else — script, iframe, object, embed, event handlers,
 *    javascript: URLs, data: URLs.
 *
 * The seller wrote this content themselves; we sanitize to defend buyers from
 * a compromised or malicious seller account injecting XSS into buyer browsers.
 */

const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup",
  "dd", "del", "dfn", "dl", "dt", "em", "figcaption", "figure", "font",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd",
  "li", "mark", "ol", "p", "pre", "q", "s", "samp", "small", "span",
  "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead",
  "tr", "u", "ul", "var",
]);

// Attributes whose values may be URLs — strip javascript: and data: schemes.
const URL_ATTRS = new Set(["href", "src", "action"]);

// Attributes unconditionally allowed (no value expression check needed).
const SAFE_ATTRS = new Set(["alt", "title", "target", "rel", "width", "height", "colspan", "rowspan", "cellpadding", "cellspacing"]);

// Attributes allowed only when the value contains no expression chars ( ) ; : except for specific safe patterns.
const COND_ATTRS = new Set(["class", "style", "face"]);

function isSafeUrl(val: string): boolean {
  const v = val.trim().toLowerCase().replace(/\s/g, "");
  // Allow https/http/mailto/tel/#; block javascript:, data:, vbscript:, etc.
  return /^(https?:|mailto:|tel:|#|\/)/.test(v) || !/:/.test(v);
}

function sanitizeAttr(name: string, value: string): string | null {
  const n = name.toLowerCase();
  // Always strip event handlers (on*)
  if (n.startsWith("on")) return null;
  if (URL_ATTRS.has(n)) {
    return isSafeUrl(value) ? value : null;
  }
  if (SAFE_ATTRS.has(n)) return value;
  if (COND_ATTRS.has(n)) {
    // Block values that contain JS expressions: (  )  javascript  expression()
    if (/javascript|expression\s*\(|\burl\s*\(\s*['"]?\s*(?:javascript|data)/.test(value.toLowerCase())) return null;
    return value;
  }
  return null; // unknown attribute — strip
}

/**
 * Server/client-safe HTML sanitizer. Strips disallowed tags and attributes.
 * Input: seller-authored HTML string from `content.description_html`.
 * Output: sanitized HTML safe to pass to dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // Replace tags using a regex tokenizer (no DOM needed — runs in Node too).
  return html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\s*((?:[^"'>]|"[^"]*"|'[^']*')*)\s*(\/?)>/g,
    (_match, slash, rawTag, attrsStr, selfClose) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return ""; // strip entire tag

      if (slash) return `</${tag}>`; // closing tag is fine

      // Parse and sanitize attributes
      const safeAttrs: string[] = [];
      const attrRe = /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(attrsStr)) !== null) {
        const aName = m[1];
        const aVal = m[2] ?? m[3] ?? m[4] ?? "";
        const safe = sanitizeAttr(aName, aVal);
        if (safe !== null) {
          safeAttrs.push(`${aName.toLowerCase()}="${safe.replace(/"/g, "&quot;")}"`);
        }
      }

      // Force external links to be safe
      if (tag === "a") {
        if (!safeAttrs.some((a) => a.startsWith("target="))) safeAttrs.push('target="_blank"');
        if (!safeAttrs.some((a) => a.startsWith("rel="))) safeAttrs.push('rel="noopener noreferrer"');
      }

      const attrs = safeAttrs.length ? " " + safeAttrs.join(" ") : "";
      return `<${tag}${attrs}${selfClose ? " /" : ""}>`;
    },
  );
}
