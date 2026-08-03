/**
 * Creates the 60 classes only. Assumes trainers already exist.
 *
 * Flow:
 *   1. Log in as admin.
 *   2. GET /users (admin-only) to list every user, filter down to
 *      the trainer emails we need, and pull their _id — no trainer
 *      passwords required.
 *   3. POST /classes for all 60 classes, referencing each trainer's
 *      user _id from step 2.
 *
 * Requires Node 18+ (built-in fetch). Run with:
 *   node src/seed/create_classes.js
 */

const CONFIG = {
  apiBase: "http://localhost:5000/api",
  adminEmail: "momohabduljabbar@gmail.com", // your real admin login
  adminPassword: "Admin12345", // your real admin password
};

let cookieHeader = "";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${CONFIG.apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(options.headers || {}),
    },
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookieHeader = setCookie.split(";")[0];

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error(
      `${options.method || "GET"} ${path} failed (${res.status}): ${JSON.stringify(data)}`,
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

async function login(email, password) {
  await apiFetch("/users/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Handles whatever shape GET /users returns (raw array, {users:[...]},
// or {data:[...]}) without needing to know the controller's exact format.
function extractUserArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data)) return payload.data;
  throw new Error(
    `Could not find a user array in /users response: ${JSON.stringify(payload)}`,
  );
}

async function getTrainerIdsByEmail(emails) {
  const payload = await apiFetch("/users", { method: "GET" });
  const users = extractUserArray(payload);

  const idByEmail = {};
  for (const email of emails) {
    const match = users.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (match) {
      idByEmail[email] = match._id || match.id;
    }
  }
  return idByEmail;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------
// TRAINER EMAILS (just enough to resolve ids)
// ---------------------------------------------------------------

const TRAINER_EMAILS = [
  "noah.schmidt@gymontime.com",
  "chidi.okonkwo@gymontime.com",
  "grace.kim@gymontime.com",
  "amara.nwachukwu@gymontime.com",
  "ryan.osullivan@gymontime.com",
  "folake.adeyemi@gymontime.com",
  "diego.alvarez@gymontime.com",
  "emeka.chukwu@gymontime.com",
  "chloe.bennett@gymontime.com",
  "hiroshi.tanaka@gymontime.com",
  "ngozi.obi@gymontime.com",
  "marco.bianchi@gymontime.com",
  "yusuf.bello@gymontime.com",
  "connor.walsh@gymontime.com",
  "blessing.eze@gymontime.com",
];

// ---------------------------------------------------------------
// CLASSES (trainer referenced by EMAIL, resolved to id at runtime)
// ---------------------------------------------------------------

const CLASSES = [
  {
    name: "Power Foundations",
    trainerEmail: "noah.schmidt@gymontime.com",
    description: "Build raw strength with barbell and bodyweight fundamentals.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "06:00",
    duration: 60,
    capacity: 15,
    oneTime: 3000,
  },
  {
    name: "Total Body Strength",
    trainerEmail: "noah.schmidt@gymontime.com",
    description: "Full-body resistance training to build balanced strength.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "07:00",
    duration: 45,
    capacity: 12,
    oneTime: 2800,
  },
  {
    name: "Daily Strength Sprint",
    trainerEmail: "noah.schmidt@gymontime.com",
    description: "Quick daily strength session to build consistency.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "06:30",
    duration: 30,
    capacity: 10,
    oneTime: 2000,
  },
  {
    name: "Strength Bootcamp (Taster)",
    trainerEmail: "noah.schmidt@gymontime.com",
    description: "One-off intro session covering core lifting techniques.",
    recurrence: "none",
    recurrenceDays: [],
    time: "08:00",
    duration: 60,
    capacity: 20,
    oneTime: 3500,
    daysFromNow: 7,
  },

  {
    name: "Cardio Blast",
    trainerEmail: "chidi.okonkwo@gymontime.com",
    description: "High-energy cardio session to torch calories fast.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "06:30",
    duration: 45,
    capacity: 20,
    oneTime: 2500,
  },
  {
    name: "HIIT Circuit",
    trainerEmail: "chidi.okonkwo@gymontime.com",
    description: "Interval-based circuit training for max calorie burn.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday", "saturday"],
    time: "17:30",
    duration: 40,
    capacity: 18,
    oneTime: 2500,
  },
  {
    name: "Daily HIIT Express",
    trainerEmail: "chidi.okonkwo@gymontime.com",
    description: "Short, intense daily HIIT to keep your heart rate up.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "12:00",
    duration: 20,
    capacity: 15,
    oneTime: 1800,
  },
  {
    name: "New Year Cardio Kickoff",
    trainerEmail: "chidi.okonkwo@gymontime.com",
    description: "One-off cardio session to start your fitness goals strong.",
    recurrence: "none",
    recurrenceDays: [],
    time: "09:00",
    duration: 45,
    capacity: 25,
    oneTime: 2500,
    daysFromNow: 14,
  },

  {
    name: "Sunrise Yoga",
    trainerEmail: "grace.kim@gymontime.com",
    description: "Gentle morning yoga to energize your day.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday"],
    time: "06:00",
    duration: 60,
    capacity: 15,
    oneTime: 3500,
  },
  {
    name: "Deep Stretch & Flexibility",
    trainerEmail: "grace.kim@gymontime.com",
    description: "Slow, focused stretching to improve range of motion.",
    recurrence: "weekly",
    recurrenceDays: ["thursday", "saturday"],
    time: "17:00",
    duration: 50,
    capacity: 12,
    oneTime: 3200,
  },
  {
    name: "Daily Morning Flow",
    trainerEmail: "grace.kim@gymontime.com",
    description: "Daily yoga flow to build flexibility and calm the mind.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "06:00",
    duration: 30,
    capacity: 15,
    oneTime: 2000,
  },
  {
    name: "Full Moon Restorative Yoga",
    trainerEmail: "grace.kim@gymontime.com",
    description: "One-off evening yoga session for deep relaxation.",
    recurrence: "none",
    recurrenceDays: [],
    time: "19:00",
    duration: 60,
    capacity: 20,
    oneTime: 3000,
    daysFromNow: 7,
  },

  {
    name: "Women's Strength Circuit",
    trainerEmail: "amara.nwachukwu@gymontime.com",
    description: "Strength-focused circuit designed for women of all levels.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "07:00",
    duration: 60,
    capacity: 15,
    oneTime: 3000,
  },
  {
    name: "Confidence & Conditioning",
    trainerEmail: "amara.nwachukwu@gymontime.com",
    description: "Build strength and confidence through guided conditioning.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "08:00",
    duration: 45,
    capacity: 12,
    oneTime: 2800,
  },
  {
    name: "Daily Strength for Women",
    trainerEmail: "amara.nwachukwu@gymontime.com",
    description: "Short daily strength session tailored for women.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "07:30",
    duration: 30,
    capacity: 10,
    oneTime: 2000,
  },
  {
    name: "Strong Women Workshop",
    trainerEmail: "amara.nwachukwu@gymontime.com",
    description: "One-off workshop on safe, effective strength training.",
    recurrence: "none",
    recurrenceDays: [],
    time: "10:00",
    duration: 90,
    capacity: 25,
    oneTime: 4000,
    daysFromNow: 21,
  },

  {
    name: "5K Run Club",
    trainerEmail: "ryan.osullivan@gymontime.com",
    description: "Group run session to build speed and stamina.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "05:30",
    duration: 45,
    capacity: 20,
    oneTime: 2200,
  },
  {
    name: "Endurance Builder",
    trainerEmail: "ryan.osullivan@gymontime.com",
    description: "Longer session focused on building running endurance.",
    recurrence: "weekly",
    recurrenceDays: ["saturday"],
    time: "06:00",
    duration: 90,
    capacity: 15,
    oneTime: 3500,
  },
  {
    name: "Daily Interval Runs",
    trainerEmail: "ryan.osullivan@gymontime.com",
    description: "Short daily interval runs to improve pace and stamina.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "05:30",
    duration: 30,
    capacity: 15,
    oneTime: 1800,
  },
  {
    name: "Half-Marathon Prep Day",
    trainerEmail: "ryan.osullivan@gymontime.com",
    description: "One-off long-run session to prep for race day.",
    recurrence: "none",
    recurrenceDays: [],
    time: "06:00",
    duration: 120,
    capacity: 30,
    oneTime: 5000,
    daysFromNow: 28,
  },

  {
    name: "Core & Control Pilates",
    trainerEmail: "folake.adeyemi@gymontime.com",
    description: "Pilates focused on core strength and stability.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "09:00",
    duration: 50,
    capacity: 12,
    oneTime: 3200,
  },
  {
    name: "Pilates Fundamentals",
    trainerEmail: "folake.adeyemi@gymontime.com",
    description: "Beginner-friendly Pilates covering the basics.",
    recurrence: "weekly",
    recurrenceDays: ["saturday"],
    time: "10:00",
    duration: 45,
    capacity: 10,
    oneTime: 3000,
  },
  {
    name: "Daily Core Reset",
    trainerEmail: "folake.adeyemi@gymontime.com",
    description: "Short daily core session to build core strength.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "09:00",
    duration: 20,
    capacity: 12,
    oneTime: 1800,
  },
  {
    name: "Pilates & Prosecco Evening",
    trainerEmail: "folake.adeyemi@gymontime.com",
    description: "One-off relaxed evening Pilates social session.",
    recurrence: "none",
    recurrenceDays: [],
    time: "18:00",
    duration: 60,
    capacity: 20,
    oneTime: 4000,
    daysFromNow: 14,
  },

  {
    name: "Zumba Party",
    trainerEmail: "diego.alvarez@gymontime.com",
    description: "Fun, high-energy dance cardio set to great music.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "18:30",
    duration: 45,
    capacity: 25,
    oneTime: 2000,
  },
  {
    name: "Dance Cardio Jam",
    trainerEmail: "diego.alvarez@gymontime.com",
    description: "Dance-based cardio workout for all fitness levels.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "19:00",
    duration: 45,
    capacity: 25,
    oneTime: 2000,
  },
  {
    name: "Daily Dance Warmup",
    trainerEmail: "diego.alvarez@gymontime.com",
    description: "Short daily dance session to get your body moving.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "18:00",
    duration: 20,
    capacity: 20,
    oneTime: 1500,
  },
  {
    name: "Latin Night Dance Special",
    trainerEmail: "diego.alvarez@gymontime.com",
    description: "One-off Latin-themed dance party workout.",
    recurrence: "none",
    recurrenceDays: [],
    time: "20:00",
    duration: 60,
    capacity: 30,
    oneTime: 3000,
    daysFromNow: 7,
  },

  {
    name: "Powerlifting 101",
    trainerEmail: "emeka.chukwu@gymontime.com",
    description: "Learn proper form for squat, bench, and deadlift.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "16:00",
    duration: 60,
    capacity: 10,
    oneTime: 4000,
  },
  {
    name: "Big Three Technique",
    trainerEmail: "emeka.chukwu@gymontime.com",
    description: "Deep dive into technique for the big three lifts.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "17:00",
    duration: 60,
    capacity: 8,
    oneTime: 4200,
  },
  {
    name: "Daily Lifting Session",
    trainerEmail: "emeka.chukwu@gymontime.com",
    description: "Daily lifting practice to build strength consistently.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "16:30",
    duration: 45,
    capacity: 8,
    oneTime: 3500,
  },
  {
    name: "Max-Out Competition Day",
    trainerEmail: "emeka.chukwu@gymontime.com",
    description: "One-off session to test your one-rep max.",
    recurrence: "none",
    recurrenceDays: [],
    time: "10:00",
    duration: 120,
    capacity: 15,
    oneTime: 5000,
    daysFromNow: 35,
  },

  {
    name: "Functional Fitness Basics",
    trainerEmail: "chloe.bennett@gymontime.com",
    description: "Real-world movement patterns for everyday strength.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "06:30",
    duration: 50,
    capacity: 15,
    oneTime: 2800,
  },
  {
    name: "Movement & Mobility",
    trainerEmail: "chloe.bennett@gymontime.com",
    description: "Improve mobility and prevent injury with guided movement.",
    recurrence: "weekly",
    recurrenceDays: ["saturday"],
    time: "09:00",
    duration: 45,
    capacity: 12,
    oneTime: 2800,
  },
  {
    name: "Daily Mobility Reset",
    trainerEmail: "chloe.bennett@gymontime.com",
    description: "Short daily mobility work to stay limber.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "07:00",
    duration: 20,
    capacity: 15,
    oneTime: 1800,
  },
  {
    name: "Injury Prevention Workshop",
    trainerEmail: "chloe.bennett@gymontime.com",
    description: "One-off workshop on safe movement and injury prevention.",
    recurrence: "none",
    recurrenceDays: [],
    time: "11:00",
    duration: 60,
    capacity: 20,
    oneTime: 3200,
    daysFromNow: 14,
  },

  {
    name: "Martial Arts Fundamentals",
    trainerEmail: "hiroshi.tanaka@gymontime.com",
    description: "Learn foundational martial arts stances and techniques.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "17:00",
    duration: 60,
    capacity: 15,
    oneTime: 3500,
  },
  {
    name: "Self-Defense Essentials",
    trainerEmail: "hiroshi.tanaka@gymontime.com",
    description: "Practical self-defense skills for everyday safety.",
    recurrence: "weekly",
    recurrenceDays: ["saturday"],
    time: "11:00",
    duration: 60,
    capacity: 15,
    oneTime: 3500,
  },
  {
    name: "Daily Discipline Drills",
    trainerEmail: "hiroshi.tanaka@gymontime.com",
    description: "Daily martial arts drills to build discipline and skill.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "17:30",
    duration: 30,
    capacity: 12,
    oneTime: 2200,
  },
  {
    name: "Women's Self-Defense Day",
    trainerEmail: "hiroshi.tanaka@gymontime.com",
    description:
      "One-off self-defense session focused on real-world scenarios.",
    recurrence: "none",
    recurrenceDays: [],
    time: "14:00",
    duration: 90,
    capacity: 25,
    oneTime: 3500,
    daysFromNow: 21,
  },

  {
    name: "Prenatal Fitness",
    trainerEmail: "ngozi.obi@gymontime.com",
    description: "Safe, guided fitness for expecting mothers.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday"],
    time: "10:00",
    duration: 45,
    capacity: 10,
    oneTime: 3000,
  },
  {
    name: "Postnatal Recovery",
    trainerEmail: "ngozi.obi@gymontime.com",
    description: "Gentle recovery-focused fitness for new mothers.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "11:00",
    duration: 45,
    capacity: 10,
    oneTime: 3000,
  },
  {
    name: "Daily Gentle Movement",
    trainerEmail: "ngozi.obi@gymontime.com",
    description: "Short daily low-impact movement session.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "10:30",
    duration: 20,
    capacity: 10,
    oneTime: 1800,
  },
  {
    name: "New Moms Wellness Day",
    trainerEmail: "ngozi.obi@gymontime.com",
    description: "One-off wellness session for new and expecting mothers.",
    recurrence: "none",
    recurrenceDays: [],
    time: "12:00",
    duration: 60,
    capacity: 15,
    oneTime: 3000,
    daysFromNow: 7,
  },

  {
    name: "Hypertrophy Training",
    trainerEmail: "marco.bianchi@gymontime.com",
    description: "Muscle-building session focused on hypertrophy techniques.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "13:00",
    duration: 60,
    capacity: 12,
    oneTime: 3800,
  },
  {
    name: "Bodybuilding Basics",
    trainerEmail: "marco.bianchi@gymontime.com",
    description: "Learn foundational bodybuilding training principles.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "14:00",
    duration: 60,
    capacity: 12,
    oneTime: 3800,
  },
  {
    name: "Daily Muscle Builder",
    trainerEmail: "marco.bianchi@gymontime.com",
    description: "Daily muscle-focused training session.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "13:30",
    duration: 45,
    capacity: 10,
    oneTime: 3200,
  },
  {
    name: "Physique Prep Intensive",
    trainerEmail: "marco.bianchi@gymontime.com",
    description: "One-off intensive session for physique competition prep.",
    recurrence: "none",
    recurrenceDays: [],
    time: "15:00",
    duration: 120,
    capacity: 15,
    oneTime: 5000,
    daysFromNow: 28,
  },

  {
    name: "CrossFit WOD",
    trainerEmail: "yusuf.bello@gymontime.com",
    description: "Varied high-intensity workout of the day.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "05:30",
    duration: 60,
    capacity: 15,
    oneTime: 3500,
  },
  {
    name: "CrossFit Conditioning",
    trainerEmail: "yusuf.bello@gymontime.com",
    description: "Conditioning-focused CrossFit-style session.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "06:00",
    duration: 60,
    capacity: 15,
    oneTime: 3500,
  },
  {
    name: "Daily CrossFit Express",
    trainerEmail: "yusuf.bello@gymontime.com",
    description: "Short daily CrossFit-style workout.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "06:00",
    duration: 30,
    capacity: 12,
    oneTime: 2500,
  },
  {
    name: "CrossFit Open Challenge",
    trainerEmail: "yusuf.bello@gymontime.com",
    description: "One-off session testing CrossFit benchmark workouts.",
    recurrence: "none",
    recurrenceDays: [],
    time: "09:00",
    duration: 90,
    capacity: 25,
    oneTime: 4000,
    daysFromNow: 14,
  },

  {
    name: "Senior Mobility & Balance",
    trainerEmail: "connor.walsh@gymontime.com",
    description: "Gentle mobility and balance training for older adults.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "08:00",
    duration: 45,
    capacity: 12,
    oneTime: 2500,
  },
  {
    name: "Low-Impact Strength",
    trainerEmail: "connor.walsh@gymontime.com",
    description: "Low-impact strength training suitable for all levels.",
    recurrence: "weekly",
    recurrenceDays: ["saturday"],
    time: "09:00",
    duration: 45,
    capacity: 12,
    oneTime: 2500,
  },
  {
    name: "Daily Gentle Stretch",
    trainerEmail: "connor.walsh@gymontime.com",
    description: "Short daily stretch session to maintain flexibility.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "08:30",
    duration: 20,
    capacity: 12,
    oneTime: 1800,
  },
  {
    name: "Active Aging Workshop",
    trainerEmail: "connor.walsh@gymontime.com",
    description: "One-off workshop on staying active and mobile with age.",
    recurrence: "none",
    recurrenceDays: [],
    time: "10:00",
    duration: 60,
    capacity: 20,
    oneTime: 3000,
    daysFromNow: 21,
  },

  {
    name: "Boxing Fundamentals",
    trainerEmail: "blessing.eze@gymontime.com",
    description: "Learn proper boxing stance, footwork, and punches.",
    recurrence: "weekly",
    recurrenceDays: ["monday", "wednesday", "friday"],
    time: "19:00",
    duration: 60,
    capacity: 18,
    oneTime: 3200,
  },
  {
    name: "Kickboxing Conditioning",
    trainerEmail: "blessing.eze@gymontime.com",
    description: "Cardio-focused kickboxing conditioning workout.",
    recurrence: "weekly",
    recurrenceDays: ["tuesday", "thursday"],
    time: "20:00",
    duration: 45,
    capacity: 18,
    oneTime: 3200,
  },
  {
    name: "Daily Bag Work",
    trainerEmail: "blessing.eze@gymontime.com",
    description: "Short daily bag work session to build technique.",
    recurrence: "daily",
    recurrenceDays: [],
    time: "19:30",
    duration: 30,
    capacity: 15,
    oneTime: 2500,
  },
  {
    name: "Sparring Fundamentals Day",
    trainerEmail: "blessing.eze@gymontime.com",
    description: "One-off session introducing basic sparring fundamentals.",
    recurrence: "none",
    recurrenceDays: [],
    time: "16:00",
    duration: 90,
    capacity: 20,
    oneTime: 4000,
    daysFromNow: 42,
  },
];

// ---------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------

function buildScheduleISO(time, daysFromNow) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setDate(date.getDate() + (daysFromNow ?? 1));
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------

async function main() {
  console.log("Logging in as admin...");
  await login(CONFIG.adminEmail, CONFIG.adminPassword);

  console.log(
    `Resolving ids for ${TRAINER_EMAILS.length} trainers via GET /users...`,
  );
  const trainerIdByEmail = await getTrainerIdsByEmail(TRAINER_EMAILS);

  for (const email of TRAINER_EMAILS) {
    if (trainerIdByEmail[email]) {
      console.log(`  ✅ ${email} -> ${trainerIdByEmail[email]}`);
    } else {
      console.log(`  ❌ ${email}: not found among users`);
    }
  }

  console.log(`\nCreating ${CLASSES.length} classes...`);
  for (const c of CLASSES) {
    const trainerId = trainerIdByEmail[c.trainerEmail];
    if (!trainerId) {
      console.log(
        `  ❌ ${c.name}: trainer ${c.trainerEmail} id could not be resolved, skipping`,
      );
      continue;
    }

    try {
      await apiFetch("/classes", {
        method: "POST",
        body: JSON.stringify({
          name: c.name,
          description: c.description,
          schedule: buildScheduleISO(c.time, c.daysFromNow),
          duration: c.duration,
          capacity: c.capacity,
          recurrence: c.recurrence,
          recurrenceDays: c.recurrence === "weekly" ? c.recurrenceDays : [],
          trainer: trainerId,
          pricing: { oneTime: c.oneTime },
        }),
      });
      console.log(`  ✅ ${c.name}`);
    } catch (err) {
      console.log(`  ❌ ${c.name}: ${err.message}`);
    }
    await sleep(150);
  }

  console.log("\n🎉 Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
