import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import {
  ArrowUpRight,
  CheckCircle2,
  Shield,
  Users,
  Zap,
  ListTodo,
  Clock,
  Calendar,
  BarChart,
} from "lucide-react";
import { createClient } from "../../supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50">
      <Navbar />
      <Hero />

      {/* Features Section */}
      <section className="py-24 bg-background" id="features">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Powerful Task Management Features
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our intuitive platform helps you organize, prioritize, and
              complete tasks efficiently with these powerful features.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <ListTodo className="w-6 h-6" />,
                title: "Task Organization",
                description:
                  "Easily create, categorize, and prioritize your tasks",
              },
              {
                icon: <Clock className="w-6 h-6" />,
                title: "Status Tracking",
                description:
                  "Monitor progress with To Do, In Progress, and Done statuses",
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Team Collaboration",
                description:
                  "Share tasks and collaborate seamlessly with your team",
              },
              {
                icon: <BarChart className="w-6 h-6" />,
                title: "Progress Analytics",
                description:
                  "Track productivity with visual performance metrics",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-brand-600 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How TaskFlow Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes with our simple, intuitive workflow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="bg-brand-100 text-brand-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Tasks</h3>
              <p className="text-muted-foreground">
                Add new tasks with titles, descriptions, and initial status
              </p>
            </div>
            <div className="text-center">
              <div className="bg-brand-100 text-brand-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
              <p className="text-muted-foreground">
                Update task status as you work through your to-do list
              </p>
            </div>
            <div className="text-center">
              <div className="bg-brand-100 text-brand-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Complete Tasks</h3>
              <p className="text-muted-foreground">
                Mark tasks as done and celebrate your productivity
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-brand-600 text-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">10,000+</div>
              <div className="text-brand-100">Tasks Completed</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">5,000+</div>
              <div className="text-brand-100">Happy Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">99.9%</div>
              <div className="text-brand-100">Uptime Guaranteed</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Boost Your Productivity?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of users who have transformed their task management
            with TaskFlow.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Get Started Now
            <ArrowUpRight className="ml-2 w-4 h-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
