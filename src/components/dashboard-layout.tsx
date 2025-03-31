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
        <div className="container mx-auto px-2 py-8 flex flex-col gap-8 max-w-full md:max-w-[99%] lg:max-w-[98%] xl:max-w-[1600px]">
          {children}
        </div>
      </main>
    </>
  );
} 