export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "groceries",
    name: "Groceries",
    icon: "🛒",
    color: "#4CAF50",
    description: "Food, beverages, and household items",
  },
  {
    id: "dining",
    name: "Dining",
    icon: "🍽️",
    color: "#FF9800",
    description: "Restaurants, cafes, and takeout",
  },
  {
    id: "transport",
    name: "Transport",
    icon: "🚗",
    color: "#9C27B0",
    description: "Fuel, parking, public transport, and car maintenance",
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: "🛍️",
    color: "#2196F3",
    description: "Clothing, accessories, and general retail",
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: "🎬",
    color: "#E91E63",
    description: "Movies, games, events, and leisure",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    icon: "⚕️",
    color: "#00BCD4",
    description: "Medical expenses, pharmacy, and health services",
  },
  {
    id: "utilities",
    name: "Utilities & Bills",
    icon: "💡",
    color: "#FFC107",
    description: "Electricity, water, internet, and phone bills",
  },
  {
    id: "electronics",
    name: "Electronics & Tech",
    icon: "📱",
    color: "#3F51B5",
    description: "Gadgets, computers, and tech accessories",
  },
  {
    id: "education",
    name: "Education",
    icon: "📚",
    color: "#009688",
    description: "Books, courses, and learning materials",
  },
  {
    id: "fitness",
    name: "Fitness & Sports",
    icon: "🏋️",
    color: "#FF5722",
    description: "Gym, sports equipment, and fitness activities",
  },
  {
    id: "travel",
    name: "Travel",
    icon: "✈️",
    color: "#607D8B",
    description: "Hotels, flights, and vacation expenses",
  },
  {
    id: "pets",
    name: "Pets",
    icon: "🐾",
    color: "#795548",
    description: "Pet food, vet visits, and pet supplies",
  },
  {
    id: "other",
    name: "Other",
    icon: "📦",
    color: "#757575",
    description: "Miscellaneous expenses",
  },
];

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((cat) => cat.id === id.toLowerCase());
}

export function getCategoryByName(name: string): Category | undefined {
  return CATEGORIES.find(
    (cat) => cat.name.toLowerCase() === name.toLowerCase(),
  );
}

export function getCategoryColor(categoryName: string): string {
  const category =
    getCategoryByName(categoryName) || getCategoryById(categoryName);
  return category?.color || CATEGORIES.find((c) => c.id === "other")!.color;
}

export function getCategoryIcon(categoryName: string): string {
  const category =
    getCategoryByName(categoryName) || getCategoryById(categoryName);
  return category?.icon || CATEGORIES.find((c) => c.id === "other")!.icon;
}
