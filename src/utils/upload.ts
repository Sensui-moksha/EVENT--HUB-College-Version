// XMLHttpRequest-based uploader to report progress (fetch lacks granular upload progress)

export type UploadProgressHandler = (pct: number) => void;

export function uploadFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress?: UploadProgressHandler,
  method: 'POST' | 'PATCH' | 'PUT' = 'POST'
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.upload.onprogress = (e) => {
      if (!onProgress || !e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      onProgress(pct);
    };
    xhr.onload = () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      // Wrap the raw response text so Response.json() works reliably
      resolve(new Response(xhr.responseText, { status: xhr.status, headers }));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    // Use text so we can always construct a valid Response for .json()
    xhr.responseType = 'text';
    xhr.send(formData);
  });
}
