import React, { useState, useMemo } from 'react';
import { DailyNote, Staff } from '../types';
import { generateId } from '../services/idGenerator';
import { 
  FileText, 
  Plus, 
  Search, 
  Sparkles, 
  Pin, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Info, 
  CheckCheck, 
  Clock, 
  User, 
  X,
  Calendar
} from 'lucide-react';

interface DailyNotesViewProps {
  notes: DailyNote[];
  staff: Staff[];
  currentUser: string;
  onAddNote: (note: DailyNote) => void;
  onUpdateNote: (note: DailyNote) => void;
  onDeleteNote: (id: string) => void;
}

const DailyNotesView: React.FC<DailyNotesViewProps> = ({
  notes,
  staff,
  currentUser,
  onAddNote,
  onUpdateNote,
  onDeleteNote
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'urgent' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DailyNote | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'info'>('normal');
  const [assignedTo, setAssignedTo] = useState('All Staff');
  const [pinned, setPinned] = useState(false);

  const openCreateModal = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setPriority('normal');
    setAssignedTo('All Staff');
    setPinned(false);
    setIsModalOpen(true);
  };

  const openEditModal = (note: DailyNote) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setPriority(note.priority);
    setAssignedTo(note.assignedTo || 'All Staff');
    setPinned(!!note.pinned);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingNote) {
      const updated: DailyNote = {
        ...editingNote,
        title: title.trim(),
        content: content.trim(),
        priority,
        assignedTo,
        pinned
      };
      onUpdateNote(updated);
    } else {
      const newNote: DailyNote = {
        id: generateId('note'),
        title: title.trim(),
        content: content.trim(),
        priority,
        status: 'active',
        assignedTo,
        author: currentUser ? currentUser.split('@')[0] : 'Manager',
        createdAt: new Date().toISOString(),
        pinned
      };
      onAddNote(newNote);
    }

    setIsModalOpen(false);
  };

  const toggleStatus = (note: DailyNote) => {
    const updated: DailyNote = {
      ...note,
      status: note.status === 'completed' ? 'active' : 'completed'
    };
    onUpdateNote(updated);
  };

  const togglePin = (note: DailyNote) => {
    const updated: DailyNote = {
      ...note,
      pinned: !note.pinned
    };
    onUpdateNote(updated);
  };

  // Counts
  const counts = useMemo(() => {
    return {
      all: notes.length,
      active: notes.filter(n => n.status !== 'completed').length,
      urgent: notes.filter(n => n.priority === 'urgent' && n.status !== 'completed').length,
      completed: notes.filter(n => n.status === 'completed').length,
    };
  }, [notes]);

  // Filtered and sorted notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter(n => {
        if (filter === 'active') return n.status !== 'completed';
        if (filter === 'urgent') return n.priority === 'urgent' && n.status !== 'completed';
        if (filter === 'completed') return n.status === 'completed';
        return true;
      })
      .filter(n => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.assignedTo && n.assignedTo.toLowerCase().includes(q)) ||
          n.author.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Pinned notes first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by creation time descending
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [notes, filter, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Main Container Card matching the design */}
      <div className="bg-white dark:bg-[#070e1b] rounded-3xl border border-slate-200 dark:border-[#162744] p-6 lg:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        
        {/* Card Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-[#162744]/70">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 bg-[#0a1829] border border-[#00d2ff]/40 rounded-2xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_20px_rgba(0,210,255,0.25)] shrink-0">
              <FileText size={26} className="drop-shadow-[0_0_6px_rgba(0,229,255,0.6)]" />
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                Daily Notes & Staff Scratchpad
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#6a8bb0] font-semibold mt-0.5">
                Daily notes, staff reminders and task notepad
              </p>
            </div>
          </div>

          <button 
            onClick={openCreateModal}
            className="smart-cyan-pill px-7 py-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
            id="btn_write_note"
          >
            <Plus size={16} /> WRITE NOTE
          </button>
        </div>

        {/* Filter Pills & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setFilter('all')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'all' 
                  ? 'smart-cyan-pill' 
                  : 'bg-slate-100 dark:bg-[#0c182c] text-slate-600 dark:text-slate-400 hover:text-white hover:bg-[#12223e] border border-transparent dark:border-[#162744]'
              }`}
            >
              All Notes ({counts.all})
            </button>
            <button 
              onClick={() => setFilter('active')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'active' 
                  ? 'smart-cyan-pill' 
                  : 'bg-slate-100 dark:bg-[#0c182c] text-slate-600 dark:text-slate-400 hover:text-white hover:bg-[#12223e] border border-transparent dark:border-[#162744]'
              }`}
            >
              Active ({counts.active})
            </button>
            <button 
              onClick={() => setFilter('urgent')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'urgent' 
                  ? 'smart-cyan-pill' 
                  : 'bg-slate-100 dark:bg-[#0c182c] text-slate-600 dark:text-slate-400 hover:text-white hover:bg-[#12223e] border border-transparent dark:border-[#162744]'
              }`}
            >
              Urgent ({counts.urgent})
            </button>
            <button 
              onClick={() => setFilter('completed')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'completed' 
                  ? 'smart-cyan-pill' 
                  : 'bg-slate-100 dark:bg-[#0c182c] text-slate-600 dark:text-slate-400 hover:text-white hover:bg-[#12223e] border border-transparent dark:border-[#162744]'
              }`}
            >
              Completed ({counts.completed})
            </button>
          </div>

          <div className="relative min-w-[240px] md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#4d6b8f]" size={16} />
            <input 
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-full text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="mt-8 min-h-[300px]">
          {filteredNotes.length === 0 ? (
            /* Empty State matching screenshot */
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-[#0a1829] border border-[#162744] rounded-full flex items-center justify-center text-[#00d2ff] mb-4 shadow-[0_0_20px_rgba(0,210,255,0.15)]">
                <Sparkles size={28} className="text-[#00e5ff]" />
              </div>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wide">
                NO NOTES YET
              </p>
              <button 
                onClick={openCreateModal}
                className="mt-3 text-xs font-extrabold text-[#00e5ff] hover:underline transition-all cursor-pointer"
              >
                + Write New Note
              </button>
            </div>
          ) : (
            /* Notes Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredNotes.map(note => {
                const isCompleted = note.status === 'completed';
                return (
                  <div 
                    key={note.id}
                    className={`relative rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between group ${
                      isCompleted 
                        ? 'bg-slate-50/50 dark:bg-[#070e1b]/60 border-slate-200 dark:border-[#162744]/40 opacity-70' 
                        : note.priority === 'urgent'
                        ? 'bg-red-500/5 dark:bg-[#150a12] border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                        : note.pinned
                        ? 'bg-cyan-500/5 dark:bg-[#0a1727] border-[#00d2ff]/40 shadow-[0_0_20px_rgba(0,210,255,0.12)]'
                        : 'bg-slate-50 dark:bg-[#091322] border-slate-200 dark:border-[#162744] hover:border-[#00d2ff]/40'
                    }`}
                  >
                    <div>
                      {/* Top Badges & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {note.pinned && (
                            <span className="flex items-center gap-1 bg-[#00e5ff]/15 text-[#00e5ff] border border-[#00e5ff]/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              <Pin size={10} className="fill-current" /> Pinned
                            </span>
                          )}
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                            note.priority === 'urgent'
                              ? 'bg-red-500/15 text-red-400 border-red-500/30'
                              : note.priority === 'info'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-[#00d2ff]/10 text-[#00d2ff] border-[#00d2ff]/30'
                          }`}>
                            {note.priority}
                          </span>
                          {note.assignedTo && note.assignedTo !== 'All Staff' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#12223e] text-slate-700 dark:text-slate-300">
                              {note.assignedTo}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => togglePin(note)}
                            title={note.pinned ? "Unpin note" : "Pin note to top"}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              note.pinned ? 'text-[#00e5ff]' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Pin size={14} className={note.pinned ? 'fill-current' : ''} />
                          </button>
                          <button
                            onClick={() => openEditModal(note)}
                            title="Edit note"
                            className="p-1.5 text-slate-400 hover:text-[#00e5ff] rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteNote(note.id)}
                            title="Delete note"
                            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Checkbox */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleStatus(note)}
                          className="mt-0.5 text-slate-400 hover:text-[#00e5ff] transition-colors cursor-pointer shrink-0"
                          title={isCompleted ? "Mark as active" : "Mark as completed"}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={18} className="text-emerald-400 fill-emerald-400/20" />
                          ) : (
                            <Circle size={18} className="text-slate-400 hover:text-[#00e5ff]" />
                          )}
                        </button>
                        <h3 className={`text-base font-extrabold leading-snug ${
                          isCompleted 
                            ? 'line-through text-slate-400 dark:text-slate-500' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {note.title}
                        </h3>
                      </div>

                      {/* Body Content */}
                      {note.content && (
                        <p className={`mt-2 text-xs leading-relaxed whitespace-pre-wrap pl-7 ${
                          isCompleted ? 'text-slate-400 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300 font-medium'
                        }`}>
                          {note.content}
                        </p>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-[#162744]/70 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pl-7">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-[#00e5ff]" />
                        <span>{note.author}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} />
                        <span>{new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Note Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0a1220] rounded-[2rem] border border-slate-200 dark:border-[#162744] shadow-[0_20px_60px_rgba(0,0,0,0.8)] w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-[#162744] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#071324] border border-[#00d2ff]/40 rounded-xl flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,210,255,0.3)]">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingNote ? 'Edit Note' : 'Write New Note'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#6a8bb0] font-semibold">
                    Save staff messages and daily reminders
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-[#00d2ff]">
                  Note Title *
                </label>
                <input 
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Special cake delivery tomorrow at 8 AM"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all"
                />
              </div>

              {/* Content / Details */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-[#00d2ff]">
                  Note Details
                </label>
                <textarea 
                  rows={4}
                  placeholder="Write detailed notes or item list..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] focus:shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-all resize-none"
                />
              </div>

              {/* Priority & Assignment Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#00d2ff]">
                    Priority
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['normal', 'urgent', 'info'] as const).map(p => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          priority === p
                            ? p === 'urgent'
                              ? 'bg-red-500 text-white border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                              : p === 'info'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                              : 'smart-cyan-pill'
                            : 'bg-slate-50 dark:bg-[#050b14] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#162744]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assigned To */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#00d2ff]">
                    Assigned To
                  </label>
                  <select 
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#050b14] border border-slate-200 dark:border-[#162744] rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#00e5ff] transition-all cursor-pointer"
                  >
                    <option value="All Staff">All Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Baker">Baker</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.designation})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pin to Top Checkbox */}
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={pinned}
                    onChange={e => setPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00e5ff] accent-[#00e5ff] cursor-pointer"
                  />
                  <span>Pin this note to the top</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#162744]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="smart-cyan-pill px-8 py-3 text-xs uppercase tracking-wider cursor-pointer"
                >
                  {editingNote ? 'Save Changes' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyNotesView;
