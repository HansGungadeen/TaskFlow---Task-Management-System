"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { Team, TeamRole, TeamMember, ROLE_PERMISSIONS } from "@/types/teams";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Users,
  UserPlus,
  Trash2,
  Edit,
  PlusCircle,
  UserCog,
  Building2,
} from "lucide-react";

type TeamWithRole = Team & {
  memberRole?: TeamRole;
};

type TeamManagementProps = {
  ownedTeams: Team[];
  memberTeams: TeamWithRole[];
  currentUserId: string;
};

export default function TeamManagement({
  ownedTeams,
  memberTeams,
  currentUserId,
}: TeamManagementProps) {
  const [teams, setTeams] = useState<Team[]>(ownedTeams);
  const [teamsAsMember, setTeamsAsMember] = useState<TeamWithRole[]>(memberTeams);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isViewingMembers, setIsViewingMembers] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>("member");
  const [newTeam, setNewTeam] = useState({
    name: "",
    description: "",
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const supabase = createClient();

  // Set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
    // Load member teams data when component mounts
    if (currentUserId) {
      loadMemberTeams();
    }
  }, [currentUserId]);

  // Load teams that the user is a member of
  const loadMemberTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("team_members_with_users")
        .select(`
          *,
          teams:team_id (*)
        `)
        .eq("user_id", currentUserId);

      if (error) throw error;

      if (data && data.length > 0) {
        // Process the data to get the team information with the user's role
        const formattedTeams = data.map(member => ({
          ...member.teams,
          memberRole: member.role
        }));
        
        setTeamsAsMember(formattedTeams);
      }
    } catch (error) {
      console.error("Error loading member teams:", error);
    }
  };

  // Fetch team members when a team is selected for viewing
  const loadTeamMembers = async (teamId: string) => {
    if (!teamId) {
      console.error("Tried to load team members with undefined team ID");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("team_members_with_users")
        .select("*")
        .eq("team_id", teamId);

      if (error) throw error;

      setTeamMembers(data);
    } catch (error) {
      console.error("Error loading team members:", error);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) return;

    try {
      const { data, error } = await supabase
        .from("teams")
        .insert([
          {
            name: newTeam.name.trim(),
            description: newTeam.description.trim() || null,
            created_by: currentUserId,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        // Add the creator as an admin
        const { error: memberError } = await supabase
          .from("team_members")
          .insert([
            {
              team_id: data[0].id,
              user_id: currentUserId,
              role: "admin",
            },
          ]);

        if (memberError) throw memberError;

        setTeams([data[0], ...teams]);
        setNewTeam({
          name: "",
          description: "",
        });
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Error creating team:", error);
    }
  };

  const handleUpdateTeam = async () => {
    if (!currentTeam || !currentTeam.name.trim()) return;

    try {
      const { data, error } = await supabase
        .from("teams")
        .update({
          name: currentTeam.name.trim(),
          description: currentTeam.description || null,
        })
        .eq("id", currentTeam.id)
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setTeams(
          teams.map((team) => (team.id === currentTeam.id ? data[0] : team))
        );
        setIsEditing(false);
        setCurrentTeam(null);
      }
    } catch (error) {
      console.error("Error updating team:", error);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);

      if (error) throw error;

      setTeams(teams.filter((team) => team.id !== teamId));
    } catch (error) {
      console.error("Error deleting team:", error);
    }
  };

  const handleSearchUser = async (email: string) => {
    if (!email.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("id, email, name, avatar_url")
        .ilike("email", `%${email}%`)
        .limit(5);

      if (error) throw error;

      setSearchResults(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMember = async (userId: string, teamId: string) => {
    try {
      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId)
        .eq("user_id", userId);

      if (checkError) throw checkError;

      if (existingMember && existingMember.length > 0) {
        alert("User is already a team member");
        return;
      }

      const { error } = await supabase.from("team_members").insert([
        {
          team_id: teamId,
          user_id: userId,
          role: newMemberRole,
        },
      ]);

      if (error) {
        console.error("Error adding team member:", error);
        alert(`Error adding team member: ${error.message}`);
        return;
      }

      // Reload team members
      await loadTeamMembers(teamId);
      setNewMemberEmail("");
      setNewMemberRole("member");
      setIsAddingMember(false);
    } catch (error: any) {
      console.error("Error adding team member:", error);
      alert(`Error adding team member: ${error.message || 'Unknown error'}`);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: TeamRole) => {
    try {
      const { error } = await supabase
        .from("team_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      setTeamMembers(
        teamMembers.map((member) =>
          member.id === memberId ? { ...member, role: newRole } : member
        )
      );
    } catch (error) {
      console.error("Error updating member role:", error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      setTeamMembers(teamMembers.filter((member) => member.id !== memberId));
    } catch (error) {
      console.error("Error removing team member:", error);
    }
  };

  // Alternative method if the view approach doesn't work
  const handleAddMemberAlternative = async (userId: string, teamId: string) => {
    try {
      // Check if teamId is valid
      if (!teamId) {
        console.error("Cannot add member: Team ID is missing");
        alert("Cannot add member: Team ID is missing");
        return;
      }
      
      // Direct insert without relying on relationships
      const { error } = await supabase.rpc('add_team_member', {
        p_team_id: teamId,
        p_user_id: userId,
        p_role: newMemberRole
      });

      if (error) {
        console.error("Error adding team member:", error);
        alert(`Error adding team member: ${error.message}`);
        return;
      }

      // Reload team members
      await loadTeamMembers(teamId);
      setNewMemberEmail("");
      setNewMemberRole("member");
      setIsAddingMember(false);
    } catch (error: any) {
      console.error("Error adding team member:", error);
      alert(`Error adding team member: ${error.message || 'Unknown error'}`);
    }
  };

  // Role badge component with appropriate colors
  const RoleBadge = ({ role }: { role: TeamRole }) => {
    let colorClass = "";
    switch (role) {
      case "admin":
        colorClass = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
        break;
      case "member":
        colorClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
        break;
      case "viewer":
        colorClass = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
        break;
    }

    return (
      <Badge variant="outline" className={`${colorClass}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  // Function to safely set current team and load members
  const viewTeamMembers = (team: Team) => {
    if (!team?.id) {
      console.error("Cannot view team members: Team ID is missing");
      return;
    }
    
    setCurrentTeam(team);
    loadTeamMembers(team.id);
    setIsViewingMembers(true);
  };

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <Tabs defaultValue="my-teams" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-teams" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>My Teams</span>
          </TabsTrigger>
          <TabsTrigger value="member-teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Teams I'm In</span>
          </TabsTrigger>
        </TabsList>

        {/* My Teams Tab */}
        <TabsContent value="my-teams" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Teams You Own</h3>
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  <span>Create Team</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Team</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="team-name">Team Name</Label>
                    <Input
                      id="team-name"
                      placeholder="Enter team name"
                      value={newTeam.name}
                      onChange={(e) =>
                        setNewTeam({ ...newTeam, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-description">Description (Optional)</Label>
                    <Textarea
                      id="team-description"
                      placeholder="Enter team description"
                      value={newTeam.description}
                      onChange={(e) =>
                        setNewTeam({ ...newTeam, description: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTeam} disabled={!newTeam.name.trim()}>
                    Create Team
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {teams.length === 0 ? (
            <div className="text-center p-8 border rounded-md bg-muted/30">
              <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <h3 className="text-lg font-medium">No teams yet</h3>
              <p className="text-muted-foreground mb-4">
                Create a team to start collaborating with others
              </p>
              <Button
                variant="outline"
                onClick={() => setIsCreating(true)}
                className="gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Create Team
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <Card key={team.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle>{team.name}</CardTitle>
                    {team.description && (
                      <CardDescription>{team.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="text-sm pb-2">
                    <div className="flex flex-col gap-2">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => viewTeamMembers(team)}
                        >
                          Manage Team Members
                        </Button>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Created:{" "}
                        {new Date(team.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentTeam(team);
                        setIsEditing(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {team.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the team and remove all
                            members. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTeam(team.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Teams I'm In Tab */}
        <TabsContent value="member-teams" className="space-y-4">
          <h3 className="text-xl font-semibold">Teams You're A Member Of</h3>
          {teamsAsMember.length === 0 ? (
            <div className="text-center p-8 border rounded-md bg-muted/30">
              <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <h3 className="text-lg font-medium">Not a member of any teams</h3>
              <p className="text-muted-foreground">
                You'll see teams here when you're invited to join one
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teamsAsMember.map((team) => (
                <Card key={team.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle>{team.name}</CardTitle>
                      {team.memberRole && <RoleBadge role={team.memberRole} />}
                    </div>
                    {team.description && (
                      <CardDescription>{team.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground pb-2">
                    <div className="flex flex-col gap-2">
                      <span>
                        {team.memberRole && (
                          <div className="text-xs">
                            Your permissions:
                            <ul className="list-disc list-inside mt-1 ml-2">
                              {Object.entries(ROLE_PERMISSIONS[team.memberRole])
                                .filter(([_, value]) => value)
                                .map(([key]) => (
                                  <li key={key}>
                                    {key
                                      .replace(/([A-Z])/g, " $1")
                                      .replace(/^./, (str) => str.toUpperCase())
                                      .replace("Can ", "")}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </span>
                      <span className="text-xs">
                        Joined: {new Date(team.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => viewTeamMembers(team)}
                    >
                      View Team
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Team Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team Name</Label>
              <Input
                id="edit-team-name"
                placeholder="Enter team name"
                value={currentTeam?.name || ""}
                onChange={(e) =>
                  setCurrentTeam(
                    currentTeam
                      ? { ...currentTeam, name: e.target.value }
                      : null
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-description">
                Description (Optional)
              </Label>
              <Textarea
                id="edit-team-description"
                placeholder="Enter team description"
                value={currentTeam?.description || ""}
                onChange={(e) =>
                  setCurrentTeam(
                    currentTeam
                      ? { ...currentTeam, description: e.target.value }
                      : null
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTeam}
              disabled={!currentTeam?.name?.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Team Members Dialog */}
      <Dialog
        open={isViewingMembers}
        onOpenChange={(open) => {
          setIsViewingMembers(open);
          if (!open) {
            setTeamMembers([]);
            setCurrentTeam(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Team Members - {currentTeam?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-medium">
                {teamMembers.length} Members
              </h4>
              <Dialog open={isAddingMember} onOpenChange={(open) => {
                // Only allow opening if we have a current team
                if (open && !currentTeam?.id) {
                  alert("Please select a team first");
                  return;
                }
                setIsAddingMember(open);
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2" disabled={!currentTeam?.id}>
                    <UserPlus className="h-4 w-4" />
                    <span>Add Member</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="member-email">User Email</Label>
                      <div className="flex gap-2">
                        <Input
                          id="member-email"
                          placeholder="Enter user email"
                          value={newMemberEmail}
                          onChange={(e) => {
                            setNewMemberEmail(e.target.value);
                            handleSearchUser(e.target.value);
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleSearchUser(newMemberEmail)}
                        >
                          Search
                        </Button>
                      </div>
                    </div>

                    {searchResults.length > 0 && (
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {searchResults.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell>{user.name || "N/A"}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (!currentTeam?.id) {
                                        alert("Please select a team first");
                                        return;
                                      }
                                      handleAddMemberAlternative(
                                        user.id,
                                        currentTeam.id
                                      );
                                    }}
                                  >
                                    Add
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="member-role">Role</Label>
                      <Select
                        value={newMemberRole}
                        onValueChange={(value) =>
                          setNewMemberRole(value as TeamRole)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <h5 className="font-medium mb-1">Role Permissions:</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <strong>Admin:</strong>
                          <ul className="list-disc list-inside text-xs">
                            <li>Full access</li>
                            <li>Manage team</li>
                            <li>Delete tasks</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Member:</strong>
                          <ul className="list-disc list-inside text-xs">
                            <li>Create tasks</li>
                            <li>Update tasks</li>
                            <li>Invite members</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Viewer:</strong>
                          <ul className="list-disc list-inside text-xs">
                            <li>View tasks only</li>
                            <li>No edit permissions</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddingMember(false)}
                    >
                      Cancel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {teamMembers.length === 0 ? (
              <div className="text-center p-8 border rounded-md bg-muted/30">
                <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                <h3 className="text-lg font-medium">No team members</h3>
                <p className="text-muted-foreground mb-4">
                  Add members to start collaborating
                </p>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => {
                      const isCurrentUser = member.user_id === currentUserId;
                      const isAdmin =
                        teamMembers.find(
                          (m) => m.user_id === currentUserId
                        )?.role === "admin";

                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.user_name}
                            {isCurrentUser && " (You)"}
                          </TableCell>
                          <TableCell>{member.user_email}</TableCell>
                          <TableCell>
                            {isAdmin && !isCurrentUser ? (
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  handleUpdateMemberRole(
                                    member.id,
                                    value as TeamRole
                                  )
                                }
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <RoleBadge role={member.role as TeamRole} />
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdmin && !isCurrentUser && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Remove Member
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove{" "}
                                      {member.user_name} from the team?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleRemoveMember(member.id)
                                      }
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 