const API = import.meta.env.VITE_API_URL || "/api";

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(t) {
  localStorage.setItem("token", t);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export async function apiFetch(
  path,
  { token = getToken(), method = "GET", body, requireAuth = true } = {}
) {
  if (requireAuth && !token) {
    return Promise.reject(new Error("Missing token"));
  }

  const headers = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "ngrok-skip-browser-warning": "true",
  };

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
    }

    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data; // blocking_dependencies gibi ekstra bilgileri burada taşıyoruz
    throw err;
  }

  return data;
}

// AUTH
export function loginUser(email, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: { email, password },
    requireAuth: false,
  });
}

export function registerUser(full_name, email, password) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: { full_name, email, password },
    requireAuth: false,
  });
}

// COMMENTS
export function createTaskComment(projectId, taskId, body) {
  return apiFetch(`/projects/${projectId}/tasks/${taskId}/comments`, {
    method: "POST",
    body: { body },
  });
}

export function getTaskComments(projectId, taskId, { all = false } = {}) {
  const qs = all ? "?all=1" : "";
  return apiFetch(`/projects/${projectId}/tasks/${taskId}/comments${qs}`);
}

export function deleteTaskComment(projectId, taskId, commentId) {
  return apiFetch(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function updateTaskComment(projectId, taskId, commentId, body) {
  return apiFetch(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
    method: "PATCH",
    body: { body },
  });
}

// PROJECTS
export function updateProject(projectId, body) {
  return apiFetch(`/projects/${projectId}`, {
    method: "PATCH",
    body,
  });
}

export function getProjectSummary(projectId) {
  return apiFetch(`/projects/${projectId}/summary`);
}

export function getProjectMembers(projectId) {
  return apiFetch(`/projects/${projectId}/members`);
}

export function addProjectMember(projectId, body) {
  return apiFetch(`/projects/${projectId}/members`, {
    method: "POST",
    body,
  });
}

export function sendJoinRequest(join_code) {
  return apiFetch("/projects/join", {
    method: "POST",
    body: { join_code },
  });
}

export function getMyJoinRequests() {
  return apiFetch("/projects/my-join-requests");
}

export function getProjectJoinRequests(projectId) {
  return apiFetch(`/projects/${projectId}/join-requests`);
}

export function approveProjectJoinRequest(requestId) {
  return apiFetch(`/projects/join-requests/${requestId}/approve`, {
    method: "PATCH",
  });
}

export function rejectProjectJoinRequest(requestId) {
  return apiFetch(`/projects/join-requests/${requestId}/reject`, {
    method: "PATCH",
  });
}

// DASHBOARD
export function getDashboardSummary() {
  return apiFetch("/dashboard/summary");
}

// NOTIFICATIONS
export function getNotifications(limit = 10) {
  return apiFetch(`/notifications?limit=${limit}`);
}

export function getAllNotifications() {
  return apiFetch("/notifications?limit=100");
}

export function getUnreadNotificationCount() {
  return apiFetch("/notifications/unread-count");
}

export function markNotificationRead(notificationId) {
  return apiFetch(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return apiFetch("/notifications/read-all", {
    method: "PATCH",
  });
}

// USERS
export function searchUsers(q, projectId) {
  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (projectId) params.set("projectId", projectId);

  const query = params.toString();
  return apiFetch(`/users/search${query ? `?${query}` : ""}`);
}

export function getMyProfile() {
  return apiFetch("/users/me");
}

export function getUserProfile(userId) {
  return apiFetch(`/users/${userId}/profile`);
}

export function getProjectChatMessages(projectId) {
  return apiFetch(`/projects/${projectId}/chat`);
}

export function sendProjectChatMessage(projectId, message) {
  return apiFetch(`/projects/${projectId}/chat`, {
    method: "POST",
    body: { message },
  });
}

export function updateMyEmail(email) {
  return apiFetch("/users/me/email", {
    method: "PATCH",
    body: { email },
  });
}

export function getProjectAttachments(projectId) {
  return apiFetch(`/projects/${projectId}/attachments`);
}

export async function uploadProjectAttachment(projectId, taskId, file) {
  const token = getToken();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("task_id", taskId);

  const API = import.meta.env.VITE_API_URL || "/api";

  const res = await fetch(`${API}/projects/${projectId}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Dosya yüklenemedi");
  }

  return data;
}

export function deleteAttachment(attachmentId) {
  return apiFetch(`/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}

export function attachmentViewUrl(attachmentId) {
  const API = import.meta.env.VITE_API_URL || "/api";
  return `${API}/attachments/${attachmentId}/view`;
}

export function attachmentDownloadUrl(attachmentId) {
  const API = import.meta.env.VITE_API_URL || "/api";
  return `${API}/attachments/${attachmentId}/download`;
}

export async function getTaskCodeSubmissions(taskId) {
  return apiFetch(`/tasks/${taskId}/code-submissions`);
}


export async function getProjectCodeSubmissions(projectId) {
  return apiFetch(`/projects/${projectId}/code-submissions`);
}

export async function uploadTaskCodeSubmission(taskId, file, description = "") {
  const token = getToken();
  const API = import.meta.env.VITE_API_URL || "/api";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("description", description);

  const res = await fetch(`${API}/tasks/${taskId}/code-submissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || "Kod dosyası yüklenemedi.");
  }

  return data;
}

export async function deleteTaskCodeSubmission(submissionId) {
  return apiFetch(`/code-submissions/${submissionId}`, {
    method: "DELETE",
  });
}

export function taskCodeDownloadUrl(submissionId) {
  const API = import.meta.env.VITE_API_URL || "/api";
  return `${API}/code-submissions/${submissionId}/download`;
}

export async function summarizeTaskCodeSubmission(submissionId) {
  return apiFetch(`/code-submissions/${submissionId}/summarize`, {
    method: "POST",
  });
}

export async function generateCommitSummary(submissionId) {
  return apiFetch(
    `/code-submissions/${submissionId}/generate-commit`,
    {
      method: "POST",
    }
  );
}