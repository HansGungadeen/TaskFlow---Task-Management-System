export type TeamRole = 'admin' | 'member' | 'viewer';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
  updated_at: string;
  // Joined fields
  user_name?: string;
  user_email?: string;
  user_avatar_url?: string;
}

export const ROLE_PERMISSIONS = {
  admin: {
    canViewTasks: true,
    canCreateTasks: true,
    canUpdateTasks: true,
    canDeleteTasks: true,
    canManageTeam: true,
    canInviteMembers: true,
    canAssignRoles: true
  },
  member: {
    canViewTasks: true,
    canCreateTasks: true,
    canUpdateTasks: true,
    canDeleteTasks: false,
    canManageTeam: false,
    canInviteMembers: true,
    canAssignRoles: false
  },
  viewer: {
    canViewTasks: true,
    canCreateTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canManageTeam: false,
    canInviteMembers: false,
    canAssignRoles: false
  }
}; 