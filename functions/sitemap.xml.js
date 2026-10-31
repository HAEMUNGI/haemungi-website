import {loadPublishedRows, groupStories, renderSitemap, xmlResponse} from '../story-seo-lib.mjs';

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== 'GET' && method !== 'HEAD') return new Response('Method not allowed', {status:405,headers:{Allow:'GET, HEAD'}});
  try {
    const stories = groupStories(await loadPublishedRows());
    return xmlResponse(renderSitemap(stories), 200, method);
  } catch (error) {
    console.error('Story sitemap public read failed:', error?.message || 'unknown');
    return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><error>Temporarily unavailable</error>', 503, method);
  }
}
