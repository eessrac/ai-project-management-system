import { Routes, Route, Navigate } from "react-router-dom";
import { getToken } from "./api";


import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import TasksPage from "./pages/TasksPage";
import SprintsPage from "./pages/SprintsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import NewProjectPage from "./pages/NewProjectPage";
import ArchivedProjectsPage from "./pages/ArchivedProjectsPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import SprintArchivePage from "./pages/SprintArchivePage";
import NotificationsPage from "./pages/NotificationsPage";
import UserProfilePage from "./pages/UserProfilePage";

import AppLayout from "./components/AppLayout";

function Protected({ children }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnly({ children }) {
  const token = getToken();

  if (token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const isAuthed = !!getToken();

  return (
    <Routes>
      {/* Public sayfalar */}
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />

      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />

      {/* Protected + Layout */}
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        {/* Projenin ilk açılış sayfası */}
        <Route path="/" element={<HomePage />} />

        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/archived" element={<ArchivedProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
        <Route path="/projects/:id/tasks" element={<TasksPage />} />
        <Route path="/projects/:id/sprints" element={<SprintsPage />} />
        <Route
          path="/projects/:projectId/sprints/:sprintId/archive"
          element={<SprintArchivePage />}
        />

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users/:id" element={<UserProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>

      {/* Tanımsız route */}
      <Route
        path="*"
        element={<Navigate to={isAuthed ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}