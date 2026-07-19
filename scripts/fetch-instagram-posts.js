#!/usr/bin/env bun

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { exists, fs, loadEnv, path, readJson, write } from "./utils.js";

await loadEnv();

const CONFIG = {
  siteConfig: path("_data", "site.json"),
  actorId: "shu8hvrXbJbY3Eb9W",
  resultsLimit: 100,
  postsToKeep: 12,
  mealPrepUrl: "https://www.instagram.com/jojosflavourss/",
};

const apifyToken = process.env.APIFY_API_KEY || process.env.APIFY_API_TOKEN;

const formatTimestamp = (iso) =>
  iso.replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "Z");

const extractUsername = (instagramUrl) => {
  const match = instagramUrl.match(/instagram\.com\/([^/?#]+)/);
  return match ? match[1] : null;
};

const fetchPosts = async (profileUrl) => {
  const url = `https://api.apify.com/v2/acts/${CONFIG.actorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  console.log(`Fetching posts for ${profileUrl}...`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [profileUrl],
      resultsType: "posts",
      resultsLimit: CONFIG.resultsLimit,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const results = await res.json();
  if (!Array.isArray(results)) throw new Error("Invalid API response format");

  return results
    .filter((p) => p.timestamp && p.displayUrl && p.url)
    .map((p) => ({
      date: p.timestamp,
      title: p.caption || "",
      url: p.url,
      thumbnail: p.displayUrl,
    }))
    .toSorted((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, CONFIG.postsToKeep);
};

const downloadImage = async (imageUrl, filepath) => {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image HTTP ${res.status} for ${imageUrl}`);
  await write(filepath, await res.arrayBuffer());
};

const savePost = async (target, post) => {
  const slug = formatTimestamp(post.date);
  const jsonPath = join(target.postsDir, `${slug}.json`);
  const imagePath = join(target.imagesDir, `${slug}.jpg`);

  if (await exists(jsonPath)) return false;

  await downloadImage(post.thumbnail, imagePath);

  const record = {
    thumbnail: `/images/${target.directory}/${slug}.jpg`,
    title: post.title,
    date: post.date,
    url: post.url,
  };

  await write(jsonPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${slug}.json`);
  return true;
};

const removeOldPosts = (target, posts) => {
  const currentSlugs = new Set(posts.map((post) => formatTimestamp(post.date)));
  for (const filename of readdirSync(target.postsDir)) {
    if (!filename.endsWith(".json")) continue;
    const slug = filename.replace(/\.json$/, "");
    if (currentSlugs.has(slug)) continue;
    fs.rm(join(target.postsDir, filename));
    fs.rm(join(target.imagesDir, `${slug}.jpg`));
  }
};

const createTarget = (name, profileUrl, directory) => ({
  name,
  profileUrl,
  directory,
  postsDir: path(directory),
  imagesDir: path("images", directory),
});

const syncTarget = async (target) => {
  fs.mkdir(target.postsDir);
  fs.mkdir(target.imagesDir);

  const posts = await fetchPosts(target.profileUrl);
  const postSlugs = new Set(posts.map((post) => formatTimestamp(post.date)));
  if (posts.length !== CONFIG.postsToKeep || postSlugs.size !== posts.length) {
    throw new Error(
      `Expected ${CONFIG.postsToKeep} unique Instagram posts for ${target.name}`,
    );
  }
  console.log(`Found ${posts.length} posts for ${target.name}`);

  const saved = (
    await Promise.all(posts.map((post) => savePost(target, post)))
  ).filter(Boolean).length;
  removeOldPosts(target, posts);

  console.log(
    `Saved ${saved} new posts for ${target.name} (${posts.length - saved} already existed)`,
  );
};

const main = async () => {
  if (!apifyToken) {
    console.error("Error: APIFY_API_KEY required in .env file");
    console.error("Get token: https://console.apify.com/account/integrations");
    process.exit(1);
  }

  if (!(await exists(CONFIG.siteConfig))) {
    console.error(`Error: ${CONFIG.siteConfig} not found`);
    process.exit(1);
  }

  const siteConfig = await readJson(CONFIG.siteConfig);
  const instagramUrl = siteConfig.socials?.Instagram;
  if (!instagramUrl || !extractUsername(instagramUrl)) {
    console.error("Error: socials.Instagram missing or invalid in site.json");
    process.exit(1);
  }

  const targets = [
    createTarget("GFC Muay Thai", instagramUrl, "instagram-posts"),
    createTarget("Jojo's Flavours", CONFIG.mealPrepUrl, "meal-prep-posts"),
  ];
  for (const target of targets) {
    await syncTarget(target);
  }
};

if (import.meta.main) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
