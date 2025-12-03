import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Zap, BarChart3, Brain } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) return;
    
    setIsLoading(true);
    try {
      // Simulate auth with custom email
      // In a real app, this would authenticate against your backend
      await new Promise(resolve => setTimeout(resolve, 500));
      onLogin();
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
      {/* Grid background effect */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      <div className="w-full max-w-6xl">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left side - Features */}
          <div className="space-y-8 md:block hidden">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
                QuantArchitect
              </h2>
              <p className="text-lg text-muted-foreground">
                Institutional-grade crypto trading with AI-powered quantitative analysis
              </p>
            </div>

            <div className="space-y-6">
              {/* Feature 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Real-time Market Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor 50+ cryptocurrencies with live price feeds and technical indicators
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">AI-Powered Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    Get intelligent trading signals and market regime analysis powered by OpenAI
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Portfolio Management</h3>
                  <p className="text-sm text-muted-foreground">
                    Track trades, analyze P&L, and manage multiple portfolios seamlessly
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Quantitative Trading</h3>
                  <p className="text-sm text-muted-foreground">
                    Leverage advanced statistical models for data-driven trading decisions
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="flex items-center justify-center">
            <Card className="w-full md:max-w-md border-border/40 shadow-lg">
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl">Welcome Back</CardTitle>
                <CardDescription>
                  Sign in to access your trading dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Development mode - enter any email to continue
                  </p>
                </div>

                <Button
                  onClick={handleLogin}
                  disabled={isLoading || !email.trim()}
                  className="w-full h-10 font-semibold"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/40"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Local Development</span>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  🚀 Running in development mode with mock authentication. No password required.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
