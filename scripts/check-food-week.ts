import { FOOD_PLACES } from "../src/data/albany-food";
import { formatWhen, matchFood, nyParts, openingsFor, zonedDate } from "../src/lib/food-week";

const now = zonedDate(2026, 9, 30, 20, 15);
const parts = nyParts(now);
if (parts.weekday !== 3 || parts.hour !== 20) {
  throw new Error(`expected Wed 20:15 ET, got ${JSON.stringify(parts)}`);
}

const produce = FOOD_PLACES.find((p) => p.id === "produce-pickup");
const latinos = FOOD_PLACES.find((p) => p.id === "cd-latinos");
const israel = FOOD_PLACES.find((p) => p.id === "israel-ame-pantry");
const connect = FOOD_PLACES.find((p) => p.id === "connect-center");
const alliance = FOOD_PLACES.find((p) => p.id === "alliance-positive-health");
if (!produce || !latinos || !israel || !connect || !alliance) throw new Error("missing place");

const weekEnd = zonedDate(2026, 10, 4, 23, 59);
function names(placeId: string) {
  const place = FOOD_PLACES.find((p) => p.id === placeId)!;
  return openingsFor(place, now, weekEnd).map((o) => formatWhen(o));
}

const produceHits = names("produce-pickup");
if (!produceHits.some((s) => s.includes("Thursday") && s.includes("Oct 1"))) {
  throw new Error("produce should be Thu Oct 1: " + produceHits.join(" | "));
}
const latinoHits = names("cd-latinos");
if (!latinoHits.some((s) => s.includes("Friday") && s.includes("Oct 2"))) {
  throw new Error("latinos should be Fri Oct 2: " + latinoHits.join(" | "));
}
const israelHits = names("israel-ame-pantry");
if (israelHits.length !== 0) {
  throw new Error("israel pantry is 3rd Thursday, not this week: " + israelHits.join(" | "));
}
const connectHits = names("connect-center");
if (connectHits.some((s) => s.includes("Sunday"))) {
  throw new Error("connect center closed 1st Sunday: " + connectHits.join(" | "));
}
if (!connectHits.some((s) => s.includes("Thursday"))) {
  throw new Error("connect center should include Thursday: " + connectHits.join(" | "));
}
const allianceHits = names("alliance-positive-health");
if (allianceHits.some((s) => s.includes("Wednesday"))) {
  throw new Error("alliance Wednesday window should be over: " + allianceHits.join(" | "));
}
if (!allianceHits.some((s) => s.includes("Friday"))) {
  throw new Error("alliance should show Friday: " + allianceHits.join(" | "));
}

const south = matchFood("12202", now);
if (!south.ok) throw new Error("12202 should match");
if (south.places.length < 3 || south.places.length > 5) {
  throw new Error("expected 3-5 places, got " + south.places.length);
}
if (south.places[0].place.zip !== "12202") {
  throw new Error("closest should be 12202, got " + south.places[0].place.name);
}
for (const m of south.places) {
  if (!m.place.sourceUrl || !m.place.phone) throw new Error("missing source " + m.place.id);
}

const outside = matchFood("10001", now);
if (outside.ok || outside.reason !== "outside") throw new Error("10001 should be outside");

const ssn = matchFood("123-45-6789", now);
if (ssn.ok || ssn.reason !== "ssn") throw new Error("ssn should be rejected");

const arbor = matchFood("Arbor Hill", now);
if (!arbor.ok || !arbor.places.some((p) => p.place.zip === "12210" || p.place.zip === "12207")) {
  throw new Error("arbor hill mismatch");
}

console.log("week", south.weekLabel);
for (const m of south.places) {
  console.log("-", m.place.name, m.opening ? formatWhen(m.opening) : "hours unknown", m.place.sourceUpdated);
}
console.log("ok");
