import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { and, desc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import {
  instagramConnections,
  socialPlatformConfigs,
  socialContentItems,
  socialInteractions,
  socialMetricSnapshots,
  employees,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import { decryptApiKey, encryptApiKey } from "../../lib/crypto-keys.js";
import { env } from "../../env.js";
import { AiKeyManagerService } from "../../modules/ai/keys/ai-key-manager.service.js";
import { requirePerm } from "../../lib/session.js";

async function graph<T>(path: string, token: string, init?: RequestInit, version = env.metaGraphVersion): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://graph.facebook.com/${version}${path}${separator}access_token=${encodeURIComponent(token)}`, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any)?.error?.message || `Meta API ${response.status}`);
  return data as T;
}

async function loadMetaConfig(db: AppVars["Variables"]["db"], requestUrl?: string) {
  const row = (await db.select().from(socialPlatformConfigs).where(eq(socialPlatformConfigs.provider, "instagram")).limit(1))[0];
  const inferredRedirect = requestUrl ? `${new URL(requestUrl).origin}/api/v1/admin/social/instagram/callback` : env.metaRedirectUri;
  if (row) return {
    appId: row.appId,
    appSecret: decryptApiKey(row.encryptedAppSecret),
    webhookVerifyToken: decryptApiKey(row.encryptedWebhookVerifyToken),
    graphVersion: row.graphVersion,
    redirectUri: row.redirectUri || inferredRedirect,
  };
  return {
    appId: env.metaAppId,
    appSecret: env.metaAppSecret,
    webhookVerifyToken: env.metaWebhookVerifyToken,
    graphVersion: env.metaGraphVersion,
    redirectUri: env.metaRedirectUri || inferredRedirect,
  };
}

async function runSocialAi(db: AppVars["Variables"]["db"], system: string, user: string) {
  const manager = new AiKeyManagerService(db);
  const key = await manager.acquireActiveKey("kie");
  if (!key) {
    throw new ApiError(409, "missing_ai_key", "Không tìm thấy KIE API key đang hoạt động trong Quản lý khóa AI. Vui lòng thêm hoặc kích hoạt khóa KIE.");
  }
  const endpoint = `${env.kieBaseUrl.replace(/\/+$/, "")}/openai/v1/responses`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key.rawKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.kieContentModel, stream: false, reasoning: { effort: "none" }, input: [{ role: "user", content: [{ type: "input_text", text: `${system}\n\n${user}` }] }] }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      const errMsg = data?.error?.message || `AI API trả về mã lỗi HTTP ${response.status}`;
      throw new Error(errMsg);
    }
    await manager.recordSuccess(key.id);
    const content = (data?.output || [])
      .flatMap((item: any) => item?.content || [])
      .filter((part: any) => part?.type === "output_text" || part?.type === "text")
      .map((part: any) => String(part?.text || ""))
      .join("")
      .trim();
    if (!content) throw new Error("KIE trả về nội dung rỗng");
    return {
      content,
      keyUsed: {
        id: key.id,
        label: key.label,
        provider: "KIE",
        creditsRemaining: key.creditsRemaining,
      },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await manager.recordFailure(key.id, "RATE_LIMITED", errMsg);
    throw error;
  }
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

async function waitForContainerReady(
  containerId: string,
  token: string,
  version: string,
  maxAttempts = 15,
  delayMs = 2000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await graph<{ status_code?: string; status?: string }>(
      `/${containerId}?fields=status_code,status`,
      token,
      undefined,
      version
    ).catch(() => null);

    if (!res || !res.status_code || res.status_code === "FINISHED") {
      return;
    }
    if (res.status_code === "ERROR") {
      throw new Error(`Xử lý media trên Instagram thất bại: ${res.status || "Lỗi xử lý file từ Meta"}`);
    }
    if (res.status_code === "IN_PROGRESS") {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } else {
      return;
    }
  }
}

async function publishContent(db: AppVars["Variables"]["db"], contentId: string) {
  const content = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, contentId)).limit(1))[0];
  if (!content) throw new Error("Không tìm thấy nội dung");
  if (!content.connectionId) throw new Error("Nội dung chưa gắn tài khoản Instagram");
  const connection = (await db.select().from(instagramConnections).where(eq(instagramConnections.id, content.connectionId)).limit(1))[0];
  if (!connection || connection.status !== "active") throw new Error("Kết nối Instagram không hoạt động");

  const rawUrls = Array.isArray(content.mediaUrls) ? content.mediaUrls : [];
  const mediaUrls = rawUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  if (!mediaUrls.length) throw new Error("Cần ít nhất một URL ảnh hoặc video công khai");

  const token = decryptApiKey(connection.encryptedAccessToken);
  const meta = await loadMetaConfig(db);
  await db.update(socialContentItems).set({ status: "publishing", lastError: null, updatedAt: new Date() }).where(eq(socialContentItems.id, content.id));

  try {
    let creationId: string;
    const isCarousel = mediaUrls.length > 1 && content.mediaType !== "REELS";

    if (content.mediaType === "REELS") {
      const params = new URLSearchParams({ caption: content.caption, media_type: "REELS", video_url: mediaUrls[0] });
      const container = await graph<{ id: string }>(`/${connection.instagramUserId}/media?${params}`, token, { method: "POST" }, meta.graphVersion);
      await waitForContainerReady(container.id, token, meta.graphVersion);
      creationId = container.id;
    } else if (isCarousel) {
      // Instagram Carousel: hỗ trợ từ 2 đến tối đa 10 ảnh / video
      const validUrls = mediaUrls.slice(0, 10);
      const childIds: string[] = [];

      for (const url of validUrls) {
        const isVideo = isVideoUrl(url);
        const itemParams = new URLSearchParams({ is_carousel_item: "true" });
        if (isVideo) {
          itemParams.set("media_type", "VIDEO");
          itemParams.set("video_url", url);
        } else {
          itemParams.set("image_url", url);
        }
        const itemContainer = await graph<{ id: string }>(
          `/${connection.instagramUserId}/media?${itemParams}`,
          token,
          { method: "POST" },
          meta.graphVersion
        );
        if (isVideo) {
          await waitForContainerReady(itemContainer.id, token, meta.graphVersion);
        }
        childIds.push(itemContainer.id);
      }

      const carouselParams = new URLSearchParams({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: content.caption,
      });
      const carouselContainer = await graph<{ id: string }>(
        `/${connection.instagramUserId}/media?${carouselParams}`,
        token,
        { method: "POST" },
        meta.graphVersion
      );
      await waitForContainerReady(carouselContainer.id, token, meta.graphVersion);
      creationId = carouselContainer.id;
    } else {
      const singleUrl = mediaUrls[0];
      const isVideo = isVideoUrl(singleUrl);
      const params = new URLSearchParams({ caption: content.caption });
      if (isVideo) {
        params.set("media_type", "REELS");
        params.set("video_url", singleUrl);
      } else {
        params.set("image_url", singleUrl);
      }
      const container = await graph<{ id: string }>(`/${connection.instagramUserId}/media?${params}`, token, { method: "POST" }, meta.graphVersion);
      if (isVideo) {
        await waitForContainerReady(container.id, token, meta.graphVersion);
      }
      creationId = container.id;
    }

    const published = await graph<{ id: string }>(
      `/${connection.instagramUserId}/media_publish?creation_id=${encodeURIComponent(creationId)}`,
      token,
      { method: "POST" },
      meta.graphVersion
    );
    const detail: { permalink?: string } = await graph<{ permalink?: string }>(
      `/${published.id}?fields=permalink`,
      token,
      undefined,
      meta.graphVersion
    ).catch(() => ({}));

    await db.update(socialContentItems).set({
      status: "published",
      mediaType: isCarousel ? "CAROUSEL" : content.mediaType,
      externalPostId: published.id,
      permalink: detail.permalink ?? null,
      publishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(socialContentItems.id, content.id));

    return published.id;
  } catch (error) {
    await db.update(socialContentItems).set({
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: new Date(),
    }).where(eq(socialContentItems.id, content.id));
    throw error;
  }
}

export async function publishDueSocialContent(db: AppVars["Variables"]["db"]) {
  const due = await db.select({ id: socialContentItems.id }).from(socialContentItems)
    .where(and(eq(socialContentItems.status, "scheduled"), lte(socialContentItems.scheduledAt, new Date()))).limit(10);
  for (const item of due) await publishContent(db, item.id).catch((error) => console.error("Instagram publish failed", item.id, error));
}

export const adminSocialRoutes = new Hono<AppVars>();
adminSocialRoutes.use("*", async (c, next) => {
  if (c.req.path.includes("/instagram/callback")) {
    return next();
  }
  return requireAuth(c, next);
});

adminSocialRoutes.get("/overview", async (c) => {
  requirePerm(c.get("user")!, "channel.read");
  const db = c.get("db");
  const [connections, contentRows, interactions, metrics, staffRows] = await Promise.all([
    db.select().from(instagramConnections).orderBy(desc(instagramConnections.createdAt)),
    db.select().from(socialContentItems).orderBy(desc(socialContentItems.createdAt)),
    db.select().from(socialInteractions).orderBy(desc(socialInteractions.createdAt)).limit(100),
    db.select().from(socialMetricSnapshots).orderBy(desc(socialMetricSnapshots.capturedAt)).limit(100),
    db.select({ accountId: employees.accountId, fullName: employees.fullName }).from(employees),
  ]);

  const staffMap = new Map<string, string>();
  for (const s of staffRows) {
    if (s.accountId) staffMap.set(s.accountId, s.fullName);
  }

  const metricsMap = new Map<string, { impressions: number; reach: number; likes: number; comments: number; saves: number; shares: number; capturedAt?: Date }>();
  for (const m of metrics) {
    const cur = metricsMap.get(m.contentId) || { impressions: 0, reach: 0, likes: 0, comments: 0, saves: 0, shares: 0 };
    cur.impressions = Math.max(cur.impressions, m.impressions);
    cur.reach = Math.max(cur.reach, m.reach);
    cur.likes = Math.max(cur.likes, m.likes);
    cur.comments = Math.max(cur.comments, m.comments);
    cur.saves = Math.max(cur.saves, m.saves);
    cur.shares = Math.max(cur.shares, m.shares);
    if (!cur.capturedAt || (m.capturedAt && m.capturedAt > cur.capturedAt)) {
      cur.capturedAt = m.capturedAt;
    }
    metricsMap.set(m.contentId, cur);
  }

  // Đồng bộ live metrics từ Meta Graph API cho các bài viết đã xuất bản
  const isRefresh = Boolean(c.req.query("refresh"));
  const publishedItems = contentRows.filter((item) => item.status === "published" && item.connectionId && item.externalPostId);

  if (publishedItems.length > 0) {
    const meta = await loadMetaConfig(db, c.req.url).catch(() => null);
    const connMap = new Map(connections.map((conn) => [conn.id, conn]));
    const now = Date.now();

    await Promise.allSettled(
      publishedItems.map(async (item) => {
        const existing = metricsMap.get(item.id);
        const isStale = !existing?.capturedAt || (now - new Date(existing.capturedAt).getTime()) > 5 * 60 * 1000;
        if (!isRefresh && !isStale) return;

        const connection = connMap.get(item.connectionId!);
        if (!connection || connection.status !== "active") return;

        try {
          const token = decryptApiKey(connection.encryptedAccessToken);
          const version = meta?.graphVersion || env.metaGraphVersion;
          const base = await graph<{ like_count?: number; comments_count?: number }>(
            `/${item.externalPostId}?fields=like_count,comments_count`,
            token,
            undefined,
            version
          );
          const insight = await graph<{ data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
            `/${item.externalPostId}/insights?metric=reach,impressions,saved,shares`,
            token,
            undefined,
            version
          ).catch(() => ({ data: [] }));

          const metricVal = (name: string) => {
            const row = insight.data?.find((i) => i.name === name);
            return Number(row?.total_value?.value ?? row?.values?.[0]?.value ?? 0);
          };

          const impressions = metricVal("impressions");
          const reach = metricVal("reach");
          const likes = Number(base.like_count ?? 0);
          const comments = Number(base.comments_count ?? 0);
          const saves = metricVal("saved");
          const shares = metricVal("shares");

          const [snapshot] = await db.insert(socialMetricSnapshots).values({
            contentId: item.id,
            impressions,
            reach,
            likes,
            comments,
            saves,
            shares,
          }).returning();

          metricsMap.set(item.id, {
            impressions,
            reach,
            likes,
            comments,
            saves,
            shares,
            capturedAt: snapshot?.capturedAt || new Date(),
          });
        } catch (err) {
          console.warn(`Could not sync live metrics for post ${item.id}:`, err);
        }
      })
    );
  }

  const enrichedContent = contentRows.map((item) => {
    const m = metricsMap.get(item.id);
    return {
      ...item,
      creatorName: item.createdById ? (staffMap.get(item.createdById) || "Quản trị viên") : "ÉLANE Admin",
      approvedByName: item.approvedById ? (staffMap.get(item.approvedById) || "Quản lý") : null,
      views: m ? m.reach || m.impressions : 0,
      reach: m ? m.reach : 0,
      impressions: m ? m.impressions : 0,
      likes: m ? m.likes : 0,
      comments: m ? m.comments : 0,
      saves: m ? m.saves : 0,
      shares: m ? m.shares : 0,
      lastSyncedAt: m?.capturedAt ? m.capturedAt.toISOString() : null,
    };
  });

  const connectionsWithProfile = await Promise.all(
    connections.map(async ({ encryptedAccessToken, ...conn }) => {
      let profile: { followers_count?: number; follows_count?: number; media_count?: number; profile_picture_url?: string; name?: string } | null = null;
      try {
        const token = decryptApiKey(encryptedAccessToken);
        profile = await graph<any>(`/${conn.instagramUserId}?fields=id,username,name,followers_count,follows_count,media_count,profile_picture_url`, token, undefined, env.metaGraphVersion);
      } catch (err) {
        console.warn(`Could not fetch live profile for Instagram ${conn.username}:`, err);
      }
      return {
        ...conn,
        accountName: profile?.name || conn.username,
        followers: profile?.followers_count ?? 0,
        following: profile?.follows_count ?? 0,
        mediaCount: profile?.media_count ?? 0,
        avatarUrl: profile?.profile_picture_url || null,
      };
    })
  );

  return c.json({
    connections: connectionsWithProfile, content: enrichedContent, interactions, metrics,
  });
});

adminSocialRoutes.get("/settings", async (c) => {
  requirePerm(c.get("user")!, "channel.read");
  const db = c.get("db");
  const row = (await db.select().from(socialPlatformConfigs).where(eq(socialPlatformConfigs.provider, "instagram")).limit(1))[0];
  const origin = new URL(c.req.url).origin;
  return c.json({
    appId: row?.appId ?? env.metaAppId,
    graphVersion: row?.graphVersion ?? env.metaGraphVersion,
    redirectUri: row?.redirectUri || `${origin}/api/v1/admin/social/instagram/callback`,
    webhookUrl: `${origin}/api/v1/webhooks/instagram`,
    hasAppSecret: Boolean(row?.encryptedAppSecret || env.metaAppSecret),
    hasWebhookVerifyToken: Boolean(row?.encryptedWebhookVerifyToken || env.metaWebhookVerifyToken),
    source: row ? "database" : "environment",
  });
});

adminSocialRoutes.put("/settings", async (c) => {
  requirePerm(c.get("user")!, "channel.write");
  const parsed = z.object({
    appId: z.string().min(3), appSecret: z.string().optional(), webhookVerifyToken: z.string().optional(),
    graphVersion: z.string().regex(/^v\d+\.\d+$/).default("v23.0"), redirectUri: z.string().url().optional().nullable(),
  }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, "invalid_input", "Cấu hình Meta không hợp lệ", parsed.error.flatten().fieldErrors as any);
  const db = c.get("db");
  const existing = (await db.select().from(socialPlatformConfigs).where(eq(socialPlatformConfigs.provider, "instagram")).limit(1))[0];
  if (!existing && (!parsed.data.appSecret || !parsed.data.webhookVerifyToken)) {
    throw new ApiError(400, "missing_secrets", "Cần nhập App Secret và Webhook Verify Token khi cấu hình lần đầu");
  }
  const values = {
    appId: parsed.data.appId, graphVersion: parsed.data.graphVersion, redirectUri: parsed.data.redirectUri || null,
    encryptedAppSecret: parsed.data.appSecret ? encryptApiKey(parsed.data.appSecret) : existing!.encryptedAppSecret,
    encryptedWebhookVerifyToken: parsed.data.webhookVerifyToken ? encryptApiKey(parsed.data.webhookVerifyToken) : existing!.encryptedWebhookVerifyToken,
    updatedById: c.get("user")!.accountId, updatedAt: new Date(),
  };
  if (existing) await db.update(socialPlatformConfigs).set(values).where(eq(socialPlatformConfigs.id, existing.id));
  else await db.insert(socialPlatformConfigs).values({ provider: "instagram", ...values });
  return c.json({ ok: true });
});

adminSocialRoutes.get("/instagram/connect-url", async (c) => {
  requirePerm(c.get("user")!, "channel.write");
  const meta = await loadMetaConfig(c.get("db"), c.req.url);
  if (!meta.appId || !meta.appSecret) throw new ApiError(409, "meta_not_configured", "Hãy cấu hình Meta App trong trang Kênh bán hàng trước");
  const user = c.get("user")!;
  const payload = Buffer.from(JSON.stringify({ accountId: user.accountId, exp: Date.now() + 10 * 60_000 })).toString("base64url");
  const sig = createHmac("sha256", meta.appSecret).update(payload).digest("base64url");
  const params = new URLSearchParams({
    client_id: meta.appId, redirect_uri: meta.redirectUri, response_type: "code", state: `${payload}.${sig}`,
    scope: "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,instagram_manage_comments",
  });
  return c.json({ url: `https://www.facebook.com/${meta.graphVersion}/dialog/oauth?${params}` });
});

adminSocialRoutes.get("/instagram/callback", async (c) => {
  const meta = await loadMetaConfig(c.get("db"), c.req.url);
  const code = c.req.query("code");
  const state = c.req.query("state") || "";
  const [payload, sig] = state.split(".");
  if (!code || !payload || !sig) throw new ApiError(400, "invalid_oauth", "Phản hồi OAuth không hợp lệ");
  const expected = createHmac("sha256", meta.appSecret).update(payload).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new ApiError(400, "invalid_state", "OAuth state không hợp lệ");
  const stateData = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const currentUser = c.get("user");
  if (currentUser && stateData.accountId !== currentUser.accountId) throw new ApiError(403, "oauth_user_mismatch", "Phiên kết nối không thuộc tài khoản hiện tại");
  const tokenParams = new URLSearchParams({ client_id: meta.appId, client_secret: meta.appSecret, redirect_uri: meta.redirectUri, code });
  const tokenResponse = await fetch(`https://graph.facebook.com/${meta.graphVersion}/oauth/access_token?${tokenParams}`);
  const tokenData = await tokenResponse.json() as any;
  if (!tokenResponse.ok || !tokenData.access_token) throw new ApiError(400, "oauth_failed", tokenData?.error?.message || "Không lấy được access token");
  let targetPage: { id: string; name: string; access_token: string } | null = null;
  let instagramId: string | null = null;

  // 1. Inspect granular scopes via debug_token (handles Meta's granular permission selections)
  try {
    const debugUrl = `https://graph.facebook.com/${meta.graphVersion}/debug_token?input_token=${encodeURIComponent(tokenData.access_token)}&access_token=${encodeURIComponent(`${meta.appId}|${meta.appSecret}`)}`;
    const debugRes = await fetch(debugUrl);
    const debugData = (await debugRes.json().catch(() => ({}))) as any;
    console.log("Token debug metadata:", JSON.stringify(debugData));

    const granularScopes: Array<{ scope: string; target_ids?: string[] }> = debugData?.data?.granular_scopes || [];
    for (const item of granularScopes) {
      if (item.scope.startsWith("instagram_") && item.target_ids?.length && !instagramId) {
        instagramId = item.target_ids[0];
      }
      if (item.scope.startsWith("pages_") && item.target_ids?.length && !targetPage) {
        targetPage = { id: item.target_ids[0], name: "Facebook Page", access_token: tokenData.access_token };
      }
    }
  } catch (err) {
    console.warn("debug_token inspection failed:", err);
  }

  // 2. If targetPage was found from granular scopes, query its details & page access token
  if (targetPage?.id) {
    try {
      const pageInfo = await graph<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string } }>(
        `/${targetPage.id}?fields=id,name,access_token,instagram_business_account`,
        tokenData.access_token,
        undefined,
        meta.graphVersion
      );
      console.log(`Page info for ${targetPage.id}:`, JSON.stringify(pageInfo));
      if (pageInfo.name) targetPage.name = pageInfo.name;
      if (pageInfo.access_token) targetPage.access_token = pageInfo.access_token;
      if (pageInfo.instagram_business_account?.id && !instagramId) {
        instagramId = pageInfo.instagram_business_account.id;
      }
    } catch (err) {
      console.warn("Fetching pageInfo failed, using user token:", err);
    }
  }

  // 3. Fallback: query /me/accounts if instagramId is still missing
  if (!instagramId) {
    try {
      const pages = await graph<{
        data: Array<{
          id: string;
          name: string;
          access_token: string;
          instagram_business_account?: { id: string };
          connected_instagram_account?: { id: string };
        }>;
      }>("/me/accounts?fields=id,name,access_token,instagram_business_account,connected_instagram_account", tokenData.access_token, undefined, meta.graphVersion);

      console.log("Pages found in /me/accounts:", JSON.stringify(pages));

      for (const page of pages.data || []) {
        if (page.instagram_business_account?.id) {
          targetPage = page;
          instagramId = page.instagram_business_account.id;
          break;
        }
        if (page.connected_instagram_account?.id) {
          targetPage = page;
          instagramId = page.connected_instagram_account.id;
          break;
        }

        const pageDetail = (await graph<{
          instagram_business_account?: { id: string };
          connected_instagram_account?: { id: string };
        }>(`/${page.id}?fields=instagram_business_account,connected_instagram_account`, page.access_token, undefined, meta.graphVersion).catch(() => ({}))) as any;
        const foundId = pageDetail.instagram_business_account?.id || pageDetail.connected_instagram_account?.id;
        if (foundId) {
          targetPage = page;
          instagramId = foundId;
          break;
        }
      }
    } catch (err) {
      console.warn("Querying /me/accounts failed:", err);
    }
  }

  if (!instagramId) {
    console.error("No linked Instagram account identified. targetPage:", JSON.stringify(targetPage));
    throw new ApiError(409, "instagram_missing", "Không tìm thấy Instagram Professional gắn với Facebook Page");
  }

  const tokenToUse = targetPage?.access_token || tokenData.access_token;
  const profile = await graph<{ id: string; username: string }>(`/${instagramId}?fields=id,username`, tokenToUse, undefined, meta.graphVersion);
  console.log("Instagram profile retrieved:", JSON.stringify(profile));

  const db = c.get("db");
  const existing = (await db.select().from(instagramConnections).where(eq(instagramConnections.instagramUserId, profile.id)).limit(1))[0];
  const values = {
    username: profile.username, pageId: targetPage?.id || "unknown", encryptedAccessToken: encryptApiKey(tokenToUse),
    status: "active", scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_comments"], updatedAt: new Date(),
  };
  if (existing) await db.update(instagramConnections).set(values).where(eq(instagramConnections.id, existing.id));
  else await db.insert(instagramConnections).values({ instagramUserId: profile.id, createdById: stateData.accountId, ...values });
  return c.redirect(`${env.adminOrigin}/kenhbanhang?connected=1`);
});

const contentSchema = z.object({
  connectionId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  caption: z.string().default(""),
  mediaType: z.enum(["IMAGE", "CAROUSEL", "REELS"]).default("IMAGE"),
  mediaUrls: z.array(z.string()).default([]),
  source: z.enum(["user", "ai", "ai_assisted", "manual"]).default("user"),
  campaignCode: z.string().optional().nullable(),
  status: z.enum(["draft", "pending", "approved", "scheduled", "publishing", "published", "failed"]).default("draft"),
  scheduledAt: z.string().datetime().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  metadata: z.record(z.any()).optional().nullable(),
});

adminSocialRoutes.post("/content", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const parsed = contentSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, "invalid_input", "Nội dung không hợp lệ", parsed.error.flatten().fieldErrors as any);
  const data = parsed.data;
  if (data.mediaType === "IMAGE" && data.mediaUrls.length > 1) {
    data.mediaType = "CAROUSEL";
  }
  const [row] = await c.get("db").insert(socialContentItems).values({ ...data, createdById: c.get("user")!.accountId }).returning();
  return c.json(row, 201);
});

adminSocialRoutes.get("/ai-key-status", async (c) => {
  requirePerm(c.get("user")!, "content.read");
  const manager = new AiKeyManagerService(c.get("db"));
  const key = await manager.acquireActiveKey("kie");
  if (!key) {
    return c.json({
      active: false,
      message: "Chưa có khóa KIE nào đang hoạt động trong Quản lý khóa AI",
    });
  }
  return c.json({
    active: true,
    key: {
      id: key.id,
      label: key.label,
      provider: "KIE",
      creditsRemaining: key.creditsRemaining,
    },
  });
});

adminSocialRoutes.post("/content/generate", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const body = z
    .object({
      brief: z.string().min(3),
      productContext: z.string().optional(),
      tone: z.string().default("thanh lịch, tinh tế"),
      count: z.number().int().min(1).max(5).default(1),
      channels: z.array(z.enum(["facebook", "instagram", "tiktok"])).optional(),
      objective: z.string().optional(),
      audience: z.string().optional(),
      products: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        imageUrls: z.array(z.string().url()).optional(),
        sku: z.string().optional(),
        price: z.number().int().nonnegative().optional(),
        category: z.string().optional(),
      })).optional(),
    })
    .parse(await c.req.json());
  const manager = new AiKeyManagerService(c.get("db"));
  const key = await manager.acquireActiveKey("kie");
  if (!key) throw new ApiError(409, "missing_ai_key", "Không tìm thấy KIE API key đang hoạt động trong Quản lý khóa AI.");

  const channels = body.channels?.length ? body.channels : ["facebook", "instagram", "tiktok"];
  const products = body.products?.length ? body.products : [{
    id: "content-context",
    name: "Nội dung ÉLANE",
    description: body.productContext || body.brief,
    imageUrls: [],
    sku: undefined,
    price: undefined,
    category: undefined,
  }];
  const objectiveMap: Record<string, "awareness" | "engagement" | "conversion" | "launch"> = {
    "Nhận diện thương hiệu": "awareness",
    "Giới thiệu sản phẩm": "awareness",
    "Khuyến mãi": "conversion",
    "Bộ sưu tập": "launch",
    "Kiến thức thời trang": "awareness",
    "Tăng tương tác": "engagement",
    "Thúc đẩy bán hàng": "conversion",
    "Ra mắt sản phẩm": "launch",
    "Khác": "engagement",
  };
  const jobId = `content-${Date.now()}-${randomUUID().slice(0, 8)}`;

  try {
    const response = await fetch(`${env.aiWorkerUrl.replace(/\/+$/, "")}/v1/content/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description || "",
          image_urls: product.imageUrls || [],
          category: product.category,
        })),
        channels,
        objective: objectiveMap[body.objective || ""] || "engagement",
        audience: body.audience || "Nữ công sở 25-35 tuổi",
        tone: body.tone,
        custom_instructions: body.brief,
        brand_context: "ÉLANE - thời trang nữ thanh lịch, hiện đại",
        openai_api_key: key.rawKey,
      }),
    });
    const result = await response.json() as any;
    if (!response.ok) throw new Error(result?.detail?.error_message || `AI Worker trả về HTTP ${response.status}`);
    await manager.recordSuccess(key.id);
    const variants = (result?.draft?.variants || []).map((item: any) => ({
      title: item.headline,
      caption: item.caption,
      hashtags: item.hashtags,
      cta: item.call_to_action,
      channel: item.channel,
      visualBrief: item.visual_brief,
    }));
    return c.json({
      variants,
      jobId,
      review: result.review,
      productBrief: result.product_brief,
      keyUsed: { id: key.id, label: key.label, provider: "KIE", creditsRemaining: key.creditsRemaining },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(502, "content_generation_failed", `AI Worker không thể tạo nội dung: ${message}`);
  }
});

adminSocialRoutes.patch("/content/:id", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const parsed = contentSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw new ApiError(400, "invalid_input", "Nội dung cập nhật không hợp lệ");
  const data = { ...parsed.data };
  if (data.mediaUrls && data.mediaUrls.length > 1 && (!data.mediaType || data.mediaType === "IMAGE")) {
    data.mediaType = "CAROUSEL";
  } else if (data.mediaUrls && data.mediaUrls.length <= 1 && data.mediaType === "CAROUSEL") {
    data.mediaType = "IMAGE";
  }
  const [row] = await c.get("db").update(socialContentItems).set({ ...data, updatedAt: new Date() }).where(eq(socialContentItems.id, c.req.param("id"))).returning();
  return c.json(row);
});

adminSocialRoutes.post("/content/:id/approve", async (c) => {
  requirePerm(c.get("user")!, "content.publish");
  const body = z.object({ scheduledAt: z.string().datetime().optional().nullable(), publishNow: z.boolean().default(false) }).parse(await c.req.json().catch(() => ({})));
  const now = new Date();
  const status = body.publishNow ? "approved" : body.scheduledAt ? "scheduled" : "approved";
  const [row] = await c.get("db").update(socialContentItems).set({ status, approvedAt: now, approvedById: c.get("user")!.accountId, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, updatedAt: now }).where(eq(socialContentItems.id, c.req.param("id"))).returning();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  if (body.publishNow) await publishContent(c.get("db"), row.id);
  return c.json((await c.get("db").select().from(socialContentItems).where(eq(socialContentItems.id, row.id)).limit(1))[0]);
});

adminSocialRoutes.post("/content/:id/unapprove", async (c) => {
  requirePerm(c.get("user")!, "content.publish");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  if (existing.status !== "approved") throw new ApiError(409, "invalid_state", "Chỉ có thể hủy phê duyệt bài chưa đăng");
  const [updated] = await db.update(socialContentItems).set({
    status: "pending",
    approvedAt: null,
    approvedById: null,
    scheduledAt: null,
    updatedAt: new Date(),
  }).where(eq(socialContentItems.id, id)).returning();
  return c.json(updated);
});

adminSocialRoutes.delete("/content/:id", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const id = c.req.param("id");
  const force = c.req.query("force") === "true";
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");

  let deletedOnInstagram = false;
  let instagramError: string | null = null;

  if (existing.externalPostId && existing.externalPostId.trim().length > 0) {
    let connection = existing.connectionId
      ? (await db.select().from(instagramConnections).where(eq(instagramConnections.id, existing.connectionId)).limit(1))[0]
      : null;

    if (!connection || connection.status !== "active") {
      connection = (await db.select().from(instagramConnections).where(eq(instagramConnections.status, "active")).limit(1))[0];
    }

    // Thử gọi Meta Graph API xóa bài (nếu được hỗ trợ)
    if (connection && connection.status === "active") {
      try {
        const token = decryptApiKey(connection.encryptedAccessToken);
        const meta = await loadMetaConfig(db, c.req.url);
        const res = await graph<{ success?: boolean }>(
          `/${existing.externalPostId}`,
          token,
          { method: "DELETE" },
          meta.graphVersion
        );
        deletedOnInstagram = Boolean(res?.success ?? true);
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes("does not exist") || msg.includes("Object with ID")) {
          deletedOnInstagram = true;
        } else {
          instagramError = msg;
          console.warn(`[Delete Post] Meta API không hỗ trợ xóa bài ${existing.externalPostId} qua API:`, instagramError);
        }
      }
    }
  }

  await db.delete(socialMetricSnapshots).where(eq(socialMetricSnapshots.contentId, id)).catch(() => {});
  await db.delete(socialInteractions).where(eq(socialInteractions.contentId, id)).catch(() => {});
  await db.delete(socialContentItems).where(eq(socialContentItems.id, id));

  return c.json({
    ok: true,
    id,
    deletedOnInstagram,
    instagramError,
    externalPostId: existing.externalPostId || null,
  });
});

adminSocialRoutes.post("/content/:id/duplicate", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  const [cloned] = await db.insert(socialContentItems).values({
    connectionId: existing.connectionId,
    title: `[Bản sao] ${existing.title}`,
    caption: existing.caption,
    mediaType: existing.mediaType,
    mediaUrls: existing.mediaUrls,
    source: existing.source,
    campaignCode: existing.campaignCode,
    metadata: existing.metadata,
    status: "draft",
    createdById: c.get("user")!.accountId,
  }).returning();
  return c.json(cloned, 201);
});

adminSocialRoutes.post("/content/:id/send-review", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  const [updated] = await db.update(socialContentItems).set({
    status: "pending",
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(socialContentItems.id, id)).returning();
  return c.json(updated);
});

adminSocialRoutes.post("/content/:id/reject", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : "Bị từ chối duyệt";
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  const [updated] = await db.update(socialContentItems).set({
    status: "draft",
    lastError: note,
    updatedAt: new Date(),
  }).where(eq(socialContentItems.id, id)).returning();
  return c.json(updated);
});

adminSocialRoutes.post("/content/:id/request-changes", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : "Yêu cầu chỉnh sửa nội dung";
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  const [updated] = await db.update(socialContentItems).set({
    status: "draft",
    lastError: note,
    updatedAt: new Date(),
  }).where(eq(socialContentItems.id, id)).returning();
  return c.json(updated);
});

adminSocialRoutes.post("/content/:id/reschedule", async (c) => {
  requirePerm(c.get("user")!, "content.publish");
  const id = c.req.param("id");
  const body = z.object({ scheduledAt: z.string().datetime() }).parse(await c.req.json().catch(() => ({})));
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  const [updated] = await db.update(socialContentItems).set({
    scheduledAt: new Date(body.scheduledAt),
    status: "scheduled",
    updatedAt: new Date(),
  }).where(eq(socialContentItems.id, id)).returning();
  return c.json(updated);
});

adminSocialRoutes.post("/content/:id/cancel-schedule", async (c) => {
  requirePerm(c.get("user")!, "content.publish");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  const [updated] = await db.update(socialContentItems).set({
    scheduledAt: null,
    status: "approved",
    updatedAt: new Date(),
  }).where(eq(socialContentItems.id, id)).returning();
  return c.json(updated);
});

adminSocialRoutes.post("/content/:id/retry", async (c) => {
  requirePerm(c.get("user")!, "content.publish");
  const id = c.req.param("id");
  const db = c.get("db");
  const existing = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy nội dung");
  await publishContent(db, id);
  const [updated] = await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1);
  return c.json(updated);
});

adminSocialRoutes.post("/interactions/:id/retry-ai", async (c) => {
  requirePerm(c.get("user")!, "content.write");
  const interaction = (await c.get("db").select().from(socialInteractions).where(eq(socialInteractions.id, c.req.param("id"))).limit(1))[0];
  if (!interaction) throw new ApiError(404, "not_found", "Không tìm thấy tương tác");
  await autoReplyToInteraction(c.get("db"), interaction.id);
  return c.json({ ok: true });
});

adminSocialRoutes.post("/metrics/sync", async (c) => {
  requirePerm(c.get("user")!, "channel.read");
  const db = c.get("db");
  const meta = await loadMetaConfig(db, c.req.url);
  const published = await db.select().from(socialContentItems).where(eq(socialContentItems.status, "published"));
  let synced = 0;
  for (const content of published) {
    if (!content.connectionId || !content.externalPostId) continue;
    const connection = (await db.select().from(instagramConnections).where(eq(instagramConnections.id, content.connectionId)).limit(1))[0];
    if (!connection) continue;
    try {
      const token = decryptApiKey(connection.encryptedAccessToken);
      const base = await graph<{ like_count?: number; comments_count?: number }>(`/${content.externalPostId}?fields=like_count,comments_count`, token, undefined, meta.graphVersion);
      const insight = await graph<{ data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
        `/${content.externalPostId}/insights?metric=reach,impressions,saved,shares`, token, undefined, meta.graphVersion,
      ).catch(() => ({ data: [] }));
      const metric = (name: string) => {
        const row = insight.data?.find((item) => item.name === name);
        return Number(row?.total_value?.value ?? row?.values?.[0]?.value ?? 0);
      };
      await db.insert(socialMetricSnapshots).values({
        contentId: content.id, impressions: metric("impressions"), reach: metric("reach"),
        likes: Number(base.like_count ?? 0), comments: Number(base.comments_count ?? 0),
        saves: metric("saved"), shares: metric("shares"),
      });
      synced += 1;
    } catch (error) {
      console.error("Instagram metric sync failed", content.id, error);
    }
  }
  return c.json({ synced });
});

adminSocialRoutes.post("/content/:id/sync-metrics", async (c) => {
  requirePerm(c.get("user")!, "channel.read");
  const db = c.get("db");
  const id = c.req.param("id");
  const content = (await db.select().from(socialContentItems).where(eq(socialContentItems.id, id)).limit(1))[0];
  if (!content) throw new ApiError(404, "not_found", "Không tìm thấy nội dung bài viết");
  if (!content.externalPostId || !content.connectionId) {
    throw new ApiError(400, "not_published", "Bài viết chưa được xuất bản lên Instagram nên chưa thể đồng bộ chỉ số");
  }
  const connection = (await db.select().from(instagramConnections).where(eq(instagramConnections.id, content.connectionId)).limit(1))[0];
  if (!connection) throw new ApiError(400, "missing_connection", "Không tìm thấy kết nối Instagram tương ứng");

  const meta = await loadMetaConfig(db, c.req.url);
  const token = decryptApiKey(connection.encryptedAccessToken);

  try {
    const base = await graph<{ like_count?: number; comments_count?: number }>(
      `/${content.externalPostId}?fields=like_count,comments_count`,
      token,
      undefined,
      meta.graphVersion
    );
    const insight = await graph<{ data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
      `/${content.externalPostId}/insights?metric=reach,impressions,saved,shares`,
      token,
      undefined,
      meta.graphVersion
    ).catch(() => ({ data: [] }));

    const metric = (name: string) => {
      const row = insight.data?.find((item) => item.name === name);
      return Number(row?.total_value?.value ?? row?.values?.[0]?.value ?? 0);
    };

    const impressions = metric("impressions");
    const reach = metric("reach");
    const likes = Number(base.like_count ?? 0);
    const comments = Number(base.comments_count ?? 0);
    const saves = metric("saved");
    const shares = metric("shares");

    const [snapshot] = await db.insert(socialMetricSnapshots).values({
      contentId: content.id,
      impressions,
      reach,
      likes,
      comments,
      saves,
      shares,
    }).returning();

    return c.json({
      success: true,
      data: {
        views: reach || impressions,
        reach,
        impressions,
        likes,
        comments,
        saves,
        shares,
        lastSyncedAt: snapshot?.capturedAt ? snapshot.capturedAt.toISOString() : new Date().toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new ApiError(502, "sync_failed", `Không thể lấy chỉ số từ Meta Graph API: ${msg}`);
  }
});

function needsHuman(message: string) {
  return /hoàn tiền|đổi trả|khiếu nại|lừa đảo|tệ|bực|kiện|bồi thường|giao trễ|không nhận được/i.test(message);
}

async function autoReplyToInteraction(db: AppVars["Variables"]["db"], id: string) {
  const interaction = (await db.select().from(socialInteractions).where(eq(socialInteractions.id, id)).limit(1))[0];
  if (!interaction || interaction.status !== "new") return;
  const connection = (await db.select().from(instagramConnections).where(eq(instagramConnections.id, interaction.connectionId)).limit(1))[0];
  if (!connection?.autoReplyEnabled) return;
  if (needsHuman(interaction.message)) {
    await db.update(socialInteractions).set({ status: "escalated", intent: "support", escalationReason: "Nội dung cần nhân viên xử lý", updatedAt: new Date() }).where(eq(socialInteractions.id, id));
    return;
  }
  let reply: string;
  try {
    const aiResult = await runSocialAi(db,
      "Bạn là trợ lý Instagram của thời trang ÉLANE. Trả lời thân thiện, ngắn dưới 350 ký tự. Không bịa giá, size, tồn kho, khuyến mãi hay thời gian giao. Nếu thiếu dữ liệu, mời khách gửi tên sản phẩm hoặc inbox. Không hứa hoàn tiền/bồi thường.",
      interaction.message);
    reply = aiResult.content;
  } catch {
    reply = "ÉLANE cảm ơn bạn đã quan tâm. Bạn cho mình xin tên sản phẩm hoặc gửi tin nhắn để đội ngũ kiểm tra thông tin chính xác nhé.";
  }
  try {
    const token = decryptApiKey(connection.encryptedAccessToken);
    const meta = await loadMetaConfig(db);
    await graph(`/${interaction.externalInteractionId}/replies?message=${encodeURIComponent(reply)}`, token, { method: "POST" }, meta.graphVersion);
    await db.update(socialInteractions).set({ status: "replied", aiReply: reply, repliedAt: new Date(), updatedAt: new Date() }).where(eq(socialInteractions.id, id));
  } catch (error) {
    await db.update(socialInteractions).set({ status: "escalated", aiReply: reply, escalationReason: error instanceof Error ? error.message : String(error), updatedAt: new Date() }).where(eq(socialInteractions.id, id));
  }
}

export const instagramWebhookRoutes = new Hono<AppVars>();
instagramWebhookRoutes.get("/", async (c) => {
  const meta = await loadMetaConfig(c.get("db"), c.req.url);
  if (c.req.query("hub.mode") === "subscribe" && c.req.query("hub.verify_token") === meta.webhookVerifyToken) return c.text(c.req.query("hub.challenge") || "");
  return c.text("Forbidden", 403);
});
instagramWebhookRoutes.post("/", async (c) => {
  const raw = await c.req.text();
  const meta = await loadMetaConfig(c.get("db"), c.req.url);
  const signature = c.req.header("x-hub-signature-256") || "";
  const expected = `sha256=${createHmac("sha256", meta.appSecret).update(raw).digest("hex")}`;
  if (!meta.appSecret || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return c.text("Invalid signature", 401);
  const payload = JSON.parse(raw) as any;
  for (const entry of payload.entry || []) {
    const connection = (await c.get("db").select().from(instagramConnections).where(eq(instagramConnections.instagramUserId, String(entry.id))).limit(1))[0];
    if (!connection) continue;
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const externalId = String(value.id || value.comment_id || "");
      const message = String(value.text || value.message || "");
      if (!externalId || !message) continue;
      const existing = (await c.get("db").select().from(socialInteractions).where(and(eq(socialInteractions.connectionId, connection.id), eq(socialInteractions.externalInteractionId, externalId))).limit(1))[0];
      if (existing) continue;
      const [created] = await c.get("db").insert(socialInteractions).values({
        connectionId: connection.id, externalPostId: value.media?.id || value.media_id || null,
        externalInteractionId: externalId, kind: change.field === "comments" ? "comment" : change.field || "comment",
        authorId: value.from?.id || null, authorUsername: value.from?.username || value.username || null,
        message, rawPayload: value,
      }).returning();
      if (created) await autoReplyToInteraction(c.get("db"), created.id);
    }
  }
  return c.json({ received: true });
});
