import mongoose from "mongoose";
import UserModel from "../models/user.model";
import AdminProfile from "../models/admin-profile.model";
import dotenv from "dotenv";

dotenv.config();

const seedAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI!);

  const adminEmail = "momohabduljabbar@gmail.com";

  const existingAdmin = await UserModel.findOne({ email: adminEmail });

  if (existingAdmin) {
    // Update the profile even if the admin already exists.
    await AdminProfile.findOneAndUpdate(
      { userId: existingAdmin._id },
      { avatar: "/jabbar2.jpg" },
      { upsert: true },
    );
    console.log("✅ Admin profile updated");
    process.exit(0);
  }

  const admin = await UserModel.create({
    name: "vintage_jab",
    email: adminEmail,
    password: "Admin12345",
    role: "admin",
  });

  await AdminProfile.create({
    userId: admin._id,
    avatar: "/jabbar2.jpg", // A photo from the frontend's public folder.
  });

  console.log("🚀 Admin seeded successfully");
  process.exit(0);
};

seedAdmin();
