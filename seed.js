/**
 * Standalone Seed Script for QueryWiz
 * Populates an external PostgreSQL database with 500 customers, 200 products,
 * 5,000 orders (with winter seasonality), 12,000 order_items, and 2,000 reviews.
 * 
 * Usage:
 *   DATABASE_URL="your-postgres-url" node seed.js
 */
import pg from "pg";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL environment variable is required to run seed.js.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("supabase.co") || DATABASE_URL.includes("railway.app")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function runSeed() {
  console.log("🚀 Starting QueryWiz manual database seeding...");
  
  const client = await pool.connect();
  
  try {
    // Begin Transaction
    await client.query("BEGIN");
    
    // Clear existing data safely
    console.log("🧹 Truncating existing tables...");
    await client.query("TRUNCATE TABLE reviews, order_items, orders, products, customers RESTART IDENTITY CASCADE;");

    // 1. Generate 500 customers
    console.log("👥 Generating 500 customers...");
    const customers = [];
    const cities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City", "Kaduna"];
    for (let i = 0; i < 500; i++) {
      const name = faker.person.fullName().replace(/'/g, "''");
      const email = faker.internet.email().toLowerCase().replace(/'/g, "''");
      const city = faker.helpers.arrayElement(cities).replace(/'/g, "''");
      const signup_date = faker.date.between({ from: "2023-01-01", to: "2024-12-31" }).toISOString().split("T")[0];
      const is_active = faker.datatype.boolean({ probability: 0.85 });
      
      customers.push({ name, email, city, signup_date, is_active });
    }

    // Bulk insert customers
    const customerQueries = customers.map(c => 
      `INSERT INTO customers (name, email, city, signup_date, is_active) VALUES ('${c.name}', '${c.email}', '${c.city}', '${c.signup_date}', ${c.is_active})`
    );
    for (const q of customerQueries) {
      await client.query(q);
    }
    console.log("✅ Customers seeded.");

    // 2. Generate 200 products
    console.log("📦 Generating 200 products...");
    const categories = {
      Electronics: { minPrice: 5000, maxPrice: 450000, names: ["Nile Pro Smartphone", "Zeta ANC Headphones", "Nova Smartwatch Pro", "Quantum 4K Monitor", "Vibe Soundbar", "Horizon Mech Keyboard", "Apex Wireless Mouse", "Ignite Charging Dock", "Prism LED Strip", "Nomad Powerbank", "Titan Gaming PC", "Aegis Router Pro", "Flux VR Headset", "Core Laptop Stand"] },
      Clothing: { minPrice: 1500, maxPrice: 35000, names: ["Luxe Linen Shirt", "Urban Cargo Pants", "Classic Denim Jacket", "Aero Cotton Hoody", "Activewear Shorts", "Stratus Crew-neck", "Vintage Leather Belt", "Merino Wool Scarf", "Nomad Backpack", "Breather Running Sneakers", "Comfort Knit Socks", "Retro Cotton Cap", "Thermal Jogger Pants", "Monochrome Trenchcoat"] },
      Home: { minPrice: 2000, maxPrice: 120000, names: ["Ergonomic Task Chair", "Minimalist Table Lamp", "Velvet Throw Pillows", "Bamboo Bedsheet Set", "Insulated Water Flask", "Soy Wax Scented Candle", "Ceramic Dinner Plate Set", "Espresso Mug Collection", "Automatic Milk Frother", "Premium Chef Knife", "Acoustic Room Divider", "Smart Air Purifier", "Handwoven jute rug"] },
      Sports: { minPrice: 4000, maxPrice: 95000, names: ["Evo Yoga Mat", "Grip Strength Trainer", "Resistance Band Pack", "Stainless Dumbbell 10kg", "Carbon Fiber Pickleball Paddle", "Hydro Sports Pouch", "Aerofit Jump Rope", "Apex Gym Duffel", "Trail Speed Hydration Vest", "Elite Bicycle Helmet", "Microfiber Fitness Towel"] }
    };

    const products = [];
    const keys = Object.keys(categories);
    for (let i = 0; i < 200; i++) {
      const catName = faker.helpers.arrayElement(keys);
      const cat = categories[catName];
      const rawName = faker.helpers.arrayElement(cat.names);
      const prodName = `${rawName} #${faker.number.int({ min: 100, max: 999 })}`.replace(/'/g, "''");
      const price = parseFloat(faker.number.float({ min: cat.minPrice, max: cat.maxPrice, fractionDigits: 2 }).toFixed(2));
      const stock_quantity = faker.number.int({ min: 5, max: 150 });
      const added_date = faker.date.between({ from: "2023-01-01", to: "2024-12-31" }).toISOString().split("T")[0];

      products.push({ name: prodName, category: catName, price, stock_quantity, added_date });
    }

    const productQueries = products.map(p => 
      `INSERT INTO products (name, category, price, stock_quantity, added_date) VALUES ('${p.name}', '${p.category}', ${p.price}, ${p.stock_quantity}, '${p.added_date}')`
    );
    for (const q of productQueries) {
      await client.query(q);
    }
    console.log("✅ Products seeded.");

    // 3. Generate 5,000 orders with seasonality
    console.log("🛒 Generating 5,000 orders (this will take a few seconds)...");
    const orders = [];
    
    const getRandomDate = () => {
      const year = faker.helpers.arrayElement([2024, 2025]);
      const monthIndex = faker.helpers.weightedArrayElement([
        { value: 0, weight: 6 },  // Jan
        { value: 1, weight: 6 },  // Feb
        { value: 2, weight: 7 },  // Mar
        { value: 3, weight: 6 },  // Apr
        { value: 4, weight: 7 },  // May
        { value: 5, weight: 6 },  // Jun
        { value: 6, weight: 7 },  // Jul
        { value: 7, weight: 6 },  // Aug
        { value: 8, weight: 8 },  // Sep
        { value: 9, weight: 9 },  // Oct
        { value: 10, weight: 18 }, // Nov (Seasonality!)
        { value: 11, weight: 24 }  // Dec (Seasonality!)
      ]);
      const day = faker.number.int({ min: 1, max: 28 });
      const hours = faker.number.int({ min: 0, max: 23 });
      const mins = faker.number.int({ min: 0, max: 59 });
      const secs = faker.number.int({ min: 0, max: 59 });
      return new Date(year, monthIndex, day, hours, mins, secs);
    };

    for (let i = 0; i < 5000; i++) {
      orders.push({
        customer_id: faker.number.int({ min: 1, max: 500 }),
        order_date: getRandomDate().toISOString().replace("T", " ").substring(0, 19),
        total_amount: 0.0, // Calculated later
        status: faker.helpers.weightedArrayElement([
          { value: "delivered", weight: 75 },
          { value: "shipped", weight: 12 },
          { value: "pending", weight: 8 },
          { value: "cancelled", weight: 5 }
        ]),
      });
    }

    // Insert orders in chunks to keep memory usage safe
    const CHUNK_SIZE = 500;
    for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
      const chunk = orders.slice(i, i + CHUNK_SIZE).map(o => 
        `INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES (${o.customer_id}, '${o.order_date}', ${o.total_amount}, '${o.status}')`
      );
      for (const q of chunk) {
        await client.query(q);
      }
    }
    console.log("✅ Orders seeded.");

    // 4. Generate 12,000 order items & calculate total order amounts
    console.log("🧾 Generating 12,000 order items...");
    const orderItems = [];
    const orderTotals = new Array(5000).fill(0.0);

    for (let i = 0; i < 12000; i++) {
      const order_id = faker.number.int({ min: 1, max: 5000 });
      const product_id = faker.number.int({ min: 1, max: 200 });
      const prod = products[product_id - 1];
      const quantity = faker.helpers.weightedArrayElement([
        { value: 1, weight: 65 },
        { value: 2, weight: 23 },
        { value: 3, weight: 8 },
        { value: 4, weight: 3 },
        { value: 5, weight: 1 }
      ]);
      const unit_price = prod.price;
      const subtotal = parseFloat((unit_price * quantity).toFixed(2));
      orderTotals[order_id - 1] += subtotal;

      orderItems.push({ order_id, product_id, quantity, unit_price });
    }

    for (let i = 0; i < orderItems.length; i += CHUNK_SIZE) {
      const chunk = orderItems.slice(i, i + CHUNK_SIZE).map(oi => 
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (${oi.order_id}, ${oi.product_id}, ${oi.quantity}, ${oi.unit_price})`
      );
      for (const q of chunk) {
        await client.query(q);
      }
    }
    console.log("✅ Order items seeded.");

    // Update order totals with calculated values
    console.log("💰 Updating order invoice math in SQL...");
    for (let id = 1; id <= 5000; id++) {
      const finalAmt = parseFloat(orderTotals[id - 1].toFixed(2));
      await client.query(`UPDATE orders SET total_amount = ${finalAmt} WHERE id = ${id}`);
    }
    console.log("✅ Order calculations updated.");

    // 5. Generate 2,000 Reviews
    console.log("⭐ Generating 2,000 ratings & reviews...");
    const reviews = [];
    const reviewComments = [
      "Absolutely amazing product, highly recommended!",
      "Decent quality for the money, works as described.",
      "Broke after two days of usage. Very disappointed.",
      "Very reliable and durable, worth every penny.",
      "Shipping was speedy but the packaging was crushed. Product works well though.",
      "Very bad customer support. Product is mediocre.",
      "Outstanding performance! Stays strong under regular heavy use.",
      "The color in realistic person is slightly lighter than product images, overall satisfied.",
      "Satisfactory, nothing extremely impressive but functions as required.",
      "A game changer, fully exceeded my high expectations."
    ];

    for (let i = 0; i < 2000; i++) {
      const product_id = faker.number.int({ min: 1, max: 200 });
      const customer_id = faker.number.int({ min: 1, max: 500 });
      const rating = faker.helpers.weightedArrayElement([
        { value: 5, weight: 45 },
        { value: 4, weight: 30 },
        { value: 3, weight: 15 },
        { value: 2, weight: 6 },
        { value: 1, weight: 4 }
      ]);
      const review_text = faker.helpers.arrayElement(reviewComments).replace(/'/g, "''");
      const created_at = faker.date.between({ from: "2023-01-01", to: "2025-05-31" }).toISOString().replace("T", " ").substring(0, 19);

      reviews.push({ product_id, customer_id, rating, review_text, created_at });
    }

    for (let i = 0; i < reviews.length; i += CHUNK_SIZE) {
      const chunk = reviews.slice(i, i + CHUNK_SIZE).map(r => 
        `INSERT INTO reviews (product_id, customer_id, rating, review_text, created_at) VALUES (${r.product_id}, ${r.customer_id}, ${r.rating}, '${r.review_text}', '${r.created_at}')`
      );
      for (const q of chunk) {
        await client.query(q);
      }
    }
    console.log("✅ Reviews seeded.");

    await client.query("COMMIT");
    console.log("🎉 SUCCESS! Database successfully seeded with 19,700 records!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ SQL transactional error running seed.js:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
