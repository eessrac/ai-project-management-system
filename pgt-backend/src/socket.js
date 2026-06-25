const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const pool = require("./config/db.js");

let ioInstance = null;

// userId -> Set(socketId)
const onlineUsers = new Map();

function addOnlineUser(userId, socketId) {
  const key = String(userId);
  if (!onlineUsers.has(key)) {
    onlineUsers.set(key, new Set());
  }
  onlineUsers.get(key).add(socketId);
}

function removeOnlineUser(userId, socketId) {
  const key = String(userId);
  if (!onlineUsers.has(key)) return false;

  const sockets = onlineUsers.get(key);
  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(key);
    return true; // tamamen offline oldu
  }

  return false;
}

function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

async function getProjectMemberIds(projectId) {
  const q = await pool.query(
    `
    SELECT user_id
    FROM project_members
    WHERE project_id = $1
    `,
    [projectId]
  );

  return q.rows.map((r) => String(r.user_id));
}

async function emitProjectPresence(projectId) {
  const memberIds = await getProjectMemberIds(projectId);

  const onlineUserIds = memberIds.filter((userId) => isUserOnline(userId));

  ioInstance.to(`project:${projectId}`).emit("project:online-users", {
    projectId,
    onlineUserIds,
  });
}

function initSocket(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        process.env.FRONTEND_URL,
        "https://genically-multivariate-renita.ngrok-free.dev",
        "https://pgt-frontend.vercel.app",
      ].filter(Boolean),
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Missing token"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        ...decoded,
        userId: decoded.userId || decoded.id || decoded.sub,
      };

      if (!socket.user.userId) {
        return next(new Error("Invalid token payload"));
      }

      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.user?.userId;
    if (userId) {
      addOnlineUser(userId, socket.id);
    }

    socket.on("join-project-room", async ({ projectId }) => {
      try {
        if (!projectId || !socket.user?.userId) return;

        const q = await pool.query(
          `
          SELECT 1
          FROM project_members
          WHERE project_id = $1 AND user_id = $2
          LIMIT 1
          `,
          [projectId, socket.user.userId]
        );

        if (!q.rows.length) return;

        socket.join(`project:${projectId}`);

        if (!socket.joinedProjects) {
          socket.joinedProjects = new Set();
        }
        socket.joinedProjects.add(String(projectId));

        await emitProjectPresence(projectId);
      } catch (err) {
        console.error("JOIN PROJECT ROOM ERROR:", err);
      }
    });

    socket.on("leave-project-room", async ({ projectId }) => {
      try {
        if (!projectId) return;

        socket.leave(`project:${projectId}`);

        if (socket.joinedProjects) {
          socket.joinedProjects.delete(String(projectId));
        }

        // typing temizliği
        socket.to(`project:${projectId}`).emit("project-chat:typing-stop", {
          projectId,
          userId: socket.user?.userId,
        });

        await emitProjectPresence(projectId);
      } catch (err) {
        console.error("LEAVE PROJECT ROOM ERROR:", err);
      }
    });

    socket.on("project-chat:typing", async ({ projectId }) => {
      try {
        if (!projectId || !socket.user?.userId) return;

        socket.to(`project:${projectId}`).emit("project-chat:typing", {
          projectId,
          userId: socket.user.userId,
        });
      } catch (err) {
        console.error("PROJECT CHAT TYPING ERROR:", err);
      }
    });

    socket.on("project-chat:typing-stop", async ({ projectId }) => {
      try {
        if (!projectId || !socket.user?.userId) return;

        socket.to(`project:${projectId}`).emit("project-chat:typing-stop", {
          projectId,
          userId: socket.user.userId,
        });
      } catch (err) {
        console.error("PROJECT CHAT TYPING STOP ERROR:", err);
      }
    });

    socket.on("disconnect", async () => {
      try {
        const wentOffline = removeOnlineUser(socket.user?.userId, socket.id);

        if (socket.joinedProjects?.size) {
          for (const projectId of socket.joinedProjects) {
            socket.to(`project:${projectId}`).emit("project-chat:typing-stop", {
              projectId,
              userId: socket.user?.userId,
            });

            await emitProjectPresence(projectId);
          }
        } else if (wentOffline) {
          // joinedProjects yoksa bir şey yapmadan geç
        }
      } catch (err) {
        console.error("SOCKET DISCONNECT ERROR:", err);
      }
    });
  });

  return ioInstance;
}

function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized");
  }
  return ioInstance;
}

function emitProjectEvent(projectId, eventName, payload = {}) {
  if (!ioInstance) return;

  ioInstance.to(`project:${projectId}`).emit(eventName, {
    projectId,
    ...payload,
  });
}

module.exports = {
  initSocket,
  getIO,
  emitProjectEvent,
};