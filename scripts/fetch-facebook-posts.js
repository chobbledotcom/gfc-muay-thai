#!/usr/bin/env bun
import { join } from "node:path";
import { exists, fs, loadEnv, path, readJson, write } from "./utils.js";

await loadEnv();

const limitArg = process.argv.find((a) => a.startsWith("--limit="));

const CONFIG = {
  siteConfig: path("_data", "site.json"),
  postsDir: path("social-posts"),
  imagesDir: path("images", "facebook-posts"),
  actorId: "KoJrdxJCTtpon81KY",
  resultsLimit: limitArg ? Number(limitArg.split("=")[1]) : 8,
};

const formatSlug = (date, id) => {
  const safeDate = new Date(date)
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/-\d{3}Z$/, "Z");
  const safeId = String(id)
    .replace(/[^a-z0-9]/gi, "-")
    .slice(0, 20);
  return `${safeDate}-${safeId}`;
};

const getImageUrl = (p) => {
  const mediaItem = p.media?.[0];
  return (
    p.fullPicture ||
    p.image ||
    p.displayUrl ||
    mediaItem?.photo_image?.uri ||
    mediaItem?.thumbnail ||
    null
  );
};

const getPostDate = (post) => {
  const date = post.time || post.createdTime || post.date;
  if (date) return new Date(date).toISOString();
  if (!post.timestamp) return null;

  const timestamp = Number(post.timestamp);
  const milliseconds = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return new Date(milliseconds).toISOString();
};

const getPostTitle = (post) =>
  (post.text || post.message || post.caption || "View this post on Facebook")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

const fetchPosts = async (facebookUrl) => {
  const url = `https://api.apify.com/v2/acts/${CONFIG.actorId}/run-sync-get-dataset-items`;
  console.log(`Fetching posts for ${facebookUrl}...`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.APIFY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startUrls: [{ url: facebookUrl }],
      resultsLimit: CONFIG.resultsLimit,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const results = await res.json();
  if (!Array.isArray(results)) throw new Error("Invalid API response format");

  return results
    .map((p) => ({
      id: p.postId || p.id || p.url,
      date: getPostDate(p),
      title: getPostTitle(p),
      url: p.url,
      imageUrl: getImageUrl(p),
    }))
    .filter((post) => post.url && post.date);
};

const downloadImage = async (imageUrl, filepath) => {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
  await write(filepath, await res.arrayBuffer());
};

const savePost = async (post) => {
  const slug = formatSlug(post.date, post.id);
  const jsonPath = join(CONFIG.postsDir, `${slug}.json`);

  if (await exists(jsonPath)) return false;

  let thumbnail = null;
  if (post.imageUrl) {
    const ext = post.imageUrl.includes(".png") ? "png" : "jpg";
    const imagePath = join(CONFIG.imagesDir, `${slug}.${ext}`);
    try {
      await downloadImage(post.imageUrl, imagePath);
      thumbnail = `/images/facebook-posts/${slug}.${ext}`;
    } catch (err) {
      console.warn(`  Could not download image for ${slug}: ${err.message}`);
    }
  }

  await write(
    jsonPath,
    `${JSON.stringify(
      {
        url: post.url,
        date: post.date,
        name: post.title,
        title: post.title,
        thumbnail,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${slug}.json`);
  return true;
};

const main = async () => {
  if (!process.env.APIFY_API_KEY) {
    console.error("Error: APIFY_API_KEY required in .env file");
    console.error("Get token: https://console.apify.com/account/integrations");
    process.exit(1);
  }

  if (!(await exists(CONFIG.siteConfig))) {
    console.error(`Error: ${CONFIG.siteConfig} not found`);
    process.exit(1);
  }

  const siteConfig = await readJson(CONFIG.siteConfig);
  const facebookUrl = siteConfig.socials?.Facebook;
  if (!facebookUrl) {
    console.error("Error: socials.Facebook missing in site.json");
    process.exit(1);
  }

  fs.mkdir(CONFIG.postsDir);
  fs.mkdir(CONFIG.imagesDir);

  const posts = await fetchPosts(facebookUrl);
  console.log(`Found ${posts.length} posts`);

  const saved = (await Promise.all(posts.map(savePost))).filter(Boolean).length;
  console.log(
    `\nSaved ${saved} new posts (${posts.length - saved} already existed)`,
  );
};

if (import.meta.main) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
