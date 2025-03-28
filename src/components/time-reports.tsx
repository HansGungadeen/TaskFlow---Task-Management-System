"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth, subMonths, subWeeks, eachDayOfInterval, eachWeekOfInterval } from "date-fns";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Clock, Download, Users, Calendar, ListTodo } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Separator } from "./ui/separator";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { Label } from "./ui/label";
import { TimeEntry } from "@/types/tasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown, FileText, FileSpreadsheet } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Extended TimeEntry type with additional properties needed for reporting
interface ExtendedTimeEntry extends TimeEntry {
  task_title?: string;
  task_status?: string;
  team_id?: string | null;
}

type ReportPeriod = "7days" | "30days" | "90days" | "custom";
type GroupBy = "day" | "week" | "task" | "user" | "team";

type TeamInfo = {
  id: string;
  name: string;
};

type UserInfo = {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
};

interface TimeReportsProps {
  userId: string;
}

export default function TimeReports({ userId }: TimeReportsProps) {
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("7days");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<string>(
    format(subWeeks(new Date(), 1), "yyyy-MM-dd")
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState<ExtendedTimeEntry[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [tasks, setTasks] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();
  
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82ca9d"];
  
  useEffect(() => {
    fetchTeams();
    fetchReportData();
  }, [reportPeriod, groupBy, selectedTeam, customStartDate, customEndDate]);
  
  const fetchTeams = async () => {
    try {
      // Get teams the user is a member of
      const { data: userTeams, error } = await supabase
        .from("team_members")
        .select(`
          team_id,
          teams:team_id (
            id,
            name
          )
        `)
        .eq("user_id", userId);
      
      if (error) throw error;
      
      const processedTeams = userTeams
        .filter(item => item.teams)
        .map(item => ({
          id: (item.teams as any).id,
          name: (item.teams as any).name
        }));
      
      setTeams(processedTeams);
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError("Failed to load teams");
    }
  };
  
  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Determine date range based on selected period
      let startDate;
      let endDate = new Date();
      
      switch (reportPeriod) {
        case "7days":
          startDate = subWeeks(endDate, 1);
          break;
        case "30days":
          startDate = subMonths(endDate, 1);
          break;
        case "90days":
          startDate = subMonths(endDate, 3);
          break;
        case "custom":
          startDate = parseISO(customStartDate);
          endDate = parseISO(customEndDate);
          
          // Validate custom date range
          if (startDate > endDate) {
            setError("Start date must be before end date");
            setLoading(false);
            return;
          }
          break;
      }
      
      // Base query for time entries
      let query = supabase
        .from("time_entries")
        .select(`
          *,
          tasks:task_id (
            id,
            title,
            status,
            team_id
          ),
          users:user_id (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .gte("created_at", format(startDate, "yyyy-MM-dd"))
        .lte("created_at", format(endDate, "yyyy-MM-dd"));
      
      // Filter by team if selected
      if (selectedTeam) {
        query = query.eq("tasks.team_id", selectedTeam);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      if (!data || data.length === 0) {
        setTimeEntries([]);
        setChartData([]);
        setTotalHours(0);
        setLoading(false);
        return;
      }
      
      // Process time entries
      const processedEntries = data.map(entry => ({
        id: entry.id,
        task_id: entry.task_id,
        user_id: entry.user_id,
        hours: entry.hours,
        description: entry.description || "",
        created_at: entry.created_at,
        task_title: entry.tasks?.title || "Unknown Task",
        task_status: entry.tasks?.status || "unknown",
        team_id: entry.tasks?.team_id || null,
        user_name: entry.users?.name || entry.users?.email || "Unknown User",
        user_email: entry.users?.email || "",
        user_avatar_url: entry.users?.avatar_url || "",
      }));
      
      setTimeEntries(processedEntries);
      
      // Calculate total hours
      const total = processedEntries.reduce((sum, entry) => sum + entry.hours, 0);
      setTotalHours(total);
      
      // Build user and task lookup maps
      const userMap: Record<string, UserInfo> = {};
      const taskMap: Record<string, any> = {};
      
      processedEntries.forEach(entry => {
        if (entry.user_id && !userMap[entry.user_id]) {
          userMap[entry.user_id] = {
            id: entry.user_id,
            name: entry.user_name,
            email: entry.user_email,
            avatar_url: entry.user_avatar_url
          };
        }
        
        if (entry.task_id && !taskMap[entry.task_id]) {
          taskMap[entry.task_id] = {
            id: entry.task_id,
            title: entry.task_title,
            status: entry.task_status,
            team_id: entry.team_id
          };
        }
      });
      
      setUsers(userMap);
      setTasks(taskMap);
      
      // Generate chart data based on groupBy
      generateChartData(processedEntries, startDate, endDate);
      
    } catch (err) {
      console.error("Error fetching report data:", err);
      setError("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };
  
  const generateChartData = (entries: any[], startDate: Date, endDate: Date) => {
    let data: any[] = [];
    
    switch (groupBy) {
      case "day": {
        // Create a map of days with 0 hours
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const dayMap: Record<string, number> = {};
        
        days.forEach(day => {
          dayMap[format(day, "yyyy-MM-dd")] = 0;
        });
        
        // Sum hours by day
        entries.forEach(entry => {
          const day = format(new Date(entry.created_at), "yyyy-MM-dd");
          dayMap[day] = (dayMap[day] || 0) + entry.hours;
        });
        
        // Convert to chart data format
        data = Object.entries(dayMap).map(([date, hours]) => ({
          date: format(parseISO(date), "MMM dd"),
          hours: parseFloat(hours.toFixed(1))
        }));
        break;
      }
      
      case "week": {
        // Group by week
        const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
        const weekMap: Record<string, number> = {};
        
        weeks.forEach(weekStart => {
          const weekKey = format(weekStart, "yyyy-'W'ww");
          weekMap[weekKey] = 0;
        });
        
        // Sum hours by week
        entries.forEach(entry => {
          const entryDate = new Date(entry.created_at);
          const weekStart = startOfWeek(entryDate);
          const weekKey = format(weekStart, "yyyy-'W'ww");
          weekMap[weekKey] = (weekMap[weekKey] || 0) + entry.hours;
        });
        
        // Convert to chart data format
        data = Object.entries(weekMap).map(([week, hours]) => ({
          date: week,
          hours: parseFloat(hours.toFixed(1))
        }));
        break;
      }
      
      case "task": {
        // Group by task
        const taskMap: Record<string, number> = {};
        
        entries.forEach(entry => {
          const taskName = entry.task_title || `Task ${entry.task_id}`;
          taskMap[taskName] = (taskMap[taskName] || 0) + entry.hours;
        });
        
        // Convert to chart data format and sort by hours (descending)
        data = Object.entries(taskMap)
          .map(([name, hours]) => ({
            name,
            hours: parseFloat(hours.toFixed(1))
          }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 10); // Limit to top 10 tasks
        break;
      }
      
      case "user": {
        // Group by user
        const userMap: Record<string, number> = {};
        
        entries.forEach(entry => {
          const userName = entry.user_name || `User ${entry.user_id}`;
          userMap[userName] = (userMap[userName] || 0) + entry.hours;
        });
        
        // Convert to chart data format
        data = Object.entries(userMap)
          .map(([name, hours]) => ({
            name,
            hours: parseFloat(hours.toFixed(1))
          }))
          .sort((a, b) => b.hours - a.hours);
        break;
      }
      
      case "team": {
        // We need to fetch team information for entries
        // This requires additional database query which we'll simplify here
        // For each task, we'd need to know its team
        
        // Group by team (using team_id from task)
        const teamHours: Record<string, number> = {};
        
        entries.forEach(entry => {
          if (entry.team_id) {
            teamHours[entry.team_id] = (teamHours[entry.team_id] || 0) + entry.hours;
          } else {
            teamHours["none"] = (teamHours["none"] || 0) + entry.hours;
          }
        });
        
        // Convert to chart data format
        data = Object.entries(teamHours).map(([teamId, hours]) => {
          // Find team name
          const teamName = teamId === "none" 
            ? "No Team" 
            : teams.find(t => t.id === teamId)?.name || `Team ${teamId}`;
          
          return {
            name: teamName,
            hours: parseFloat(hours.toFixed(1))
          };
        });
        break;
      }
    }
    
    setChartData(data);
  };
  
  const exportToCsv = () => {
    if (timeEntries.length === 0) return;
    
    // Create CSV content
    const headers = ["Date", "User", "Task", "Hours", "Description"];
    const csvRows = [
      headers.join(","),
      ...timeEntries.map(entry => [
        format(new Date(entry.created_at), "yyyy-MM-dd"),
        (entry.user_name || "Unknown User").replace(/,/g, " "),
        (entry.task_title || "Unknown Task").replace(/,/g, " "),
        entry.hours,
        entry.description?.replace(/,/g, " ") || ""
      ].join(","))
    ];
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // Create download link and click it
    const link = document.createElement("a");
    const fileName = `time-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    if (timeEntries.length === 0) return;
    
    // Initialize PDF document
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text("Time Report", 14, 15);
    
    // Add report info
    doc.setFontSize(10);
    const today = format(new Date(), "yyyy-MM-dd");
    doc.text(`Generated: ${today}`, 14, 22);
    doc.text(`Period: ${reportPeriod === "custom" ? `${customStartDate} to ${customEndDate}` : reportPeriod}`, 14, 27);
    doc.text(`Total Hours: ${totalHours.toFixed(1)}h`, 14, 32);
    doc.text(`Entries: ${timeEntries.length}`, 14, 37);
    
    // Prepare table data
    const tableColumn = ["Date", "User", "Task", "Hours", "Description"];
    const tableRows = timeEntries.map(entry => [
      format(new Date(entry.created_at), "yyyy-MM-dd"),
      entry.user_name || "Unknown User",
      entry.task_title || "Unknown Task",
      entry.hours.toFixed(1),
      (entry.description || "").substring(0, 40) + ((entry.description || "").length > 40 ? "..." : "")
    ]);
    
    // Add table to document
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // Save PDF file
    doc.save(`time-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };
  
  return (
    <div className="space-y-6">
      {/* Report filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Report Filters</span>
            {timeEntries.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToCsv} className="flex items-center gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPdf} className="flex items-center gap-2 cursor-pointer">
                    <FileText className="h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardTitle>
          <CardDescription>
            Configure your time tracking report parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Time Period</Label>
              <Select
                value={reportPeriod}
                onValueChange={(value) => setReportPeriod(value as ReportPeriod)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="groupBy">Group By</Label>
              <Select
                value={groupBy}
                onValueChange={(value) => setGroupBy(value as GroupBy)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="team">Team (Optional)</Label>
              <Select
                value={selectedTeam || "all"}
                onValueChange={(value) => setSelectedTeam(value === "all" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {reportPeriod === "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Error display */}
      {error && (
        <div className="bg-destructive/20 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}
      
      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Time Logged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-16" /> : `${totalHours.toFixed(1)}h`}
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Time Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <ListTodo className="w-4 h-4 mr-2 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-16" /> : timeEntries.length}
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {groupBy === "user" ? "Users" : (groupBy === "task" ? "Tasks" : "Date Range")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              {groupBy === "user" ? (
                <Users className="w-4 h-4 mr-2 text-muted-foreground" />
              ) : groupBy === "task" ? (
                <ListTodo className="w-4 h-4 mr-2 text-muted-foreground" />
              ) : (
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
              )}
              <span className="text-2xl font-bold">
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  groupBy === "user" 
                    ? Object.keys(users).length
                    : groupBy === "task"
                      ? Object.keys(tasks).length
                      : `${reportPeriod === "7days" ? "7d" : reportPeriod === "30days" ? "30d" : reportPeriod === "90days" ? "90d" : "Custom"}`
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts and tables */}
      <Tabs defaultValue="chart">
        <TabsList className="mb-4">
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="table">Detailed Table</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle>Time Distribution by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</CardTitle>
              <CardDescription>
                Visual representation of time entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="w-full h-[400px] flex items-center justify-center">
                  <Skeleton className="h-[380px] w-full" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  No data available for the selected period
                </div>
              ) : (
                <div className="w-full h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {(groupBy === "day" || groupBy === "week") ? (
                      <BarChart
                        data={chartData}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 70,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          angle={-45} 
                          textAnchor="end" 
                          height={70} 
                        />
                        <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => [`${value} hours`, 'Time Spent']} />
                        <Legend />
                        <Bar dataKey="hours" fill="#8884d8" name="Hours Spent" />
                      </BarChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={150}
                          fill="#8884d8"
                          dataKey="hours"
                          nameKey="name"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} hours`, 'Time Spent']} />
                        <Legend />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Time Entries</CardTitle>
              <CardDescription>
                Comprehensive list of all time entries for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : timeEntries.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  No time entries available for the selected period
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(new Date(entry.created_at), "yyyy-MM-dd")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={entry.user_avatar_url} />
                                <AvatarFallback>
                                  {(entry.user_name || "").substring(0, 2).toUpperCase() || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span>{entry.user_name || "Unknown User"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={
                                entry.task_status === "done" 
                                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                                  : entry.task_status === "in_progress"
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              }>
                                {entry.task_status === "in_progress" ? "In Progress" : 
                                  (entry.task_status || "todo").charAt(0).toUpperCase() + (entry.task_status || "todo").slice(1)}
                              </Badge>
                              <span>{entry.task_title || "Unknown Task"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {entry.hours.toFixed(1)}h
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {entry.description || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 