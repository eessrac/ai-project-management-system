import { useEffect, useMemo, useRef, useState } from "react";
import {
  getTaskComments,
  createTaskComment,
  deleteTaskComment,
  updateTaskComment,
  getProjectMembers,
  getToken,
} from "../api";

export default function TaskComments({
  projectId,
  taskId,
  myRole,
  onCommentsChanged,
}) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [meId, setMeId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [members, setMembers] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [hoveredMention, setHoveredMention] = useState(null);
  const [hoverCardPos, setHoverCardPos] = useState({ x: 0, y: 0 });

  const inputRef = useRef(null);
  const hoverTimerRef = useRef(null);

  async function load(nextShowAll = showAll) {
    if (!projectId || !taskId) return;
    const data = await getTaskComments(projectId, taskId, {
      all: nextShowAll,
    });
    setComments(data.comments || []);
  }

  async function loadMembers() {
    if (!projectId) return;
    try {
      const data = await getProjectMembers(projectId);
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    }
  }

  function readUserIdFromToken() {
    try {
      const token = getToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.userId || payload.id || payload.sub || null;
    } catch {
      return null;
    }
  }

  function getMentionKey(member) {
    const emailName = String(member.email || "").split("@")[0].trim();
    if (emailName) return emailName.toLowerCase();

    return String(member.full_name || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function renderAvatar(member, size = 28) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: "50%",
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          color: "#4338ca",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size <= 28 ? 11 : 13,
          fontWeight: 800,
        }}
      >
        {getInitials(member.full_name || member.email)}
      </div>
    );
  }

  function openMentionPopup(currentText, caretPos) {
    const beforeCaret = currentText.slice(0, caretPos);
    const match = beforeCaret.match(/(^|\s)@([a-zA-Z0-9_.çğıöşüÇĞİÖŞÜ]*)$/);

    if (!match) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
      return;
    }

    const query = match[2] || "";
    const atIndex = beforeCaret.lastIndexOf("@");

    setMentionOpen(true);
    setMentionQuery(query.toLowerCase());
    setMentionStartIndex(atIndex);
  }

  function handleTextChange(value, caretPos) {
    setText(value);
    openMentionPopup(value, caretPos);
  }

  function insertMention(member) {
    if (mentionStartIndex < 0) return;

    const mentionKey = getMentionKey(member);
    const before = text.slice(0, mentionStartIndex);
    const after = text.slice(mentionStartIndex + 1 + mentionQuery.length);

    const newText = `${before}@${mentionKey} ${after}`;
    setText(newText);
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStartIndex(-1);

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = (`${before}@${mentionKey} `).length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  }

  const filteredMembers = useMemo(() => {
    if (!mentionOpen) return [];

    const q = mentionQuery.trim().toLowerCase();

    return members
      .filter((m) => {
        const name = String(m.full_name || "").toLowerCase();
        const email = String(m.email || "").toLowerCase();
        const emailName = email.split("@")[0];
        const mentionKey = getMentionKey(m);

        if (!q) return true;

        return (
          name.includes(q) ||
          email.includes(q) ||
          emailName.includes(q) ||
          mentionKey.includes(q)
        );
      })
      .slice(0, 6);
  }, [members, mentionOpen, mentionQuery]);

  function findMentionedMember(rawMention) {
    const token = String(rawMention || "").replace(/^@/, "").toLowerCase();

    return (
      members.find((m) => {
        const name = String(m.full_name || "").toLowerCase();
        const email = String(m.email || "").toLowerCase();
        const emailName = email.split("@")[0];
        const mentionKey = getMentionKey(m);

        return (
          token === mentionKey ||
          token === emailName ||
          name.includes(token)
        );
      }) || null
    );
  }

  function showHoverCard(member, event) {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    setHoveredMention(member);
    setHoverCardPos({
      x: event.clientX + 8,
      y: event.clientY + 12,
    });
  }

  function hideHoverCard() {
    hoverTimerRef.current = setTimeout(() => {
      setHoveredMention(null);
    }, 120);
  }

  function cancelHideHoverCard() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  }

  function renderCommentBody(body) {
    const parts = String(body || "").split(
      /(@[a-zA-Z0-9_.çğıöşüÇĞİÖŞÜ]+)/g
    );

    return parts.map((part, index) => {
      if (!part.startsWith("@")) {
        return <span key={index}>{part}</span>;
      }

      const member = findMentionedMember(part);

      return (
        <span
          key={index}
          onMouseEnter={(e) => member && showHoverCard(member, e)}
          onMouseMove={(e) =>
            member &&
            setHoverCardPos({
              x: e.clientX + 8,
              y: e.clientY + 12,
            })
          }
          onMouseLeave={hideHoverCard}
          style={{
            color: "#4f46e5",
            fontWeight: 700,
            cursor: member ? "pointer" : "default",
          }}
        >
          {part}
        </span>
      );
    });
  }

  function startEdit(comment) {
    setEditingId(comment.id);
    setEditText(comment.body || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  async function onSaveEdit(commentId) {
    const body = editText.trim();
    if (!body || !projectId || !taskId) return;

    setSavingEdit(true);
    try {
      const data = await updateTaskComment(projectId, taskId, commentId, body);

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                ...data.comment,
              }
            : c
        )
      );

      setEditingId(null);
      setEditText("");

      if (onCommentsChanged) {
        onCommentsChanged();
      }
    } catch (e) {
      alert(e.message || "Yorum güncellenemedi");
    } finally {
      setSavingEdit(false);
    }
  }

  useEffect(() => {
    setMeId(readUserIdFromToken());
  }, []);

  useEffect(() => {
    if (!projectId || !taskId) return;
    load(showAll);
  }, [projectId, taskId, showAll]);

  useEffect(() => {
    if (!projectId) return;
    loadMembers();
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  async function onSend() {
    const body = text.trim();
    if (!body || !projectId || !taskId) return;

    setLoading(true);
    try {
      const data = await createTaskComment(projectId, taskId, body);
      setText("");
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStartIndex(-1);

      setComments((prev) => [
        ...prev,
        {
          ...data.comment,
          author_name: "You",
          author_id: meId,
          mentions: data.comment?.mentions || [],
        },
      ]);

      if (onCommentsChanged) {
        onCommentsChanged();
      }
    } catch (e) {
      alert(e.message || "Yorum gönderilemedi");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(commentId) {
    const ok = confirm("Bu yorum silinsin mi?");
    if (!ok || !projectId || !taskId) return;

    setDeletingId(commentId);
    try {
      await deleteTaskComment(projectId, taskId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      if (onCommentsChanged) {
        onCommentsChanged();
      }
    } catch (e) {
      alert(e.message || "Yorum silinemedi");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {showAll ? "Tüm yorumlar" : "Son 7 gün"}
        </div>

        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          style={{
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
          }}
        >
          {showAll ? "Kısalt" : "Tümünü göster"}
        </button>
      </div>

      <div
        style={{
          maxHeight: 260,
          overflow: "auto",
          border: "1px solid #eee",
          borderRadius: 10,
          padding: 12,
          background: "#fafafa",
        }}
      >
        {comments.length === 0 ? (
          <div style={{ opacity: 0.6, textAlign: "center" }}>
            Henüz yorum yok.
          </div>
        ) : (
          comments.map((c) => {
            const canManage =
              String(c.author_id) === String(meId) || myRole === "LEADER";

            const isEdited =
              c.updated_at &&
              c.created_at &&
              new Date(c.updated_at).getTime() !==
                new Date(c.created_at).getTime();

            return (
              <div
                key={c.id}
                style={{
                  padding: "10px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <strong>{c.author_name || "Unknown"}</strong>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        opacity: 0.6,
                      }}
                    >
                      {new Date(c.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    {canManage && editingId !== c.id && (
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        style={{
                          fontSize: 11,
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: "rgba(139,92,246,0.18)",
                          border: "1px solid rgba(139,92,246,0.35)",
                          color: "#ddd6fe",
                          cursor: "pointer",
                        }}
                      >
                        Düzenle
                      </button>
                    )}

                    {canManage && editingId !== c.id && (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        disabled={deletingId === c.id}
                        style={{
                          fontSize: 11,
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: "rgba(239,68,68,0.14)",
                          border: "1px solid rgba(239,68,68,0.28)",
                          color: "#fca5a5",
                          cursor: "pointer",
                        }}
                      >
                        {deletingId === c.id ? "..." : "Sil"}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  {editingId === c.id ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          resize: "vertical",
                          fontFamily: "inherit",
                          fontSize: 14,
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          onClick={cancelEdit}
                          style={{
                            fontSize: 12,
                            padding: "6px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          İptal
                        </button>

                        <button
                          type="button"
                          onClick={() => onSaveEdit(c.id)}
                          disabled={savingEdit || !editText.trim()}
                          style={{
                            fontSize: 12,
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: "#4CAF50",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                            opacity: savingEdit ? 0.7 : 1,
                          }}
                        >
                          {savingEdit ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                      {renderCommentBody(c.body)}
                      {isEdited && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            opacity: 0.6,
                          }}
                        >
                          (düzenlendi)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ position: "relative", display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
          placeholder="Yorum yaz... (@hamza gibi)"
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
          onKeyDown={(e) => {
            if (mentionOpen && filteredMembers.length > 0) {
              if (e.key === "Enter") {
                e.preventDefault();
                insertMention(filteredMembers[0]);
                return;
              }
              if (e.key === "Escape") {
                setMentionOpen(false);
                return;
              }
            }

            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          onClick={(e) => openMentionPopup(e.target.value, e.target.selectionStart)}
        />

        <button
          onClick={onSend}
          disabled={loading || !text.trim()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "#4CAF50",
            color: "white",
            border: "none",
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "..." : "Gönder"}
        </button>

        {mentionOpen && filteredMembers.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 90,
              bottom: "calc(100% + 6px)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              zIndex: 30,
              overflow: "hidden",
            }}
          >
            {filteredMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(member)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {renderAvatar(member, 28)}

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {member.full_name || member.email}
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.65 }}>
                    @{getMentionKey(member)} · {member.email}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {hoveredMention && (
        <div
          onMouseEnter={cancelHideHoverCard}
          onMouseLeave={hideHoverCard}
          style={{
            position: "fixed",
            left: hoverCardPos.x,
            top: hoverCardPos.y,
            width: 220,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
            padding: 12,
            zIndex: 99999,
            pointerEvents: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {renderAvatar(hoveredMention, 38)}

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {hoveredMention.full_name || "Unknown user"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {hoveredMention.email || "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}