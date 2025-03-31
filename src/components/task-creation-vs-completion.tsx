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
  LineChart,
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { Button } from "./ui/button";

type TrendDataItem = {
  date: string;
  completed: number;
};

type CreationDataItem = {
  date: string;
  created: number;
};

interface TaskCreationCompletionProps {
  userId?: string;
  teamId?: string | null;
  days?: number;
  showTitle?: boolean;
}

export default function TaskCreationCompletion({ 
  userId, 
  teamId, 
  days = 7,
  showTitle = true
}: TaskCreationCompletionProps) {
  const [taskCompletionTrend, setTaskCompletionTrend] = useState<TrendDataItem[]>([]);
  const [taskCreationTrend, setTaskCreationTrend] = useState<CreationDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [userId, teamId, days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      
      // Base query filters
      let query = supabase
        .from('tasks')
        .select('id, status, created_at, updated_at');
      
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
      
      const { data: tasksData, error } = await query;
      
      if (error) throw error;
      
      if (!tasksData) {
        setLoading(false);
        return;
      }
      
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
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      {showTitle && (
        <CardHeader>
          <CardTitle>Task Creation vs Completion</CardTitle>
          <CardDescription>Comparing task creation and completion rates</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="h-[300px]">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">Loading chart data...</p>
            </div>
          ) : taskCreationTrend.length > 0 && taskCompletionTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                <Area 
                  data={taskCreationTrend} 
                  type="monotone" 
                  dataKey="created" 
                  name="Tasks Created" 
                  stroke="#3b82f6" 
                  fill="#3b82f650" 
                  activeDot={{ r: 8 }} 
                />
                <Area 
                  data={taskCompletionTrend} 
                  type="monotone" 
                  dataKey="completed" 
                  name="Tasks Completed" 
                  stroke="#22c55e" 
                  fill="#22c55e50"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">No trend data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 