"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "./ui/card";
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
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { CheckCircle, Clock, AlertTriangle, TrendingUp, BarChart2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

type AnalyticsPeriod = "7days" | "30days" | "90days";

interface TaskAnalyticsProps {
  userId?: string;
  teamId?: string | null;
}

// Define types for chart data
type ChartDataItem = {
  name: string;
  value: number;
};

type TrendDataItem = {
  date: string;
  completed: number;
};

type CreationDataItem = {
  date: string;
  created: number;
};

// Define type for the Pie chart label props
interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  index: number;
  name: string;
  value: number;
}

export default function TaskAnalytics({ userId, teamId }: TaskAnalyticsProps) {
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("7days");
  const [tasksByStatus, setTasksByStatus] = useState<ChartDataItem[]>([]);
  const [tasksByPriority, setTasksByPriority] = useState<ChartDataItem[]>([]);
  const [taskCompletionTrend, setTaskCompletionTrend] = useState<TrendDataItem[]>([]);
  const [taskCreationTrend, setTaskCreationTrend] = useState<CreationDataItem[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<number>(0);
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [averageCompletionTime, setAverageCompletionTime] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mostProductiveDay, setMostProductiveDay] = useState<string | null>(null);
  
  const supabase = createClient();
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF'];
  const STATUS_COLORS = {
    'todo': '#3b82f6',
    'in_progress': '#f59e0b',
    'done': '#22c55e'
  };
  
  const PRIORITY_COLORS = {
    'low': '#9ca3af',
    'medium': '#60a5fa',
    'high': '#f59e0b',
    'urgent': '#ef4444'
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [analyticsPeriod, teamId, userId]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      let days = 7;
      if (analyticsPeriod === "30days") days = 30;
      if (analyticsPeriod === "90days") days = 90;
      
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      
      // Base query filters
      let query = supabase
        .from('tasks')
        .select('id, status, priority, created_at, updated_at, due_date', { count: 'exact' });
      
      // Apply team filter if teamId is provided
      if (teamId) {
        query = query.eq('team_id', teamId);
      } 
      // Apply user filter if userId is provided and no teamId
      else if (userId) {
        query = query.eq('user_id', userId);
      }
      
      // Filter by date range
      query = query.gte('created_at', startDate);
      
      const { data: tasksData, error, count } = await query;
      
      if (error) throw error;
      
      if (!tasksData || !count) {
        setLoading(false);
        return;
      }
      
      setTotalTasks(count);
      
      // Calculate tasks by status
      const statusCounts: Record<string, number> = { 'todo': 0, 'in_progress': 0, 'done': 0 };
      tasksData.forEach(task => {
        statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      });
      
      const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
      setTasksByStatus(statusData);
      
      // Calculate tasks by priority
      const priorityCounts: Record<string, number> = { 'low': 0, 'medium': 0, 'high': 0, 'urgent': 0 };
      tasksData.forEach(task => {
        if (task.priority) {
          priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;
        }
      });
      
      const priorityData = Object.entries(priorityCounts).map(([name, value]) => ({ name, value }));
      setTasksByPriority(priorityData);
      
      // Calculate overdue tasks
      const now = new Date();
      const overdueCount = tasksData.filter(task => 
        task.due_date && 
        new Date(task.due_date) < now && 
        task.status !== 'done'
      ).length;
      
      setOverdueTasks(overdueCount);
      
      // Calculate completion rate
      const completedCount = statusCounts['done'] || 0;
      setCompletionRate(totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0);
      
      // Generate date range for the selected period
      const dateRange = eachDayOfInterval({
        start: subDays(new Date(), days),
        end: new Date()
      });
      
      // Calculate task completion trend
      const completionByDate: Record<string, number> = {};
      dateRange.forEach(date => {
        completionByDate[format(date, 'yyyy-MM-dd')] = 0;
      });
      
      tasksData.forEach(task => {
        if (task.status === 'done' && task.updated_at) {
          const completionDate = format(new Date(task.updated_at), 'yyyy-MM-dd');
          if (completionByDate[completionDate] !== undefined) {
            completionByDate[completionDate]++;
          }
        }
      });
      
      const completionTrendData = Object.entries(completionByDate).map(([date, completed]) => ({
        date: format(new Date(date), 'MMM dd'),
        completed
      }));
      
      setTaskCompletionTrend(completionTrendData);
      
      // Calculate task creation trend
      const creationByDate: Record<string, number> = {};
      dateRange.forEach(date => {
        creationByDate[format(date, 'yyyy-MM-dd')] = 0;
      });
      
      tasksData.forEach(task => {
        const creationDate = format(new Date(task.created_at), 'yyyy-MM-dd');
        if (creationByDate[creationDate] !== undefined) {
          creationByDate[creationDate]++;
        }
      });
      
      const creationTrendData = Object.entries(creationByDate).map(([date, created]) => ({
        date: format(new Date(date), 'MMM dd'),
        created
      }));
      
      setTaskCreationTrend(creationTrendData);
      
      // Find most productive day (day with most completed tasks)
      if (completionTrendData.length > 0) {
        const mostProductiveEntry = completionTrendData.reduce((max, entry) => 
          entry.completed > max.completed ? entry : max, 
          completionTrendData[0]
        );
        
        if (mostProductiveEntry.completed > 0) {
          setMostProductiveDay(mostProductiveEntry.date);
        } else {
          setMostProductiveDay(null);
        }
      }
      
      // Calculate average completion time (for completed tasks that have history)
      const { data: historyData, error: historyError } = await supabase
        .from('task_history')
        .select('task_id, old_value, new_value, created_at')
        .in('task_id', tasksData.filter(t => t.status === 'done').map(t => t.id))
        .eq('field_name', 'status')
        .eq('new_value', 'done');
        
      if (!historyError && historyData) {
        // Get task creation dates
        const taskCreationDates: Record<string, Date> = {};
        tasksData.forEach(task => {
          taskCreationDates[task.id] = new Date(task.created_at);
        });
        
        // Calculate time to completion for each task
        const completionTimes: number[] = [];
        
        historyData.forEach(history => {
          const taskId = history.task_id;
          const completionDate = new Date(history.created_at);
          const creationDate = taskCreationDates[taskId];
          
          if (creationDate) {
            const timeToComplete = completionDate.getTime() - creationDate.getTime();
            // Convert to days
            const daysToComplete = timeToComplete / (1000 * 60 * 60 * 24);
            completionTimes.push(daysToComplete);
          }
        });
        
        if (completionTimes.length > 0) {
          const average = completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length;
          setAverageCompletionTime(parseFloat(average.toFixed(1)));
        } else {
          setAverageCompletionTime(null);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Task Analytics</h2>
        <Select 
          value={analyticsPeriod} 
          onValueChange={(value) => setAnalyticsPeriod(value as AnalyticsPeriod)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="90days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-1/3 mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Task Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  <div className="text-2xl font-bold">{completionRate}%</div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tasksByStatus.find(s => s.name === 'done')?.value || 0} of {totalTasks} tasks completed
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <AlertTriangle className={cn("mr-2 h-4 w-4", overdueTasks > 0 ? "text-red-500" : "text-green-500")} />
                  <div className="text-2xl font-bold">{overdueTasks}</div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overdueTasks > 0 
                    ? `${Math.round((overdueTasks / totalTasks) * 100)}% of tasks are overdue` 
                    : "No overdue tasks"}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-blue-500" />
                  <div className="text-2xl font-bold">
                    {averageCompletionTime !== null ? `${averageCompletionTime} days` : "N/A"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average time to complete tasks
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Most Productive Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4 text-purple-500" />
                  <div className="text-2xl font-bold">
                    {mostProductiveDay ? mostProductiveDay : "N/A"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Day with most task completions
                </p>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trends">Productivity Trends</TabsTrigger>
              <TabsTrigger value="distribution">Task Distribution</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview">
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Tasks by Status</CardTitle>
                    <CardDescription>Distribution of tasks by their current status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {tasksByStatus.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={tasksByStatus}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, value }: PieLabelProps) => `${name}: ${value}`}
                            >
                              {tasksByStatus.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] || COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-muted-foreground">No task data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Tasks by Priority</CardTitle>
                    <CardDescription>Distribution of tasks by priority level</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {tasksByPriority.some(item => item.value > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={tasksByPriority}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" name="Tasks">
                              {tasksByPriority.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name as keyof typeof PRIORITY_COLORS] || COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-muted-foreground">No priority data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="trends">
              <div className="grid gap-4 grid-cols-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Completion Trend</CardTitle>
                    <CardDescription>Number of tasks completed over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {taskCompletionTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={taskCompletionTrend}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="completed" name="Tasks Completed" stroke="#22c55e" fill="#22c55e3d" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-muted-foreground">No completion trend data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Task Creation vs Completion</CardTitle>
                    <CardDescription>Comparing task creation and completion rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {taskCreationTrend.length > 0 && taskCompletionTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              allowDuplicatedCategory={false} 
                              type="category"
                              domain={taskCreationTrend.map(item => item.date)}
                            />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line 
                              data={taskCreationTrend} 
                              type="monotone" 
                              dataKey="created" 
                              name="Tasks Created" 
                              stroke="#3b82f6" 
                              activeDot={{ r: 8 }} 
                            />
                            <Line 
                              data={taskCompletionTrend} 
                              type="monotone" 
                              dataKey="completed" 
                              name="Tasks Completed" 
                              stroke="#22c55e" 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-muted-foreground">No trend data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="distribution">
              <div className="grid gap-4 grid-cols-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Tasks by Status and Priority</CardTitle>
                    <CardDescription>Breakdown of tasks by status and priority</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      {/* Additional detailed chart could go here */}
                      <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground">Detailed distribution analytics coming soon</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
} 