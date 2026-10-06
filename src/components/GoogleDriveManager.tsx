import { useState, useEffect, useRef, Fragment } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from '../auth';
import { GoogleDriveService, DriveFile, DriveQuota } from '../services/googleDrive';

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function GoogleDriveManager() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Drive Data State
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [quota, setQuota] = useState<DriveQuota | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('ALL');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' }
  ]);
  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  // Selected file for preview / inspector
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Destructive Confirmation Modal (MANDATORY per skill instructions)
  const [deleteTarget, setDeleteTarget] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setIsLoadingAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (token) {
      loadDriveData(token, currentFolderId === 'root' ? undefined : currentFolderId);
      loadQuota(token);
    }
  }, [token, currentFolderId, fileTypeFilter]);

  const loadQuota = async (accessToken: string) => {
    try {
      const q = await GoogleDriveService.getAbout(accessToken);
      setQuota(q);
    } catch (e: any) {
      console.warn('Quota load failed:', e.message);
    }
  };

  const loadDriveData = async (accessToken: string, folderId?: string, query?: string) => {
    setIsLoadingFiles(true);
    try {
      const res = await GoogleDriveService.listFiles(accessToken, {
        folderId,
        searchQuery: query !== undefined ? query : searchQuery,
        fileTypeFilter,
        pageSize: 100,
      });
      setFiles(res.files);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch files from Google Drive.', 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        showToast('Connected to Google Drive successfully.', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Google sign-in cancelled or failed.', 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setFiles([]);
    setQuota(null);
    setSelectedFile(null);
    showToast('Signed out of Google account.', 'info');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    loadDriveData(token, currentFolderId === 'root' ? undefined : currentFolderId, searchQuery);
  };

  const handleFolderClick = (folder: DriveFile) => {
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
    setSelectedFile(null);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newCrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newCrumbs);
    setSelectedFile(null);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const parentId = currentFolderId === 'root' ? undefined : currentFolderId;
      const created = await GoogleDriveService.createFolder(token, newFolderName, parentId);
      showToast(`Folder "${created.name}" created.`, 'success');
      setIsNewFolderOpen(false);
      setNewFolderName('');
      loadDriveData(token, parentId);
    } catch (err: any) {
      showToast(err.message || 'Failed to create folder.', 'error');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!token || !selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    const parentId = currentFolderId === 'root' ? undefined : currentFolderId;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${selectedFiles.length})...`);
        await GoogleDriveService.uploadFile(token, file, parentId);
      }
      showToast(`Uploaded ${selectedFiles.length} file(s) to Google Drive.`, 'success');
      loadDriveData(token, parentId);
      loadQuota(token);
    } catch (err: any) {
      showToast(err.message || 'File upload failed.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await GoogleDriveService.deleteFile(token, deleteTarget.id);
      showToast(`"${deleteTarget.name}" deleted from Google Drive.`, 'success');
      setFiles(files.filter(f => f.id !== deleteTarget.id));
      if (selectedFile?.id === deleteTarget.id) setSelectedFile(null);
      setDeleteTarget(null);
      loadQuota(token);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete file.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStar = async (file: DriveFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const newStatus = await GoogleDriveService.toggleStar(token, file.id, !!file.starred);
      setFiles(files.map(f => f.id === file.id ? { ...f, starred: newStatus } : f));
      if (selectedFile?.id === file.id) {
        setSelectedFile({ ...selectedFile, starred: newStatus });
      }
    } catch (err: any) {
      showToast('Could not update star status.', 'error');
    }
  };

  const formatBytes = (bytes?: string | number) => {
    if (!bytes) return '—';
    const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(num) || num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return { icon: '📁', color: '#3B82F6', label: 'Folder' };
    if (mimeType === 'application/pdf') return { icon: '📕', color: '#EF4444', label: 'PDF' };
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return { icon: '📊', color: '#10B981', label: 'Sheet' };
    if (mimeType.includes('document') || mimeType.includes('word')) return { icon: '📘', color: '#2563EB', label: 'Doc' };
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return { icon: '📙', color: '#F59E0B', label: 'Slides' };
    if (mimeType.includes('image/')) return { icon: '🖼️', color: '#8B5CF6', label: 'Image' };
    if (mimeType.includes('video/')) return { icon: '🎬', color: '#EC4899', label: 'Video' };
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return { icon: '📦', color: '#6B7280', label: 'Archive' };
    return { icon: '📄', color: '#64748B', label: 'File' };
  };

  if (isLoadingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748B', fontSize: '13px' }}>Verifying Google Drive authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC', color: '#0F172A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '55px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: toast.type === 'error' ? '#EF4444' : toast.type === 'success' ? '#10B981' : '#0EA5E9',
          color: '#FFFFFF',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{toast.type === 'error' ? '✕' : toast.type === 'success' ? '✓' : 'ℹ'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        padding: '0.875rem 1.5rem',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            backgroundColor: '#EFF6FF',
            color: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            📁
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Google Drive Live Workspace</h2>
              <span style={{ backgroundColor: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                API v3 Connected
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
              Direct browser integration with OAuth 2.0 token caching &amp; scoped Drive access
            </p>
          </div>
        </div>

        {/* Auth status & user badge */}
        <div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {quota && (
                <div style={{ textAlign: 'right', display: 'none', md: 'block' } as any}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                    {formatBytes(quota.usage)} of {formatBytes(quota.limit)} used
                  </div>
                  <div style={{ width: '120px', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden', marginTop: '3px' }}>
                    <div style={{
                      height: '100%',
                      backgroundColor: '#2563EB',
                      width: quota.limit && quota.usage ? `${Math.min(100, (parseInt(quota.usage, 10) / parseInt(quota.limit, 10)) * 100)}%` : '0%'
                    }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', backgroundColor: '#F1F5F9', borderRadius: '20px' }}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} style={{ width: '26px', height: '26px', borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#2563EB', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                    {(user.displayName || user.email || 'G')[0].toUpperCase()}
                  </div>
                )}
                <div style={{ fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>{user.displayName || 'Google User'}</div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>{user.email}</div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #747775',
                borderRadius: '4px',
                color: '#1F1F1F',
                fontSize: '14px',
                fontWeight: 500,
                cursor: isSigningIn ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Drive Viewport */}
      {!user ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: '480px', width: '100%', backgroundColor: '#FFFFFF', padding: '2.5rem', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              🔒
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 0.5rem' }}>Connect Your Google Drive</h3>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
              Connect your Google Workspace or personal Google Drive account to search, upload, organize, and inspect your enterprise documents directly in this application.
            </p>
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '10px 18px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #747775',
                borderRadius: '6px',
                color: '#1F1F1F',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isSigningIn ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>{isSigningIn ? 'Opening OAuth Consent...' : 'Sign in with Google to Access Drive'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main List Section */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem 1.5rem' }}>
            {/* Control Bar: Search + Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#94A3B8', fontSize: '13px' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search files or contents in Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '34px',
                    paddingLeft: '32px',
                    paddingRight: '30px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      if (token) loadDriveData(token, currentFolderId === 'root' ? undefined : currentFolderId, '');
                    }}
                    style={{ position: 'absolute', right: '8px', top: '7px', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✕
                  </button>
                )}
              </form>

              {/* Type Filter */}
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                style={{ height: '34px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
              >
                <option value="ALL">All File Types</option>
                <option value="FOLDER">Folders Only</option>
                <option value="PDF">PDF Documents</option>
                <option value="DOCUMENT">Google Docs / Word</option>
                <option value="SPREADSHEET">Google Sheets / Excel</option>
                <option value="PRESENTATION">Google Slides</option>
                <option value="IMAGE">Images</option>
              </select>

              {/* Action Buttons */}
              <button
                onClick={() => setIsNewFolderOpen(true)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>📁+</span>
                <span>New Folder</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  backgroundColor: '#2563EB',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>⬆️</span>
                <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Breadcrumb Navigation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#FFFFFF',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              marginBottom: '0.75rem',
              fontSize: '12px',
              overflowX: 'auto'
            }}>
              <span style={{ color: '#94A3B8' }}>Drive Location:</span>
              {breadcrumbs.map((crumb, idx) => (
                <Fragment key={crumb.id}>
                  {idx > 0 && <span style={{ color: '#CBD5E1' }}>/</span>}
                  <button
                    onClick={() => handleBreadcrumbClick(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: idx === breadcrumbs.length - 1 ? '#0F172A' : '#2563EB',
                      fontWeight: idx === breadcrumbs.length - 1 ? 700 : 500,
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '12px'
                    }}
                  >
                    {crumb.name}
                  </button>
                </Fragment>
              ))}
            </div>

            {uploadProgress && (
              <div style={{ padding: '8px 12px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', fontSize: '12px', color: '#1D4ED8', marginBottom: '0.75rem' }}>
                ⏳ {uploadProgress}
              </div>
            )}

            {/* Files Table / Grid */}
            <div style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
              {isLoadingFiles ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                  <p style={{ color: '#64748B', fontSize: '13px' }}>Loading Google Drive items...</p>
                </div>
              ) : files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <div style={{ fontSize: '36px', marginBottom: '0.75rem' }}>📂</div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', margin: '0 0 0.25rem' }}>Folder is empty</h4>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 1rem' }}>
                    Upload documents or create subfolders to organize your repository.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: '6px 14px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Upload Files
                  </button>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '10px 16px', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Size</th>
                      <th style={{ padding: '10px 12px', fontWeight: 600 }}>Last Modified</th>
                      <th style={{ padding: '10px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(file => {
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      const iconMeta = getFileIcon(file.mimeType);
                      const isSelected = selectedFile?.id === file.id;

                      return (
                        <tr
                          key={file.id}
                          onClick={() => setSelectedFile(file)}
                          onDoubleClick={() => isFolder ? handleFolderClick(file) : window.open(file.webViewLink, '_blank')}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '16px' }}>{iconMeta.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                                {file.name}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>
                            <span style={{ backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                              {iconMeta.label}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>
                            {isFolder ? '—' : formatBytes(file.size)}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>
                            {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={(e) => handleToggleStar(file, e)}
                              title={file.starred ? 'Starred' : 'Not starred'}
                              style={{ background: 'none', border: 'none', color: file.starred ? '#F59E0B' : '#CBD5E1', fontSize: '14px', cursor: 'pointer', marginRight: '6px' }}
                            >
                              ★
                            </button>
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: '#2563EB', textDecoration: 'none', marginRight: '8px', fontSize: '11px', fontWeight: 600 }}
                              >
                                View ↗
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(file);
                              }}
                              title="Delete file"
                              style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer' }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Details Drawer */}
          {selectedFile && (
            <aside style={{ width: '320px', backgroundColor: '#FFFFFF', borderLeft: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Item Dossier</span>
                <button
                  onClick={() => setSelectedFile(null)}
                  style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '42px', marginBottom: '0.5rem' }}>
                  {getFileIcon(selectedFile.mimeType).icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', wordBreak: 'break-word' }}>
                  {selectedFile.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  {getFileIcon(selectedFile.mimeType).label}
                </div>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '0.875rem', borderRadius: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>File ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#334155', wordBreak: 'break-all' }}>{selectedFile.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>MIME Type</div>
                  <div style={{ fontSize: '11px', color: '#334155' }}>{selectedFile.mimeType}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Size</div>
                  <div style={{ fontSize: '11px', color: '#334155' }}>{formatBytes(selectedFile.size)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Created Date</div>
                  <div style={{ fontSize: '11px', color: '#334155' }}>
                    {selectedFile.createdTime ? new Date(selectedFile.createdTime).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Modified Date</div>
                  <div style={{ fontSize: '11px', color: '#334155' }}>
                    {selectedFile.modifiedTime ? new Date(selectedFile.modifiedTime).toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                {selectedFile.webViewLink && (
                  <a
                    href={selectedFile.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    Open in Google Drive ↗
                  </a>
                )}
                {selectedFile.webContentLink && (
                  <a
                    href={selectedFile.webContentLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      color: '#334155',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    Download File ⬇
                  </a>
                )}
                <button
                  onClick={() => setDeleteTarget(selectedFile)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#FFF1F2',
                    border: '1px solid #FECDD3',
                    color: '#EF4444',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Delete from Drive 🗑️
                </button>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {isNewFolderOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', width: '100%', maxWidth: '380px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 0.5rem' }}>Create New Folder</h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 1rem' }}>
              Add a directory in <strong>{breadcrumbs[breadcrumbs.length - 1].name}</strong>
            </p>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                autoFocus
                placeholder="Folder title (e.g. Q4 Contracts)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
                style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '1.25rem', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  style={{ padding: '6px 12px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  style={{ padding: '6px 14px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: isCreatingFolder ? 'not-allowed' : 'pointer' }}
                >
                  {isCreatingFolder ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANDATORY CONFIRMATION DIALOG FOR MUTATION / DESTRUCTION */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', width: '100%', maxWidth: '420px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                ⚠️
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#991B1B' }}>Confirm File Deletion</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 1rem' }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> from Google Drive?
            </p>
            <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '11px', color: '#B91C1C', marginBottom: '1.25rem' }}>
              This will remove the file from your Google Drive account. This operation mutates your cloud storage.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '8px 14px', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{ padding: '8px 16px', backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
