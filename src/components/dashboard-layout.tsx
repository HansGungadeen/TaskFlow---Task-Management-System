import React from "react";
import DashboardNavbar from "./dashboard-navbar";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <DashboardNavbar />
      <main className="w-full min-h-[calc(100vh-4rem)]">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8 max-w-full md:max-w-[95%] lg:max-w-[90%] xl:max-w-[1280px]">
          {children}
        </div>
      </main>
    </>
  );
} 