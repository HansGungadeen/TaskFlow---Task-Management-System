"use client";

import { Task } from "@/types/tasks";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown, Download, FileText, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface TaskExportProps {
  tasks: Task[];
  className?: string;
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function TaskExport({
  tasks,
  className = "",
  buttonSize = "default",
  buttonVariant = "outline",
}: TaskExportProps) {
  if (tasks.length === 0) {
    return null;
  }

  const exportToCsv = () => {
    // Define CSV headers
    const headers = [
      "ID",
      "Title",
      "Description",
      "Status",
      "Priority",
      "Created At",
      "Due Date",
      "Team",
      "Assigned To",
    ];

    // Convert tasks to CSV rows
    const csvRows = [
      headers.join(","),
      ...tasks.map((task) => [
        task.id,
        `"${(task.title || "").replace(/"/g, '""')}"`,
        `"${(task.description || "").replace(/"/g, '""')}"`,
        task.status,
        task.priority || "none",
        format(new Date(task.created_at), "yyyy-MM-dd"),
        task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "",
        "", // team name would need to be fetched
        task.assignee_data?.name || "",
      ].join(",")),
    ];

    // Create and download CSV file
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tasks-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    // Initialize PDF document
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text("Task Export", 14, 15);
    
    // Add info
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd")}`, 14, 22);
    doc.text(`Number of Tasks: ${tasks.length}`, 14, 27);
    
    // Prepare table data
    const tableColumn = ["Title", "Status", "Priority", "Due Date", "Assigned To"];
    const tableRows = tasks.map(task => [
      task.title.substring(0, 30) + (task.title.length > 30 ? "..." : ""),
      task.status.charAt(0).toUpperCase() + task.status.slice(1),
      task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "None",
      task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "-",
      task.assignee_data?.name || "-"
    ]);
    
    // Add table to document
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    // Save PDF file
    doc.save(`tasks-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className={`flex items-center gap-2 ${className}`}>
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
  );
} 