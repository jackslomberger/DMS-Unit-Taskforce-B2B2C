/**
 * ============================================================================
 * ENTERPRISE DOCUMENT MANAGEMENT SYSTEM (DMS)
 * Backend Core: Google Apps Script V8 Engine
 * Phase 11: Production Readiness, Automated Triggers, Manifest, & Deployment
 * ============================================================================
 */

// ============================================================================
// SECTION 00: GLOBAL CONSTANTS & SYSTEM CONFIGURATION
// ============================================================================

const DMS_CONFIG = {
  APP_NAME: 'Document Management System',
  APP_VERSION: '1.11.0-production',
  DEFAULT_ROOT_FOLDER_NAME: 'DMS_ROOT_REPOSITORY',
  DEFAULT_SESSION_TIMEOUT_MINUTES: 60,
  DEFAULT_TRASH_RETENTION_DAYS: 30,
  DEFAULT_MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  LOCK_TIMEOUT_MS: 30000,
  HASH_ITERATIONS: 1000,
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024,
  PEPPER_DEFAULT: 'DMS_SEC_SALT_v1_2026_ENTERPRISE'
};

const SHEETS = {
  CONFIG: 'CONFIG',
  USERS: 'USERS',
  SESSIONS: 'SESSIONS',
  PROJECTS: 'PROJECTS',
  DOCUMENTS: 'DOCUMENTS',
  FAVORITES: 'FAVORITES',
  RECENTS: 'RECENTS',
  ACTIVITY_LOG: 'ACTIVITY_LOG'
};

const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  USER: 'USER'
};

const USER_STATUSES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
};

const PROJECT_STATUSES = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
};

const DOCUMENT_STATUSES = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED'
};

const CLASSIFICATIONS = {
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED: 'RESTRICTED'
};

const STANDARD_CATEGORIES = [
  { code: '01_PKS', name: '01_PKS', label: '01. PKS (Perjanjian Kerja Sama)' },
  { code: '02_NDA', name: '02_NDA', label: '02. NDA (Non-Disclosure Agreement)' },
  { code: '03_MOU', name: '03_MOU', label: '03. MoU (Memorandum of Understanding)' },
  { code: '04_BAK', name: '04_BAK', label: '04. BAK (Berita Acara Kesepakatan)' },
  { code: '05_POLIS_INDUK', name: '05_POLIS_INDUK', label: '05. Polis Induk' },
  { code: '06_QS_SLIP', name: '06_QS_SLIP', label: '06. QS Slip' },
  { code: '07_KAJIAN_MANAJEMEN_RISIKO', name: '07_KAJIAN_MANAJEMEN_RISIKO', label: '07. Kajian Manajemen Risiko' },
  { code: '08_MEMO', name: '08_MEMO', label: '08. Memo Internal' },
  { code: '09_SURAT', name: '09_SURAT', label: '09. Surat Masuk & Keluar' },
  { code: '10_KAJIAN_BISNIS', name: '10_KAJIAN_BISNIS', label: '10. Kajian Bisnis' },
  { code: '11_TECHNICAL_OPERATION', name: '11_TECHNICAL_OPERATION', label: '11. Technical Operation' },
  { code: '12_GUIDE_BOOK', name: '12_GUIDE_BOOK', label: '12. Guide Book & SOP' },
  { code: '13_KORESPONDENSI_EMAIL', name: '13_KORESPONDENSI_EMAIL', label: '13. Korespondensi E-Mail' },
  { code: '14_DOKUMEN_LEGALITAS', name: '14_DOKUMEN_LEGALITAS', label: '14. Dokumen Legalitas' }
];

const TABLE_SCHEMAS = {
  [SHEETS.CONFIG]: ['configKey', 'configValue', 'description', 'updatedAt'],
  [SHEETS.USERS]: ['userId', 'email', 'fullName', 'role', 'passwordHash', 'status', 'mustChangePassword', 'failedLoginCount', 'lockedUntil', 'createdAt', 'lastLoginAt'],
  [SHEETS.SESSIONS]: ['sessionId', 'userId', 'tokenHash', 'createdAt', 'lastActivityAt', 'expiresAt', 'userAgent', 'isValid'],
  [SHEETS.PROJECTS]: ['projectId', 'projectCode', 'projectName', 'partner', 'description', 'pic', 'startDate', 'endDate', 'status', 'tags', 'driveFolderId', 'createdBy', 'createdAt', 'updatedAt', 'isArchived'],
  [SHEETS.DOCUMENTS]: ['documentId', 'projectId', 'driveFileId', 'documentName', 'category', 'description', 'documentDate', 'effectiveDate', 'expiryDate', 'status', 'classification', 'fileType', 'mimeType', 'fileSize', 'tags', 'uploadedBy', 'uploadedAt', 'lastModifiedAt', 'isDeleted', 'deletedAt', 'deletedBy'],
  [SHEETS.FAVORITES]: ['favoriteId', 'userId', 'documentId', 'createdAt'],
  [SHEETS.RECENTS]: ['recentId', 'userId', 'documentId', 'lastOpenedAt'],
  [SHEETS.ACTIVITY_LOG]: ['activityId', 'timestamp', 'userId', 'userEmail', 'userName', 'role', 'sessionId', 'action', 'projectId', 'documentId', 'targetType', 'targetName', 'details', 'userAgent', 'clientIp', 'status', 'errorCode']
};

// ============================================================================
// SECTION 01: SECURITY, SANITIZATION & CRYPTOGRAPHIC UTILITIES
// ============================================================================

function sanitizeFormula(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return str;
}

function generateId(prefix) {
  const ts = new Date().getTime().toString(16).toUpperCase();
  const rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    ts + Math.random().toString() + Utilities.getUuid()
  );
  const randomHex = rawBytes.slice(0, 4).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${prefix}-${ts.slice(-6)}${randomHex}`;
}

function generateSalt() {
  const uuid = Utilities.getUuid();
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, uuid + new Date().toISOString() + Math.random());
  return Utilities.base64EncodeWebSafe(raw).slice(0, 32);
}

function hashPassword(password, salt) {
  const pepper = getPepperSecret();
  let currentDigest = salt + '::' + password + '::' + pepper;
  for (let i = 0; i < DMS_CONFIG.HASH_ITERATIONS; i++) {
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, currentDigest);
    currentDigest = Utilities.base64EncodeWebSafe(raw);
  }
  return `${salt}$${currentDigest}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes('$')) return false;
  const parts = storedHash.split('$');
  const salt = parts[0];
  const expectedDigest = parts[1];
  const calculated = hashPassword(password, salt).split('$')[1];
  return constantTimeCompare(calculated, expectedDigest);
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length && i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getPepperSecret() {
  const props = PropertiesService.getScriptProperties();
  let pepper = props.getProperty('DMS_PEPPER_SECRET');
  if (!pepper) {
    pepper = DMS_CONFIG.PEPPER_DEFAULT;
    props.setProperty('DMS_PEPPER_SECRET', pepper);
  }
  return pepper;
}

function hashSessionToken(token) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  return Utilities.base64EncodeWebSafe(raw);
}

function generateSessionToken(userId) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, userId + '::' + new Date().toISOString() + '::' + Utilities.getUuid() + '::' + Math.random());
  return 'DMS_SES_' + Utilities.base64EncodeWebSafe(raw);
}

function extractFileType(fileName) {
  if (!fileName || !fileName.includes('.')) return 'FILE';
  return fileName.split('.').pop().toUpperCase();
}

function isDocDeletedRecord(d) {
  if (!d) return true;
  if (d.isDeleted === true || String(d.isDeleted).toLowerCase() === 'true' || d.isDeleted === 1 || d.isDeleted === '1') return true;
  if (d.status === 'TRASHED' || d.status === 'DELETED') return true;
  if (d.deletedAt) return true;
  return false;
}

// ============================================================================
// SECTION 02: DATABASE LAYER & REPOSITORY ABSTRACTIONS
// ============================================================================

function getDatabaseSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const configuredSheetId = props.getProperty('DMS_SPREADSHEET_ID');
  if (configuredSheetId) {
    try { return SpreadsheetApp.openById(configuredSheetId); } catch (e) {}
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('DMS_SPREADSHEET_ID', active.getId());
    return active;
  }
  throw new Error('Database Error: No active spreadsheet or DMS_SPREADSHEET_ID found.');
}

function getDbSheet(sheetName) {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Database Error: Required table '${sheetName}' does not exist. Run setupDMS() first.`);
  return sheet;
}

function withScriptLock(operationFn, timeoutMs) {
  const timeout = timeoutMs || DMS_CONFIG.LOCK_TIMEOUT_MS;
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(timeout);
  if (!acquired) throw new Error('ERR_LOCK_TIMEOUT: Server busy processing another transaction.');
  try { return operationFn(); } finally { lock.releaseLock(); }
}

function readAllRecords(sheetName) {
  const sheet = getDbSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0].map(h => String(h).trim());
  const records = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row.every(cell => cell === '' || cell === null)) continue;
    const record = { _rowNumber: r + 1 };
    for (let c = 0; c < headers.length; c++) {
      let val = row[c];
      if (typeof val === 'string' && val.startsWith("'") && /^[=+\-@]/.test(val.slice(1))) val = val.slice(1);
      record[headers[c]] = val;
    }
    records.push(record);
  }
  return records;
}

function findRecord(sheetName, predicate) {
  const records = readAllRecords(sheetName);
  return records.find(predicate) || null;
}

function filterRecords(sheetName, predicate) {
  const records = readAllRecords(sheetName);
  return records.filter(predicate);
}

function appendRecord(sheetName, recordObj) {
  return withScriptLock(() => {
    const sheet = getDbSheet(sheetName);
    const schema = TABLE_SCHEMAS[sheetName];
    if (!schema) throw new Error(`Schema not defined for table: ${sheetName}`);
    const row = schema.map(col => {
      const val = recordObj[col] !== undefined ? recordObj[col] : '';
      return sanitizeFormula(val);
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return recordObj;
  });
}

function updateRecordByRow(sheetName, rowNumber, recordObj) {
  return withScriptLock(() => {
    const sheet = getDbSheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const currentRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c];
      if (recordObj[colName] !== undefined) currentRow[c] = sanitizeFormula(recordObj[colName]);
    }
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([currentRow]);
    SpreadsheetApp.flush();
    return true;
  });
}

function deleteRecordByRow(sheetName, rowNumber) {
  return withScriptLock(() => {
    const sheet = getDbSheet(sheetName);
    sheet.deleteRow(rowNumber);
    SpreadsheetApp.flush();
    return true;
  });
}

// ============================================================================
// SECTION 03: CONFIGURATION SERVICE
// ============================================================================

const ConfigService = {
  get(key, defaultValue) {
    const cache = CacheService.getScriptCache();
    const cachedVal = cache.get('CFG_' + key);
    if (cachedVal !== null) return cachedVal;
    try {
      const record = findRecord(SHEETS.CONFIG, r => r.configKey === key);
      if (record && record.configValue !== '') {
        cache.put('CFG_' + key, String(record.configValue), 300);
        return record.configValue;
      }
    } catch (e) {}
    const propVal = PropertiesService.getScriptProperties().getProperty('CFG_' + key);
    if (propVal !== null && propVal !== undefined) {
      cache.put('CFG_' + key, String(propVal), 300);
      return propVal;
    }
    return defaultValue !== undefined ? defaultValue : null;
  },

  set(key, value, description) {
    return withScriptLock(() => {
      const existing = findRecord(SHEETS.CONFIG, r => r.configKey === key);
      const now = new Date().toISOString();
      const desc = description || (existing ? existing.description : 'System parameter');
      if (existing) {
        updateRecordByRow(SHEETS.CONFIG, existing._rowNumber, { configKey: key, configValue: String(value), description: desc, updatedAt: now });
      } else {
        appendRecord(SHEETS.CONFIG, { configKey: key, configValue: String(value), description: desc, updatedAt: now });
      }
      PropertiesService.getScriptProperties().setProperty('CFG_' + key, String(value));
      CacheService.getScriptCache().put('CFG_' + key, String(value), 300);
      return true;
    });
  },

  getAll(sessionToken) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const defaults = [
      { key: 'SESSION_TIMEOUT_MIN', value: '60', description: 'User inactivity session timeout in minutes', category: 'Security' },
      { key: 'TRASH_RETENTION_DAYS', value: '30', description: 'Retention period for soft-deleted documents before purging', category: 'Governance' },
      { key: 'MAX_LOGIN_ATTEMPTS', value: '5', description: 'Consecutive failed login threshold before account lockout', category: 'Security' },
      { key: 'LOCKOUT_DURATION_MIN', value: '15', description: 'Duration of account lockout in minutes', category: 'Security' },
      { key: 'MAX_FILE_SIZE_MB', value: '15', description: 'Maximum allowed upload size per file in megabytes', category: 'Storage' },
      { key: 'REQUIRE_PASSWORD_COMPLEXITY', value: 'true', description: 'Enforce uppercase, lowercase, and numbers in passwords', category: 'Security' },
      { key: 'APP_DISPLAY_NAME', value: 'Enterprise Document Management System', description: 'Branded portal title in navigation and headers', category: 'General' },
      { key: 'DEFAULT_CLASSIFICATION', value: 'INTERNAL', description: 'Default security classification for newly uploaded documents', category: 'Governance' },
      { key: 'ENABLE_EXPIRY_ALERTS', value: 'true', description: 'Display dashboard warnings for expiring documents', category: 'Notifications' },
      { key: 'EXPIRY_ALERT_DAYS', value: '30', description: 'Days before expiration to begin warning indicators', category: 'Notifications' }
    ];

    const records = readAllRecords(SHEETS.CONFIG);
    const recordMap = {};
    records.forEach(r => { recordMap[r.configKey] = r; });

    return defaults.map(d => {
      const rec = recordMap[d.key];
      return {
        key: d.key,
        value: rec ? String(rec.configValue) : d.value,
        description: (rec && rec.description) ? rec.description : d.description,
        category: d.category,
        updatedAt: rec ? rec.updatedAt : 'SYSTEM_DEFAULT'
      };
    });
  },

  updateConfigs(sessionToken, configsMap) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const keys = Object.keys(configsMap);
    keys.forEach(k => {
      this.set(k, configsMap[k]);
    });
    AuditService.log({
      userId: admin.user.userId,
      userEmail: admin.user.email,
      userName: admin.user.fullName,
      role: admin.user.role,
      action: 'UPDATE_SYSTEM_SETTINGS',
      status: 'SUCCESS',
      targetType: 'SYSTEM_CONFIG',
      targetName: 'Configuration Batch',
      details: configsMap
    });
    return { success: true, message: `Updated ${keys.length} system parameters successfully.` };
  }
};

// ============================================================================
// SECTION 04: GOOGLE DRIVE STORAGE ADAPTER
// ============================================================================

const DriveService = {
  getOrCreateRootFolder() {
    const configuredFolderId = ConfigService.get('ROOT_FOLDER_ID');
    if (configuredFolderId) {
      try {
        const folder = DriveApp.getFolderById(configuredFolderId);
        if (!folder.isTrashed()) return folder;
      } catch (e) {}
    }
    const existing = DriveApp.getRootFolder().getFoldersByName(DMS_CONFIG.DEFAULT_ROOT_FOLDER_NAME);
    if (existing.hasNext()) {
      const folder = existing.next();
      ConfigService.set('ROOT_FOLDER_ID', folder.getId(), 'Root Google Drive folder for DMS');
      return folder;
    }
    const newFolder = DriveApp.getRootFolder().createFolder(DMS_CONFIG.DEFAULT_ROOT_FOLDER_NAME);
    newFolder.setDescription('Root directory for Enterprise Document Management System (DMS).');
    ConfigService.set('ROOT_FOLDER_ID', newFolder.getId(), 'Root Google Drive folder for DMS');
    return newFolder;
  },

  createProjectFolderWithTaxonomy(projectCode, projectName, extraCategories) {
    const rootFolder = this.getOrCreateRootFolder();
    const folderName = `${projectCode} - ${projectName}`;
    const projectFolder = rootFolder.createFolder(folderName);
    projectFolder.setDescription(`Project repository for [${projectCode}] ${projectName}. Created by DMS.`);

    const createdSubfolders = [];
    const allCategoriesToCreate = [...STANDARD_CATEGORIES];
    if (extraCategories && Array.isArray(extraCategories)) {
      extraCategories.forEach(ec => {
        if (ec && typeof ec === 'string') {
          const code = ec.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          if (code && !allCategoriesToCreate.some(c => c.code === code)) {
            allCategoriesToCreate.push({ code: code, name: code, label: ec.trim() });
          }
        }
      });
    }

    try {
      for (let i = 0; i < allCategoriesToCreate.length; i++) {
        const cat = allCategoriesToCreate[i];
        const sub = projectFolder.createFolder(cat.code);
        createdSubfolders.push(sub);
      }
      return { folderId: projectFolder.getId(), folderUrl: projectFolder.getUrl(), subfolderCount: createdSubfolders.length };
    } catch (err) {
      try { projectFolder.setTrashed(true); } catch (e) {}
      throw new Error(`Failed to create category folder structure: ${err.message}`);
    }
  },

  getProjectCategoryFolder(projectFolderId, categoryCode) {
    let projectFolder = null;
    try {
      if (projectFolderId) {
        projectFolder = DriveApp.getFolderById(projectFolderId);
      }
    } catch (e) {
      console.warn('Project folder lookup fallback:', e);
    }

    // Fallback: If project folder was not found or is trashed, resolve from root repository folder
    if (!projectFolder || projectFolder.isTrashed()) {
      const rootFolder = this.getOrCreateRootFolder();
      const existing = rootFolder.getFoldersByName(categoryCode);
      if (existing.hasNext()) return existing.next();
      return rootFolder.createFolder(categoryCode);
    }

    const subfolders = projectFolder.getFoldersByName(categoryCode);
    if (subfolders.hasNext()) return subfolders.next();
    return projectFolder.createFolder(categoryCode);
  },

  saveFileToCategoryFolder(projectFolderId, categoryCode, base64Data, fileName, mimeType) {
    const targetFolder = this.getProjectCategoryFolder(projectFolderId, categoryCode);
    const cleanBase64 = String(base64Data || '').includes(',') ? String(base64Data).split(',')[1] : String(base64Data || '');
    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decodedBytes, mimeType || 'application/octet-stream', fileName);
    const driveFile = targetFolder.createFile(blob);
    driveFile.setDescription(`Uploaded to DMS. Project Folder ID: ${projectFolderId}, Category: ${categoryCode}. Uploaded At: ${new Date().toISOString()}`);
    return {
      fileId: driveFile.getId(),
      fileUrl: driveFile.getUrl(),
      fileSize: driveFile.getSize(),
      mimeType: driveFile.getMimeType()
    };
  },

  /**
   * Retrieves file blob and converts to Base64 data URL for in-app reader preview.
   */
  getFileDataPayload(driveFileId) {
    const file = DriveApp.getFileById(driveFileId);
    if (file.isTrashed()) throw new Error('File has been moved to trash.');
    const blob = file.getBlob();
    const base64Str = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType() || 'application/octet-stream';
    
    return {
      dataUrl: `data:${mimeType};base64,${base64Str}`,
      rawBase64: base64Str,
      fileName: file.getName(),
      mimeType: mimeType,
      fileSize: file.getSize(),
      downloadUrl: file.getDownloadUrl(),
      previewUrl: `https://drive.google.com/file/d/${file.getId()}/preview`,
      webViewLink: file.getUrl()
    };
  }
};

// ============================================================================
// SECTION 05: AUDIT LOGGING SERVICE
// ============================================================================

const AuditService = {
  log(event) {
    try {
      const logRecord = {
        activityId: generateId('LOG'),
        timestamp: new Date().toISOString(),
        userId: event.userId || 'SYSTEM',
        userEmail: event.userEmail || 'system@internal',
        userName: event.userName || 'System Engine',
        role: event.role || 'SYSTEM',
        sessionId: event.sessionId || 'N/A',
        action: event.action || 'UNKNOWN_ACTION',
        projectId: event.projectId || '',
        documentId: event.documentId || '',
        targetType: event.targetType || 'SYSTEM',
        targetName: event.targetName || '',
        details: typeof event.details === 'object' ? JSON.stringify(event.details) : String(event.details || ''),
        userAgent: event.userAgent || 'AppsScript-Backend',
        clientIp: 'UNAVAILABLE_APPS_SCRIPT',
        status: event.status || 'SUCCESS',
        errorCode: event.errorCode || ''
      };
      appendRecord(SHEETS.ACTIVITY_LOG, logRecord);
    } catch (err) {
      console.error('AuditService error:', err);
    }
  },

  getAuditLogs(sessionToken, options) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const filter = options || {};
    let logs = readAllRecords(SHEETS.ACTIVITY_LOG);

    if (filter.action && filter.action !== 'ALL') {
      logs = logs.filter(l => l.action === filter.action);
    }
    if (filter.status && filter.status !== 'ALL') {
      logs = logs.filter(l => l.status === filter.status);
    }
    if (filter.userId && filter.userId !== 'ALL') {
      logs = logs.filter(l => l.userId === filter.userId || (l.userEmail && l.userEmail.toLowerCase().includes(filter.userId.toLowerCase())));
    }
    if (filter.search) {
      const q = String(filter.search).toLowerCase();
      logs = logs.filter(l => 
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        (l.targetName && l.targetName.toLowerCase().includes(q)) ||
        (l.documentId && l.documentId.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q))
      );
    }
    if (filter.dateFrom) {
      logs = logs.filter(l => l.timestamp && l.timestamp.slice(0, 10) >= filter.dateFrom);
    }
    if (filter.dateTo) {
      logs = logs.filter(l => l.timestamp && l.timestamp.slice(0, 10) <= filter.dateTo);
    }

    // Sort descending by timestamp
    logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    const limit = Number(filter.limit) || 100;
    return logs.slice(0, limit);
  }
};

// ============================================================================
// SECTION 06: AUTHENTICATION & SESSION MANAGEMENT SERVICE
// ============================================================================

const AuthService = {
  authenticate(email, password, userAgent) {
    if (!email || !password) throw new Error('Email and password must be provided.');
    const cleanEmail = String(email).trim().toLowerCase();
    const user = findRecord(SHEETS.USERS, u => String(u.email).toLowerCase() === cleanEmail);
    const now = new Date();
    
    if (!user) {
      AuditService.log({ userEmail: cleanEmail, action: 'LOGIN_FAILED', status: 'FAILURE', errorCode: 'ERR_USER_NOT_FOUND', userAgent });
      throw new Error('Email anda salah');
    }
    if (user.status === USER_STATUSES.DISABLED) {
      AuditService.log({ userId: user.userId, userEmail: cleanEmail, action: 'LOGIN_BLOCKED', status: 'FAILURE', errorCode: 'ERR_ACCOUNT_DISABLED', userAgent });
      throw new Error('Akun Anda dinonaktifkan. Silakan hubungi Administrator.');
    }
    if (user.lockedUntil && now < new Date(user.lockedUntil)) {
      throw new Error('Akun terkunci sementara karena percobaan gagal berulang kali.');
    }
    
    const isValidPassword = verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      const failedCount = (Number(user.failedLoginCount) || 0) + 1;
      const updateData = { failedLoginCount: failedCount };
      if (failedCount >= DMS_CONFIG.DEFAULT_MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(now.getTime() + DMS_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
      }
      updateRecordByRow(SHEETS.USERS, user._rowNumber, updateData);
      AuditService.log({ userId: user.userId, userEmail: cleanEmail, action: 'LOGIN_FAILED', status: 'FAILURE', errorCode: 'ERR_INVALID_PASSWORD', userAgent });
      throw new Error('Password anda salah');
    }
    
    updateRecordByRow(SHEETS.USERS, user._rowNumber, { failedLoginCount: 0, lockedUntil: '', lastLoginAt: now.toISOString() });
    
    const rawToken = generateSessionToken(user.userId);
    const tokenHash = hashSessionToken(rawToken);
    const timeoutMin = Number(ConfigService.get('SESSION_TIMEOUT_MIN', DMS_CONFIG.DEFAULT_SESSION_TIMEOUT_MINUTES));
    const expiresAt = new Date(now.getTime() + timeoutMin * 60 * 1000).toISOString();
    const sessionId = generateId('SES');
    
    appendRecord(SHEETS.SESSIONS, {
      sessionId, userId: user.userId, tokenHash, createdAt: now.toISOString(), lastActivityAt: now.toISOString(), expiresAt, userAgent: userAgent || 'Browser', isValid: true
    });
    
    CacheService.getScriptCache().put('TOKEN_' + tokenHash, JSON.stringify({
      sessionId, userId: user.userId, userEmail: cleanEmail, userName: user.fullName, role: user.role, mustChangePassword: String(user.mustChangePassword) === 'true', lastActivityAt: now.getTime(), expiresAt: new Date(expiresAt).getTime()
    }), timeoutMin * 60);
    
    AuditService.log({ userId: user.userId, userEmail: cleanEmail, userName: user.fullName, role: user.role, sessionId, action: 'LOGIN_SUCCESS', status: 'SUCCESS', userAgent });
    
    return {
      sessionToken: rawToken,
      user: { userId: user.userId, email: cleanEmail, fullName: user.fullName, role: user.role, mustChangePassword: String(user.mustChangePassword) === 'true' }
    };
  },

  validateSession(token) {
    if (!token || typeof token !== 'string') return { valid: false, error: 'ERR_TOKEN_MISSING' };
    const tokenHash = hashSessionToken(token);
    const cache = CacheService.getScriptCache();
    const cachedStr = cache.get('TOKEN_' + tokenHash);
    const now = Date.now();
    const timeoutMin = Number(ConfigService.get('SESSION_TIMEOUT_MIN', DMS_CONFIG.DEFAULT_SESSION_TIMEOUT_MINUTES));
    const idleLimitMs = timeoutMin * 60 * 1000;
    
    let sessionData = null;
    if (cachedStr) {
      try { sessionData = JSON.parse(cachedStr); } catch (e) {}
    }
    if (!sessionData) {
      const record = findRecord(SHEETS.SESSIONS, s => s.tokenHash === tokenHash && String(s.isValid) === 'true');
      if (!record) return { valid: false, error: 'ERR_SESSION_INVALID' };
      const user = findRecord(SHEETS.USERS, u => u.userId === record.userId);
      if (!user || user.status === USER_STATUSES.DISABLED) return { valid: false, error: 'ERR_USER_INACTIVE' };
      sessionData = {
        sessionId: record.sessionId, userId: user.userId, userEmail: user.email, userName: user.fullName, role: user.role, mustChangePassword: String(user.mustChangePassword) === 'true', lastActivityAt: new Date(record.lastActivityAt).getTime(), expiresAt: new Date(record.expiresAt).getTime()
      };
    }
    
    if (now - sessionData.lastActivityAt > idleLimitMs || now > sessionData.expiresAt) {
      this.invalidateToken(token);
      return { valid: false, error: 'ERR_SESSION_TIMEOUT' };
    }
    
    sessionData.lastActivityAt = now;
    sessionData.expiresAt = now + idleLimitMs;
    cache.put('TOKEN_' + tokenHash, JSON.stringify(sessionData), timeoutMin * 60);
    
    return {
      valid: true,
      user: { userId: sessionData.userId, email: sessionData.userEmail, fullName: sessionData.userName, role: sessionData.role, mustChangePassword: sessionData.mustChangePassword },
      sessionId: sessionData.sessionId
    };
  },

  invalidateToken(token) {
    if (!token) return true;
    const tokenHash = hashSessionToken(token);
    CacheService.getScriptCache().remove('TOKEN_' + tokenHash);
    const session = findRecord(SHEETS.SESSIONS, s => s.tokenHash === tokenHash);
    if (session) {
      updateRecordByRow(SHEETS.SESSIONS, session._rowNumber, { isValid: false, lastActivityAt: new Date().toISOString() });
      AuditService.log({ userId: session.userId, sessionId: session.sessionId, action: 'LOGOUT', status: 'SUCCESS' });
    }
    return true;
  },

  changePassword(token, currentPassword, newPassword) {
    const auth = this.assertAuthenticated(token);
    const user = findRecord(SHEETS.USERS, u => u.userId === auth.user.userId);
    if (!user) throw new Error('User not found.');
    if (!verifyPassword(currentPassword, user.passwordHash)) throw new Error('Current password does not match.');
    if (!newPassword || newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw new Error('Password must include uppercase, lowercase, and numeric characters.');
    }
    
    const newSalt = generateSalt();
    const newHash = hashPassword(newPassword, newSalt);
    updateRecordByRow(SHEETS.USERS, user._rowNumber, { passwordHash: newHash, mustChangePassword: false, status: USER_STATUSES.ACTIVE });
    AuditService.log({ userId: user.userId, userEmail: user.email, action: 'PASSWORD_CHANGED', status: 'SUCCESS' });
    return { success: true, message: 'Password updated successfully.' };
  },

  assertAuthenticated(token) {
    const auth = this.validateSession(token);
    if (!auth.valid) throw new Error(`ERR_UNAUTHENTICATED: ${auth.error || 'Invalid session.'}`);
    return auth;
  },

  assertRole(token, requiredRole) {
    const auth = this.assertAuthenticated(token);
    if (auth.user.role !== requiredRole) {
      AuditService.log({ userId: auth.user.userId, userEmail: auth.user.email, role: auth.user.role, action: 'ACCESS_DENIED', status: 'FAILURE', errorCode: 'ERR_FORBIDDEN' });
      throw new Error(`Akses ditolak: Hanya fungsi Super Admin yang diberikan akses atas fitur ini (memerlukan hak akses ${requiredRole}).`);
    }
    return auth;
  }
};

// ============================================================================
// SECTION 07: USER MANAGEMENT SERVICE
// ============================================================================

const UserService = {
  getUsers(sessionToken) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    return readAllRecords(SHEETS.USERS).map(u => ({
      userId: u.userId, email: u.email, fullName: u.fullName, role: u.role, status: u.status, mustChangePassword: String(u.mustChangePassword) === 'true', createdAt: u.createdAt, lastLoginAt: u.lastLoginAt
    }));
  },
  createUser(sessionToken, payload) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const cleanEmail = String(payload.email).trim().toLowerCase();
    if (findRecord(SHEETS.USERS, u => String(u.email).toLowerCase() === cleanEmail)) {
      throw new Error(`User with email '${cleanEmail}' already exists.`);
    }
    const role = (payload.role === USER_ROLES.SUPER_ADMIN) ? USER_ROLES.SUPER_ADMIN : USER_ROLES.USER;
    const newUserId = generateId('USR');
    const newUserRecord = {
      userId: newUserId, email: cleanEmail, fullName: String(payload.fullName).trim(), role, passwordHash: hashPassword(payload.tempPassword, generateSalt()), status: USER_STATUSES.PENDING, mustChangePassword: true, failedLoginCount: 0, lockedUntil: '', createdAt: new Date().toISOString(), lastLoginAt: ''
    };
    appendRecord(SHEETS.USERS, newUserRecord);
    AuditService.log({ userId: admin.user.userId, userEmail: admin.user.email, action: 'CREATE_USER', status: 'SUCCESS', targetName: cleanEmail });
    return { success: true, user: newUserRecord };
  },
  updateUser(sessionToken, userId, payload) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const user = findRecord(SHEETS.USERS, u => u.userId === userId);
    if (!user) throw new Error('User not found.');
    const updateData = {};
    if (payload.fullName) updateData.fullName = String(payload.fullName).trim();
    if (payload.role && [USER_ROLES.SUPER_ADMIN, USER_ROLES.USER].includes(payload.role)) updateData.role = payload.role;
    if (payload.password || payload.key) {
      updateData.passwordHash = hashPassword(payload.password || payload.key, generateSalt());
      updateData.mustChangePassword = false;
    }
    updateRecordByRow(SHEETS.USERS, user._rowNumber, updateData);
    return { success: true, message: 'User updated.' };
  },
  setUserStatus(sessionToken, userId, newStatus) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const user = findRecord(SHEETS.USERS, u => u.userId === userId);
    if (!user) throw new Error('User not found.');
    updateRecordByRow(SHEETS.USERS, user._rowNumber, { status: newStatus });
    return { success: true, message: 'Status updated.' };
  },
  resetUserPassword(sessionToken, userId, tempPassword) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const user = findRecord(SHEETS.USERS, u => u.userId === userId);
    if (!user) throw new Error('User not found.');
    updateRecordByRow(SHEETS.USERS, user._rowNumber, { passwordHash: hashPassword(tempPassword, generateSalt()), mustChangePassword: true });
    return { success: true, message: 'Password reset.' };
  },
  deleteUser(sessionToken, userId) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    if (admin.user.userId === userId) {
      throw new Error('Security Error: You cannot delete your own active administrator account.');
    }
    const user = findRecord(SHEETS.USERS, u => u.userId === userId);
    if (!user) throw new Error('User not found.');

    const allAdmins = filterRecords(SHEETS.USERS, u => u.role === USER_ROLES.SUPER_ADMIN && u.status === USER_STATUSES.ACTIVE);
    if (user.role === USER_ROLES.SUPER_ADMIN && allAdmins.length <= 1) {
      throw new Error('Security Error: Cannot delete the only remaining active Super Administrator.');
    }

    deleteRecordByRow(SHEETS.USERS, user._rowNumber);
    AuditService.log({
      userId: admin.user.userId,
      userEmail: admin.user.email,
      userName: admin.user.fullName,
      role: admin.user.role,
      action: 'DELETE_USER',
      status: 'SUCCESS',
      targetType: 'USER',
      targetName: user.email,
      details: { userId, email: user.email, role: user.role }
    });
    return { success: true, message: `User '${user.email}' removed from system.` };
  }
};

// ============================================================================
// SECTION 08: PROJECT MANAGEMENT SERVICE
// ============================================================================

const ProjectService = {
  getProjects(sessionToken, options) {
    AuthService.assertAuthenticated(sessionToken);
    const filterOpts = options || {};
    let projects = readAllRecords(SHEETS.PROJECTS);
    const allDocs = readAllRecords(SHEETS.DOCUMENTS);
    const docCountMap = {};
    allDocs.forEach(d => {
      if (!isDocDeletedRecord(d)) docCountMap[d.projectId] = (docCountMap[d.projectId] || 0) + 1;
    });

    if (filterOpts.includeArchived !== true) {
      projects = projects.filter(p => String(p.isArchived) !== 'true' && p.status !== PROJECT_STATUSES.ARCHIVED);
    }
    return projects.map(p => ({
      projectId: p.projectId, projectCode: p.projectCode, projectName: p.projectName, partner: p.partner, description: p.description, pic: p.pic, startDate: p.startDate, endDate: p.endDate, status: p.status, tags: p.tags, driveFolderId: p.driveFolderId, documentCount: docCountMap[p.projectId] || 0, createdAt: p.createdAt, isArchived: String(p.isArchived) === 'true'
    }));
  },

  getProjectById(sessionToken, projectId) {
    AuthService.assertAuthenticated(sessionToken);
    const project = findRecord(SHEETS.PROJECTS, p => p.projectId === projectId);
    if (!project) throw new Error('Project not found.');
    return { project, categories: STANDARD_CATEGORIES };
  },

  createProject(sessionToken, payload) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const cleanCode = String(payload.projectCode || generateId('PRJ')).trim().toUpperCase();
    const cleanName = String(payload.projectName).trim();
    const cleanPartner = String(payload.partner || '').trim();

    if (findRecord(SHEETS.PROJECTS, p => String(p.projectCode).toUpperCase() === cleanCode)) {
      throw new Error(`Project Code '${cleanCode}' already exists.`);
    }

    return withScriptLock(() => {
      const extraCategories = [];
      if (payload.customCategory || payload.newCategory) {
        const catStr = String(payload.customCategory || payload.newCategory).trim();
        if (catStr) extraCategories.push(catStr);
      }
      const driveHierarchy = DriveService.createProjectFolderWithTaxonomy(cleanCode, cleanName, extraCategories);
      const newProjectId = generateId('PRJ');
      const projectRecord = {
        projectId: newProjectId, projectCode: cleanCode, projectName: cleanName, partner: cleanPartner, description: payload.description || '', pic: payload.pic || '', startDate: payload.startDate || '', endDate: payload.endDate || '', status: payload.status || PROJECT_STATUSES.ACTIVE, tags: payload.tags || '', driveFolderId: driveHierarchy.folderId, createdBy: admin.user.userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isArchived: false
      };
      appendRecord(SHEETS.PROJECTS, projectRecord);
      AuditService.log({ userId: admin.user.userId, userEmail: admin.user.email, action: 'CREATE_PROJECT', status: 'SUCCESS', projectId: newProjectId, targetName: cleanCode });
      return { success: true, project: projectRecord };
    });
  },

  updateProject(sessionToken, projectId, payload) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const project = findRecord(SHEETS.PROJECTS, p => p.projectId === projectId);
    if (!project) throw new Error('Project not found.');
    const updateData = { updatedAt: new Date().toISOString() };
    if (payload.projectName) updateData.projectName = String(payload.projectName).trim();
    if (payload.partner) updateData.partner = String(payload.partner).trim();
    if (payload.status) updateData.status = payload.status;
    updateRecordByRow(SHEETS.PROJECTS, project._rowNumber, updateData);
    return { success: true, message: 'Project updated.' };
  },

  archiveProject(sessionToken, projectId) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const project = findRecord(SHEETS.PROJECTS, p => p.projectId === projectId);
    if (!project) throw new Error('Project not found.');
    updateRecordByRow(SHEETS.PROJECTS, project._rowNumber, { status: PROJECT_STATUSES.ARCHIVED, isArchived: true, updatedAt: new Date().toISOString() });
    AuditService.log({ action: 'ARCHIVE_PROJECT', status: 'SUCCESS', projectId });
    return { success: true, message: 'Project archived.' };
  }
};

// ============================================================================
// SECTION 09: DOCUMENT MANAGEMENT & READER SERVICE
// ============================================================================

const DocumentService = {
  getProjectExplorerData(sessionToken, projectId) {
    AuthService.assertAuthenticated(sessionToken);
    const project = findRecord(SHEETS.PROJECTS, p => p.projectId === projectId);
    if (!project) throw new Error('Project not found.');

    const docs = filterRecords(SHEETS.DOCUMENTS, d => d.projectId === projectId && !isDocDeletedRecord(d));
    const categoryCountMap = {};
    STANDARD_CATEGORIES.forEach(c => { categoryCountMap[c.code] = 0; });
    docs.forEach(d => {
      if (d.category) {
        categoryCountMap[d.category] = (categoryCountMap[d.category] || 0) + 1;
      }
    });

    const categoryMap = new Map();
    STANDARD_CATEGORIES.forEach(c => categoryMap.set(c.code, {
      code: c.code,
      name: c.name,
      label: c.label,
      count: categoryCountMap[c.code] || 0
    }));

    docs.forEach(d => {
      if (d.category && !categoryMap.has(d.category)) {
        categoryMap.set(d.category, {
          code: d.category,
          name: d.category,
          label: d.category.replace(/_/g, ' '),
          count: categoryCountMap[d.category] || 0
        });
      }
    });

    const categoriesWithCounts = Array.from(categoryMap.values());

    return {
      project: {
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        partner: project.partner,
        status: project.status,
        pic: project.pic,
        isArchived: String(project.isArchived) === 'true'
      },
      categories: categoriesWithCounts,
      totalDocuments: docs.length
    };
  },

  uploadDocument(sessionToken, payload) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const project = findRecord(SHEETS.PROJECTS, p => p.projectId === payload.projectId);
    if (!project) throw new Error('Selected project not found.');
    if (String(project.isArchived) === 'true') throw new Error('Cannot upload to an archived project.');

    const cleanFileName = String(payload.fileName).trim();
    const docTitle = payload.documentName ? String(payload.documentName).trim() : cleanFileName;
    const fileType = extractFileType(cleanFileName);
    const mimeType = payload.mimeType || 'application/octet-stream';

    return withScriptLock(() => {
      let uploadedDriveFile = null;
      try {
        uploadedDriveFile = DriveService.saveFileToCategoryFolder(
          project.driveFolderId,
          payload.category,
          payload.fileData,
          cleanFileName,
          mimeType
        );

        const now = new Date().toISOString();
        const newDocId = generateId('DOC');
        const docRecord = {
          documentId: newDocId,
          projectId: project.projectId,
          driveFileId: uploadedDriveFile.fileId,
          documentName: docTitle,
          category: payload.category,
          description: payload.description ? String(payload.description).trim() : '',
          documentDate: payload.documentDate || '',
          effectiveDate: payload.effectiveDate || '',
          expiryDate: payload.expiryDate || '',
          status: payload.status || DOCUMENT_STATUSES.ACTIVE,
          classification: CLASSIFICATIONS.INTERNAL,
          fileType: fileType,
          mimeType: uploadedDriveFile.mimeType,
          fileSize: uploadedDriveFile.fileSize,
          tags: payload.tags ? String(payload.tags).trim() : '',
          uploadedBy: admin.user.userId,
          uploadedAt: now,
          lastModifiedAt: now,
          isDeleted: false,
          deletedAt: '',
          deletedBy: ''
        };

        appendRecord(SHEETS.DOCUMENTS, docRecord);

        AuditService.log({
          userId: admin.user.userId,
          userEmail: admin.user.email,
          userName: admin.user.fullName,
          role: admin.user.role,
          sessionId: admin.sessionId,
          action: 'UPLOAD_DOCUMENT',
          status: 'SUCCESS',
          projectId: project.projectId,
          documentId: newDocId,
          targetType: 'DOCUMENT',
          targetName: docTitle,
          details: { category: payload.category, fileSize: uploadedDriveFile.fileSize }
        });

        return { success: true, message: `Document '${docTitle}' uploaded successfully.`, document: docRecord };
      } catch (err) {
        if (uploadedDriveFile && uploadedDriveFile.fileId) {
          try { DriveApp.getFileById(uploadedDriveFile.fileId).setTrashed(true); } catch (e) {}
        }
        throw new Error(`Upload failed: ${err.message}`);
      }
    });
  },

  getDocumentsByCategory(sessionToken, projectId, category) {
    const auth = AuthService.assertAuthenticated(sessionToken);
    const docs = filterRecords(SHEETS.DOCUMENTS, d => d.projectId === projectId && d.category === category && !isDocDeletedRecord(d));
    const userFavorites = filterRecords(SHEETS.FAVORITES, f => f.userId === auth.user.userId);
    const favSet = new Set(userFavorites.map(f => f.documentId));

    return docs.map(d => Object.assign({}, d, { isFavorite: favSet.has(d.documentId) }));
  },

  getDocumentMetadata(sessionToken, documentId) {
    AuthService.assertAuthenticated(sessionToken);
    const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === documentId && !isDocDeletedRecord(d));
    if (!doc) throw new Error('Document not found or trashed.');
    const project = findRecord(SHEETS.PROJECTS, p => p.projectId === doc.projectId);
    return { document: doc, project: project || null };
  },

  /**
   * Retrieves Document Payload for Integrated Reader.
   * Logs VIEW_DOCUMENT audit event and registers Recent access.
   */
  openDocumentForReading(sessionToken, documentId) {
    const auth = AuthService.assertAuthenticated(sessionToken);
    const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === documentId && !isDocDeletedRecord(d));
    if (!doc) throw new Error('Document not found or is in Trash.');
    const project = findRecord(SHEETS.PROJECTS, p => p.projectId === doc.projectId);

    // Retrieve file payload from Google Drive
    const drivePayload = DriveService.getFileDataPayload(doc.driveFileId);

    // Track Recent Document access (debounced to avoid burst duplicates)
    try {
      const now = new Date().toISOString();
      const existingRecent = findRecord(SHEETS.RECENTS, r => r.userId === auth.user.userId && r.documentId === documentId);
      if (existingRecent) {
        updateRecordByRow(SHEETS.RECENTS, existingRecent._rowNumber, { lastOpenedAt: now });
      } else {
        appendRecord(SHEETS.RECENTS, {
          recentId: generateId('REC'),
          userId: auth.user.userId,
          documentId: documentId,
          lastOpenedAt: now
        });
      }
    } catch (recentErr) {
      console.warn('Recent tracking error:', recentErr);
    }

    // Write audit log
    AuditService.log({
      userId: auth.user.userId,
      userEmail: auth.user.email,
      userName: auth.user.fullName,
      role: auth.user.role,
      sessionId: auth.sessionId,
      action: 'VIEW_DOCUMENT',
      status: 'SUCCESS',
      projectId: doc.projectId,
      documentId: documentId,
      targetType: 'DOCUMENT',
      targetName: doc.documentName,
      details: { fileType: doc.fileType, driveFileId: doc.driveFileId }
    });

    return {
      document: doc,
      project: project ? { projectCode: project.projectCode, projectName: project.projectName } : null,
      filePayload: drivePayload
    };
  },

  updateDocumentMetadata(sessionToken, documentId, payload) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === documentId && !isDocDeletedRecord(d));
    if (!doc) throw new Error('Document not found.');

    const updateData = { lastModifiedAt: new Date().toISOString() };
    if (payload.documentName) updateData.documentName = String(payload.documentName).trim();
    if (payload.description !== undefined) updateData.description = String(payload.description).trim();
    if (payload.documentDate !== undefined) updateData.documentDate = payload.documentDate;
    if (payload.effectiveDate !== undefined) updateData.effectiveDate = payload.effectiveDate;
    if (payload.expiryDate !== undefined) updateData.expiryDate = payload.expiryDate;
    if (payload.tags !== undefined) updateData.tags = String(payload.tags).trim();
    if (payload.status) updateData.status = payload.status;

    updateRecordByRow(SHEETS.DOCUMENTS, doc._rowNumber, updateData);
    AuditService.log({ userId: admin.user.userId, action: 'EDIT_DOCUMENT_METADATA', status: 'SUCCESS', documentId, targetName: doc.documentName });
    return { success: true, message: 'Metadata updated.', document: Object.assign({}, doc, updateData) };
  },

  /**
   * Search documents across multiple criteria, joined with projects and favorites.
   */
  searchDocuments(sessionToken, criteria) {
    const auth = AuthService.assertAuthenticated(sessionToken);
    const filter = criteria || {};
    const query = filter.query ? String(filter.query).trim().toLowerCase() : '';
    
    // Get all active projects and standard Document Explorer categories
    const allProjects = readAllRecords(SHEETS.PROJECTS);
    const activeProjectMap = {};
    allProjects.forEach(p => {
      if (String(p.isArchived) !== 'true' && (p.status || '').toUpperCase() !== 'ARCHIVED') {
        activeProjectMap[p.projectId] = p;
      }
    });

    // Get all active documents strictly matching Document Explorer presence
    const allDocs = filterRecords(SHEETS.DOCUMENTS, d => {
      if (isDocDeletedRecord(d)) return false;
      if (!d.projectId || !activeProjectMap[d.projectId]) return false;
      if (!d.category || typeof d.category !== 'string' || d.category.trim().length === 0) return false;
      return true;
    });

    const projectMap = {};
    allProjects.forEach(p => { projectMap[p.projectId] = p; });

    // User favorites map
    const userFavorites = filterRecords(SHEETS.FAVORITES, f => f.userId === auth.user.userId);
    const favSet = new Set(userFavorites.map(f => f.documentId));

    const todayStr = new Date().toISOString().slice(0, 10);
    const in30DaysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const in60DaysStr = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let results = allDocs.filter(d => {
      const prj = projectMap[d.projectId];
      
      // Filter by Project
      if (filter.projectId && filter.projectId !== 'ALL' && d.projectId !== filter.projectId) {
        return false;
      }

      // Filter by Category
      if (filter.category && filter.category !== 'ALL' && d.category !== filter.category) {
        return false;
      }

      // Filter by Classification
      if (filter.classification && filter.classification !== 'ALL' && d.classification !== filter.classification) {
        return false;
      }

      // Filter by Status
      if (filter.status && filter.status !== 'ALL' && d.status !== filter.status) {
        return false;
      }

      // Filter by FileType
      if (filter.fileType && filter.fileType !== 'ALL') {
        const ft = (d.fileType || '').toUpperCase();
        if (filter.fileType === 'IMAGE') {
          if (!['PNG', 'JPG', 'JPEG', 'WEBP', 'SVG', 'GIF'].includes(ft)) return false;
        } else if (filter.fileType === 'OFFICE') {
          if (!['DOCX', 'XLSX', 'PPTX'].includes(ft)) return false;
        } else if (ft !== filter.fileType.toUpperCase()) {
          return false;
        }
      }

      // Filter by Expiration
      if (filter.expiration) {
        if (!d.expiryDate) return false;
        if (filter.expiration === 'EXPIRED' && d.expiryDate >= todayStr) return false;
        if (filter.expiration === 'EXPIRING_30' && (d.expiryDate < todayStr || d.expiryDate > in30DaysStr)) return false;
        if (filter.expiration === 'EXPIRING_60' && (d.expiryDate < todayStr || d.expiryDate > in60DaysStr)) return false;
      }

      // Filter by Date Range (documentDate)
      if (filter.dateFrom && d.documentDate && d.documentDate < filter.dateFrom) return false;
      if (filter.dateTo && d.documentDate && d.documentDate > filter.dateTo) return false;

      // Free-text query matching: Document Name, File Name, Description, Tags, Category, Project Name/Code, Partner/Mitra
      if (query) {
        const nameMatch = (d.documentName || '').toLowerCase().includes(query);
        const fileNameMatch = (d.fileName || '').toLowerCase().includes(query);
        const descMatch = (d.description || '').toLowerCase().includes(query);
        const tagsMatch = (d.tags || '').toLowerCase().includes(query);
        const catMatch = (d.category || '').toLowerCase().includes(query);
        const prjCodeMatch = prj && (prj.projectCode || '').toLowerCase().includes(query);
        const prjNameMatch = (prj && (prj.projectName || '').toLowerCase().includes(query)) || ((d.projectName || '').toLowerCase().includes(query));
        const partnerMatch = (prj && (prj.partner || '').toLowerCase().includes(query)) || ((d.partner || d.partnerName || '').toLowerCase().includes(query));
        if (!nameMatch && !fileNameMatch && !descMatch && !tagsMatch && !catMatch && !prjCodeMatch && !prjNameMatch && !partnerMatch) {
          return false;
        }
      }

      return true;
    });

    // Decorate results with project details and favorite status
    const decoratedResults = results.map(d => {
      const prj = projectMap[d.projectId];
      return Object.assign({}, d, {
        projectCode: prj ? prj.projectCode : '—',
        projectName: prj ? prj.projectName : 'Unknown Project',
        partner: prj ? prj.partner : '—',
        isFavorite: favSet.has(d.documentId)
      });
    });

    // Sorting
    const sortBy = filter.sortBy || 'name';
    const sortOrder = filter.sortOrder === 'desc' ? -1 : 1;
    decoratedResults.sort((a, b) => {
      if (sortBy === 'date') {
        const da = a.documentDate || a.uploadedAt || '';
        const db = b.documentDate || b.uploadedAt || '';
        return (da > db ? 1 : da < db ? -1 : 0) * sortOrder;
      } else if (sortBy === 'expiry') {
        const ea = a.expiryDate || '9999-99-99';
        const eb = b.expiryDate || '9999-99-99';
        return (ea > eb ? 1 : ea < eb ? -1 : 0) * sortOrder;
      } else if (sortBy === 'size') {
        return ((a.fileSize || 0) - (b.fileSize || 0)) * sortOrder;
      } else {
        // Name
        return (a.documentName || '').localeCompare(b.documentName || '') * sortOrder;
      }
    });

    return decoratedResults;
  },

  /**
   * Toggle a document's favorite status for the current user.
   */
  toggleFavorite(sessionToken, documentId) {
    const auth = AuthService.assertAuthenticated(sessionToken);
    const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === documentId && String(d.isDeleted) !== 'true');
    if (!doc) throw new Error('Document not found or is in Trash.');

    const existing = findRecord(SHEETS.FAVORITES, f => f.userId === auth.user.userId && f.documentId === documentId);
    if (existing) {
      deleteRecordByRow(SHEETS.FAVORITES, existing._rowNumber);
      return { documentId, isFavorite: false, message: 'Removed from favorites.' };
    } else {
      appendRecord(SHEETS.FAVORITES, {
        favoriteId: generateId('FAV'),
        userId: auth.user.userId,
        documentId: documentId,
        createdAt: new Date().toISOString()
      });
      return { documentId, isFavorite: true, message: 'Added to favorites.' };
    }
  },

  /**
   * Get all favorite documents for the current user.
   */
  getFavorites(sessionToken) {
    const auth = AuthService.assertAuthenticated(sessionToken);
    const userFavorites = filterRecords(SHEETS.FAVORITES, f => f.userId === auth.user.userId);
    if (userFavorites.length === 0) return [];

    const favDocIds = new Set(userFavorites.map(f => f.documentId));
    const allDocs = filterRecords(SHEETS.DOCUMENTS, d => favDocIds.has(d.documentId) && !isDocDeletedRecord(d));
    const allProjects = readAllRecords(SHEETS.PROJECTS);
    const projectMap = {};
    allProjects.forEach(p => { projectMap[p.projectId] = p; });

    return allDocs.map(d => {
      const prj = projectMap[d.projectId];
      return Object.assign({}, d, {
        projectCode: prj ? prj.projectCode : '—',
        projectName: prj ? prj.projectName : 'Unknown Project',
        partner: prj ? prj.partner : '—',
        isFavorite: true
      });
    });
  },

  /**
   * Get recently viewed documents for the current user, ordered by lastOpenedAt DESC.
   */
  getRecents(sessionToken, limit) {
    const auth = AuthService.assertAuthenticated(sessionToken);
    const maxLimit = Number(limit) || 20;

    let userRecents = filterRecords(SHEETS.RECENTS, r => r.userId === auth.user.userId);
    userRecents.sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime());
    userRecents = userRecents.slice(0, maxLimit);

    if (userRecents.length === 0) return [];

    const allProjects = readAllRecords(SHEETS.PROJECTS);
    const projectMap = {};
    allProjects.forEach(p => { projectMap[p.projectId] = p; });

    const userFavorites = filterRecords(SHEETS.FAVORITES, f => f.userId === auth.user.userId);
    const favSet = new Set(userFavorites.map(f => f.documentId));

    const results = [];
    userRecents.forEach(r => {
      const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === r.documentId && !isDocDeletedRecord(d));
      if (doc) {
        const prj = projectMap[doc.projectId];
        results.push(Object.assign({}, doc, {
          lastOpenedAt: r.lastOpenedAt,
          projectCode: prj ? prj.projectCode : '—',
          projectName: prj ? prj.projectName : 'Unknown Project',
          partner: prj ? prj.partner : '—',
          isFavorite: favSet.has(doc.documentId)
        }));
      }
    });

    return results;
  },

  /**
   * Soft-delete a document (move to Trash Repository).
   */
  softDeleteDocument(sessionToken, documentId) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === documentId && !isDocDeletedRecord(d));
    if (!doc) throw new Error('Document not found or already in trash.');

    const now = new Date().toISOString();
    updateRecordByRow(SHEETS.DOCUMENTS, doc._rowNumber, {
      isDeleted: true,
      status: 'TRASHED',
      deletedAt: now,
      deletedBy: admin.user.userId
    });

    AuditService.log({
      userId: admin.user.userId,
      userEmail: admin.user.email,
      userName: admin.user.fullName,
      role: admin.user.role,
      action: 'SOFT_DELETE_DOCUMENT',
      status: 'SUCCESS',
      projectId: doc.projectId,
      documentId: documentId,
      targetType: 'DOCUMENT',
      targetName: doc.documentName,
      details: { category: doc.category, driveFileId: doc.driveFileId }
    });

    return { success: true, message: `Document '${doc.documentName}' moved to Trash.` };
  },

  /**
   * Restore a soft-deleted document back to the active repository.
   */
  restoreDocument(sessionToken, documentId) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === documentId && String(d.isDeleted) === 'true');
    if (!doc) throw new Error('Trashed document not found.');

    updateRecordByRow(SHEETS.DOCUMENTS, doc._rowNumber, {
      isDeleted: false,
      status: 'ACTIVE',
      deletedAt: '',
      deletedBy: ''
    });

    AuditService.log({
      userId: admin.user.userId,
      userEmail: admin.user.email,
      userName: admin.user.fullName,
      role: admin.user.role,
      action: 'RESTORE_DOCUMENT',
      status: 'SUCCESS',
      projectId: doc.projectId,
      documentId: documentId,
      targetType: 'DOCUMENT',
      targetName: doc.documentName,
      details: { category: doc.category, driveFileId: doc.driveFileId }
    });

    return { success: true, message: `Document '${doc.documentName}' restored successfully.` };
  },

  /**
   * Permanently delete a document from database and move Drive file to trash.
   */
  purgeDocument(sessionToken, documentId) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const doc = findRecord(SHEETS.DOCUMENTS, d => d.documentId === documentId);
    if (!doc) throw new Error('Document record not found.');

    return withScriptLock(() => {
      // 1. Move Drive file to trash if exists
      if (doc.driveFileId) {
        try { DriveApp.getFileById(doc.driveFileId).setTrashed(true); } catch (e) {
          console.warn('Drive file trash warning:', e);
        }
      }

      // 2. Clean up Favorites and Recents
      const favs = filterRecords(SHEETS.FAVORITES, f => f.documentId === documentId);
      favs.forEach(f => { try { deleteRecordByRow(SHEETS.FAVORITES, f._rowNumber); } catch (e) {} });
      const recs = filterRecords(SHEETS.RECENTS, r => r.documentId === documentId);
      recs.forEach(r => { try { deleteRecordByRow(SHEETS.RECENTS, r._rowNumber); } catch (e) {} });

      // 3. Delete document row permanently
      deleteRecordByRow(SHEETS.DOCUMENTS, doc._rowNumber);

      AuditService.log({
        userId: admin.user.userId,
        userEmail: admin.user.email,
        userName: admin.user.fullName,
        role: admin.user.role,
        action: 'PURGE_DOCUMENT',
        status: 'SUCCESS',
        projectId: doc.projectId,
        documentId: documentId,
        targetType: 'DOCUMENT',
        targetName: doc.documentName,
        details: { category: doc.category, driveFileId: doc.driveFileId }
      });

      return { success: true, message: `Document '${doc.documentName}' permanently deleted.` };
    });
  },

  /**
   * Empty entire Trash Repository permanently.
   */
  emptyTrash(sessionToken) {
    const admin = AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const trashedDocs = filterRecords(SHEETS.DOCUMENTS, d => String(d.isDeleted) === 'true');
    if (trashedDocs.length === 0) return { success: true, purgedCount: 0, message: 'Trash is already empty.' };

    return withScriptLock(() => {
      let purgedCount = 0;
      // Process in reverse row order to maintain stable row indices
      const sortedTrashed = trashedDocs.slice().sort((a, b) => b._rowNumber - a._rowNumber);

      sortedTrashed.forEach(doc => {
        if (doc.driveFileId) {
          try { DriveApp.getFileById(doc.driveFileId).setTrashed(true); } catch (e) {}
        }
        deleteRecordByRow(SHEETS.DOCUMENTS, doc._rowNumber);
        purgedCount++;
      });

      AuditService.log({
        userId: admin.user.userId,
        userEmail: admin.user.email,
        userName: admin.user.fullName,
        role: admin.user.role,
        action: 'EMPTY_TRASH',
        status: 'SUCCESS',
        targetType: 'TRASH_REPOSITORY',
        targetName: 'Empty Trash Action',
        details: { purgedCount: purgedCount }
      });

      return { success: true, purgedCount, message: `Permanently removed ${purgedCount} documents from Trash.` };
    });
  },

  /**
   * Get all trashed documents with project details.
   */
  getTrashDocuments(sessionToken) {
    AuthService.assertRole(sessionToken, USER_ROLES.SUPER_ADMIN);
    const trashedDocs = filterRecords(SHEETS.DOCUMENTS, d => String(d.isDeleted) === 'true');
    if (trashedDocs.length === 0) return [];

    const allProjects = readAllRecords(SHEETS.PROJECTS);
    const projectMap = {};
    allProjects.forEach(p => { projectMap[p.projectId] = p; });

    const results = trashedDocs.map(d => {
      const prj = projectMap[d.projectId];
      return Object.assign({}, d, {
        projectCode: prj ? prj.projectCode : '—',
        projectName: prj ? prj.projectName : 'Unknown Project',
        partner: prj ? prj.partner : '—'
      });
    });

    results.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    return results;
  }
};

// ============================================================================
// SECTION 10: API GATEWAY & RPC ENDPOINTS FOR HTMLSERVICE
// ============================================================================

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle(DMS_CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiResponseSuccess(data, message) { return { success: true, data: data || null, message: message || 'OK' }; }
function apiResponseError(errCode, errMessage) { return { success: false, error: { code: errCode || 'ERR_GENERAL', message: errMessage || 'Server error.' } }; }

function apiLogin(credentials) {
  try {
    const creds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
    return apiResponseSuccess(AuthService.authenticate(creds.email, creds.password, creds.userAgent));
  } catch (err) { return apiResponseError('ERR_LOGIN_FAILED', err.message); }
}

function apiLogout(sessionToken) {
  try {
    AuthService.invalidateToken(sessionToken);
    return apiResponseSuccess(true);
  } catch (err) { return apiResponseError('ERR_LOGOUT_FAILED', err.message); }
}

function apiValidateSession(sessionToken) {
  try {
    const res = AuthService.validateSession(sessionToken);
    if (!res.valid) return apiResponseError(res.error, 'Invalid session.');
    return apiResponseSuccess(res);
  } catch (err) { return apiResponseError('ERR_SESSION_CHECK', err.message); }
}

function apiChangePassword(payload) {
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return apiResponseSuccess(AuthService.changePassword(data.sessionToken, data.currentPassword, data.newPassword));
  } catch (err) { return apiResponseError('ERR_PASSWORD_CHANGE', err.message); }
}

function apiGetUsers(sessionToken) {
  try { return apiResponseSuccess(UserService.getUsers(sessionToken)); } catch (err) { return apiResponseError('ERR_GET_USERS', err.message); }
}

function apiCreateUser(sessionToken, userData) {
  try {
    const data = typeof userData === 'string' ? JSON.parse(userData) : userData;
    return apiResponseSuccess(UserService.createUser(sessionToken, data));
  } catch (err) { return apiResponseError('ERR_CREATE_USER', err.message); }
}

function apiUpdateUser(sessionToken, userId, userData) {
  try {
    const data = typeof userData === 'string' ? JSON.parse(userData) : userData;
    return apiResponseSuccess(UserService.updateUser(sessionToken, userId, data));
  } catch (err) { return apiResponseError('ERR_UPDATE_USER', err.message); }
}

function apiSetUserStatus(sessionToken, userId, status) {
  try { return apiResponseSuccess(UserService.setUserStatus(sessionToken, userId, status)); } catch (err) { return apiResponseError('ERR_SET_USER_STATUS', err.message); }
}

function apiResetUserPassword(sessionToken, userId, tempPassword) {
  try { return apiResponseSuccess(UserService.resetUserPassword(sessionToken, userId, tempPassword)); } catch (err) { return apiResponseError('ERR_RESET_PASSWORD', err.message); }
}

function apiDeleteUser(sessionToken, userId) {
  try { return apiResponseSuccess(UserService.deleteUser(sessionToken, userId)); } catch (err) { return apiResponseError('ERR_DELETE_USER', err.message); }
}

function apiGetProjects(sessionToken, options) {
  try {
    const opts = typeof options === 'string' ? JSON.parse(options) : options;
    return apiResponseSuccess(ProjectService.getProjects(sessionToken, opts));
  } catch (err) { return apiResponseError('ERR_GET_PROJECTS', err.message); }
}

function apiGetProjectById(sessionToken, projectId) {
  try { return apiResponseSuccess(ProjectService.getProjectById(sessionToken, projectId)); } catch (err) { return apiResponseError('ERR_GET_PROJECT', err.message); }
}

function apiCreateProject(sessionToken, projectData) {
  try {
    const data = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;
    return apiResponseSuccess(ProjectService.createProject(sessionToken, data));
  } catch (err) { return apiResponseError('ERR_CREATE_PROJECT', err.message); }
}

function apiUpdateProject(sessionToken, projectId, projectData) {
  try {
    const data = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;
    return apiResponseSuccess(ProjectService.updateProject(sessionToken, projectId, data));
  } catch (err) { return apiResponseError('ERR_UPDATE_PROJECT', err.message); }
}

function apiArchiveProject(sessionToken, projectId) {
  try { return apiResponseSuccess(ProjectService.archiveProject(sessionToken, projectId)); } catch (err) { return apiResponseError('ERR_ARCHIVE_PROJECT', err.message); }
}

function apiGetProjectExplorerData(sessionToken, projectId) {
  try {
    return apiResponseSuccess(DocumentService.getProjectExplorerData(sessionToken, projectId));
  } catch (err) { return apiResponseError('ERR_EXPLORER_DATA', err.message); }
}

function apiUploadDocument(sessionToken, uploadPayload) {
  try {
    const data = typeof uploadPayload === 'string' ? JSON.parse(uploadPayload) : uploadPayload;
    return apiResponseSuccess(DocumentService.uploadDocument(sessionToken, data));
  } catch (err) { return apiResponseError('ERR_UPLOAD_DOCUMENT', err.message); }
}

function apiGetDocumentsByCategory(sessionToken, projectId, category) {
  try {
    return apiResponseSuccess(DocumentService.getDocumentsByCategory(sessionToken, projectId, category));
  } catch (err) { return apiResponseError('ERR_GET_CATEGORY_DOCS', err.message); }
}

function apiGetDocumentMetadata(sessionToken, documentId) {
  try {
    return apiResponseSuccess(DocumentService.getDocumentMetadata(sessionToken, documentId));
  } catch (err) { return apiResponseError('ERR_GET_DOC_METADATA', err.message); }
}

function apiOpenDocumentForReading(sessionToken, documentId) {
  try {
    return apiResponseSuccess(DocumentService.openDocumentForReading(sessionToken, documentId));
  } catch (err) { return apiResponseError('ERR_OPEN_READER', err.message); }
}

function apiUpdateDocumentMetadata(sessionToken, documentId, metaData) {
  try {
    const data = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
    return apiResponseSuccess(DocumentService.updateDocumentMetadata(sessionToken, documentId, data));
  } catch (err) { return apiResponseError('ERR_UPDATE_DOC_METADATA', err.message); }
}

function apiSearchDocuments(sessionToken, searchCriteria) {
  try {
    const criteria = typeof searchCriteria === 'string' ? JSON.parse(searchCriteria) : searchCriteria;
    return apiResponseSuccess(DocumentService.searchDocuments(sessionToken, criteria));
  } catch (err) { return apiResponseError('ERR_SEARCH_DOCS', err.message); }
}

function apiToggleFavorite(sessionToken, documentId) {
  try {
    return apiResponseSuccess(DocumentService.toggleFavorite(sessionToken, documentId));
  } catch (err) { return apiResponseError('ERR_TOGGLE_FAVORITE', err.message); }
}

function apiGetFavorites(sessionToken) {
  try {
    return apiResponseSuccess(DocumentService.getFavorites(sessionToken));
  } catch (err) { return apiResponseError('ERR_GET_FAVORITES', err.message); }
}

function apiGetRecents(sessionToken, limit) {
  try {
    return apiResponseSuccess(DocumentService.getRecents(sessionToken, limit));
  } catch (err) { return apiResponseError('ERR_GET_RECENTS', err.message); }
}

function apiSoftDeleteDocument(sessionToken, documentId) {
  try {
    return apiResponseSuccess(DocumentService.softDeleteDocument(sessionToken, documentId));
  } catch (err) { return apiResponseError('ERR_SOFT_DELETE', err.message); }
}

function apiRestoreDocument(sessionToken, documentId) {
  try {
    return apiResponseSuccess(DocumentService.restoreDocument(sessionToken, documentId));
  } catch (err) { return apiResponseError('ERR_RESTORE_DOC', err.message); }
}

function apiPurgeDocument(sessionToken, documentId) {
  try {
    return apiResponseSuccess(DocumentService.purgeDocument(sessionToken, documentId));
  } catch (err) { return apiResponseError('ERR_PURGE_DOC', err.message); }
}

function apiEmptyTrash(sessionToken) {
  try {
    return apiResponseSuccess(DocumentService.emptyTrash(sessionToken));
  } catch (err) { return apiResponseError('ERR_EMPTY_TRASH', err.message); }
}

function apiGetTrashDocuments(sessionToken) {
  try {
    return apiResponseSuccess(DocumentService.getTrashDocuments(sessionToken));
  } catch (err) { return apiResponseError('ERR_GET_TRASH', err.message); }
}

function apiGetAuditLogs(sessionToken, options) {
  try {
    const opts = typeof options === 'string' ? JSON.parse(options) : options;
    return apiResponseSuccess(AuditService.getAuditLogs(sessionToken, opts));
  } catch (err) { return apiResponseError('ERR_GET_AUDIT_LOGS', err.message); }
}

function apiGetSystemConfigs(sessionToken) {
  try {
    return apiResponseSuccess(ConfigService.getAll(sessionToken));
  } catch (err) { return apiResponseError('ERR_GET_CONFIGS', err.message); }
}

function apiUpdateSystemConfigs(sessionToken, configsData) {
  try {
    const data = typeof configsData === 'string' ? JSON.parse(configsData) : configsData;
    return apiResponseSuccess(ConfigService.updateConfigs(sessionToken, data));
  } catch (err) { return apiResponseError('ERR_UPDATE_CONFIGS', err.message); }
}

// ============================================================================
// SECTION 11: INITIALIZATION & BOOTSTRAP (setupDMS)
// ============================================================================

function setupDMS() {
  console.log('=== Starting setupDMS() Initialization ===');
  const ss = getDatabaseSpreadsheet();
  
  Object.keys(TABLE_SCHEMAS).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    const expectedHeaders = TABLE_SCHEMAS[sheetName];
    if (!sheet) sheet = ss.insertSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow === 0 || lastCol === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      formatSheetHeaders(sheet, expectedHeaders.length);
    }
  });
  
  const rootFolder = DriveService.getOrCreateRootFolder();
  AuditService.log({ action: 'SYSTEM_INITIALIZED', status: 'SUCCESS' });
  return { success: true, rootFolderId: rootFolder.getId() };
}

function formatSheetHeaders(sheet, columnCount) {
  const headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange.setBackground('#0A192F');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function bootstrapFirstAdmin(email, tempPassword) {
  return withScriptLock(() => {
    setupDMS();
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = findRecord(SHEETS.USERS, u => u.email.toLowerCase() === cleanEmail);
    const hash = hashPassword(tempPassword, generateSalt());
    if (existing) {
      updateRecordByRow(SHEETS.USERS, existing._rowNumber, { role: USER_ROLES.SUPER_ADMIN, passwordHash: hash, status: USER_STATUSES.ACTIVE, mustChangePassword: true });
    } else {
      appendRecord(SHEETS.USERS, {
        userId: generateId('USR'), email: cleanEmail, fullName: 'Primary Administrator', role: USER_ROLES.SUPER_ADMIN, passwordHash: hash, status: USER_STATUSES.ACTIVE, mustChangePassword: true, createdAt: new Date().toISOString()
      });
    }
    return { success: true };
  });
}

// ============================================================================
// SECTION 12: AUTOMATED MAINTENANCE JOBS & TIME-DRIVEN TRIGGERS (Phase 11)
// ============================================================================

/**
 * Installs daily automated triggers for enterprise retention & expiry monitoring.
 * Run once during deployment or via admin console.
 */
function installTriggers() {
  uninstallTriggers();
  
  // 1. Daily Retention Purge: Runs every day at 02:00 AM
  ScriptApp.newTrigger('dailyRetentionPurgeJob')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();

  // 2. Daily Contract Expiry Monitoring: Runs every day at 06:00 AM
  ScriptApp.newTrigger('dailyContractExpiryJob')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();

  AuditService.log({
    action: 'TRIGGERS_INSTALLED',
    status: 'SUCCESS',
    details: { triggers: ['dailyRetentionPurgeJob (02:00)', 'dailyContractExpiryJob (06:00)'] }
  });

  return { success: true, message: 'Automated time-driven triggers installed successfully.' };
}

/**
 * Removes all active triggers associated with this project.
 */
function uninstallTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  return { success: true, count: triggers.length };
}

/**
 * Automated cron job: purges soft-deleted documents exceeding retention schedule.
 */
function dailyRetentionPurgeJob() {
  console.log('=== [CRON] Starting dailyRetentionPurgeJob ===');
  return withScriptLock(() => {
    const retentionDaysStr = ConfigService.get('TRASH_RETENTION_DAYS', '30');
    const retentionDays = parseInt(retentionDaysStr, 10) || 30;
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const sheet = getDatabaseSpreadsheet().getSheetByName(SHEETS.DOCUMENTS);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const isDelIdx = headers.indexOf('isDeleted');
    const delAtIdx = headers.indexOf('deletedAt');
    const driveIdIdx = headers.indexOf('driveFileId');
    const docIdIdx = headers.indexOf('documentId');
    const nameIdx = headers.indexOf('documentName');

    let purgedCount = 0;
    // Iterate backwards to safely delete rows
    for (let r = data.length - 1; r >= 1; r--) {
      const row = data[r];
      const isDel = row[isDelIdx] === true || String(row[isDelIdx]).toLowerCase() === 'true';
      if (!isDel) continue;

      const delAt = row[delAtIdx] ? new Date(row[delAtIdx]).getTime() : 0;
      if (delAt > 0 && delAt < cutoffTime) {
        const driveFileId = row[driveIdIdx];
        const docId = row[docIdIdx];
        const docName = row[nameIdx];

        // Delete from Drive
        if (driveFileId) {
          try {
            DriveApp.getFileById(driveFileId).setTrashed(true);
          } catch (e) {
            console.warn(`Could not trash Drive file ${driveFileId}: ${e.message}`);
          }
        }

        // Delete row
        sheet.deleteRow(r + 1);
        purgedCount++;

        AuditService.log({
          action: 'AUTO_PURGE_RETENTION',
          targetType: 'DOCUMENT',
          targetName: docName || docId,
          documentId: docId,
          status: 'SUCCESS',
          details: { retentionDays, deletedAt: row[delAtIdx] }
        });
      }
    }

    console.log(`=== [CRON] dailyRetentionPurgeJob completed. Purged: ${purgedCount} documents ===`);
    return { success: true, purgedCount };
  });
}

/**
 * Automated cron job: inspects document expiration dates and records alerts.
 */
function dailyContractExpiryJob() {
  console.log('=== [CRON] Starting dailyContractExpiryJob ===');
  const alertDaysStr = ConfigService.get('EXPIRY_ALERT_DAYS', '30');
  const alertDays = parseInt(alertDaysStr, 10) || 30;
  const now = Date.now();
  const alertThreshold = now + (alertDays * 24 * 60 * 60 * 1000);

  const docs = getAllRecords(SHEETS.DOCUMENTS);
  let expiringCount = 0;
  let expiredCount = 0;

  docs.forEach(doc => {
    if (doc.isDeleted === true || String(doc.isDeleted).toLowerCase() === 'true') return;
    if (!doc.expiryDate) return;

    const expiryTime = new Date(doc.expiryDate).getTime();
    if (isNaN(expiryTime)) return;

    if (expiryTime < now) {
      expiredCount++;
    } else if (expiryTime <= alertThreshold) {
      expiringCount++;
    }
  });

  AuditService.log({
    action: 'EXPIRY_AUDIT_CHECK',
    targetType: 'SYSTEM_MONITOR',
    targetName: 'Daily Contract Expiration Scan',
    status: 'SUCCESS',
    details: {
      alertWindowDays: alertDays,
      activeExpiringCount: expiringCount,
      activeExpiredCount: expiredCount
    }
  });

  console.log(`=== [CRON] dailyContractExpiryJob finished. Expiring soon: ${expiringCount}, Already expired: ${expiredCount} ===`);
  return { success: true, expiringCount, expiredCount };
}

