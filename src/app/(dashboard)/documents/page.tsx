'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Folder, FileText, Image as ImageIcon, FileArchive, FileSpreadsheet, FileVideo,
  FileAudio, File as FileIcon, HardDrive, Clock, Star, ChevronRight, Plus,
  UploadCloud, FolderPlus, Search, Grid3x3, List, MoreVertical, Download, Pencil,
  Trash2, Loader2, StarOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBytes } from '@/lib/format-bytes';
import type { DocumentCrumb, DocumentRow } from '@/types/documents';

type ViewMode = 'grid' | 'list';
type SidebarSection = 'my-drive' | 'recent' | 'starred';

export default function DocumentsPage() {
  const [rows, setRows]             = useState<DocumentRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<ViewMode>('grid');
  const [section, setSection]       = useState<SidebarSection>('my-drive');
  const [parentId, setParentId]     = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<DocumentCrumb[]>([]);
  const [search, setSearch]         = useState('');
  const [newOpen, setNewOpen]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [renameFor, setRenameFor]   = useState<DocumentRow | null>(null);
  const [openMenu, setOpenMenu]     = useState<string | null>(null);

  const menuRef  = useRef<HTMLDivElement | null>(null);
  const newRef   = useRef<HTMLDivElement | null>(null);
  const fileRef  = useRef<HTMLInputElement | null>(null);
  const dropRef  = useRef<HTMLDivElement | null>(null);

  // ─── Load list whenever the section or parent changes ────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = section === 'starred'
        ? '/api/v1/documents?starred=true'
        : `/api/v1/documents?parent=${parentId ?? 'null'}`;
      const res = await fetch(url);
      const body = await res.json();
      setRows(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [section, parentId]);

  useEffect(() => { load(); }, [load]);

  // Breadcrumb — fetched only when browsing My Drive into a subfolder
  useEffect(() => {
    if (section !== 'my-drive' || !parentId) {
      setBreadcrumb([]);
      return;
    }
    fetch(`/api/v1/documents/breadcrumb?id=${parentId}`)
      .then((r) => r.json())
      .then((res) => setBreadcrumb(res.data ?? []))
      .catch(() => setBreadcrumb([]));
  }, [section, parentId]);

  // Close popups on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (openMenu && menuRef.current && !menuRef.current.contains(t)) setOpenMenu(null);
      if (newOpen && newRef.current && !newRef.current.contains(t)) setNewOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenu, newOpen]);

  // Filtered rows for search box
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  // ─── Actions ──────────────────────────────────────────────────────
  async function createFolder() {
    const name = prompt('Folder name');
    if (!name?.trim()) return;
    setNewOpen(false);
    const res = await fetch('/api/v1/documents/folder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), parentId }),
    });
    if (!res.ok) { alert('Failed to create folder'); return; }
    const body = await res.json();
    setRows((prev) => [body.data, ...prev]);
  }

  async function uploadFiles(files: FileList | File[]) {
    setNewOpen(false);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        if (parentId) fd.append('parentId', parentId);
        const res = await fetch('/api/v1/documents/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`${file.name}: ${err.error ?? 'upload failed'}`);
          continue;
        }
        const body = await res.json();
        setRows((prev) => [body.data, ...prev]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function toggleStar(row: DocumentRow) {
    setOpenMenu(null);
    const res = await fetch(`/api/v1/documents/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ starred: !row.starred }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setRows((prev) => prev.map((r) => r.id === row.id ? body.data : r));
  }

  async function renameCommit(row: DocumentRow, newName: string) {
    setRenameFor(null);
    if (!newName.trim() || newName === row.name) return;
    const res = await fetch(`/api/v1/documents/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) return;
    const body = await res.json();
    setRows((prev) => prev.map((r) => r.id === row.id ? body.data : r));
  }

  async function download(row: DocumentRow) {
    setOpenMenu(null);
    const res = await fetch(`/api/v1/documents/${row.id}/download`);
    if (!res.ok) { alert('Failed to prepare download'); return; }
    const body = await res.json();
    window.open(body.data.url, '_blank');
  }

  async function remove(row: DocumentRow) {
    setOpenMenu(null);
    const kindLabel = row.kind === 'folder' ? 'folder and all its contents' : 'file';
    if (!confirm(`Delete "${row.name}" ${kindLabel}? This cannot be undone.`)) return;
    const res = await fetch(`/api/v1/documents/${row.id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Delete failed'); return; }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  function openItem(row: DocumentRow) {
    if (row.kind === 'folder') {
      setSection('my-drive');
      setParentId(row.id);
    } else {
      void download(row);
    }
  }

  // ─── Drag & drop upload ───────────────────────────────────────────
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    let counter = 0;
    let over = false;

    function onEnter(e: DragEvent) { e.preventDefault(); counter++; if (!over) { over = true; el!.classList.add('ring-2', 'ring-blue-400'); } }
    function onOver(e: DragEvent) { e.preventDefault(); }
    function onLeave() { counter = Math.max(0, counter - 1); if (counter === 0 && over) { over = false; el!.classList.remove('ring-2', 'ring-blue-400'); } }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      counter = 0; over = false;
      el!.classList.remove('ring-2', 'ring-blue-400');
      if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files);
    }

    el.addEventListener('dragenter', onEnter);
    el.addEventListener('dragover', onOver);
    el.addEventListener('dragleave', onLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragenter', onEnter);
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('dragleave', onLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [parentId]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-slate-200 py-4 dark:border-slate-800 lg:block">
        <div className="relative px-3 pb-4" ref={newRef}>
          <button
            onClick={() => setNewOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-800 shadow-md ring-1 ring-slate-200 transition hover:shadow-lg dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
          >
            <Plus className="h-5 w-5" /> New
          </button>
          {newOpen && (
            <div
              role="menu"
              className="absolute left-3 top-16 z-20 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                onClick={createFolder}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FolderPlus className="h-4 w-4 text-slate-400" /> New folder
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <UploadCloud className="h-4 w-4 text-slate-400" /> File upload
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
            </div>
          )}
        </div>

        <nav className="space-y-0.5 px-2 text-sm">
          <SidebarItem icon={HardDrive} label="My Drive" active={section === 'my-drive'}
            onClick={() => { setSection('my-drive'); setParentId(null); }} />
          <SidebarItem icon={Clock} label="Recent" active={section === 'recent'}
            onClick={() => { setSection('recent'); setParentId(null); }} />
          <SidebarItem icon={Star} label="Starred" active={section === 'starred'}
            onClick={() => { setSection('starred'); setParentId(null); }} />
        </nav>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Search bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
          <div className="relative w-full max-w-xl">
            <Search className="studio-search-icon" />
            <Input
              placeholder="Search in Documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-[48px]"
            />
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setView('grid')}
              className={
                'rounded px-2 py-1 transition-colors ' +
                (view === 'grid'
                  ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')
              }
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={
                'rounded px-2 py-1 transition-colors ' +
                (view === 'list'
                  ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')
              }
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 px-6 py-2 text-sm dark:border-slate-800">
          <button
            onClick={() => { setSection('my-drive'); setParentId(null); }}
            className={
              'flex items-center gap-1.5 rounded px-2 py-1 font-medium ' +
              (section === 'my-drive' && !parentId
                ? 'text-slate-900 dark:text-slate-50'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800')
            }
          >
            {section === 'starred' ? <Star className="h-4 w-4" />
              : section === 'recent' ? <Clock className="h-4 w-4" />
              : <HardDrive className="h-4 w-4" />}
            {section === 'starred' ? 'Starred' : section === 'recent' ? 'Recent' : 'My Drive'}
          </button>
          {breadcrumb.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <button
                onClick={() => setParentId(c.id)}
                className={
                  'rounded px-2 py-1 font-medium ' +
                  (i === breadcrumb.length - 1
                    ? 'text-slate-900 dark:text-slate-50'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')
                }
              >
                {c.name}
              </button>
            </div>
          ))}
          {uploading && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
            </span>
          )}
        </div>

        {/* Content */}
        <div ref={dropRef} className="relative flex-1 overflow-auto rounded-none ring-inset transition-shadow">
          {loading ? (
            <div className="p-16 text-center text-sm text-slate-500">Loading…</div>
          ) : visibleRows.length === 0 ? (
            <EmptyState hasSearch={search.trim().length > 0} onUpload={() => fileRef.current?.click()} onNewFolder={createFolder} />
          ) : view === 'grid' ? (
            <GridView
              rows={visibleRows}
              openItem={openItem}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              menuRef={menuRef}
              renameFor={renameFor}
              setRenameFor={setRenameFor}
              onRenameCommit={renameCommit}
              onStar={toggleStar}
              onDownload={download}
              onDelete={remove}
            />
          ) : (
            <ListView
              rows={visibleRows}
              openItem={openItem}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              menuRef={menuRef}
              renameFor={renameFor}
              setRenameFor={setRenameFor}
              onRenameCommit={renameCommit}
              onStar={toggleStar}
              onDownload={download}
              onDelete={remove}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({
  icon: Icon, label, active, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex w-full items-center gap-3 rounded-full px-4 py-2 text-left transition-colors ' +
        (active
          ? 'bg-blue-50 font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
      }
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {label}
    </button>
  );
}

// ─── File icon by MIME ─────────────────────────────────────────────────────────

function iconFor(row: DocumentRow) {
  if (row.kind === 'folder') return { Icon: Folder, color: 'text-amber-500' };
  const mime = row.mimeType ?? '';
  if (mime.startsWith('image/'))         return { Icon: ImageIcon,       color: 'text-fuchsia-500' };
  if (mime.startsWith('video/'))         return { Icon: FileVideo,       color: 'text-rose-500'    };
  if (mime.startsWith('audio/'))         return { Icon: FileAudio,       color: 'text-emerald-500' };
  if (mime === 'application/pdf')        return { Icon: FileText,        color: 'text-red-500'     };
  if (mime.includes('spreadsheet') || mime.includes('excel') || row.name.endsWith('.csv'))
                                          return { Icon: FileSpreadsheet, color: 'text-emerald-600' };
  if (mime.includes('zip') || mime.includes('compressed'))
                                          return { Icon: FileArchive,     color: 'text-slate-500'   };
  if (mime.startsWith('text/'))          return { Icon: FileText,        color: 'text-slate-500'   };
  return { Icon: FileIcon, color: 'text-slate-400' };
}

// ─── Grid view ─────────────────────────────────────────────────────────────────

function GridView(props: ViewProps) {
  const { rows } = props;
  const folders = rows.filter((r) => r.kind === 'folder');
  const files   = rows.filter((r) => r.kind === 'file');

  return (
    <div className="space-y-8 p-6">
      {folders.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Folders</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {folders.map((r) => <Tile key={r.id} row={r} {...props} />)}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Files</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {files.map((r) => <Tile key={r.id} row={r} {...props} />)}
          </div>
        </section>
      )}
    </div>
  );
}

interface ViewProps {
  rows: DocumentRow[];
  openItem: (row: DocumentRow) => void;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  renameFor: DocumentRow | null;
  setRenameFor: (row: DocumentRow | null) => void;
  onRenameCommit: (row: DocumentRow, newName: string) => void;
  onStar: (row: DocumentRow) => void;
  onDownload: (row: DocumentRow) => void;
  onDelete: (row: DocumentRow) => void;
}

function Tile({ row, ...p }: ViewProps & { row: DocumentRow }) {
  const { Icon, color } = iconFor(row);
  const isRenaming = p.renameFor?.id === row.id;
  return (
    <div className="relative">
      <button
        onDoubleClick={() => p.openItem(row)}
        onClick={() => p.openItem(row)}
        className="group flex w-full flex-col items-start gap-2 rounded-lg border border-transparent bg-slate-50 p-3 text-left transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800"
      >
        <div className="flex w-full items-start justify-between">
          <Icon className={'h-8 w-8 flex-shrink-0 ' + color} />
          {row.starred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
        </div>
        {isRenaming ? (
          <RenameField row={row} onCommit={p.onRenameCommit} onCancel={() => p.setRenameFor(null)} />
        ) : (
          <span className="w-full truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.name}</span>
        )}
        <span className="text-[11px] text-slate-500">
          {row.kind === 'folder' ? 'Folder' : formatBytes(row.sizeBytes)}
        </span>
      </button>
      <RowMenuButton row={row} {...p} />
    </div>
  );
}

// ─── List view ─────────────────────────────────────────────────────────────────

function ListView(props: ViewProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <tr>
            <th className="w-6"></th>
            <th className="px-3 py-3 text-left font-semibold">Name</th>
            <th className="px-3 py-3 text-left font-semibold">Type</th>
            <th className="px-3 py-3 text-right font-semibold">Size</th>
            <th className="px-3 py-3 text-left font-semibold">Created</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => {
            const { Icon, color } = iconFor(r);
            const isRenaming = props.renameFor?.id === r.id;
            return (
              <tr
                key={r.id}
                className="group cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900"
                onDoubleClick={() => props.openItem(r)}
              >
                <td className="pl-4"><Icon className={'h-5 w-5 ' + color} /></td>
                <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">
                  {isRenaming ? (
                    <RenameField row={r} onCommit={props.onRenameCommit} onCancel={() => props.setRenameFor(null)} />
                  ) : (
                    <button onClick={() => props.openItem(r)} className="text-left font-medium hover:text-blue-600">
                      {r.name}{r.starred && <Star className="ml-1.5 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-500">{r.kind === 'folder' ? 'Folder' : (r.mimeType ?? 'File')}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.kind === 'folder' ? '—' : formatBytes(r.sizeBytes)}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="relative px-3 py-2.5">
                  <RowMenuButton row={r} {...props} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Row action menu ───────────────────────────────────────────────────────────

function RowMenuButton({
  row, openMenu, setOpenMenu, menuRef, onStar, onDownload, onDelete, setRenameFor,
}: ViewProps & { row: DocumentRow }) {
  const open = openMenu === row.id;
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpenMenu(open ? null : row.id); }}
        className="absolute right-2 top-2 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-slate-800"
        aria-label="Row actions"
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-2 top-9 z-30 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-left text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {row.kind === 'file' && (
            <MenuItem icon={Download} onClick={() => onDownload(row)}>Download</MenuItem>
          )}
          <MenuItem icon={Pencil} onClick={() => { setOpenMenu(null); setRenameFor(row); }}>
            Rename
          </MenuItem>
          <MenuItem icon={row.starred ? StarOff : Star} onClick={() => onStar(row)}>
            {row.starred ? 'Unstar' : 'Star'}
          </MenuItem>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <MenuItem icon={Trash2} tone="danger" onClick={() => onDelete(row)}>Delete</MenuItem>
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon: Icon, children, onClick, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'danger';
}) {
  const cls = tone === 'danger'
    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={'flex w-full items-center gap-2 px-3 py-1.5 text-left ' + cls}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function RenameField({
  row, onCommit, onCancel,
}: {
  row: DocumentRow;
  onCommit: (row: DocumentRow, name: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(row.name);
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(row, val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(row, val);
        else if (e.key === 'Escape') onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm outline-none dark:bg-slate-900"
    />
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch, onUpload, onNewFolder,
}: { hasSearch: boolean; onUpload: () => void; onNewFolder: () => void }) {
  if (hasSearch) {
    return (
      <div className="p-16 text-center">
        <p className="text-sm text-slate-500">No documents match your search.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md p-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
        <UploadCloud className="h-7 w-7" />
      </div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
        Drop files here to upload
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Or use the buttons below to add your first file or folder.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onNewFolder} className="gap-1.5">
          <FolderPlus className="h-4 w-4" /> New folder
        </Button>
        <Button size="sm" onClick={onUpload} className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
          <UploadCloud className="h-4 w-4" /> Upload files
        </Button>
      </div>
    </div>
  );
}
