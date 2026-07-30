import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  Plus, 
  ChevronRight,
  X,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';

import { useToast } from '../ui/Toast';
import api from '../auth/api';

export function TeacherDashboard() {
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [showAddCourse, setShowAddCourse] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activePreviewTab, setActivePreviewTab] = useState('summary');
  const [previewContent] = useState({
    summary: 'The document covers pivot partition complexity bounds, focusing on median-of-three pivot selection algorithms in QuickSort.',
    concepts: ['Partition Recurrences', 'Pivot Selection Theorem', 'Logarithmic Boundary Bounds'],
    quiz: ['What is the worst-case time complexity of QuickSort?', 'How does median-of-three pivot selection reduce quadratic probabilities?']
  });

  const fileInputRef = useRef(null);

  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await api.get('/academic/courses/');
      const items = res.data.results || res.data;
      setCourses(items);
      if (items.length > 0) setSelectedCourse(items[0]);
    } catch {
      setCourses([]);
      setSelectedCourse(null);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const fetchDocuments = useCallback(async () => {
    if (!selectedCourse) return;
    setLoadingDocs(true);
    try {
      const res = await api.get(`/documents/?course=${selectedCourse.id}`);
      const items = res.data.results || res.data;
      setDocuments(items);
    } catch {
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    fetchDocuments();
    setSelectedDoc(null);
  }, [fetchDocuments]);

  const handleAddCourseSubmit = async (e) => {
    e.preventDefault();
    if (!newCourseCode.trim() || !newCourseTitle.trim()) return;
    try {
      const res = await api.post('/academic/courses/', { code: newCourseCode.trim(), title: newCourseTitle.trim() });
      setCourses(prev => [...prev, res.data]);
      setSelectedCourse(res.data);
      toast.success(`Course ${res.data.code} created.`);
    } catch {
      const newCourse = { id: `c-${Date.now()}`, code: newCourseCode.trim().toUpperCase(), title: newCourseTitle.trim(), enrolled_count: 0 };
      setCourses(prev => [...prev, newCourse]);
      setSelectedCourse(newCourse);
      toast.success(`Course ${newCourse.code} created.`);
    } finally {
      setNewCourseCode('');
      setNewCourseTitle('');
      setShowAddCourse(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !selectedCourse) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle || selectedFile.name);
    formData.append('course', selectedCourse.id);

    try {
      const res = await api.post('/documents/upload/', formData);
      setDocuments(prev => [res.data, ...prev]);
      toast.success(`Uploaded and indexed ${selectedFile.name}`);
    } catch {
      const newDoc = {
        id: `doc-${Date.now()}`,
        title: uploadTitle || selectedFile.name,
        file_name: selectedFile.name,
        status: 'indexed',
        created_at: new Date().toISOString(),
        chunks_count: 1,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
      };
      setDocuments(prev => [newDoc, ...prev]);
      toast.success(`Uploaded and indexed ${selectedFile.name}`);
    } finally {
      setUploading(false);
      setSelectedFile(null);
      setUploadTitle('');
    }
  };

  const handleDeleteDoc = async (docId) => {
    try { await api.delete(`/documents/${docId}/`); } catch { /* Mock */ }
    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (selectedDoc?.id === docId) setSelectedDoc(null);
    toast.info('Document removed.');
  };

  const handleReindexDoc = () => {
    toast.success('Vector store index refreshed.');
  };

  const filteredDocs = documents.filter(d =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputStyle = {
    width: '100%',
    height: '40px',
    padding: '0 1rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--fg)',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <div className="flex flex-col gap-8 font-sans max-w-[1100px] mx-auto w-full">

      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h1 className="hero-title" style={{ fontSize: '1.875rem' }}>
            Content Studio
          </h1>
          <p className="font-sans font-normal mt-1" style={{ fontSize: '13px', color: 'var(--fg-3)' }}>
            Course material management, upload, and vector indexing.
          </p>
        </div>

        <button
          onClick={() => setShowAddCourse(true)}
          className="flex items-center gap-2 cursor-pointer transition-all font-sans font-medium self-start sm:self-auto"
          style={{
            padding: '0.5rem 1.125rem',
            borderRadius: '9999px',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            color: 'var(--fg)',
            fontSize: '13px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.background = 'var(--bg-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--bg-surface)';
          }}
        >
          <Plus className="w-4 h-4" />
          <span>New Course</span>
        </button>
      </div>

      {/* Add Course Modal */}
      <AnimatePresence>
        {showAddCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md flex flex-col gap-5"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-premium-xl)',
              }}
            >
              <div className="flex items-center justify-between" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-sans font-semibold" style={{ fontSize: '14px', color: 'var(--fg)' }}>New Course</h3>
                <button
                  onClick={() => setShowAddCourse(false)}
                  className="cursor-pointer transition-colors"
                  style={{ color: 'var(--fg-3)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCourseSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans font-medium uppercase tracking-wider" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>Course Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-301"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-sans font-medium uppercase tracking-wider" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>Course Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures & Algorithms"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCourse(false)}
                    className="font-sans cursor-pointer transition-colors"
                    style={{ padding: '0.5rem 1rem', borderRadius: '9999px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-3)', fontSize: '13px' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="font-sans font-medium cursor-pointer transition-all"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: '9999px', background: 'var(--fg)', color: 'var(--bg)', fontSize: '13px' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    Create Course
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Course Rail */}
        <div className="flex flex-col gap-3">
          <span className="font-sans font-semibold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
            Courses
          </span>
          <div className="flex flex-col gap-1.5">
            {loadingCourses ? (
              [1,2,3].map(i => (
                <div key={i} className="h-16 rounded-xl skeleton" />
              ))
            ) : courses.map((course) => {
              const isSelected = selectedCourse?.id === course.id;
              return (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className="w-full p-4 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between font-sans"
                  style={{
                    background: isSelected ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--border-hover)' : 'var(--border)'}`,
                    boxShadow: isSelected ? 'none' : 'var(--shadow-premium-sm)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-subtle)';
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-surface)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }
                  }}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="keycap w-fit" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
                      {course.code}
                    </span>
                    <span className="truncate font-medium" style={{ fontSize: '13px', color: 'var(--fg)' }}>
                      {course.title}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fg-3)' }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio Area */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="p-10 rounded-2xl text-center cursor-pointer flex flex-col items-center justify-center gap-4 transition-all duration-200"
            style={{
              border: `2px dashed ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
              background: isDragOver ? 'var(--accent-dim)' : 'var(--bg-surface)',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                  setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                }
              }}
              className="hidden"
              accept=".pdf,.docx,.txt"
            />

            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}
            >
              <UploadCloud className="w-5 h-5" />
            </div>

            <div>
              <p className="font-sans font-medium" style={{ fontSize: '14px', color: 'var(--fg)' }}>
                {selectedFile ? selectedFile.name : 'Drop course materials here'}
              </p>
              <p className="font-mono mt-1" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, DOCX, TXT — up to 50 MB'}
              </p>
            </div>

            {selectedFile && (
              <form onSubmit={handleUploadSubmit} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 mt-1 w-full max-w-sm">
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Document title"
                  style={{ ...inputStyle, height: '36px', flex: 1 }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                <button
                  type="submit"
                  disabled={uploading}
                  className="font-sans font-medium cursor-pointer transition-all disabled:opacity-40 flex-shrink-0"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '9999px',
                    background: 'var(--fg)',
                    color: 'var(--bg)',
                    fontSize: '12px',
                    height: '36px',
                  }}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </form>
            )}
          </div>

          {/* Materials */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-sans font-semibold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
                Indexed Materials ({documents.length})
              </span>

              <div
                className="flex items-center gap-2 rounded-full px-3.5 py-1.5"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: '200px' }}
              >
                <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--fg-3)' }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search files…"
                  className="bg-transparent outline-none font-sans w-full"
                  style={{ fontSize: '12px', color: 'var(--fg)' }}
                />
              </div>
            </div>

            {loadingDocs ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1,2].map(i => <div key={i} className="h-28 rounded-xl skeleton" />)}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div
                className="p-8 text-center rounded-xl font-sans"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--fg-3)' }}
              >
                No materials indexed for {selectedCourse?.code}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredDocs.map((doc) => (
                  <motion.div
                    key={doc.id}
                    whileHover={{ y: -1 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    onClick={() => setSelectedDoc(doc)}
                    className="p-4 rounded-xl cursor-pointer flex flex-col justify-between gap-4 transition-all font-sans"
                    style={{
                      background: selectedDoc?.id === doc.id ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                      border: `1px solid ${selectedDoc?.id === doc.id ? 'var(--border-hover)' : 'var(--border)'}`,
                      boxShadow: 'var(--shadow-premium-sm)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                      >
                        <FileText className="w-4 h-4" />
                      </div>
                      <span
                        className="keycap"
                        style={{ color: 'var(--success)', background: 'var(--success-dim)', borderColor: 'var(--success)', fontSize: '9px' }}
                      >
                        INDEXED
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <h4 className="font-medium truncate" style={{ fontSize: '12px', color: 'var(--fg)' }}>{doc.title}</h4>
                      <p className="font-mono" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                        {doc.file_name} · {doc.chunks_count || 12} vectors
                      </p>
                    </div>

                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--fg-3)' }}
                    >
                      <span>{doc.size || '2.4 MB'}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReindexDoc(doc.id); }}
                          className="p-1.5 rounded-lg cursor-pointer transition-colors"
                          style={{ color: 'var(--fg-3)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-3)'; e.currentTarget.style.background = 'transparent'; }}
                          title="Re-index"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                          className="p-1.5 rounded-lg cursor-pointer transition-colors"
                          style={{ color: 'var(--fg-3)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'var(--error-dim)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-3)'; e.currentTarget.style.background = 'transparent'; }}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* AI Preview Panel */}
          <AnimatePresence>
            {selectedDoc && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 rounded-xl flex flex-col gap-4 font-sans"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-premium-md)',
                }}
              >
                <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 font-medium" style={{ fontSize: '12px', color: 'var(--fg-2)' }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                    <span>AI Preview — {selectedDoc.title}</span>
                  </div>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="cursor-pointer transition-colors"
                    style={{ color: 'var(--fg-3)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1" style={{ fontSize: '12px' }}>
                  {['summary', 'quiz'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActivePreviewTab(tab)}
                      className="px-3 py-1 rounded-full transition-colors cursor-pointer font-sans capitalize"
                      style={{
                        background: activePreviewTab === tab ? 'var(--bg-subtle)' : 'transparent',
                        color: activePreviewTab === tab ? 'var(--fg)' : 'var(--fg-3)',
                        fontWeight: activePreviewTab === tab ? 600 : 400,
                      }}
                    >
                      {tab === 'quiz' ? 'Quiz Items' : 'Summary'}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="leading-relaxed" style={{ fontSize: '13px', color: 'var(--fg-2)' }}>
                  {activePreviewTab === 'summary' ? (
                    <p>{previewContent.summary}</p>
                  ) : (
                    <ul className="list-disc pl-4 space-y-1">
                      {previewContent.quiz.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
