import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Leaf, TreePine, Recycle, Award, TrendingUp } from "lucide-react";
import type { EcoMetrics } from "@shared/schema";

export default function Eco() {
  const { data: ecoMetrics, isLoading } = useQuery<EcoMetrics>({
    queryKey: ["/api/eco-metrics"],
  });

  const currentMonth = new Date().toLocaleDateString('en-UK', { 
    month: 'long', 
    year: 'numeric' 
  });

  const ecoGoals = {
    papersSaved: 50,
    co2Reduced: 5.0,
    treesEquivalent: 0.2,
    ecoPoints: 500,
  };

  if (isLoading) {
    return (
      <div className="px-6 py-4 pb-24 space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-primary mb-2">Eco Impact</h1>
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  const paperProgress = ((ecoMetrics?.papersSaved || 0) / ecoGoals.papersSaved) * 100;
  const co2Progress = ((parseFloat(ecoMetrics?.co2Reduced || "0")) / ecoGoals.co2Reduced) * 100;
  const treeProgress = ((parseFloat(ecoMetrics?.treesEquivalent || "0")) / ecoGoals.treesEquivalent) * 100;
  const pointsProgress = ((ecoMetrics?.ecoPoints || 0) / ecoGoals.ecoPoints) * 100;

  return (
    <div className="px-6 py-4 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary mb-2">Eco Impact</h1>
        <p className="text-gray-600">Your environmental contribution for {currentMonth}</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mx-auto mb-3">
              <Recycle className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-accent mb-1">
              {ecoMetrics?.papersSaved || 0}
            </div>
            <div className="text-sm text-gray-600">Papers Saved</div>
            <Progress value={paperProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-green-600 mb-1">
              {parseFloat(ecoMetrics?.co2Reduced || "0").toFixed(1)}kg
            </div>
            <div className="text-sm text-gray-600">CO₂ Reduced</div>
            <Progress value={co2Progress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <TreePine className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 mb-1">
              {parseFloat(ecoMetrics?.treesEquivalent || "0").toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Trees Saved</div>
            <Progress value={treeProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-amber-600 mb-1">
              {ecoMetrics?.ecoPoints || 0}
            </div>
            <div className="text-sm text-gray-600">Eco Points</div>
            <Progress value={pointsProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Monthly Goal */}
      <Card className="mb-8 border-primary/20">
        <CardHeader>
          <CardTitle className="text-primary flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Monthly Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Papers Saved</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {ecoMetrics?.papersSaved || 0} / {ecoGoals.papersSaved}
              </span>
              <Badge variant={paperProgress >= 100 ? "default" : "secondary"} className="bg-accent">
                {paperProgress.toFixed(0)}%
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">CO₂ Reduction</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {parseFloat(ecoMetrics?.co2Reduced || "0").toFixed(1)}kg / {ecoGoals.co2Reduced}kg
              </span>
              <Badge variant={co2Progress >= 100 ? "default" : "secondary"} className="bg-green-500">
                {co2Progress.toFixed(0)}%
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tree Equivalent</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {parseFloat(ecoMetrics?.treesEquivalent || "0").toFixed(2)} / {ecoGoals.treesEquivalent}
              </span>
              <Badge variant={treeProgress >= 100 ? "default" : "secondary"} className="bg-emerald-500">
                {treeProgress.toFixed(0)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environmental Facts */}
      <Card className="bg-light-green border-accent/20">
        <CardHeader>
          <CardTitle className="text-primary">Did You Know?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-700">
            <div className="flex items-start space-x-2 mb-3">
              <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
              <div>
                Every paper receipt avoided saves approximately 0.05kg of CO₂ emissions
              </div>
            </div>
            <div className="flex items-start space-x-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                1,000 digital receipts = 1 tree equivalent in environmental impact
              </div>
            </div>
            <div className="flex items-start space-x-2 mb-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
              <div>
                UK retailers produce over 11 billion paper receipts annually
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full mt-2"></div>
              <div>
                Digital receipts reduce paper waste by up to 90% per transaction
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
