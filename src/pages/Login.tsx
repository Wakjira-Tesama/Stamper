const logoUrl = import.meta.env.BASE_URL + "rabuma-logo.png";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const { login, sendOtp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot password states
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      toast.success("Welcome back!");
      navigate("/dashboard");
    } else {
      toast.error("Invalid email or password");
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    const sentOtp = await sendOtp(email);
    setLoading(false);

    if (sentOtp) {
      toast.success("OTP sent to your email address!");
      setMode("reset");
    } else {
      toast.error("Email not found or error sending OTP");
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp !== "123456") {
      // Mock check for demo, normally backend handles verification
      toast.error("Invalid OTP");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    const success = await resetPassword(email, newPassword);
    setLoading(false);

    if (success) {
      toast.success("Password reset successfully! You can now log in.");
      setMode("login");
      setPassword("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      toast.error("Failed to reset password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src={logoUrl}
                alt="Rabuma Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-2xl font-display font-bold">Rabuma</span>
          </Link>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <div className="bg-card rounded-xl p-8 shadow-elegant border border-border">
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-primary hover:underline bg-transparent border-none p-0"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgotSubmit} className="space-y-5">
              <p className="text-sm text-muted-foreground mb-4">
                Enter your email address and we'll send you a 6-digit OTP to
                reset your password.
              </p>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full gradient-primary text-primary-foreground"
                  disabled={loading}
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setMode("login")}
                  disabled={loading}
                >
                  Back to Login
                </Button>
              </div>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="otp">Enter 6-digit OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full gradient-primary text-primary-foreground"
                  disabled={loading}
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setMode("login")}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          🔒 All data stored locally in your browser
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
