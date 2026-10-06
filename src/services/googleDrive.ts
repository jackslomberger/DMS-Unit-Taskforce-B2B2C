export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  shared?: boolean;
  starred?: boolean;
  owners?: Array<{ displayName: string; emailAddress: string; photoLink?: string }>;
}

export interface DriveQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
  user?: {
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  };
}

export const GoogleDriveService = {
  /**
   * Get user storage quota and profile information.
   */
  async getAbout(accessToken: string): Promise<DriveQuota> {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to fetch Drive account information.');
    }
    const data = await res.json();
    return {
      limit: data.storageQuota?.limit,
      usage: data.storageQuota?.usage,
      usageInDrive: data.storageQuota?.usageInDrive,
      usageInDriveTrash: data.storageQuota?.usageInDriveTrash,
      user: data.user,
    };
  },

  /**
   * List files or search files in Google Drive.
   */
  async listFiles(
    accessToken: string,
    options: {
      folderId?: string;
      searchQuery?: string;
      fileTypeFilter?: string;
      pageSize?: number;
      pageToken?: string;
      orderBy?: string;
    } = {}
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const qParts: string[] = ['trashed = false'];

    if (options.folderId) {
      qParts.push(`'${options.folderId}' in parents`);
    }

    if (options.searchQuery && options.searchQuery.trim()) {
      const cleanQ = options.searchQuery.replace(/'/g, "\\'");
      qParts.push(`(name contains '${cleanQ}' or fullText contains '${cleanQ}')`);
    }

    if (options.fileTypeFilter && options.fileTypeFilter !== 'ALL') {
      if (options.fileTypeFilter === 'FOLDER') {
        qParts.push("mimeType = 'application/vnd.google-apps.folder'");
      } else if (options.fileTypeFilter === 'DOCUMENT') {
        qParts.push(
          "(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/pdf' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')"
        );
      } else if (options.fileTypeFilter === 'SPREADSHEET') {
        qParts.push(
          "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'text/csv')"
        );
      } else if (options.fileTypeFilter === 'PRESENTATION') {
        qParts.push(
          "(mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')"
        );
      } else if (options.fileTypeFilter === 'IMAGE') {
        qParts.push("mimeType contains 'image/'");
      } else if (options.fileTypeFilter === 'PDF') {
        qParts.push("mimeType = 'application/pdf'");
      }
    }

    const q = qParts.join(' and ');
    const params = new URLSearchParams({
      q,
      pageSize: String(options.pageSize || 50),
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, iconLink, thumbnailLink, parents, shared, starred, owners)',
      orderBy: options.orderBy || 'folder,modifiedTime desc',
    });

    if (options.pageToken) {
      params.append('pageToken', options.pageToken);
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to list Google Drive files.');
    }

    const data = await res.json();
    return {
      files: data.files || [],
      nextPageToken: data.nextPageToken,
    };
  },

  /**
   * Create a new folder in Google Drive.
   */
  async createFolder(
    accessToken: string,
    name: string,
    parentFolderId?: string
  ): Promise<DriveFile> {
    const metadata: any = {
      name: name.trim(),
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create folder in Google Drive.');
    }

    return await res.json();
  },

  /**
   * Upload a file with multipart upload directly to Google Drive.
   */
  async uploadFile(
    accessToken: string,
    file: File,
    parentFolderId?: string
  ): Promise<DriveFile> {
    const metadata: any = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const fileBuffer = await file.arrayBuffer();
    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

    const metadataBytes = new TextEncoder().encode(metadataPart);
    const closeBytes = new TextEncoder().encode(closeDelimiter);

    const fullPayload = new Uint8Array(metadataBytes.length + fileBuffer.byteLength + closeBytes.length);
    fullPayload.set(metadataBytes, 0);
    fullPayload.set(new Uint8Array(fileBuffer), metadataBytes.length);
    fullPayload.set(closeBytes, metadataBytes.length + fileBuffer.byteLength);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,modifiedTime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to upload file to Google Drive.');
    }

    return await res.json();
  },

  /**
   * Delete a file or move to trash in Google Drive.
   */
  async deleteFile(accessToken: string, fileId: string): Promise<boolean> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to delete file from Google Drive.');
    }

    return true;
  },

  /**
   * Toggle star status on a file.
   */
  async toggleStar(accessToken: string, fileId: string, currentStarred: boolean): Promise<boolean> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ starred: !currentStarred }),
    });

    if (!res.ok) {
      throw new Error('Failed to update star status.');
    }
    return !currentStarred;
  }
};
