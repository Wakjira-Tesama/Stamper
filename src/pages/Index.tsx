import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  ArrowRight,
  Leaf,
  TrendingUp,
  Users,
  Globe,
  Target,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const values = [
  {
    icon: TrendingUp,
    title: "Sustainable Investments",
    desc: "Aligning investment strategies with environmental responsibility and long-term sustainable growth.",
  },
  {
    icon: Leaf,
    title: "Eco-Friendly Enterprise",
    desc: "Guiding businesses toward eco-friendly entrepreneurship that thrives while protecting the planet.",
  },
  {
    icon: Users,
    title: "Empowering Youth",
    desc: "Bringing together young, passionate individuals interested in business and the environmental sector.",
  },
  {
    icon: Globe,
    title: "Environmental Advocacy",
    desc: "Promoting environmental awareness through hands-on activities and real-world case studies.",
  },
  {
    icon: Target,
    title: "Expert Guidance",
    desc: "Access to expert guest speakers and mentors who share insights from the field of sustainable business.",
  },
  {
    icon: Briefcase,
    title: "Business Consulting",
    desc: "Professional consulting services that help businesses contribute positively to the planet.",
  },
];

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="Rabuma Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-xl font-display font-bold">Rabuma</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Button
                asChild
                className="gradient-primary text-primary-foreground"
              >
                <Link to="/dashboard">
                  Dashboard <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                className="gradient-primary text-primary-foreground"
              >
                <Link to="/login">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-20 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6 border border-accent/20">
            <Leaf className="h-3.5 w-3.5" />
            Investment • Environment • Consulting
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6 max-w-4xl mx-auto">
            We are <span className="gradient-text">Rabuma</span>
            <br />
            <span className="text-3xl md:text-4xl text-muted-foreground font-medium">
              Since 2012
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
            The RABUMA Investment and Environment Business Consultant Company
            was founded in 2012 with the mission to bring together young,
            passionate individuals interested in both the world of business and
            the environmental sector — empowering the next generation of leaders
            for sustainable growth.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="gradient-primary text-primary-foreground h-12 px-8 text-base shadow-elegant"
            >
              <Link to={user ? "/dashboard" : "/login"}>
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Mission banner */}
      <section className="container mx-auto px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="gradient-primary rounded-2xl p-8 text-center"
        >
          <Globe className="h-8 w-8 text-primary-foreground mx-auto mb-3" />
          <p className="text-primary-foreground text-lg font-medium max-w-2xl mx-auto">
            🌍 Through hands-on activities, expert speakers, and real-world case
            studies, we foster a deeper understanding of how businesses can
            thrive while contributing positively to the planet.
          </p>
        </motion.div>
      </section>

      {/* Values */}
      <section className="container mx-auto px-4 pb-24">
        <h2 className="text-3xl font-display font-bold text-center mb-12">
          What We Stand For
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-xl p-6 border border-border shadow-elegant hover:shadow-glow transition-shadow duration-300"
            >
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-lg font-display font-semibold mb-2">
                {f.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Rabuma — Investment & Environment Business Consultant. Empowering
            leaders since 2012.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
