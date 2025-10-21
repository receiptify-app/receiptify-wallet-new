import { storage } from "./storage";

async function seed() {
  console.log("Starting database seed...");
  
  const userId = "default-user";
  
  // Create Waitrose receipt - Food category
  const waitroseReceipt = await storage.createReceipt({
    userId,
    merchantName: "Waitrose",
    location: "Harrow Weald, London",
    total: "12.02",
    date: new Date("2025-10-12T16:34:00"),
    category: "Food",
    paymentMethod: "VISA Debit",
    receiptNumber: "WAIT-2025-001",
    currency: "GBP",
    ecoPoints: 1,
  });
  
  // Waitrose items
  await storage.createReceiptItem({
    receiptId: waitroseReceipt.id,
    name: "Baguette",
    price: "2.00",
    quantity: "1",
    category: "Food",
  });
  
  await storage.createReceiptItem({
    receiptId: waitroseReceipt.id,
    name: "Mozzarella",
    price: "1.70",
    quantity: "2",
    category: "Food",
  });
  
  await storage.createReceiptItem({
    receiptId: waitroseReceipt.id,
    name: "Smoked Salmon",
    price: "4.87",
    quantity: "1",
    category: "Food",
  });
  
  await storage.createReceiptItem({
    receiptId: waitroseReceipt.id,
    name: "Organic Tomatoes",
    price: "1.75",
    quantity: "1",
    category: "Food",
  });
  
  console.log("✓ Created Waitrose receipt");
  
  // Create additional Food receipt to reach £17.20 total
  const tescoReceipt = await storage.createReceipt({
    userId,
    merchantName: "Tesco",
    location: "London, UK",
    total: "5.18",
    date: new Date("2025-10-10T10:30:00"),
    category: "Food",
    paymentMethod: "Card",
    receiptNumber: "TESCO-2025-004",
    currency: "GBP",
    ecoPoints: 1,
  });
  
  await storage.createReceiptItem({
    receiptId: tescoReceipt.id,
    name: "Milk",
    price: "1.50",
    quantity: "1",
    category: "Food",
  });
  
  await storage.createReceiptItem({
    receiptId: tescoReceipt.id,
    name: "Bread",
    price: "1.20",
    quantity: "1",
    category: "Food",
  });
  
  await storage.createReceiptItem({
    receiptId: tescoReceipt.id,
    name: "Eggs",
    price: "2.48",
    quantity: "1",
    category: "Food",
  });
  
  console.log("✓ Created Tesco receipt");
  
  // Create Argos receipt - Tech category (£59.99 total but showing in June for "Recent Activities")
  const argosReceipt = await storage.createReceipt({
    userId,
    merchantName: "Argos",
    location: "London, UK",
    total: "59.99",
    date: new Date("2025-09-25T14:20:00"),
    category: "Tech",
    paymentMethod: "Mastercard",
    receiptNumber: "ARGOS-2025-002",
    currency: "GBP",
    ecoPoints: 1,
  });
  
  // Argos items
  await storage.createReceiptItem({
    receiptId: argosReceipt.id,
    name: "Wireless Mouse",
    price: "29.99",
    quantity: "1",
    category: "Tech",
  });
  
  await storage.createReceiptItem({
    receiptId: argosReceipt.id,
    name: "Phone Stand",
    price: "15.00",
    quantity: "1",
    category: "Tech",
  });
  
  await storage.createReceiptItem({
    receiptId: argosReceipt.id,
    name: "Cable",
    price: "15.00",
    quantity: "1",
    category: "Tech",
  });
  
  console.log("✓ Created Argos receipt");
  
  // Create Tech receipt for October to reach £1.99
  const currysReceipt = await storage.createReceipt({
    userId,
    merchantName: "Currys",
    location: "London, UK",
    total: "1.99",
    date: new Date("2025-10-05T14:00:00"),
    category: "Tech",
    paymentMethod: "Card",
    receiptNumber: "CURRYS-2025-006",
    currency: "GBP",
    ecoPoints: 1,
  });
  
  await storage.createReceiptItem({
    receiptId: currysReceipt.id,
    name: "USB Cable",
    price: "1.99",
    quantity: "1",
    category: "Tech",
  });
  
  console.log("✓ Created Currys receipt");
  
  // Create Shell receipt - Transport category (October for monthly total)
  const shellReceipt = await storage.createReceipt({
    userId,
    merchantName: "Shell",
    location: "M25 Service Station",
    total: "23.80",
    date: new Date("2025-10-22T09:15:00"),
    category: "Transport",
    paymentMethod: "Contactless",
    receiptNumber: "SHELL-2025-003",
    currency: "GBP",
    ecoPoints: 1,
  });
  
  // Shell items
  await storage.createReceiptItem({
    receiptId: shellReceipt.id,
    name: "Unleaded Petrol",
    price: "23.80",
    quantity: "1",
    category: "Transport",
  });
  
  console.log("✓ Created Shell receipt");
  
  // Create BP receipt - Transport to reach £103.00 total
  const bpReceipt = await storage.createReceipt({
    userId,
    merchantName: "BP",
    location: "London, UK",
    total: "79.20",
    date: new Date("2025-10-15T08:00:00"),
    category: "Transport",
    paymentMethod: "Card",
    receiptNumber: "BP-2025-005",
    currency: "GBP",
    ecoPoints: 1,
  });
  
  await storage.createReceiptItem({
    receiptId: bpReceipt.id,
    name: "Diesel",
    price: "79.20",
    quantity: "1",
    category: "Transport",
  });
  
  console.log("✓ Created BP receipt");
  
  console.log("\n✅ Seed completed successfully!");
  console.log("\nOctober 2025 Summary (This Month):");
  console.log("- Food: £17.20 (Waitrose £12.02 + Tesco £5.18)");
  console.log("- Tech: £1.99 (Currys £1.99)");
  console.log("- Transport: £103.00 (BP £79.20 + Shell £23.80)");
  console.log("- TOTAL: £122.19");
  console.log("\nRecent Activities (All Time):");
  console.log("- Shell — 22 October 2025 — £23.80 (Transport)");
  console.log("- BP — 15 October 2025 — £79.20 (Transport)");
  console.log("- Waitrose — 12 October 2025 — £12.02 (Food)");
  
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
