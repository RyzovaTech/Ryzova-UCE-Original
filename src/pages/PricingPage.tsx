import { Check, X, Sparkles, Crown, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CHECKOUT_URLS } from '@/lib/licensing/licenseManager';

const freeFeatures = [
  '5 Local Scans',
  'Main Programming Languages',
  'Project Classification',
  'Basic Compatibility Report',
  'JSON Export',
  'Markdown Export',
  'Local Report History',
];

const freeRestrictions = [
  'No PDF Export',
  'No Commercial License',
  'No Priority Support',
  'No Early Access',
];

const proFeatures = [
  'Unlimited Local Scans',
  'All Supported Programming Languages',
  'PDF Export',
  'Commercial License',
  'Priority Engine Updates',
  'Early Access Features',
  'Priority Support',
  'All v1.x Updates',
];

const founderFeatures = [
  'Everything in Pro',
  'Lifetime license — no renewals',
  'All future v1.x updates',
  'Commercial use license',
  'Founder badge & recognition',
  'Priority support for life',
];

const founderTiers = [
  { id: '1-100', label: 'Founder #1–100', price: 49 },
  { id: '101-200', label: 'Founder #101–200', price: 59 },
  { id: '201-300', label: 'Founder #201–300', price: 69 },
  { id: '301-400', label: 'Founder #301–400', price: 79 },
  { id: '401-500', label: 'Founder #401–500', price: 89 },
];

export function PricingPage() {
  return (
    <div className="space-y-6 animate-slide-up">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the plan that fits your team's needs.
        </p>
      </div>

      <Card className="relative overflow-hidden border-secondary/30 bg-secondary/10">
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
          <Badge className="gap-1 bg-primary text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            UCE v1.0.0
          </Badge>
          <p className="text-sm text-muted-foreground">
            All plans include deterministic, local-first compatibility analysis.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* FREE PLAN */}
        <Card className="relative flex flex-col transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="text-lg">Free</CardTitle>
            <CardDescription>Open-source compatibility analysis for everyone.</CardDescription>
            <div className="mt-2">
              <span className="text-3xl font-bold">$0</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Included
              </p>
              <ul className="space-y-2 text-sm">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Restrictions
              </p>
              <ul className="space-y-2 text-sm">
                {freeRestrictions.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-muted-foreground">
                    <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive/70" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline" asChild>
              <a href="/analyze">Get Started</a>
            </Button>
          </CardFooter>
        </Card>

        {/* PRO ANNUAL */}
        <Card className="relative flex flex-col border-primary ring-1 ring-primary/30 shadow-glow transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="gap-1 bg-primary text-primary-foreground">
              <Zap className="h-3 w-3" />
              Most Popular
            </Badge>
          </div>
          <CardHeader>
            <CardTitle className="text-lg">Pro Annual</CardTitle>
            <CardDescription>Advanced analysis for professional teams.</CardDescription>
            <div className="mt-2">
              <span className="text-3xl font-bold">$39</span>
              <span className="text-sm font-normal text-muted-foreground">/year</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-2 text-sm">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full lemonsqueezy-button" variant="default" asChild>
              <a href={CHECKOUT_URLS.pro} target="_blank" rel="noopener noreferrer">
                Buy UCE Pro Annual
              </a>
            </Button>
          </CardFooter>
        </Card>

        {/* FOUNDER LIFETIME */}
        <Card className="relative flex flex-col border-secondary/40 transition-all duration-200 hover:shadow-soft hover:-translate-y-0.5">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="gap-1 bg-secondary text-secondary-foreground">
              <Crown className="h-3 w-3" />
              Limited
            </Badge>
          </div>
          <CardHeader>
            <CardTitle className="text-lg">Founder Lifetime</CardTitle>
            <CardDescription>One-time payment, yours forever.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="rounded-md border border-secondary/30 bg-secondary/5 p-3 text-center">
              <p className="text-sm font-semibold text-secondary-foreground">
                Only 500 Founder Licenses will ever be sold.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tier Pricing
              </p>
              <ul className="space-y-1.5 text-sm">
                {founderTiers.map((tier) => (
                  <li key={tier.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5">
                    <span className="text-muted-foreground">{tier.label}</span>
                    <span className="font-semibold">${tier.price}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="space-y-2 text-sm">
              {founderFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full lemonsqueezy-button" variant="premium" asChild>
              <a href={CHECKOUT_URLS.founder} target="_blank" rel="noopener noreferrer">
                Become a Founder
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
