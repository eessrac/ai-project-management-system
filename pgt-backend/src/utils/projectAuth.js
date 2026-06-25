const pool = require("../config/db.js");

async function getProjectMembership(projectId, userId) {
  const result = await pool.query(
    `SELECT project_id, user_id, role
     FROM project_members
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );

  return result.rows[0] || null;
}

async function ensureProjectMember(projectId, userId) {
  const membership = await getProjectMembership(projectId, userId);
  return membership;
}

async function ensureLeader(projectId, userId) {
  const membership = await getProjectMembership(projectId, userId);

  if (!membership) {
    return { ok: false, reason: "NOT_MEMBER" };
  }

  if (membership.role !== "LEADER") {
    return { ok: false, reason: "NOT_LEADER", role: membership.role };
  }

  return { ok: true, membership };
}

module.exports = {
  getProjectMembership,
  ensureProjectMember,
  ensureLeader,
};
