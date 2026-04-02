import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, ArrowLeft, ArrowUp, ArrowDown, Pencil, Trash2,
  Search, X, Image, Inbox, Check, FolderOpen
} from "lucide-react";

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "recall-vault:data";
const EMPTY_DATA = { categories: [], inbox: [] };

async function loadData() {
  try {
    const saved = await window.storage.get(STORAGE_KEY);
    return saved ?? EMPTY_DATA;
  } catch {
    return EMPTY_DATA;
  }
}

async function saveData(data) {
  try {
    await window.storage.set(STORAGE_KEY, data);
  } catch (e) {
    console.error("Recall Vault: failed to save", e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();

function move(arr, id, dir) {
  const i = arr.findIndex((x) => x.id === id);
  if (dir === "up" && i === 0) return arr;
  if (dir === "down" && i === arr.length - 1) return arr;
  const a = [...arr];
  const swap = dir === "up" ? i - 1 : i + 1;
  [a[i], a[swap]] = [a[swap], a[i]];
  return a;
}

function readPhoto(file, cb) {
  const r = new FileReader();
  r.onload = (e) => cb(e.target.result);
  r.readAsDataURL(file);
}

function searchAll(data, query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results = [];
  data.categories.forEach((cat) => {
    cat.items.forEach((item) => {
      if (
        item.name.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q))
      ) {
        results.push({ item, catId: cat.id, catName: cat.name, catEmoji: cat.emoji });
      }
    });
  });
  data.inbox.forEach((item) => {
    if (
      item.name.toLowerCase().includes(q) ||
      (item.note && item.note.toLowerCase().includes(q))
    ) {
      results.push({ item, catId: null, catName: "Inbox", catEmoji: "📥" });
    }
  });
  return results;
}

// ─── Inline editable text ─────────────────────────────────────────────────────

function EditableText({ value, onSave, className = "", placeholder = "Untitled", multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  }

  function onKey(e) {
    if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  }

  if (editing) {
    const shared = {
      ref,
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: onKey,
      className: `w-full bg-amber-50 border border-amber-300 rounded px-2 py-1 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 ${className}`,
      placeholder,
    };
    return multiline
      ? <textarea {...shared} rows={2} />
      : <input {...shared} />;
  }

  return (
    <span
      className={`cursor-text hover:bg-stone-100 rounded px-1 -mx-1 transition-colors ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Tap to edit"
    >
      {value || <span className="text-stone-400">{placeholder}</span>}
    </span>
  );
}

// ─── Photo Lightbox ───────────────────────────────────────────────────────────

function PhotoLightbox({ src, onClose }) {
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={28} />
      </button>
      <img
        src={src}
        alt="Full size"
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, isFirst, isLast, onMoveUp, onMoveDown, onEdit, onDelete, onPhotoClick, onAddPhoto }) {
  const photoRef = useRef(null);

  return (
    <div className="flex items-start gap-3 bg-white rounded-xl p-3 shadow-sm border border-stone-100 group">
      {/* Photo thumbnail */}
      <div className="flex-shrink-0">
        {item.photo ? (
          <img
            src={item.photo}
            alt=""
            className="w-12 h-12 object-cover rounded-lg cursor-pointer border border-stone-200"
            onClick={() => onPhotoClick(item.photo)}
          />
        ) : (
          <button
            className="w-12 h-12 rounded-lg border-2 border-dashed border-stone-200 flex items-center justify-center text-stone-300 hover:border-amber-400 hover:text-amber-400 transition-colors"
            onClick={() => photoRef.current?.click()}
            title="Add photo"
          >
            <Image size={18} />
          </button>
        )}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readPhoto(file, (data) => onAddPhoto(item.id, data));
            e.target.value = "";
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <EditableText
          value={item.name}
          onSave={(v) => onEdit(item.id, { name: v })}
          className="font-medium text-stone-800 block w-full"
          placeholder="Item name"
        />
        <EditableText
          value={item.note || ""}
          onSave={(v) => onEdit(item.id, { note: v })}
          className="text-sm text-stone-400 block w-full mt-0.5"
          placeholder="Add a note…"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-1 rounded text-stone-300 hover:text-stone-600 disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Move up"
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-1 rounded text-stone-300 hover:text-stone-600 disabled:opacity-20 disabled:cursor-not-allowed"
          aria-label="Move down"
        >
          <ArrowDown size={14} />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 rounded text-stone-300 hover:text-red-400 transition-colors"
          aria-label="Delete item"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Add Item Form ────────────────────────────────────────────────────────────

function AddItemForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), note: note.trim(), photo: null });
    setName("");
    setNote("");
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name"
        className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-medium rounded-lg py-2 text-sm transition-colors"
        >
          Add Item
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-stone-500 hover:text-stone-700 text-sm rounded-lg hover:bg-stone-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Category View ────────────────────────────────────────────────────────────

function CategoryView({ category, onBack, onUpdateCat, onAddItem, onEditItem, onDeleteItem, onMoveItem, onAddPhoto, onPhotoClick }) {
  const [showAddForm, setShowAddForm] = useState(false);

  function handleAddItem(item) {
    onAddItem({ id: uid(), ...item });
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 pt-safe-top">
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <EditableText
              value={category.emoji || "📁"}
              onSave={(v) => onUpdateCat({ emoji: v })}
              className="text-2xl leading-none"
            />
            <EditableText
              value={category.name}
              onSave={(v) => onUpdateCat({ name: v })}
              className="text-xl font-semibold text-stone-800 truncate"
              placeholder="Category name"
            />
          </div>
          <span className="text-sm text-stone-400 flex-shrink-0">
            {category.items.length} {category.items.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 px-4 py-4 space-y-2 pb-28">
        {category.items.length === 0 && !showAddForm && (
          <div className="text-center py-12 text-stone-400">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No items yet.</p>
            <p className="text-sm">Tap "Add Item" to get started.</p>
          </div>
        )}

        {category.items.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            isFirst={idx === 0}
            isLast={idx === category.items.length - 1}
            onMoveUp={() => onMoveItem(item.id, "up")}
            onMoveDown={() => onMoveItem(item.id, "down")}
            onEdit={onEditItem}
            onDelete={onDeleteItem}
            onPhotoClick={onPhotoClick}
            onAddPhoto={onAddPhoto}
          />
        ))}

        {showAddForm ? (
          <AddItemForm
            onAdd={(item) => { handleAddItem(item); setShowAddForm(false); }}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-3 border-2 border-dashed border-stone-200 rounded-xl text-stone-400 hover:border-amber-400 hover:text-amber-500 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add Item
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Quick Add Modal ──────────────────────────────────────────────────────────

function QuickAddModal({ categories, onSave, onClose }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [catId, setCatId] = useState("");
  const [photo, setPhoto] = useState(null);
  const nameRef = useRef(null);
  const photoRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), note: note.trim(), photo, catId: catId || null });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">Quick Add</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is this? *"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
          />

          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
          >
            <option value="">→ Inbox (no category)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>

          {/* Photo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-xl text-stone-500 hover:border-amber-400 hover:text-amber-500 transition-colors text-sm"
            >
              <Image size={16} />
              {photo ? "Change photo" : "Add photo"}
            </button>
            {photo && (
              <div className="relative">
                <img src={photo} alt="" className="w-12 h-12 object-cover rounded-lg border border-stone-200" />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute -top-1.5 -right-1.5 bg-stone-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            )}
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readPhoto(file, setPhoto);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Category Form ────────────────────────────────────────────────────────

function AddCategoryForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), emoji: emoji.trim() || "📁" });
    setName("");
    setEmoji("");
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 space-y-3">
      <p className="text-sm font-medium text-stone-600">New Category</p>
      <div className="flex gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="📁"
          maxLength={4}
          className="w-14 border border-stone-200 rounded-xl px-2 py-2.5 text-center text-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-medium rounded-xl py-2.5 text-sm transition-colors"
        >
          Create Category
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-stone-500 hover:text-stone-700 text-sm rounded-xl hover:bg-stone-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, isFirst, isLast, onOpen, onMoveUp, onMoveDown, onDelete }) {
  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
      <button
        className="w-full p-4 text-left active:bg-stone-50 transition-colors"
        onClick={onOpen}
      >
        <div className="text-3xl mb-2">{cat.emoji || "📁"}</div>
        <div className="font-semibold text-stone-800 text-sm leading-snug truncate">{cat.name}</div>
        <div className="text-xs text-stone-400 mt-1">
          {cat.items.length} {cat.items.length === 1 ? "item" : "items"}
        </div>
      </button>

      {/* Controls — always visible */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 bg-white/90 rounded-lg text-stone-300 hover:text-stone-600 disabled:opacity-20 shadow-sm transition-colors"
          aria-label="Move up"
        >
          <ArrowUp size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 bg-white/90 rounded-lg text-stone-300 hover:text-stone-600 disabled:opacity-20 shadow-sm transition-colors"
          aria-label="Move down"
        >
          <ArrowDown size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete "${cat.name}" and all its items?`)) onDelete();
          }}
          className="p-1 bg-white/90 rounded-lg text-stone-300 hover:text-red-400 shadow-sm transition-colors"
          aria-label="Delete category"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Inbox Section ────────────────────────────────────────────────────────────

function InboxSection({ items, onOpen, onDeleteItem, onMoveToCategory, categories }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <Inbox size={18} className="text-amber-500 flex-shrink-0" />
        <span className="font-semibold text-stone-800 flex-1">Inbox</span>
        <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          {items.length}
        </span>
        <span className="text-stone-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 divide-y divide-stone-50">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              {item.photo && (
                <img src={item.photo} alt="" className="w-9 h-9 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-stone-800 text-sm truncate">{item.name}</div>
                {item.note && <div className="text-xs text-stone-400 truncate">{item.note}</div>}
              </div>
              {categories.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) { onMoveToCategory(item.id, e.target.value); e.target.value = ""; }
                  }}
                  className="text-xs text-stone-500 border border-stone-200 rounded-lg px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  title="Move to category"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="" disabled>Move to…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => onDeleteItem(item.id)}
                className="text-stone-300 hover:text-red-400 transition-colors p-1"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────

function SearchResults({ results, onNavigate }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400">
        <Search size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No matches found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map(({ item, catId, catName, catEmoji }) => (
        <button
          key={item.id}
          className="w-full text-left bg-white rounded-xl shadow-sm border border-stone-100 p-3 flex items-start gap-3 hover:border-amber-300 transition-colors active:bg-stone-50"
          onClick={() => catId && onNavigate(catId)}
        >
          {item.photo && (
            <img src={item.photo} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-stone-800 text-sm">{item.name}</div>
            {item.note && <div className="text-xs text-stone-500 mt-0.5 truncate">{item.note}</div>}
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-500 text-xs px-2 py-0.5 rounded-full">
                {catEmoji} {catName}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────────────────

function FAB({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
      aria-label="Quick add"
    >
      <Plus size={26} />
    </button>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("home"); // 'home' | 'category'
  const [activeCatId, setActiveCatId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const searchRef = useRef(null);

  // Load on mount
  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  // Persist on change (skip initial empty state)
  const persist = useCallback((newData) => {
    setData(newData);
    saveData(newData);
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeCategory = data.categories.find((c) => c.id === activeCatId);
  const searchResults = searchQuery.trim() ? searchAll(data, searchQuery) : [];
  const isSearching = searchQuery.trim().length > 0;

  // ── Category mutations ────────────────────────────────────────────────────────

  function addCategory({ name, emoji }) {
    const newCat = { id: uid(), name, emoji, items: [] };
    persist({ ...data, categories: [...data.categories, newCat] });
    setShowAddCategory(false);
  }

  function updateCategory(id, patch) {
    persist({
      ...data,
      categories: data.categories.map((c) => c.id === id ? { ...c, ...patch } : c),
    });
  }

  function deleteCategory(id) {
    persist({ ...data, categories: data.categories.filter((c) => c.id !== id) });
    if (activeCatId === id) { setView("home"); setActiveCatId(null); }
  }

  function moveCategoryInList(id, dir) {
    persist({ ...data, categories: move(data.categories, id, dir) });
  }

  // ── Item mutations ────────────────────────────────────────────────────────────

  function addItemToCategory(catId, item) {
    persist({
      ...data,
      categories: data.categories.map((c) =>
        c.id === catId ? { ...c, items: [...c.items, item] } : c
      ),
    });
  }

  function editItemInCategory(catId, itemId, patch) {
    persist({
      ...data,
      categories: data.categories.map((c) =>
        c.id === catId
          ? { ...c, items: c.items.map((i) => i.id === itemId ? { ...i, ...patch } : i) }
          : c
      ),
    });
  }

  function deleteItemFromCategory(catId, itemId) {
    persist({
      ...data,
      categories: data.categories.map((c) =>
        c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
      ),
    });
  }

  function moveItemInCategory(catId, itemId, dir) {
    persist({
      ...data,
      categories: data.categories.map((c) =>
        c.id === catId ? { ...c, items: move(c.items, itemId, dir) } : c
      ),
    });
  }

  // ── Inbox mutations ───────────────────────────────────────────────────────────

  function deleteFromInbox(itemId) {
    persist({ ...data, inbox: data.inbox.filter((i) => i.id !== itemId) });
  }

  function moveInboxItemToCategory(itemId, catId) {
    const item = data.inbox.find((i) => i.id === itemId);
    if (!item) return;
    persist({
      ...data,
      inbox: data.inbox.filter((i) => i.id !== itemId),
      categories: data.categories.map((c) =>
        c.id === catId ? { ...c, items: [...c.items, item] } : c
      ),
    });
  }

  // ── Quick add save ────────────────────────────────────────────────────────────

  function handleQuickAdd({ name, note, photo, catId }) {
    const item = { id: uid(), name, note, photo };
    if (catId) {
      addItemToCategory(catId, item);
    } else {
      persist({ ...data, inbox: [...data.inbox, item] });
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  function openCategory(catId) {
    setActiveCatId(catId);
    setView("category");
    setSearchQuery("");
  }

  function goHome() {
    setView("home");
    setActiveCatId(null);
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    );
  }

  // ── Category View ──────────────────────────────────────────────────────────

  if (view === "category" && activeCategory) {
    return (
      <div className="min-h-screen bg-stone-50">
        <CategoryView
          category={activeCategory}
          onBack={goHome}
          onUpdateCat={(patch) => updateCategory(activeCatId, patch)}
          onAddItem={(item) => addItemToCategory(activeCatId, item)}
          onEditItem={(itemId, patch) => editItemInCategory(activeCatId, itemId, patch)}
          onDeleteItem={(itemId) => deleteItemFromCategory(activeCatId, itemId)}
          onMoveItem={(itemId, dir) => moveItemInCategory(activeCatId, itemId, dir)}
          onAddPhoto={(itemId, photoData) => editItemInCategory(activeCatId, itemId, { photo: photoData })}
          onPhotoClick={setLightboxPhoto}
        />

        <FAB onClick={() => setShowQuickAdd(true)} />

        {showQuickAdd && (
          <QuickAddModal
            categories={data.categories}
            onSave={handleQuickAdd}
            onClose={() => setShowQuickAdd(false)}
          />
        )}

        {lightboxPhoto && (
          <PhotoLightbox src={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
        )}
      </div>
    );
  }

  // ── Home View ──────────────────────────────────────────────────────────────

  const isEmpty = data.categories.length === 0 && data.inbox.length === 0;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top bar */}
      <div className="bg-white border-b border-stone-200 px-4 pt-safe-top sticky top-0 z-20">
        <div className="py-3">
          <h1 className="text-lg font-bold text-stone-800 mb-3">Recall Vault</h1>
          {/* Search bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search everything…"
              className="w-full pl-9 pr-9 py-2.5 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 pb-28 space-y-4">
        {isSearching ? (
          <SearchResults results={searchResults} onNavigate={openCategory} />
        ) : isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 px-4">
            {showAddCategory ? (
              <div className="w-full max-w-sm">
                <AddCategoryForm onAdd={addCategory} onCancel={() => setShowAddCategory(false)} />
              </div>
            ) : (
              <>
                <div className="text-6xl">🗂️</div>
                <div>
                  <h2 className="text-xl font-semibold text-stone-800">Welcome to Recall Vault</h2>
                  <p className="text-stone-400 text-sm mt-1 max-w-xs">
                    Your external memory for everyday details — products, preferences, and everything you always forget.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
                >
                  Add your first category
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Inbox */}
            {data.inbox.length > 0 && (
              <InboxSection
                items={data.inbox}
                categories={data.categories}
                onDeleteItem={deleteFromInbox}
                onMoveToCategory={moveInboxItemToCategory}
              />
            )}

            {/* Category grid */}
            {data.categories.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Categories</h2>
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={12} /> New
                  </button>
                </div>

                {showAddCategory && (
                  <div className="mb-3">
                    <AddCategoryForm onAdd={addCategory} onCancel={() => setShowAddCategory(false)} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {data.categories.map((cat, idx) => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      isFirst={idx === 0}
                      isLast={idx === data.categories.length - 1}
                      onOpen={() => openCategory(cat.id)}
                      onMoveUp={() => moveCategoryInList(cat.id, "up")}
                      onMoveDown={() => moveCategoryInList(cat.id, "down")}
                      onDelete={() => deleteCategory(cat.id)}
                      onRename={(name) => updateCategory(cat.id, { name })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Add first category CTA if no categories but inbox has items */}
            {data.categories.length === 0 && data.inbox.length > 0 && !showAddCategory && (
              <button
                onClick={() => setShowAddCategory(true)}
                className="w-full py-3 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-amber-400 hover:text-amber-500 transition-colors text-sm font-medium"
              >
                + Add a category
              </button>
            )}

            {data.categories.length === 0 && showAddCategory && (
              <AddCategoryForm onAdd={addCategory} onCancel={() => setShowAddCategory(false)} />
            )}
          </>
        )}
      </div>

      <FAB onClick={() => setShowQuickAdd(true)} />

      {showQuickAdd && (
        <QuickAddModal
          categories={data.categories}
          onSave={handleQuickAdd}
          onClose={() => setShowQuickAdd(false)}
        />
      )}

      {lightboxPhoto && (
        <PhotoLightbox src={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  );
}
