import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ListTodo,
  Clock,
} from "lucide-react";

export default function Hero() {
  return (
    <div className="relative overflow-hidden bg-background">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-background to-brand-100/30 opacity-70" />

      <div className="relative pt-24 pb-32 sm:pt-32 sm:pb-40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-8 tracking-tight">
              Manage Tasks{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-400 dark:to-brand-600">
                Effortlessly
              </span>{" "}
              with TaskFlow
            </h1>

            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Streamline your workflow with our intuitive task management
              platform. Stay organized, boost productivity, and never miss a
              deadline again.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-8 py-4 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors text-lg font-medium"
              >
                Try TaskFlow Free
                <ArrowUpRight className="ml-2 w-5 h-5" />
              </Link>

              <Link
                href="#features"
                className="inline-flex items-center px-8 py-4 text-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors text-lg font-medium"
              >
                Explore Features
              </Link>
            </div>

            <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-brand-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-brand-500" />
                <span>Unlimited tasks on free plan</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-brand-500" />
                <span>Simple, intuitive interface</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
