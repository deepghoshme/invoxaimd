"use client";

import { useEffect, useRef } from "react";

type Cmd = { label: string; title: string; run: () => void };

/**
 * Lightweight rich-text editor (contentEditable + execCommand). Emits HTML via
 * onChange. Supports bold/italic/underline, lists, headings, text color, links,
 * and image-by-URL. Good enough for product/page descriptions.
 */
export default function RichText({
  value,
  onChange,
  placeholder = "Describe your page…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Initialise once from `value` (uncontrolled thereafter to keep the caret stable).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }
  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  const cmds: Cmd[] = [
    { label: "B", title: "Bold", run: () => exec("bold") },
    { label: "I", title: "Italic", run: () => exec("italic") },
    { label: "U", title: "Underline", run: () => exec("underline") },
    { label: "H", title: "Heading", run: () => exec("formatBlock", "H3") },
    { label: "• List", title: "Bullet list", run: () => exec("insertUnorderedList") },
    { label: "1. List", title: "Numbered list", run: () => exec("insertOrderedList") },
    {
      label: "🔗",
      title: "Link",
      run: () => {
        const url = window.prompt("Link URL");
        if (url) exec("createLink", url);
      },
    },
    {
      label: "🖼",
      title: "Image by URL",
      run: () => {
        const url = window.prompt("Image URL");
        if (url) exec("insertImage", url);
      },
    },
    { label: "✖", title: "Clear formatting", run: () => exec("removeFormat") },
  ];

  return (
    <div className="rte">
      <div className="rte-toolbar">
        {cmds.map((c) => (
          <button key={c.title} type="button" className="rte-btn" title={c.title} onMouseDown={(e) => e.preventDefault()} onClick={c.run}>
            {c.label}
          </button>
        ))}
        <label className="rte-btn rte-color" title="Text color">
          A
          <input
            type="color"
            onChange={(e) => exec("foreColor", e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </label>
      </div>
      <div
        ref={ref}
        className="rte-area input"
        contentEditable
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        suppressContentEditableWarning
      />
    </div>
  );
}
