import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CreditCard, Star, Gift } from "lucide-react";
import type { LoyaltyCard } from "@shared/schema";

const availableCards = [
  { name: "Tesco Clubcard", logo: "T", color: "#00539C", points: "Clubcard points" },
  { name: "myWaitrose", logo: "W", color: "#2C5F41", points: "myWaitrose offers" },
  { name: "Nectar Card", logo: "N", color: "#FF8200", points: "Nectar points" },
  { name: "Shell GO+", logo: "⛽", color: "#DC143C", points: "Shell GO+ rewards" },
  { name: "Boots Advantage", logo: "B", color: "#0054A6", points: "Advantage points" },
  { name: "Argos Card", logo: "A", color: "#DC143C", points: "Fast Track Collection" },
];

export default function Cards() {
  const { data: loyaltyCards = [], isLoading } = useQuery<LoyaltyCard[]>({
    queryKey: ["/api/loyalty-cards"],
  });

  return (
    <div className="px-6 py-4 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary mb-2">Loyalty Cards</h1>
        <p className="text-gray-600">Manage your loyalty cards and rewards</p>
      </div>

      {/* Active Cards */}
      {loyaltyCards.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Star className="w-5 h-5 text-accent mr-2" />
            Active Cards
          </h2>
          <div className="space-y-4">
            {loyaltyCards.map((card) => (
              <Card key={card.id} className="border-accent/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">{card.cardName.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{card.cardName}</h3>
                        <p className="text-sm text-gray-600">•••• {card.cardNumber.slice(-4)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-accent">{card.points || 0}</div>
                      <div className="text-xs text-gray-500">points</div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <Badge variant={card.isActive ? "default" : "secondary"} className="bg-accent/10 text-accent">
                      {card.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button size="sm" variant="outline" className="text-xs">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Gift className="w-5 h-5 text-gray-700 mr-2" />
          Available Cards
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {availableCards.map((card) => (
            <Card key={card.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: card.color }}
                    >
                      {card.logo}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{card.name}</h3>
                      <p className="text-sm text-gray-600">{card.points}</p>
                    </div>
                  </div>
                  <Button size="sm" className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Benefits Info */}
      <Card className="bg-light-green border-accent/20">
        <CardHeader>
          <CardTitle className="text-primary flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Card Benefits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-700">
            <div className="flex items-start space-x-2 mb-2">
              <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
              <div>Automatic point earning from scanned receipts</div>
            </div>
            <div className="flex items-start space-x-2 mb-2">
              <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
              <div>Real-time balance updates</div>
            </div>
            <div className="flex items-start space-x-2 mb-2">
              <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
              <div>Exclusive offers and discounts</div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-accent rounded-full mt-2"></div>
              <div>Seamless reward redemption</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
