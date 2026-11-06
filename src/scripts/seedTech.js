const mongoose = require("mongoose");
const { connectDB } = require("../db");
const Product = require("../models/Product");

async function seed() {
  await connectDB();
  await Product.updateMany({ category: { $in: ["flagship", "budget"] } }, { $set: { category: "phone" } });

  const count = await Product.countDocuments({ category: "laptop" });
  if (count === 0) {
    await Product.insertMany([
      {
        name: "Apple MacBook Air 13 M3 (16GB / 512GB)",
        brand: "Apple",
        category: "laptop",
        type: "laptop",
        price: 14800000,
        oldPrice: 15900000,
        stock: 5,
        description: "Apple M3 chip, 13.6 dyuym Liquid Retina ekran, 16GB RAM, 512GB SSD, Space Gray",
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
      {
        name: "ASUS TUF Gaming A15 (RTX 4060 / 16GB)",
        brand: "ASUS",
        category: "laptop",
        type: "laptop",
        price: 11200000,
        stock: 4,
        description: "AMD Ryzen 7 7735HS, GeForce RTX 4060 8GB, 144Hz IPS ekran, 16GB DDR5, 512GB NVMe SSD",
        image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
      {
        name: "Lenovo IdeaPad Slim 3 15 (Core i5 / 16GB)",
        brand: "Lenovo",
        category: "laptop",
        type: "laptop",
        price: 5600000,
        oldPrice: 6100000,
        stock: 8,
        description: "Intel Core i5-12450H, 15.6 FHD IPS, 16GB RAM, 512GB SSD, Arctic Grey",
        image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
      {
        name: "Logitech MX Keys S Premium Klaviatura",
        brand: "Logitech",
        category: "keyboard",
        type: "keyboard",
        price: 1450000,
        stock: 12,
        description: "Simsiz mukammal klaviatura, aqlli orqa yoritgich, sokin tugmalar, USB-C / Bluetooth",
        image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
      {
        name: "Redragon K552 RGB Mexanik Klaviatura",
        brand: "Redragon",
        category: "keyboard",
        type: "keyboard",
        price: 480000,
        stock: 15,
        description: "Outemu Blue switch mexanik tugmalar, RGB yoritish, metal mustahkam korpus",
        image: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
      {
        name: "Logitech G502 HERO Gaming Mouse",
        brand: "Logitech",
        category: "mouse",
        type: "mouse",
        price: 680000,
        oldPrice: 750000,
        stock: 10,
        description: "HERO 25K datchik, 25600 DPI, 11 ta dasturlanadigan tugma, sozlanuvchi og'irliklar",
        image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
      {
        name: "Razer DeathAdder Essential Sichqoncha",
        brand: "Razer",
        category: "mouse",
        type: "mouse",
        price: 360000,
        stock: 14,
        description: "6400 DPI optik datchik, 5 ta Hyperesponse tugma, ergonomik klassik shakl",
        image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
      {
        name: "Apple AirPods Pro 2 (USB-C)",
        brand: "Apple",
        category: "accessory",
        type: "accessory",
        price: 2850000,
        stock: 7,
        description: "Faol shovqinni bekor qilish (ANC), shaffoflik rejimi, MagSafe korpus, H2 chip",
        image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&auto=format&fit=crop&q=80",
        condition: "new",
      },
    ]);
    console.log("Mahsulotlar muvaffaqiyatli qo'shildi!");
  } else {
    console.log("Noutbuklar allaqachon mavjud");
  }
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
