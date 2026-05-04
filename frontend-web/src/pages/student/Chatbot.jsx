import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Send, Mic, MicOff, Trash2, FileText, Loader2,
  CloudUpload, Lock, Sparkles, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import useAuth from '../../hooks/useAuth';
import { queryRag, uploadPersonalNote } from '../../services/aiService';
import { getSubjects } from '../../services/studentService';

const DISCLAIMER = 'AI responses should be verified with your primary curriculum textbooks.';

function UserBubble({ text, timestamp }) {
  return (
    <div className="flex justify-end gap-2 items-end group">
      <div className="max-w-[68%]">
        <div className="bg-gradient-to-br from-primary-dark to-primary text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
          {text}
        </div>
        <p className="text-[10px] text-slate-400 text-right mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {timestamp}
        </p>
      </div>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
        A
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

function BotBubble({ text, citation, timestamp, loading }) {
  return (
    <div className="flex gap-2.5 items-end group">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0 shadow-sm">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="max-w-[75%]">
        {citation && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1.5 ml-1 border-l-2 border-primary/40 pl-2">
            <FileText className="w-2.5 h-2.5" />
            <span className="truncate max-w-[180px]">Source: {citation}</span>
          </div>
        )}
        <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm">
          {loading ? <TypingDots /> : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-snug">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                h1: ({ children }) => <h1 className="font-bold text-base mb-1 mt-1">{children}</h1>,
                h2: ({ children }) => <h2 className="font-semibold text-sm mb-1 mt-1">{children}</h2>,
                h3: ({ children }) => <h3 className="font-medium text-sm mb-0.5">{children}</h3>,
              }}
            >
              {text}
            </ReactMarkdown>
          )}
        </div>
        {!loading && (
          <p className="text-[10px] text-slate-400 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
}

function NoteItem({ note, onDelete }) {
  const sizeMb = note.size ? (note.size / 1048576).toFixed(1) : null;
  return (
    <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:border-primary-light hover:shadow-sm transition-all group">
      <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
        <FileText className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary-dark truncate">{note.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {note.subject && (
            <span className="text-[9px] bg-primary-light text-primary px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
              {note.subject}
            </span>
          )}
          {sizeMb && <span className="text-[9px] text-slate-400">{sizeMb} MB</span>}
        </div>
      </div>
      <button
        onClick={() => onDelete(note.id)}
        className="p-1 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function MicWave({ active }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[1, 2, 3, 2, 1].map((h, i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-red-400 animate-bounce"
          style={{
            height: `${h * 4}px`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AiTutorPage() {
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const shouldListenRef = useRef(false);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      text: "Namaste! I'm your AI Tutor. Ask me anything about your curriculum — units, lessons, topics, or concepts.",
      timestamp: formatTime(new Date()),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [notes, setNotes] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    getSubjects()
      .then((r) => setSubjects(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pushBotMessage = (text, citation = null) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'bot', text, citation, timestamp: formatTime(new Date()) },
    ]);
  };

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || sending) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', text: q, timestamp: formatTime(new Date()) };
    setMessages((prev) => [...prev, userMsg]);

    const thinkingId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: thinkingId, role: 'bot', loading: true, text: '', timestamp: '' }]);
    setSending(true);

    try {
      const selectedSubjectName = selectedSubject
        ? subjects.find((s) => String(s.subject_id) === String(selectedSubject))?.subject_name
        : undefined;

      const res = await queryRag({
        user_type: 'admin',
        query: q,
        grade: user?.grade_level ?? user?.grade_id ?? 9,
        subject: selectedSubjectName,
        student_id: user?.user_id,
      });
      const answer = res.data?.answer || res.data || 'No response received.';
      const citation = res.data?.sources?.[0] ?? null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { id: thinkingId, role: 'bot', text: answer, citation, timestamp: formatTime(new Date()) }
            : m
        )
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
      toast.error('Failed to get a response. Please try again.');
    } finally {
      setSending(false);
    }
  }, [input, sending, user, selectedSubject, subjects]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    setMessages([{
      id: 'welcome', role: 'bot',
      text: "Session cleared. How can I help you?",
      timestamp: formatTime(new Date()),
    }]);
    setSessionActive(false);
    setTimeout(() => setSessionActive(true), 500);
  };

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setIsListening(true); setVoiceError(''); };

    recognition.onend = () => {
      // Restart automatically if the user hasn't clicked Stop
      if (shouldListenRef.current) {
        try { recognition.start(); } catch { /* already restarting */ }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') return; // silent: just keep going
      if (e.error === 'aborted') return;   // user clicked stop
      shouldListenRef.current = false;
      setIsListening(false);
      setVoiceError('Microphone error — check browser permissions.');
      setTimeout(() => setVoiceError(''), 4000);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const handleVoiceInput = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input requires Chrome or Edge.');
      setTimeout(() => setVoiceError(''), 4000);
      return;
    }

    if (isListening) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      shouldListenRef.current = true;
      startRecognition();
    }
  }, [isListening, startRecognition]);

  const processFile = useCallback(async (file) => {
    if (file.size > 50 * 1024 * 1024) { toast.error('File must be under 50 MB'); return; }
    setUploading(true);
    try {
      const subject = subjects.find((s) => String(s.subject_id) === String(selectedSubject));
      await uploadPersonalNote(file, { student_id: user?.user_id, subject: subject?.subject_name });
      setNotes((prev) => [{
        id: Date.now(), name: file.name, size: file.size,
        subject: subject?.subject_name,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      }, ...prev]);
      pushBotMessage(
        `Your notes from **"${file.name}"** have been indexed. You can now ask me questions from this document.`,
        file.name
      );
    } catch {
      toast.error('Upload failed — please try again.');
    } finally {
      setUploading(false);
    }
  }, [subjects, selectedSubject, user]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  const handleDeleteNote = (id) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const usedMb = notes.reduce((acc, n) => acc + (n.size || 819200), 0) / 1048576;
  const totalMb = 1024;
  const selectedSubjectName = selectedSubject
    ? subjects.find((s) => String(s.subject_id) === String(selectedSubject))?.subject_name
    : null;

  return (
    <div className="flex gap-4 h-[calc(100vh-9rem)]">

      {/* ── Chat panel ── */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm tracking-tight">Curriculum AI Tutor</p>
              <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${sessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                {sessionActive ? 'Always Available' : 'Starting…'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Subject pill selector */}
            {subjects.length > 0 && (
              <div className="relative">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="appearance-none text-xs bg-slate-100 hover:bg-slate-200 border-0 rounded-lg pl-3 pr-7 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-colors"
                >
                  <option value="">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {selectedSubjectName && (
              <span className="text-[10px] bg-primary-light text-primary px-2 py-1 rounded-lg font-semibold uppercase tracking-wide">
                {selectedSubjectName}
              </span>
            )}
            <button
              onClick={handleClearHistory}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium px-1"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
          style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <UserBubble key={msg.id} text={msg.text} timestamp={msg.timestamp} />
            ) : (
              <BotBubble
                key={msg.id}
                text={msg.text}
                citation={msg.citation}
                timestamp={msg.timestamp}
                loading={msg.loading}
              />
            )
          )}
          <div ref={bottomRef} />
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-slate-300 px-4 py-1.5 border-t border-slate-50">
          {DISCLAIMER}
        </p>

        {/* Input area */}
        <div className="px-4 pb-4 space-y-2">

          {/* Listening banner */}
          {(isListening || voiceError) && (
            <div className={`flex items-center gap-2.5 text-xs px-3.5 py-2 rounded-xl border ${
              voiceError
                ? 'bg-red-50 border-red-100 text-red-500'
                : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100 text-slate-600'
            }`}>
              {isListening && <MicWave active />}
              <span className="font-medium">
                {voiceError || 'Listening — speak naturally. Click mic to stop.'}
              </span>
              {isListening && (
                <button
                  onClick={handleVoiceInput}
                  className="ml-auto text-[11px] text-red-400 hover:text-red-600 font-semibold transition-colors"
                >
                  Stop
                </button>
              )}
            </div>
          )}

          {/* Input row */}
          <div className={`flex items-end gap-2 bg-slate-50 border rounded-2xl px-3 py-2.5 transition-all ${
            isListening
              ? 'border-red-200 bg-red-50/30 shadow-sm shadow-red-100'
              : 'border-slate-200 focus-within:border-primary/40 focus-within:shadow-sm'
          }`}>
            {/* Mic button */}
            <button
              onClick={handleVoiceInput}
              className={`p-2 rounded-xl transition-all shrink-0 ${
                isListening
                  ? 'bg-red-100 text-red-500 hover:bg-red-200'
                  : 'text-slate-400 hover:text-primary hover:bg-primary-light'
              }`}
              title={isListening ? 'Click to stop' : 'Click to speak'}
            >
              {isListening
                ? <MicOff className="w-4 h-4" />
                : <Mic className="w-4 h-4" />}
            </button>

            {/* Textarea */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isListening ? 'Listening…' : 'Ask anything about your curriculum…'}
              className="flex-1 bg-transparent text-sm text-slate-700 resize-none focus:outline-none placeholder-slate-400 max-h-28 py-0.5"
              style={{ height: 'auto' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-dark to-primary text-white flex items-center justify-center hover:opacity-90 disabled:opacity-30 transition-all shrink-0 shadow-sm"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Notes sidebar ── */}
      <div className="w-72 flex flex-col">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">

          {/* Sidebar header */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">My Notes</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Manage your context library</p>
              </div>
              <span className="text-[10px] bg-primary-light text-primary px-2 py-0.5 rounded-lg font-bold">
                {notes.length}/{Math.floor(totalMb / 10)}
              </span>
            </div>
          </div>

          {/* Drag & drop zone */}
          <div
            className={`mx-3 mt-3 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none ${
              isDragging
                ? 'border-primary bg-primary-light/40 scale-[0.99]'
                : 'border-slate-200 hover:border-primary/60 hover:bg-slate-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center py-5 px-3 text-center pointer-events-none">
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                  <p className="text-xs font-medium text-primary">Indexing…</p>
                </>
              ) : (
                <>
                  <CloudUpload className={`w-7 h-7 mb-2 transition-colors ${isDragging ? 'text-primary' : 'text-slate-300'}`} />
                  <p className="text-xs font-semibold text-slate-600">
                    {isDragging ? 'Drop to upload' : 'Upload Personal Note'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">PDF · DOCX · TXT · max 50 MB</p>
                </>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />

          {/* Privacy guarantee */}
          <div className="mx-3 mt-2.5 flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <Lock className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-emerald-700">Privacy Guarantee</p>
              <p className="text-[10px] text-emerald-600 leading-snug mt-0.5">
                Your notes are stored privately in your namespace. This data is only accessible to you and your AI session.
              </p>
            </div>
          </div>

          {/* Note list */}
          <div className="flex-1 overflow-y-auto px-3 pt-3 pb-1 space-y-2">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-slate-200" />
                </div>
                <p className="text-xs text-slate-400 font-medium">No notes yet</p>
                <p className="text-[10px] text-slate-300 mt-1 max-w-[160px]">
                  Upload a PDF or DOCX to give the AI context from your own notes.
                </p>
              </div>
            ) : (
              notes.map((note) => (
                <NoteItem key={note.id} note={note} onDelete={handleDeleteNote} />
              ))
            )}
          </div>

          {/* Storage bar */}
          <div className="px-3 pb-3 mt-1">
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                <span className="font-medium">Storage</span>
                <span className={usedMb > totalMb * 0.8 ? 'text-amber-500 font-semibold' : ''}>
                  {usedMb.toFixed(1)} MB / {totalMb} MB
                </span>
              </div>
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedMb > totalMb * 0.8 ? 'bg-amber-400' : 'bg-gradient-to-r from-primary to-primary-dark'
                  }`}
                  style={{ width: `${Math.min((usedMb / totalMb) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
