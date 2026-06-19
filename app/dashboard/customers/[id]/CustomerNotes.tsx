"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomerNote, deleteCustomerNote, updateCustomerNote } from "./actions";

export interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
}

interface Props {
  notes: NoteRow[];
  buyerEmail: string;
}

function fmtNoteDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomerNotes({ notes: initialNotes, buyerEmail }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteRow[]>(initialNotes);
  const [addPending, startAdd] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editPending, startEdit] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = textareaRef.current?.value.trim() ?? "";
    if (!body) {
      setAddError("Note cannot be empty.");
      return;
    }
    setAddError(null);
    startAdd(async () => {
      const res = await addCustomerNote({ buyerEmail, body });
      if (!res.ok) {
        setAddError(res.error ?? "Failed to add note.");
        return;
      }
      // Optimistically prepend — then refresh server state
      if (textareaRef.current) textareaRef.current.value = "";
      router.refresh();
    });
  }

  function handleDelete(noteId: string) {
    setDeletingId(noteId);
    setDeleteError(null);
    deleteCustomerNote(noteId).then((res) => {
      setDeletingId(null);
      if (!res.ok) {
        setDeleteError(res.error ?? "Failed to delete note.");
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      router.refresh();
    });
  }

  function startEditing(note: NoteRow) {
    setEditingId(note.id);
    setEditBody(note.body);
    setEditError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditBody("");
    setEditError(null);
  }

  function handleEditSave(noteId: string) {
    const trimmed = editBody.trim();
    if (!trimmed) {
      setEditError("Note cannot be empty.");
      return;
    }
    setEditError(null);
    startEdit(async () => {
      const res = await updateCustomerNote(noteId, trimmed);
      if (!res.ok) {
        setEditError(res.error ?? "Failed to update note.");
        return;
      }
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, body: trimmed, updated_at: new Date().toISOString() }
            : n,
        ),
      );
      setEditingId(null);
      setEditBody("");
      router.refresh();
    });
  }

  return (
    <div className="cr-card" style={{ marginTop: 16 }}>
      <div className="cr-ct">
        <h3>Notes</h3>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Add note form */}
      <form onSubmit={handleAdd} style={{ marginBottom: 18 }}>
        <textarea
          ref={textareaRef}
          rows={3}
          placeholder="Add a note about this customer…"
          disabled={addPending}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--input-bg, var(--card))",
            color: "var(--fg)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
            marginBottom: 6,
            opacity: addPending ? 0.6 : 1,
          }}
        />
        {addError && (
          <p style={{ color: "var(--danger, #ef4444)", fontSize: 12, marginBottom: 6 }}>
            {addError}
          </p>
        )}
        <button
          type="submit"
          className="cr-btn grad"
          disabled={addPending}
          style={{ opacity: addPending ? 0.6 : 1 }}
        >
          {addPending ? "Saving…" : "+ Add note"}
        </button>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>No notes yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {notes.map((note) => (
            <div
              key={note.id}
              style={{
                background: "var(--input-bg, var(--card))",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              {editingId === note.id ? (
                <>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    disabled={editPending}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: "var(--fg)",
                      fontSize: 13,
                      fontFamily: "inherit",
                      resize: "vertical",
                      boxSizing: "border-box",
                      marginBottom: 6,
                      opacity: editPending ? 0.6 : 1,
                    }}
                  />
                  {editError && (
                    <p style={{ color: "var(--danger, #ef4444)", fontSize: 12, marginBottom: 4 }}>
                      {editError}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="cr-btn grad"
                      onClick={() => handleEditSave(note.id)}
                      disabled={editPending}
                      style={{ fontSize: 12, opacity: editPending ? 0.6 : 1 }}
                    >
                      {editPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      className="cr-btn"
                      onClick={cancelEditing}
                      disabled={editPending}
                      style={{ fontSize: 12 }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--fg)",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {note.body}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {note.updated_at && note.updated_at !== note.created_at
                        ? `Edited ${fmtNoteDate(note.updated_at)}`
                        : fmtNoteDate(note.created_at)}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="cr-btn"
                        onClick={() => startEditing(note)}
                        style={{ fontSize: 11, padding: "3px 9px" }}
                      >
                        Edit
                      </button>
                      <button
                        className="cr-btn"
                        onClick={() => handleDelete(note.id)}
                        disabled={deletingId === note.id}
                        style={{
                          fontSize: 11,
                          padding: "3px 9px",
                          color: "var(--danger, #ef4444)",
                          opacity: deletingId === note.id ? 0.5 : 1,
                        }}
                      >
                        {deletingId === note.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteError && (
        <p style={{ color: "var(--danger, #ef4444)", fontSize: 12, marginTop: 8 }}>
          {deleteError}
        </p>
      )}
    </div>
  );
}
