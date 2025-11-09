"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Zap, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface InstallationGuideProps {
  trackingCode?: string;
}

interface Improvement {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  category: "performance" | "conversion" | "engagement" | "accessibility";
}

const mockImprovements: Improvement[] = [
  {
    id: "1",
    title: "Add loading states to buttons",
    description:
      "Implement visual feedback when users click action buttons to improve perceived performance and reduce uncertainty.",
    impact: "medium",
    effort: "low",
    category: "engagement",
  },
  {
    id: "2",
    title: "Implement progressive disclosure",
    description: "Break complex forms into steps to reduce cognitive load and improve completion rates.",
    impact: "high",
    effort: "medium",
    category: "conversion",
  },
  {
    id: "3",
    title: "Add keyboard navigation support",
    description: "Ensure all interactive elements are accessible via keyboard for better accessibility compliance.",
    impact: "medium",
    effort: "medium",
    category: "accessibility",
  },
  {
    id: "4",
    title: "Optimize image loading",
    description: "Implement lazy loading and WebP format to improve page load times and Core Web Vitals scores.",
    impact: "high",
    effort: "low",
    category: "performance",
  },
  {
    id: "5",
    title: "Add micro-interactions",
    description: "Include subtle animations and hover effects to make the interface feel more responsive and engaging.",
    impact: "low",
    effort: "medium",
    category: "engagement",
  },
];

export function InstallationGuide({ trackingCode }: InstallationGuideProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!trackingCode) return;
    const snippet = `<script>
  (function(){
    var ph = document.createElement("script");
    ph.src = "https://app.posthog.com/static/array.js";
    ph.async = true;
    document.head.appendChild(ph);
    window.posthog = window.posthog || [];
    posthog.init("YOUR_POSTHOG_KEY", { api_host: "https://app.posthog.com" });
    posthog.identify("${trackingCode}");
  })();
</script>`;

    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Clipboard error:", error);
    }
  };

  const getImpactColor = (impact: Improvement["impact"]) => {
    switch (impact) {
      case "high":
        return "bg-white text-black border-white/20";
      case "medium":
        return "bg-white/70 text-black border-white/20";
      case "low":
        return "bg-white/40 text-black border-white/20";
    }
  };

  const getEffortColor = (effort: Improvement["effort"]) => {
    switch (effort) {
      case "low":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "medium":
        return "bg-white/20 text-white border-white/30";
      case "high":
        return "bg-white/10 text-white/60 border-white/20";
    }
  };

  const getCategoryIcon = (category: Improvement["category"]) => {
    switch (category) {
      case "performance":
        return <Zap className="h-4 w-4" />;
      case "conversion":
        return <Target className="h-4 w-4" />;
      case "engagement":
        return <TrendingUp className="h-4 w-4" />;
      case "accessibility":
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* --- Installation Snippet Section --- */}
      <Card className="bg-black/60 backdrop-blur-subtle border-white/10 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg text-white">Installation Guide</CardTitle>
          <CardDescription className="text-white/60">
            Add this tracking snippet to your website’s <code>&lt;head&gt;</code> tag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trackingCode ? (
            <div>
              <pre className="bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-blue-300 whitespace-pre-wrap">
                {`<script>
(function(){
  var ph = document.createElement("script");
  ph.src = "https://app.posthog.com/static/array.js";
  ph.async = true;
  document.head.appendChild(ph);
  window.posthog = window.posthog || [];
  posthog.init("YOUR_POSTHOG_KEY", { api_host: "https://app.posthog.com" });
  posthog.identify("${trackingCode}");
})();
</script>`}
              </pre>
              <Button
                onClick={handleCopy}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {copied ? "Copied!" : "Copy Snippet"}
              </Button>
            </div>
          ) : (
            <p className="text-white/60">Tracking code not available. Sign in or verify your account.</p>
          )}
        </CardContent>
      </Card>

      {/* --- Recommended Improvements --- */}
      <div className="space-y-4">
        {mockImprovements.map((improvement) => (
          <Card
            key={improvement.id}
            className="bg-black/60 backdrop-blur-subtle border-white/10 shadow-xl hover:shadow-blue-500/10 transition-all duration-300"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="text-blue-400 mt-1">{getCategoryIcon(improvement.category)}</div>
                  <div>
                    <CardTitle className="text-lg text-white">{improvement.title}</CardTitle>
                    <CardDescription className="text-gray-300 mt-1">{improvement.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Impact:</span>
                    <Badge className={getImpactColor(improvement.impact)}>
                      {improvement.impact.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Effort:</span>
                    <Badge className={getEffortColor(improvement.effort)}>
                      {improvement.effort.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
